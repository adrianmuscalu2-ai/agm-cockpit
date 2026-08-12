export const accessTiers = ['basic', 'premium'] as const;
export const entitlementStatuses = ['active', 'expired', 'suspended'] as const;
export const premiumCapabilityIds = [
  'premium.command-center',
  'premium.team',
  'premium.load-safety',
  'premium.communications',
  'premium.voice-assistant',
  'car-mover.jobs',
] as const;

export type AccessTier = (typeof accessTiers)[number];
export type EntitlementStatus = (typeof entitlementStatuses)[number];
export type PremiumCapabilityId = (typeof premiumCapabilityIds)[number];

export type AccessEntitlementSnapshot = {
  subjectId: string;
  tier: AccessTier;
  status: EntitlementStatus;
  capabilities: readonly PremiumCapabilityId[];
  validUntil?: string;
  evaluatedAt: string;
  policyVersion: 'access-entitlements@1.0.0';
};

export type PremiumAccessDecision =
  | { outcome: 'allow'; snapshot: AccessEntitlementSnapshot }
  | { outcome: 'deny'; reason: 'missing' | 'invalid' | 'basic' | 'expired' | 'suspended' | 'capability-missing' };
