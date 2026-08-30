import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outputDirectory = path.join(root, 'evidence', 'device-capability-router', 'android', runId);
const adb = path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const apk = path.join(root, 'apps', 'web', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const assetsDirectory = path.join(root, 'apps', 'web', 'dist', 'assets');
const runFile = promisify(execFile);
const report = {
  schemaVersion: 1,
  runId,
  startedAt: new Date().toISOString(),
  runner: 'Physical Android WebView + Capacitor native bridge + controlled CDP',
  status: 'FAIL',
  checks: [],
};
let browser;
let fatal;

await mkdir(outputDirectory, { recursive: true });

try {
  const devices = (await runFile(adb, ['devices', '-l'])).stdout;
  const device = devices.split(/\r?\n/).find((line) => /\sdevice\s/.test(line));
  assert(device, 'ANDROID_DEVICE_NOT_CONNECTED');
  report.device = device.trim();
  report.model = (await runFile(adb, ['shell', 'getprop', 'ro.product.model'])).stdout.trim();
  report.androidVersion = (await runFile(adb, ['shell', 'getprop', 'ro.build.version.release'])).stdout.trim();
  report.package = (await runFile(adb, ['shell', 'dumpsys', 'package', 'com.agm.cockpit'])).stdout
    .match(/versionCode=.*|versionName=.*|lastUpdateTime=.*/g)?.slice(0, 3) ?? [];
  report.apkSha256 = createHash('sha256').update(await readFile(apk)).digest('hex').toUpperCase();

  await runFile(adb, ['logcat', '-c']);
  await runFile(adb, ['shell', 'am', 'force-stop', 'com.agm.cockpit']);
  await runFile(adb, ['shell', 'monkey', '-p', 'com.agm.cockpit', '-c', 'android.intent.category.LAUNCHER', '1']);
  await wait(1800);
  const pid = (await runFile(adb, ['shell', 'pidof', 'com.agm.cockpit'])).stdout.trim().split(/\s+/)[0];
  assert(pid, 'ANDROID_PROCESS_NOT_RUNNING');
  await runFile(adb, ['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`]);
  browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => !candidate.url().includes('sw.js'));
  assert(page, 'ANDROID_WEBVIEW_PAGE_UNAVAILABLE');
  assert(new URL(page.url()).origin === 'https://localhost', `ANDROID_ORIGIN_MISMATCH:${page.url()}`);
  page.setDefaultTimeout(10_000);
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/login')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { accessToken: 'device-router-controlled-token', user: { id: 'device-router-audit', displayName: 'Device Router Audit', email: 'audit@example.test', roles: ['PREMIUM_ACCESS'] } }, requestId: 'device-router-android' }) });
      return;
    }
    if (pathname.endsWith('/auth/entitlements')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { subjectId: 'device-router-audit', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' }, requestId: 'device-router-android' }) });
      return;
    }
    await route.continue();
  });

  const assetFiles = await readdir(assetsDirectory);
  const runtimeAsset = assetFiles.find((name) => /^device-capability\.runtime-.*\.js$/.test(name));
  const translationAsset = assetFiles.find((name) => /^translationAdapter-.*\.js$/.test(name));
  assert(runtimeAsset, 'DEVICE_CAPABILITY_RUNTIME_ASSET_MISSING');
  assert(translationAsset, 'TRANSLATION_ADAPTER_ASSET_MISSING');

  const result = await page.evaluate(async ({ runtimeAsset, translationAsset }) => {
    const native = window.Capacitor?.Plugins?.AgmCapability;
    const audio = window.Capacitor?.Plugins?.AgmAudio;
    if (!native || !audio) throw new Error('CAPACITOR_NATIVE_PLUGINS_UNAVAILABLE');
    const directCapabilityStartedAt = performance.now();
    const nativeCapabilities = await native.getCapabilities();
    const directCapabilityLatencyMs = performance.now() - directCapabilityStartedAt;

    const runtime = await import(`/assets/${runtimeAsset}`);
    sessionStorage.removeItem('agm.device-capabilities.v1');
    window.dispatchEvent(new Event('agm-native-resume'));
    const coldStartedAt = performance.now();
    await runtime.n({ operation: 'TTS', sensitivity: 'USER_TEXT' });
    const coldLookupLatencyMs = performance.now() - coldStartedAt;
    const coldSnapshot = JSON.parse(sessionStorage.getItem('agm.device-capabilities.v1'));
    const warmStartedAt = performance.now();
    await runtime.n({ operation: 'TTS', sensitivity: 'USER_TEXT' });
    const warmLookupLatencyMs = performance.now() - warmStartedAt;
    const warmSnapshot = JSON.parse(sessionStorage.getItem('agm.device-capabilities.v1'));

    const routes = {
      stt: await runtime.n({ operation: 'STT', sensitivity: 'USER_TEXT' }),
      tts: await runtime.n({ operation: 'TTS', sensitivity: 'USER_TEXT' }),
      localTranslation: await runtime.n({ operation: 'SIMPLE_TRANSLATION', sensitivity: 'USER_TEXT', localCandidateAvailable: true }),
      agmReasoning: await runtime.n({ operation: 'AGM_CONTEXT_REASONING', sensitivity: 'PERSONAL', requiresAgmContext: true }),
      externalWithoutConfirmation: await runtime.n({ operation: 'SHARE_CONTEXT', sensitivity: 'USER_TEXT', userConfirmedExternal: false }),
      externalConfirmed: await runtime.n({ operation: 'SHARE_CONTEXT', sensitivity: 'USER_TEXT', userConfirmedExternal: true }),
      sensitiveExternal: await runtime.n({ operation: 'SHARE_CONTEXT', sensitivity: 'DOCUMENT', userConfirmedExternal: true }),
      unsafeReading: await runtime.n({ operation: 'SAFETY_CRITICAL_READING', sensitivity: 'DOCUMENT', localCandidateAvailable: false, userConfirmedAgmTransfer: true, userConfirmedExternal: true }),
    };

    const translation = await import(`/assets/${translationAsset}`);
    const localRuns = [];
    for (let index = 0; index < 5; index += 1) {
      const startedAt = performance.now();
      const value = await translation.translateText({ text: 'AGM latency probe', sourceLanguage: 'en', targetLanguage: 'en' });
      localRuns.push({ latencyMs: performance.now() - startedAt, provider: value.provider, available: value.available });
    }
    const agmStartedAt = performance.now();
    const agmValue = await translation.translateText({ text: 'Driver safety check', sourceLanguage: 'en', targetLanguage: 'de' });
    const agmRun = { latencyMs: performance.now() - agmStartedAt, provider: agmValue.provider, available: agmValue.available };

    let tts;
    const ttsStartedAt = performance.now();
    try {
      await audio.speak({ text: 'AGM local device audio test', language: 'en-US', turnId: `router-test-${Date.now()}` });
      tts = { status: 'PASS', latencyMs: performance.now() - ttsStartedAt };
    } catch (error) {
      tts = { status: 'FAIL', latencyMs: performance.now() - ttsStartedAt, error: String(error) };
    }

    let stt;
    const permission = await audio.checkMicrophonePermission();
    if (permission.state === 'granted') {
      const cycleId = `router-stt-${Date.now()}`;
      const listening = audio.startListening({ language: 'en-US', cycleId, preferOnDevice: true })
        .then((value) => ({ outcome: 'RESULT', value }))
        .catch((error) => ({ outcome: 'CANCELLED', error: String(error) }));
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await audio.stopListening();
      stt = { status: 'PASS', permission: permission.state, result: await listening };
    } else {
      stt = { status: 'FAIL', permission: permission.state };
    }

    return {
      nativeCapabilities,
      directCapabilityLatencyMs,
      coldSnapshot,
      warmSnapshot,
      coldLookupLatencyMs,
      warmLookupLatencyMs,
      routes,
      benchmark: { localRuns, agmRun },
      tts,
      stt,
      metrics: JSON.parse(sessionStorage.getItem('agm.device-router.metrics.v1') ?? '[]'),
      url: location.href,
    };
  }, { runtimeAsset, translationAsset });

  report.runtime = result;
  check('NATIVE_CAPABILITY_DETECTION', Number(result.nativeCapabilities.sdkInt) >= 31 && result.nativeCapabilities.camera === true, result.nativeCapabilities);
  check('CAPABILITY_CACHE', result.coldSnapshot.capturedAtEpochMs === result.warmSnapshot.capturedAtEpochMs && result.warmLookupLatencyMs < result.coldLookupLatencyMs, { coldLookupLatencyMs: result.coldLookupLatencyMs, warmLookupLatencyMs: result.warmLookupLatencyMs });
  check('LOCAL_STT_ROUTE', result.routes.stt.authority === 'LOCAL_DEVICE', result.routes.stt);
  check('LOCAL_STT_EXECUTION', result.stt.status === 'PASS' && result.stt.result?.outcome === 'CANCELLED' && /cancel/i.test(result.stt.result.error ?? ''), result.stt);
  check('LOCAL_TTS_ROUTE', result.routes.tts.authority === 'LOCAL_DEVICE' && result.tts.status === 'PASS', { route: result.routes.tts, execution: result.tts });
  check('LOCAL_TRANSLATION_ROUTE', result.routes.localTranslation.authority === 'LOCAL_DEVICE', result.routes.localTranslation);
  check('AGM_CONTEXT_AUTHORITY', result.routes.agmReasoning.authority === 'AGM_AI', result.routes.agmReasoning);
  check('EXTERNAL_CONFIRMATION_GATE', result.routes.externalWithoutConfirmation.authority === 'UNAVAILABLE' && result.routes.externalConfirmed.authority === 'EXTERNAL_DEVICE_AI', { without: result.routes.externalWithoutConfirmation, confirmed: result.routes.externalConfirmed });
  check('SENSITIVE_EXTERNAL_BLOCK', result.routes.sensitiveExternal.authority === 'UNAVAILABLE', result.routes.sensitiveExternal);
  check('FAIL_CLOSED_SAFETY_READING', result.routes.unsafeReading.authority === 'UNAVAILABLE' && result.routes.unsafeReading.reason === 'SAFETY_CRITICAL_VALUE_CANNOT_BE_READ_SAFELY', result.routes.unsafeReading);
  check('LOCAL_LATENCY_BENCHMARK', result.benchmark.localRuns.every((run) => run.available && run.provider === 'local-fallback'), result.benchmark.localRuns);
  check('AGM_LATENCY_BENCHMARK', result.benchmark.agmRun.available && result.benchmark.agmRun.provider === 'agm-api', result.benchmark.agmRun);

  await page.evaluate(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    localStorage.setItem('agm.premium.single-copilot.enabled', 'true');
    history.pushState({}, '', '/access');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.locator('input[name=email]').fill('audit@example.test');
  await page.locator('input[name=password]').fill('controlled-test-only');
  await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
  await page.evaluate(() => { history.pushState({}, '', '/premium/copilot'); dispatchEvent(new PopStateEvent('popstate')); });
  const draft = 'AGM contextual handoff draft';
  await page.locator('[data-assistant-transcript]').fill(draft);
  await page.locator('[data-android-assistant]').click();
  await wait(700);
  await runFile(adb, ['shell', 'input', 'keyevent', '4']);
  await wait(900);
  const handoff = await page.evaluate((expectedDraft) => ({
    route: location.pathname,
    draft: document.querySelector('[data-assistant-transcript]')?.value,
    pendingContext: sessionStorage.getItem('agm.device-handoff.context.v1'),
  }), draft);
  report.handoff = handoff;
  check('HANDOFF_CONTEXT_RESTORED', handoff.route === '/premium/copilot' && handoff.draft === draft && handoff.pendingContext === null, handoff);

  report.logcat = (await runFile(adb, ['logcat', '-d', '-s', 'AGM-Audio:I', 'Capacitor/Plugin:I', '*:S'])).stdout;
  check('ON_DEVICE_STT_SELECTED', report.logcat.includes('Using Android on-device speech recognizer'), report.logcat);
  check('STT_RUNTIME_FALLBACK', report.logcat.includes('falling back once to Android default service') && report.logcat.includes('Using Android default speech recognition service'), report.logcat);
  const screenshot = await runFile(adb, ['exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
  await writeFile(path.join(outputDirectory, 'physical-android-runtime.png'), screenshot.stdout);
  report.status = report.checks.every((entry) => entry.status === 'PASS') ? 'PASS' : 'FAIL';
} catch (error) {
  fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await runFile(adb, ['forward', '--remove', 'tcp:9222']).catch(() => undefined);
  await Promise.race([browser?.close().catch(() => undefined), wait(2000)]);
  report.fatal = fatal;
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`DEVICE CAPABILITY ROUTER ANDROID: ${report.status}`);
console.log(path.join(outputDirectory, 'report.json'));
if (fatal || report.status !== 'PASS') {
  if (fatal) console.error(fatal);
  process.exitCode = 1;
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function check(id, passed, evidence) {
  report.checks.push({ id, status: passed ? 'PASS' : 'FAIL', evidence });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
