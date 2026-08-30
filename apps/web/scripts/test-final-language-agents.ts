import assert from 'node:assert/strict';

import { COMPONENT_TELEMETRY_CONTRACT } from '../../api/src/component-telemetry/component-telemetry.contract';
import { premiumNetworkSeed } from '../../api/src/authority-control-plane/premium-network.seed';
import { agentGovernanceRegistry } from '../src/agent-governance.registry';
import { premiumLinguisticCapabilities } from '../src/premium-linguistic-agents/premium-linguistic-agents.contract';
import { premiumLinguisticAgents } from '../src/premium-linguistic-agents/premium-linguistic-agents.registry';
import {
  auditPremiumLinguisticAgent,
  finalLanguageAgentTargets,
} from '../src/premium-linguistic-agents/premium-linguistic-agents.runtime';
import { panelAgentSources } from '../src/turn-agent-panel.integration';
import { turnOrganizationAgents } from '../src/turn-organization-chart';

const expectedCounts = { app: 1155, operational: 308, carMover: 37, premium: 199, total: 1699 };
const verdicts: Record<string, string> = {};

assert.equal(new Set(premiumLinguisticAgents.map((agent) => agent.id)).size, premiumLinguisticAgents.length, 'linguistic registry IDs must be unique');
assert.equal(new Set(agentGovernanceRegistry.map((agent) => agent.id)).size, agentGovernanceRegistry.length, 'governance registry IDs must be unique');
assert.equal(new Set(turnOrganizationAgents.map((agent) => agent.id)).size, turnOrganizationAgents.length, 'TURN registry IDs must be unique');
assert.equal(new Set(panelAgentSources.map((agent) => agent.panelAgentId)).size, panelAgentSources.length, 'panel identities must be unique');

for (const target of finalLanguageAgentTargets) {
  const operationalOwners = premiumLinguisticAgents.filter((agent) => agent.language === target.language && agent.enabled);
  assert.equal(operationalOwners.length, 1, `${target.language}: exactly one operational language authority is required`);
  assert.equal(operationalOwners[0].id, target.id, `${target.language}: canonical ownership mismatch`);
  assert.equal(operationalOwners[0].status, 'active');
  assert.deepEqual(operationalOwners[0].capabilities, premiumLinguisticCapabilities);

  const governance = agentGovernanceRegistry.filter((agent) => agent.id === target.id);
  assert.equal(governance.length, 1, `${target.id}: governance mapping must be singular`);
  assert.equal(governance[0].status, 'active');
  assert.equal(governance[0].ownerDepartmentId, 'ai-agents');
  assert.match(`${governance[0].displayRole} ${governance[0].displayResponsibilities}`, new RegExp(target.language.toUpperCase()));

  const turn = turnOrganizationAgents.filter((agent) => agent.id === target.id);
  assert.equal(turn.length, 1, `${target.id}: TURN mapping must be singular`);
  assert.equal(turn[0].coordinatorId, 'unit-i18n');
  assert.equal(turn[0].reportsToId, 'unit-i18n');
  assert.match(turn[0].procedure, /CATALOG AUDIT.*RUNTIME HEARTBEAT.*TURN EVIDENCE/);

  const panel = panelAgentSources.filter((agent) => agent.turnAgentId === target.id);
  assert.equal(panel.length, 1, `${target.id}: panel runtime mapping must be singular`);
  assert.equal(panel[0].sourceId, target.id);
  assert.match(panel[0].telemetrySource ?? '', /Component heartbeat v1/);

  const authority = premiumNetworkSeed.filter((entry) => entry.canonicalId === target.id);
  assert.equal(authority.length, 1, `${target.id}: authority control-plane registration must be singular`);
  assert.equal(authority[0].module, 'linguistic-agents');
  assert.deepEqual(authority[0].writePermissions, []);
  assert.ok(authority[0].readPermissions.includes('i18n.catalog.read'));
  assert.ok((COMPONENT_TELEMETRY_CONTRACT.supportedComponents as readonly string[]).includes(target.id));

  const heartbeat = auditPremiumLinguisticAgent(target, new Date('2026-08-28T10:00:00.000Z'));
  assert.equal(heartbeat.status, 'ONLINE', `${target.id}: ${heartbeat.errors.join(',')}`);
  assert.equal(heartbeat.reason, 'I18N_RESOURCES_VALIDATED');
  assert.deepEqual(heartbeat.counts, expectedCounts);
  assert.deepEqual(heartbeat.errors, []);
  verdicts[target.language.toUpperCase()] = 'PASS';
}

const unitI18n = turnOrganizationAgents.find((agent) => agent.id === 'unit-i18n');
assert.deepEqual(unitI18n?.subordinateAgentIds, finalLanguageAgentTargets.map((target) => target.id));

console.log(JSON.stringify({
  status: 'PASS',
  agents: verdicts,
  registry: 'PASS',
  turnVisibility: 'PASS',
  runtimeHeartbeatContract: 'PASS',
  noDuplicateAuthority: 'PASS',
  resourcesPerAgent: expectedCounts,
}, null, 2));
