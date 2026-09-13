import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'speech-semantics', 'browser', runId);
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
  checks: {},
};
let browser;
let server;
let page;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const freePort = () => new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.unref();
  socket.on('error', reject);
  socket.listen(0, '127.0.0.1', () => {
    const address = socket.address();
    socket.close(() => resolve(address.port));
  });
});

await mkdir(out, { recursive: true });
try {
  const port = await freePort();
  const target = `http://127.0.0.1:${port}`;
  report.target = target;
  server = spawn(process.execPath, [path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore' });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(target)).status === 200) break; } catch {}
    await delay(150);
    if (attempt === 79) throw new Error('Preview target unavailable');
  }

  browser = await chromium.launch({ headless: true });
  report.browserGate.browserSessionStatus = 'PASS';
  page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    window.__agmSpeechSemanticsProbe = { spokenText: '', spokenLanguage: '', started: false };
    class FakeUtterance { constructor(text) { this.text = text; this.lang = ''; this.onstart = null; this.onend = null; this.onerror = null; } }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel() {},
      speak(utterance) {
        window.__agmSpeechSemanticsProbe.spokenText = utterance.text;
        window.__agmSpeechSemanticsProbe.spokenLanguage = utterance.lang;
        setTimeout(() => { window.__agmSpeechSemanticsProbe.started = true; utterance.onstart?.(); setTimeout(() => utterance.onend?.(), 10); }, 10);
      },
      pause() {}, resume() {}, getVoices() { return []; }, speaking: false, pending: false, paused: false,
    } });
  });

  const visibleAnswer = 'Pe A6 sunt 30 °C, limita este 80 km/h, iar ETA este 08:30.';
  const expectedSpeech = 'Pe autostrada A 6 sunt 30 de grade Celsius, limita este 80 de kilometri pe oră, iar ora estimată de sosire este ora 8 și 30 de minute.';
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    let data = {};
    if (url.endsWith('/auth/login')) data = { accessToken: 'controlled-speech-token', user: { id: 'owner', displayName: 'Owner', email: 'owner@example.test', roles: ['PREMIUM_ACCESS'] } };
    else if (url.endsWith('/auth/entitlements')) data = { subjectId: 'owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' };
    else if (url.endsWith('/premium-assistant/respond')) data = { contractVersion: 'premium-assistant.v1', kind: 'answer', text: visibleAnswer, provider: 'openai', productId: 'agm-cockpit', moduleId: 'premium-cockpit', contextRefs: [], sourceTrace: { traceId: 'speech-browser', status: 'NO_VERIFIED_SOURCES', generatedAt: new Date().toISOString(), counts: { total: 0, library: 0, cache: 0, live: 0 } }, cache: { disposition: 'MISS', ttlSeconds: 60 }, timing: { timeToFirstTokenMs: 10, orchestratorMs: 5, modelMs: 20, answerCompleteMs: 25, serverTotalMs: 30, sourceResolutionMs: 1 }, externalEffectPerformed: false };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });

  await page.goto(`${target}/access`, { waitUntil: 'networkidle' });
  await page.locator('input[name=email]').fill('owner@example.test');
  await page.locator('input[name=password]').fill('controlled-non-secret');
  await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
  await page.evaluate(() => { history.pushState({}, '', '/premium/voice'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.locator('[data-premium-assistant]').waitFor({ state: 'visible' });
  report.browserGate.targetPageStatus = 'PASS';
  await page.locator('[data-assistant-transcript]').fill('Care este situația traseului?');
  await page.locator('[data-assistant-confirm]').click();
  await page.waitForFunction(() => window.__agmSpeechSemanticsProbe?.started === true);
  const detail = await page.evaluate(() => ({
    visibleText: document.querySelector('[data-assistant-response]')?.textContent ?? '',
    spokenText: window.__agmSpeechSemanticsProbe?.spokenText ?? '',
    spokenLanguage: window.__agmSpeechSemanticsProbe?.spokenLanguage ?? '',
  }));
  report.checks = {
    compactVisibleAnswerPreserved: detail.visibleText === visibleAnswer,
    semanticSpeechGenerated: detail.spokenText === expectedSpeech,
    compactTokensAbsentFromSpeech: !/(?:30\s*°C|80\s*km\/h|\bETA\b|\bA6\b|08:30)/.test(detail.spokenText),
    activeLanguageApplied: detail.spokenLanguage === 'ro-RO',
  };
  if (Object.values(report.checks).some((value) => !value)) throw new Error(`Speech semantics checks failed: ${JSON.stringify({ detail, checks: report.checks })}`);
  await page.screenshot({ path: path.join(out, 'compact-display-semantic-tts.png'), fullPage: true });
  report.detail = detail;
  report.status = 'PASS';
} catch (error) {
  report.fatal = String(error?.stack || error);
  if (page) await page.screenshot({ path: path.join(out, 'FAIL.png'), fullPage: true }).catch(() => {});
} finally {
  await browser?.close();
  if (server) server.kill();
  report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`SPEECH SEMANTICS BROWSER: ${report.status}`);
  console.log(path.join(out, 'report.json'));
  if (report.status !== 'PASS') process.exitCode = 1;
}
