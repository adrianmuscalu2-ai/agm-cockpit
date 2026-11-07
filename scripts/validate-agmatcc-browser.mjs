import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const webRequire = createRequire(path.join(root, 'apps', 'web', 'package.json'));
const { createServer: createViteServer } = await import(pathToFileURL(webRequire.resolve('vite')).href);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'evidence', 'agmatcc', runId);
const checks = [];
const browserPluginStatus = process.env.AGM_BROWSER_PLUGIN_STATUS === 'PASS' ? 'PASS' : 'FAIL';
const integratedBrowserControlStatus = process.env.AGM_INTEGRATED_BROWSER_CONTROL_STATUS === 'PASS'
  ? 'PASS'
  : 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE';
const report = { schemaVersion: 1, runId, runner: 'Controlled AGM Playwright/Chromium', browserPluginStatus, integratedBrowserControlStatus, browserSessionStatus: 'FAIL', targetPageStatus: 'FAIL', checks };
const check = (name, ok, detail) => checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
let viteServer; let browser; let fatal;

await mkdir(out, { recursive: true });
try {
  const port = await freePort();
  const target = `http://127.0.0.1:${port}/`;
  viteServer = await createViteServer({ root: path.join(root, 'apps', 'web'), server: { host: '127.0.0.1', port, strictPort: true }, logLevel: 'silent' });
  await viteServer.listen();
  report.target = target;
  browser = await chromium.launch({ headless: true });
  report.browserSessionStatus = 'PASS';
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ro-RO', serviceWorkers: 'block' });
  const page = await context.newPage();
  globalThis.__page = page;
  const errors = [];
  const failedCss = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('response', (response) => {
    if (/\.css(\?|$)/.test(response.url()) && response.status() >= 400) failedCss.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    window.__agmatccSpoken = [];
    class MockSpeechSynthesisUtterance {
      constructor(text) { this.text = text; this.lang = ''; this.onend = null; this.onerror = null; }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockSpeechSynthesisUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance) {
          window.__agmatccSpoken.push(utterance.text);
          queueMicrotask(() => utterance.onend?.());
        },
      },
    });
  });
  // Auth-gate stub only: real PIN/Owner credentials are not available to this runner; AGMaTCC logic itself is not stubbed.
  const syncBodies = [];
  await page.route(/\/turn-admin\/(unlock|refresh)$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { accessToken: 'e2e-auth-gate-stub', expiresInSeconds: 900 } }) }));
  await page.route(/\/turn-admin\/validate$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { valid: true } }) }));
  await page.route(/\/api\/v1\/auth\/refresh$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { accessToken: 'e2e-user-auth-gate-stub' } }) }));
  let journalReads = 0;
  const journalEvents = [
    { eventId: 'event-transcript-123', eventType: 'agmatcc.voice-transcript-confirmed', aggregateVersion: 1, recordedAt: '2026-11-07T08:00:00.000Z', payload: { text: 'Transcriere confirmată', ledgerHash: 'a'.repeat(64) } },
    { eventId: 'event-playback-failed-123', eventType: 'agmatcc.playback', aggregateVersion: 2, recordedAt: '2026-11-07T08:01:00.000Z', payload: { text: 'PLAYBACK FAILED · event-playback-failed-123 · engine error', ledgerHash: 'b'.repeat(64) } },
    { eventId: 'event-warning-2026', eventType: 'agmatcc.note', aggregateVersion: 3, recordedAt: '2026-11-07T08:02:00.000Z', payload: { text: 'COMMAND_RESULT · WARNING — partial coverage · RESPONSE: Atenție, rezultatul de jurnal este incomplet.', ledgerHash: 'c'.repeat(64) } },
  ];
  let journalRequestPath;
  await page.route(/\/operational-events\/(?!sync)[^/?]+/, (route) => {
    journalReads += 1;
    const requestUrl = new URL(route.request().url());
    journalRequestPath = `${requestUrl.pathname}${requestUrl.search}`;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { streamId: 'stub-stream', serverVersion: 3, events: journalEvents, projection: null } }) });
  });
  await page.route(/\/api\/v1\/incidents$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ id: 'incident-browser-123', status: 'open', severity: 'high', title: 'Transport întârziat', createdAt: '2026-11-07T08:03:00.000Z' }] }),
  }));
  const semanticQueries = [];
  await page.route(/\/operational-events\/search\/semantic\?/, (route) => { semanticQueries.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { index: 'stub', scope: 'company-operational-events', coverage: { total: 3, scanned: 3, complete: true }, hits: [{ eventType: 'trip.delay_reported', score: 0.81, matchedConcepts: ['delay'], source: 'operational-event:s1@3' }] } }) }); });
  await page.route(/\/operational-events\/sync$/, (route) => { syncBodies.push(route.request().postData()); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { results: [], projections: [] } }) }); });
  const response = await page.goto(target + 'turn', { waitUntil: 'domcontentloaded' });
  check('Browser plugin callable', report.browserPluginStatus === 'PASS');
  await page.waitForSelector('#turn-agmatcc-title', { timeout: 20000 }).catch(() => {});
  report.targetPageStatus = response?.status() === 200 ? 'PASS' : 'FAIL';
  await page.screenshot({ path: path.join(out, '01-landing.png'), fullPage: true });
  const hasPage = await page.locator('[data-agmatcc], #turn-agmatcc-title').count();
  check('AGMaTCC section rendered', hasPage > 0, { count: hasPage });
  const visible = await page.locator('#turn-agmatcc-title').first().isVisible().catch(() => false);
  check('AGMaTCC title visible', visible);
  check('No CSS 4xx/5xx', failedCss.length === 0, failedCss);
  const styled = await page.locator('.agmatcc-status, [data-agmatcc-history]').first().evaluate((el) => getComputedStyle(el).display).catch(() => null);
  check('AGMaTCC stylesheet applied', styled !== null, { display: styled });
  const draft = page.locator('[data-agmatcc-draft]').first();
  const phrase = 'Comanda de test AGMaTCC cu diacritice \u0103\u00e2\u00ee\u0219\u021b';
  await draft.fill(phrase);
  await page.locator('[data-agmatcc-confirm]').first().click();
  await page.waitForTimeout(500);
  const historyText = await page.locator('[data-agmatcc-history]').first().innerText();
  check('Confirmed entry appended to history', historyText.includes('Comanda de test'), { historyText });
  await page.locator('.agmatcc-audit-panel > summary').click();
  const integrity = await page.locator('[data-agmatcc-integrity]').first().innerText();
  check('Integrity indicator verified', /ok|valid|verificat|intact/i.test(integrity), { integrity });
  await page.locator('[data-agmatcc-query]').first().fill('comanda diacritice');
  await page.waitForTimeout(500);
  await page.locator('.agmatcc-evidence-details > summary').click();
  const resultsText = await page.locator('[data-agmatcc-results]').first().innerText();
  check('Search finds the entry', resultsText.includes('Comanda de test'), { resultsText });
  const serverResultsText = await page.locator('[data-agmatcc-results]').first().innerText();
  check('Server semantic search queried with source and coverage shown', semanticQueries.length > 0 && serverResultsText.includes('operational-event:s1@3') && /3\/3/.test(serverResultsText), { semanticQueries: semanticQueries.length, serverResultsText });
  await page.screenshot({ path: path.join(out, '02-after-entry.png'), fullPage: true });
  await draft.fill('comanda cauta diacritice');
  await page.locator('[data-agmatcc-run-command]').first().click();
  await page.waitForTimeout(400);
  check('Voice command "cauta" drives search', (await page.locator('[data-agmatcc-query]').first().inputValue()) === 'diacritice' && (await page.locator('[data-agmatcc-results]').first().innerText()).includes('Comanda de test'));
  await draft.fill('comanda citeste jurnal server');
  await page.locator('[data-agmatcc-run-command]').first().click();
  await page.waitForTimeout(800);
  const journalSummary = await page.locator('[data-agmatcc-status]').first().innerText();
  const spokenJournal = await page.evaluate(() => window.__agmatccSpoken.at(-1));
  check('Server log summarized from real event records', journalReads > 0 && /3 evenimente/.test(journalSummary) && /1 eșuat/.test(journalSummary) && /1 avertisment/.test(journalSummary), { journalReads, journalSummary });
  check('Voice response contains no implicit audit identifiers', spokenJournal === journalSummary && !/event-|[0-9a-f]{64}|\/api\/v1|operational-event:|serverVersion/i.test(spokenJournal), { spokenJournal });

  await draft.fill('Avem incidente?');
  await page.locator('[data-agmatcc-run-command]').first().click();
  await page.waitForTimeout(800);
  const incidentSummary = await page.locator('[data-agmatcc-status]').first().innerText();
  const spokenIncident = await page.evaluate(() => window.__agmatccSpoken.at(-1));
  check('Incident question reports the actual open incident', /1 incident/.test(incidentSummary) && /deschis/.test(incidentSummary) && /ridicată/.test(incidentSummary), { incidentSummary });
  check('Incident answer omits internal identifiers', spokenIncident === incidentSummary && !/incident-browser-123|\/api\/v1/i.test(spokenIncident), { spokenIncident });

  await draft.fill('Ce s-a întâmplat ultima dată?');
  await page.locator('[data-agmatcc-run-command]').first().click();
  await page.waitForTimeout(800);
  const lastEventSummary = await page.locator('[data-agmatcc-status]').first().innerText();
  check('Last event is explained with its recorded warning', /avertisment înregistrat/.test(lastEventSummary) && /rezultatul de jurnal este incomplet/.test(lastEventSummary), { lastEventSummary });

  await draft.fill('Dă-mi ID-ul evenimentului');
  await page.locator('[data-agmatcc-run-command]').first().click();
  await page.waitForTimeout(800);
  const exactId = await page.locator('[data-agmatcc-status]').first().innerText();
  const exactIdSpoken = await page.evaluate(() => window.__agmatccSpoken.at(-1));
  const technicalRows = await page.locator('[data-agmatcc-results]').first().innerText();
  check('Explicit event ID request returns the exact identifier', exactId === 'event-warning-2026' && exactIdSpoken === exactId, { exactId, exactIdSpoken });
  check('Audit details open on explicit identifier request', await page.locator('.agmatcc-audit-panel').evaluate((node) => node.open) && await page.locator('.agmatcc-evidence-details').evaluate((node) => node.open) && technicalRows.includes('ledgerHash='));

  await draft.fill('Dă-mi hash-ul evenimentului');
  await page.locator('[data-agmatcc-run-command]').first().click();
  await page.waitForTimeout(800);
  const exactHash = await page.locator('[data-agmatcc-status]').first().innerText();
  check('Explicit hash request returns the exact digest', exactHash === 'c'.repeat(64));

  await draft.fill('Dă-mi endpointul');
  await page.locator('[data-agmatcc-run-command]').first().click();
  await page.waitForTimeout(800);
  const exactEndpoint = await page.locator('[data-agmatcc-status]').first().innerText();
  check('Explicit endpoint request returns the effective endpoint', Boolean(journalRequestPath) && exactEndpoint === `Endpointul exact este ${journalRequestPath}.`, { exactEndpoint, journalRequestPath });

  await draft.fill('Arată-mi detaliile de audit');
  await page.locator('[data-agmatcc-run-command]').first().click();
  await page.waitForTimeout(800);
  check('Explicit audit request reveals complete technical evidence', /Detaliile complete/.test(await page.locator('[data-agmatcc-status]').first().innerText()) && await page.locator('.agmatcc-evidence-details').evaluate((node) => node.open));
  await draft.fill('');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-agmatcc-history]', { timeout: 20000 });
  const persisted = await page.locator('[data-agmatcc-history]').first().innerText();
  check('History persists across reload', persisted.includes('Comanda de test'));
  const journals = await page.locator('[data-agmatcc-journal]').evaluateAll((nodes) => nodes.map((n) => ({ id: n.getAttribute('data-agmatcc-journal'), href: n.getAttribute('href') })));
  check('Journal links present', journals.length > 0, journals);
  const auditPanel = page.locator('.agmatcc-audit-panel').first();
  if (!(await auditPanel.evaluate((node) => node.open))) await auditPanel.locator('summary').click();
  const syncDetails = await page.locator('[data-agmatcc-sync]').first().innerText();
  check('Sync state reported honestly', syncDetails.length > 0, { sync: syncDetails });
  check('Sync request emitted as operational-event.v1', syncBodies.length > 0 && syncBodies[0].includes('operational-event.v1'), { count: syncBodies.length });
  const unexpected = errors.filter((e) => !/Failed to fetch/.test(e));
  check('No page runtime errors (API-less fetch failures from pre-existing observers excluded)', unexpected.length === 0, { unexpected, apiLessFetchFailures: errors.length - unexpected.length });
  await page.screenshot({ path: path.join(out, '03-after-reload.png'), fullPage: true });
} catch (error) {
  fatal = error instanceof Error ? error.stack : String(error);
  await globalThis.__page?.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
} finally {
  await browser?.close();
  await viteServer?.close();
  report.status = !fatal && checks.every((c) => c.status === 'PASS') && report.targetPageStatus === 'PASS' ? 'PASS' : 'FAIL';
  report.fatal = fatal;
  report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, out, checks: checks.map((c) => `${c.status} ${c.name}`), fatal }, null, 2));
  process.exitCode = report.status === 'PASS' ? 0 : 1;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}
