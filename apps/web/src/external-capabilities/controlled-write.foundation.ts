import { sanitizeExternalValue, type ExternalAuditReceipt } from './external-capability.policy';

export type ControlledWriteRequest = Readonly<{
  requestId: string;
  capabilityId: string;
  provider: string;
  action: string;
  tenantId: string;
  expectedTenantId: string;
  actorId: string;
  payloadDigest: string;
  requestedAt: string;
}>;

export type ControlledWriteConfirmation = Readonly<{
  confirmationId: string;
  explicit: boolean;
  requestId: string;
  capabilityId: string;
  provider: string;
  action: string;
  tenantId: string;
  payloadDigest: string;
  issuedAt: string;
  expiresAt: string;
}>;

export type ControlledWriteDecision = Readonly<{
  status: 'POLICY_ALLOWED' | 'DENIED';
  reason: string;
  receipt: ExternalAuditReceipt;
}>;

export type ControlledWriteAllowlist = Readonly<{ capabilityId: string; provider: string; action: string }>;
const DEFAULT_ALLOWLIST: ControlledWriteAllowlist = { capabilityId: 'CONTROLLED_EXTERNAL_WRITE_FOUNDATION', provider: 'FOUNDATION_DUMMY_PROVIDER', action: 'CONTROLLED_WRITE_HANDOFF' };

export class ControlledExternalWriteFoundation {
  private revoked = false;
  private readonly consumedConfirmations = new Set<string>();
  constructor(private readonly allowlist: ControlledWriteAllowlist = DEFAULT_ALLOWLIST) {}

  revoke(): void { this.revoked = true; }
  restore(): void { this.revoked = false; }

  evaluate(request: ControlledWriteRequest, confirmation?: ControlledWriteConfirmation, now = new Date()): ControlledWriteDecision {
    let reason = 'CONTROLLED_WRITE_POLICY_ALLOWED';
    if (this.revoked) reason = 'PERMISSION_REVOKED';
    else if (request.capabilityId !== this.allowlist.capabilityId) reason = 'CAPABILITY_NOT_ALLOWLISTED';
    else if (request.provider !== this.allowlist.provider) reason = 'PROVIDER_NOT_ALLOWLISTED';
    else if (request.action !== this.allowlist.action) reason = 'ACTION_NOT_ALLOWLISTED';
    else if (!request.tenantId || request.tenantId !== request.expectedTenantId) reason = 'TENANT_ISOLATION_VIOLATION';
    else if (!confirmation?.explicit) reason = 'EXPLICIT_CONFIRMATION_REQUIRED';
    else if (
      confirmation.requestId !== request.requestId ||
      confirmation.capabilityId !== request.capabilityId ||
      confirmation.provider !== request.provider ||
      confirmation.action !== request.action ||
      confirmation.tenantId !== request.tenantId ||
      confirmation.payloadDigest !== request.payloadDigest
    ) reason = 'CONFIRMATION_BINDING_INVALID';
    else if (Number.isNaN(Date.parse(confirmation.expiresAt)) || now.getTime() > Date.parse(confirmation.expiresAt)) reason = 'CONFIRMATION_EXPIRED';
    else if (this.consumedConfirmations.has(confirmation.confirmationId)) reason = 'CONFIRMATION_REPLAY_DENIED';

    const allowed = reason === 'CONTROLLED_WRITE_POLICY_ALLOWED';
    if (allowed && confirmation) this.consumedConfirmations.add(confirmation.confirmationId);
    return { status: allowed ? 'POLICY_ALLOWED' : 'DENIED', reason, receipt: this.receipt(request, allowed, reason, confirmation) };
  }

  private receipt(request: ControlledWriteRequest, allowed: boolean, reason: string, confirmation?: ControlledWriteConfirmation): ExternalAuditReceipt {
    return sanitizeExternalValue({
      receiptId: crypto.randomUUID(), requestId: request.requestId, actorId: request.actorId,
      tenantId: request.tenantId, capabilityId: request.capabilityId, provider: request.provider,
      access: 'WRITE', confirmation: confirmation?.explicit ? 'CONFIRMED' : 'MISSING_OR_INVALID',
      result: allowed ? 'ALLOWED' : 'DENIED', reason, occurredAt: new Date().toISOString(), attempts: 0,
    }) as ExternalAuditReceipt;
  }
}

export function issueDummyExplicitConfirmation(request: ControlledWriteRequest, now = new Date()): ControlledWriteConfirmation {
  return Object.freeze({
    confirmationId: crypto.randomUUID(), explicit: true, requestId: request.requestId,
    capabilityId: request.capabilityId, provider: request.provider, action: request.action,
    tenantId: request.tenantId, payloadDigest: request.payloadDigest, issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
  });
}
