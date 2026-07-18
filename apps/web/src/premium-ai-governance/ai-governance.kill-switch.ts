export type AiGovernanceKillSwitch = {
  engaged: boolean;
  reason: string;
  changedAt: string;
  changedBy: 'system-baseline' | 'authorized-operator';
};

export const initialAiGovernanceKillSwitch: AiGovernanceKillSwitch = {
  engaged: true,
  reason: 'foundation-disabled',
  changedAt: '2026-07-19T00:00:00.000Z',
  changedBy: 'system-baseline',
};
