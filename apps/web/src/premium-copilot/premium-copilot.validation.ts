import {
  premiumCopilotCapabilities,
  type PremiumCopilotMission,
} from './premium-copilot.contract';

export function validatePremiumCopilotMission(mission: PremiumCopilotMission) {
  if (!mission.id.trim()) return 'invalid-mission-id' as const;
  if (!premiumCopilotCapabilities.includes(mission.capability)) return 'unsupported-capability' as const;
  if (!mission.userRequest.trim() || mission.userRequest.length > 2_000) return 'invalid-user-request' as const;
  if (!mission.proposedAction.trim() || mission.proposedAction.length > 1_000) return 'invalid-proposed-action' as const;
  if (mission.contextRefs.length > 20 || mission.contextRefs.some((reference) => !reference.trim() || reference.length > 160)) {
    return 'invalid-context-reference' as const;
  }
  if (mission.usesPersonalData) return 'personal-data-not-allowed' as const;
  if (mission.producesExternalEffect) return 'external-effect-not-allowed' as const;
  return undefined;
}
