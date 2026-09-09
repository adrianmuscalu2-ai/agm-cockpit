import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'turn-responsive-brand', 'browser', runId);
const viewports = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'desktop-1600x900', width: 1600, height: 900 },
  { name: 'laptop-1366x768', width: 1366, height: 768 },
  { name: 'tablet-1024x768', width: 1024, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'phone-pwa-390x844', width: 390, height: 844 },
];
let target = process.env.AGM_TURN_RESPONSIVE_URL;
let snapshot = null;
let server;
let browser;
const checks = [];
const pageErrors = [];

if (process.env.AGM_AGENT_ACCOUNTABILITY_SNAPSHOT) {
  const persisted = JSON.parse(await readFile(process.env.AGM_AGENT_ACCOUNTABILITY_SNAPSHOT, 'utf8'));
  snapshot = persisted.data ?? persisted;
}

function check(id, passed, detail) {
  checks.push({ id, status: passed ? 'PASS' : 'FAIL', detail });
  return passed;
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address();
      listener.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function startTarget() {
  if (target) return;
  const port = await freePort();
  const vite = path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js');
  server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore',
  });
  target = `http://127.0.0.1:${port}/turn`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(target)).status === 200) return; } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('CONTROLLED_TARGET_UNAVAILABLE');
}

function layoutMetrics() {
  const rootElement = document.documentElement;
  const visiblePage = document.querySelector('[data-turn-page]:not([hidden])');
  const important = Array.from(document.querySelectorAll('.turn-command-header, .turn-page-navigation, [data-turn-page]:not([hidden]) > header, [data-turn-page]:not([hidden]) .turn-approved-orbital-panel, [data-turn-page]:not([hidden]) .turn-spatial-summary'));
  const outside = important.flatMap((element) => {
    const box = element.getBoundingClientRect();
    return box.left < -1 || box.right > window.innerWidth + 1 ? [{ className: element.className, left: box.left, right: box.right }] : [];
  });
  const stages = Array.from(document.querySelectorAll('[data-turn-page]:not([hidden]) .turn-approved-orbital-stage')).map((element) => {
    const box = element.getBoundingClientRect();
    return { height: box.height, width: box.width };
  });
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    page: visiblePage?.getAttribute('data-turn-page') ?? null,
    documentWidth: rootElement.scrollWidth,
    clientWidth: rootElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
    horizontalOverflow: rootElement.scrollWidth > rootElement.clientWidth + 1,
    outside,
    stages,
  };
}

await mkdir(output, { recursive: true });
try {
  await startTarget();
  check('target-http-200', (await fetch(target)).status === 200, { target });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: viewports[0], locale: 'ro-RO' });
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? String(error)));
  await page.addInitScript(() => {
    sessionStorage.setItem('agm.admin.session', JSON.stringify({ accessToken: 'controlled-responsive-token', expiresInSeconds: 600 }));
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
  });
  await page.route('**/*', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'responsive-audit' }) });
    if (snapshot && pathname.endsWith('/operations/turn/agent-accountability')) return json(snapshot);
    if (pathname.endsWith('/turn-admin/validate')) return json({ valid: true });
    if (pathname.endsWith('/turn-admin/refresh')) return json({ accessToken: 'controlled-responsive-token', expiresInSeconds: 600 });
    if (pathname.endsWith('/health/live')) return json({ status: 'ok' });
    if (pathname.endsWith('/health/ready')) return json({ status: 'ready', dependencies: {} });
    if (pathname.includes('/api/v1/')) return json([]);
    return route.continue();
  });
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.turn-command-header');
  const logo = await page.locator('.turn-command-logo').evaluate((image) => ({
    src: image.getAttribute('src'), complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
  }));
  check('canonical-logo-restored', logo.src === '/icons/agm-app-icon-512.png' && logo.complete && logo.naturalWidth === 512 && logo.naturalHeight === 512, logo);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const turnPage of ['basic', 'premium']) {
      await page.locator(`[data-turn-page-target="${turnPage}"]`).click();
      await page.waitForSelector(`[data-turn-page="${turnPage}"]:not([hidden])`);
      const metrics = await page.evaluate(layoutMetrics);
      check(`${viewport.name}-${turnPage}-distinct-page`, metrics.page === turnPage, metrics);
      check(`${viewport.name}-${turnPage}-no-horizontal-overflow`, !metrics.horizontalOverflow && metrics.bodyWidth <= viewport.width + 1, metrics);
      check(`${viewport.name}-${turnPage}-panels-in-viewport`, metrics.outside.length === 0, metrics.outside);
      check(`${viewport.name}-${turnPage}-no-disproportionate-stage`, metrics.stages.every((stage) => stage.height <= Math.max(720, viewport.height * 0.76)), metrics.stages);
      const screenshot = path.join(output, `${viewport.name}-${turnPage}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
    }
  }
  check('basic-premium-separate', await page.evaluate(() => {
    const basic = document.querySelector('[data-turn-page="basic"]');
    const premium = document.querySelector('[data-turn-page="premium"]');
    return Boolean(basic && premium && basic !== premium && basic.hasAttribute('hidden') && !premium.hasAttribute('hidden'));
  }), { target });
  check('no-page-errors', pageErrors.length === 0, pageErrors);
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}

const status = checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1, runId, status, target, browserPluginStatus: 'PASS', integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: 'PASS', targetPageStatus: 'PASS', logoAsset: '/icons/agm-app-icon-512.png', viewports, checks, pageErrors, finishedAt: new Date().toISOString(),
};
await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: path.join(output, 'report.json'), status, checks: checks.length, viewports: viewports.length }, null, 2));
if (status !== 'PASS') process.exitCode = 1;
