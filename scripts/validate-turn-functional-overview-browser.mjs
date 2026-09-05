import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const targetUrl = process.env.AGM_TURN_FUNCTIONAL_URL || 'https://app.agmcockpit.com/turn';
const apiUrl = process.env.AGM_TURN_FUNCTIONAL_API_URL || 'https://api.agmcockpit.com/api/v1/operations/turn/functional-overview';
const dashboardUrl = process.env.AGM_TURN_OPERATIONAL_DASHBOARD_URL || 'https://api.agmcockpit.com/api/v1/operations/turn/operational-dashboard';
const ownerAccessToken = process.env.AGM_TURN_OWNER_ACCESS_TOKEN?.trim();
const interactiveOwnerLogin = process.env.AGM_TURN_INTERACTIVE_OWNER_LOGIN === '1';
const evidenceScope = targetUrl === 'https://app.agmcockpit.com/turn' && apiUrl === 'https://api.agmcockpit.com/api/v1/operations/turn/functional-overview'
  ? 'PRODUCTION_LIVE'
  : 'NON_PRODUCTION_LIVE';
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceRoot = resolve(process.env.AGM_TURN_FUNCTIONAL_EVIDENCE_DIR || `evidence/turn-functional-completeness/browser/${runStamp}`);
await mkdir(evidenceRoot, { recursive: true });

const report = {
  contract: 'turn-functional-overview-browser.v2',
  startedAt: new Date().toISOString(),
  targetUrl,
  apiUrl,
  dashboardUrl,
  evidenceScope,
  browser: 'AGM controlled Playwright/Chromium',
  realSourcePolicy: 'NO_ROUTE_STUBS_NO_MOCK_PAYLOAD_NO_STATUS_FALLBACK',
  operationalFlow: 'RUNTIME_EVIDENCE_TO_EVALUATOR_TO_INCIDENT_EVENTSTORE_TO_API_TO_TURN',
  ownerAccess: ownerAccessToken ? 'REAL_BEARER_TOKEN_PROVIDED_REDACTED' : interactiveOwnerLogin ? 'INTERACTIVE_OWNER_LOGIN_PENDING' : 'MISSING',
  status: 'FAIL',
  productOwnerAcceptance: 'NOT_GRANTED',
  finalProductPass: false,
  browserFields: {
    browserPluginStatus: 'PENDING',
    integratedBrowserControlStatus: 'PENDING',
    browserSessionStatus: 'PENDING',
    targetPageStatus: 'PENDING',
  },
  checks: {},
  network: [],
  consoleErrors: [],
  pageErrors: [],
};

let browser;
try {
  assert(ownerAccessToken || interactiveOwnerLogin, 'Provide AGM_TURN_OWNER_ACCESS_TOKEN or set AGM_TURN_INTERACTIVE_OWNER_LOGIN=1; no authentication stub is permitted.');
  const preflight = JSON.parse(await readFile(resolve('tmp/rescue-browser-preflight.json'), 'utf8'));
  const preflightAgeMs = Date.now() - Date.parse(preflight.checkedAt);
  assert(Number.isFinite(preflightAgeMs) && preflightAgeMs <= 10 * 60_000, 'Browser preflight is missing or older than 10 minutes.');
  const pluginPass = preflight.runtime?.extensionVersions?.length > 0
    && preflight.runtime?.nodeRepl?.exists === true
    && preflight.runtime?.helper?.exists === true;
  assert(pluginPass, 'Browser plugin/runtime executable preflight is not PASS.');
  report.browserFields.browserPluginStatus = 'PASS';
  report.browserFields.integratedBrowserControlStatus = String(preflight.iab?.status).startsWith('PASS')
    ? 'PASS'
    : 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE';
  report.checks.preflight = {
    checkedAt: preflight.checkedAt,
    visualSignature: preflight.visualSignature,
    iab: preflight.iab,
    controlledRunner: preflight.controlledRunner,
  };

  browser = await chromium.launch({ headless: !interactiveOwnerLogin });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'ro-RO' });
  report.browserFields.browserSessionStatus = 'PASS';
  if (ownerAccessToken) {
    await context.addInitScript(({ token }) => {
      localStorage.setItem('agm.admin.session', JSON.stringify({ accessToken: token, expiresInSeconds: 300 }));
    }, { token: ownerAccessToken });
  }
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  const trackedApiUrls = new Set([apiUrl, dashboardUrl]);
  page.on('request', (request) => {
    if (trackedApiUrls.has(request.url())) report.network.push({
      url: request.url(),
      method: request.method(),
      authorizationPresent: Boolean(request.headers().authorization),
      requestedAt: new Date().toISOString(),
    });
  });
  page.on('response', (response) => {
    if (trackedApiUrls.has(response.url())) report.network.push({ url: response.url(), status: response.status(), respondedAt: new Date().toISOString() });
  });

  const navigation = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert(navigation?.status() === 200, `TURN target HTTP ${navigation?.status()}`);
  await dismissFirstRun(page, report.checks);
  if (interactiveOwnerLogin) {
    process.stdout.write('OWNER_ACTION_REQUIRED: Introdu PIN-ul direct în fereastra Chromium controlată și apasă Deblochează. PIN-ul nu este citit sau jurnalizat de validator.\n');
  }
  await page.waitForSelector('[data-turn-functional-overview][data-functional-verdict="FAIL"]', { timeout: interactiveOwnerLogin ? 300_000 : 60_000 });
  await page.waitForSelector('[data-functional-zone]', { state: 'attached', timeout: 30_000 });
  await page.waitForSelector('[data-agent-network-detail][aria-busy="false"]', { state: 'attached', timeout: 30_000 });
  await page.waitForSelector('[data-basic-spatial-node]', { timeout: 30_000 });
  await dismissFirstRun(page, report.checks);
  const effectiveOwnerAccessToken = ownerAccessToken || await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('agm.admin.session') || 'null')?.accessToken || '';
    } catch {
      return '';
    }
  });
  assert(effectiveOwnerAccessToken, 'Interactive Owner Access did not yield a session token.');
  report.ownerAccess = interactiveOwnerLogin ? 'INTERACTIVE_OWNER_LOGIN_SUCCEEDED_TOKEN_REDACTED' : report.ownerAccess;
  const apiResponse = await fetch(apiUrl, {
    cache: 'no-store',
    headers: { Accept: 'application/json', Authorization: `Bearer ${effectiveOwnerAccessToken}` },
  });
  const apiPayload = await apiResponse.json().catch(() => ({}));
  assert(apiResponse.status === 200, `Functional overview API HTTP ${apiResponse.status}`);
  const overview = apiPayload?.data;
  validateOverview(overview);
  report.checks.api = { httpStatus: apiResponse.status, overview };
  const dashboardResponse = await fetch(dashboardUrl, {
    cache: 'no-store',
    headers: { Accept: 'application/json', Authorization: `Bearer ${effectiveOwnerAccessToken}` },
  });
  const dashboardPayload = await dashboardResponse.json().catch(() => ({}));
  assert(dashboardResponse.status === 200, `Operational dashboard API HTTP ${dashboardResponse.status}`);
  const dashboard = dashboardPayload?.data;
  validateOperationalDashboard(dashboard);
  report.network.push({ url: dashboardUrl, method: 'GET', authorizationPresent: true, status: dashboardResponse.status, directContractValidation: true, respondedAt: new Date().toISOString() });
  report.checks.operationalDashboard = {
    httpStatus: dashboardResponse.status,
    contractVersion: dashboard.contractVersion,
    generatedAt: dashboard.generatedAt,
    nodeCount: dashboard.nodes.length,
    registryMissing: dashboard.nodes.filter((node) => node.registryPresence !== 'PRESENT').map((node) => node.canonicalId),
    capabilityGaps: dashboard.capabilityGaps,
    authorityStatus: dashboard.controlPlane.status,
    opportunityGate: dashboard.opportunityIntelligence.gate,
    incidentPipeline: dashboard.incidentPipeline,
  };
  assert(await page.locator('[data-turn-page="basic"]:visible').count() === 1, 'BASIC is not the primary visible TURN page.');
  assert(await page.locator('[data-basic-spatial-node]:visible').count() === 10, 'BASIC spatial model does not contain 10 real zones.');
  assert(await page.locator('[data-basic-operational-orbit]:visible').count() === 1, 'BASIC approved orbital panel is not visible on entry.');
  assert(await page.locator('[data-basic-orbital-node]:visible').count() === 10, 'BASIC orbital panel does not contain 10 real zones.');
  assert(await page.locator('[data-basic-orbital-criterion-map]:visible').count() === 6, 'BASIC does not expose all six truthful criterion maps.');
  assert(await page.locator('[data-turn-exit]:visible').count() === 1, 'TURN exit control is not visible.');
  for (const criterion of ['functional', 'telemetry', 'procedural', 'component', 'incidents', 'freshness']) {
    await page.locator(`.turn-approved-orbital-panel.basic .turn-orbital-criteria [data-basic-orbital-criterion="${criterion}"]`).click();
    assert(await page.locator('[data-basic-orbital-stage]').getAttribute('data-active-criterion') === criterion, `BASIC criterion ${criterion} did not activate.`);
    assert(await page.locator('[data-basic-orbital-node][data-orbital-status][data-orbital-active-source]').count() === 10, `BASIC criterion ${criterion} lacks status/source coverage.`);
  }
  await page.locator('.turn-approved-orbital-panel.basic .turn-orbital-criteria [data-basic-orbital-criterion="functional"]').click();
  assert(await page.locator('[data-turn-page="basic"] [data-operational-entry]:visible').count() === 6, 'BASIC does not expose all six agent/departments/P9/evidence entry points.');
  await verifyOperationalEntry(page, 'p9', 'investigate', '#turn-p9');
  await verifyOperationalEntry(page, 'event-store', 'incidents', '#turn-incident-page-title');
  await verifyOperationalEntry(page, 'canonical-agent-registry', 'investigate', '#turn-agent-register');
  await verifyOperationalEntry(page, 'organization-chart', 'investigate', '#turn-structure');
  await verifyOperationalEntry(page, 'departments', 'investigate', '#turn-departments');
  await verifyOperationalEntry(page, 'agent-control-panel', 'investigate', '#turn-agent-control-panel');
  await page.screenshot({ path: resolve(evidenceRoot, 'turn-basic-spatial.png'), fullPage: true });
  await page.locator('[data-turn-page-target="premium"]').click();
  await page.waitForSelector('[data-turn-page="premium"]:not([hidden]) [data-premium-spatial-node]', { timeout: 30_000 });
  assert(await page.locator('[data-premium-spatial-node]:visible').count() === 28, 'PREMIUM spatial model does not contain 28 real agents.');
  assert(await page.locator('[data-premium-operational-orbit]:visible').count() === 1, 'PREMIUM approved orbital panel is not visible on entry.');
  assert(await page.locator('[data-premium-orbital-node]:visible').count() === 28, 'PREMIUM orbital panel does not contain 28 real agents.');
  assert(await page.locator('[data-premium-orbital-criterion-map]:visible').count() === 6, 'PREMIUM does not expose all six real criterion maps.');
  for (const criterion of ['operational', 'telemetry', 'procedural', 'component', 'incidents', 'freshness']) {
    await page.locator(`.turn-orbital-criteria [data-premium-orbital-criterion="${criterion}"]`).click();
    assert(await page.locator('[data-premium-orbital-stage]').getAttribute('data-active-criterion') === criterion, `PREMIUM criterion ${criterion} did not activate.`);
    assert(await page.locator('[data-premium-orbital-node][data-orbital-status][data-orbital-active-source]').count() === 28, `PREMIUM criterion ${criterion} lacks status/source coverage.`);
  }
  await page.locator('.turn-orbital-criteria [data-premium-orbital-criterion="operational"]').click();
  await page.screenshot({ path: resolve(evidenceRoot, 'turn-premium-spatial.png'), fullPage: true });
  await page.locator('[data-turn-page-target="incidents"]').click();
  await page.waitForSelector('[data-turn-page="incidents"]:not([hidden]) [data-incident-pipeline-status]', { timeout: 30_000 });
  await page.screenshot({ path: resolve(evidenceRoot, 'turn-operational-incidents.png'), fullPage: true });
  await page.locator('[data-turn-page-target="investigate"]').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-canonical-agent-id]').length === 28, { timeout: 30_000 });

  const ui = await page.evaluate(() => {
    const root = document.querySelector('[data-turn-functional-overview]');
    const premiumPanel = document.querySelector('[data-premium-operational-panel]');
    const secondaryRegistry = document.querySelector('[data-secondary-registry]');
    const cards = [...document.querySelectorAll('[data-functional-zone]')].map((card) => ({
      id: card.getAttribute('data-functional-zone'),
      status: card.getAttribute('data-functional-status'),
      title: card.querySelector('h4')?.textContent?.trim() || '',
      text: card.textContent?.trim() || '',
      actionHref: card.querySelector('a')?.getAttribute('href') || '',
    }));
    return {
      verdict: root?.getAttribute('data-functional-verdict'),
      contract: root?.getAttribute('data-functional-contract'),
      cardCount: cards.length,
      basicCount: document.querySelectorAll('[data-functional-tier="BASIC"] [data-functional-zone]').length,
      premiumCount: document.querySelectorAll('[data-functional-tier="PREMIUM"] [data-functional-zone]').length,
      cards,
      unavailable: Boolean(document.querySelector('.turn-functional-unavailable')),
      invalidUnknown: cards.filter((card) => card.status?.includes('UNKNOWN') && card.status !== 'UNKNOWN_LEGITIMATE'),
      unactionable: cards.filter((card) => !card.actionHref || !card.text.includes('Sursa reală') || !card.text.includes('Ce lipsește')),
      staticRuntimeGreen: document.querySelectorAll('[data-functional-status="STATIC_REFERENCE"].status-operational, [data-functional-status="UNKNOWN_LEGITIMATE"].status-operational').length,
      registryRuntimeGreen: document.querySelectorAll('.organization-map-card .status-light-green, .turn-agent-register .turn-light.active, .turn-entry-panel .turn-light.active').length,
      premiumPanelPresent: Boolean(premiumPanel),
      primaryBeforeRegistry: Boolean(premiumPanel && secondaryRegistry && (premiumPanel.compareDocumentPosition(secondaryRegistry) & Node.DOCUMENT_POSITION_FOLLOWING)),
      secondaryRegistryCollapsed: secondaryRegistry instanceof HTMLDetailsElement && !secondaryRegistry.open,
      visibleSecondaryRegistryNodes: secondaryRegistry ? [...secondaryRegistry.querySelectorAll('.network-agent')].filter((node) => node.getClientRects().length > 0).length : -1,
      staticAgentPanelCount: document.querySelectorAll('#turn-agent-panel iframe, iframe[src="/turn-agent-panel/index.html"]').length,
      operationalNodeCount: document.querySelectorAll('[data-canonical-agent-id]').length,
      operationalNodeIds: [...document.querySelectorAll('[data-canonical-agent-id]')].map((card) => card.getAttribute('data-canonical-agent-id')),
      registryMissingNodes: [...document.querySelectorAll('[data-canonical-agent-id][data-registry-presence="MISSING"]')].map((card) => card.getAttribute('data-canonical-agent-id')),
      operationalFieldCoverage: [...document.querySelectorAll('[data-canonical-agent-id]')].filter((card) => ['Runtime', 'Current state / health', 'Last heartbeat / probe', 'Last activity', 'Runtime freshness', 'Activity freshness', 'Current function', 'Current operation / workload', 'Dependencies', 'Incidents/errors', 'Evidence/source', 'Runtime evidence', 'Activity evidence', 'Why', 'Required action', 'Identity registry'].every((label) => card.textContent?.includes(label))).length,
      basicSpatialNodeCount: document.querySelectorAll('[data-basic-spatial-node]').length,
      basicOrbitalNodeCount: document.querySelectorAll('[data-basic-orbital-node]').length,
      basicOrbitalSourceCoverage: [...document.querySelectorAll('[data-basic-orbital-node]')].filter((node) => node.getAttribute('data-orbital-evidence-source') && node.getAttribute('data-orbital-observed-at')).length,
      basicOrbitalCriterionMapCount: document.querySelectorAll('[data-basic-orbital-criterion-map]').length,
      basicOrbitalCriterionKeys: [...document.querySelectorAll('[data-basic-orbital-criterion-map]')].map((map) => map.getAttribute('data-basic-orbital-criterion-map')),
      basicOrbitalCriterionCoverage: [...document.querySelectorAll('[data-basic-orbital-node]')].filter((node) => ['functional', 'telemetry', 'procedural', 'component', 'incidents', 'freshness'].every((criterion) => node.getAttribute(`data-orbital-${criterion}-status`) && node.getAttribute(`data-orbital-${criterion}-source`))).length,
      basicOrbitalContract: document.querySelector('[data-basic-operational-orbit]')?.getAttribute('data-orbital-source') || '',
      premiumSpatialNodeCount: document.querySelectorAll('[data-premium-spatial-node]').length,
      premiumSpatialSourceCoverage: [...document.querySelectorAll('[data-premium-spatial-node]')].filter((node) => node.getAttribute('data-status-source') && node.getAttribute('data-runtime-presence')).length,
      premiumOrbitalNodeCount: document.querySelectorAll('[data-premium-orbital-node]').length,
      premiumOrbitalSourceCoverage: [...document.querySelectorAll('[data-premium-orbital-node]')].filter((node) => node.getAttribute('data-orbital-evidence-source') && node.getAttribute('data-orbital-runtime-presence') && node.getAttribute('data-orbital-observed-at')).length,
      premiumOrbitalCriterionMapCount: document.querySelectorAll('[data-premium-orbital-criterion-map]').length,
      premiumOrbitalCriterionKeys: [...document.querySelectorAll('[data-premium-orbital-criterion-map]')].map((map) => map.getAttribute('data-premium-orbital-criterion-map')),
      premiumOrbitalCriterionCoverage: [...document.querySelectorAll('[data-premium-orbital-node]')].filter((node) => ['operational', 'telemetry', 'procedural', 'component', 'incidents', 'freshness'].every((criterion) => node.getAttribute(`data-orbital-${criterion}-status`) && node.getAttribute(`data-orbital-${criterion}-source`))).length,
      premiumOrbitalContract: document.querySelector('[data-premium-operational-orbit]')?.getAttribute('data-orbital-source') || '',
      approvedOrbitalPanelCount: document.querySelectorAll('[data-basic-operational-orbit], [data-premium-operational-orbit]').length,
      incidentDecisionCount: document.querySelectorAll('[data-incident-decision]').length,
      incidentQualificationCoverage: [...document.querySelectorAll('[data-incident-decision]')].filter((node) => !['', 'DATA_UNAVAILABLE'].includes(node.getAttribute('data-incident-qualified') || '')).length,
      pageCount: new Set([...document.querySelectorAll('[data-turn-page]')].map((section) => section.getAttribute('data-turn-page'))).size,
      decorativeOrbitCount: document.querySelectorAll('.agm-orbit, .agm-network-node').length,
      genericReadyBadgeCount: document.querySelectorAll('.view-turn .header-ready').length,
      genericBrandPosterCount: document.querySelectorAll('.view-turn .brand-lockup, .view-turn .brand-logo').length,
      genericCommandPanelCount: document.querySelectorAll('.view-turn .command-panel').length,
      genericQuickActionsCount: document.querySelectorAll('.view-turn .quick-actions').length,
      visibleEmptyPageContainerCount: [...document.querySelectorAll('[data-turn-page-container]')].filter((container) => container.getClientRects().length > 0 && !container.querySelector('[data-turn-page]:not([hidden])')).length,
      operationalEntryCount: document.querySelectorAll('[data-operational-entry]').length,
      operationalEntryTargets: [...document.querySelectorAll('[data-operational-entry]')].map((entry) => entry.getAttribute('data-operational-entry-target')),
      turnExitHref: document.querySelector('[data-turn-exit]')?.getAttribute('href') || '',
      p9ProjectionState: document.querySelector('[data-p9-projection]')?.getAttribute('data-p9-projection') || '',
      p9Source: document.querySelector('[data-p9-field="source"]')?.textContent?.trim() || '',
      authorityStatus: document.querySelector('[data-control-status]')?.textContent?.trim() || '',
      operationalSummary: {
        total: document.querySelector('[data-node-count]')?.textContent?.trim() || '',
        running: document.querySelector('[data-runtime-running]')?.textContent?.trim() || '',
        notRunning: document.querySelector('[data-runtime-not-running]')?.textContent?.trim() || '',
        healthy: document.querySelector('[data-health-healthy]')?.textContent?.trim() || '',
        degraded: document.querySelector('[data-health-degraded]')?.textContent?.trim() || '',
        failed: document.querySelector('[data-health-failed]')?.textContent?.trim() || '',
        unknown: document.querySelector('[data-health-unknown]')?.textContent?.trim() || '',
        standby: document.querySelector('[data-health-standby]')?.textContent?.trim() || '',
      },
    };
  });
  report.checks.ui = ui;
  assert(ui.contract === 'turn-functional-overview.v2', `Unexpected UI contract ${ui.contract}`);
  assert(ui.verdict === 'FAIL', `TURN product verdict must remain FAIL until explicit Product Owner acceptance; got ${ui.verdict}`);
  assert(ui.cardCount === 23 && ui.basicCount === 10 && ui.premiumCount === 13, `Unexpected zone coverage ${ui.basicCount}/${ui.premiumCount}/${ui.cardCount}`);
  assert(!ui.unavailable, 'TURN rendered DATA UNAVAILABLE.');
  assert(ui.invalidUnknown.length === 0, `Unjustified UNKNOWN states: ${JSON.stringify(ui.invalidUnknown)}`);
  assert(ui.unactionable.length === 0, `Zones without source/missing/action: ${JSON.stringify(ui.unactionable)}`);
  assert(ui.staticRuntimeGreen === 0, 'Static/local zones are presented as operational green.');
  assert(ui.registryRuntimeGreen === 0, 'Registry-only content is presented as runtime green.');
  assert(ui.premiumPanelPresent, 'Premium operational agent panel is missing.');
  assert(ui.primaryBeforeRegistry, 'Premium operational panel is not positioned before the registry inventory.');
  assert(ui.secondaryRegistryCollapsed, 'Secondary registry inventory is not collapsed by default.');
  assert(ui.visibleSecondaryRegistryNodes === 0, `Secondary registry dominates the visible surface with ${ui.visibleSecondaryRegistryNodes} visible nodes.`);
  assert(ui.staticAgentPanelCount === 0, 'Legacy static iframe agent panel is still rendered.');
  assert(ui.operationalNodeCount === 28 && ui.operationalFieldCoverage === 28, `Operational agent coverage is ${ui.operationalFieldCoverage}/${ui.operationalNodeCount}.`);
  assert(ui.basicSpatialNodeCount === 10, `BASIC spatial coverage is ${ui.basicSpatialNodeCount}/10.`);
  assert(ui.basicOrbitalNodeCount === 10 && ui.basicOrbitalSourceCoverage === 10, `BASIC orbital source coverage is ${ui.basicOrbitalSourceCoverage}/${ui.basicOrbitalNodeCount}.`);
  assert(ui.basicOrbitalCriterionMapCount === 6 && new Set(ui.basicOrbitalCriterionKeys).size === 6, `BASIC exposes ${ui.basicOrbitalCriterionMapCount}/6 unique criterion maps.`);
  assert(ui.basicOrbitalCriterionCoverage === 10, `BASIC criterion status/source coverage is ${ui.basicOrbitalCriterionCoverage}/10.`);
  assert(ui.basicOrbitalContract === overview.contractVersion, `BASIC orbital contract is ${ui.basicOrbitalContract}.`);
  assert(ui.premiumSpatialNodeCount === 28 && ui.premiumSpatialSourceCoverage === 28, `PREMIUM spatial source coverage is ${ui.premiumSpatialSourceCoverage}/${ui.premiumSpatialNodeCount}.`);
  assert(ui.premiumOrbitalNodeCount === 28 && ui.premiumOrbitalSourceCoverage === 28, `PREMIUM orbital source coverage is ${ui.premiumOrbitalSourceCoverage}/${ui.premiumOrbitalNodeCount}.`);
  assert(ui.premiumOrbitalCriterionMapCount === 6 && new Set(ui.premiumOrbitalCriterionKeys).size === 6, `PREMIUM exposes ${ui.premiumOrbitalCriterionMapCount}/6 unique criterion maps.`);
  assert(ui.premiumOrbitalCriterionCoverage === 28, `PREMIUM criterion status/source coverage is ${ui.premiumOrbitalCriterionCoverage}/28.`);
  assert(ui.premiumOrbitalContract === dashboard.contractVersion, `PREMIUM orbital contract is ${ui.premiumOrbitalContract}.`);
  assert(ui.approvedOrbitalPanelCount === 2, `TURN exposes ${ui.approvedOrbitalPanelCount}/2 approved live orbital panels.`);
  assert(ui.incidentDecisionCount === dashboard.incidentPipeline.nonHealthy && ui.incidentQualificationCoverage === ui.incidentDecisionCount, `Incident qualification coverage is ${ui.incidentQualificationCoverage}/${ui.incidentDecisionCount}.`);
  assert(ui.pageCount === 4, `TURN exposes ${ui.pageCount}/4 canonical pages.`);
  assert(ui.registryMissingNodes.length === 0, `Canonical registry identities missing in UI: ${ui.registryMissingNodes.join(', ')}.`);
  const expectedSummary = {
    total: dashboard.nodes.length,
    running: dashboard.nodes.filter((node) => node.runtimePresence === 'OBSERVED').length,
    notRunning: dashboard.nodes.filter((node) => ['ABSENT', 'NOT_OBSERVED'].includes(node.runtimePresence)).length,
    healthy: dashboard.nodes.filter((node) => node.health === 'HEALTHY').length,
    degraded: dashboard.nodes.filter((node) => node.health === 'DEGRADED').length,
    failed: dashboard.nodes.filter((node) => node.health === 'FAILED').length,
    unknown: dashboard.nodes.filter((node) => node.health === 'UNKNOWN').length,
    standby: dashboard.nodes.filter((node) => node.status === 'STANDBY').length,
  };
  for (const [key, expected] of Object.entries(expectedSummary)) {
    assert(ui.operationalSummary[key] === String(expected), `Operational summary ${key} is ${ui.operationalSummary[key]}, expected ${expected}.`);
  }
  assert(ui.decorativeOrbitCount === 0, 'Decorative operational substitute is still rendered.');
  assert(ui.genericReadyBadgeCount === 0, 'Generic OK READY badge is masking the TURN product verdict.');
  assert(ui.genericBrandPosterCount === 0, 'Generic static brand poster dominates the TURN operational surface.');
  assert(ui.genericCommandPanelCount === 0, 'Generic command panel is rendered inside the TURN operational route.');
  assert(ui.genericQuickActionsCount === 0, 'Generic quick actions are rendered inside the TURN operational route.');
  assert(ui.visibleEmptyPageContainerCount === 0, 'A TURN page container is visible without active operational content.');
  assert(ui.operationalEntryCount === 6 && new Set(ui.operationalEntryTargets).size === 6, 'BASIC operational entries are incomplete or duplicate.');
  assert(ui.turnExitHref === '/basic', `TURN exit points to ${ui.turnExitHref || 'nothing'}, expected /basic.`);
  assert(ui.p9ProjectionState === 'live' && ui.p9Source.includes('OPERATIONAL_EVIDENCE'), `P9 operational projection is not live: ${ui.p9ProjectionState} / ${ui.p9Source}`);
  assert(!['', 'DATA UNAVAILABLE', 'ACCES OPERAȚIONAL NECESAR'].includes(ui.authorityStatus), `Authority status is ${ui.authorityStatus}.`);
  assert(report.network.some((entry) => entry.authorizationPresent === true), 'UI request did not carry real Owner Access authorization.');
  assert(report.network.some((entry) => entry.status === 200), 'UI did not receive functional overview HTTP 200.');
  assert(report.pageErrors.length === 0, `Page errors: ${report.pageErrors.join(' | ')}`);

  await page.locator('[data-turn-functional-overview]').screenshot({ path: resolve(evidenceRoot, 'turn-functional-drilldown.png') });
  await page.locator('[data-premium-operational-panel]').screenshot({ path: resolve(evidenceRoot, 'turn-premium-operational-drilldown.png') });
  await page.screenshot({ path: resolve(evidenceRoot, 'turn-functional-overview-full-page.png'), fullPage: true });
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/basic', { timeout: 30_000 }),
    page.locator('[data-turn-exit]').click(),
  ]);
  report.checks.turnExitNavigation = { status: 'PASS', destination: new URL(page.url()).pathname };
  report.browserFields.targetPageStatus = 'PASS';
  report.status = 'PASS';
  report.completedAt = new Date().toISOString();
  await context.close();
} catch (error) {
  report.failure = error instanceof Error ? error.stack || error.message : String(error);
  report.completedAt = new Date().toISOString();
} finally {
  if (browser) await browser.close();
  await writeFile(resolve(evidenceRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ status: report.status, evidenceRoot, browserFields: report.browserFields, failure: report.failure || null }, null, 2)}\n`);
}

if (report.status !== 'PASS') process.exitCode = 1;

async function verifyOperationalEntry(page, entryId, expectedPage, targetSelector) {
  await page.locator(`[data-operational-entry="${entryId}"]`).click();
  await page.waitForSelector(`[data-turn-page="${expectedPage}"]:not([hidden])`);
  assert(await page.locator(targetSelector).count() === 1, `${entryId} target ${targetSelector} is missing.`);
  assert(await page.locator(targetSelector).evaluate((target) => target.getClientRects().length > 0), `${entryId} target ${targetSelector} is not visible.`);
  await page.locator('[data-turn-page-target="basic"]').click();
  await page.waitForSelector('[data-turn-page="basic"]:not([hidden])');
  await page.locator('[data-secondary-registry]').evaluateAll((items) => items.forEach((item) => { if (item instanceof HTMLDetailsElement) item.open = false; }));
}

function validateOverview(overview) {
  assert(overview?.contractVersion === 'turn-functional-overview.v2', 'Functional overview contract missing.');
  assert(overview?.verdict?.turnFunctionalCompleteness === 'FAIL', `TURN product verdict must remain FAIL until explicit Product Owner acceptance; got ${overview?.verdict?.turnFunctionalCompleteness}`);
  assert(overview?.verdict?.productOwnerAcceptance === 'NOT_GRANTED', 'Product Owner acceptance was inferred.');
  assert(overview?.verdict?.finalProductionPass === 'RETRACTED', 'FINAL Production PASS was inferred.');
  assert(overview?.summary?.totalZones === 23, `Expected 23 zones, got ${overview?.summary?.totalZones}`);
  assert(overview?.summary?.unresolvedUnknown === 0, `Unresolved UNKNOWN is ${overview?.summary?.unresolvedUnknown}`);
  assert(overview?.summary?.capabilityMissing === 0, `Missing capabilities: ${overview?.summary?.capabilityMissing}`);
  assert(Array.isArray(overview?.zones) && overview.zones.length === 23, 'Zone payload is incomplete.');
  assert(new Set(overview.zones.map((zone) => zone.id)).size === 23, 'Zone ids are not unique.');
  assert(overview.zones.filter((zone) => zone.tier === 'BASIC').length === 10, 'Basic zone coverage is incomplete.');
  assert(overview.zones.filter((zone) => zone.tier === 'PREMIUM').length === 13, 'Premium zone coverage is incomplete.');
  for (const zone of overview.zones) {
    assert(zone.information && zone.source?.kind && zone.source?.label && zone.action?.label && zone.action?.href, `${zone.id} lacks information/source/action.`);
    assert(zone.status !== 'UNKNOWN' && zone.status !== 'UNCERTAIN', `${zone.id} contains unresolved ${zone.status}.`);
    if (zone.status === 'UNKNOWN_LEGITIMATE') {
      assert(zone.legitimateUnknown === true && zone.unknownReason && zone.implementation, `${zone.id} lacks legitimate UNKNOWN justification.`);
      assert(zone.source.kind === 'LOCAL_DEVICE', `${zone.id} claims legitimate UNKNOWN outside a local source.`);
    }
    if (zone.status === 'OPERATIONAL') {
      assert(!['STATIC_CONTRACT', 'LOCAL_DEVICE'].includes(zone.source.kind), `${zone.id} derives operational green from ${zone.source.kind}.`);
      assert(zone.source.observedAt, `${zone.id} lacks an observation timestamp.`);
    }
    if (zone.status === 'OBSERVED') {
      assert(zone.source.kind === 'EVENT_STORE', `${zone.id} derives observed activity from ${zone.source.kind}.`);
      assert(zone.source.observedAt, `${zone.id} observed activity lacks a timestamp.`);
    }
    if (zone.status === 'ATTENTION') assert(zone.missing && zone.implementation, `${zone.id} ATTENTION lacks cause/action.`);
  }
}

function validateOperationalDashboard(dashboard) {
  assert(dashboard?.contractVersion === 'AGM-PREMIUM-NETWORK-V1', `Operational dashboard contract is ${dashboard?.contractVersion}.`);
  assert(Array.isArray(dashboard?.nodes) && dashboard.nodes.length === 28, `Operational dashboard contains ${dashboard?.nodes?.length ?? 0}/28 nodes.`);
  assert(new Set(dashboard.nodes.map((node) => node.canonicalId)).size === 28, 'Operational dashboard node identities are not unique.');
  assert(Array.isArray(dashboard.capabilityGaps) && dashboard.capabilityGaps.length === 0, `Operational capability gaps: ${JSON.stringify(dashboard.capabilityGaps)}.`);
  assert(dashboard.incidentPipeline?.contractVersion === 'turn-operational-incident-pipeline.v1', 'Operational incident pipeline contract is missing.');
  assert(dashboard.incidentPipeline?.eventStore === 'AuthorityAuditJournal', `Unexpected incident EventStore ${dashboard.incidentPipeline?.eventStore}.`);
  assert(Number.isInteger(dashboard.incidentPipeline?.nonHealthy) && Number.isInteger(dashboard.incidentPipeline?.qualified) && Number.isInteger(dashboard.incidentPipeline?.notRequired), 'Operational incident pipeline counts are missing.');
  for (const node of dashboard.nodes) {
    assert(node.canonicalId && node.kind && node.registryPresence && node.runtimePresence && node.currentFunction && node.currentOperation && node.workloadState, `${node.canonicalId || 'UNKNOWN_ID'} lacks identity/runtime fields.`);
    assert(node.status && node.health && node.freshness && node.dependencyState && node.authorityState?.state, `${node.canonicalId} lacks state/health/dependency/authority fields.`);
    assert(Array.isArray(node.incidents), `${node.canonicalId} lacks correlated incident telemetry.`);
    assert(node.runtimeEvidence?.source && node.activityEvidence?.source && node.activityFreshness, `${node.canonicalId} lacks separated runtime/activity evidence.`);
    assert(node.incidentQualification?.decision && node.incidentQualification?.reasonCode && node.incidentQualification?.rootCauseClassification && node.incidentQualification?.rationale, `${node.canonicalId} lacks incident qualification/root-cause classification.`);
    assert(node.registryPresence === 'PRESENT', `${node.canonicalId} is ${node.registryPresence} in the persistent registry.`);
    assert(node.statusSource !== 'REGISTRY' && node.evidence?.source && node.evidence.source !== 'REGISTRY', `${node.canonicalId} derives runtime from registry.`);
    assert(node.runtimeEvidence.source !== 'REGISTRY' && node.activityEvidence.source !== 'REGISTRY', `${node.canonicalId} contains registry-derived evidence.`);
    if (node.status === 'PASS') {
      assert(node.activityEvidence.observedAt && node.evidence.source !== 'RUNTIME_CAPABILITY_PROBE', `${node.canonicalId} is PASS without real activity evidence.`);
    }
    if (node.runtimeMode === 'HUMAN') {
      assert(node.status === 'STANDBY' && node.runtimePresence === 'NOT_APPLICABLE' && node.health === 'NOT_APPLICABLE', `${node.canonicalId} misrepresents human authority as a runtime process.`);
      assert(node.runtimeEvidence.source === 'NOT_APPLICABLE', `${node.canonicalId} fabricates runtime evidence for human authority.`);
    }
    if (node.status === 'STANDBY' && node.runtimeMode !== 'HUMAN') {
      assert(node.runtimePresence === 'OBSERVED' && node.runtimeEvidence.observedAt, `${node.canonicalId} is STANDBY without a current runtime observation.`);
      assert(node.workloadState !== 'ACTIVE' && node.currentOperation, `${node.canonicalId} masks active work behind STANDBY.`);
    }
    if (node.workloadState === 'ACTIVE') {
      assert(node.status !== 'STANDBY' && node.activityEvidence.source === 'RUNTIME_EVENT' && node.activityEvidence.observedAt, `${node.canonicalId} claims active work without a real runtime event.`);
      assert(['STARTED', 'WORKING'].includes(node.lastRun?.lifecycle), `${node.canonicalId} active workload lacks an active lifecycle event.`);
    }
    if (['FAIL', 'DEGRADED', 'NO_TELEMETRY'].includes(node.status)) {
      assert(node.reason && node.requiredAction, `${node.canonicalId} lacks reason/action for ${node.status}.`);
      assert(['QUALIFIED', 'NOT_REQUIRED'].includes(node.incidentQualification.decision), `${node.canonicalId} has no explicit incident decision.`);
      if (node.incidentQualification.decision === 'QUALIFIED') assert(node.incidentQualification.openIncidentEventId, `${node.canonicalId} qualified without a persistent open EventStore event.`);
    }
  }
  assert(dashboard.controlPlane?.status && dashboard.controlPlane?.statusSource, 'Authority Control Plane evaluation is missing.');
  assert(Array.isArray(dashboard.controlPlane.conflicts) && Array.isArray(dashboard.controlPlane.activeCommandChains) && Array.isArray(dashboard.controlPlane.invalidOrStaleAuthority), 'Authority conflict/chain/staleness evaluation is incomplete.');
  assert(dashboard.opportunityIntelligence?.gate && dashboard.opportunityIntelligence?.reason && Array.isArray(dashboard.opportunityIntelligence.sources), 'Opportunity Intelligence evaluation is incomplete.');
}

async function dismissFirstRun(page, checks) {
  const legalAcceptance = page.locator('#acceptLegalNotice');
  if (await legalAcceptance.isVisible().catch(() => false)) {
    await legalAcceptance.click();
    await page.waitForSelector('.legal-acceptance-overlay', { state: 'detached', timeout: 15_000 });
    checks.legalAcceptance = 'ACCEPTED_FOR_CONTROLLED_SESSION';
  }
  const skipTutorial = page.locator('#skipTutorial');
  if (await skipTutorial.isVisible().catch(() => false)) {
    await skipTutorial.click();
    await page.waitForSelector('.tutorial-overlay', { state: 'detached', timeout: 15_000 });
    checks.firstRunTutorial = 'DISMISSED_FOR_CONTROLLED_SESSION';
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
