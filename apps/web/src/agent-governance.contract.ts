export type AgentGovernanceStatus = 'active' | 'planned' | 'monitoring';

export type AgentGovernanceRecord = {
  id: string;
  code: string;
  nameKey: string;
  roleKey: string;
  responsibilitiesKey: string;
  ownerDepartmentId: string;
  status: AgentGovernanceStatus;
  lastValidationKey: string;
  lastActivityKey: string;
  reliabilityKey: string;
  displayName?: string;
  displayRole?: string;
  displayResponsibilities?: string;
};
