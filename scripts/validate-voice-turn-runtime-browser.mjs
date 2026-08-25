import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'voice-runtime', 'browser', runId);
const report = { schemaVersion: 1, runId, runner: 'Controlled AGM Playwright/Chromium', status: 'FAIL', results: [], browserContract: { plugin: 'PASS', integratedControl: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE', session: 'PENDING', target: 'PENDING' } };
let server;
let browser;
const assistantRequests = [];
const consoleMessages = [];
const failedAssistantRequests = [];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () => new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.unref();
  socket.on('error', reject);
  socket.listen(0, '127.0.0.1', () => { const address = socket.address(); socket.close(() => resolve(address.port)); });
});
const response = (text, modelMs = 40) => ({ data: { contractVersion: 'premium-assistant.v1', kind: 'answer', text, provider: 'openai', productId: 'agm-cockpit', moduleId: 'premium-cockpit', contextRefs: [], externalEffectPerformed: false, timing: { orchestratorMs: 7, modelMs, serverTotalMs: modelMs + 7 } }, requestId: `voice-${Date.now()}` });

await mkdir(out, { recursive: true });
try {
  const port = await freePort();
  const target = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore' });
  for (let attempt = 0; attempt < 80; attempt += 1) { try { if ((await fetch(target)).status === 200) break; } catch {} await delay(150); if (attempt === 79) throw new Error('Preview target did not become healthy'); }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on('console', message => consoleMessages.push({ type: message.type(), text: message.text() }));
  report.browserContract.session = 'PASS';
  page.on('requestfailed', request => { if (request.url().includes('/premium-assistant/respond')) failedAssistantRequests.push({ text: request.postData(), failure: request.failure() }); });
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    localStorage.setItem('agm.premium.single-copilot.enabled', 'true');
    window.__agmVoiceProbe = { cancelCalls: 0, starts: [], active: null };
    const FakeUtterance = class { constructor(text) { this.text = text; this.lang = ''; this.onstart = null; this.onend = null; this.onerror = null; } };
    const fakeSynthesis = {
      cancel() { window.__agmVoiceProbe.cancelCalls += 1; window.__agmVoiceProbe.active = null; },
      speak(utterance) { window.__agmVoiceProbe.active = utterance.text; setTimeout(() => { if (window.__agmVoiceProbe.active !== utterance.text) return; window.__agmVoiceProbe.starts.push({ text: utterance.text, at: performance.now() }); utterance.onstart?.(); }, 15); },
      pause() {}, resume() {}, getVoices() { return []; }, speaking: false, pending: false, paused: false,
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: fakeSynthesis });
  });
  await page.route('**/api/v1/**', async route => {
    const url = route.request().url();
    if (url.endsWith('/auth/login')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { accessToken: 'controlled-voice-token', user: { id: 'owner', displayName: 'Owner', email: 'owner@example.test', roles: ['PREMIUM_ACCESS'] } } }) });
    if (url.endsWith('/auth/entitlements')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { subjectId: 'owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' } }) });
    if (url.endsWith('/premium-assistant/respond')) {
      const request = route.request().postDataJSON();
      const text = request.confirmedText;
      const trace = { text, receivedAt: Date.now(), status: 'PENDING' };
      assistantRequests.push(trace);
      const wait = text.includes('PRIMA') ? 1600 : text.includes('A DOUA') ? 90 : 60;
      const answer = text.includes('PRIMA') ? 'RASPUNS VECHI UNU' : text.includes('A DOUA') ? 'RASPUNS NOU DOI' : text.includes('TREIA') ? 'AUDIO VECHI TREI' : 'RASPUNS FINAL PATRU';
      await delay(wait);
      try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response(answer, text.includes('PRIMA') ? 1500 : 40)) }); trace.status = 'FULFILLED'; trace.finishedAt = Date.now(); } catch (error) { trace.status = 'ABORTED'; trace.finishedAt = Date.now(); trace.error = String(error); }
      return;
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
  });

  await page.goto(`${target}/access`, { waitUntil: 'networkidle' });
  await page.locator('input[name=email]').fill('owner@example.test');
  await page.locator('input[name=password]').fill('not-a-real-secret');
  await page.locator('[data-access-login]').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
  await page.evaluate(() => { history.pushState({}, '', '/premium/copilot'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.waitForTimeout(750);
  const targetDiagnostic = await page.evaluate(() => ({ url: location.href, title: document.title, body: document.body.innerText.slice(0, 1200), copilotCount: document.querySelectorAll('[data-premium-copilot]').length, accessState: document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') }));
  if (!targetDiagnostic.copilotCount) throw new Error(`Premium Copilot target absent: ${JSON.stringify(targetDiagnostic)}`);
  await page.locator('[data-premium-copilot]').waitFor({ state: 'visible', timeout: 5000 });
  report.browserContract.target = 'PASS';

  const ask = async text => {
    await page.locator('[data-assistant-transcript]').fill(text);
    await page.locator('[data-copilot-route]').click();
    await page.locator('[data-assistant-confirm]').waitFor({ state: 'visible' });
    await page.locator('[data-assistant-confirm]').click();
  };

  await ask('PRIMA întrebare lentă');
  await delay(120);
  await ask('A DOUA întrebare prioritară');
  await page.waitForFunction(() => document.querySelector('[data-assistant-response]')?.textContent === 'RASPUNS NOU DOI');
  await delay(1700);
  const firstHistory = await page.locator('[data-assistant-history]').innerText();
  const modelInterruptTelemetry = await page.evaluate(() => JSON.parse(sessionStorage.getItem('agm.premium.voice.telemetry.v1') || '[]').filter(row => row.kind === 'interrupt').at(-1));
  const modelResult = { staleResponseAbsent: !firstHistory.includes('RASPUNS VECHI UNU'), newestResponseVisible: firstHistory.includes('RASPUNS NOU DOI'), priorRequestFailed: failedAssistantRequests.some(item => item.text?.includes('PRIMA')), cancelLatencyMs: modelInterruptTelemetry?.cancelLatencyMs };
  if (!modelResult.staleResponseAbsent || !modelResult.newestResponseVisible || !modelResult.priorRequestFailed) throw new Error(`Model preemption failed: ${JSON.stringify(modelResult)}`);
  await page.screenshot({ path: path.join(out, '01-model-request-preempted.png'), fullPage: true });
  report.results.push({ id: 'model-request-preemption', status: 'PASS', ...modelResult });

  await ask('TREIA întrebare pentru audio');
  await page.waitForFunction(() => document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state') === 'SPEAKING' && window.__agmVoiceProbe?.active === 'AUDIO VECHI TREI');
  const beforeCancel = await page.evaluate(() => window.__agmVoiceProbe.cancelCalls);
  await ask('A PATRA întrebare finală');
  await page.waitForFunction(() => document.querySelector('[data-assistant-response]')?.textContent === 'RASPUNS FINAL PATRU' && document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state') === 'SPEAKING');
  const playback = await page.evaluate(() => ({ ...window.__agmVoiceProbe, telemetry: JSON.parse(sessionStorage.getItem('agm.premium.voice.telemetry.v1') || '[]').at(-1), state: document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state'), latency: document.querySelector('[data-assistant-latency]')?.textContent }));
  const audioResult = { oldAudioStopped: playback.cancelCalls > beforeCancel, activeAudio: playback.active, activeAudioCount: playback.active ? 1 : 0, state: playback.state, latency: playback.latency, telemetry: playback.telemetry };
  if (!audioResult.oldAudioStopped || audioResult.activeAudio !== 'RASPUNS FINAL PATRU' || audioResult.activeAudioCount !== 1 || audioResult.state !== 'SPEAKING') throw new Error(`Audio preemption failed: ${JSON.stringify(audioResult)}`);
  if (!/orchestrator 7 ms.*model 40 ms.*TTS→audio \d+ ms.*transcript→audio \d+ ms/.test(audioResult.latency || '')) throw new Error(`Stage telemetry missing: ${audioResult.latency}`);
  await page.screenshot({ path: path.join(out, '02-audio-preempted-final-turn.png'), fullPage: true });
  report.results.push({ id: 'audio-output-preemption', status: 'PASS', ...audioResult });
  report.status = 'PASS';
  report.target = target;
} catch (error) {
  report.fatal = String(error?.stack || error);
  try { if (browser) { const pages = browser.contexts().flatMap(context => context.pages()); if (pages[0]) { report.failurePage = await pages[0].evaluate(() => ({ url: location.href, body: document.body.innerText.slice(0, 2000), state: document.querySelector('[data-premium-copilot]')?.getAttribute('data-voice-state'), status: document.querySelector('[data-assistant-status]')?.textContent, response: document.querySelector('[data-assistant-response]')?.textContent, history: sessionStorage.getItem('agm.premium.assistant.history.v1'), telemetry: sessionStorage.getItem('agm.premium.voice.telemetry.v1'), token: sessionStorage.getItem('agm.auth.accessToken') })); await pages[0].screenshot({ path: path.join(out, 'FAIL.png'), fullPage: true }); } } } catch {}
} finally {
  await browser?.close();
  if (server) server.kill();
  report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  report.finishedAt = new Date().toISOString();
  report.assistantRequests = assistantRequests;
  report.failedAssistantRequests = failedAssistantRequests;
  report.console = consoleMessages;
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`VOICE TURN RUNTIME BROWSER: ${report.status}`);
  console.log(path.join(out, 'report.json'));
  if (report.status !== 'PASS') { console.error(report.fatal); process.exitCode = 1; }
}
