import { chromium } from 'playwright';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outputDirectory = path.join(root, 'evidence', 'device-capability-router', 'browser', runId);
const report = {
  schemaVersion: 1,
  runId,
  runner: 'Controlled AGM Playwright/Chromium',
  status: 'FAIL',
  browserGate: {
    browserPluginStatus: 'PASS',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: 'PENDING',
    targetPageStatus: 'PENDING',
  },
  results: [],
};
let server;
let browser;

await mkdir(outputDirectory, { recursive: true });
try {
  const runtimeAsset = (await readdir(path.join(root, 'apps', 'web', 'dist', 'assets')))
    .find((name) => /^device-capability\.runtime-.*\.js$/.test(name));
  if (!runtimeAsset) throw new Error('DEVICE_CAPABILITY_RUNTIME_ASSET_MISSING');
  const port = await freePort();
  const target = `http://127.0.0.1:${port}`;
  report.target = target;
  server = spawn(process.execPath, [path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore',
  });
  await waitForTarget(target);
  browser = await chromium.launch({ headless: true });
  report.browserGate.browserSessionStatus = 'PASS';

  for (const scenario of [
    { id: 'desktop', viewport: { width: 1440, height: 1000 } },
    { id: 'mobile', viewport: { width: 412, height: 915 } },
  ]) {
    const page = await browser.newPage({ viewport: scenario.viewport });
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async (assetName) => {
      const runtime = await import(`/assets/${assetName}`);
      sessionStorage.removeItem('agm.device-capabilities.v1');
      window.dispatchEvent(new Event('online'));
      const local = await runtime.n({ operation: 'SIMPLE_TRANSLATION', sensitivity: 'USER_TEXT', localCandidateAvailable: true });
      const agm = await runtime.n({ operation: 'AGM_CONTEXT_REASONING', sensitivity: 'PERSONAL', requiresAgmContext: true });
      const external = await runtime.n({ operation: 'SHARE_CONTEXT', sensitivity: 'USER_TEXT', userConfirmedExternal: true });
      const unsafe = await runtime.n({ operation: 'SAFETY_CRITICAL_READING', sensitivity: 'DOCUMENT', localCandidateAvailable: false, userConfirmedAgmTransfer: true, userConfirmedExternal: true });
      return {
        snapshot: JSON.parse(sessionStorage.getItem('agm.device-capabilities.v1')),
        local,
        agm,
        external,
        unsafe,
        androidControls: document.querySelectorAll('[data-android-assistant], [data-share-android-question], [data-android-voice-settings]').length,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    }, runtimeAsset);
    assert(result.snapshot.platform === 'web', `${scenario.id}: wrong platform snapshot`);
    assert(result.local.authority === 'LOCAL_DEVICE', `${scenario.id}: local route failed`);
    assert(result.agm.authority === 'AGM_AI', `${scenario.id}: AGM reasoning route failed`);
    assert(result.external.authority === 'UNAVAILABLE', `${scenario.id}: external Android handoff leaked into Browser`);
    assert(result.unsafe.authority === 'UNAVAILABLE', `${scenario.id}: safety critical route did not fail closed`);
    assert(result.androidControls === 0, `${scenario.id}: Android-only controls visible`);
    assert(!result.horizontalOverflow, `${scenario.id}: horizontal overflow`);
    const screenshot = path.join(outputDirectory, `${scenario.id}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    report.results.push({ id: scenario.id, status: 'PASS', viewport: scenario.viewport, result, screenshot: path.relative(root, screenshot) });
    await page.close();
  }
  report.browserGate.targetPageStatus = 'PASS';
  report.status = 'PASS';
} catch (error) {
  report.fatal = String(error?.stack || error);
  if (report.browserGate.browserSessionStatus === 'PASS') report.browserGate.targetPageStatus = 'FAIL';
} finally {
  await browser?.close();
  if (server) server.kill();
  report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`DEVICE CAPABILITY ROUTER BROWSER: ${report.status}`);
console.log(path.join(outputDirectory, 'report.json'));
if (report.status !== 'PASS') process.exitCode = 1;

function assert(condition, message) { if (!condition) throw new Error(message); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer(); socket.unref(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const address = socket.address(); socket.close(() => resolve(address.port)); });
  });
}
async function waitForTarget(target) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(target)).status === 200) return; } catch {}
    await delay(150);
  }
  throw new Error('PREVIEW_TARGET_UNAVAILABLE');
}
