import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchTurnFunctionalOverview } from '../src/turn-functional-overview';

const payload = {
  data: {
    contractVersion: 'turn-functional-overview.v2',
    generatedAt: '2026-09-04T12:00:00.000Z',
    verdict: { turnFunctionalCompleteness: 'FAIL', productOwnerAcceptance: 'NOT_GRANTED', finalProductionPass: 'RETRACTED' },
    summary: { totalZones: 23, operational: 1, observed: 4, attention: 1, noActivity: 8, staticReference: 2, capabilityMissing: 0, legitimateUnknown: 0, unresolvedUnknown: 0 },
    zones: [],
  },
};
let observedUrl = '';
const fetcher = (async (input: RequestInfo | URL) => {
  observedUrl = String(input);
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

const result = await fetchTurnFunctionalOverview(fetcher);
assert.equal(observedUrl, '/operations/turn/functional-overview');
assert.equal(result.verdict.productOwnerAcceptance, 'NOT_GRANTED');
assert.equal(result.verdict.finalProductionPass, 'RETRACTED');
assert.equal(result.summary.unresolvedUnknown, 0);

const mainSource = await readFile(resolve('src/main.ts'), 'utf8');
const navigationSource = await readFile(resolve('src/turn-command-navigation.ts'), 'utf8');
const premiumViewSource = await readFile(resolve('src/premium-governance/premium-governance.view.ts'), 'utf8');
const turnViewSource = await readFile(resolve('src/turn-command-center.view.ts'), 'utf8');
const operationsCssSource = await readFile(resolve('src/styles/30-operations.css'), 'utf8');
assert.match(mainSource, /premiumLayout \|\| state\.view === 'turn' \? '' : `<header class="topbar">/);
assert.match(mainSource, /premiumLayout \|\| state\.view === 'turn' \? '' : renderCommandPanel\(\)/);
assert.match(mainSource, /\$\{renderGlobalQuickActions\(\)\}/);
assert.match(premiumViewSource, /data-premium-operational-panel data-turn-page-container hidden/);
assert.match(navigationSource, /container\.hidden = !container\.querySelector\('\[data-turn-page\]:not\(\[hidden\]\)'\)/);
assert.match(navigationSource, /closest<HTMLDetailsElement>\('details'\)/);
assert.match(navigationSource, /\['basic', 'premium', 'orchestrators', 'incidents', 'investigate'\]/);
assert.match(operationsCssSource, /\.turn-basic-spatial-page:not\(\[hidden\]\)\{display:flex/);
assert.doesNotMatch(operationsCssSource, /\.turn-basic-spatial-page\{display:flex/);
for (const entry of ['p9', 'event-store', 'canonical-agent-registry', 'organization-chart', 'departments', 'agent-control-panel']) {
  assert.match(turnViewSource, new RegExp(`\\['${entry}'`));
}
assert.match(turnViewSource, /data-operational-entry="\$\{id\}"/);
assert.match(turnViewSource, /id="turn-agent-control-panel"/);
assert.match(turnViewSource, /id="turn-agent-register"/);
assert.match(turnViewSource, /data-basic-operational-orbit/);
assert.match(turnViewSource, /data-basic-orbital-stage/);
assert.match(turnViewSource, /data-basic-orbital-criteria/);
assert.match(turnViewSource, /data-basic-orbital-criterion-maps/);
assert.match(turnViewSource, /data-basic-agent-planetary-panel/);
assert.match(turnViewSource, /data-basic-agent-planetary-stage/);
assert.match(turnViewSource, /data-basic-agent-planetary-criteria/);
assert.match(turnViewSource, /Premium nu este proiectat în acest panou/);
assert.match(turnViewSource, /turn-investigation-runtime" data-turn-page="investigate" hidden/);
assert.match(turnViewSource, /data-turn-page-target="orchestrators"/);
assert.match(turnViewSource, /data-turn-page="orchestrators"/);
assert.match(turnViewSource, /createDomainOrchestrators/);
assert.match(turnViewSource, /premium\.orchestrator/);
assert.match(turnViewSource, /href="\/basic" data-module="basic" data-turn-exit/);
const overviewRuntimeSource = await readFile(resolve('src/turn-functional-overview.ts'), 'utf8');
const panelRuntimeSource = await readFile(resolve('src/turn-agent-panel.integration.ts'), 'utf8');
assert.match(overviewRuntimeSource, /const basicZones = overview\.zones\.filter\(\(zone\) => zone\.tier === 'BASIC'\)/);
assert.match(overviewRuntimeSource, /aggregateBasicAgentStatus/);
assert.match(overviewRuntimeSource, /data-basic-orbital-node/);
assert.match(overviewRuntimeSource, /data-orbital-evidence-source="\$\{escapeHtml\(zone\.source\.kind\)\}"/);
assert.match(overviewRuntimeSource, /evaluateBasicOrbitalCriteria/);
assert.match(overviewRuntimeSource, /NO INCIDENT CLAIM IN BASIC CONTRACT/);
assert.match(overviewRuntimeSource, /no freshness SLA claim/);
assert.match(overviewRuntimeSource, /data-orbital-\$\{criterion\}-status/);
assert.match(overviewRuntimeSource, /data-orbital-\$\{criterion\}-source/);
for (const criterion of ['functional', 'telemetry', 'procedural', 'component', 'incidents', 'freshness']) {
  assert.match(turnViewSource, new RegExp(`data-basic-orbital-criterion="${criterion}"`));
  assert.match(overviewRuntimeSource, new RegExp(`\\b${criterion}: \\{ status:`));
}
for (const criterion of ['operational', 'telemetry', 'procedural', 'component', 'incidents', 'freshness']) {
  assert.match(turnViewSource, new RegExp(`data-basic-agent-planetary-criterion="${criterion}"`));
}
const ingestBody = panelRuntimeSource.slice(panelRuntimeSource.indexOf('export function ingestBasicAgentOperationalDashboard'), panelRuntimeSource.indexOf('export function resetBasicAgentOperationalDashboardForTest'));
const publishBody = panelRuntimeSource.slice(panelRuntimeSource.indexOf('export function publishPanelAgentModel'), panelRuntimeSource.indexOf('export function panelAgentMappingReport'));
assert.match(ingestBody, /renderBasicAgentPlanetaryModel/);
assert.match(publishBody, /renderBasicAgentPlanetaryModel/);
assert.match(panelRuntimeSource, /\.filter\(\(record\) => !premiumGovernanceAgentIds\.has\(record\.id\)\)/);
for (const premiumId of ['premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv']) assert.match(panelRuntimeSource, new RegExp(`'${premiumId}'`));
assert.equal((panelRuntimeSource.match(/Operational Linguistic Baseline V1 · typed API state · 1\.726 resurse/g) ?? []).length, 3);
assert.doesNotMatch(panelRuntimeSource, /Component heartbeat v1 · audit runtime/);
assert.match(turnViewSource, /AGM BASIC AGENT GOVERNANCE MAP/);
assert.doesNotMatch(turnViewSource, /AGM GOVERNANCE IDENTITY MAP|AGM AGENT RUNTIME MAP/);
assert.match(overviewRuntimeSource, /Nu se fabrică planete din registry/);
console.log('TURN_FUNCTIONAL_OVERVIEW_WEB_CONTRACT=PASS');
