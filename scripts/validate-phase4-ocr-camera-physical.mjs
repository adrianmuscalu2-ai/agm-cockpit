import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = process.cwd();
const serial = process.env.AGM_ANDROID_SERIAL ?? 'RFCY70WDHXK';
const packageName = process.env.AGM_ANDROID_PACKAGE ?? 'com.agm.cockpit.storagetest';
const expectedApkSha256 = 'FCB6015A1419230FB19ACC4D495CE225B177AA161C61159BF40B1680D6C06C1F';
const adb = path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'phase4', 'ocr-camera-physical', runId);
const report = { schemaVersion: 1, runId, status: 'FAIL', serial, packageName, checks: [], captures: [] };
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const adbRun = (...args) => run(adb, ['-s', serial, ...args], { maxBuffer: 16 * 1024 * 1024 });
const check = (id, passed, evidence) => report.checks.push({ id, status: passed ? 'PASS' : 'FAIL', evidence });
let browser;
let fatal;

async function focusedWindow() {
  return (await adbRun('shell', 'dumpsys', 'window')).stdout.match(/mCurrentFocus=.*$/m)?.[0] ?? '';
}

async function waitForFocus(fragment, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const focus = await focusedWindow();
    if (focus.includes(fragment)) return focus;
    await wait(250);
  }
  throw new Error(`FOCUS_TIMEOUT:${fragment}:${await focusedWindow()}`);
}

async function captureDeviceScreen(name) {
  const remote = `/sdcard/${name}`;
  const local = path.join(output, name);
  await adbRun('shell', 'screencap', '-p', remote);
  await adbRun('pull', remote, local);
  await adbRun('shell', 'rm', remote);
  return path.relative(root, local).replaceAll('\\', '/');
}

async function performCapture(page, scenario) {
  await page.goto(`https://localhost${scenario.route}`, { waitUntil: 'domcontentloaded' });
  const emailTutorialClose = page.locator('#closeEmailTutorial');
  if (scenario.id === 'email') {
    await emailTutorialClose.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined);
    if (await emailTutorialClose.isVisible().catch(() => false)) await emailTutorialClose.click();
  }
  if (scenario.id === 'basic') await page.locator('[data-basic-action="ocr"]').click();
  else await page.locator('[data-global-action="ocr"]').click();
  await page.locator('#globalOcrTakePhoto').waitFor({ state: 'visible' });

  const requestedAt = new Date().toISOString();
  await page.locator('#globalOcrTakePhoto').click();
  const cameraFocus = await waitForFocus('com.sec.android.app.camera');
  const previewScreenshot = await captureDeviceScreen(`${scenario.id}-fresh-camera-preview.png`);
  const shutterAt = new Date().toISOString();
  await adbRun('shell', 'input', 'keyevent', '27');
  await wait(1_500);
  await adbRun('shell', 'input', 'tap', '780', '2100');
  const returnFocus = await waitForFocus(`${packageName}/com.agm.cockpit.MainActivity`);

  await page.locator('#globalOcrDialogText').waitFor({ state: 'visible', timeout: 90_000 });
  const evidence = await page.evaluate(({ id, expectedPath, targetSelector }) => {
    const result = document.querySelector('#globalOcrDialogText')?.value?.trim() ?? '';
    const target = document.querySelector(targetSelector)?.value ?? '';
    const context = document.querySelector('[data-global-ocr-origin]');
    const image = document.querySelector('.global-ocr-dialog .ocr-preview-panel img');
    return {
      id,
      path: location.pathname,
      expectedPath,
      result,
      target,
      contextOrigin: context?.getAttribute('data-global-ocr-origin') ?? null,
      hasCapturedImage: Boolean(image?.getAttribute('src')?.startsWith('data:image/')),
    };
  }, { id: scenario.id, expectedPath: scenario.route, targetSelector: scenario.targetSelector });
  const appScreenshot = path.join(output, `${scenario.id}-ocr-result.png`);
  await page.screenshot({ path: appScreenshot, fullPage: true });
  const imageDataUrl = await page.locator('.global-ocr-dialog .ocr-preview-panel img').getAttribute('src');
  const imageSha256 = createHash('sha256').update(imageDataUrl ?? '').digest('hex').toUpperCase();
  const passed = evidence.path === scenario.route
    && evidence.result.length > 0
    && evidence.target.includes(evidence.result)
    && evidence.hasCapturedImage;
  const capture = {
    ...evidence,
    requestedAt,
    shutterAt,
    completedAt: new Date().toISOString(),
    cameraFocus,
    returnFocus,
    previewScreenshot,
    resultScreenshot: path.relative(root, appScreenshot).replaceAll('\\', '/'),
    capturedImageSha256: imageSha256,
    status: passed ? 'PASS' : 'FAIL',
  };
  report.captures.push(capture);
  check(`OCR_${scenario.id.toUpperCase()}_CONTEXTUAL_RETURN`, passed, capture);
}

await mkdir(output, { recursive: true });
try {
  const deviceRows = (await run(adb, ['devices', '-l'])).stdout;
  if (!deviceRows.includes(`${serial}`) || !deviceRows.includes(' device ')) throw new Error('AUTHORIZED_DEVICE_NOT_CONNECTED');
  const device = {
    model: (await adbRun('shell', 'getprop', 'ro.product.model')).stdout.trim(),
    android: (await adbRun('shell', 'getprop', 'ro.build.version.release')).stdout.trim(),
    sdk: (await adbRun('shell', 'getprop', 'ro.build.version.sdk')).stdout.trim(),
  };
  const packageDetail = (await adbRun('shell', 'dumpsys', 'package', packageName)).stdout;
  const installedPath = (await adbRun('shell', 'pm', 'path', packageName)).stdout.trim().replace('package:', '');
  const installedSha256 = (await adbRun('shell', 'sha256sum', installedPath)).stdout.trim().split(/\s+/)[0].toUpperCase();
  report.device = device;
  report.apk = {
    sourceHead: '5a85ed7797161fa0bc198c04b0e4b4354b90f69d',
    sourceTree: 'fcbee0f30c3ff7f78cad577acd83dac99c7a91cc',
    versionCode: packageDetail.match(/versionCode=(\d+)/)?.[1],
    versionName: packageDetail.match(/versionName=([^\r\n]+)/)?.[1]?.trim(),
    installedSha256,
  };
  check('DEVICE_AND_APK_PROVENANCE', device.model === 'SM-S931B'
    && device.android === '16'
    && report.apk.versionCode === '28'
    && report.apk.versionName === '1.6.0-storage-test'
    && installedSha256 === expectedApkSha256, { device, apk: report.apk });

  await adbRun('shell', 'pm', 'grant', packageName, 'android.permission.CAMERA');
  await adbRun('shell', 'am', 'force-stop', packageName);
  await adbRun('forward', '--remove', 'tcp:9224').catch(() => undefined);
  await adbRun('shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1');
  await wait(1_800);
  const pid = (await adbRun('shell', 'pidof', packageName)).stdout.trim().split(/\s+/)[0];
  if (!pid) throw new Error('ANDROID_PROCESS_NOT_RUNNING');
  await adbRun('forward', 'tcp:9224', `localabstract:webview_devtools_remote_${pid}`);
  browser = await chromium.connectOverCDP('http://127.0.0.1:9224');
  const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => !candidate.url().includes('sw.js'));
  if (!page) throw new Error('ANDROID_WEBVIEW_PAGE_UNAVAILABLE');
  page.setDefaultTimeout(20_000);
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const request = route.request().postDataJSON?.() ?? {};
    const data = url.pathname.endsWith('/security/permission-guardian/evaluate')
      ? { ...request, contractVersion: 'permission-guardian.v1', requestDetected: true, decision: 'APPROVED', authorityGranted: true, evidenceId: `phase4-ocr-${Date.now()}`, correlationId: 'phase4-ocr-physical', reasonCode: 'ALLOWLIST_AND_AUTHORITY_VERIFIED', timestamp: new Date().toISOString() }
      : url.pathname.endsWith('/auth/entitlements')
        ? { subjectId: 'phase4-ocr-physical', tier: 'premium', status: 'active', capabilities: ['premium.command-center'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' }
        : url.pathname.endsWith('/auth/refresh')
          ? { accessToken: 'phase4-ocr-readonly', user: { id: 'phase4-ocr-physical', displayName: 'Phase 4 OCR Physical', roles: ['PREMIUM_ACCESS'] } }
          : null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'phase4-ocr-readonly' }) });
  });
  await page.evaluate(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    sessionStorage.setItem('agm.auth.accessToken', 'phase4-ocr-readonly');
  });

  await performCapture(page, { id: 'basic', route: '/basic', targetSelector: '#globalOcrContextText' });
  await performCapture(page, { id: 'translator', route: '/translator', targetSelector: '#translatorText' });
  await page.goto('https://localhost/email', { waitUntil: 'domcontentloaded' });
  await page.locator('#message').fill('Phase 4 camera evidence');
  await performCapture(page, { id: 'email', route: '/email', targetSelector: '#message' });

  const distinctCaptures = new Set(report.captures.map((capture) => capture.capturedImageSha256)).size === report.captures.length;
  check('THREE_GENUINELY_NEW_CAMERA_CAPTURES', distinctCaptures, {
    count: report.captures.length,
    imageSha256: report.captures.map((capture) => capture.capturedImageSha256),
    provenance: 'Samsung Camera activity opened and physical shutter key dispatched separately for each context; no gallery/file input used.',
  });
  report.status = report.checks.every((entry) => entry.status === 'PASS') ? 'PASS' : 'FAIL';
} catch (error) {
  fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await adbRun('forward', '--remove', 'tcp:9224').catch(() => undefined);
  await Promise.race([browser?.close().catch(() => undefined), wait(2_000)]);
  report.fatal = fatal;
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PHASE 4 PHYSICAL OCR: ${report.status}`);
  console.log(path.join(output, 'report.json'));
  if (fatal || report.status !== 'PASS') process.exitCode = 1;
}
