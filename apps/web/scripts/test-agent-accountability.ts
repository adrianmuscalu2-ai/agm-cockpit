import assert from 'node:assert/strict';
import { agentGovernanceRegistry } from '../src/agent-governance.registry';
import { agentRoleContracts, authorizeDutyExecution, canonicalAgentId, detectRoleDrift, dutyState, latestDutyReceipt, recordDutyReceipt, roleContractFor, validateRoleContract, type DutyExecutionReceipt } from '../src/agent-accountability';
import { evaluateIncidentTruth } from '../src/incident-truth';
import { renderAgentRuntimeSnapshot, type AgentRuntimeAccountabilitySnapshot } from '../src/agent-runtime-accountability';

assert.equal(canonicalAgentId('architecture-inspector'), 'architecture-guardian');
assert.equal(canonicalAgentId('version-custodian'), 'version-guardian');
assert.equal(canonicalAgentId('mentor'), 'agent-mentor');
const contractIds = new Set(agentRoleContracts.map((contract) => contract.agentId));
assert.ok([...new Set(agentGovernanceRegistry.map((agent) => canonicalAgentId(agent.id)))].every((agentId) => contractIds.has(agentId)));
for (const persistentId of ['rescue', 'agm-central-librarian', 'p3-safe-observer', 'chief-monitoring-inspector']) assert.ok(contractIds.has(persistentId));
assert.ok(agentRoleContracts.every((contract) => validateRoleContract(contract).length === 0));
assert.equal(roleContractFor('agent-qa'), undefined, 'QA must remain an independent role per mandate, not an artificial permanent agent.');

const storageMap = new Map<string, string>();
const storage = { getItem: (key: string) => storageMap.get(key) ?? null, setItem: (key: string, value: string) => void storageMap.set(key, value) } as Storage;
assert.equal(dutyState(undefined), 'UNKNOWN / NO CURRENT EVIDENCE', 'Registry identity without a receipt must never become ACTIVE.');
const contract = roleContractFor('monitor-browser')!;
const receipt: DutyExecutionReceipt = { agentId: 'monitor-browser', roleContractVersion: contract.roleContractVersion, mandateId: 'test-monitor-browser', trigger: 'PERIODIC_CHECK', startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), source: ['controlled origin probe'], coverage: 'browser route', result: 'PASS', evidenceRef: 'evidence:test', freshness: 'CURRENT', openResponsibility: 'NONE', escalation: 'NONE', validator: 'chief-monitoring-inspector', executedActions: ['observe', 'verify', 'record'] };
recordDutyReceipt(receipt, storage);
assert.equal(dutyState(receipt), 'DUTY VERIFIED');
const drift = { ...receipt, executedActions: ['restart services'] };
assert.equal(latestDutyReceipt('monitor-browser', storage)?.mandateId, receipt.mandateId, 'Duty receipt must survive a storage-backed restart/reload.');
assert.equal(dutyState({ ...receipt, result: 'FAIL', freshness: 'UNKNOWN' }), 'FAILED', 'An explicit failed check must not be hidden by unavailable-source freshness.');
assert.match(detectRoleDrift(drift).join(','), /FORBIDDEN_ACTION/);
assert.equal(dutyState(drift), 'ROLE DRIFT');
assert.equal(authorizeDutyExecution('monitor-browser', 'PERIODIC_CHECK', ['observe']).agentId, 'monitor-browser');
assert.throws(() => authorizeDutyExecution('monitor-browser', 'PERIODIC_CHECK', ['restart services']), /ROLE_DRIFT_BLOCKED.*FORBIDDEN_ACTION/);
assert.throws(() => authorizeDutyExecution('monitor-browser', 'DEPLOYMENT', ['observe']), /ROLE_DRIFT_BLOCKED.*UNAUTHORIZED_TRIGGER/);

assert.equal(evaluateIncidentTruth({}).state, 'UNKNOWN / NOT CHECKED');
assert.equal(evaluateIncidentTruth({ attemptedAt: new Date().toISOString(), failure: 'API unavailable' }).state, 'INCIDENT DATA UNAVAILABLE');
assert.equal(evaluateIncidentTruth({ attemptedAt: new Date().toISOString(), checkedAt: new Date().toISOString(), coverage: 'COMPLETE', activeRecords: 0 }).state, 'NO ACTIVE INCIDENTS');
assert.equal(evaluateIncidentTruth({ attemptedAt: new Date().toISOString(), checkedAt: new Date().toISOString(), coverage: 'COMPLETE', activeRecords: 2 }).state, 'ACTIVE INCIDENT');
assert.equal(evaluateIncidentTruth({ attemptedAt: new Date().toISOString(), checkedAt: new Date(Date.now() - 90_001).toISOString(), coverage: 'COMPLETE', activeRecords: 0 }).state, 'UNKNOWN / NOT CHECKED');

const runtimeSnapshot: AgentRuntimeAccountabilitySnapshot = {
  contractVersion: 'agent-runtime-accountability.v1',
  generatedAt: new Date().toISOString(),
  agents: [{
    identity: 'premium.architecture-inspector', responsibility: 'Independent validation', executable: 'YES', mandate: 'PROVEN', mandateId: 'mandate-secondary',
    trigger: 'INSPECTOR_FAILURE', executionCondition: 'ON_FAILURE', lastExecution: new Date().toISOString(), lastResult: 'COMPLETED',
    outputRef: 'urn:output:secondary', executionEvidenceRef: 'EventStore:secondary', validation: 'PROVEN', validator: 'premium.architecture-inspector',
    validationEvidenceRef: 'AuthorityAuditJournal:secondary', lastValidation: new Date().toISOString(), freshness: 'CURRENT', status: 'ACTIVE',
    reason: 'Full chain proven.', openResponsibilities: [], failover: 'PROVEN',
  }],
  inspector: {
    primaryInspector: 'premium.release-inspector', primaryStatus: 'FAILED', secondaryInspector: 'premium.architecture-inspector', secondaryStatus: 'COMPLETED',
    activeValidator: 'premium.architecture-inspector', mandateTransferred: true, transferReason: 'PRIMARY_INSPECTOR_FAILED', transferredAt: new Date().toISOString(),
    lastValidation: new Date().toISOString(), transferEvidenceRef: 'AuthorityAuditJournal:transfer', status: 'PASS', controlStatus: 'TRANSFERRED_TO_SECONDARY',
  },
  incidents: { open: 1, inspectorFailureIncident: 'incident-primary', controlCoverageIncident: null },
  verdict: { agentAccountability: 'PASS', inspectorFailover: 'PASS', controlCoverage: 'COMPLETE', falseActive: 0, unexplainedDegraded: 0, finalAgentRuntimePass: 'PASS' },
};
const runtimeMarkup = renderAgentRuntimeSnapshot(runtimeSnapshot);
for (const required of [
  'AGENT ACCOUNTABILITY',
  'INSPECTOR FAILOVER',
  'CONTROL COVERAGE',
  'FALSE ACTIVE',
  'UNEXPLAINED DEGRADED',
  'FINAL AGENT RUNTIME PASS',
  'premium.release-inspector',
  'premium.architecture-inspector',
  'PRIMARY_INSPECTOR_FAILED',
  'AuthorityAuditJournal:transfer',
  'EventStore:secondary',
]) assert.ok(runtimeMarkup.includes(required), `Runtime TURN markup must expose ${required}.`);
assert.equal((runtimeMarkup.match(/data-runtime-status="ACTIVE"/g) ?? []).length, 1);
assert.ok(runtimeMarkup.includes('data-inspector-failover="PASS"'));

console.log('Agent accountability, role drift and incident truth contracts: PASS');
