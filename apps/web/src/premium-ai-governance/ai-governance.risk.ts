export const aiGovernanceRiskLevels = [
  'low',
  'moderate',
  'sensitive',
  'prohibited',
] as const;

export type AiGovernanceRiskLevel = (typeof aiGovernanceRiskLevels)[number];

export type AiGovernanceRiskClassification = {
  level: AiGovernanceRiskLevel;
  reasons: readonly string[];
};

export function isProhibitedAiRisk(risk: AiGovernanceRiskClassification) {
  return risk.level === 'prohibited';
}
