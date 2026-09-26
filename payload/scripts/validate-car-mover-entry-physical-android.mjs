import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceScope = process.env.AGM_ANDROID_EVIDENCE_SCOPE?.trim() || 'car-mover/final-visual-correction/android-physical';
const out = path.join(root, 'evidence', ...evidenceScope.split(/[\\/]+/), runId);
const adb = path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const packageName = process.env.AGM_ANDROID_PACKAGE?.trim() || 'com.agm.cockpit.storagetest';
const cdpPort = process.env.AGM_ANDROID_CDP_PORT?.trim() || '9224';
const runFile = promisify(execFile);
const expectedVersionName = process.env.AGM_EXPECTED_VERSION_NAME?.trim() || '1.6.0';
const expectedVersionCode = Number(process.env.AGM_EXPECTED_VERSION_CODE?.trim() || '22');
const expectedAppVersion = `A.G.M. Cockpit ${expectedVersionName}`;
const expectedCopy = 'Planifică, compară și asistă executarea mutării vehiculelor pe baza datelor reale AGM.';
const protectedCopy = {
  boundary: 'Decizia finală rămâne umană.',
  action: 'Intră în Car Mover',
  copilot: 'AGM Premium Copilot',
  ocr: 'Cameră OCR',
  voice: 'Vorbește',
};
const report = {
  schemaVersion: 1,
  runId,
  runner: 'Physical Android + Capacitor WebView + controlled CDP + native ADB capture',
  packageName,
  browserPluginStatus: 'PASS',
  integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
  browserSessionStatus: 'FAIL',
  targetPageStatus: 'FAIL',
  results: [],
};

let browser;
await mkdir(out, { recursive:true });

try {
  const { stdout:devices } = await runFile(adb, ['devices', '-l']);
  const deviceLine = devices.split(/\r?\n/).find((line) => /\sdevice\s/.test(line));
  if (!deviceLine) throw new Error('PHYSICAL_ANDROID_DEVICE_NOT_AVAILABLE');
  report.device = deviceLine.trim();

  const { stdout:packageDump } = await runFile(adb, ['shell', 'dumpsys', 'package', packageName]);
  const installedVersionName = packageDump.match(/versionName=([^\s]+)/)?.[1] ?? null;
  const installedVersionCode = Number(packageDump.match(/versionCode=(\d+)/)?.[1] ?? Number.NaN);
  if (installedVersionName !== expectedVersionName || installedVersionCode !== expectedVersionCode) {
    throw new Error(`INSTALLED_BUILD_IDENTITY_MISMATCH:${JSON.stringify({ installedVersionName, installedVersionCode, expectedVersionName, expectedVersionCode })}`);
  }
  report.installedBuildIdentity = { packageName, versionName:installedVersionName, versionCode:installedVersionCode };

  await runFile(adb, ['shell', 'am', 'force-stop', packageName]);
  await runFile(adb, ['shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1']);
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const { stdout:pidOutput } = await runFile(adb, ['shell', 'pidof', packageName]);
  const pid = pidOutput.trim().split(/\s+/)[0];
  if (!pid) throw new Error('ANDROID_TEST_PROCESS_NOT_RUNNING');
  await runFile(adb, ['forward', `tcp:${cdpPort}`, `localabstract:webview_devtools_remote_${pid}`]);

  browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => !candidate.url().includes('sw.js'));
  if (!page) throw new Error('ANDROID_WEBVIEW_PAGE_NOT_FOUND');
  report.browserSessionStatus = 'PASS';

  const evaluatedAt = new Date().toISOString();
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    let data = {};
    if (url.pathname.endsWith('/auth/login') || url.pathname.endsWith('/auth/refresh')) {
      data = { accessToken:'physical-android-visual-token', user:{ id:'owner-visual', displayName:'Owner Visual', email:'owner@example.test', roles:['OWNER','PREMIUM_ACCESS'] } };
    } else if (url.pathname.endsWith('/auth/entitlements')) {
      data = { subjectId:'owner-visual', tier:'premium', status:'active', capabilities:['premium.command-center','premium.voice-assistant','car-mover.jobs'], evaluatedAt, policyVersion:'access-entitlements@1.0.0' };
    }
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ data, requestId:'physical-android-final-visual' }) });
  });

  await page.goto('https://localhost/access', { waitUntil:'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion:'privacy-v2026.07.13', termsVersion:'terms-v2026.07.13', acceptedAt:new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
  });
  await page.locator('input[name=email]').fill('owner@example.test');
  await page.locator('input[name=password]').fill('visual-review-only');
  await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
  await page.evaluate(() => {
    history.pushState({}, '', '/car-mover');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForSelector('.car-mover-entry');

  const content = await page.evaluate(({ expectedCopy, protectedCopy, expectedAppVersion }) => {
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? '';
    const controls = [...document.querySelectorAll('.car-mover-entry-controls a')].map((element) => element.textContent?.trim() ?? '');
    const subtitle = text('.car-mover-entry-copy p');
    const boundary = text('.car-mover-entry-boundary');
    const action = text('.car-mover-entry-action');
    const title = text('#car-mover-entry-title');
    const customInsetBottom = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom')) || 0;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)';
    document.body.append(probe);
    const envInsetBottom = Number.parseFloat(getComputedStyle(probe).paddingBottom) || 0;
    probe.remove();
    const entry = document.querySelector('.car-mover-entry');
    const entryStyle = getComputedStyle(entry);
    const entryPaddingBottom = Number.parseFloat(entryStyle.paddingBottom) || 0;
    const initialScrollY = window.scrollY;
    const scrollHeight = document.scrollingElement?.scrollHeight ?? 0;
    const clientHeight = document.scrollingElement?.clientHeight ?? 0;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    return {
      subtitle,
      boundary,
      action,
      controls,
      title,
      copyPass:subtitle === expectedCopy,
      appVersionPass:document.body.textContent?.includes(expectedAppVersion) ?? false,
      protectedCopyPass:boundary === protectedCopy.boundary && action === protectedCopy.action && controls.includes(protectedCopy.copilot) && controls.includes(protectedCopy.ocr) && controls.includes(protectedCopy.voice) && title.includes('CAR MOVER') && title.includes('DISPATCH AI'),
      safeArea:{ customInsetBottom, envInsetBottom, effectiveInsetBottom:Math.max(customInsetBottom, envInsetBottom), entryPaddingBottom },
      scroll:{ initialScrollY, scrollHeight, clientHeight, maxScroll },
      layout:{ innerWidth:window.innerWidth, innerHeight:window.innerHeight, devicePixelRatio:window.devicePixelRatio, horizontalOverflow:document.documentElement.scrollWidth > document.documentElement.clientWidth },
    };
  }, { expectedCopy, protectedCopy, expectedAppVersion });

  if (!content.copyPass) throw new Error(`COPY_MISMATCH:${content.subtitle}`);
  if (!content.appVersionPass) throw new Error(`APP_VERSION_UI_MISMATCH:${expectedAppVersion}`);
  if (!content.protectedCopyPass) throw new Error('PROTECTED_COPY_OR_IDENTITY_CHANGED');
  if (content.safeArea.effectiveInsetBottom <= 0) throw new Error(`REAL_BOTTOM_SAFE_AREA_NOT_EXPOSED:${JSON.stringify(content.safeArea)}`);
  if (content.safeArea.entryPaddingBottom < 16 + content.safeArea.effectiveInsetBottom - 1) throw new Error(`BOTTOM_SAFE_AREA_NOT_APPLIED:${JSON.stringify(content.safeArea)}`);
  if (content.layout.horizontalOverflow) throw new Error('HORIZONTAL_OVERFLOW');
  if (content.scroll.maxScroll <= 0) throw new Error(`SCROLL_NOT_AVAILABLE:${JSON.stringify(content.scroll)}`);

  const accessibility = await page.evaluate(async () => {
    const selectors = ['.car-mover-entry-action', '[data-module="premiumCopilot"]', '[data-module="ocr"]', '[data-module="premiumVoice"]', '.car-mover-entry-flow'];
    const effectiveInsetBottom = Math.max(
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom')) || 0,
      (() => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)';
        document.body.append(probe);
        const value = Number.parseFloat(getComputedStyle(probe).paddingBottom) || 0;
        probe.remove();
        return value;
      })(),
    );
    const checkpoints = [];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`MISSING_ELEMENT:${selector}`);
      element.scrollIntoView({ block:'center' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = element.getBoundingClientRect();
      const visibleBottom = (window.visualViewport?.height ?? window.innerHeight) - effectiveInsetBottom;
      checkpoints.push({ selector, top:rect.top, bottom:rect.bottom, visibleBottom, pass:rect.top >= 0 && rect.bottom <= visibleBottom + 1 });
    }
    window.scrollTo({ top:document.scrollingElement?.scrollHeight ?? document.body.scrollHeight, behavior:'instant' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const flowRect = document.querySelector('.car-mover-entry-flow').getBoundingClientRect();
    const visibleBottom = (window.visualViewport?.height ?? window.innerHeight) - effectiveInsetBottom;
    return { checkpoints, finalScrollY:window.scrollY, flowBottom:flowRect.bottom, visibleBottom, bottomContentPass:flowRect.bottom <= visibleBottom + 1 };
  });

  if (!accessibility.checkpoints.every((checkpoint) => checkpoint.pass)) throw new Error(`CONTENT_NOT_SCROLL_ACCESSIBLE:${JSON.stringify(accessibility.checkpoints)}`);
  if (!accessibility.bottomContentPass) throw new Error(`BOTTOM_CONTENT_OCCLUDED:${JSON.stringify(accessibility)}`);

  const { stdout:uiHierarchy } = await runFile(adb, ['exec-out', 'uiautomator', 'dump', '/dev/tty']);
  const autofillOverlayDismissed = uiHierarchy.includes('android:id/autofill_save');
  if (autofillOverlayDismissed) {
    await runFile(adb, ['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  const { stdout:cleanUiHierarchy } = await runFile(adb, ['exec-out', 'uiautomator', 'dump', '/dev/tty']);
  if (cleanUiHierarchy.includes('android:id/autofill_save')) throw new Error('SYSTEM_AUTOFILL_OVERLAY_STILL_VISIBLE');

  await page.evaluate(() => window.scrollTo({ top:0, behavior:'instant' }));
  await new Promise((resolve) => setTimeout(resolve, 300));
  const { stdout:copyScreenshotBytes } = await runFile(adb, ['exec-out', 'screencap', '-p'], { encoding:'buffer', maxBuffer:32 * 1024 * 1024 });
  const copyScreenshot = path.join(out, 'car-mover-entry-copy-physical-android.png');
  await writeFile(copyScreenshot, copyScreenshotBytes);

  const bottomFrame = await page.evaluate(() => {
    const flow = document.querySelector('.car-mover-entry-flow');
    const effectiveInsetBottom = Math.max(
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom')) || 0,
      (() => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)';
        document.body.append(probe);
        const value = Number.parseFloat(getComputedStyle(probe).paddingBottom) || 0;
        probe.remove();
        return value;
      })(),
    );
    const visibleBottom = (window.visualViewport?.height ?? window.innerHeight) - effectiveInsetBottom;
    const absoluteFlowBottom = flow.getBoundingClientRect().bottom + window.scrollY;
    window.scrollTo({ top:Math.max(0, absoluteFlowBottom - visibleBottom + 16), behavior:'instant' });
    return { effectiveInsetBottom, visibleBottom };
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const framedFlow = await page.locator('.car-mover-entry-flow').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top:rect.top, bottom:rect.bottom };
  });
  if (framedFlow.bottom > bottomFrame.visibleBottom - 15 || framedFlow.bottom < 0) throw new Error(`BOTTOM_CAPTURE_FRAME_INVALID:${JSON.stringify({ bottomFrame, framedFlow })}`);
  const { stdout:bottomScreenshotBytes } = await runFile(adb, ['exec-out', 'screencap', '-p'], { encoding:'buffer', maxBuffer:32 * 1024 * 1024 });
  const bottomScreenshot = path.join(out, 'car-mover-entry-bottom-safe-area-physical-android.png');
  await writeFile(bottomScreenshot, bottomScreenshotBytes);

  await page.evaluate(() => window.scrollTo({ top:document.scrollingElement?.scrollHeight ?? document.body.scrollHeight, behavior:'instant' }));
  await new Promise((resolve) => setTimeout(resolve, 300));
  const versionVisible = await page.locator('body').evaluate((body, expected) => body.textContent?.includes(expected) ?? false, expectedAppVersion);
  if (!versionVisible) throw new Error(`INSTALLED_VERSION_NOT_VISIBLE:${expectedAppVersion}`);
  const { stdout:identityScreenshotBytes } = await runFile(adb, ['exec-out', 'screencap', '-p'], { encoding:'buffer', maxBuffer:32 * 1024 * 1024 });
  const identityScreenshot = path.join(out, `agm-${expectedVersionName}-installed-identity-physical-android.png`);
  await writeFile(identityScreenshot, identityScreenshotBytes);

  report.targetPageStatus = 'PASS';
  report.results.push(
    { id:'android-physical-device', status:'PASS', device:report.device, packageName },
    { id:'installed-build-identity', status:'PASS', packageName, versionName:expectedVersionName, versionCode:expectedVersionCode, appVersion:expectedAppVersion, screenshot:path.relative(root, identityScreenshot) },
    { id:'copy', status:'PASS', expected:expectedCopy, observed:content.subtitle },
    { id:'protected-visual-identity', status:'PASS', protectedCopy, observed:{ boundary:content.boundary, action:content.action, controls:content.controls, title:content.title } },
    { id:'bottom-safe-area', status:'PASS', ...content.safeArea, source:'Android system bars/display cutout inset exposed by Capacitor SystemBars' },
    { id:'scroll-and-bottom-content', status:'PASS', ...content.scroll, ...accessibility },
    { id:'visual-regression', status:'PASS', horizontalOverflow:false, protectedIdentityChanges:0, autofillOverlayDismissed, copyScreenshot:path.relative(root, copyScreenshot), bottomSafeAreaScreenshot:path.relative(root, bottomScreenshot), bottomFrame:{ ...bottomFrame, ...framedFlow } },
  );
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await browser?.close();
  await runFile(adb, ['forward', '--remove', `tcp:${cdpPort}`]).catch(() => undefined);
}

console.log(`CAR MOVER ENTRY PHYSICAL ANDROID: ${report.status}`);
console.log(path.join(out, 'report.json'));
if (report.status !== 'PASS') {
  console.error(report.fatal);
  process.exitCode = 1;
}
