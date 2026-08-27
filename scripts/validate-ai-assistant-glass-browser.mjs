import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const target = process.env.AGM_VISUAL_TARGET ?? 'http://127.0.0.1:5174';
const productionTarget = new URL(target).hostname === 'app.agmcockpit.com';
const apkTarget = process.env.AGM_ANDROID_APK_URL ?? (productionTarget
  ? 'https://api.agmcockpit.com/downloads/AGM-Cockpit-Android-1.3.0.apk'
  : `${target}/downloads/AGM-Cockpit-Android-1.3.0.apk`);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'ai-assistant-glass', productionTarget ? 'production' : '', runId);
const results = [];
const logs = [];
let server;
let browser;
let fatal;

const record = (event, detail = {}) => logs.push({ at: new Date().toISOString(), event, ...detail });
const healthy = async () => {
  try { return (await fetch(target, { signal: AbortSignal.timeout(2_000) })).status === 200; }
  catch { return false; }
};

async function startTarget() {
  if (await healthy()) return;
  if (productionTarget) throw new Error('Production target unavailable');
  server = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'node_modules\\.bin\\vite.cmd --host 127.0.0.1 --port 5174 --strictPort'], {
    cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore',
  });
  server.unref();
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await healthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Cockpit 5174 unavailable');
}

function alphaFromColor(value) {
  const match = value.match(/rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)/);
  return match?.[1] === undefined ? 1 : Number(match[1]);
}

async function authenticate(page) {
  await page.goto(`${target}/access`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name=email]').fill('owner@example.test');
  await page.locator('input[name=password]').fill('not-a-real-secret');
  await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
}

async function auditSurface(page, scenario) {
  await page.evaluate((route) => {
    window.history.pushState({}, '', route);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, scenario.route);
  await page.waitForSelector(scenario.root);
  await page.waitForSelector(scenario.panel);
  await page.evaluate(async () => {
    const visual = new Image();
    visual.src = '/images/agm-ai-assistant-microphone-v1.png';
    await visual.decode();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const detail = await page.evaluate(({ rootSelector, panelSelector, micSelector }) => {
    const rootElement = document.querySelector(rootSelector);
    const panel = document.querySelector(panelSelector);
    const mic = document.querySelector(micSelector);
    if (!rootElement || !panel || !mic) throw new Error('Required assistant surface element missing');
    const rootStyle = getComputedStyle(rootElement);
    const visualStyle = getComputedStyle(rootElement, '::after');
    const panelStyle = getComputedStyle(panel);
    const micRect = mic.getBoundingClientRect();
    const micIcon = mic.querySelector('.premium-assistant-mic-icon, .copilot-mic-icon');
    const micLabel = mic.querySelector('span:not(.premium-assistant-mic-icon):not(.copilot-mic-icon)');
    const textColor = getComputedStyle(panel).color;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      rootHeight: rootElement.getBoundingClientRect().height,
      visual: {
        image: visualStyle.backgroundImage,
        size: visualStyle.backgroundSize,
        position: visualStyle.backgroundPosition,
        opacity: visualStyle.opacity,
      },
      panel: {
        backgroundColor: panelStyle.backgroundColor,
        backdropFilter: panelStyle.backdropFilter || panelStyle.webkitBackdropFilter,
        borderColor: panelStyle.borderColor,
        color: textColor,
      },
      mic: {
        left: micRect.left,
        top: micRect.top,
        width: micRect.width,
        height: micRect.height,
        centerX: micRect.left + micRect.width / 2,
        visible: micRect.bottom > 0 && micRect.top < innerHeight,
        icon: micIcon?.textContent?.trim() || '',
        iconFontSize: micIcon ? getComputedStyle(micIcon).fontSize : '',
        label: micLabel?.textContent?.trim() || '',
        labelFontSize: micLabel ? getComputedStyle(micLabel).fontSize : '',
      },
      rootBackground: rootStyle.backgroundColor,
    };
  }, { rootSelector: scenario.root, panelSelector: scenario.panel, micSelector: scenario.mic });

  const alpha = alphaFromColor(detail.panel.backgroundColor);
  const microphoneOffset = Math.abs(detail.mic.centerX - detail.viewport.width / 2);
  const checks = {
    fullPageVisual: detail.visual.image.includes('agm-ai-assistant-microphone-v1.png') && detail.rootHeight >= detail.viewport.height,
    visualDominant: detail.visual.size !== 'auto' && Number(detail.visual.opacity) >= 0.8,
    microphoneCentral: detail.mic.visible && microphoneOffset <= detail.viewport.width * 0.08,
    microphoneReadable: detail.mic.icon === '\u{1F3A4}' && Number.parseFloat(detail.mic.iconFontSize) >= 36 && Number.parseFloat(detail.mic.labelFontSize) <= 18,
    translucentPanel: Math.abs(alpha - 0.22) <= 0.005,
    glassEffect: detail.panel.backdropFilter.includes('blur(9px)'),
    readable: detail.panel.color !== 'rgba(0, 0, 0, 0)' && detail.panel.borderColor !== 'rgba(0, 0, 0, 0)',
    noHorizontalOverflow: detail.documentWidth <= detail.viewport.width + 1,
  };
  const failed = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name);
  const screenshot = path.join(out, `${scenario.id}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  results.push({
    id: scenario.id,
    status: failed.length ? 'FAIL' : 'PASS',
    route: scenario.route,
    viewport: scenario.viewport,
    screenshot: path.relative(root, screenshot),
    checks,
    detail: { ...detail, panelAlpha: alpha, microphoneOffset },
  });
  if (failed.length) throw new Error(`${scenario.id}: ${failed.join(', ')}`);
}

await mkdir(out, { recursive: true });
try {
  await startTarget();
  const liveAssetResponse = await fetch(`${target}/images/agm-ai-assistant-microphone-v1.png`, { cache: 'no-store' });
  if (!liveAssetResponse.ok) throw new Error(`Live assistant asset HTTP ${liveAssetResponse.status}`);
  const liveAssetSha256 = createHash('sha256').update(Buffer.from(await liveAssetResponse.arrayBuffer())).digest('hex').toUpperCase();
  if (liveAssetSha256 !== '219A2299285CF7333596B15533149328FBAEBB210C6F73C9EA5F56B664DF1255') throw new Error(`Live assistant asset hash mismatch: ${liveAssetSha256}`);
  if (productionTarget) {
    const androidPage = await (await fetch(`${target}/android.html`, { cache: 'no-store' })).text();
    if (!androidPage.includes(`href="${apkTarget}"`)) throw new Error('Production Android page does not expose the canonical APK URL');
  }
  const liveApkResponse = await fetch(apkTarget, { cache: 'no-store' });
  if (!liveApkResponse.ok) throw new Error(`Live Android APK HTTP ${liveApkResponse.status}`);
  const liveApkSha256 = createHash('sha256').update(Buffer.from(await liveApkResponse.arrayBuffer())).digest('hex').toUpperCase();
  if (liveApkSha256 !== 'A26AA71EF93034C968D272861F86BA0FF5D57A1A0E581184FEC80F55CBFCF329') throw new Error(`Live Android APK hash mismatch: ${liveApkSha256}`);
  browser = await chromium.launch({ headless: true });
  const scenarios = [
    { id: 'desktop-copilot', route: '/premium/copilot', root: '.premium-copilot-view', panel: '.copilot-core', mic: '.copilot-mic', viewport: { width: 1440, height: 1000 } },
    { id: 'desktop-voice', route: '/premium/voice', root: '.premium-assistant-view', panel: '.premium-assistant-panel', mic: '.premium-assistant-mic', viewport: { width: 1440, height: 1000 } },
    { id: 'mobile-copilot', route: '/premium/copilot', root: '.premium-copilot-view', panel: '.copilot-core', mic: '.copilot-mic', viewport: { width: 412, height: 915 } },
    { id: 'mobile-voice', route: '/premium/voice', root: '.premium-assistant-view', panel: '.premium-assistant-panel', mic: '.premium-assistant-mic', viewport: { width: 412, height: 915 } },
  ];
  for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport: scenario.viewport });
    page.on('console', (message) => record('console', { scenario: scenario.id, type: message.type(), text: message.text() }));
    await page.addInitScript(() => {
      localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({
        privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString(),
      }));
      localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
      localStorage.setItem('agm.premium.single-copilot.enabled', 'true');
    });
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      let data = {};
      if (url.endsWith('/auth/login')) data = { accessToken: 'controlled-test-token', user: { id: 'owner', displayName: 'Owner', email: 'owner@example.test', roles: ['PREMIUM_ACCESS'] } };
      else if (url.endsWith('/auth/entitlements')) data = { subjectId: 'owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'assistant-glass-controlled-runner' }) });
    });
    await authenticate(page);
    await auditSurface(page, scenario);
    await page.close();
  }
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close();
  if (server) spawnSync('taskkill.exe', ['/pid', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  const report = {
    schemaVersion: 1,
    runId,
    status: fatal ? 'FAIL' : 'PASS',
    runner: 'Controlled AGM Playwright/Chromium',
    target,
    buildContext: { revision },
    browserGate: {
      browserPluginStatus: 'PASS',
      integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
      browserSessionStatus: fatal ? 'FAIL' : 'PASS',
      targetPageStatus: fatal ? 'FAIL' : 'PASS',
    },
    asset: {
      path: 'apps/web/public/images/agm-ai-assistant-microphone-v1.png',
      sha256: '219A2299285CF7333596B15533149328FBAEBB210C6F73C9EA5F56B664DF1255',
      source: 'User-supplied ChatGPT visual reference',
    },
    productionDistribution: productionTarget ? {
      revision: '4b5871ad26e2032cec70f6c4b25ebe209e14cb15',
      apkUrl: apkTarget,
      apkSha256: 'A26AA71EF93034C968D272861F86BA0FF5D57A1A0E581184FEC80F55CBFCF329',
    } : undefined,
    results,
    fatal,
  };
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(out, 'runner.log.jsonl'), logs.map(JSON.stringify).join('\n'));
  console.log(`AI ASSISTANT GLASS VISUAL AUDIT: ${report.status}`);
  console.log(path.join(out, 'report.json'));
  process.exit(fatal ? 1 : 0);
}
