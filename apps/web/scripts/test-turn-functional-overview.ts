import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchTurnFunctionalOverview } from '../src/turn-functional-overview';
import { basicAgentNetworkContract } from '../src/turn-agent-panel.integration';

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
assert.equal(basicAgentNetworkContract, 'AGM-BASIC-AGENT-RUNTIME-MAP-V3');

const mainSource = await readFile(resolve('src/main.ts'), 'utf8');
const navigationSource = await readFile(resolve('src/turn-command-navigation.ts'), 'utf8');
const premiumViewSource = await readFile(resolve('src/premium-governance/premium-governance.view.ts'), 'utf8');
const turnViewSource = await readFile(resolve('src/turn-command-center.view.ts'), 'utf8');
const panelRuntimeSource = await readFile(resolve('src/turn-agent-panel.integration.ts'), 'utf8');
assert.match(mainSource, /premiumLayout \|\| state\.view === 'turn' \? '' : `<header class="topbar">/);
assert.match(mainSource, /premiumLayout \|\| state\.view === 'turn' \? '' : renderCommandPanel\(\)/);
assert.match(mainSource, /state\.view === 'turn' \? '' : renderGlobalQuickActions\(\)/);
assert.match(premiumViewSource, /data-premium-operational-panel data-turn-page-container hidden/);
assert.match(navigationSource, /container\.hidden = !container\.querySelector\('\[data-turn-page\]:not\(\[hidden\]\)'\)/);
assert.match(navigationSource, /closest<HTMLDetailsElement>\('details'\)/);
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
assert.match(turnViewSource, /Exact aceiași agenți non-umani/);
assert.match(turnViewSource, /Registry\/catalog\/config nu furnizează status și nu este fallback/);
assert.match(turnViewSource, /href="\/basic" data-module="basic" data-turn-exit/);
const overviewRuntimeSource = await readFile(resolve('src/turn-functional-overview.ts'), 'utf8');
assert.match(panelRuntimeSource, /buildRuntimeAccountabilityPlanetNodes/);
assert.match(panelRuntimeSource, /snapshot\.agents/);
assert.match(panelRuntimeSource, /data-basic-agent-planetary-node/);
assert.match(panelRuntimeSource, /data-basic-agent-runtime-source="AGENT_RUNTIME_ACCOUNTABILITY"/);
assert.match(panelRuntimeSource, /data-basic-agent-runtime-evidence/);
assert.match(panelRuntimeSource, /snapshot\.verdict\.finalAgentRuntimePass/);
assert.match(panelRuntimeSource, /registry\/catalog nu este fallback/);
const runtimeRenderer = panelRuntimeSource.slice(panelRuntimeSource.indexOf('function renderBasicAgentPlanetaryModel'), panelRuntimeSource.indexOf('function basicAgentPlanetaryPositions'));
assert.doesNotMatch(runtimeRenderer, /agentGovernanceRegistry|buildBasicAgentNetworkModel/);
assert.doesNotMatch(overviewRuntimeSource, /renderBasicAgentPlanetarySystem/);
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
assert.match(overviewRuntimeSource, /Nu se fabrică planete din registry/);
console.log('TURN_FUNCTIONAL_OVERVIEW_WEB_CONTRACT=PASS');
