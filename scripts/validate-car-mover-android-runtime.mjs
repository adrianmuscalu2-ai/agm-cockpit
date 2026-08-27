import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const endpoint = process.env.AGM_ANDROID_CDP ?? 'http://127.0.0.1:9223';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'car-mover', 'android-runtime', runId);
const report = { schemaVersion:1, runId, endpoint, runtime:'Capacitor Android WebView', status:'FAIL', results:[] };
let browser;

await mkdir(out, { recursive:true });
try {
  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page = context?.pages()[0];
  if (!page) throw new Error('ANDROID_WEBVIEW_PAGE_NOT_FOUND');

  await navigate(page, '/car-mover', '.car-mover-entry');
  await visible(page, '[data-module="premiumCopilot"]', 'ANDROID_HERO_COPILOT_MISSING');
  await visible(page, '[data-module="ocr"]', 'ANDROID_HERO_OCR_MISSING');
  await visible(page, '[data-module="premiumVoice"]', 'ANDROID_HERO_VOICE_MISSING');
  if (await page.locator('.car-mover-entry-modules').count()) throw new Error('ANDROID_HERO_BYPASSES_HUB');
  await capture(page, 'android-hero', '/car-mover');

  await page.locator('[data-module="carMoverMenu"]').click();
  await page.waitForURL((url) => url.pathname === '/car-mover/menu');
  await page.waitForSelector('.car-mover-menu-grid');
  if (await page.locator('.car-mover-menu-card').count() !== 6) throw new Error('ANDROID_HUB_CARD_COUNT_INVALID');
  await visible(page, '[data-car-mover-quick="ocr"]', 'ANDROID_HUB_OCR_MISSING');
  await visible(page, '[data-car-mover-quick="voice"]', 'ANDROID_HUB_VOICE_MISSING');
  await capture(page, 'android-hub', '/car-mover/menu');

  const modules = [
    ['carMoverPlanning','/car-mover/planning','planning'],
    ['carMoverActive','/car-mover/active-transfer','active'],
    ['carMoverCompletion','/car-mover/completion-incidents','completion'],
    ['carMoverAccounting','/car-mover/accounting','accounting'],
    ['carMoverGuide','/car-mover/guide','guide'],
    ['carMoverArchive','/car-mover/archive','archive'],
  ];
  for (const [module, route, section] of modules) {
    await page.locator(`[data-module="${module}"]`).click();
    await page.waitForURL((url) => url.pathname === route);
    await page.waitForSelector(`[data-car-mover-section="${section}"]`);
    await visible(page, '[data-car-mover-quick="ocr"]', `${module}_OCR_MISSING`);
    await visible(page, '[data-car-mover-quick="voice"]', `${module}_VOICE_MISSING`);
    report.results.push({ id:`android-${module}`, status:'PASS', route, quickActions:['ocr','voice'] });
    await navigate(page, '/car-mover/menu', '.car-mover-menu-grid');
  }
  report.status = 'PASS';
} catch (error) {
  report.fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report,null,2)}\n`, 'utf8');
  await browser?.close();
}

console.log(`CAR MOVER ANDROID RUNTIME: ${report.status}`);
console.log(path.join(out, 'report.json'));
if (report.status !== 'PASS') { console.error(report.fatal); process.exitCode = 1; }

async function navigate(page, route, selector) {
  await page.evaluate((value) => { history.pushState({},'',value); dispatchEvent(new PopStateEvent('popstate')); }, route);
  await page.waitForURL((url) => url.pathname === route);
  await page.waitForSelector(selector);
}
async function visible(page, selector, error) { if (!(await page.locator(selector).isVisible())) throw new Error(error); }
async function capture(page, id, route) {
  const file = path.join(out, `${id}.png`);
  let screenshot = null;
  try {
    await page.screenshot({ path:file, fullPage:false, timeout:5_000 });
    screenshot = path.relative(root,file);
  } catch {
    // Android System WebView may not expose a stable screenshot surface over CDP.
    // DOM assertions remain authoritative; visual evidence is captured through native ADB.
  }
  report.results.push({ id, status:'PASS', route, screenshot, viewport:page.viewportSize(), visualFallback:screenshot ? null : 'NATIVE_ADB_CAPTURE' });
}
