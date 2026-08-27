import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const serial = 'RFCY70WDHXK';
const adb = path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const apk = process.env.AGM_ANDROID_APK ?? path.join(root, 'tmp', 'ui-assistant-production', 'apps', 'web', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'ai-assistant-glass', 'android', runId);
const requestedScenario = process.env.AGM_ANDROID_SCENARIO ?? 'all';
const results = [];
let browser;
let fatal;

const shell = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' });
const alpha = (color) => Number(color.match(/rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)/)?.[1] ?? 1);

async function authenticate(page) {
  await page.evaluate(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({
      privacyPolicyVersion: 'privacy-v2026.07.13',
      termsVersion: 'terms-v2026.07.13',
      acceptedAt: new Date().toISOString(),
    }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    localStorage.setItem('agm.premium.single-copilot.enabled', 'true');
    history.pushState({}, '', '/access');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.locator('input[name=email]').fill('owner@example.test');
  await page.locator('input[name=password]').fill('not-a-real-secret');
  await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
}

async function audit(page, scenario) {
  await page.evaluate((route) => {
    history.pushState({}, '', route);
    dispatchEvent(new PopStateEvent('popstate'));
  }, scenario.route);
  await page.waitForSelector(scenario.root);
  await page.waitForSelector(scenario.panel);
  await page.evaluate(async () => {
    const visual = new Image();
    visual.src = '/images/agm-ai-assistant-microphone-v1.png';
    await visual.decode();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  const detail = await page.evaluate(({ root, panel, mic }) => {
    const rootElement = document.querySelector(root);
    const panelElement = document.querySelector(panel);
    const micElement = document.querySelector(mic);
    if (!rootElement || !panelElement || !micElement) throw new Error('Android assistant surface incomplete');
    const visual = getComputedStyle(rootElement, '::after');
    const glass = getComputedStyle(panelElement);
    const micRect = micElement.getBoundingClientRect();
    const icon = micElement.querySelector('.premium-assistant-mic-icon, .copilot-mic-icon');
    const label = micElement.querySelector('span:not(.premium-assistant-mic-icon):not(.copilot-mic-icon)');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      rootHeight: rootElement.getBoundingClientRect().height,
      visual: { image: visual.backgroundImage, size: visual.backgroundSize, position: visual.backgroundPosition, opacity: visual.opacity },
      panel: { backgroundColor: glass.backgroundColor, backdropFilter: glass.backdropFilter || glass.webkitBackdropFilter, borderColor: glass.borderColor, color: glass.color },
      mic: {
        centerX: micRect.left + micRect.width / 2,
        visible: micRect.bottom > 0 && micRect.top < innerHeight,
        icon: icon?.textContent?.trim() ?? '',
        iconFontSize: icon ? getComputedStyle(icon).fontSize : '',
        label: label?.textContent?.trim() ?? '',
        labelFontSize: label ? getComputedStyle(label).fontSize : '',
      },
    };
  }, scenario);
  const panelAlpha = alpha(detail.panel.backgroundColor);
  const micOffset = Math.abs(detail.mic.centerX - detail.viewport.width / 2);
  const checks = {
    bundledApprovedAsset: detail.visual.image.includes('agm-ai-assistant-microphone-v1.png'),
    fullPageVisual: detail.rootHeight >= detail.viewport.height && detail.visual.size === 'cover' && Number(detail.visual.opacity) >= 0.8,
    microphoneCentral: detail.mic.visible && micOffset <= detail.viewport.width * 0.08,
    microphoneReadable: detail.mic.icon === '\u{1F3A4}' && Number.parseFloat(detail.mic.iconFontSize) >= 36 && Number.parseFloat(detail.mic.labelFontSize) <= 18,
    approvedGlass: Math.abs(panelAlpha - 0.22) < 0.001 && detail.panel.backdropFilter.includes('blur(9px)'),
    readable: detail.panel.color !== 'rgba(0, 0, 0, 0)' && detail.panel.borderColor !== 'rgba(0, 0, 0, 0)',
    noHorizontalOverflow: detail.documentWidth <= detail.viewport.width + 1,
  };
  const screenshot = path.join(out, `${scenario.id}.png`);
  await page.screenshot({ path: screenshot, fullPage: false, timeout: 60_000 });
  const failed = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name);
  results.push({ id: scenario.id, route: scenario.route, status: failed.length ? 'FAIL' : 'PASS', screenshot: path.relative(root, screenshot), checks, detail: { ...detail, panelAlpha, micOffset } });
  if (failed.length) throw new Error(`${scenario.id}: ${failed.join(', ')}`);
}

await mkdir(out, { recursive: true });
try {
  const apkSha256 = createHash('sha256').update(await readFile(apk)).digest('hex').toUpperCase();
  const packageDetail = shell('shell', 'dumpsys', 'package', 'com.agm.cockpit');
  const socket = shell('shell', 'cat', '/proc/net/unix').match(/@(webview_devtools_remote_\d+)/)?.[1];
  if (!socket) throw new Error('Android WebView debug socket unavailable');
  shell('forward', 'tcp:9222', `localabstract:${socket}`);
  browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => !candidate.url().includes('sw.js'));
  if (!page) throw new Error('Android WebView page unavailable');
  await page.evaluate(async () => { for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister(); });
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/auth/login')) return new Response(JSON.stringify({ data: { accessToken: 'android-glass-token', user: { id: 'owner', displayName: 'Owner', email: 'owner@example.test', roles: ['PREMIUM_ACCESS'] } } }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.endsWith('/auth/entitlements')) return new Response(JSON.stringify({ data: { subjectId: 'owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' } }), { status: 200, headers: { 'content-type': 'application/json' } });
      return nativeFetch(input, init);
    };
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    let data = {};
    if (url.endsWith('/auth/login')) data = { accessToken: 'android-glass-token', user: { id: 'owner', displayName: 'Owner', email: 'owner@example.test', roles: ['PREMIUM_ACCESS'] } };
    else if (url.endsWith('/auth/entitlements')) data = { subjectId: 'owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'android-glass-device-audit' }) });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await authenticate(page);
  if (requestedScenario === 'all' || requestedScenario === 'copilot') {
    await audit(page, { id: 'android-copilot', route: '/premium/copilot', root: '.premium-copilot-view', panel: '.copilot-core', mic: '.copilot-mic' });
  }
  if (requestedScenario === 'all' || requestedScenario === 'voice') {
    await audit(page, { id: 'android-voice', route: '/premium/voice', root: '.premium-assistant-view', panel: '.premium-assistant-panel', mic: '.premium-assistant-mic' });
  }
  const report = { schemaVersion: 1, runId, status: 'PASS', device: 'Samsung SM-S931B', serial, package: 'com.agm.cockpit', versionName: packageDetail.match(/versionName=([^\r\n]+)/)?.[1], apk, apkSha256, results };
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`AI ASSISTANT GLASS ANDROID AUDIT: ${report.status}`);
  console.log(path.join(out, 'report.json'));
} catch (error) {
  fatal = error instanceof Error ? error.stack ?? error.message : String(error);
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify({ schemaVersion: 1, runId, status: 'FAIL', device: 'Samsung SM-S931B', serial, package: 'com.agm.cockpit', results, fatal }, null, 2)}\n`);
  console.error(fatal);
} finally {
  await browser?.close();
  try { shell('forward', '--remove', 'tcp:9222'); } catch {}
  process.exit(fatal ? 1 : 0);
}
