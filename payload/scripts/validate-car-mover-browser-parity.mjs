import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'car-mover', 'browser-parity', runId);
const expected = {
  copy: 'Planifică, compară și asistă executarea mutării vehiculelor pe baza datelor reale AGM.',
  boundary: 'Decizia finală rămâne umană.',
  title: 'CAR MOVER',
  accent: 'DISPATCH AI',
  cta: 'Intră în Car Mover',
  modules: ['AGM Premium Copilot', 'Cameră OCR', 'Vorbește'],
  flow: 'HERO → MODULE → HUMAN DECIDE → JOB FILE',
};
const viewports = [
  { id: 'desktop', width: 1440, height: 1000 },
  { id: 'mobile', width: 390, height: 844 },
];
const report = {
  schemaVersion: 1,
  runId,
  runner: 'Controlled AGM Playwright/Chromium',
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: 'FAIL',
  targetPageStatus: 'FAIL',
  expected,
  results: [],
};

const freePort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.unref();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : null;
    server.close((error) => error ? reject(error) : resolve(port));
  });
});

const waitForTarget = async (target) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(target)).status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`TARGET_UNAVAILABLE:${target}`);
};

const mockApi = async (page) => {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    let data = {};
    if (url.pathname.endsWith('/auth/login') || url.pathname.endsWith('/auth/refresh')) {
      data = { accessToken:'browser-parity-token', user:{ id:'owner-review', displayName:'Owner Review', email:'owner@example.test', roles:['OWNER','PREMIUM_ACCESS'] } };
    } else if (url.pathname.endsWith('/auth/entitlements')) {
      data = { subjectId:'owner-review', tier:'premium', status:'active', capabilities:['premium.command-center','premium.voice-assistant','car-mover.jobs'], evaluatedAt:new Date().toISOString(), policyVersion:'access-entitlements@1.0.0' };
    }
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ data, requestId:'car-mover-browser-parity' }) });
  });
};

const openCarMover = async (page, target) => {
  await mockApi(page);
  await page.goto(`${target}/access`, { waitUntil:'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion:'privacy-v2026.07.13', termsVersion:'terms-v2026.07.13', acceptedAt:new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    localStorage.setItem('agm.premium.language', 'ro');
  });
  await page.reload({ waitUntil:'networkidle' });
  if (await page.locator('.legal-acceptance-overlay').count()) throw new Error('LEGAL_ACCEPTANCE_OVERLAY_NOT_DISMISSED');
  await page.locator('input[name=email]').fill('owner@example.test');
  await page.locator('input[name=password]').fill('visual-review-only');
  await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
  await page.evaluate(() => {
    history.pushState({}, '', '/car-mover');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForSelector('.car-mover-entry');
  await page.locator('.car-mover-entry-image').evaluate((image) => image.complete && image.naturalWidth > 0
    ? true
    : new Promise((resolve, reject) => {
      image.addEventListener('load', () => resolve(true), { once:true });
      image.addEventListener('error', () => reject(new Error('BACKGROUND_IMAGE_FAILED')), { once:true });
    }));
};

const inspect = async (page, viewport) => page.evaluate(({ expected, viewport }) => {
  const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? '';
  const entry = document.querySelector('.car-mover-entry');
  const panel = document.querySelector('.car-mover-entry-panel');
  const image = document.querySelector('.car-mover-entry-image');
  const title = document.querySelector('#car-mover-entry-title');
  const accent = title?.querySelector('span');
  const flow = document.querySelector('.car-mover-entry-flow');
  const moduleTexts = [...document.querySelectorAll('.car-mover-entry-controls a')].map((node) => node.textContent?.trim() ?? '');
  const panelStyle = getComputedStyle(panel);
  const flowStyle = getComputedStyle(flow);
  const documentElement = document.documentElement;
  const horizontalOverflow = documentElement.scrollWidth > documentElement.clientWidth + 1;
  const entryRect = entry.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const blocks = ['.car-mover-entry-copy', '.car-mover-entry-boundary', '.car-mover-entry-actions', '.car-mover-entry-flow']
    .map((selector) => ({ selector, rect:document.querySelector(selector).getBoundingClientRect() }));
  const spacingRegressions = blocks.slice(1).filter((block, index) => block.rect.top < blocks[index].rect.bottom - 1)
    .map((block) => block.selector);
  const backgroundIdentity = image.getAttribute('src') === '/images/car-mover-route-entry-bg-v4.png' && image.complete && image.naturalWidth > 0;
  const translucentCard = panelStyle.backgroundColor.includes('rgba') || panelStyle.backgroundImage.includes('rgba');
  const titleHierarchy = text('#car-mover-entry-title').includes(expected.title)
    && text('#car-mover-entry-title').includes(expected.accent)
    && getComputedStyle(accent).display === 'block';
  const flowRendered = text('.car-mover-entry-flow').toLocaleUpperCase('ro-RO') === expected.flow
    && flowStyle.textTransform === 'uppercase';
  const content = {
    copy:text('.car-mover-entry-copy p'),
    boundary:text('.car-mover-entry-boundary'),
    cta:text('.car-mover-entry-action'),
    modules:moduleTexts,
    flow:text('.car-mover-entry-flow').toLocaleUpperCase('ro-RO'),
  };
  const visual = {
    backgroundIdentity,
    translucentCard,
    titleHierarchy,
    flowRendered,
    horizontalOverflow,
    spacingRegressions,
    entryWithinDocument:entryRect.left >= -1 && entryRect.right <= documentElement.clientWidth + 1,
    panelWithinDocument:panelRect.left >= -1 && panelRect.right <= documentElement.clientWidth + 1,
  };
  const copyParity = content.copy === expected.copy
    && content.boundary === expected.boundary
    && content.cta === expected.cta
    && JSON.stringify(content.modules) === JSON.stringify(expected.modules)
    && content.flow === expected.flow;
  const visualParity = Object.entries(visual).every(([key, value]) => key === 'horizontalOverflow'
    ? value === false
    : key === 'spacingRegressions'
      ? value.length === 0
      : value === true);
  return {
    viewport,
    content,
    visual,
    copyParity,
    visualParity,
    scroll:{ scrollHeight:documentElement.scrollHeight, clientHeight:documentElement.clientHeight, maxScroll:Math.max(0, documentElement.scrollHeight - documentElement.clientHeight) },
  };
}, { expected, viewport });

const verifyReachability = async (page) => page.evaluate(async () => {
  const selectors = ['.car-mover-entry-action', '[data-module="premiumCopilot"]', '[data-module="ocr"]', '[data-module="premiumVoice"]', '.car-mover-entry-flow'];
  const checkpoints = [];
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    element.scrollIntoView({ block:'nearest' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = element.getBoundingClientRect();
    checkpoints.push({ selector, top:rect.top, bottom:rect.bottom, pass:rect.top >= -1 && rect.bottom <= window.innerHeight + 1 });
  }
  window.scrollTo({ top:document.documentElement.scrollHeight, behavior:'instant' });
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const flowRect = document.querySelector('.car-mover-entry-flow').getBoundingClientRect();
  return {
    checkpoints,
    finalScrollY:window.scrollY,
    flow:{ top:flowRect.top, bottom:flowRect.bottom, visible:flowRect.top >= -1 && flowRect.bottom <= window.innerHeight + 1 },
    pass:checkpoints.every((checkpoint) => checkpoint.pass) && flowRect.top >= -1 && flowRect.bottom <= window.innerHeight + 1,
  };
});

await mkdir(out, { recursive:true });
let browser;
let server;
try {
  const port = await freePort();
  const target = `http://127.0.0.1:${port}`;
  report.target = target;
  server = spawn(process.env.ComSpec || 'cmd.exe', ['/d','/s','/c',`node_modules\\.bin\\vite.cmd --host 127.0.0.1 --port ${port} --strictPort`], { cwd:path.join(root,'apps','web'), windowsHide:true, stdio:'ignore' });
  await waitForTarget(target);
  browser = await chromium.launch({ headless:true });
  report.browserSessionStatus = 'PASS';
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height }, locale:'ro-RO' });
    const page = await context.newPage();
    await openCarMover(page, target);
    const inspection = await inspect(page, viewport);
    const reachability = await verifyReachability(page);
    await page.evaluate(() => window.scrollTo({ top:0, behavior:'instant' }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    const screenshot = path.join(out, `car-mover-browser-${viewport.id}.png`);
    await page.screenshot({ path:screenshot, fullPage:true });
    const status = inspection.copyParity && inspection.visualParity && reachability.pass ? 'PASS' : 'FAIL';
    report.results.push({ id:viewport.id, status, screenshot:path.relative(root,screenshot), inspection, reachability });
    await context.close();
  }
  report.targetPageStatus = report.results.every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL';
  report.copyParity = report.results.every((result) => result.inspection.copyParity) ? 'PASS' : 'FAIL';
  report.androidWebVisualParity = report.results.every((result) => result.inspection.visualParity) ? 'PASS' : 'FAIL';
  report.scrollOverflow = report.results.every((result) => result.reachability.pass && !result.inspection.visual.horizontalOverflow) ? 'PASS' : 'FAIL';
  report.visualRegressionCount = report.results.reduce((count, result) => count
    + (result.inspection.visualParity ? 0 : 1)
    + (result.inspection.copyParity ? 0 : 1)
    + (result.reachability.pass ? 0 : 1), 0);
  report.status = report.targetPageStatus;
} catch (error) {
  report.status = 'FAIL';
  report.fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  report.finishedAt = new Date().toISOString();
  report.revision = spawnSync('git', ['rev-parse','HEAD'], { cwd:root, encoding:'utf8' }).stdout.trim();
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (browser) {
    await Promise.race([
      browser.close(),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  if (server?.pid) spawnSync('taskkill.exe', ['/pid',String(server.pid),'/T','/F'], { windowsHide:true, stdio:'ignore', timeout:3000 });
}

console.log(`CAR MOVER BROWSER PARITY: ${report.status}`);
console.log(path.join(out, 'report.json'));
if (report.status !== 'PASS') console.error(report.fatal ?? JSON.stringify(report.results, null, 2));
process.exit(report.status === 'PASS' ? 0 : 1);
