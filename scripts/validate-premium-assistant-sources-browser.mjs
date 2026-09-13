import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'premium-assistant-source-separation', runId);
const report = {
  schemaVersion: 2,
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
let sourceEndpointCalls = 0;
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
  const target = 'http://127.0.0.1:' + port;
  report.target = target;
  server = spawn(
    process.execPath,
    [path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore' },
  );
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(target)).status === 200) break;
    } catch {}
    await delay(150);
    if (attempt === 79) throw new Error('Preview target unavailable');
  }

  browser = await chromium.launch({ headless: true });
  report.browserGate.browserSessionStatus = 'PASS';
  page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({
      privacyPolicyVersion: 'privacy-v2026.07.13',
      termsVersion: 'terms-v2026.07.13',
      acceptedAt: new Date().toISOString(),
    }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    window.__agmSourceSeparationProbe = { spokenText: '', audioStarted: false };
    class FakeUtterance {
      constructor(text) {
        this.text = text;
        this.lang = '';
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance) {
          window.__agmSourceSeparationProbe.spokenText = utterance.text;
          setTimeout(() => {
            window.__agmSourceSeparationProbe.audioStarted = true;
            utterance.onstart?.();
            setTimeout(() => utterance.onend?.(), 10);
          }, 10);
        },
        pause() {},
        resume() {},
        getVoices() { return []; },
        speaking: false,
        pending: false,
        paused: false,
      },
    });
  });

  const cleanAnswer = 'Mâine, în Heilbronn, dimineața va fi mai mult noros și sunt posibile câteva averse. După-amiaza se încălzește până la aproximativ 23°C, iar spre seară vremea devine mai senină.';
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/auth/login')) return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { accessToken: 'controlled-source-token', user: { id: 'owner', displayName: 'Owner', email: 'owner@example.test', roles: ['PREMIUM_ACCESS'] } } }),
    });
    if (url.endsWith('/auth/entitlements')) return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { subjectId: 'owner', tier: 'premium', status: 'active', capabilities: ['premium.command-center', 'premium.voice-assistant'], evaluatedAt: new Date().toISOString(), policyVersion: 'access-entitlements@1.0.0' } }),
    });
    if (url.endsWith('/premium-assistant/respond')) return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {
        contractVersion: 'premium-assistant.v1',
        kind: 'answer',
        text: cleanAnswer,
        provider: 'openai',
        productId: 'agm-cockpit',
        moduleId: 'premium-cockpit',
        contextRefs: [],
        sourceTrace: { traceId: 'trace-browser-1', status: 'READY', generatedAt: new Date().toISOString(), counts: { total: 2, library: 0, cache: 0, live: 2 } },
        cache: { disposition: 'MISS', ttlSeconds: 60 },
        timing: { timeToFirstTokenMs: 180, orchestratorMs: 8, modelMs: 470, answerCompleteMs: 478, serverTotalMs: 485, sourceResolutionMs: 3 },
        externalEffectPerformed: false,
      } }),
    });
    if (url.includes('/premium-assistant/sources/')) {
      sourceEndpointCalls += 1;
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'User runtime must not request engineering evidence' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
  });

  await page.goto(target + '/access', { waitUntil: 'networkidle' });
  await page.locator('input[name=email]').fill('owner@example.test');
  await page.locator('input[name=password]').fill('not-a-real-secret');
  await page.locator('[data-access-login]').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('[data-access-enforcement]')?.getAttribute('data-access-state') === 'premium');
  await page.evaluate(() => {
    history.pushState({}, '', '/premium/voice');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.locator('[data-premium-assistant]').waitFor({ state: 'visible' });
  report.browserGate.targetPageStatus = 'PASS';
  await page.locator('[data-assistant-transcript]').fill('Cum va fi vremea mâine în Heilbronn?');
  await page.locator('[data-assistant-confirm]').click();
  await page.waitForFunction(() => window.__agmSourceSeparationProbe?.audioStarted === true);

  const detail = await page.evaluate(() => ({
    responseText: document.querySelector('[data-assistant-response]')?.textContent ?? '',
    sourceUiCount: document.querySelectorAll('[data-assistant-sources], [data-assistant-sources-shell], [data-assistant-sources-list], .premium-assistant-sources').length,
    spokenText: window.__agmSourceSeparationProbe?.spokenText ?? '',
  }));
  report.checks = {
    naturalAnswerRendered: detail.responseText === cleanAnswer,
    noCitationOrUrlInUserText: !/https?:\/\/|\[[0-9]+\]|AGM_LIBRARY|WEB-[a-f0-9]{8,}/i.test(detail.responseText),
    noEngineeringSourceUi: detail.sourceUiCount === 0,
    engineeringEndpointNotFetchedByUserRuntime: sourceEndpointCalls === 0,
    cleanAnswerPassedToTts: detail.spokenText === cleanAnswer,
  };
  if (Object.values(report.checks).some((value) => !value)) {
    throw new Error('Source separation checks failed: ' + JSON.stringify(report.checks));
  }
  await page.screenshot({ path: path.join(out, 'natural-answer-no-user-sources.png'), fullPage: true });
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
  console.log('PREMIUM ASSISTANT SOURCE SEPARATION BROWSER: ' + report.status);
  console.log(path.join(out, 'report.json'));
  if (report.status !== 'PASS') process.exitCode = 1;
}
