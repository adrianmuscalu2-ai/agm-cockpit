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

  it('grants only the declared Premium capabilities for the explicit role', () => {
    const snapshot = evaluateAccessEntitlements({
      subjectId: 'user-premium', roles: ['DRIVER', ACCESS_ENTITLEMENTS_CONTRACT.premiumRole], evaluatedAt,
    });
    expect(snapshot.tier).toBe('premium');
    expect(snapshot.capabilities).toEqual(premiumCapabilityIds);
  });

  it('does not infer Premium from unrelated roles', () => {
    expect(evaluateAccessEntitlements({
      subjectId: 'user-admin', roles: ['ADMIN', 'OWNER'], evaluatedAt,
    }).tier).toBe('basic');
  });
});
