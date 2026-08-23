import {
  ACCESS_ENTITLEMENTS_CONTRACT,
  evaluateAccessEntitlements,
  premiumCapabilityIds,
} from '../src/auth/access-entitlements.contract';

describe('API-002 access entitlements contract', () => {
  const evaluatedAt = new Date('2026-08-01T12:00:00.000Z');

  it('defaults safely to Basic', () => {
    expect(evaluateAccessEntitlements({ subjectId: 'user-basic', roles: [], evaluatedAt })).toEqual({
      subjectId: 'user-basic', tier: 'basic', status: 'active', capabilities: [],
      evaluatedAt: evaluatedAt.toISOString(), policyVersion: ACCESS_ENTITLEMENTS_CONTRACT.version,
    });
  });

  it('grants all AGM Premium capabilities, including Car Mover, for the explicit Premium role', () => {
    const snapshot = evaluateAccessEntitlements({
      subjectId: 'user-premium', roles: ['DRIVER', ACCESS_ENTITLEMENTS_CONTRACT.premiumRole], evaluatedAt,
    });
    expect(snapshot.tier).toBe('premium');
    expect(snapshot.capabilities).toEqual(premiumCapabilityIds);
  });

  it('does not require a separate Car Mover product role', () => {
    const snapshot = evaluateAccessEntitlements({
      subjectId: 'user-car-mover', roles: [ACCESS_ENTITLEMENTS_CONTRACT.premiumRole], evaluatedAt,
    });
    expect(snapshot.capabilities).toEqual(premiumCapabilityIds);
    expect(snapshot.capabilities as readonly string[]).toContain('car-mover.jobs');
  });

  it('does not infer Premium from unrelated roles', () => {
    expect(evaluateAccessEntitlements({
      subjectId: 'user-admin', roles: ['ADMIN', 'OWNER'], evaluatedAt,
    }).tier).toBe('basic');
  });
});
