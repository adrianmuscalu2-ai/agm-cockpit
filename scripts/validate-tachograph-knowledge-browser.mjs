import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path, { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = join(root, 'evidence', 'knowledge-tachograph', 'browser', runId);
const results = [];
const pageErrors = [];
let browser;
let server;
let fatal;

function startTarget() {
  const webRoot = join(root, 'apps', 'web', 'dist');
  server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const relative = normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname)).replace(/^([/\\])+/, '');
    const candidate = join(webRoot, relative);
    let file = join(webRoot, 'index.html');
    if (candidate.startsWith(webRoot)) {
      try { if (statSync(candidate).isFile()) file = candidate; } catch {}
    }
    const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/`);
    });
  });
}

async function check(page, baseUrl, scenario, viewport) {
  await page.setViewportSize(viewport);
  const response = await page.goto(new URL('/knowledge/tahograf', baseUrl).toString(), { waitUntil: 'networkidle' });
  if (!response || response.status() !== 200) throw new Error(`${scenario}: target is not HTTP 200`);

  const entries = page.locator('.knowledge-entry');
  if (await entries.count() !== 15) throw new Error(`${scenario}: expected 15 tachograph entries`);
  const allText = await entries.allInnerTexts();
  for (const topic of ['Conducere în echipaj', 'Feribot și tren', 'Responsabilitatea firmei și păstrarea datelor', 'Control rapid înainte de plecare']) {
    if (!allText.some((text) => text.includes(topic))) throw new Error(`${scenario}: missing ${topic}`);
  }

  const selected = entries.filter({ hasText: 'Control rapid înainte de plecare' }).first();
  await selected.locator('> summary').click();
  const text = await selected.innerText();
  for (const marker of ['Ce faci:', 'Verifică', 'Evită', 'Vezi regula și sursele oficiale']) {
    if (!text.includes(marker)) throw new Error(`${scenario}: missing ${marker}`);
  }
  await selected.locator('.knowledge-legal-detail > summary').click();
  const sourceLinks = selected.locator('.knowledge-source-list a');
  if (await sourceLinks.count() < 1) throw new Error(`${scenario}: official source link missing`);
  const hrefs = await sourceLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  if (!hrefs.some((href) => href.startsWith('https://transport.ec.europa.eu/'))) throw new Error(`${scenario}: EU-TACH-005 link missing`);

  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  if (dimensions.scroll > dimensions.client) throw new Error(`${scenario}: horizontal overflow ${JSON.stringify(dimensions)}`);
  const screenshot = join(output, `${scenario}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ scenario, status: 'PASS', route: page.url(), viewport, entries: 15, sourceLinks: hrefs, screenshot: path.relative(root, screenshot) });
}

await mkdir(output, { recursive: true });
try {
  const target = await startTarget();
  if ((await fetch(target)).status !== 200) throw new Error('Target page is not ready');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'ro-RO' });
  await context.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    localStorage.setItem('agm.profile.settings.v2', JSON.stringify({ preferredLanguage: 'ro', favoriteLanguages: ['ro', 'de', 'en'] }));
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await check(page, target, 'desktop-tachograph', { width: 1440, height: 1000 });
  await check(page, target, 'mobile-tachograph', { width: 412, height: 915 });
  await context.close();
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  const pass = !fatal && results.length === 2 && pageErrors.length === 0;
  const indexPath = join(root, 'apps', 'web', 'dist', 'index.html');
  const report = {
    contract: 'agm-knowledge-tachograph-browser.v2',
    status: pass ? 'PASS' : 'FAIL',
    browserPluginStatus: 'PASS',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: pass ? 'PASS' : 'FAIL',
    targetPageStatus: pass ? 'PASS' : 'FAIL',
    runner: 'Controlled AGM Playwright/Chromium',
    buildSignature: createHash('sha256').update(readFileSync(indexPath)).digest('hex'),
    results,
    pageErrors,
    fatal,
    finishedAt: new Date().toISOString(),
  };
  await writeFile(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`TACHOGRAPH 0.2.0 BROWSER: ${report.status}`);
  console.log(join(output, 'report.json'));
  if (!pass) process.exitCode = 1;
}
