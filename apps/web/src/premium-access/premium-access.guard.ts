import {
  accessTiers,
  entitlementStatuses,
  premiumCapabilityIds,
  type AccessEntitlementSnapshot,
  type PremiumAccessDecision,
  type PremiumCapabilityId,
} from './premium-access.contract';

export function decidePremiumAccess(
  value: unknown,
  requiredCapability: PremiumCapabilityId,
  now: Date,
): PremiumAccessDecision {
  if (!value) return { outcome: 'deny', reason: 'missing' };
  if (!isSnapshot(value)) return { outcome: 'deny', reason: 'invalid' };
  if (value.tier !== 'premium') return { outcome: 'deny', reason: 'basic' };
  if (value.status === 'expired') return { outcome: 'deny', reason: 'expired' };
  if (value.status === 'suspended') return { outcome: 'deny', reason: 'suspended' };
  if (value.validUntil && Date.parse(value.validUntil) <= now.getTime()) {
    return { outcome: 'deny', reason: 'expired' };
  }
  if (!value.capabilities.includes(requiredCapability)) {
    return { outcome: 'deny', reason: 'capability-missing' };
  }
  return { outcome: 'allow', snapshot: value };
}

function isSnapshot(value: unknown): value is AccessEntitlementSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AccessEntitlementSnapshot>;
  return (
    typeof candidate.subjectId === 'string' && candidate.subjectId.length > 0 &&
    accessTiers.includes(candidate.tier as never) &&
    entitlementStatuses.includes(candidate.status as never) &&
    Array.isArray(candidate.capabilities) &&
    candidate.capabilities.every((capability) => premiumCapabilityIds.includes(capability as never)) &&
    typeof candidate.evaluatedAt === 'string' && Number.isFinite(Date.parse(candidate.evaluatedAt)) &&
    candidate.policyVersion === 'access-entitlements@1.0.0' &&
    (candidate.validUntil === undefined || (typeof candidate.validUntil === 'string' && Number.isFinite(Date.parse(candidate.validUntil))))
  );
}
