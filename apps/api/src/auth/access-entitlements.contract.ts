export const ACCESS_ENTITLEMENTS_CONTRACT = {
  id: 'API-002/PRE-001',
  version: 'access-entitlements@1.0.0',
  premiumRole: 'PREMIUM_ACCESS',
  defaultTier: 'basic',
  failureMode: 'deny-premium',
} as const;

export const premiumCapabilityIds = [
  'premium.command-center',
  'premium.team',
  'premium.load-safety',
] as const;

export type PremiumCapabilityId = (typeof premiumCapabilityIds)[number];
export type AccessTier = 'basic' | 'premium';
export type EntitlementStatus = 'active' | 'expired' | 'suspended';

export type AccessEntitlementSnapshot = {
  subjectId: string;
  tier: AccessTier;
  status: EntitlementStatus;
  capabilities: readonly PremiumCapabilityId[];
  validUntil?: string;
  evaluatedAt: string;
  policyVersion: typeof ACCESS_ENTITLEMENTS_CONTRACT.version;
};

export function evaluateAccessEntitlements(input: {
  subjectId: string;
  roles: readonly string[];
  evaluatedAt: Date;
}): AccessEntitlementSnapshot {
  const premium = input.roles.includes(ACCESS_ENTITLEMENTS_CONTRACT.premiumRole);
  return {
    subjectId: input.subjectId,
    tier: premium ? 'premium' : 'basic',
    status: 'active',
    capabilities: premium ? premiumCapabilityIds : [],
    evaluatedAt: input.evaluatedAt.toISOString(),
    policyVersion: ACCESS_ENTITLEMENTS_CONTRACT.version,
  };
}
