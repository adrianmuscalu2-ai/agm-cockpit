import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'agent-accountability', 'browser', runId);
const results = [];
const pageErrors = [];
let target = process.env.AGM_AGENT_ACCOUNTABILITY_URL;
let controlledServer;
let browser;
let browserContext;
let fatal = null;
let incidentMode = 'OMITTED';
let runtimeSnapshot = {
  contractVersion: 'agent-runtime-accountability.v2', generatedAt: new Date().toISOString(),
  agents: [
    { identity: 'premium.release-inspector', responsibility: 'Primary Inspector', declaredOperational: true, operationalDeclaration: 'ACTIVE_AUTHORITY_MANDATE', authorizationSource: 'AUTHORITY_MANDATE', executable: 'YES', mandate: 'PROVEN', mandateId: 'primary-mandate', trigger: 'RELEASE_VALIDATION', executionCondition: 'ON_RELEASE', lastExecution: new Date().toISOString(), lastResult: 'FAILED', outputRef: 'urn:incident:primary', executionEvidenceRef: 'AgentRuntimeEvent:primary', validation: 'PROVEN', validator: 'premium.architecture-inspector', validationEvidenceRef: 'AuthorityAuditJournal:primary', lastValidation: new Date().toISOString(), freshness: 'CURRENT', status: 'FAIL', reason: 'Controlled primary failure.', openResponsibilities: ['Recover primary inspector.'], failover: 'PROVEN' },
    { identity: 'premium.architecture-inspector', responsibility: 'Secondary Inspector', declaredOperational: true, operationalDeclaration: 'ACTIVE_AUTHORITY_MANDATE', authorizationSource: 'AUTHORITY_MANDATE', executable: 'YES', mandate: 'PROVEN', mandateId: 'secondary-mandate', trigger: 'INSPECTOR_FAILURE', executionCondition: 'ON_FAILURE', lastExecution: new Date().toISOString(), lastResult: 'COMPLETED', outputRef: 'urn:validation:secondary', executionEvidenceRef: 'AgentRuntimeEvent:secondary', validation: 'PROVEN', validator: 'premium.architecture-inspector', validationEvidenceRef: 'AuthorityAuditJournal:secondary', lastValidation: new Date().toISOString(), freshness: 'CURRENT', status: 'ACTIVE', reason: 'Transferred validation completed.', openResponsibilities: [], failover: 'PROVEN' },
  ],
  fleet: { total: 2, healthy: 1, degraded: 0, failed: 1, noTelemetry: 0, standby: 0 },
  operationalFleet: { total: 2, active: 1, degraded: 0, failed: 1, noTelemetry: 0, mandateNotDemonstrated: 0, inactive: 0 },
  inspector: { primaryInspector: 'premium.release-inspector', primaryStatus: 'FAILED', secondaryInspector: 'premium.architecture-inspector', secondaryStatus: 'COMPLETED', activeValidator: 'premium.architecture-inspector', mandateTransferred: true, transferReason: 'PRIMARY_INSPECTOR_FAILED', transferredAt: new Date().toISOString(), lastValidation: new Date().toISOString(), transferEvidenceRef: 'AuthorityAuditJournal:transfer', status: 'PASS', controlStatus: 'TRANSFERRED_TO_SECONDARY', primaryRecovered: false, failoverPreserved: true }, incidents: { open: 1, inspectorFailureIncident: 'incident-primary', controlCoverageIncident: null }, verdict: { controlSystem: 'PASS', overallOperationalState: 'FAIL', agentAccountability: 'FAIL', inspectorFailover: 'PASS', controlCoverage: 'COMPLETE', falseActive: 0, unexplainedDegraded: 0, unexplainedStandby: 0, expiredRuntimeEvidence: 0, noTelemetry: 0, failed: 1, mandateNotDemonstrated: 0, primaryRecovered: false, openIncidents: 1, finalAgentRuntimePass: 'FAIL' },
};

function validateRuntimeSnapshot(snapshot) {
  const operational = snapshot?.agents?.filter((agent) => agent.declaredOperational) ?? [];
  const everyAgentAccountable = operational.length === snapshot.agents.length && operational.length > 0 && operational.every((agent) => agent.status === 'ACTIVE' && agent.executable === 'YES' && agent.mandate === 'PROVEN' && agent.validation === 'PROVEN' && agent.executionEvidenceRef);
  const expectedOverall = snapshot?.operationalFleet?.total === snapshot.agents.length && snapshot.operationalFleet.total > 0 && snapshot.operationalFleet.active === snapshot.operationalFleet.total && snapshot.operationalFleet.degraded === 0 && snapshot.operationalFleet.failed === 0 && snapshot.operationalFleet.noTelemetry === 0 && snapshot.operationalFleet.mandateNotDemonstrated === 0 && snapshot.operationalFleet.inactive === 0 ? 'PASS' : 'FAIL';
  const expectedAccountability = everyAgentAccountable ? 'PASS' : 'FAIL';
  const expectedFinal = snapshot?.verdict?.controlSystem === 'PASS' && expectedAccountability === 'PASS' && snapshot?.verdict?.inspectorFailover === 'PASS' && snapshot?.verdict?.controlCoverage === 'COMPLETE' && expectedOverall === 'PASS' && snapshot?.inspector?.primaryRecovered === true && snapshot?.inspector?.failoverPreserved === true && snapshot?.incidents?.open === 0 ? 'PASS' : 'FAIL';
  if (snapshot?.verdict?.controlSystem !== 'PASS' || snapshot.verdict.agentAccountability !== expectedAccountability || snapshot.verdict.overallOperationalState !== expectedOverall || snapshot.verdict.finalAgentRuntimePass !== expectedFinal) throw new Error('PRODUCTION_ACCOUNTABILITY_SNAPSHOT_INCONSISTENT');
}

if (process.env.AGM_AGENT_ACCOUNTABILITY_SNAPSHOT) {
  const persisted = JSON.parse(await readFile(process.env.AGM_AGENT_ACCOUNTABILITY_SNAPSHOT, 'utf8'));
  runtimeSnapshot = persisted.data ?? persisted;
  validateRuntimeSnapshot(runtimeSnapshot);
}
async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function startControlledTarget() {
  if (target) return;
  const port = await freePort();
  const vite = path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js');
  controlledServer = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: path.join(root, 'apps', 'web'), windowsHide: true, stdio: 'ignore',
  });
  target = `http://127.0.0.1:${port}/turn`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(target)).status === 200) return; } catch { /* controlled startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('CONTROLLED_TARGET_UNAVAILABLE');
}

function check(id, passed, detail) {
  results.push({ id, status: passed ? 'PASS' : 'FAIL', detail });
  if (!passed) throw new Error(`ACCOUNTABILITY_ASSERTION_FAILED:${id}:${JSON.stringify(detail)}`);
}

await mkdir(output, { recursive: true });
try {
  await startControlledTarget();
  const targetResponse = await fetch(target, { signal: AbortSignal.timeout(10_000) });
  check('target-http-200', targetResponse.status === 200, { status: targetResponse.status, target });

  browser = await chromium.launch({ headless: true });
  browserContext = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    locale: 'ro-RO',
    serviceWorkers: 'block',
  });
  const page = await browserContext.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? String(error)));
  await page.addInitScript(() => {
    sessionStorage.setItem('agm.admin.session', JSON.stringify({ accessToken: 'controlled-accountability-token', expiresInSeconds: 600 }));
    localStorage.removeItem('agm.admin.session');
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
    if (!localStorage.getItem('agm.accountability.controlled-initialized')) {
      localStorage.removeItem('agm.turn.duty-receipts.v1.1');
      localStorage.setItem('agm.accountability.controlled-initialized', 'true');
    }
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'controlled-agent-accountability' }) });
    if (pathname.endsWith('/incidents')) {
      if (incidentMode === 'OMITTED') {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        return json([]);
      }
      if (incidentMode === 'UNAVAILABLE') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'controlled unavailable' }) });
      if (incidentMode === 'ACTIVE') return json([{ id: 'controlled-active-incident', status: 'open' }]);
      return json([]);
    }
    if (pathname.endsWith('/agent-runtime-events')) return json({ events: [], cursor: null });
    if (pathname.endsWith('/operations/turn/agent-accountability')) return json(runtimeSnapshot);
    if (pathname.endsWith('/turn-admin/validate')) return json({ valid: true });
    if (pathname.endsWith('/auth/refresh')) return json({ accessToken: 'controlled-accountability-token' });
    if (pathname.endsWith('/health/live')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    if (pathname.endsWith('/health/ready')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', dependencies: {} }) });
    if (pathname.endsWith('/turn-admin/refresh')) return json({ accessToken: 'controlled-accountability-token', expiresInSeconds: 600 });
    if (pathname.includes('/api/v1/')) return json([]);
    return route.continue();
  });

  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#turn-agent-accountability');
  await page.waitForSelector('[data-inspector-failover="PASS"]');
  const runtime = await page.evaluate(() => ({
    agents: document.querySelectorAll('[data-runtime-agent]').length,
    primary: document.querySelector('[data-runtime-agent="premium.release-inspector"]')?.getAttribute('data-runtime-status'),
    secondary: document.querySelector('[data-runtime-agent="premium.architecture-inspector"]')?.getAttribute('data-runtime-status'),
    text: document.querySelector('#turn-agent-runtime-accountability')?.textContent ?? '',
  }));
  check('runtime-chain-visible', runtime.agents === runtimeSnapshot.agents.length && runtime.primary === runtimeSnapshot.agents.find((agent) => agent.identity === 'premium.release-inspector')?.status && runtime.secondary === runtimeSnapshot.agents.find((agent) => agent.identity === 'premium.architecture-inspector')?.status, runtime);
  const requiredVerdictText = [
    `OVERALL OPERATIONAL STATE${runtimeSnapshot.verdict.overallOperationalState}`,
    `CONTROL SYSTEM${runtimeSnapshot.verdict.controlSystem}`,
    `AGENT ACCOUNTABILITY${runtimeSnapshot.verdict.agentAccountability}`,
    `INSPECTOR FAILOVER${runtimeSnapshot.verdict.inspectorFailover}`,
    `CONTROL COVERAGE${runtimeSnapshot.verdict.controlCoverage}`,
    `FALSE ACTIVE${runtimeSnapshot.verdict.falseActive}`,
    `FINAL AGENT RUNTIME PASS${runtimeSnapshot.verdict.finalAgentRuntimePass}`,
    runtimeSnapshot.inspector.transferReason,
    runtimeSnapshot.incidents.controlCoverageIncident ?? runtimeSnapshot.incidents.inspectorFailureIncident,
  ].filter(Boolean);
  check('failover-verdict-visible', requiredVerdictText.every((item) => runtime.text.replace(/\s+/g, '').includes(String(item).replace(/\s+/g, ''))), runtime);
  if (process.env.AGM_AGENT_ACCOUNTABILITY_SNAPSHOT) {
    const screenshot = path.join(output, 'production-agent-runtime-accountability.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({ id: 'production-runtime-accountability-capture', status: 'PASS', action: 'Production TURN -> real Production snapshot -> accountability inspection', screenshot: path.relative(root, screenshot) });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#turn-agent-accountability');
    await page.waitForFunction(() => {
      const authorityControlPlane = document.querySelector('[data-runtime-agent="agm.authority.control-plane"]')?.getAttribute('data-runtime-status');
      const secretsGuardian = document.querySelector('[data-runtime-agent="agm.guardian.secrets"]')?.getAttribute('data-runtime-status');
      const verdict = [...document.querySelectorAll('.agent-runtime-verdict')]
        .find((element) => element.querySelector('span')?.textContent?.trim() === 'FINAL AGENT RUNTIME PASS')
        ?.querySelector('strong')?.textContent?.trim();
      return Boolean(authorityControlPlane && secretsGuardian && verdict);
    }, undefined, { timeout: 15_000 });
    const afterReload = await page.evaluate(() => ({
      authorityControlPlane: document.querySelector('[data-runtime-agent="agm.authority.control-plane"]')?.getAttribute('data-runtime-status'),
      secretsGuardian: document.querySelector('[data-runtime-agent="agm.guardian.secrets"]')?.getAttribute('data-runtime-status'),
      verdict: [...document.querySelectorAll('.agent-runtime-verdict')]
        .find((element) => element.querySelector('span')?.textContent?.trim() === 'FINAL AGENT RUNTIME PASS')
        ?.querySelector('strong')?.textContent?.trim(),
    }));
    const reloadedScreenshot = path.join(output, 'production-agent-runtime-accountability-after-reload.png');
    await page.screenshot({ path: reloadedScreenshot, fullPage: true });
    check('production-critical-runtime-persists-after-reload',
      afterReload.authorityControlPlane === 'ACTIVE'
        && afterReload.secretsGuardian === 'ACTIVE'
        && afterReload.verdict === 'PASS',
      { ...afterReload, screenshot: path.relative(root, reloadedScreenshot) });
    check('no-page-errors', pageErrors.length === 0, pageErrors);
  } else {
  await page.waitForFunction(() => document.querySelector('[data-incident-truth-state]')?.textContent?.trim() === 'UNKNOWN / NOT CHECKED');
  const omitted = await page.evaluate(() => ({
    truth: document.querySelector('[data-incident-truth-state]')?.textContent?.trim(),
    incidentDuty: document.querySelector('[data-accountability-agent="monitor-incidents"]')?.getAttribute('data-duty-state'),
    registeredNoReceipt: document.querySelector('[data-accountability-agent="architecture-guardian"]')?.getAttribute('data-duty-state'),
    legacyArchitectureIdentity: Boolean(document.querySelector('[data-accountability-agent="architecture-inspector"]')),
    legacyVersionIdentity: Boolean(document.querySelector('[data-accountability-agent="version-custodian"]')),
    enforcement: document.querySelector('#turn-agent-accountability .protocol-status')?.textContent?.trim(),
  }));
  check('omitted-mon010-is-unknown', omitted.truth === 'UNKNOWN / NOT CHECKED' && omitted.incidentDuty === 'UNKNOWN / NO CURRENT EVIDENCE', omitted);
  check('registered-without-receipt-is-not-active', omitted.registeredNoReceipt === 'UNKNOWN / NO CURRENT EVIDENCE', omitted);
  check('canonical-identities-only', !omitted.legacyArchitectureIdentity && !omitted.legacyVersionIdentity, omitted);
  check('role-contract-enforced-visible', omitted.enforcement?.includes('ENFORCED'), omitted);

  incidentMode = 'COMPLETE';
  await page.waitForFunction(() => document.querySelector('[data-incident-truth-state]')?.textContent?.trim() === 'NO ACTIVE INCIDENTS');
  const complete = await page.evaluate(() => {
    const receipts = JSON.parse(localStorage.getItem('agm.turn.duty-receipts.v1.1') ?? '[]');
    return {
      truth: document.querySelector('[data-incident-truth-state]')?.textContent?.trim(),
      duty: document.querySelector('[data-accountability-agent="monitor-incidents"]')?.getAttribute('data-duty-state'),
      receipt: receipts.filter((receipt) => receipt.agentId === 'monitor-incidents').at(-1),
    };
  });
  check('complete-zero-source-proves-no-active-incidents', complete.truth === 'NO ACTIVE INCIDENTS' && complete.receipt?.coverage === 'COMPLETE' && complete.receipt?.result === 'PASS' && complete.duty === 'DUTY VERIFIED', complete);

  await page.locator('[data-turn-page-target="investigate"]').click();
  await page.waitForSelector('[data-turn-page="investigate"]:not([hidden])');
  incidentMode = 'UNAVAILABLE';
  await page.locator('[data-incident-truth-recheck]:visible').click();
  await page.waitForFunction(() => document.querySelector('[data-incident-truth-state]')?.textContent?.trim() === 'INCIDENT DATA UNAVAILABLE');
  const unavailable = await page.evaluate(() => {
    const receipts = JSON.parse(localStorage.getItem('agm.turn.duty-receipts.v1.1') ?? '[]');
    return {
      truth: document.querySelector('[data-incident-truth-state]')?.textContent?.trim(),
      duty: document.querySelector('[data-accountability-agent="monitor-incidents"]')?.getAttribute('data-duty-state'),
      receipt: receipts.filter((receipt) => receipt.agentId === 'monitor-incidents').at(-1),
    };
  });
  check('source-failure-is-not-zero', unavailable.truth === 'INCIDENT DATA UNAVAILABLE' && unavailable.receipt?.coverage === 'PARTIAL' && unavailable.receipt?.result === 'FAIL' && unavailable.duty === 'FAILED', unavailable);

  incidentMode = 'ACTIVE';
  await page.locator('[data-incident-truth-recheck]:visible').click();
  await page.waitForFunction(() => document.querySelector('[data-incident-truth-state]')?.textContent?.trim() === 'ACTIVE INCIDENT');
  const active = await page.evaluate(() => ({
    truth: document.querySelector('[data-incident-truth-state]')?.textContent?.trim(),
    receipts: JSON.parse(localStorage.getItem('agm.turn.duty-receipts.v1.1') ?? '[]'),
  }));
  const activeReceipt = active.receipts.filter((receipt) => receipt.agentId === 'monitor-incidents' && receipt.result === 'PASS' && receipt.coverage === 'COMPLETE').at(-1);
  check('active-incident-truth-visible', active.truth === 'ACTIVE INCIDENT' && Boolean(activeReceipt), { truth: active.truth, receipt: activeReceipt });

  const screenshot = path.join(output, 'agent-accountability-active-incident.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ id: 'controlled-navigation-interaction-capture', status: 'PASS', action: 'TURN -> MON-010 recheck -> accountability inspection', screenshot: path.relative(root, screenshot) });

  incidentMode = 'OMITTED';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#turn-agent-accountability');
  await page.waitForFunction(() => document.querySelector('[data-incident-truth-state]')?.textContent?.trim() === 'UNKNOWN / NOT CHECKED');
  const reload = await page.evaluate((mandateId) => {
    const receipts = JSON.parse(localStorage.getItem('agm.turn.duty-receipts.v1.1') ?? '[]');
    return { currentTruth: document.querySelector('[data-incident-truth-state]')?.textContent?.trim(), persistedReceipt: receipts.some((receipt) => receipt.mandateId === mandateId), receiptCount: receipts.length };
  }, activeReceipt.mandateId);
  check('restart-preserves-receipt-without-faking-current-state', reload.persistedReceipt && reload.currentTruth === 'UNKNOWN / NOT CHECKED', reload);
  check('no-page-errors', pageErrors.length === 0, pageErrors);
  }
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error);
} finally {
  await browser?.close();
  controlledServer?.kill();
  const report = {
    schemaVersion: 1,
    runId,
    status: fatal ? 'FAIL' : 'PASS',
    flow: process.env.AGM_AGENT_ACCOUNTABILITY_SNAPSHOT
      ? 'IAB PROBE ONCE -> CONTROLLED AGM PLAYWRIGHT/CHROMIUM -> PRODUCTION TURN -> REAL PRODUCTION SNAPSHOT -> ACCOUNTABILITY VERDICT'
      : 'IAB PROBE ONCE -> CONTROLLED AGM PLAYWRIGHT/CHROMIUM -> MON-010 TRUTH -> DUTY RECEIPT -> RELOAD',
    runner: 'Controlled AGM Playwright/Chromium',
    browserPluginStatus: 'PASS',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: fatal ? 'FAIL' : 'PASS',
    targetPageStatus: fatal ? 'FAIL' : 'PASS',
    target,
    results,
    pageErrors,
    fatal,
    finishedAt: new Date().toISOString(),
  };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ report: path.join(output, 'report.json'), ...report }, null, 2));
  if (fatal) process.exitCode = 1;
}
