import assert from 'node:assert/strict';
import { agentGovernanceRegistry } from '../src/agent-governance.registry';
import { agentRoleContracts, authorizeDutyExecution, canonicalAgentId, detectRoleDrift, dutyState, latestDutyReceipt, recordDutyReceipt, roleContractFor, validateRoleContract, type DutyExecutionReceipt } from '../src/agent-accountability';
import { evaluateIncidentTruth } from '../src/incident-truth';

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

console.log('Agent accountability, role drift and incident truth contracts: PASS');
