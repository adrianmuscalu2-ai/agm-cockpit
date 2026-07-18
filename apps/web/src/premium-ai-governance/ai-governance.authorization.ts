import type { AiGovernancePermit } from './ai-governance.permit';
import type { AiGovernancePolicy } from './ai-governance.policy';
import {
  validateAiAuthorization,
  type AiAuthorizationDenialReason,
  type AiAuthorizationValidationInput,
} from './ai-governance.validation';

export type AiAuthorizationResult =
  | { outcome: 'denied'; reason: AiAuthorizationDenialReason }
  | { outcome: 'permitted'; permit: AiGovernancePermit };

export type AiAuthorizationRequest = AiAuthorizationValidationInput & {
  permitTtlMs: number;
  now: Date;
  createPermitId: () => string;
};

export function authorizeAiOperation(
  request: AiAuthorizationRequest,
): AiAuthorizationResult {
  const denialReason = validateAiAuthorization(request);
  if (denialReason) return { outcome: 'denied', reason: denialReason };

  const policy = request.policy as AiGovernancePolicy;
  const permitId = request.createPermitId().trim();
  if (!permitId) return { outcome: 'denied', reason: 'invalid-permit-id' };
  if (!Number.isFinite(request.permitTtlMs) || request.permitTtlMs <= 0) {
    return { outcome: 'denied', reason: 'invalid-permit-ttl' };
  }

  return {
    outcome: 'permitted',
    permit: {
      id: permitId,
      operationId: request.operation.id,
      moduleId: request.operation.moduleId,
      capability: request.operation.capability,
      policyId: policy.id,
      policyVersion: policy.version,
      risk: request.risk.level,
      issuedAt: request.now.toISOString(),
      expiresAt: new Date(
        request.now.getTime() + request.permitTtlMs,
      ).toISOString(),
      singleUse: true,
      status: 'issued',
    },
  };
}
