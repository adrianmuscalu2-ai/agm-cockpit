import { GovernanceV2Persistence } from '../src/governance-v2/governance-v2.persistence';
import { GovernanceV2RuntimeService } from '../src/governance-v2/governance-v2.runtime';

const actor = (role: string, overrides = {}) => ({ status: 'ACTIVE', roles: [role], can_propose: role === 'PROPOSER', can_validate: role === 'VALIDATOR', can_execute: role === 'EXECUTOR', ...overrides });

function fixture(overrides: Record<string, unknown> = {}) {
  const actors: Record<string, unknown> = { proposer: actor('PROPOSER'), approver: actor('APPROVER'), validator: actor('VALIDATOR'), executor: actor('EXECUTOR') };
  const pcr = { status: 'IMPACT_ASSESSED', proposer_id: 'proposer', approver_id: 'approver', candidate_ref: 'candidate', snapshot_ref: 'snapshot', impact_class: 'CONTROLLED', impact_study: 'study', dependency_impact_ref: 'graph', test_plan: 'tests', rollback_plan: 'rollback', affected_components: ['A', 'B', 'A'], dependency_checks: { __graph: { status: 'COMPLETE' }, A: 'PASS', A1: 'PASS', B: 'PASS' }, ...overrides };
  const query = jest.fn(async (sql: string, ...values: unknown[]) => {
    if (sql.includes('actor_principals')) return actors[String(values[0])] ? [actors[String(values[0])]] : [];
    if (sql.includes('production_change_records')) return [pcr];
    if (sql.includes('canonical_source_changes')) return [{ status: 'APPROVED', approval_status: 'APPROVED', proposer_id: 'proposer', approved_by: 'approver' }];
    if (sql.includes('version_records')) return [{ commit_sha: 'revision', candidate_snapshot: 'snapshot', artifact_digests: [], status: overrides.version_status ?? 'CANONICAL' }];
    if (sql.includes('break_glass_authorizations')) return [{ status: 'AUTHORIZED', started_at: new Date(Date.now() - 10000).toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(), requester_id: 'proposer', authorized_human_id: 'approver', ...((overrides.breakGlass ?? {}) as Record<string, unknown>) }];
    if (sql.includes('WITH RECURSIVE')) return (values[0] === 'A' ? ['A', 'A1'] : ['B', 'B1']).map(component => ({ component }));
    if (sql.includes('proposals')) return [{ status: overrides.proposal_status ?? 'REVIEWED', proposer_id: 'proposer' }];
    return [];
  });
  const execute = jest.fn(async () => 1);
  const persistence = new GovernanceV2Persistence({ $queryRawUnsafe: query, $executeRawUnsafe: execute } as never);
  return { persistence, actors, pcr, query, execute };
}

describe('Governance V2 pinned transaction boundary', () => {
  it('runs marker, mutations, reads and unchanged closure callbacks on the pinned connection', async () => {
    const pinned = { $queryRawUnsafe: jest.fn(async () => []), $executeRawUnsafe: jest.fn(async () => 1) };
    const root = { $queryRawUnsafe: jest.fn(), $executeRawUnsafe: jest.fn(), $transaction: jest.fn(async (work: (db: unknown) => Promise<unknown>) => work(pinned)) };
    const p = new GovernanceV2Persistence(root as never);
    const runtime = new GovernanceV2RuntimeService(p);
    await runtime.transaction(async () => {
      await p.listProposals();
      await p.transaction(async () => p.listGovernanceEvents());
    });
    expect(root.$transaction).toHaveBeenCalledTimes(1);
    expect(root.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(root.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(pinned.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('set_config'));
    expect(pinned.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'));
    expect(pinned.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('governance_events'));
  });

  it('does not leak transaction connections between concurrent async calls', async () => {
    let next = 0;
    let arrived = 0;
    let release!: () => void;
    const both = new Promise<void>(resolve => { release = resolve; });
    const root = {
      $queryRawUnsafe: jest.fn(), $executeRawUnsafe: jest.fn(),
      $transaction: async (work: (db: unknown) => Promise<unknown>) => {
        const connectionId = ++next;
        return work({ $queryRawUnsafe: async () => [{ connectionId }], $executeRawUnsafe: async () => 1 });
      },
    };
    const p = new GovernanceV2Persistence(root as never);
    const work = () => p.transaction(async () => {
      if (++arrived === 2) release();
      await both;
      return p.listProposals();
    });
    const results = await Promise.all([work(), work()]);
    expect(results).toEqual([[{ connectionId: 1 }], [{ connectionId: 2 }]]);
    expect(root.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('fails closed if a pooled client cannot supply a pinned transaction', async () => {
    const { persistence, execute } = fixture();
    await expect(persistence.transaction(async () => undefined)).rejects.toThrow('GOVERNANCE_TRANSACTION_HOST_REQUIRED');
    expect(execute).not.toHaveBeenCalled();
  });

  it('propagates failures to the transaction host for rollback', async () => {
    const pinned = { $queryRawUnsafe: async () => [], $executeRawUnsafe: async () => 1 };
    let rolledBack = false;
    const root = { ...pinned, $transaction: async (work: (db: unknown) => Promise<unknown>) => {
      try { return await work(pinned); } catch (error) { rolledBack = true; throw error; }
    } };
    const p = new GovernanceV2Persistence(root as never);
    await expect(p.transaction(async () => { throw new Error('AUDIT_WRITE_FAILED'); })).rejects.toThrow('AUDIT_WRITE_FAILED');
    expect(rolledBack).toBe(true);
  });

  it('does not commit a failed nested operation even if the caller catches its error', async () => {
    const pinned = { $queryRawUnsafe: async () => [], $executeRawUnsafe: async () => 1 };
    const root = { ...pinned, $transaction: async (work: (db: unknown) => Promise<unknown>) => work(pinned) };
    const p = new GovernanceV2Persistence(root as never);
    await expect(p.transaction(async () => {
      try { await p.transaction(async () => { throw new Error('NESTED_FAILURE'); }); } catch { /* caller cannot clear rollback-only */ }
    })).rejects.toThrow('GOVERNANCE_TRANSACTION_ABORTED');
  });
});

describe('Governance V2 mutation authorization', () => {
  it.each(['REVIEWED', 'ACCEPTED_FOR_CHANGE_CONTROL', 'REJECTED'] as const)('does not allow a proposer through alternate transition %s', async target => {
    const { persistence, execute } = fixture({ proposal_status: target === 'REVIEWED' ? 'DRAFT' : 'REVIEWED' });
    await expect(persistence.transitionProposal('proposal', target, 'proposer')).rejects.toThrow('GOVERNANCE_ACTOR_UNAUTHORIZED');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not allow a validator to approve through the alternate transition method', async () => {
    const { persistence, execute } = fixture();
    await expect(persistence.transitionProposal('proposal', 'ACCEPTED_FOR_CHANGE_CONTROL', 'validator')).rejects.toThrow('GOVERNANCE_ACTOR_UNAUTHORIZED');
    expect(execute).not.toHaveBeenCalled();
  });

  it('allows the existing independent approver path without granting validate capability', async () => {
    const { persistence, execute } = fixture();
    await persistence.transitionProposal('proposal', 'ACCEPTED_FOR_CHANGE_CONTROL', 'approver');
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE agm_governance.proposals'), 'proposal', 'ACCEPTED_FOR_CHANGE_CONTROL', '[]');
  });

  it.each([
    ['IMPACT_ASSESSED', 'approver'], ['APPROVED', 'validator'], ['VALIDATED', 'executor'], ['ACTIVATED', 'approver'],
  ] as const)('requires the correct role for CSC %s', async (transition, actorId) => {
    const { persistence, execute } = fixture();
    await expect(persistence.transitionCsc('csc', transition, actorId, ['proof'], 'v1')).rejects.toThrow('GOVERNANCE_ACTOR_UNAUTHORIZED');
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    (p: GovernanceV2Persistence) => p.assessProductionChange('pcr', 'intruder'),
    (p: GovernanceV2Persistence) => p.approveProductionChange('pcr', 'intruder'),
    (p: GovernanceV2Persistence) => p.evaluateProductionReleaseGate('pcr', 'intruder'),
    (p: GovernanceV2Persistence) => p.recordProductionExecution('pcr', 'intruder', 'revision'),
    (p: GovernanceV2Persistence) => p.validateProductionChange('pcr', 'intruder', ['proof'], 'PASS'),
    (p: GovernanceV2Persistence) => p.recordDependencyResult('pcr', 'A', 'PASS', 'intruder'),
    (p: GovernanceV2Persistence) => p.recordDependencyGraphStatus('pcr', 'COMPLETE', 'proof', 'intruder'),
    (p: GovernanceV2Persistence) => p.recordAcceptedDegradation('pcr', 'B', 'approval', 'reason', 'proof', 'intruder'),
    (p: GovernanceV2Persistence) => p.recordDependencyResult('pcr', 'A', 'PASS', undefined as never),
    (p: GovernanceV2Persistence) => p.createCanonicalSource({} as never, 'intruder'),
    (p: GovernanceV2Persistence) => p.addDependencyEdge({} as never, 'intruder'),
    (p: GovernanceV2Persistence) => p.createVersion({} as never, 'intruder'),
    (p: GovernanceV2Persistence) => p.promoteVersion('version', 'CANONICAL', 'intruder'),
    (p: GovernanceV2Persistence) => p.createSnapshot({} as never, 'intruder'),
    (p: GovernanceV2Persistence) => p.createIncident({ validator: 'intruder' } as never),
    (p: GovernanceV2Persistence) => p.createBreakGlassAuthorization({ authorizedHumanId: 'intruder' } as never),
    (p: GovernanceV2Persistence) => p.validateBreakGlassForExecution('glass', 'intruder'),
    (p: GovernanceV2Persistence) => p.recordBreakGlassValidation('glass', 'intruder', ['proof'], 'VALIDATED'),
    (p: GovernanceV2Persistence) => p.recordRiskKnowledgeOverride('risk', { authorizedHumanId: 'intruder' } as never),
    (p: GovernanceV2Persistence) => p.registerWorktree({ ownerExecutor: 'intruder' } as never),
    (p: GovernanceV2Persistence) => p.bindActorIdentity({ actorId: 'proposer', principalType: 'HUMAN_USER', principalId: 'human', companyId: 'company', status: 'BOUND', decisionRef: 'decision', recordedBy: 'intruder' }),
  ])('rejects unknown actors before any PCR mutation', async work => {
    const { persistence, execute } = fixture();
    await expect(work(persistence)).rejects.toThrow('GOVERNANCE_ACTOR_UNAUTHORIZED');
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    actor('VALIDATOR', { status: 'REVOKED' }), actor('VALIDATOR', { can_validate: false }), actor('APPROVER', { can_validate: true }),
  ])('requires active role AND capability for validation', async invalid => {
    const { persistence, actors, execute } = fixture();
    actors.validator = invalid;
    await expect(persistence.assessProductionChange('pcr', 'validator')).rejects.toThrow('GOVERNANCE_ACTOR_UNAUTHORIZED');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not allow validation results to be rewritten after approval', async () => {
    const { persistence, execute } = fixture({ status: 'APPROVED' });
    await expect(persistence.recordDependencyResult('pcr', 'B1', 'PASS', 'validator')).rejects.toThrow('PCR_INVALID_TRANSITION');
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects forged CSC transitions before an unknown value can enter the activation branch', async () => {
    const { persistence, execute } = fixture();
    await expect(persistence.transitionCsc('csc', 'FORGED' as never, 'validator')).rejects.toThrow('CSC_INVALID_TRANSITION');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not record execution when the existing dependency release gate fails', async () => {
    const { persistence, execute } = fixture({ status: 'APPROVED', approval_status: 'APPROVED' });
    await expect(persistence.recordProductionExecution('pcr', 'executor', 'revision', { candidateRef: 'candidate', versionId: 'v1' })).rejects.toThrow('RELEASE_BLOCKED:REGRESSION_CASCADE');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not record execution without exact version/candidate binding', async () => {
    const { persistence, execute } = fixture({ status: 'APPROVED' });
    await expect(persistence.recordProductionExecution('pcr', 'executor', 'revision')).rejects.toThrow('RELEASE_BLOCKED:BINDING_INPUT_INCOMPLETE');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not accept a future-dated break-glass authorization', async () => {
    const { persistence } = fixture({ breakGlass: { started_at: new Date(Date.now() + 30000).toISOString() } });
    await expect(persistence.validateBreakGlassForExecution('glass', 'executor')).rejects.toThrow('BREAK_GLASS_NOT_STARTED');
  });

  it.each(['2000-01-01T00:00:00Z', 'invalid-time'])('does not allow caller-selected authorization time %s', async at => {
    const { persistence } = fixture();
    await expect(persistence.validateBreakGlassForExecution('glass', 'executor', at)).rejects.toThrow('BREAK_GLASS_CALLER_TIME_FORBIDDEN');
  });

  it('rejects malformed stored authorization windows', async () => {
    const { persistence } = fixture({ breakGlass: { expires_at: 'invalid-time' } });
    await expect(persistence.validateBreakGlassForExecution('glass', 'executor')).rejects.toThrow('BREAK_GLASS_TIME_INVALID');
  });
});

describe('Governance V2 full affected dependency closure', () => {
  it('blocks approval if a dependency of the second disconnected component is missing', async () => {
    const { persistence, execute, query } = fixture();
    await expect(persistence.approveProductionChange('pcr', 'approver')).rejects.toThrow('REGRESSION_CASCADE_BLOCKED');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WITH RECURSIVE'), 'B');
    expect(execute).not.toHaveBeenCalled();
  });

  it('blocks release if a later component has a failing transitive dependency', async () => {
    const { persistence, execute } = fixture({ status: 'APPROVED', approval_status: 'APPROVED', dependency_checks: { __graph: { status: 'COMPLETE' }, A: 'PASS', A1: 'PASS', B: 'PASS', B1: 'FAIL' } });
    await expect(persistence.evaluateProductionReleaseGate('pcr', 'executor', { candidateRef: 'candidate', versionId: 'v1', revision: 'revision' })).rejects.toThrow('RELEASE_BLOCKED:REGRESSION_CASCADE');
    expect(execute).not.toHaveBeenCalled();
  });

  it('allows the existing release gate only when the full deduplicated closure passed', async () => {
    const { persistence, query } = fixture({ status: 'APPROVED', approval_status: 'APPROVED', dependency_checks: { __graph: { status: 'COMPLETE' }, A: 'PASS', A1: 'PASS', B: 'PASS', B1: 'PASS' } });
    const result = await persistence.evaluateProductionReleaseGate('pcr', 'executor', { candidateRef: 'candidate', versionId: 'v1', revision: 'revision' });
    expect(result.impactedComponents).toEqual(['A', 'A1', 'B', 'B1']);
    expect(query.mock.calls.filter(([sql]) => sql.includes('WITH RECURSIVE'))).toHaveLength(2);
    expect(result.productionMutation).toBe(false);
  });

  it.each([[], ['A', ''], null])('does not accept an incomplete affected-component list', async affected_components => {
    const { persistence, execute } = fixture({ affected_components });
    await expect(persistence.approveProductionChange('pcr', 'approver')).rejects.toThrow('DEPENDENCY_COMPONENTS_INCOMPLETE');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not treat an expired accepted degradation as current release evidence', async () => {
    const { persistence } = fixture({ status: 'APPROVED', approval_status: 'APPROVED', dependency_checks: { __graph: { status: 'COMPLETE' }, A: 'PASS', A1: 'PASS', B: 'PASS', B1: { status: 'EXPLICIT_ACCEPTED_DEGRADATION', humanApprovalId: 'approval', rationale: 'reason', evidenceRef: 'proof', expiry: '2000-01-01T00:00:00Z' } } });
    await expect(persistence.evaluateProductionReleaseGate('pcr', 'executor', { candidateRef: 'candidate', versionId: 'v1', revision: 'revision' })).rejects.toThrow('RELEASE_BLOCKED:REGRESSION_CASCADE');
  });

  it('requires the exact candidate version to be CANONICAL, not merely present', async () => {
    const { persistence } = fixture({ version_status: 'WIP', status: 'APPROVED', approval_status: 'APPROVED' });
    await expect(persistence.evaluateProductionReleaseGate('pcr', 'executor', { candidateRef: 'candidate', versionId: 'v1', revision: 'revision' })).rejects.toThrow('RELEASE_BLOCKED:VERSION_NOT_CANONICAL');
  });
});
