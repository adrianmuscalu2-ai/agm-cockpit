export const premiumAgentStates = {
  preparing: {
    className: 'premium-team-agent-preparing',
    translationKey: 'premium.team.status.preparing',
  },
  available: {
    className: 'premium-team-agent-available',
    translationKey: 'premium.team.status.available',
  },
  active: {
    className: 'premium-team-agent-active',
    translationKey: 'premium.team.status.active',
  },
} as const;

export type PremiumAgentState = keyof typeof premiumAgentStates;

export function premiumAgentStateDefinition(state: PremiumAgentState) {
  return premiumAgentStates[state];
}
