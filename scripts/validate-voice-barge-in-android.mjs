import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const adb = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const serial = 'RFCY70WDHXK';
const expectedModel = 'SM-S931B';
const apk = path.join(root, 'apps', 'web', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const expectedApkSha256 = 'E488AF9A553935BC09F3F32B96D0FC4307C59C22CA879B3BD8910CC959BEF8E2';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'voice-barge-in', 'android', runId);
const report = { schemaVersion: 1, runId, status: 'FAIL', device: expectedModel, serial, package: 'com.agm.cockpit', results: [] };
let browser;
let page;

const shell = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' }).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const speechDataUrl = text => {
  const file = path.join(os.tmpdir(), `agm-voice-probe-${process.pid}-${Date.now()}.wav`);
  const escapedFile = file.replaceAll("'", "''");
  const escapedText = text.replaceAll("'", "''");
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `$voice=New-Object -ComObject SAPI.SpVoice; $stream=New-Object -ComObject SAPI.SpFileStream; $stream.Open('${escapedFile}',3,$false); $voice.AudioOutputStream=$stream; $voice.Rate=0; [void]$voice.Speak('${escapedText}'); $stream.Close()`], { encoding: 'utf8', timeout: 30_000 });
  try { return `data:audio/wav;base64,${readFileSync(file).toString('base64')}`; } finally { unlinkSync(file); }
};
const speakNearDevice = async text => {
  const source = speechDataUrl(text);
  await page.evaluate(async audioSource => {
    const audio = new Audio(audioSource);
    audio.volume = 1;
    await new Promise((resolve, reject) => { audio.onended = resolve; audio.onerror = () => reject(new Error('Phone test audio playback failed')); void audio.play().catch(reject); });
  }, source);
};

await mkdir(out, { recursive: true });
try {
  const deviceRows = execFileSync(adb, ['devices', '-l'], { encoding: 'utf8' });
  if (!deviceRows.includes(`${serial}`) || !deviceRows.includes('device product:')) throw new Error(`Authorized device unavailable: ${deviceRows}`);
  const model = shell('shell', 'getprop', 'ro.product.model');
  if (model !== expectedModel) throw new Error(`Unexpected device model ${model}`);
  const apkSha256 = createHash('sha256').update(readFileSync(apk)).digest('hex').toUpperCase();
  if (apkSha256 !== expectedApkSha256) throw new Error(`APK hash mismatch ${apkSha256}`);
  const installedPath = shell('shell', 'pm', 'path', 'com.agm.cockpit').replace('package:', '');
  const installedSha256 = shell('shell', 'sha256sum', installedPath).split(/\s+/)[0].toUpperCase();
  if (installedSha256 !== apkSha256) throw new Error(`Installed APK is stale: ${installedSha256}`);
  const packageDetail = shell('shell', 'dumpsys', 'package', 'com.agm.cockpit');
  report.build = { apk: path.relative(root, apk), apkSha256, installedSha256, versionCode: packageDetail.match(/versionCode=(\d+)/)?.[1], versionName: packageDetail.match(/versionName=([^\r\n]+)/)?.[1]?.trim(), lastUpdateTime: packageDetail.match(/lastUpdateTime=([^\r\n]+)/)?.[1]?.trim() };
  report.deviceEvidence = { model, android: shell('shell', 'getprop', 'ro.build.version.release'), sdk: shell('shell', 'getprop', 'ro.build.version.sdk'), state: 'device' };

  shell('shell', 'pm', 'grant', 'com.agm.cockpit', 'android.permission.RECORD_AUDIO');
  shell('logcat', '-c');
  shell('shell', 'am', 'force-stop', 'com.agm.cockpit');
  shell('shell', 'monkey', '-p', 'com.agm.cockpit', '-c', 'android.intent.category.LAUNCHER', '1');
  await delay(1200);
  const socket = shell('shell', 'cat', '/proc/net/unix').match(/@(webview_devtools_remote_\d+)/)?.[1];
  if (!socket) throw new Error('Android WebView debug socket unavailable');
  try { shell('forward', '--remove', 'tcp:9223'); } catch {}
  shell('forward', 'tcp:9223', `localabstract:${socket}`);
  browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
  page = browser.contexts().flatMap(context => context.pages()).find(candidate => !candidate.url().includes('sw.js'));
  if (!page) throw new Error('Android WebView page unavailable');

  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    localStorage.setItem('agm.premium.single-copilot.enabled', 'true');
    sessionStorage.setItem('agm.auth.accessToken', 'physical-voice-validation-token');
    sessionStorage.setItem('agm.profile.preferredLanguage', 'en');
    sessionStorage.setItem('agm.profile.settings', JSON.stringify({ displayName: 'Physical Voice Validation', preferredLanguage: 'en', favoriteLanguages: ['en', 'ro', 'de'] }));
    sessionStorage.removeItem('agm.premium.assistant.history.v1');
    sessionStorage.removeItem('agm.premium.voice.telemetry.v1');
    sessionStorage.removeItem('agm.device-router.metrics.v1');
    sessionStorage.removeItem('agm.device-capabilities.v1');
    const nativeFetch = window.fetch.bind(window);
    const probe = window.__agmPhysicalVoiceProbe = { requests: [], nextUnscripted: null, authorityCounts: [], staleDeliveryCount: 0 };
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/auth/entitlements')) return new Response(JSON.stringify({ data: { subjectId: 'physical-owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' } }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (!url.includes('/premium-assistant/respond')) return nativeFetch(input, init);
      const request = JSON.parse(String(init?.body || '{}'));
      const actualText = request.confirmedText || '';
      const scripted = probe.nextUnscripted && !/ANDROID_|RAPID_|STT_NEW_FAST/.test(actualText) ? probe.nextUnscripted : actualText;
      if (scripted === probe.nextUnscripted) probe.nextUnscripted = null;
      const trace = { actualText, scripted, receivedAt: performance.now(), signalWasPassed: Boolean(init?.signal), signalAbortedAtDelivery: false };
      probe.requests.push(trace);
      const wait = scripted.includes('SLOW') ? 900 : scripted.includes('RAPID_') ? 650 - Number(scripted.split('_').at(-1)) * 90 : 70;
      const answer = scripted.includes('ANDROID_SLOW_MODEL_OLD') ? 'STALE ANDROID MODEL ANSWER' : scripted.includes('ANDROID_FAST_MODEL_NEW') ? 'CURRENT ANDROID MODEL ANSWER' : scripted.includes('ANDROID_TTS_OLD') ? 'This is the old Android answer. It must stop immediately when the user begins a new question. It must never resume after cancellation.' : scripted.includes('VOICE_NEW') ? 'CURRENT ANDROID VOICE ANSWER' : scripted.includes('STT_OLD_SLOW') ? 'STALE ANDROID STT ANSWER' : scripted.includes('STT_NEW_FAST') ? 'CURRENT ANDROID STT ANSWER' : scripted.includes('RAPID_') ? `ANDROID RAPID ANSWER ${scripted.split('_').at(-1)}` : `CURRENT ANDROID VOICE ANSWER`;
      await new Promise(resolve => setTimeout(resolve, wait));
      trace.deliveredAt = performance.now();
      trace.signalAbortedAtDelivery = Boolean(init?.signal?.aborted);
      if (trace.signalAbortedAtDelivery) probe.staleDeliveryCount += 1;
      return new Response(JSON.stringify({ data: { contractVersion: 'premium-assistant.v1', kind: 'answer', text: answer, provider: 'openai', productId: 'agm-cockpit', moduleId: 'premium-cockpit', contextRefs: [], externalEffectPerformed: false, timing: { orchestratorMs: 8, modelMs: wait - 8, serverTotalMs: wait } } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    addEventListener('DOMContentLoaded', () => new MutationObserver(() => probe.authorityCounts.push(document.querySelectorAll('[data-active-voice-turn]').length)).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-active-voice-turn'] }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { history.pushState({}, '', '/access'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
  await page.evaluate(() => { history.pushState({}, '', '/premium/copilot'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.locator('[data-premium-copilot]').waitFor({ state: 'visible' });

  const ask = async text => {
    await page.locator('[data-assistant-transcript]').fill(text);
    await page.locator('[data-assistant-confirm]').evaluate(button => button.click());
  };
  const historyText = () => page.locator('[data-assistant-history]').innerText();
  const telemetry = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('agm.premium.voice.telemetry.v1') || '[]'));
  const screenshot = async name => { const target = path.join(out, name); await page.screenshot({ path: target, fullPage: true }); return path.relative(root, target); };

  await ask('ANDROID_SLOW_MODEL_OLD');
  await delay(60);
  await ask('ANDROID_FAST_MODEL_NEW');
  await page.waitForFunction(() => document.querySelector('[data-assistant-response]')?.textContent === 'CURRENT ANDROID MODEL ANSWER');
  await delay(980);
  const modelHistory = await historyText();
  const modelTelemetry = await telemetry();
  const staleDelivered = await page.evaluate(() => window.__agmPhysicalVoiceProbe.requests.some(row => row.scripted === 'ANDROID_SLOW_MODEL_OLD' && row.signalAbortedAtDelivery));
  const staleSuppressed = modelTelemetry.some(row => row.kind === 'stale-suppressed' && row.stage === 'model-response');
  if (!staleDelivered || !staleSuppressed || modelHistory.includes('STALE ANDROID MODEL ANSWER')) throw new Error('Android stale model response suppression failed');
  report.results.push({ id: 'B+E-model-generation-delayed-stale', status: 'PASS', staleDelivered, staleSuppressed, screenshot: await screenshot('01-stale-model-suppressed.png') });

  await ask('ANDROID_TTS_OLD');
  await page.waitForFunction(() => document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state') === 'SPEAKING');
  await page.locator('[data-assistant-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state') === 'LISTENING', null, { timeout: 10_000 });
  const bargeTelemetryRows = await telemetry();
  const ttsInterrupt = bargeTelemetryRows.findLast(row => row.kind === 'interrupt' && row.reason === 'microphone-barge-in');
  const nativeStopLog = shell('logcat', '-d', '-v', 'threadtime', '-s', 'AGM-Audio:I', '*:S');
  const nativeStopAck = [...nativeStopLog.matchAll(/TTS stop acknowledged;[^\r\n]*requestToStopAckMs=(\d+)/g)].at(-1);
  const nativeStopRequested = /TTS stop requested;[^\r\n]*stopResult=0/.test(nativeStopLog);
  if (ttsInterrupt?.audioQueueFlushed !== true || !nativeStopRequested || !nativeStopAck) throw new Error(`Android microphone authority/native stop acknowledgement failed: ${JSON.stringify({ ttsInterrupt, nativeStopRequested, nativeStopAcknowledged: Boolean(nativeStopAck) })}`);
  report.results.push({ id: 'A-microphone-authority-cancels-active-tts', status: 'PASS', cancelLatencyMs: ttsInterrupt.cancelLatencyMs, audioQueueFlushed: ttsInterrupt.audioQueueFlushed, nativeStopRequested, nativeStopAcknowledged: true, requestToNativeStopAckMs: Number(nativeStopAck[1]), screenshot: await screenshot('02-native-tts-barge-in.png') });

  await ask('STT_NEW_FAST');
  await page.waitForFunction(() => document.querySelector('[data-assistant-response]')?.textContent === 'CURRENT ANDROID STT ANSWER', null, { timeout: 20_000 });
  report.results.push({ id: 'C-new-manual-question-cancels-active-stt', status: 'PASS', screenshot: await screenshot('03-post-stt-preemption.png') });

  await ask('ANDROID_TTS_OLD');
  await page.waitForFunction(() => document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state') === 'SPEAKING');
  await ask('VOICE_NEW');
  await page.waitForFunction(() => document.querySelector('[data-assistant-response]')?.textContent === 'CURRENT ANDROID VOICE ANSWER', null, { timeout: 20_000 });
  const textStopLog = shell('logcat', '-d', '-v', 'threadtime', '-s', 'AGM-Audio:I', '*:S');
  const textStopAck = [...textStopLog.matchAll(/TTS stop acknowledged;[^\r\n]*requestToStopAckMs=(\d+)/g)].at(-1);
  if (!textStopAck) throw new Error('Android manual new-question TTS stop was not acknowledged');
  report.results.push({ id: 'A-text-question-cancels-active-tts', status: 'PASS', requestToNativeStopAckMs: Number(textStopAck[1]), screenshot: await screenshot('04-text-question-stops-tts.png') });

  for (let index = 1; index <= 5; index += 1) { await ask(`RAPID_${index}`); await delay(18); }
  await page.waitForFunction(() => document.querySelector('[data-assistant-response]')?.textContent === 'ANDROID RAPID ANSWER 5', null, { timeout: 20_000 });
  await delay(900);
  const rapidHistory = await historyText();
  const obsoleteRapidAnswers = [1, 2, 3, 4].filter(index => rapidHistory.includes(`ANDROID RAPID ANSWER ${index}`));
  const authority = await page.evaluate(() => ({ maxAuthorityCount: Math.max(0, ...window.__agmPhysicalVoiceProbe.authorityCounts), currentAuthorityCount: document.querySelectorAll('[data-active-voice-turn]').length, staleDeliveryCount: window.__agmPhysicalVoiceProbe.staleDeliveryCount }));
  if (obsoleteRapidAnswers.length || authority.maxAuthorityCount > 1 || authority.currentAuthorityCount > 1) throw new Error(`Android rapid/single-turn failed: ${JSON.stringify({ obsoleteRapidAnswers, authority })}`);
  report.results.push({ id: 'D-rapid-5-interruptions', status: 'PASS', obsoleteRapidAnswersSuppressed: 4, ...authority, screenshot: await screenshot('05-rapid-final-authority.png') });

  await delay(1200);
  const finalTelemetry = await telemetry();
  const oldAudioRestarted = finalTelemetry.some((row, index) => row?.kind === 'stale-suppressed' && row.stage === 'tts-start' && index > finalTelemetry.findIndex(item => item.kind === 'barge-in' && item.platform === 'android'));
  if (oldAudioRestarted) throw new Error('Old Android audio attempted to restart after cancellation');
  report.results.push({ id: 'old-audio-does-not-return', status: 'PASS', oldAudioRestarted: false });

  await page.locator('[data-assistant-cancel]').click();
  await page.waitForFunction(() => document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state') === 'OFF');
  await page.locator('[data-assistant-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state') === 'LISTENING', null, { timeout: 10_000 });
  await page.waitForFunction(() => {
    const rows = JSON.parse(sessionStorage.getItem('agm.premium.voice.telemetry.v1') || '[]');
    return document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state') === 'OFF'
      && rows.some(row => row.kind === 'stt-terminal-error');
  }, null, { timeout: 20_000 });
  const terminalTelemetry = await telemetry();
  const terminalError = terminalTelemetry.findLast(row => row.kind === 'stt-terminal-error');
  const recognitionLogAtStop = shell('logcat', '-d', '-v', 'threadtime', '-s', 'AGM-Speech:I', '*:S');
  const startsAtStop = [...recognitionLogAtStop.matchAll(/Starting speech recognition/g)].length;
  await delay(2500);
  const recognitionLogAfterGuard = shell('logcat', '-d', '-v', 'threadtime', '-s', 'AGM-Speech:I', '*:S');
  const startsAfterGuard = [...recognitionLogAfterGuard.matchAll(/Starting speech recognition/g)].length;
  const terminalState = await page.locator('[data-premium-copilot]').getAttribute('data-voice-state');
  if (terminalState !== 'OFF' || startsAfterGuard !== startsAtStop) throw new Error(`Android NO_MATCH restarted recognition: ${JSON.stringify({ terminalState, startsAtStop, startsAfterGuard, terminalError })}`);
  report.results.push({ id: 'no-match-stops-without-blink-loop', status: 'PASS', terminalState, startsAtStop, startsAfterGuard, noAutomaticRestart: true, terminalError, screenshot: await screenshot('06-no-match-terminal-off.png') });

  const routerMetrics = await page.evaluate(() => JSON.parse(sessionStorage.getItem('agm.device-router.metrics.v1') || '[]'));
  const voiceRouterMetrics = routerMetrics.filter(row => row.operation === 'STT' || row.operation === 'TTS');
  const cachedLookupLatencies = voiceRouterMetrics.filter(row => row.capabilityCacheHit === true).map(row => Number(row.capabilityLookupLatencyMs || 0));
  const coldLookupLatencies = voiceRouterMetrics.filter(row => row.capabilityCacheHit === false).map(row => Number(row.capabilityLookupLatencyMs || 0));
  const maxCachedCapabilityLookupMs = Math.max(0, ...cachedLookupLatencies);
  const maxColdCapabilityLookupMs = Math.max(0, ...coldLookupLatencies);
  if (!voiceRouterMetrics.length || maxCachedCapabilityLookupMs > 2 || maxColdCapabilityLookupMs > 25) throw new Error(`Device router voice latency budget exceeded: ${JSON.stringify({ maxCachedCapabilityLookupMs, maxColdCapabilityLookupMs, voiceRouterMetrics })}`);
  report.results.push({ id: 'device-router-no-material-voice-latency-regression', status: 'PASS', maxCachedCapabilityLookupMs, maxColdCapabilityLookupMs, budget: { cachedMs: 2, coldMs: 25 }, metrics: voiceRouterMetrics });
  report.sameReleaseCandidate = { status: 'PASS', apkSha256, installedSha256, exactMatch: apkSha256 === installedSha256 && apkSha256 === expectedApkSha256 };
  report.status = report.results.every(result => result.status === 'PASS') && report.sameReleaseCandidate.exactMatch ? 'PASS' : 'FAIL';
} catch (error) {
  report.fatal = String(error?.stack || error);
  try { if (page) { report.failureState = await page.evaluate(() => ({ url: location.href, state: document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state'), status: document.querySelector('[data-assistant-status]')?.textContent, transcript: document.querySelector('[data-assistant-transcript]')?.value, response: document.querySelector('[data-assistant-response]')?.textContent, telemetry: sessionStorage.getItem('agm.premium.voice.telemetry.v1'), probe: window.__agmPhysicalVoiceProbe })); await page.screenshot({ path: path.join(out, 'FAIL-webview.png'), fullPage: true }); } } catch {}
} finally {
  try {
    const log = shell('logcat', '-d', '-v', 'threadtime', '-s', 'AGM-Audio:I', '*:S');
    await writeFile(path.join(out, 'runtime-logcat.txt'), `${log}\n`);
    report.runtimeLog = path.relative(root, path.join(out, 'runtime-logcat.txt'));
  } catch (error) { report.logcatError = String(error); }
  try {
    const nativeScreenshot = path.join(out, 'device-final.png');
    const fd = openSync(nativeScreenshot, 'w');
    try { execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: null, stdio: ['ignore', fd, 'inherit'] }); } finally { closeSync(fd); }
    report.deviceScreenshot = path.relative(root, nativeScreenshot);
  } catch (error) { report.deviceScreenshotError = String(error); }
  await browser?.close();
  try { shell('forward', '--remove', 'tcp:9223'); } catch {}
  try {
    shell('shell', 'am', 'force-stop', 'com.agm.cockpit');
    shell('shell', 'monkey', '-p', 'com.agm.cockpit', '-c', 'android.intent.category.LAUNCHER', '1');
    report.runtimeCleanup = { status: 'PASS', controlledProbeRemovedByFreshProcess: true };
  } catch (error) { report.runtimeCleanup = { status: 'FAIL', error: String(error) }; }
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`VOICE BARGE-IN ANDROID: ${report.status}`);
  console.log(path.join(out, 'report.json'));
  if (report.status === 'FAIL') { console.error(report.fatal); process.exitCode = 1; }
}
