import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'evidence', 'operational-linguist-v1', 'browser', runId);
const requests = [];
const legacyAttempts = [];
const pageErrors = [];
let alignment = null;
let server;
let browser;
let target = process.env.AGM_OPERATIONAL_LINGUIST_URL?.trim() ?? '';
let fatal = null;

const components = ['it', 'es', 'sv'].map((language) => ({
  componentId: `premium-linguist-${language}`,
  language,
  operationalState: 'ONLINE',
  current: true,
  observedAt: '2026-09-23T06:00:00.000Z',
}));

const observedAt = '2026-09-23T06:00:00.000Z';
const linguisticIds = components.map((component) => component.componentId);
const android160BasicAgentIds = [
  'monitor-server-primary', 'monitor-server-backup', 'monitor-api', 'monitor-browser', 'monitor-android', 'monitor-ai',
  'monitor-database', 'monitor-cloudflare', 'monitor-ui-live', 'monitor-incidents', 'monitor-telemetry', 'monitor-security',
  'p9-copilot-control-plane', 'secret-credentials-guardian', 'version-guardian', 'architecture-guardian', 'release-operations',
  'frontend-experience', 'website-content-visual-guardian', 'website-runtime-release-guardian', 'backend-infrastructure',
  'i18n-localization', 'documentation', 'agent-codex', 'agent-inspector', 'infrastructure-reuse-coordinator', 'agent-mentor',
  'agent-legal', 'agent-linguistic-ro-de', 'agent-linguistic-ro-en', 'agent-linguistic-de-en', 'agent-linguistic-librarian',
  'director-turn-operations', 'agent-agm-chronicler',
];
const functionalOverview = {
  contractVersion: 'turn-functional-overview.v2',
  generatedAt: observedAt,
  verdict: { turnFunctionalCompleteness: 'FAIL', productOwnerAcceptance: 'NOT_GRANTED', finalProductionPass: 'RETRACTED' },
  summary: { totalZones: 0, operational: 0, observed: 0, attention: 0, noActivity: 0, staticReference: 0, capabilityMissing: 0, legitimateUnknown: 0, unresolvedUnknown: 0 },
  zones: [],
};
const incidentQualification = {
  decision: 'NOT_REQUIRED', severity: 'NONE', reasonCode: 'HEALTHY_CURRENT_STATE', rootCauseClassification: 'NONE',
  rationale: 'Canonical V1 state is current and healthy.', evaluatedAt: observedAt, evidenceReference: 'agm.operational-linguist.v1', openIncidentEventId: null,
};
function dashboardNode(canonicalId, kind, supervisorId = null) {
  const linguistic = linguisticIds.includes(canonicalId);
  return {
    canonicalId, kind, module: linguistic ? 'Premium Linguists' : 'Premium Control Plane', ownerId: 'agm-owner', supervisorId,
    scope: linguistic ? `linguistic:${canonicalId.slice(-2)}` : 'premium:authority', registryPresence: 'PRESENT', lifecycleStatus: 'active',
    runtimeMode: 'SERVICE', runtimePresence: 'OBSERVED', currentFunction: linguistic ? 'Operational linguistic validation' : 'Premium authority coordination',
    currentOperation: linguistic ? 'Canonical V1 state observation' : 'Authority evaluation', workloadState: 'ACTIVE', status: 'PASS', statusLabel: 'PASS',
    statusSource: linguistic ? 'agm.operational-linguist.v1' : 'authority-control-plane', statusObservedAt: observedAt, health: 'HEALTHY', freshness: 'CURRENT', activityFreshness: 'CURRENT',
    lastHeartbeat: observedAt, lastActivity: observedAt, reason: 'CANONICAL_EVIDENCE_CURRENT', requiredAction: null, dependencyState: 'HEALTHY', dependencyFailures: [], incidents: [],
    evidence: { source: linguistic ? 'OperationalLinguistState' : 'AuthorityControlPlane', observedAt, recordReference: `${canonicalId}:canonical` },
    runtimeEvidence: { source: 'typed-api-state', observedAt, recordReference: `${canonicalId}:runtime` },
    activityEvidence: { source: 'canonical-evidence', observedAt, recordReference: `${canonicalId}:activity` },
    authorityState: { state: 'ACTIVE', epoch: 1, fencingToken: 1, providerId: 'controlled-runner', expiresAt: '2026-09-23T07:00:00.000Z' },
    failoverState: 'PROVEN', incidentQualification,
  };
}
const operationalDashboard = {
  contractVersion: 'turn-operational-dashboard.v2', generatedAt: observedAt,
  controlPlane: { status: 'PASS', statusSource: 'controlled-canonical-fixture', statusObservedAt: observedAt, activeExecutiveAuthorities: 1, executiveAuthorityAgents: ['agm.authority.control-plane'], conflicts: [], activeCommandChains: [], delegatedAuthority: [], invalidOrStaleAuthority: [] },
  nodes: [
    dashboardNode('agm.authority.control-plane', 'CONTROL_PLANE'),
    ...linguisticIds.map((id) => dashboardNode(id, 'AGENT', 'agm.authority.control-plane')),
  ],
  departments: [{ module: 'Premium Control Plane', nodeCount: 1 }, { module: 'Premium Linguists', nodeCount: 3 }],
  opportunityIntelligence: { gate: 'GO', reason: 'CANONICAL_INPUTS_CURRENT', requiredAction: null, evaluatedAt: observedAt, missing: [], stale: [], unhealthy: [], sources: [] },
  incidents: [], capabilityGaps: [],
  incidentPipeline: { contractVersion: 'turn-operational-incident-pipeline.v1', eventStore: 'CONTROLLED', evaluatedAt: observedAt, nonHealthy: 0, qualified: 0, notRequired: 4, open: 0, opened: 0, resolved: 0 },
};

await mkdir(output, { recursive: true });
try {
  if (!target) {
    const port = await freePort();
    const vite = path.join(root, 'apps', 'web', 'node_modules', 'vite', 'bin', 'vite.js');
    server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: path.join(root, 'apps', 'web'),
      windowsHide: true,
      stdio: 'ignore',
    });
    target = `http://127.0.0.1:${port}/turn`;
    await waitForTarget(target);
  } else {
    const response = await fetch(target, { signal: AbortSignal.timeout(15_000) });
    assert(response.status === 200, `Production target HTTP ${response.status}`);
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'ro-RO', serviceWorkers: 'block' });
  await context.addInitScript(() => {
    localStorage.setItem('agm.legal.acceptance.privacy-v2026.07.13.terms-v2026.07.13', JSON.stringify({ privacyPolicyVersion: 'privacy-v2026.07.13', termsVersion: 'terms-v2026.07.13', acceptedAt: new Date().toISOString() }));
    localStorage.setItem('agm.tutorial.completed.v1', new Date().toISOString());
  });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data, requestId: 'controlled-operational-linguist-v1-browser' }) });
    if (pathname.endsWith('/turn-admin/refresh')) return json({ accessToken: 'controlled-browser-observer-session', expiresInSeconds: 600 });
    if (pathname.endsWith('/turn-admin/validate')) return json({ valid: true });
    if (pathname.endsWith('/operations/turn/operational-linguists/state')) {
      requests.push({ method: request.method(), pathname, authenticated: request.headers().authorization === 'Bearer controlled-browser-observer-session' });
      return json({ baselineVersion: 'agm.operational-linguist.v1', status: 'ACTIVE', components });
    }
    if (pathname.endsWith('/operations/turn/functional-overview')) return json(functionalOverview);
    if (pathname.endsWith('/operations/turn/operational-dashboard')) return json(operationalDashboard);
    if (/\/operations\/(?:turn\/)?components\/premium-linguist-(?:it|es|sv)\/heartbeat$/.test(pathname)) {
      legacyAttempts.push({ method: request.method(), pathname });
      return json({ code: 'LEGACY_OPERATIONAL_LINGUIST_HEARTBEAT_FENCED' }, 409);
    }
    if (pathname.endsWith('/health/live')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    if (pathname.endsWith('/health/ready')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready', dependencies: {} }) });
    if (pathname.includes('/api/v1/')) return json([]);
    return route.continue();
  });

  const firstPage = await context.newPage();
  firstPage.on('pageerror', (error) => pageErrors.push(error.message));
  const firstNavigation = await firstPage.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert(firstNavigation?.status() === 200, `Initial target HTTP ${firstNavigation?.status()}`);
  await firstPage.waitForFunction(() => {
    const entries = JSON.parse(localStorage.getItem('agm.turn.telemetry-snapshots.v1') ?? '[]');
    return ['premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv'].every((id) => entries.some(([entryId, value]) => entryId === id && value.status === 'ONLINE' && value.reason === 'V1_CANONICAL_STATE_OBSERVED'));
  }, undefined, { timeout: 30_000 });
  await firstPage.locator('body').screenshot({ path: path.join(output, 'v1-observer-initial.png') });
  const reloadNavigation = await firstPage.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert(reloadNavigation?.status() === 200, `Reloaded target HTTP ${reloadNavigation?.status()}`);
  await firstPage.waitForFunction(() => {
    const entries = JSON.parse(localStorage.getItem('agm.turn.telemetry-snapshots.v1') ?? '[]');
    return ['premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv'].every((id) => entries.some(([entryId, value]) => entryId === id && value.status === 'ONLINE' && value.reason === 'V1_CANONICAL_STATE_OBSERVED'));
  }, undefined, { timeout: 30_000 });
  await firstPage.locator('body').screenshot({ path: path.join(output, 'v1-observer-after-reload.png') });
  await firstPage.close();

  const reopenedPage = await context.newPage();
  reopenedPage.on('pageerror', (error) => pageErrors.push(error.message));
  const reopenNavigation = await reopenedPage.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert(reopenNavigation?.status() === 200, `Reopened target HTTP ${reopenNavigation?.status()}`);
  await reopenedPage.waitForFunction(() => {
    const entries = JSON.parse(localStorage.getItem('agm.turn.telemetry-snapshots.v1') ?? '[]');
    return ['premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv'].every((id) => entries.some(([entryId, value]) => entryId === id && value.status === 'ONLINE' && value.reason === 'V1_CANONICAL_STATE_OBSERVED'));
  }, undefined, { timeout: 30_000 });
  await reopenedPage.waitForSelector('[data-turn-page="basic"]:not([hidden]) [data-basic-agent-planetary-stage][aria-busy="false"]', { timeout: 15_000 });
  await reopenedPage.locator('[data-turn-page="basic"] [data-basic-agent-planetary-node]').first().waitFor({ state: 'visible', timeout: 15_000 });
  await reopenedPage.waitForTimeout(1_500);
  await reopenedPage.screenshot({ path: path.join(output, 'android-1.6-reference-basic-before-check.png'), fullPage: true });
  const basicTitle = (await reopenedPage.locator('#turn-functional-overview-title').innerText()).trim();
  const basicIds = await reopenedPage.locator('[data-turn-page="basic"] [data-basic-agent-planetary-node]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-basic-agent-planetary-node')));
  const basicPremiumIds = basicIds.filter((id) => id?.startsWith('premium-linguist-'));
  const basicVisibleNodeCount = await reopenedPage.locator('[data-turn-page="basic"] [data-basic-agent-planetary-node]').evaluateAll((nodes) => nodes.filter((node) => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  }).length);
  assert(basicTitle === 'AGM BASIC AGENT GOVERNANCE MAP', `Android 1.6.0 BASIC title contract diverged: ${basicTitle}`);
  assert(JSON.stringify(basicIds) === JSON.stringify(android160BasicAgentIds), `BASIC agent panel differs from Android 1.6.0: ${JSON.stringify(basicIds)}`);
  assert(basicVisibleNodeCount === android160BasicAgentIds.length, `BASIC agent panel is not visibly rendered: ${basicVisibleNodeCount}/${android160BasicAgentIds.length}`);
  assert(basicPremiumIds.length === 0, `Premium linguists leaked into BASIC: ${JSON.stringify(basicPremiumIds)}`);
  const basicSelectableId = await reopenedPage.locator('[data-turn-page="basic"] [data-basic-agent-planetary-stage]').evaluate((stage) => {
    const core = stage.querySelector('[data-basic-agent-planetary-core]')?.getBoundingClientRect();
    const node = [...stage.querySelectorAll('[data-basic-agent-planetary-node]')].find((candidate) => {
      const box = candidate.getBoundingClientRect();
      return core && (box.right < core.left || box.left > core.right || box.bottom < core.top || box.top > core.bottom);
    });
    return node?.getAttribute('data-basic-agent-planetary-node') ?? null;
  });
  assert(basicSelectableId, 'BASIC agent panel has no selectable node outside the canonical core.');
  await reopenedPage.locator(`[data-turn-page="basic"] [data-basic-agent-planetary-node="${basicSelectableId}"]`).click();
  const basicSelection = await reopenedPage.locator('[data-turn-page="basic"] [data-basic-agent-planetary-selection]').innerText();
  assert(basicSelection.includes(basicSelectableId), `BASIC agent selection is not functional: ${basicSelection}`);
  await reopenedPage.screenshot({ path: path.join(output, 'android-1.6-reference-basic.png'), fullPage: true });
  await reopenedPage.locator('[data-turn-page-target="premium"]').click();
  await reopenedPage.waitForSelector('[data-turn-page="premium"]:not([hidden])', { timeout: 15_000 });
  await reopenedPage.waitForSelector('[data-authority-dashboard][aria-busy="false"]', { timeout: 15_000 });
  const premiumIds = await reopenedPage.locator('[data-turn-page="premium"] [data-premium-orbital-node]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-premium-orbital-node')));
  const premiumLabels = await reopenedPage.locator('[data-turn-page="premium"] [data-premium-orbital-node]').evaluateAll((nodes) => nodes.filter((node) => node.getAttribute('data-premium-orbital-node')?.startsWith('premium-linguist-')).map((node) => node.textContent?.trim()));
  const positions = await reopenedPage.locator('[data-turn-page="premium"] [data-premium-orbital-node]').evaluateAll((nodes) => nodes.filter((node) => node.getAttribute('data-premium-orbital-node')?.startsWith('premium-linguist-')).map((node) => {
    const box = node.getBoundingClientRect();
    const stage = node.closest('[data-premium-orbital-stage]')?.getBoundingClientRect();
    return { id: node.getAttribute('data-premium-orbital-node'), x: Math.round(box.x), y: Math.round(box.y), visible: box.width > 0 && box.height > 0, insideStage: Boolean(stage && box.left >= stage.left && box.right <= stage.right && box.top >= stage.top && box.bottom <= stage.bottom) };
  }));
  const selections = [];
  for (const id of linguisticIds) {
    await reopenedPage.locator(`[data-turn-page="premium"] [data-premium-orbital-node="${id}"]`).click();
    selections.push({ id, text: await reopenedPage.locator('[data-turn-page="premium"] [data-premium-orbital-selection]').innerText() });
  }
  const visiblePremiumText = await reopenedPage.locator('[data-turn-page="premium"]:not([hidden])').innerText();
  assert(linguisticIds.every((id) => premiumIds.filter((candidate) => candidate === id).length === 1), `Premium linguistic nodes missing or duplicated: ${JSON.stringify(premiumIds)}`);
  assert(JSON.stringify(premiumLabels) === JSON.stringify(['Linguist IT', 'Linguist ES', 'Linguist SV']), `Premium linguistic labels are not readable/canonical: ${JSON.stringify(premiumLabels)}`);
  assert(basicPremiumIds.length === 0, `Premium linguists leaked into BASIC: ${JSON.stringify(basicPremiumIds)}`);
  assert(positions.length === 3 && positions.every((position) => position.visible && position.insideStage), `Premium linguistic nodes are not visibly positioned inside Premium: ${JSON.stringify(positions)}`);
  assert(new Set(positions.map((position) => `${position.x}:${position.y}`)).size === 3, `Premium linguistic nodes overlap: ${JSON.stringify(positions)}`);
  assert(selections.every(({ id, text }) => text.includes(id) && text.includes('PASS') && text.includes('HEALTHY') && text.includes('OperationalLinguistState')), `Premium V1 linguistic interaction failed: ${JSON.stringify(selections)}`);
  assert(!visiblePremiumText.includes('DATA UNAVAILABLE'), 'Visible Premium page contains DATA UNAVAILABLE.');
  assert((await reopenedPage.locator('[data-control-status]').innerText()).trim() === 'PASS', 'Premium control plane did not render PASS from the canonical fixture.');
  alignment = { generation: 'OPERATIONAL_LINGUIST_V1_ONLY', persistence: 'OperationalLinguistState', reload: 'PASS', reopen: 'PASS', basicTitle, basicIds, basicVisibleNodeCount, basicPremiumIds, basicSelection: { id: basicSelectableId, selected: true }, premiumIds: linguisticIds, premiumLabels, positions, selections: selections.map(({ id }) => ({ id, selected: true, evidenceSource: 'OperationalLinguistState' })), visibleStatus: 'PASS', responsive: [] };
  await reopenedPage.screenshot({ path: path.join(output, 'v1-observer-after-reopen.png'), fullPage: true });
  for (const viewport of [{ name: 'tablet', width: 1024, height: 768 }, { name: 'phone', width: 390, height: 844 }]) {
    await reopenedPage.setViewportSize(viewport);
    const responsive = await reopenedPage.evaluate((ids) => {
      const stage = document.querySelector('[data-turn-page="premium"] [data-premium-orbital-stage]')?.getBoundingClientRect();
      const nodes = ids.map((id) => {
        const node = document.querySelector(`[data-turn-page="premium"] [data-premium-orbital-node="${id}"]`);
        const box = node?.getBoundingClientRect();
        return { id, visible: Boolean(box && box.width > 0 && box.height > 0), insideStage: Boolean(stage && box && box.left >= stage.left - 1 && box.right <= stage.right + 1 && box.top >= stage.top - 1 && box.bottom <= stage.bottom + 1) };
      });
      const rect = (selector) => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return box ? { top: Math.round(box.top), bottom: Math.round(box.bottom), height: Math.round(box.height), visible: box.width > 0 && box.height > 0 } : null;
      };
      const flow = {
        heading: rect('[data-turn-page="premium"] > .premium-governance-heading'),
        panel: rect('[data-turn-page="premium"] [data-premium-operational-orbit]'),
        panelHeader: rect('[data-turn-page="premium"] [data-premium-operational-orbit] > header'),
        criteria: rect('[data-turn-page="premium"] [data-premium-orbital-criteria]'),
        stage: rect('[data-turn-page="premium"] [data-premium-orbital-stage]'),
        maps: rect('[data-turn-page="premium"] [data-premium-orbital-criterion-maps]'),
        selection: rect('[data-turn-page="premium"] [data-premium-orbital-selection]'),
        operationalHeader: rect('[data-turn-page="premium"] .agm-operational-header'),
      };
      const ordered = [flow.heading, flow.panelHeader, flow.criteria, flow.stage, flow.maps, flow.selection, flow.operationalHeader].filter(Boolean);
      const gaps = ordered.slice(1).map((item, index) => item.top - ordered[index].bottom);
      return { nodes, flow, maxPrimaryGap: Math.max(0, ...gaps), horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    }, linguisticIds);
    assert(responsive.nodes.every((node) => node.visible && node.insideStage), `${viewport.name} Premium linguistic positioning failed: ${JSON.stringify(responsive)}`);
    assert(Object.values(responsive.flow).every((item) => item?.visible), `${viewport.name} Premium flow contains a hidden section: ${JSON.stringify(responsive.flow)}`);
    assert(responsive.maxPrimaryGap <= 64, `${viewport.name} Premium flow contains a large vertical gap: ${JSON.stringify(responsive.flow)}`);
    assert(!responsive.horizontalOverflow, `${viewport.name} Premium page has horizontal overflow.`);
    alignment.responsive.push({ ...viewport, ...responsive });
    await reopenedPage.screenshot({ path: path.join(output, `v1-premium-${viewport.name}.png`), fullPage: true });
  }

  assert(requests.length >= 3, `Expected observer state GET after initial load, reload, and reopen, got ${requests.length}`);
  assert(requests.every((request) => request.method === 'GET' && request.authenticated), 'V1 observer request was not an authenticated GET');
  assert(legacyAttempts.length === 0, `Legacy browser heartbeat attempts detected: ${JSON.stringify(legacyAttempts)}`);
  assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);
  await context.close();
} catch (error) {
  fatal = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await browser?.close();
  server?.kill();
  const report = {
    schemaVersion: 1,
    runId,
    status: fatal ? 'FAIL' : 'PASS',
    runner: 'Controlled AGM Playwright/Chromium',
    browserPluginStatus: 'PASS',
    integratedBrowserControlStatus: 'PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE',
    browserSessionStatus: fatal ? 'FAIL' : 'PASS',
    targetPageStatus: fatal ? 'FAIL' : 'PASS',
    target,
    probe: 'TURN -> Owner/session restore -> V1 state observation -> reload -> close/reopen -> Premium navigation -> capture',
    browserAuthority: 'NONE',
    observerRequests: requests,
    legacyAttempts,
    alignment,
    pageErrors,
    fatal,
    finishedAt: new Date().toISOString(),
  };
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ report: path.join(output, 'report.json'), ...report }, null, 2));
  if (fatal) process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForTarget(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(url)).status === 200) return;
    } catch { /* controlled startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('CONTROLLED_TARGET_UNAVAILABLE');
}
