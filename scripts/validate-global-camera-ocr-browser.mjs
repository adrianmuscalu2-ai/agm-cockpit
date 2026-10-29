import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const webRequire = createRequire(path.join(root, 'apps', 'web', 'package.json'));
const { createServer: createViteServer } = await import(pathToFileURL(webRequire.resolve('vite')).href);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'global-camera-ocr', 'browser', runId);
const routes = [
  '/home', '/basic', '/ocr', '/access', '/premium', '/premium/copilot', '/premium/team',
  '/premium/ladungssicherung', '/premium/communications', '/premium/voice', '/car-mover',
  '/car-mover/menu', '/car-mover/planning', '/car-mover/active-transfer', '/car-mover/completion-incidents',
  '/car-mover/accounting', '/car-mover/guide', '/car-mover/archive', '/translator', '/email', '/profile',
  '/corrector', '/turn', '/legal', '/about', '/roadmap', '/licenses',
];
const report = {
  schemaVersion: 2,
  runId,
  runner: 'Controlled AGM Playwright/Chromium',
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: 'FAIL',
  targetPageStatus: 'FAIL',
  routeCoverage: [],
  results: [],
  diagnostics: [],
};
let server;
let browser;

await mkdir(output, { recursive: true });
try {
  const port = await freePort();
  const target = `http://127.0.0.1:${port}`;
  server = await createViteServer({ root: path.join(root, 'apps', 'web'), server: { host: '127.0.0.1', port, strictPort: true }, logLevel: 'silent' });
  await server.listen();
  await httpReady(target);
  browser = await chromium.launch({ headless: true });
  report.browserSessionStatus = 'PASS';
  report.target = target;
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'ro-RO', serviceWorkers: 'block' });
  await context.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({
      privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString(),
    }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
  });
  const fixturePage = await context.newPage();
  await fixturePage.setViewportSize({ width: 1400, height: 900 });
  await fixturePage.setContent('<style>body{margin:0;background:white;color:black;font-family:Arial}main{padding:90px;border:18px solid #111}h1{font-size:86px;margin:0 0 55px}p{font-size:64px;line-height:1.35;margin:24px 0}</style><main><h1>AGM DOCUMENT</h1><p>CMR 12345</p><p>TRANSPORT TEST</p></main>');
  const fixture = path.join(output, 'document-fixture.png');
  await fixturePage.screenshot({ path: fixture });
  await fixturePage.close();

  const page = await context.newPage();
  page.on('pageerror', (error) => report.diagnostics.push({ type: 'pageerror', message: error.message }));
  page.on('console', (message) => { if (message.type() === 'error') report.diagnostics.push({ type: 'console-error', message: message.text() }); });
  page.on('requestfailed', (request) => report.diagnostics.push({ type: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));

  for (const route of routes) {
    await page.goto(`${target}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const originalPath = new URL(page.url()).pathname;
    await page.locator('[data-global-action=ocr]').waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('[data-global-action=ocr]').click();
    await page.locator('.global-ocr-dialog').waitFor({ state: 'visible', timeout: 30_000 });
    if (new URL(page.url()).pathname !== originalPath) throw new Error(`${route}: OCR navigated away from origin`);
    await page.locator('#globalOcrDone').click();
    await page.locator('.global-ocr-dialog').waitFor({ state: 'detached' });
    report.routeCoverage.push({ route, status: 'PASS', routePreserved: true });
  }

  for (const scenario of [
    { id: 'basic-context', route: '/basic', selector: '#globalOcrContextText' },
    { id: 'translator-context', route: '/translator', selector: '#translatorText' },
    { id: 'email-context', route: '/email', selector: '#message' },
  ]) {
    await page.goto(`${target}${scenario.route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const originalPath = new URL(page.url()).pathname;
    await page.locator('[data-global-action=ocr]').click();
    await page.locator('.global-ocr-dialog').waitFor({ state: 'visible' });
    await page.locator('#globalOcrFileInput').setInputFiles(fixture);
    await page.locator('#globalOcrDialogText').waitFor({ state: 'visible', timeout: 120_000 });
    const text = (await page.locator('#globalOcrDialogText').inputValue()).trim();
    if (!/AGM|DOCUMENT|CMR/i.test(text)) throw new Error(`${scenario.id}: real OCR result missing expected text: ${text}`);
    await page.locator('#globalOcrDone').click();
    await page.locator('.global-ocr-dialog').waitFor({ state: 'detached' });
    if (new URL(page.url()).pathname !== originalPath) throw new Error(`${scenario.id}: close did not preserve origin`);
    const contextual = (await page.locator(scenario.selector).inputValue()).trim();
    if (!contextual.includes(text)) throw new Error(`${scenario.id}: OCR result was not returned to the origin field`);
    const screenshot = path.join(output, `${scenario.id}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    report.results.push({ ...scenario, status: 'PASS', ocrText: text, screenshot: path.relative(root, screenshot) });
  }
  if (report.diagnostics.some((item) => item.type === 'pageerror')) throw new Error('Relevant Browser pageerror detected');
  report.targetPageStatus = 'PASS';
  report.status = 'PASS';
  await context.close();
} catch (error) {
  report.status = 'FAIL';
  report.fatal = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  await browser?.close();
  await server?.close();
  report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`GLOBAL CAMERA/OCR BROWSER: ${report.status}`);
console.log(path.join(output, 'report.json'));
if (report.status !== 'PASS') { console.error(report.fatal); process.exitCode = 1; }

async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function httpReady(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(url)).status === 200) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Target did not become HTTP 200: ${url}`);
}
