import assert from 'node:assert/strict';
import { buildPanelAgentModel, panelAgentMappingReport, panelAgentSources } from '../src/turn-agent-panel.integration';
import { agentGovernanceRegistry } from '../src/agent-governance.registry';
import { turnOrganizationAgents } from '../src/turn-organization-chart';

const agentGovernanceIds = new Set(agentGovernanceRegistry.map((agent) => agent.id));
const officialTurnIds = new Set([...agentGovernanceIds, ...turnOrganizationAgents.map((agent) => agent.id)]);

const model = buildPanelAgentModel();
const report = panelAgentMappingReport();

assert.equal(panelAgentSources.length, 16, 'operational panel must contain only canonical or organization-backed identities');
assert.equal(agentGovernanceRegistry.length, 34, 'canonical registry must include exactly two Website Guardians');
assert.equal(model.length, panelAgentSources.length, 'every approved visual agent must be normalized');
assert.equal(new Set(model.map((agent) => agent.panelAgentId)).size, model.length, 'panel IDs must be unique');
assert.ok(turnOrganizationAgents.some((agent) => agent.id === 'atlas-operations'), 'official Turn organization registry must contain Atlas');
assert.equal(model.filter((agent) => agent.mappingStatus === 'MAPPED').length, 16, 'every operational panel identity must be mapped');
for (const id of ['website-content-visual-guardian', 'website-runtime-release-guardian']) {
  assert.ok(model.some((agent) => agent.turnAgentId === id && agent.mappingStatus === 'MAPPED'), `${id} must be registered in TURN`);
}
assert.ok(model.some((agent) => agent.mappingStatus === 'MAPPED' && agent.turnAgentId === 'monitor-api' && agent.registryName === 'Agent Monitorizare API'), 'API monitor must be mapped from registry');
assert.ok(model.some((agent) => agent.mappingStatus === 'MAPPED' && agent.turnAgentId === 'atlas-operations' && agent.registrySource === 'turn-organization-chart'), 'Atlas must be mapped from official Turn registry');
assert.ok(model.some((agent) => agent.turnAgentId === 'adrian-turn-commander'), 'Turn Commander must use the canonical organization identity');
assert.ok(model.some((agent) => agent.turnAgentId === 'mentor'), 'Mentor must use the canonical organization identity');
assert.ok(model.some((agent) => agent.turnAgentId === 'chief-monitoring-inspector'), 'Chief Monitoring Inspector must be represented independently from MON-010');
assert.equal(model.some((agent) => ['core-orion-product-owner', 'nexa-copilot-vsc', 'geminii-copilot-dual'].includes(agent.panelAgentId)), false, 'decorative identities must not enter the operational model');
assert.ok(model.every((agent) => !agent.turnAgentId || officialTurnIds.has(agent.turnAgentId)), 'no fictitious Turn IDs may enter the normalized model');
assert.ok(model.every((agent) => agent.runtimeStatus === 'NO TELEMETRY' || agent.runtimeStatus === 'UNKNOWN' || agent.runtimeStatus === 'STALE' || agent.runtimeStatus === 'ACTIVE' || agent.runtimeStatus === 'DEGRADED' || agent.runtimeStatus === 'FAILED' || agent.runtimeStatus === 'CRITICAL'), 'runtime status must use the explicit contract');
assert.equal(report.length, model.length, 'mapping report must cover the normalized model');

console.log(JSON.stringify({ pass: true, governanceRegistryEntries: agentGovernanceIds.size, turnOrganizationRegistryEntries: turnOrganizationAgents.length, agents: model.length, mapped: report.filter((row) => row.mappingStatus === 'MAPPED').length, unmapped: report.filter((row) => row.mappingStatus === 'UNMAPPED').length, statuses: [...new Set(model.map((agent) => agent.runtimeStatus))] }, null, 2));
