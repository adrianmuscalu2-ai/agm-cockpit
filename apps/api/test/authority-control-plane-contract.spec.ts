import { detectAuthorityConflict, evaluateWriteBoundary, isRunbookActionSetAllowed } from '../src/authority-control-plane/authority-scope';
import { premiumNetworkSeed } from '../src/authority-control-plane/premium-network.seed';

describe('AGM Authority Control Plane contract', () => {
  const executive = (scopeId: string, subjectIds?: string[]) => ({
    scopeId, mode: 'EXECUTIVE', writeSet: ['car-mover.job.*'],
    resourceSelectors: subjectIds ? [{ productId: 'agm-car-mover', subjectIds }] : [],
  });

  it('rejects parent/child scope collisions when disjointness is not proven', () => {
    expect(detectAuthorityConflict(executive('premium.car-mover'), executive('premium.car-mover.jobs')).conflict).toBe(true);
  });

  it('permits provably disjoint subject selectors', () => {
    expect(detectAuthorityConflict(executive('premium.car-mover', ['job-a']), executive('premium.car-mover.jobs', ['job-b'])).conflict).toBe(false);
  });

  it('rejects a stale authority response at the write boundary', () => {
    expect(evaluateWriteBoundary({ state: 'REVOKED', expiresAt: new Date('2026-08-25T00:00:00Z'), epoch: 4, fencingToken: 4, scopeId: 'premium.car-mover.jobs', writeSet: ['car-mover.job.transition'] }, { epoch: 4, fencingToken: 4, scopeId: 'premium.car-mover.jobs', command: 'car-mover.job.transition' }, new Date('2026-08-24T00:00:00Z'))).toBe('STALE_AUTHORITY_STATE');
    expect(evaluateWriteBoundary({ state: 'ACTIVE', expiresAt: new Date('2026-08-25T00:00:00Z'), epoch: 5, fencingToken: 5, scopeId: 'premium.car-mover.jobs', writeSet: ['car-mover.job.transition'] }, { epoch: 4, fencingToken: 4, scopeId: 'premium.car-mover.jobs', command: 'car-mover.job.transition' }, new Date('2026-08-24T00:00:00Z'))).toBe('STALE_FENCING_TOKEN');
  });

  it('keeps Recovery Executor RUNBOOK-ONLY and Guardian outside failover', () => {
    const recovery = premiumNetworkSeed.find((entry) => entry.canonicalId === 'premium.recovery-executor');
    const guardian = premiumNetworkSeed.find((entry) => entry.canonicalId === 'agm.guardian.secrets');
    expect(recovery?.recoveryPolicy).toBe('RUNBOOK-ONLY');
    expect(recovery?.prohibitedActions).toEqual(expect.arrayContaining(['architecture.redesign', 'scope.expand', 'contract.change', 'guardian.takeover', 'critical-recovery.improvise']));
    expect(isRunbookActionSetAllowed(['telemetry.refresh'], ['telemetry.refresh'])).toBe(true);
    expect(isRunbookActionSetAllowed(['architecture.redesign'], ['telemetry.refresh'])).toBe(false);
    expect(guardian?.prohibitedActions).toContain('executive.failover');
  });

  it('has exactly one canonical Guardian and no Architecture Guardian', () => {
    expect(premiumNetworkSeed.filter((entry) => entry.kind === 'GUARDIAN').map((entry) => entry.canonicalId)).toEqual(['agm.guardian.secrets']);
    expect(premiumNetworkSeed.some((entry) => /architecture.*guardian/i.test(entry.canonicalId))).toBe(false);
  });
});
