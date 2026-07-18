export const governedAiModuleIds = [
  'ai-copilot',
  'professional-linguistic-agents',
  'advanced-context-analysis',
  'proactive-recommendations',
] as const;

export type GovernedAiModuleId = (typeof governedAiModuleIds)[number];

export type AiGovernanceOperation = {
  id: string;
  moduleId: GovernedAiModuleId;
  capability: string;
  purpose: string;
  usesPersonalData: boolean;
  producesExternalEffect: boolean;
};

export const aiGovernanceBoundaries = {
  enabled: false,
  issuesPermits: false,
  executesOperations: false,
  performsExternalCalls: false,
  storesOperationalData: false,
  monitorsContinuously: false,
} as const;
