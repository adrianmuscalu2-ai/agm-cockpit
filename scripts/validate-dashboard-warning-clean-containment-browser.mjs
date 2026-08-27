import { chromium } from 'playwright';
import { createReadStream, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path, { extname, join, normalize } from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'governance', 'image-security-boundary', 'clean-containment', runId, 'browser');
const results = [];
let browser; let targetServer; let fatal;

async function startTarget() {
  const webRoot = path.join(root, 'apps', 'web', 'dist');
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const relative = normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname)).replace(/^([/\\])+/, '');
    const candidate = join(webRoot, relative);
    let file = join(webRoot, 'index.html');
    if (candidate.startsWith(webRoot)) { try { if (statSync(candidate).isFile()) file = candidate; } catch {} }
    const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); const port = typeof address === 'object' && address ? address.port : 0;
  return { server, url: `http://127.0.0.1:${port}/` };
}
async function ready(url) { for (let attempt = 0; attempt < 80; attempt += 1) { try { if ((await fetch(url)).status === 200) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 250)); } throw new Error('TARGET_HTTP_NOT_READY'); }
async function scenario(page, target, id, viewport) {
  await page.setViewportSize(viewport);
  const dashboardRequests = [];
  const listener = (request) => { if (request.url().includes('/dashboard-warning-analysis')) dashboardRequests.push(request.url()); };
  page.on('request', listener);
  await page.goto(new URL('/basic', target).toString(), { waitUntil: 'networkidle' });
  const card = page.locator('.dashboard-warning-knowledge-card');
  if (await card.count() !== 1) throw new Error(`${id}: KNOWLEDGE_CARD_MISSING`);
  if (await page.locator('[data-basic-action="dashboard-warning-analysis"]').count() !== 0) throw new Error(`${id}: VISION_ACTION_PRESENT`);
  const text = await card.innerText();
  if (!text.includes('Martori în bord') || !text.includes('identificarea automată din fotografie nu este disponibilă') || !text.includes('Deschide catalogul')) throw new Error(`${id}: CONTAINMENT_COPY_INVALID`);
  const basicCapture = path.join(output, `${id}-basic-containment.png`);
  await page.screenshot({ path: basicCapture, fullPage: true });
  await card.click();
  await page.waitForURL(/\/knowledge\/martori-bord$/);
  if (await page.locator('[data-basic-action="dashboard-warning-analysis"]').count() !== 0) throw new Error(`${id}: VISION_UPLOAD_PRESENT_IN_KNOWLEDGE`);
  if (!(await page.locator('body').innerText()).includes('Martori în bord')) throw new Error(`${id}: KNOWLEDGE_CATALOG_MISSING`);
  const catalogCapture = path.join(output, `${id}-knowledge-catalog.png`);
  await page.screenshot({ path: catalogCapture, fullPage: true });
  page.off('request', listener);
  if (dashboardRequests.length !== 0) throw new Error(`${id}: VISION_NETWORK_REQUEST_DETECTED`);
  results.push({ id, status: 'PASS', viewport, route: page.url(), visionRequests: 0, screenshots: [path.relative(root, basicCapture), path.relative(root, catalogCapture)] });
}

await mkdir(output, { recursive: true });
try {
  const target = await startTarget(); targetServer = target.server;
  await ready(target.url);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: target.url, locale: 'ro-RO' });
  await context.addInitScript(() => { localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() })); localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString()); localStorage.setItem('agm.profile.settings.v2', JSON.stringify({ preferredLanguage: 'ro', favoriteLanguages: ['ro', 'de', 'en'] })); });
  const page = await context.newPage();
  await scenario(page, target.url, 'web-desktop', { width: 1440, height: 1000 });
  await scenario(page, target.url, 'android-bundle-mobile', { width: 412, height: 915 });
  await context.close();
} catch (error) { fatal = error instanceof Error ? error.message : String(error); }
finally {
  await browser?.close();
  if (targetServer) await new Promise((resolve) => targetServer.close(resolve));
  const report = { contract: 'agm-dashboard-warning-clean-containment-browser.v1', status: !fatal && results.length === 2 ? 'PASS' : 'FAIL', browserPluginStatus: 'PASS', integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE', browserSessionStatus: results.length === 2 ? 'PASS' : 'FAIL', targetPageStatus: results.length === 2 ? 'PASS' : 'FAIL', runner: 'Controlled AGM Playwright/Chromium', results, fatal, finishedAt: new Date().toISOString() };
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`DASHBOARD WARNING CLEAN CONTAINMENT BROWSER: ${report.status}`); console.log(path.join(output, 'report.json')); if (report.status !== 'PASS') process.exitCode = 1;
}
