import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const targetUrl = process.env.AGM_TURN_OPERATIONAL_TRUTH_URL || 'https://app.agmcockpit.com/turn';
const apiUrl = process.env.AGM_TURN_OPERATIONAL_TRUTH_API_URL || 'https://api.agmcockpit.com/api/v1/operations/turn/operational-truth';
const evidenceScope = targetUrl === 'https://app.agmcockpit.com/turn'
  && apiUrl === 'https://api.agmcockpit.com/api/v1/operations/turn/operational-truth'
  ? 'PRODUCTION_LIVE'
  : 'LOCAL_CONTROLLED_UI_PROOF_ONLY';
const canonicalProduction = evidenceScope === 'PRODUCTION_LIVE';
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceRoot = resolve(process.env.AGM_TURN_OPERATIONAL_EVIDENCE_DIR || `evidence/turn-operational-reconciliation/browser/${runStamp}`);
await mkdir(evidenceRoot, { recursive: true });

const report = {
  contract: 'turn-operational-truth-browser.v1',
  startedAt: new Date().toISOString(),
  targetUrl,
  apiUrl,
  browser: 'AGM controlled Playwright/Chromium',
  evidenceScope,
  productionPass: false,
  status: 'FAIL',
  checks: {},
  consoleErrors: [],
  pageErrors: [],
  network: [],
};

let browser;
try {
  const apiResponse = await fetch(apiUrl, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
  const apiPayload = await apiResponse.json();
  const truth = apiPayload?.data;
  report.checks.apiHttp = apiResponse.status;
  report.checks.apiTruth = truth;
  assert(apiResponse.status === 200, `Operational truth API HTTP ${apiResponse.status}`);
  assert(truth?.contractVersion === 'turn-operational-truth.v1', 'Operational truth contract missing');
  assert(truth?.overallStatus === 'PASS', `Operational truth is ${truth?.overallStatus}`);
  assert(truth?.authStatus === 'M2M AUTHENTICATED', `Authentication is ${truth?.authStatus}`);
  assert(truth?.telemetryStatus === 'LIVE TELEMETRY', `Telemetry is ${truth?.telemetryStatus}`);
  assert(truth?.falseGreen === 0, `FALSE GREEN is ${truth?.falseGreen}`);
  assert(truth?.unexplainedDegraded === 0, `UNEXPLAINED DEGRADED is ${truth?.unexplainedDegraded}`);
  for (const [step, expected] of Object.entries({
    machineIdentity: 'VERIFIED', credential: 'VERIFIED', token: 'VERIFIED', authenticatedAcpRead: 'PASS',
    telemetry: 'PASS', eventStore: 'PERSISTED', api: 'PASS', turn: 'EVIDENCE AVAILABLE', ui: 'READY FOR LIVE RENDER',
  })) assert(truth?.chain?.[step]?.status === expected, `${step} is ${truth?.chain?.[step]?.status}`);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'ro-RO' });
  if (canonicalProduction) {
    await context.addInitScript(() => {
      localStorage.setItem('agm.admin.session', JSON.stringify({ accessToken: 'controlled-browser-audit-session', expiresInSeconds: 300 }));
    });
    await context.route('**/api/v1/turn-admin/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { valid: true }, requestId: 'controlled-turn-operational-truth-audit' }),
      });
    });
    report.checks.turnAdminAccess = 'CONTROLLED_SESSION_VALIDATION_STUB; PRODUCTION PIN NOT READ OR MODIFIED';
  } else {
    report.checks.turnAdminAccess = 'LOCAL_DEVELOPMENT_BYPASS';
  }
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/operations/turn/operational-truth')) report.network.push({ url: response.url(), status: response.status(), at: new Date().toISOString() });
  });

  const navigation = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert(navigation?.status() === 200, `TURN target HTTP ${navigation?.status()}`);
  const legalAcceptance = page.locator('#acceptLegalNotice');
  if (await legalAcceptance.isVisible().catch(() => false)) {
    await legalAcceptance.click();
    await page.waitForSelector('.legal-acceptance-overlay', { state: 'detached', timeout: 15_000 });
    report.checks.legalAcceptance = 'ACCEPTED_FOR_CONTROLLED_SESSION';
  } else {
    report.checks.legalAcceptance = 'ALREADY_ACCEPTED';
  }
  const skipTutorial = page.locator('#skipTutorial');
  if (await skipTutorial.isVisible().catch(() => false)) {
    await skipTutorial.click();
    await page.waitForSelector('.tutorial-overlay', { state: 'detached', timeout: 15_000 });
    report.checks.firstRunTutorial = 'DISMISSED_FOR_CONTROLLED_SESSION';
  } else {
    report.checks.firstRunTutorial = 'ALREADY_COMPLETED';
  }
  await page.waitForSelector('[data-turn-agent-live="pass"]', { timeout: 45_000 });
  await page.waitForSelector('[data-authority-dashboard][data-operational-truth="pass"]', { timeout: 45_000 });
  if (await legalAcceptance.isVisible().catch(() => false)) {
    await legalAcceptance.click();
    await page.waitForSelector('.legal-acceptance-overlay', { state: 'detached', timeout: 15_000 });
    report.checks.legalAcceptance = 'ACCEPTED_AFTER_ADMIN_SESSION_RESTORE';
  }
  if (await skipTutorial.isVisible().catch(() => false)) {
    await skipTutorial.click();
    await page.waitForSelector('.tutorial-overlay', { state: 'detached', timeout: 15_000 });
    report.checks.firstRunTutorial = 'DISMISSED_AFTER_ADMIN_SESSION_RESTORE';
  }
  await page.locator('[data-live-refresh]').click();
  await page.waitForFunction(() => document.querySelector('[data-live-connection]')?.textContent?.includes('M2M AUTHENTICATED'));

  const ui = await page.evaluate(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() || '';
    const live = document.querySelector('[data-turn-agent-live]');
    const hero = document.querySelector('[data-authority-dashboard]');
    const steps = [...document.querySelectorAll('[data-operational-step]')].map((node) => ({
      step: node.getAttribute('data-operational-step'),
      status: node.querySelector('strong')?.textContent?.trim() || '',
      source: node.querySelector('small')?.textContent?.trim() || '',
      evidence: node.querySelector('code')?.textContent?.trim() || '',
    }));
    const liveStatusTerms = new Set(['ACTIVE', 'DEGRADED', 'FAILED', 'UNKNOWN']);
    const displayedStatuses = [...document.querySelectorAll('.turn-status-row')].map((row) => ({
      id: row.getAttribute('data-live-agent-id') || row.getAttribute('data-live-component-id'),
      status: row.querySelector('[data-agent-live-status], [data-component-live-status]')?.textContent?.trim() || '',
      evidence: row.querySelector('[data-agent-live-evidence], [data-component-live-evidence]')?.textContent?.trim() || '',
    }));
    return {
      liveState: live?.getAttribute('data-turn-agent-live'),
      liveFalseGreen: live?.getAttribute('data-false-green'),
      liveUnexplainedDegraded: live?.getAttribute('data-unexplained-degraded'),
      heroState: hero?.getAttribute('data-operational-truth'),
      heroFalseGreen: hero?.getAttribute('data-false-green'),
      heroUnexplainedDegraded: hero?.getAttribute('data-unexplained-degraded'),
      connection: text('[data-live-connection]'),
      controlStatus: text('[data-control-status]'),
      message: text('[data-authority-dashboard] [data-network-message]'),
      steps,
      displayedStatuses,
      unjustifiedStatuses: displayedStatuses.filter((item) => liveStatusTerms.has(item.status) && (!item.evidence || /NO LIVE (SOURCE|OBSERVATION)|UNKNOWN/.test(item.evidence))),
      staticGreenCount: document.querySelectorAll('.turn-entry-panel .turn-light.active, .turn-agent-register .turn-light.active, .turn-network-grid .turn-light.active').length,
    };
  });
  report.checks.ui = ui;
  assert(ui.liveState === 'pass', `TURN live state is ${ui.liveState}`);
  assert(ui.heroState === 'pass', `ACP hero state is ${ui.heroState}`);
  assert(ui.liveFalseGreen === '0' && ui.heroFalseGreen === '0', 'UI FALSE GREEN is not zero');
  assert(ui.liveUnexplainedDegraded === '0' && ui.heroUnexplainedDegraded === '0', 'UI UNEXPLAINED DEGRADED is not zero');
  assert(ui.connection === 'M2M AUTHENTICATED · LIVE TELEMETRY', `Unexpected connection label: ${ui.connection}`);
  assert(ui.controlStatus === 'M2M AUTHENTICATED · LIVE', `Unexpected ACP label: ${ui.controlStatus}`);
  assert(!/AUTH REQUIRED|NO TELEMETRY/.test(`${ui.connection} ${ui.controlStatus} ${ui.message}`), 'ACP/auth warning remains visible');
  assert(ui.steps.length === 9, `Expected 9 operational steps, got ${ui.steps.length}`);
  assert(ui.steps.every((step) => step.status && step.source && step.evidence && step.evidence !== 'NO LIVE EVIDENCE'), 'Operational chain contains an unjustified step');
  assert(ui.unjustifiedStatuses.length === 0, `Unjustified displayed statuses: ${JSON.stringify(ui.unjustifiedStatuses)}`);
  assert(ui.staticGreenCount === 0, `Static registry green count is ${ui.staticGreenCount}`);
  assert(report.network.some((entry) => entry.status === 200), 'UI did not receive operational truth HTTP 200');
  assert(report.pageErrors.length === 0, `Page errors: ${report.pageErrors.join(' | ')}`);

  await page.locator('[data-turn-agent-live]').screenshot({ path: resolve(evidenceRoot, 'turn-authenticated-chain.png') });
  await page.locator('[data-authority-dashboard]').screenshot({ path: resolve(evidenceRoot, 'authority-control-plane-live.png') });
  await page.screenshot({ path: resolve(evidenceRoot, 'turn-production-full-page.png'), fullPage: true });
  report.status = 'PASS';
  report.productionPass = evidenceScope === 'PRODUCTION_LIVE';
  report.completedAt = new Date().toISOString();
  await context.close();
} catch (error) {
  report.failure = error instanceof Error ? error.stack || error.message : String(error);
  report.completedAt = new Date().toISOString();
} finally {
  if (browser) await browser.close();
  await writeFile(resolve(evidenceRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ status: report.status, evidenceRoot, failure: report.failure || null }, null, 2)}\n`);
}

if (report.status !== 'PASS') process.exitCode = 1;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
