import { GovernanceV2Engine, GovernanceViolation } from '../src/governance-v2/governance-v2.engine';
import type { GovernanceActor, ProductionChangeRecord, VersionRecord } from '../src/governance-v2/governance-v2.contract';

const proposer: GovernanceActor = { id: 'proposer', roles: ['PROPOSER'] };
const approver: GovernanceActor = { id: 'approver', roles: ['APPROVER'] };
const validator: GovernanceActor = { id: 'validator', roles: ['VALIDATOR'] };
const executor: GovernanceActor = { id: 'executor', roles: ['EXECUTOR'] };

function engineWithSource() {
  const engine = new GovernanceV2Engine();
  engine.registerCanonicalSource({ id: 'source-a', factKey: 'runtime.health', humanTitle: 'Runtime health', description: 'Canonical health', canonicalSource: 'ComponentHeartbeat', writeAuthority: 'heartbeat-writer-a', validatorAuthority: 'validator', readers: ['TURN'], precedence: 1, conflictBehavior: 'FAIL_CLOSED', contractVersion: 'v1', activatedAt: new Date().toISOString() });
  return engine;
}

function pcr(engine: GovernanceV2Engine): ProductionChangeRecord {
  engine.addDependencyEdge({ id: 'edge-x-y', sourceComponent: 'X', relation: 'AFFECTS', targetComponent: 'Y', criticality: 'HIGH', validationRequired: true, introducedAt: new Date().toISOString() });
  return engine.createPcr({ id: 'pcr-1', semanticTitle: 'Controlled change X', description: 'test', impactClass: 'STRUCTURAL', affectedComponents: ['X'], affectedCanonicalSources: [], dependencyImpactRef: 'graph-1', impactStudy: 'study-1', testPlan: 'tests-1', rollbackPlan: 'rollback-1', snapshotRef: 'snapshot-1', candidateRef: 'candidate-1', relatedIncidents: [], relatedCSC: [], proposerId: proposer.id });
}

describe('Governance V2 hardening', () => {
  it('rejects two active canonical sources for one fact', () => {
    const engine = engineWithSource();
    expect(() => engine.registerCanonicalSource({ id: 'source-b', factKey: 'runtime.health', humanTitle: 'Other', description: 'Other', canonicalSource: 'Other', writeAuthority: 'writer-b', validatorAuthority: 'validator', readers: [], precedence: 2, conflictBehavior: 'FAIL_CLOSED', contractVersion: 'v1', activatedAt: new Date().toISOString() })).toThrow('CANONICAL_SOURCE_COLLISION');
  });

  it('requires approved and independently validated CSC before activation', () => {
    const engine = engineWithSource();
    engine.requestSourceChange({ id: 'csc-1', semanticTitle: 'Move health source', factKey: 'runtime.health', oldSource: 'ComponentHeartbeat', newSource: 'OperationalTruth', oldWriteAuthority: 'heartbeat-writer-a', newWriteAuthority: 'operational-truth', oldPrecedence: 1, newPrecedence: 1, reason: 'test', impactStudyRef: 'study', migrationPlanRef: 'migration', testPlanRef: 'tests', rollbackPlanRef: 'rollback', proposerId: proposer.id });
    expect(() => engine.activateSourceChange('csc-1', executor, 'v2')).toThrow('CSC_NOT_APPROVED_AND_VALIDATED');
    engine.approveSourceChange('csc-1', approver);
    engine.validateSourceChange('csc-1', validator, ['evidence-1']);
    expect(engine.activateSourceChange('csc-1', executor, 'v2').status).toBe('ACTIVATED');
  });

  it('blocks regression cascade when a transitive dependency is unknown', () => {
    const engine = engineWithSource(); const record = pcr(engine);
    engine.assessPcr(record.id, validator); engine.recordDependencyResult(record.id, 'X', 'PASS');
    expect(() => engine.approvePcr(record.id, approver)).toThrow('REGRESSION_CASCADE_BLOCKED');
    engine.recordDependencyResult(record.id, 'Y', 'PASS');
    expect(engine.approvePcr(record.id, approver).status).toBe('APPROVED');
  });

  it('rejects self-validation and same actor deployment approval', () => {
    const engine = engineWithSource(); const record = pcr(engine); engine.assessPcr(record.id, validator); engine.recordDependencyResult(record.id, 'X', 'PASS'); engine.recordDependencyResult(record.id, 'Y', 'PASS'); engine.approvePcr(record.id, approver);
    expect(() => engine.validatePcr(record.id, { id: executor.id, roles: ['VALIDATOR'] }, ['post'], 'PASS')).toThrow('POST_DEPLOY_VALIDATION_INCOMPLETE');
    engine.deployPcr(record.id, executor, 'rev-1');
    expect(() => engine.validatePcr(record.id, { id: executor.id, roles: ['VALIDATOR'] }, ['post'], 'PASS')).toThrow('VALIDATOR_CANNOT_BE_EXECUTOR');
    expect(engine.validatePcr(record.id, validator, ['post'], 'PASS').finalVerdict).toBe('PASS');
  });

  it('enforces version promotion and provenance', () => {
    const engine = engineWithSource(); const version: VersionRecord = { id: 'v1', semanticTitle: 'Candidate', status: 'WIP', baseRevision: 'base', commitSha: 'sha', artifactDigests: ['sha256:a'], candidateSnapshot: 'snap', validationEvidence: [], pcrRefs: [], cscRefs: [], incidentRefs: [] }; engine.registerVersion(version);
    expect(() => engine.promoteVersion('v1', 'DEPLOYED')).toThrow('INVALID_VERSION_PROMOTION');
    engine.promoteVersion('v1', 'CANDIDATE'); engine.promoteVersion('v1', 'VALIDATED'); engine.promoteVersion('v1', 'CANONICAL'); version.pcrRefs.push('pcr'); version.validationEvidence.push('test');
    expect(engine.promoteVersion('v1', 'DEPLOYED').status).toBe('DEPLOYED');
  });

  it('keeps an append-only hash-linked ledger and rejects mutation', () => {
    const engine = engineWithSource(); const first = engine.appendEvent('CREATED', 'Test', '1', 'actor'); const second = engine.appendEvent('APPROVED', 'Test', '1', 'actor');
    expect(second.previousEventId).toBe(first.eventId); expect(second.previousDigest).toBe(first.payloadDigest); expect(() => engine.mutateEvent()).toThrow('EVENT_LEDGER_APPEND_ONLY');
  });

  it('supports semantic snapshot search without numeric ids', () => {
    const engine = engineWithSource(); engine.registerSnapshot({ snapshotId: 'snap-1', semanticTitle: 'Reconciliere TURN operational truth', contentSummary: 'ACP and registry boundary', tags: ['TURN', 'reconciliere'], status: 'PRESERVED', branch: 'isolated', baseCommit: 'base', worktree: 'worktree', manifestDigest: 'manifest', snapshotDigest: 'snapshot', changedFiles: [], untrackedFiles: [], tests: ['pass'], createdAt: new Date().toISOString() });
    expect(engine.searchSnapshots('reconciliere TURN')).toHaveLength(1);
  });

  it('returns explicit violations rather than silently accepting invalid transitions', () => {
    const engine = engineWithSource(); expect(() => engine.promoteVersion('missing', 'CANDIDATE')).toThrow(GovernanceViolation);
  });
});
