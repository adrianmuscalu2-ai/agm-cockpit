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
const out = path.join(root, 'evidence', 'car-mover', 'browser-parity', runId);
const expected = {
  copy: 'Planifică, compară și asistă executarea mutării vehiculelor pe baza datelor reale AGM.',
  boundary: 'Decizia finală rămâne umană.',
  cta: 'Intră în Car Mover',
  modules: ['AGM Premium Copilot', 'Cameră OCR', 'Vorbește'],
  flow: 'HERO → MODULE → HUMAN DECIDE → JOB FILE',
};
const report = {
  schemaVersion: 2,
  runId,
  runner: 'Controlled AGM Playwright/Chromium',
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: 'FAIL',
  targetPageStatus: 'FAIL',
  expected,
  results: [],
  diagnostics: [],
};
let server;
let browser;

await mkdir(out, { recursive: true });
try {
  const port = await freePort();
  const target = `http://127.0.0.1:${port}`;
  server = await createViteServer({
    root: path.join(root, 'apps', 'web'),
    server: { host: '127.0.0.1', port, strictPort: true },
    logLevel: 'silent',
  });
  await server.listen();
  await httpReady(target);
  browser = await chromium.launch({ headless: true });
  report.browserSessionStatus = 'PASS';
  report.target = target;

  for (const viewport of [{ id: 'desktop', width: 1440, height: 1000 }, { id: 'mobile', width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: 'ro-RO', serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({
        privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString(),
      }));
      localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
      localStorage.setItem('agm.premium.language', 'ro');
    });
    await mockApi(page);
    await page.goto(`${target}/access`, { waitUntil: 'networkidle' });
    await page.locator('input[name=email]').fill('owner@example.test');
    await page.locator('input[name=password]').fill('visual-review-only');
    await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
    await page.evaluate(() => { history.pushState({}, '', '/car-mover'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.locator('.car-mover-entry').waitFor({ state: 'visible' });
    const inspection = await page.evaluate((contract) => {
      const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? '';
      const panel = document.querySelector('.car-mover-entry-panel');
      const title = document.querySelector('#car-mover-entry-title');
      const accent = title?.querySelector('span');
      const image = document.querySelector('.car-mover-entry-image');
      const blocks = ['.car-mover-entry-copy', '.car-mover-entry-boundary', '.car-mover-entry-actions', '.car-mover-entry-flow']
        .map((selector) => ({ selector, rect: document.querySelector(selector)?.getBoundingClientRect() }));
      const overlaps = blocks.slice(1).filter((block, index) => block.rect && blocks[index].rect && block.rect.top < blocks[index].rect.bottom - 1).map((block) => block.selector);
      const modules = [...document.querySelectorAll('.car-mover-entry-controls a')].map((node) => node.textContent?.trim() ?? '');
      return {
        copy: text('.car-mover-entry-copy p'),
        boundary: text('.car-mover-entry-boundary'),
        cta: text('.car-mover-entry-action'),
        modules,
        flow: text('.car-mover-entry-flow').toLocaleUpperCase('ro-RO'),
        title: text('#car-mover-entry-title'),
        accentIsBlock: accent ? getComputedStyle(accent).display === 'block' : false,
        image: image?.getAttribute('src'),
        imageReady: Boolean(image?.complete && image?.naturalWidth),
        translucentCard: getComputedStyle(panel).backgroundColor.includes('rgba'),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        overlaps,
        copyPass: text('.car-mover-entry-copy p') === contract.copy
          && text('.car-mover-entry-boundary') === contract.boundary
          && text('.car-mover-entry-action') === contract.cta
          && JSON.stringify(modules) === JSON.stringify(contract.modules)
          && text('.car-mover-entry-flow').toLocaleUpperCase('ro-RO') === contract.flow,
      };
    }, expected);
    const visualPass = inspection.title.includes('CAR MOVER') && inspection.title.includes('DISPATCH AI')
      && inspection.accentIsBlock && inspection.image === '/images/car-mover-route-entry-bg-v4.png'
      && inspection.imageReady && inspection.translucentCard && !inspection.horizontalOverflow && inspection.overlaps.length === 0;
    const status = inspection.copyPass && visualPass && errors.length === 0 ? 'PASS' : 'FAIL';
    const screenshot = path.join(out, `${viewport.id}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    report.results.push({ id: viewport.id, status, viewport, inspection, visualPass, pageErrors: errors, screenshot: path.relative(root, screenshot) });
    report.diagnostics.push(...errors.map((message) => ({ viewport: viewport.id, message })));
    await context.close();
  }
  report.targetPageStatus = report.results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
  report.status = report.targetPageStatus;
} catch (error) {
  report.status = 'FAIL';
  report.fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await browser?.close();
  await server?.close();
  report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`CAR MOVER BROWSER PARITY: ${report.status}`);
console.log(path.join(out, 'report.json'));
if (report.status !== 'PASS') { console.error(report.fatal ?? JSON.stringify(report.results, null, 2)); process.exitCode = 1; }

async function mockApi(page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    let data = {};
    if (url.pathname.endsWith('/auth/login') || url.pathname.endsWith('/auth/refresh')) {
      data = { accessToken: 'browser-parity-token', user: { id: 'owner-review', displayName: 'Owner Review', email: 'owner@example.test', roles: ['OWNER', 'PREMIUM_ACCESS'] } };
    } else if (url.pathname.endsWith('/auth/entitlements')) {
      data = { subjectId: 'owner-review', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant', 'car-mover.jobs'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'car-mover-browser-parity' }) });
  });
}

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
