import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'voice-barge-in', 'browser', runId);
const report = {
  schemaVersion: 1,
  runId,
  status: 'FAIL',
  runner: 'Controlled AGM Playwright/Chromium',
  browserContract: {
    plugin: 'PASS',
    integratedControl: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    session: 'PENDING',
    target: 'PENDING',
  },
  viewports: [],
};
let server;
let browser;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () => new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.unref();
  socket.on('error', reject);
  socket.listen(0, '127.0.0.1', () => { const address = socket.address(); socket.close(() => resolve(address.port)); });
});

await mkdir(out, { recursive: true });
try {
  const port = await freePort();
  const target = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore' });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(target)).status === 200) break; } catch {}
    await delay(150);
    if (attempt === 79) throw new Error('Preview target did not become healthy');
  }

  browser = await chromium.launch({ headless: true });
  report.browserContract.session = 'PASS';
  for (const profile of [
    { id: 'desktop', viewport: { width: 1440, height: 1000 }, mobile: false },
    { id: 'mobile', viewport: { width: 412, height: 915 }, mobile: true },
  ]) {
    const context = await browser.newContext({ viewport: profile.viewport, isMobile: profile.mobile });
    const page = await context.newPage();
    const consoleMessages = [];
    page.on('console', message => consoleMessages.push({ type: message.type(), text: message.text() }));
    await page.addInitScript(() => {
      localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
      localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
      localStorage.setItem('agm.premium.single-copilot.enabled', 'true');
      const probe = window.__agmVoiceBargeInProbe = {
        recognitions: [], activeRecognition: null, recognitionActiveCount: 0, maxRecognitionActiveCount: 0,
        speechStarts: [], speechEnds: [], results: [], cancels: [], audioStarts: [], activeAudio: null, maxActiveAudioCount: 0,
        requests: [], maxActiveAuthorityMarkers: 0,
      };
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        if (!url.includes('/premium-assistant/respond')) return originalFetch(input, init);
        const request = JSON.parse(String(init?.body || '{}'));
        const text = request.confirmedText || '';
        const trace = { text, receivedAt: performance.now(), signalWasPassed: Boolean(init?.signal), signalAbortedAtDelivery: false };
        probe.requests.push(trace);
        const wait = text.includes('SLOW') ? 700 : text.includes('RAPID_') ? 520 - Number(text.split('_').at(-1)) * 70 : 55;
        const answer = text.includes('SLOW_MODEL_OLD') ? 'STALE MODEL ANSWER' : text.includes('FAST_MODEL_NEW') ? 'CURRENT MODEL ANSWER' : text.includes('TTS_OLD') ? 'OLD AUDIO LONG ANSWER' : text.includes('VOICE_NEW') ? 'VOICE NEW ANSWER' : text.includes('STT_OLD_SLOW') ? 'STALE STT ANSWER' : text.includes('STT_NEW_FAST') ? 'CURRENT STT ANSWER' : text.includes('RAPID_') ? `RAPID ANSWER ${text.split('_').at(-1)}` : `ANSWER ${text}`;
        await new Promise(resolve => setTimeout(resolve, wait));
        trace.deliveredAt = performance.now();
        trace.signalAbortedAtDelivery = Boolean(init?.signal?.aborted);
        return new Response(JSON.stringify({ data: { contractVersion: 'premium-assistant.v1', kind: 'answer', text: answer, provider: 'openai', productId: 'agm-cockpit', moduleId: 'premium-cockpit', contextRefs: [], externalEffectPerformed: false, timing: { orchestratorMs: 7, modelMs: wait - 7, serverTotalMs: wait } }, requestId: `controlled-${Date.now()}` }), { status: 200, headers: { 'content-type': 'application/json' } });
      };
      class FakeUtterance { constructor(text) { this.text = text; this.lang = ''; this.onstart = null; this.onend = null; this.onerror = null; } }
      const fakeSynthesis = {
        cancel() {
          probe.cancels.push({ at: performance.now(), text: probe.activeAudio?.text || null });
          probe.activeAudio = null;
        },
        speak(utterance) {
          probe.activeAudio = utterance;
          probe.maxActiveAudioCount = Math.max(probe.maxActiveAudioCount, probe.activeAudio ? 1 : 0);
          setTimeout(() => {
            if (probe.activeAudio !== utterance) return;
            probe.audioStarts.push({ at: performance.now(), text: utterance.text });
            utterance.onstart?.();
          }, 8);
        },
        pause() {}, resume() {}, getVoices() { return []; }, speaking: false, pending: false, paused: false,
      };
      class FakeRecognition {
        constructor() { this.lang = ''; this.interimResults = false; this.continuous = false; this.onresult = null; this.onerror = null; this.onend = null; this.onspeechstart = null; this.onspeechend = null; this.active = false; }
        start() { this.active = true; probe.recognitions.push(this); probe.activeRecognition = this; probe.recognitionActiveCount += 1; probe.maxRecognitionActiveCount = Math.max(probe.maxRecognitionActiveCount, probe.recognitionActiveCount); }
        stop() { this.abort(); }
        abort() { if (this.active) { this.active = false; probe.recognitionActiveCount -= 1; } if (probe.activeRecognition === this) probe.activeRecognition = null; this.onend?.(); }
      }
      probe.fireSpeechStart = () => { const current = probe.activeRecognition; if (!current) throw new Error('No active recognition'); const at = performance.now(); probe.speechStarts.push(at); current.onspeechstart?.(); return at; };
      probe.fireSpeechEnd = () => { const current = probe.activeRecognition; if (!current) throw new Error('No active recognition'); const at = performance.now(); probe.speechEnds.push(at); current.onspeechend?.(); return at; };
      probe.fireResult = text => { const current = probe.activeRecognition; if (!current) throw new Error('No active recognition'); current.active = false; probe.recognitionActiveCount -= 1; probe.activeRecognition = null; probe.results.push({ at: performance.now(), text }); current.onresult?.({ results: [[{ transcript: text }]] }); current.onend?.(); };
      Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
      Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: FakeRecognition });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: fakeSynthesis });
      addEventListener('DOMContentLoaded', () => {
        new MutationObserver(() => { const count = document.querySelectorAll('[data-active-voice-turn]').length; probe.maxActiveAuthorityMarkers = Math.max(probe.maxActiveAuthorityMarkers, count); }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-active-voice-turn'] });
      });
    });
    await page.route('**/api/v1/**', async route => {
      const url = route.request().url();
      if (url.endsWith('/auth/login')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { accessToken: 'controlled-voice-token', user: { id: 'owner', displayName: 'Owner', email: 'owner@example.test', roles: ['PREMIUM_ACCESS'] } } }) });
      if (url.endsWith('/auth/entitlements')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { subjectId: 'owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' } }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    });
    await page.goto(`${target}/access`, { waitUntil: 'networkidle' });
    await page.locator('input[name=email]').fill('owner@example.test');
    await page.locator('input[name=password]').fill('not-a-real-secret');
    await page.locator('[data-access-login]').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
    await page.evaluate(() => { history.pushState({}, '', '/premium/copilot'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.locator('[data-premium-copilot]').waitFor({ state: 'visible' });
    report.browserContract.target = 'PASS';

    const ask = async text => {
      await page.locator('[data-assistant-transcript]').fill(text);
      await page.locator('[data-assistant-confirm]').evaluate(button => button.click());
    };
    const telemetry = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('agm.premium.voice.telemetry.v1') || '[]'));
    const history = () => page.locator('[data-assistant-history]').innerText();
    const result = { id: profile.id, status: 'FAIL', scenarios: [] };

    await ask('SLOW_MODEL_OLD');
    await delay(45);
    await ask('FAST_MODEL_NEW');
    await page.waitForFunction(() => document.querySelector('[data-assistant-response]')?.textContent === 'CURRENT MODEL ANSWER');
    await delay(760);
    const modelHistory = await history();
    const modelTelemetry = await telemetry();
    const staleModel = modelTelemetry.some(row => row.kind === 'stale-suppressed' && row.stage === 'model-response');
    const delayedAbortedDelivery = await page.evaluate(() => window.__agmVoiceBargeInProbe.requests.some(row => row.text === 'SLOW_MODEL_OLD' && row.signalWasPassed && row.signalAbortedAtDelivery));
    if (modelHistory.includes('STALE MODEL ANSWER') || !modelHistory.includes('CURRENT MODEL ANSWER') || !staleModel || !delayedAbortedDelivery) throw new Error(`${profile.id}: stale model suppression failed`);
    result.scenarios.push({ id: 'B+E-model-generation-and-delayed-stale-response', status: 'PASS', staleModelSuppressed: staleModel, delayedResponseArrivedAfterAbort: delayedAbortedDelivery });

    await ask('TTS_OLD');
    await page.waitForFunction(() => document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state') === 'SPEAKING' && window.__agmVoiceBargeInProbe.activeAudio?.text === 'OLD AUDIO LONG ANSWER');
    const beforeBargeIn = await page.evaluate(() => ({ cancels: window.__agmVoiceBargeInProbe.cancels.length, oldText: window.__agmVoiceBargeInProbe.activeAudio.text }));
    await page.locator('[data-assistant-start]').click();
    await page.waitForFunction(() => Boolean(window.__agmVoiceBargeInProbe.activeRecognition));
    const speechStartAt = await page.evaluate(() => window.__agmVoiceBargeInProbe.fireSpeechStart());
    const cancellation = await page.evaluate(startAt => { const events = window.__agmVoiceBargeInProbe.cancels; const event = [...events].reverse().find(row => row.text === 'OLD AUDIO LONG ANSWER'); return { cancelCount: events.length, stoppedAt: event?.at, latencyMs: event ? Math.max(0, event.at - startAt) : null, activeAudio: window.__agmVoiceBargeInProbe.activeAudio?.text || null }; }, speechStartAt);
    if (cancellation.cancelCount <= beforeBargeIn.cancels || cancellation.activeAudio !== null || cancellation.latencyMs === null || cancellation.latencyMs > 100) throw new Error(`${profile.id}: TTS barge-in failed ${JSON.stringify(cancellation)}`);
    await page.evaluate(() => { window.__agmVoiceBargeInProbe.fireSpeechEnd(); window.__agmVoiceBargeInProbe.fireResult('VOICE_NEW'); });
    await page.waitForFunction(() => document.querySelector('[data-assistant-response]')?.textContent === 'VOICE NEW ANSWER');
    const bargeTelemetry = (await telemetry()).findLast(row => row.kind === 'barge-in' && row.platform === 'browser');
    if (!bargeTelemetry || bargeTelemetry.newSpeechDetectedToOldAudioStopMs > 100 || bargeTelemetry.audioQueueFlushed !== true) throw new Error(`${profile.id}: barge-in telemetry failed ${JSON.stringify(bargeTelemetry)}`);
    result.scenarios.push({ id: 'A-interrupt-during-tts', status: 'PASS', measuredNewSpeechToOldAudioStopMs: cancellation.latencyMs, runtimeTelemetry: bargeTelemetry });

    await page.locator('[data-assistant-start]').click();
    await page.waitForFunction(() => Boolean(window.__agmVoiceBargeInProbe.activeRecognition));
    await page.evaluate(() => { window.__agmVoiceBargeInProbe.fireSpeechStart(); window.__agmVoiceBargeInProbe.fireSpeechEnd(); window.__agmVoiceBargeInProbe.fireResult('STT_OLD_SLOW'); });
    await delay(12);
    await ask('STT_NEW_FAST');
    await page.waitForFunction(() => document.querySelector('[data-assistant-response]')?.textContent === 'CURRENT STT ANSWER');
    await delay(760);
    const sttHistory = await history();
    if (sttHistory.includes('STALE STT ANSWER') || !sttHistory.includes('CURRENT STT ANSWER')) throw new Error(`${profile.id}: immediate post-STT preemption failed`);
    result.scenarios.push({ id: 'C-new-question-immediately-after-stt', status: 'PASS' });

    for (let index = 1; index <= 5; index += 1) { await ask(`RAPID_${index}`); await delay(12); }
    await page.waitForFunction(() => document.querySelector('[data-assistant-response]')?.textContent === 'RAPID ANSWER 5');
    await delay(600);
    const rapidHistory = await history();
    const oldRapidAnswers = [1, 2, 3, 4].filter(index => rapidHistory.includes(`RAPID ANSWER ${index}`));
    const probe = await page.evaluate(() => ({ maxRecognitionActiveCount: window.__agmVoiceBargeInProbe.maxRecognitionActiveCount, maxActiveAudioCount: window.__agmVoiceBargeInProbe.maxActiveAudioCount, maxActiveAuthorityMarkers: window.__agmVoiceBargeInProbe.maxActiveAuthorityMarkers, activeAuthorityMarkers: document.querySelectorAll('[data-active-voice-turn]').length }));
    if (oldRapidAnswers.length || !rapidHistory.includes('RAPID ANSWER 5') || probe.maxRecognitionActiveCount > 1 || probe.maxActiveAudioCount > 1 || probe.maxActiveAuthorityMarkers > 1 || probe.activeAuthorityMarkers > 1) throw new Error(`${profile.id}: rapid interruption/single authority failed ${JSON.stringify({ oldRapidAnswers, probe })}`);
    result.scenarios.push({ id: 'D-rapid-5-interruptions', status: 'PASS', staleRapidAnswersSuppressed: 4 });
    result.scenarios.push({ id: 'single-active-turn-authority', status: 'PASS', ...probe });
    result.status = 'PASS';
    result.console = consoleMessages;
    await page.screenshot({ path: path.join(out, `${profile.id}-final.png`), fullPage: true });
    report.viewports.push(result);
    await context.close();
  }
  report.status = report.viewports.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL';
  report.target = target;
} catch (error) {
  report.fatal = String(error?.stack || error);
} finally {
  await browser?.close();
  if (server) server.kill();
  report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`VOICE BARGE-IN BROWSER: ${report.status}`);
  console.log(path.join(out, 'report.json'));
  if (report.status !== 'PASS') { console.error(report.fatal); process.exitCode = 1; }
}
