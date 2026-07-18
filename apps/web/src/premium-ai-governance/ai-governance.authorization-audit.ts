import type { AiGovernanceAuditEntry } from './ai-governance.audit';
import type { AiGovernanceOperation } from './ai-governance.contract';
import type { AiGovernancePolicy } from './ai-governance.policy';
import type { AiGovernanceRiskClassification } from './ai-governance.risk';
import type { AiAuthorizationResult } from './ai-governance.authorization';

export function createAiAuthorizationAuditEntry(input: {
  id: string;
  occurredAt: string;
  operation: AiGovernanceOperation;
  policy: AiGovernancePolicy;
  risk: AiGovernanceRiskClassification;
  result: AiAuthorizationResult;
}): AiGovernanceAuditEntry {
  return {
    id: input.id,
    occurredAt: input.occurredAt,
    moduleId: input.operation.moduleId,
    operationId: input.operation.id,
    capability: input.operation.capability,
    policyId: input.policy.id,
    policyVersion: input.policy.version,
    risk: input.risk.level,
    outcome:
      input.result.outcome === 'permitted'
        ? 'permit-issued'
        : 'policy-blocked',
    reasonCodes:
      input.result.outcome === 'denied' ? [input.result.reason] : [],
    containsPersonalContent: false,
  };
}
