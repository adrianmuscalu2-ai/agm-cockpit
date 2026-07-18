import type {
  AiGovernanceOperation,
  GovernedAiModuleId,
} from './ai-governance.contract';
import type { AiGovernanceRiskLevel } from './ai-governance.risk';

export type AiGovernanceAuditOutcome =
  | 'registered'
  | 'inspector-approved'
  | 'inspector-blocked'
  | 'kill-switch-blocked'
  | 'policy-blocked';

export type AiGovernanceAuditEntry = {
  id: string;
  occurredAt: string;
  moduleId: GovernedAiModuleId;
  operationId: AiGovernanceOperation['id'];
  capability: string;
  policyId: string;
  policyVersion: string;
  risk: AiGovernanceRiskLevel;
  outcome: AiGovernanceAuditOutcome;
  reasonCodes: readonly string[];
  containsPersonalContent: false;
};
