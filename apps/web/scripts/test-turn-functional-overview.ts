import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchTurnFunctionalOverview } from '../src/turn-functional-overview';
import { basicAgentNetworkContract, buildBasicAgentNetworkModel } from '../src/turn-agent-panel.integration';

const payload = {
  data: {
    contractVersion: 'turn-functional-overview.v2',
    generatedAt: '2026-09-04T12:00:00.000Z',
    verdict: { turnFunctionalCompleteness: 'FAIL', productOwnerAcceptance: 'NOT_GRANTED', finalProductionPass: 'RETRACTED' },
    summary: { totalZones: 23, operational: 1, observed: 4, attention: 1, noActivity: 8, staticReference: 2, capabilityMissing: 0, legitimateUnknown: 0, unresolvedUnknown: 0 },
    zones: [],
  },
};
let observedAuthorization = '';
const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  observedAuthorization = new Headers(init?.headers).get('Authorization') ?? '';
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

const result = await fetchTurnFunctionalOverview('owner-token', fetcher);
assert.equal(observedAuthorization, 'Bearer owner-token');
assert.equal(result.verdict.productOwnerAcceptance, 'NOT_GRANTED');
assert.equal(result.verdict.finalProductionPass, 'RETRACTED');
assert.equal(result.summary.unresolvedUnknown, 0);
const basicAgents = buildBasicAgentNetworkModel();
assert.equal(basicAgentNetworkContract, 'AGM-BASIC-AGENT-NETWORK-V1');
assert.equal(basicAgents.length, 37);
assert.equal(new Set(basicAgents.map((agent) => agent.record.id)).size, 37);
assert(basicAgents.every((agent) => agent.criteria.operational.status === 'NO_TELEMETRY'), 'Registry identity was promoted to runtime without a real probe.');

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
assert.match(turnViewSource, /toate cele 37 de identități din Registrul oficial de agenți/);
assert.match(turnViewSource, /Cele 10 submodule BASIC rămân separat/);
assert.match(turnViewSource, /href="\/basic" data-module="basic" data-turn-exit/);
const overviewRuntimeSource = await readFile(resolve('src/turn-functional-overview.ts'), 'utf8');
assert.match(panelRuntimeSource, /buildBasicAgentNetworkModel/);
assert.match(panelRuntimeSource, /agentGovernanceRegistry\.map/);
assert.match(panelRuntimeSource, /data-basic-agent-planetary-node/);
assert.match(panelRuntimeSource, /data-basic-agent-registry-presence="PRESENT"/);
assert.match(panelRuntimeSource, /data-basic-agent-runtime-evidence/);
assert.match(panelRuntimeSource, /IDENTITY_PRESENT · LIVE_RUNTIME_SOURCE_NOT_MAPPED/);
assert.match(panelRuntimeSource, /runtimeEvidence === 'REAL_PROBE'/);
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
