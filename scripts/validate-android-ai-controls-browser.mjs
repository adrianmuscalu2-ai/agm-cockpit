import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'android-ai-controls', 'browser', runId);
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const freePort = () => new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.unref();
  socket.once('error', reject);
  socket.listen(0, '127.0.0.1', () => {
    const address = socket.address();
    socket.close(() => resolve(address.port));
  });
});

async function authenticate(page, target) {
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({
      privacyPolicyVersion: 'privacy-v2026.07.13',
      termsVersion: 'terms-v2026.07.13',
      acceptedAt: new Date().toISOString(),
    }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    localStorage.setItem('agm.premium.single-copilot.enabled', 'true');
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    const data = url.endsWith('/auth/login')
      ? { accessToken: 'controlled-android-ui-token', user: { id: 'owner', displayName: 'Owner', email: 'owner@example.test', roles: ['PREMIUM_ACCESS'] } }
      : url.endsWith('/auth/entitlements')
        ? { subjectId: 'owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' }
        : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'android-ui-browser-check' }) });
  });
  await page.goto(`${target}/access`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name=email]').fill('owner@example.test');
  await page.locator('input[name=password]').fill('not-a-real-secret');
  await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
}

async function navigate(page, route) {
  await page.evaluate((nextRoute) => {
    history.pushState({}, '', nextRoute);
    dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.waitForTimeout(250);
}

await mkdir(out, { recursive: true });
try {
  const port = await freePort();
  const target = `http://127.0.0.1:${port}`;
  report.target = target;
  server = spawn(process.execPath, [path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: path.join(root, 'apps', 'web'),
    windowsHide: true,
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(target)).status === 200) break; } catch {}
    await delay(150);
    if (attempt === 79) throw new Error('Preview target did not become healthy');
  }

  browser = await chromium.launch({ headless: true });
  report.browserGate.browserSessionStatus = 'PASS';
  for (const scenario of [
    { id: 'desktop', viewport: { width: 1440, height: 1000 } },
    { id: 'mobile', viewport: { width: 412, height: 915 } },
  ]) {
    const page = await browser.newPage({ viewport: scenario.viewport });
    await authenticate(page, target);
    await navigate(page, '/premium/copilot');
    await page.locator('[data-premium-copilot]').waitFor({ state: 'visible' });
    const copilot = await page.evaluate(() => ({
      androidAssistantControls: document.querySelectorAll('[data-android-assistant]').length,
      androidShareControls: document.querySelectorAll('[data-share-android-question]').length,
      legacyAndroidSettingsControls: document.querySelectorAll('[data-android-assistant-settings]').length,
      internalAssistantStart: document.querySelectorAll('[data-assistant-start]').length,
      internalAssistantTranscript: document.querySelectorAll('[data-assistant-transcript]').length,
      internalAssistantConfirm: document.querySelectorAll('[data-assistant-confirm]').length,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    if (copilot.androidAssistantControls !== 0 || copilot.androidShareControls !== 0 || copilot.legacyAndroidSettingsControls !== 0) throw new Error(`${scenario.id}: Android-only controls visible in Browser`);
    if (copilot.internalAssistantStart !== 1 || copilot.internalAssistantTranscript !== 1 || copilot.internalAssistantConfirm !== 1) throw new Error(`${scenario.id}: AGM internal assistant controls missing`);
    if (copilot.horizontalOverflow) throw new Error(`${scenario.id}: horizontal overflow`);
    const copilotScreenshot = path.join(out, `${scenario.id}-copilot.png`);
    await page.screenshot({ path: copilotScreenshot, fullPage: true });

    await navigate(page, '/profile');
    await page.locator('.profile-panel').waitFor({ state: 'visible' });
    const profile = await page.evaluate(() => ({ androidVoiceSettingsSections: document.querySelectorAll('[data-android-voice-settings]').length }));
    if (profile.androidVoiceSettingsSections !== 0) throw new Error(`${scenario.id}: Android settings visible in Browser profile`);
    const profileScreenshot = path.join(out, `${scenario.id}-profile.png`);
    await page.screenshot({ path: profileScreenshot, fullPage: true });
    report.results.push({
      id: scenario.id,
      status: 'PASS',
      viewport: scenario.viewport,
      copilot,
      profile,
      screenshots: [path.relative(root, copilotScreenshot), path.relative(root, profileScreenshot)],
    });
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
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`ANDROID AI CONTROLS BROWSER: ${report.status}`);
  console.log(path.join(out, 'report.json'));
  if (report.status !== 'PASS') process.exitCode = 1;
}
