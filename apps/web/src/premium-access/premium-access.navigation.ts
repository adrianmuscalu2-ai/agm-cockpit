import type { AccessEntitlementSnapshot, PremiumCapabilityId } from './premium-access.contract';
import { decidePremiumAccess } from './premium-access.guard';
import type { PremiumViewName } from '../premium-routes';

const capabilityForView: Record<PremiumViewName, PremiumCapabilityId> = {
  premium: 'premium.command-center',
  premiumTeam: 'premium.team',
  premiumLoadSafety: 'premium.load-safety',
  premiumCommunications: 'premium.communications',
  premiumVoice: 'premium.voice-assistant',
  carMover: 'car-mover.jobs',
};

let verifiedSnapshot: AccessEntitlementSnapshot | undefined;

export function registerVerifiedPremiumAccess(snapshot: AccessEntitlementSnapshot) {
  verifiedSnapshot = snapshot;
}

export function clearVerifiedPremiumAccess() {
  verifiedSnapshot = undefined;
}

export function verifiedPremiumSubject(requiredCapability: PremiumCapabilityId, now = new Date()) {
  const decision = decidePremiumAccess(verifiedSnapshot, requiredCapability, now);
  return decision.outcome === 'allow' ? decision.snapshot.subjectId : undefined;
}

export function isPremiumNavigationAllowed(view: PremiumViewName, now = new Date()) {
  return decidePremiumAccess(verifiedSnapshot, capabilityForView[view], now).outcome === 'allow';
}
