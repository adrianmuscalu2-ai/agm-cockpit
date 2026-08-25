import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const target = new URL(process.env.AGM_BROWSER_LOCAL_URL || 'http://127.0.0.1:5174/');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'ui-glass-backgrounds', runId);
const routes = [
  { route: '/basic', panel: '.basic-tool-card', asset: 'agm-basic-hero-v1.png', scene: 'basic' },
  { route: '/translator', panel: '.translator-hud .cockpit-input', asset: 'agm-cockpit-road-v3-mentor.png', scene: 'shell' },
  { route: '/email', panel: '.mail-composer .module-section', asset: 'agm-functions-ecosystem-v2.png', scene: 'shell' },
  { route: '/corrector', panel: '.text-corrector-module .composer', asset: 'agm-functions-ecosystem-v2.png', scene: 'shell' },
  { route: '/ocr', panel: '.ocr-page .cockpit-input', asset: 'agm-basic-hero-v1.png', scene: 'shell' },
  { route: '/profile', panel: '.profile-panel', asset: 'agm-cockpit-road-v3-mentor.png', scene: 'shell' },
  { route: '/premium', panel: '.premium-module', asset: 'agm-premium-hero-v3.png', scene: 'premium' },
];
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 412, height: 915 },
];

const report = {
  schemaVersion: 1,
  runId,
  startedAt: new Date().toISOString(),
  revision: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
  runner: 'Controlled AGM Playwright/Chromium',
  target: target.toString(),
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: 'FAIL',
  targetPageStatus: 'FAIL',
  results: [],
  assetFailures: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function dismissTransientUi(page) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const control = page.locator('#acceptLegalNotice:visible, #skipRoadmapInvitation:visible, #closeTutorial:visible, [data-command="tutorial-close"]:visible').first();
    if (!(await control.count())) break;
    await control.click();
    await page.waitForTimeout(80);
  }
}

await mkdir(output, { recursive: true });
let browser;
try {
  const response = await fetch(target);
  assert(response.status === 200, `Target HTTP status ${response.status}`);
  browser = await chromium.launch({ headless: true });
  report.chromiumVersion = browser.version();
  report.browserSessionStatus = 'PASS';
  const context = await browser.newContext({ locale: 'ro-RO' });
  const page = await context.newPage();
  page.on('requestfailed', (request) => {
    if (request.url().includes('/images/atmosphere/')) report.assetFailures.push({ url: request.url(), reason: request.failure()?.errorText || 'unknown' });
  });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const spec of routes) {
      const startedAt = new Date().toISOString();
      await page.goto(new URL(spec.route, target).toString(), { waitUntil: 'networkidle' });
      await dismissTransientUi(page);
      await page.locator('.shell').waitFor({ state: 'visible' });
      await page.locator(spec.panel).first().waitFor({ state: 'visible' });
      const metrics = await page.evaluate(({ panelSelector, scene }) => {
        const shell = document.querySelector('.shell');
        const panel = document.querySelector(panelSelector);
        const top = document.querySelector('.topbar,.premium-topbar');
        let sceneStyle = getComputedStyle(shell);
        if (scene === 'basic') sceneStyle = getComputedStyle(document.querySelector('.basic-hub'), '::before');
        if (scene === 'premium') sceneStyle = getComputedStyle(document.querySelector('.premium-access-view'), '::before');
        const panelStyle = getComputedStyle(panel);
        const panelRect = panel.getBoundingClientRect();
        return {
          sceneImage: sceneStyle.backgroundImage,
          panelBackground: panelStyle.backgroundColor,
          panelBackdrop: panelStyle.backdropFilter || panelStyle.webkitBackdropFilter,
          topBackground: top ? getComputedStyle(top).backgroundColor : null,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          panelWithinViewport: panelRect.left >= 0 && panelRect.right <= innerWidth + 1,
        };
      }, { panelSelector: spec.panel, scene: spec.scene });
      assert(metrics.sceneImage.includes(spec.asset), `${spec.route} missing canonical scene ${spec.asset}`);
      assert(metrics.panelBackground === 'rgba(2, 12, 28, 0.22)', `${spec.route} panel background ${metrics.panelBackground}`);
      assert(metrics.panelBackdrop.includes('blur(9px)'), `${spec.route} panel backdrop ${metrics.panelBackdrop}`);
      assert(metrics.overflowX === 0, `${spec.route} horizontal overflow ${metrics.overflowX}px`);
      assert(metrics.panelWithinViewport, `${spec.route} panel outside ${viewport.name} viewport`);
      const screenshot = path.join(output, `${viewport.name}-${spec.route.slice(1)}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      report.results.push({
        id: `${viewport.name}:${spec.route}`,
        status: 'PASS',
        viewport,
        metrics,
        screenshot: path.relative(root, screenshot),
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    }
  }

  assert(report.assetFailures.length === 0, `Canonical asset failures: ${JSON.stringify(report.assetFailures)}`);
  report.targetPageStatus = 'PASS';
  await context.close();
} catch (error) {
  report.fatal = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close();
  report.finishedAt = new Date().toISOString();
  report.status = report.fatal ? 'FAIL' : 'PASS';
  report.noFabricatedPass = report.status === 'PASS' && report.results.length === routes.length * viewports.length;
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`UI GLASS BACKGROUNDS BROWSER: ${report.status}`);
console.log(path.join(output, 'report.json'));
if (report.fatal) {
  console.error(report.fatal);
  process.exitCode = 1;
}
