import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION';
const artifactRelative = `${outputRelative}/REMOTE_ARTIFACTS`;
const evidenceRelative = `${outputRelative}/BROWSER_OFFICIAL_CAPTURE_ATTEMPTS`;
const artifactDir = path.join(root, artifactRelative);
const evidenceDir = path.join(root, evidenceRelative);
await mkdir(artifactDir, { recursive: true });
await mkdir(evidenceDir, { recursive: true });

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const timestamp = new Date().toISOString();
const results = [];
let browser;

const recordFile = async (artifactId, filePath, method, sourceUrl, scope, effectiveDate, provenance) => {
  const bytes = await readFile(filePath);
  const info = await stat(filePath);
  return {
    artifactId,
    status: 'RESOLVED_OFFICIAL_BROWSER_CAPTURE',
    method,
    sourceUrl,
    artifactPath: path.relative(root, filePath).replaceAll('\\', '/'),
    mediaType: 'application/pdf',
    sizeBytes: info.size,
    sha256: sha256(bytes),
    provenance,
    scope,
    effectiveDate,
    capturedAt: timestamp,
  };
};

const captureOfficialPagePrint = async (page, item) => {
  const response = await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(5_000);
  const body = await page.locator('body').innerText({ timeout: 20_000 });
  const missing = item.requiredMarkers.filter((marker) => !body.toLocaleLowerCase('fr').includes(marker.toLocaleLowerCase('fr')));
  const screenshotPath = path.join(evidenceDir, `${item.artifactId}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  if (!response?.ok()) throw new Error(`OFFICIAL_PAGE_HTTP_${response?.status() ?? 'UNKNOWN'}`);
  if (missing.length) throw new Error(`OFFICIAL_PAGE_INCOMPLETE_MISSING_${missing.join('|')}`);
  const target = path.join(artifactDir, `${item.artifactId}.official-page-print.pdf`);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: target, format: 'A4', printBackground: true, margin: { top: '10mm', right: '8mm', bottom: '10mm', left: '8mm' } });
  return recordFile(item.artifactId, target, 'CONTROLLED_PLAYWRIGHT_PRINT_TO_PDF_FROM_OFFICIAL_PAGE', page.url(), item.scope, item.effectiveDate, item.provenance);
};

const captureOfficialPdf = async (context, page, item) => {
  await page.goto(item.landingUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(4_000);
  const response = await context.request.get(item.pdfUrl, {
    headers: {
      accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.5',
      referer: page.url(),
    },
    timeout: 90_000,
  });
  const screenshotPath = path.join(evidenceDir, `${item.artifactId}.landing.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  if (!response.ok()) throw new Error(`OFFICIAL_PDF_HTTP_${response.status()}`);
  const bytes = await response.body();
  if (bytes.length < 10_000 || bytes.subarray(0, 4).toString('ascii') !== '%PDF') throw new Error(`OFFICIAL_PDF_INVALID_${bytes.length}`);
  const target = path.join(artifactDir, `${item.artifactId}.official-browser.pdf`);
  await writeFile(target, bytes);
  return recordFile(item.artifactId, target, 'CONTROLLED_PLAYWRIGHT_OFFICIAL_PDF_DOWNLOAD', item.pdfUrl, item.scope, item.effectiveDate, item.provenance);
};

const pagePrintItems = [
  {
    artifactId: 'RT001-FINAL-FR-ORDER-12-2026',
    url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053417592',
    requiredMarkers: ['Arrêté du 28 janvier 2026', 'ANNEXE XII', 'A79', '1er février 2026'],
    scope: "ATMB, SFTRF, CEVM, ALIS, ARCOUR, ADELAC, A'LIENOR, ALICORNE, ATLANDES, ALBEA, ARCOS and ALIAE tariff annexes",
    effectiveDate: '2026-02-01',
    provenance: 'Legifrance / Journal officiel de la Republique francaise; official page print, not reconstructed content',
  },
  {
    artifactId: 'RT001-FINAL-FR-CCISE-ORDER-2026',
    url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053916305',
    requiredMarkers: ['Arrêté du 30 mars 2026', 'Pont de Normandie', 'Pont de Tancarville', '1er mai 2026'],
    scope: 'CCISE Pont de Normandie and Pont de Tancarville vehicle classes 1-4',
    effectiveDate: '2026-05-01',
    provenance: 'Legifrance / Journal officiel de la Republique francaise; official page print, not reconstructed content',
  },
  {
    artifactId: 'RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026',
    url: 'https://www.liefkenshoektunnel.be/nl/algemene-voorwaarden-tunnel-liefkenshoek-nv',
    requiredMarkers: ['Liefkenshoektunnel', '2026', 'tarief'],
    scope: 'Liefkenshoek Tunnel official 2026 categories, tariffs and conditions',
    effectiveDate: '2026',
    provenance: 'Tunnel Liefkenshoek NV official page print; no third-party cache, OCR or reconstruction',
  },
];

const pdfItems = [
  {
    artifactId: 'RT001-FINAL-FR-SANEF-2026',
    landingUrl: 'https://www.groupe.sanef.com/en/my-journey/price-of-my-journey',
    pdfUrl: 'https://www.groupe.sanef.com/sites/default/files/2026-01/2026_02-Grille-Sanef.pdf',
    scope: 'Sanef route and vehicle-class tariff grid', effectiveDate: '2026-02-01', provenance: 'Sanef official operator publication',
  },
  {
    artifactId: 'RT001-FINAL-FR-SAPN-2026',
    landingUrl: 'https://www.groupe.sanef.com/en/my-journey/price-of-my-journey',
    pdfUrl: 'https://www.groupe.sanef.com/sites/default/files/2026-01/2026_02-Grille-SAPN.pdf',
    scope: 'SAPN Paris-Normandie route and vehicle-class tariff grid', effectiveDate: '2026-02-01', provenance: 'SAPN / Sanef official operator publication',
  },
];

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  });
  for (const item of pagePrintItems) {
    const page = await context.newPage();
    try {
      results.push(await captureOfficialPagePrint(page, item));
    } catch (error) {
      results.push({ artifactId: item.artifactId, status: 'STILL_BLOCKED', method: 'CONTROLLED_PLAYWRIGHT_OFFICIAL_PAGE_PRINT_ATTEMPT', sourceUrl: item.url, error: String(error), artifactPath: null, sha256: null, provenance: item.provenance, scope: item.scope, effectiveDate: item.effectiveDate, capturedAt: timestamp });
    } finally {
      await page.close();
    }
  }
  for (const item of pdfItems) {
    const page = await context.newPage();
    try {
      results.push(await captureOfficialPdf(context, page, item));
    } catch (error) {
      results.push({ artifactId: item.artifactId, status: 'STILL_BLOCKED', method: 'CONTROLLED_PLAYWRIGHT_OFFICIAL_PDF_ATTEMPT', sourceUrl: item.pdfUrl, error: String(error), artifactPath: null, sha256: null, provenance: item.provenance, scope: item.scope, effectiveDate: item.effectiveDate, capturedAt: timestamp });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
}

const report = {
  schemaVersion: 'agm-routing-toll-001-browser-official-capture.v1',
  generatedAt: timestamp,
  runner: 'Controlled AGM Playwright/Chromium',
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: 'PASS',
  targetPageStatus: results.every((item) => item.status === 'RESOLVED_OFFICIAL_BROWSER_CAPTURE') ? 'PASS' : 'PARTIAL',
  results,
  summary: {
    attempted: results.length,
    resolved: results.filter((item) => item.status === 'RESOLVED_OFFICIAL_BROWSER_CAPTURE').length,
    blocked: results.filter((item) => item.status === 'STILL_BLOCKED').length,
  },
  registryMutation: 'NONE',
  viewMutation: 'NONE',
  authorityPromotion: 'NONE',
};
await writeFile(path.join(root, outputRelative, 'BROWSER_OFFICIAL_CAPTURE_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report.summary, null, 2));
