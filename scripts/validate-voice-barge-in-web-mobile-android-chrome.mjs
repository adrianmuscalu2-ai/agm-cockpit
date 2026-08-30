import { chromium } from 'playwright';
import { closeSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const adb = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const serial = 'RFCY70WDHXK';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'voice-barge-in', 'web-mobile-physical', runId);
const expectedAsset = readFileSync(path.join(root, 'apps', 'web', 'dist', 'index.html'), 'utf8').match(/assets\/(main-[^"']+\.js)/)?.[1];
const report = { schemaVersion: 1, runId, status: 'FAIL', device: 'Samsung SM-S931B', serial, browser: 'Chrome Android physical', results: [] };
let server;
let browser;
let page;
let port;

const shell = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' }).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () => new Promise((resolve, reject) => { const socket = net.createServer(); socket.unref(); socket.on('error', reject); socket.listen(0, '127.0.0.1', () => { const address = socket.address(); socket.close(() => resolve(address.port)); }); });
const speechDataUrl = text => {
  const file = path.join(os.tmpdir(), `agm-web-mobile-voice-${process.pid}-${Date.now()}.wav`);
  const escapedFile = file.replaceAll("'", "''");
  const escapedText = text.replaceAll("'", "''");
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `$voice=New-Object -ComObject SAPI.SpVoice; $stream=New-Object -ComObject SAPI.SpFileStream; $stream.Open('${escapedFile}',3,$false); $voice.AudioOutputStream=$stream; $voice.Rate=0; [void]$voice.Speak('${escapedText}'); $stream.Close()`], { encoding: 'utf8', timeout: 30_000 });
  try { return `data:audio/wav;base64,${readFileSync(file).toString('base64')}`; } finally { unlinkSync(file); }
};
const speakFromHost = text => execFileSync('powershell.exe', ['-NoProfile', '-Command', `$voice=New-Object -ComObject SAPI.SpVoice; $voice.Volume=100; $voice.Rate=0; [void]$voice.Speak('${text.replaceAll("'", "''")}')`], { encoding: 'utf8', timeout: 30_000 });
const deviceScreenshot = name => {
  const target = path.join(out, name);
  const fd = openSync(target, 'w');
  try { execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: null, stdio: ['ignore', fd, 'inherit'] }); } finally { closeSync(fd); }
  return path.relative(root, target);
};

await mkdir(out, { recursive: true });
try {
  if (!shell('get-state').includes('device')) throw new Error('Physical Android device unavailable');
  shell('shell', 'pm', 'grant', 'com.android.chrome', 'android.permission.RECORD_AUDIO');
  shell('shell', 'am', 'force-stop', 'com.android.chrome');
  shell('shell', 'am', 'start', '-n', 'com.android.chrome/com.google.android.apps.chrome.Main', '-a', 'android.intent.action.VIEW', '-d', 'https://app.agmcockpit.com/');
  await delay(2500);
  const socket = shell('shell', 'cat', '/proc/net/unix').match(/@(chrome_devtools_remote[^\s]*)/)?.[1];
  if (!socket) throw new Error('Chrome Android DevTools socket unavailable');
  try { shell('forward', '--remove', 'tcp:9225'); } catch {}
  shell('forward', 'tcp:9225', `localabstract:${socket}`);
  browser = await chromium.connectOverCDP('http://127.0.0.1:9225');
  const context = browser.contexts()[0];
  page = context.pages().find(candidate => candidate.url().includes('app.agmcockpit.com')) ?? context.pages()[0];
  if (!page) throw new Error('Chrome Android page unavailable');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  const publicState = await page.evaluate(() => ({ url: location.href, title: document.title, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyText: document.body.innerText.slice(0, 1000), scripts: performance.getEntriesByType('resource').map(entry => entry.name).filter(name => name.includes('/assets/')), serviceWorkersSupported: 'serviceWorker' in navigator }));
  if (!publicState.url.startsWith('https://app.agmcockpit.com/') || !publicState.title || publicState.scrollWidth > publicState.width + 1 || publicState.bodyText.length < 100) throw new Error(`Public mobile page failed: ${JSON.stringify(publicState)}`);
  await page.screenshot({ path: path.join(out, '01-public-mobile-page.png'), fullPage: true });
  report.results.push({ id: 'public-web-mobile-load-responsive', status: 'PASS', ...publicState, deviceScreenshot: deviceScreenshot('01-public-mobile-device.png') });

  port = await freePort();
  const target = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore' });
  for (let attempt = 0; attempt < 80; attempt += 1) { try { if ((await fetch(target)).status === 200) break; } catch {} await delay(150); if (attempt === 79) throw new Error('Current Web preview did not become healthy'); }
  shell('reverse', `tcp:${port}`, `tcp:${port}`);
  await context.grantPermissions(['microphone'], { origin: target });
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    localStorage.setItem('agm.premium.single-copilot.enabled', 'true');
    sessionStorage.setItem('agm.auth.accessToken', 'physical-chrome-voice-token');
    sessionStorage.setItem('agm.profile.preferredLanguage', 'en');
    sessionStorage.setItem('agm.profile.settings', JSON.stringify({ displayName: 'Physical Chrome Validation', preferredLanguage: 'en', favoriteLanguages: ['en', 'ro', 'de'] }));
    sessionStorage.removeItem('agm.premium.assistant.history.v1');
    sessionStorage.removeItem('agm.premium.voice.telemetry.v1');
    const nativeFetch = window.fetch.bind(window);
    const probe = window.__agmPhysicalChromeVoiceProbe = { requests: [], nextUnscripted: null, authorityCounts: [], synthCancels: [] };
    const nativeCancel = window.speechSynthesis?.cancel.bind(window.speechSynthesis);
    if (nativeCancel) window.speechSynthesis.cancel = () => { probe.synthCancels.push({ at: performance.now() }); nativeCancel(); };
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/auth/entitlements')) return new Response(JSON.stringify({ data: { subjectId: 'physical-chrome-owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' } }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (!url.includes('/premium-assistant/respond')) return nativeFetch(input, init);
      const request = JSON.parse(String(init?.body || '{}'));
      const actualText = request.confirmedText || '';
      const scripted = probe.nextUnscripted && !actualText.includes('WEB_TTS_OLD') ? probe.nextUnscripted : actualText;
      if (scripted === probe.nextUnscripted) probe.nextUnscripted = null;
      probe.requests.push({ actualText, scripted, at: performance.now() });
      const answer = scripted.includes('WEB_TTS_OLD') ? 'This old browser answer must stop now and never return after the new mobile question starts.' : 'CURRENT PHYSICAL CHROME VOICE ANSWER';
      await new Promise(resolve => setTimeout(resolve, 70));
      return new Response(JSON.stringify({ data: { contractVersion: 'premium-assistant.v1', kind: 'answer', text: answer, provider: 'openai', productId: 'agm-cockpit', moduleId: 'premium-cockpit', contextRefs: [], externalEffectPerformed: false, timing: { orchestratorMs: 8, modelMs: 62, serverTotalMs: 70 } } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    addEventListener('DOMContentLoaded', () => new MutationObserver(() => probe.authorityCounts.push(document.querySelectorAll('[data-active-voice-turn]').length)).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-active-voice-turn'] }));
  });
  await page.goto(`${target}/access?build=${encodeURIComponent(expectedAsset || 'unknown')}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
  await page.evaluate(() => { history.pushState({}, '', '/premium/copilot'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.locator('[data-premium-copilot]').waitFor({ state: 'visible' });
  const buildState = await page.evaluate(expected => ({ expected, loadedAssets: performance.getEntriesByType('resource').map(entry => entry.name).filter(name => name.includes('/assets/main-')), width: innerWidth, scrollWidth: document.documentElement.scrollWidth, speechRecognition: typeof (window.SpeechRecognition || window.webkitSpeechRecognition), speechSynthesis: typeof window.speechSynthesis, microphone: navigator.permissions ? 'queried-by-runner' : 'unsupported' }), expectedAsset);
  if (!expectedAsset || !buildState.loadedAssets.some(asset => asset.endsWith(expectedAsset)) || buildState.scrollWidth > buildState.width + 1 || buildState.speechRecognition !== 'function' || buildState.speechSynthesis !== 'object') throw new Error(`Current mobile build/runtime mismatch: ${JSON.stringify(buildState)}`);

  const ask = async text => { await page.locator('[data-assistant-transcript]').fill(text); await page.locator('[data-assistant-confirm]').evaluate(button => button.click()); };
  await ask('WEB_TTS_OLD');
  await page.waitForFunction(() => document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state') === 'SPEAKING', null, { timeout: 15_000 });
  await page.evaluate(() => { window.__agmPhysicalChromeVoiceProbe.nextUnscripted = 'VOICE_NEW'; });
  const cancelCountBefore = await page.evaluate(() => window.__agmPhysicalChromeVoiceProbe.synthCancels.length);
  await page.locator('[data-assistant-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state') === 'LISTENING', null, { timeout: 12_000 });
  try { speakFromHost('hello there'); } catch { console.log('HOST_SPEECH_INJECTION_UNAVAILABLE'); }
  try {
    await page.waitForFunction(() => window.__agmPhysicalChromeVoiceProbe.requests.some(row => row.scripted === 'VOICE_NEW'), null, { timeout: 8_000 });
  } catch {
    try {
      const source = speechDataUrl('hello there');
      await page.evaluate(async audioSource => { const audio = new Audio(audioSource); audio.volume = 1; await new Promise((resolve, reject) => { audio.onended = resolve; audio.onerror = () => reject(new Error('Mobile browser test audio failed')); void audio.play().catch(reject); }); }, source);
    } catch { console.log('DEVICE_SPEECH_INJECTION_UNAVAILABLE'); }
    try {
      await page.waitForFunction(() => window.__agmPhysicalChromeVoiceProbe.requests.some(row => row.scripted === 'VOICE_NEW'), null, { timeout: 8_000 });
    } catch {
      console.log('WAITING_FOR_HUMAN_SPEECH: say "hello there" near Samsung SM-S931B now');
      await page.waitForFunction(() => window.__agmPhysicalChromeVoiceProbe.requests.some(row => row.scripted === 'VOICE_NEW'), null, { timeout: 120_000 });
    }
  }
  await page.waitForFunction(() => document.querySelector('[data-assistant-response]')?.textContent === 'CURRENT PHYSICAL CHROME VOICE ANSWER', null, { timeout: 20_000 });
  const voiceState = await page.evaluate(() => { const telemetry = JSON.parse(sessionStorage.getItem('agm.premium.voice.telemetry.v1') || '[]'); const bargeIn = telemetry.findLast(row => row.kind === 'barge-in' && row.platform === 'browser'); const interrupt = telemetry.findLast(row => row.kind === 'interrupt' && row.reason === 'microphone-barge-in'); return { transcript: document.querySelector('[data-assistant-transcript]')?.value, response: document.querySelector('[data-assistant-response]')?.textContent, bargeIn, interrupt, synthCancelCount: window.__agmPhysicalChromeVoiceProbe.synthCancels.length, maxAuthorityCount: Math.max(0, ...window.__agmPhysicalChromeVoiceProbe.authorityCounts), currentAuthorityCount: document.querySelectorAll('[data-active-voice-turn]').length }; });
  if (!voiceState.bargeIn || voiceState.bargeIn.newSpeechDetectedToOldAudioStopMs > 100 || voiceState.interrupt?.audioQueueFlushed !== true || voiceState.synthCancelCount <= cancelCountBefore || voiceState.maxAuthorityCount > 1 || voiceState.currentAuthorityCount > 1) throw new Error(`Physical Chrome voice barge-in failed: ${JSON.stringify(voiceState)}`);
  await page.screenshot({ path: path.join(out, '02-current-build-mobile-voice.png'), fullPage: true });
  report.results.push({ id: 'current-build-no-old-cache', status: 'PASS', ...buildState, serviceWorkerScope: await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.() ?? []).map(registration => registration.scope)), deviceScreenshot: deviceScreenshot('02-current-build-device.png') });
  report.results.push({ id: 'physical-chrome-mobile-voice-barge-in', status: 'PASS', ...voiceState });
  report.status = 'PASS';
} catch (error) {
  report.fatal = String(error?.stack || error);
  try { if (page) { report.failureState = await page.evaluate(() => ({ url: location.href, title: document.title, body: document.body.innerText.slice(0, 1500), state: document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state'), status: document.querySelector('[data-assistant-status]')?.textContent, response: document.querySelector('[data-assistant-response]')?.textContent, telemetry: sessionStorage.getItem('agm.premium.voice.telemetry.v1') })); await page.screenshot({ path: path.join(out, 'FAIL-browser.png'), fullPage: true }); } } catch {}
} finally {
  await browser?.close();
  if (server) server.kill();
  try { shell('forward', '--remove', 'tcp:9225'); } catch {}
  if (port) try { shell('reverse', '--remove', `tcp:${port}`); } catch {}
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`VOICE BARGE-IN WEB MOBILE PHYSICAL: ${report.status}`);
  console.log(path.join(out, 'report.json'));
  if (report.status !== 'PASS') { console.error(report.fatal); process.exitCode = 1; }
}
