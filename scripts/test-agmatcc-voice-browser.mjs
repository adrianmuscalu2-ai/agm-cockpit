import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const require = createRequire(resolve('apps/web/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const output = process.env.AGM_VOICE_TEST_EVIDENCE || 'evidence/agmatcc-voice-local';
await mkdir(output, { recursive: true });
const server = await createServer({ root: resolve('apps/web'), configFile: false, optimizeDeps: { include: ['@agm/shared', '@agm/library-control-plane'] }, server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const requests = [];
const events = [];
const checks = [];
try {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === base && url.pathname === '/voice-fixture') return route.fulfill({ contentType: 'text/html', body: '<html><body><script type="module">import {renderAgmatccPage} from "/src/turn-agmatcc/agmatcc.view.ts"; import {bindAgmatcc} from "/src/turn-agmatcc/agmatcc.runtime.ts"; document.body.innerHTML=renderAgmatccPage();bindAgmatcc();window.fixtureReady=true;</script></body></html>' });
    if (url.origin === base) return route.continue();
    const json = data => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' }, contentType: 'application/json', body: JSON.stringify({ data }) });
    if (route.request().method() === 'OPTIONS') return json({});
    if (url.pathname.endsWith('/agmatcc-copilot/control-status')) return json({ contract: 'luna-control-status.v1', configurationReady: true, checks: Object.fromEntries(['enabled','providerConfigured','ledgerAvailable','commanderBound','targetPinned','handoffPinned'].map(k => [k, true])) });
    if (url.pathname.endsWith('/operational-events/sync')) { const q = route.request().postDataJSON(); events.push(...q.events); return json({ results: q.events.map(() => ({ status: 'accepted' })) }); }
    if (url.pathname.endsWith('/agmatcc-copilot/respond')) { requests.push(route.request().postDataJSON()); return json({ answer: 'Există un blocaj documentat în jurnal.', status: 'PASS', model: 'configured-fixture', provider: 'openai', executionId: 'fixture-execution', testMandateId: 'fixture', evidenceRefs: ['fixture-only'], providerExecutions: [{ source: 'PROVIDER_RESPONSE', executedModel: 'executed-fixture', responseId: 'fixture-response', providerVersion: null }] }); }
    // Every non-local request is intercepted. No Production or paid calls.
    return json([]);
  });
  await page.addInitScript(() => {
    sessionStorage.setItem('agm.admin.session', JSON.stringify({ accessToken: 'LOCAL_SYNTHETIC_FIXTURE_ONLY', expiresInSeconds: 300 }));
    window.captures = []; window.spoken = []; window.voiceList = [{ lang: 'ro-RO', name: 'fixture-ro' }];
    window.SpeechRecognition = class { constructor() { window.captures.push(this); } start() { this.onstart?.(); } stop() { this.onend?.(); } };
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    const synthesis = new EventTarget(); synthesis.getVoices = () => window.voiceList; synthesis.cancel = () => {}; synthesis.speak = u => { window.spoken.push(u.text); u.onend?.(); };
    Object.defineProperty(window, 'speechSynthesis', { value: synthesis });
  });
  const response = await page.goto(base + '/voice-fixture'); assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.fixtureReady);
  await page.locator('[data-agmatcc-capture]').click();
  await page.evaluate(() => window.captures[0].onresult({ results: { length: 1, 0: { isFinal: false, 0: { transcript: 'Ce blocaje' } } } }));
  assert.equal(await page.locator('[data-agmatcc-draft]').inputValue(), 'Ce blocaje'); assert.equal(requests.length, 0);
  await page.evaluate(() => { const c = window.captures[0]; c.onresult({ results: { length: 1, 0: { isFinal: true, 0: { transcript: 'Ce blocaje sunt documentate?' } } } }); c.onend(); });
  await page.waitForFunction(() => window.spoken.length === 1);
  assert.equal(requests.length, 1); assert.equal(requests[0].question, 'Ce blocaje sunt documentate?');
  assert.deepEqual(await page.evaluate(() => window.spoken), ['Există un blocaj documentat în jurnal.']);
  assert.ok(JSON.stringify(events).includes('AI_RESPONSE')); checks.push('STT final -> durable request -> AI -> response journal -> Romanian TTS; fixture only');
  await page.locator('[data-agmatcc-capture]').click();
  await page.locator('[data-agmatcc-stop]').click();
  await page.locator('[data-agmatcc-capture]').click();
  await page.evaluate(() => { window.captures[1].onerror({ error: 'network' }); window.captures[1].onend(); });
  assert.equal(await page.locator('[data-agmatcc-capture]').isDisabled(), true); checks.push('stale STT callbacks cannot mutate replacement capture');
  await page.locator('[data-agmatcc-stop]').click();
  await page.evaluate(() => { window.voiceList = []; });
  await page.locator('[data-agmatcc-speak]').click();
  await page.locator('[data-agmatcc-stop]').click();
  await page.evaluate(() => { window.voiceList = [{ lang: 'ro-RO' }]; window.speechSynthesis.dispatchEvent(new Event('voiceschanged')); });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.spoken.length), 1); checks.push('STOP suppresses delayed voice loading');
  await page.screenshot({ path: resolve(output, 'voice-chain-fixture.png'), fullPage: true });
  await writeFile(resolve(output, `voice-chain-${Date.now()}.json`), JSON.stringify({ at: new Date().toISOString(), verdict: 'PASS_LOCAL_FIXTURE', physicalAudio: 'NOT_TESTED', productionProviderCalls: 0, target: base, browserPluginStatus: 'PASS', integratedBrowserControlStatus: 'PLATFORM_LIMITATION_OPTIONAL_EVIDENCE_UNAVAILABLE', browserSessionStatus: 'PASS', targetPageStatus: 'PASS', checks }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ verdict: 'PASS_LOCAL_FIXTURE', checks, physicalAudio: 'NOT_TESTED', productionProviderCalls: 0 }));
} catch (error) {
  await writeFile(resolve(output, `voice-chain-failed-${Date.now()}.json`), JSON.stringify({ at: new Date().toISOString(), error: error.message, errors, ui: await page.locator('body').innerText(), requests: requests.length, events: events.length, physicalAudio: 'NOT_TESTED' }, null, 2), { flag: 'wx' });
  console.error(JSON.stringify({ error: error.message, errors }));
  throw error;
} finally { await browser.close(); await server.close(); }
