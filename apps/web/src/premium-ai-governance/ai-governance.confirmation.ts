export type AiGovernanceUserConfirmation = {
  operationId: string;
  confirmed: true;
  confirmedAt: string;
};

export type AiGovernanceInspectorConfirmation = {
  operationId: string;
  policyVersion: string;
  outcome: 'approved';
  confirmedAt: string;
};
