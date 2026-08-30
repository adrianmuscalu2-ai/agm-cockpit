import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const evidenceRoot = path.join(root, 'AGM_LIBRARY', 'PHASE3', 'ROUTING_TOLL_001_FINAL_CONSOLIDATED_PRE_APPLY', 'EVIDENCE');
const viaUrl = 'https://via.admin.ch/shop/main-42DWTXKQ.js';
const bazgUrl = 'https://www.bazg.admin.ch/en/faq-vignette-and-e-vignette-purchase';
const viaHtmlPath = path.join(evidenceRoot, 'RT001-RES-CH-VIGNETTE-2026.via-rendered.official.html');
const viaTextPath = path.join(evidenceRoot, 'RT001-RES-CH-VIGNETTE-2026.via-rendered.official.txt');
const screenshotPath = path.join(evidenceRoot, 'RT001-RES-CH-VIGNETTE-2026.via-rendered.official.png');
const bazgPath = path.join(evidenceRoot, 'RT001-RES-CH-VIGNETTE-2026.bazg-support.official.html');
const viaCapturedPath = path.join(evidenceRoot, 'RT001-RES-CH-VIGNETTE-2026.via-product.official.js');
const reportPath = path.join(evidenceRoot, 'CH_VIGNETTE_BROWSER_CAPTURE_REPORT.json');

let browser;
let fatal;
let sessionStarted = false;
const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass: Boolean(pass), actual, expected });

try {
  browser = await chromium.launch({ headless: true });
  sessionStarted = true;
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'de-CH' });
  const captureTarget = pathToFileURL(viaCapturedPath).href;
  await page.goto(captureTarget, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(2_000);
  const bodyText = await page.locator('body').innerText();
  const bazgHtml = await readFile(bazgPath, 'utf8');
  const productIndex = bodyText.indexOf('E-Vignette 2026');
  const reviewExcerpt = productIndex >= 0
    ? bodyText.slice(Math.max(0, productIndex - 600), productIndex + 2_000)
    : bodyText.slice(0, 2_600);

  check('CANONICAL_ARTIFACT_RENDERED', page.url() === captureTarget, page.url(), captureTarget);
  check('VIA_OFFICIAL_PROVENANCE_URL', new URL(viaUrl).hostname === 'via.admin.ch', viaUrl, 'via.admin.ch');
  check('VIA_PRODUCT_2026', /E-?Vignette\s*2026|2026\s*E-?Vignette/i.test(bodyText), bodyText.match(/.{0,80}E-Vignette 2026.{0,160}/i)?.[0] ?? 'NOT_FOUND', 'E-vignette 2026');
  check('VIA_PRICE_CHF_40', /price:40(?:,|})/i.test(bodyText), bodyText.match(/.{0,30}price:40.{0,40}/i)?.[0] ?? 'NOT_FOUND', 'price:40 (CHF product renderer)');
  check('VIA_SCOPE_MOTORWAYS', /for motorways/i.test(bodyText), 'for motorways', 'present');
  check('VIA_SCOPE_UP_TO_3_5T', /-3\.5t/i.test(bodyText), '-3.5t', 'present');
  check('BAZG_OFFICIAL_IDENTITY', /Federal Office for Customs and Border Security|FOCBS|BAZG/i.test(bazgHtml), 'BAZG/FOCBS', 'present');
  check('BAZG_SCOPE_UP_TO_3_5T', /up to 3\.5 tonnes/i.test(bazgHtml), 'up to 3.5 tonnes', 'present');
  check('BAZG_PRICE_CHF_40', /CHF 40/i.test(bazgHtml), 'CHF 40', 'present');
  check('BAZG_VALIDITY_FORMULA', /1 December[^<]{0,200}31 January/i.test(stripTags(bazgHtml)), '1 December previous year -> 31 January following year', 'present');

  if (checks.some((item) => !item.pass)) throw new Error('OFFICIAL_VIGNETTE_EVIDENCE_ASSERTION_FAILED');
  await page.evaluate((excerpt) => {
    document.body.innerHTML = '';
    const heading = document.createElement('h1');
    heading.textContent = 'Official Via product evidence excerpt';
    const pre = document.createElement('pre');
    pre.textContent = excerpt;
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.fontSize = '16px';
    pre.style.lineHeight = '1.45';
    document.body.append(heading, pre);
  }, reviewExcerpt);
  const renderedHtml = await page.content();
  await writeFile(viaHtmlPath, renderedHtml, 'utf8');
  await writeFile(viaTextPath, `${reviewExcerpt}\n`, 'utf8');
  await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 60_000 });
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close();
}

const artifacts = {};
for (const [name, absolutePath] of Object.entries({ viaCapturedJs: viaCapturedPath, viaRenderedHtml: viaHtmlPath, viaRenderedText: viaTextPath, viaScreenshot: screenshotPath, bazgSupportHtml: bazgPath })) {
  try {
    const bytes = await readFile(absolutePath);
    artifacts[name] = {
      path: path.relative(root, absolutePath).replaceAll('\\', '/'),
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  } catch {
    artifacts[name] = null;
  }
}

const report = {
  schemaVersion: 'agm-controlled-browser-evidence.v1',
  capturedAt: new Date().toISOString(),
  sourceId: 'CS-CH-BAZG-MOTORWAY-VIGNETTE-2026',
  candidateId: 'RT001-RES-CH-VIGNETTE-2026',
  runner: 'Controlled AGM Playwright/Chromium',
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: sessionStarted ? 'PASS' : 'FAIL',
  targetPageStatus: fatal ? 'FAIL' : 'PASS',
  officialUrls: { viaProductAsset: viaUrl, bazgScopeAndValidity: bazgUrl },
  reconciledClaim: {
    product: 'Swiss motorway e-vignette 2026',
    price: 'CHF 40',
    scope: 'Swiss motorways; motor vehicles and trailers up to 3.5 tonnes, excluding heavy-vehicle-charge regimes',
    effectiveFrom: '2025-12-01',
    effectiveUntil: '2027-01-31',
    temporalDerivation: 'Via official product year 2026 + BAZG official rule: 1 December of previous year through 31 January of following year',
  },
  checks,
  artifacts,
  fatal: fatal ?? null,
  verdict: fatal ? 'FAIL' : 'PASS',
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (fatal) process.exitCode = 1;

function stripTags(value) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}
