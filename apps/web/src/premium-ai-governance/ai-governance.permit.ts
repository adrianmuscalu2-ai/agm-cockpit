import type { GovernedAiModuleId } from './ai-governance.contract';
import type { AiGovernanceRiskLevel } from './ai-governance.risk';
import type { AiGovernanceOperation } from './ai-governance.contract';

export type AiGovernancePermitStatus =
  | 'issued'
  | 'consumed'
  | 'expired'
  | 'revoked';

export type AiGovernancePermit = {
  id: string;
  operationId: string;
  moduleId: GovernedAiModuleId;
  capability: string;
  policyId: string;
  policyVersion: string;
  risk: AiGovernanceRiskLevel;
  issuedAt: string;
  expiresAt: string;
  singleUse: true;
  status: AiGovernancePermitStatus;
};

export type AiGovernancePermitEvent =
  | { type: 'consume' }
  | { type: 'expire' }
  | { type: 'revoke' };

export function transitionAiGovernancePermit(
  permit: AiGovernancePermit,
  event: AiGovernancePermitEvent,
): AiGovernancePermit {
  if (permit.status !== 'issued') return permit;
  if (event.type === 'consume') return { ...permit, status: 'consumed' };
  if (event.type === 'expire') return { ...permit, status: 'expired' };
  return { ...permit, status: 'revoked' };
}

export function isAiGovernancePermitValid(
  permit: AiGovernancePermit,
  policyVersion: string,
  now: Date,
) {
  return (
    permit.status === 'issued' &&
    permit.policyVersion === policyVersion &&
    Date.parse(permit.expiresAt) > now.getTime()
  );
}

export function isAiGovernancePermitValidForOperation(
  permit: AiGovernancePermit,
  operation: AiGovernanceOperation,
  policyVersion: string,
  now: Date,
) {
  return (
    isAiGovernancePermitValid(permit, policyVersion, now) &&
    permit.operationId === operation.id &&
    permit.moduleId === operation.moduleId &&
    permit.capability === operation.capability
  );
}
