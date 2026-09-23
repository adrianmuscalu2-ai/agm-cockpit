import { canonicalLinguisticResourceCounts } from '@agm/shared';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COMPONENT_TELEMETRY_CONTRACT } from '../../api/src/component-telemetry/component-telemetry.contract';
import { premiumNetworkSeed } from '../../api/src/authority-control-plane/premium-network.seed';
import { agentGovernanceRegistry } from '../src/agent-governance.registry';
import { premiumLinguisticCapabilities } from '../src/premium-linguistic-agents/premium-linguistic-agents.contract';
import { premiumLinguisticAgents } from '../src/premium-linguistic-agents/premium-linguistic-agents.registry';
import {
  auditCanonicalOperationalLinguist,
  operationalLinguistV1Targets,
} from '../src/premium-linguistic-agents/operational-linguist-v1.resource-audit';
import { panelAgentSources } from '../src/turn-agent-panel.integration';
import { turnOrganizationAgents } from '../src/turn-organization-chart';

const expectedCounts = canonicalLinguisticResourceCounts();
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const observerSource = readFileSync(new URL('../src/premium-linguistic-agents/operational-linguist-v1.observer.ts', import.meta.url), 'utf8');

assert.doesNotMatch(mainSource, /premium-linguistic-agents\.runtime|bindPremiumLinguisticAgentHeartbeats/, 'Browser must not publish operational linguistic evidence');
assert.match(mainSource, /bindOperationalLinguistV1Observer/, 'Browser must observe typed V1 state');
assert.match(observerSource, /method: 'GET'/);
assert.doesNotMatch(observerSource, /method: 'POST'|journalStatus/);
const verdicts: Record<string, string> = {};

assert.equal(new Set(premiumLinguisticAgents.map((agent) => agent.id)).size, premiumLinguisticAgents.length, 'linguistic registry IDs must be unique');
assert.equal(new Set(agentGovernanceRegistry.map((agent) => agent.id)).size, agentGovernanceRegistry.length, 'governance registry IDs must be unique');
assert.equal(new Set(turnOrganizationAgents.map((agent) => agent.id)).size, turnOrganizationAgents.length, 'TURN registry IDs must be unique');
assert.equal(new Set(panelAgentSources.map((agent) => agent.panelAgentId)).size, panelAgentSources.length, 'panel identities must be unique');

for (const target of operationalLinguistV1Targets) {
  const operationalOwners = premiumLinguisticAgents.filter((agent) => agent.language === target.language && agent.enabled);
  assert.equal(operationalOwners.length, 1, `${target.language}: exactly one operational language authority is required`);
  assert.equal(operationalOwners[0].id, target.componentId, `${target.language}: canonical ownership mismatch`);
  assert.equal(operationalOwners[0].status, 'active');
  assert.deepEqual(operationalOwners[0].capabilities, premiumLinguisticCapabilities);

  const governance = agentGovernanceRegistry.filter((agent) => agent.id === target.componentId);
  assert.equal(governance.length, 1, `${target.componentId}: governance mapping must be singular`);
  assert.equal(governance[0].status, 'active');
  assert.equal(governance[0].ownerDepartmentId, 'ai-agents');
  assert.match(`${governance[0].displayRole} ${governance[0].displayResponsibilities}`, new RegExp(target.language.toUpperCase()));

  const turn = turnOrganizationAgents.filter((agent) => agent.id === target.componentId);
  assert.equal(turn.length, 1, `${target.componentId}: TURN mapping must be singular`);
  assert.equal(turn[0].coordinatorId, 'unit-i18n');
  assert.equal(turn[0].reportsToId, 'unit-i18n');
  assert.match(turn[0].procedure, /CATALOG AUDIT.*OIDC\/M2M PUBLISHER.*TYPED V1 STATE.*TURN OBSERVER/);

  const panel = panelAgentSources.filter((agent) => agent.turnAgentId === target.componentId);
  assert.equal(panel.length, 1, `${target.componentId}: panel runtime mapping must be singular`);
  assert.equal(panel[0].sourceId, target.componentId);
  assert.match(panel[0].telemetrySource ?? '', /Operational Linguistic Baseline V1/);

  const authority = premiumNetworkSeed.filter((entry) => entry.canonicalId === target.componentId);
  assert.equal(authority.length, 1, `${target.componentId}: authority control-plane registration must be singular`);
  assert.equal(authority[0].module, 'linguistic-agents');
  assert.deepEqual(authority[0].writePermissions, []);
  assert.ok(authority[0].readPermissions.includes('i18n.catalog.read'));
  assert.ok((COMPONENT_TELEMETRY_CONTRACT.supportedComponents as readonly string[]).includes(target.componentId));

  const heartbeat = auditCanonicalOperationalLinguist(target.language);
  assert.equal(heartbeat.operationalState, 'ONLINE', `${target.componentId}: ${heartbeat.errors.codes.join(',')}`);
  assert.deepEqual(heartbeat.resources, { contractVersion: target.resourceContractVersion, contractDigest: target.resourceContractDigest, catalogDigest: target.resourceCatalogDigest, ...expectedCounts });
  assert.deepEqual(heartbeat.errors, { count: 0, codes: [] });
  verdicts[target.language.toUpperCase()] = 'PASS';
}

const unitI18n = turnOrganizationAgents.find((agent) => agent.id === 'unit-i18n');
assert.deepEqual(unitI18n?.subordinateAgentIds, operationalLinguistV1Targets.map((target) => target.componentId));

console.log(JSON.stringify({
  status: 'PASS',
  agents: verdicts,
  registry: 'PASS',
  turnVisibility: 'PASS',
  operationalLinguistV1Contract: 'PASS',
  noDuplicateAuthority: 'PASS',
  resourcesPerAgent: expectedCounts,
}, null, 2));
