import { createActionPreview } from './action-preview';
import { CapabilityAuditLog } from './capability.audit';
import { capabilityRegistry } from './capability.registry';
import type { BrokerDecision, CapabilityRequest } from './capability.types';

const PHONE = /^\+?[0-9][0-9 ()-]{4,24}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export class CapabilityBroker {
  private readonly seenRequests = new Set<string>();
  constructor(private readonly audit = new CapabilityAuditLog()) {}
  async prepare(request: CapabilityRequest): Promise<BrokerDecision> {
    const base = { occurredAt: new Date().toISOString(), requestId: request.requestId, capabilityId: request.capabilityId, productId: request.productId, moduleId: request.moduleId, tenantId: request.tenantId, subjectId: request.subjectId };
    const deny = (reason: string): BrokerDecision => { this.audit.record({ ...base, stage: 'DECISION', outcome: `DENIED:${reason}` }); return { status: 'DENIED', reason }; };
    if (!capabilityRegistry.has(request.capabilityId as never)) return deny('CAPABILITY_NOT_ALLOWLISTED');
    if (!request.premiumEntitled) return deny('PREMIUM_ENTITLEMENT_REQUIRED');
    if (request.productId !== 'agm-cockpit' || !request.moduleId.trim() || !request.tenantId.trim() || !request.subjectId.trim()) return deny('INVALID_SCOPE');
    if (this.seenRequests.has(request.requestId)) return deny('DUPLICATE_REQUEST');
    if (!Number.isFinite(Date.parse(request.requestedAt))) return deny('INVALID_REQUEST');
    const missing: string[] = [];
    if (request.capabilityId === 'OPEN_DIALER' && !PHONE.test(request.parameters.phoneNumber?.trim() ?? '')) missing.push('phoneNumber');
    if (request.capabilityId === 'OPEN_MAPS' && !request.parameters.destination?.trim()) missing.push('destination');
    if (request.capabilityId === 'OPEN_MAPS' && request.parameters.grounded === false) return deny('UNVERIFIED_DESTINATION');
    if (request.capabilityId === 'SEND_EMAIL' && !EMAIL.test(request.parameters.recipient?.trim() ?? '')) missing.push('recipient');
    if (request.capabilityId === 'SEND_WHATSAPP' && !PHONE.test(request.parameters.recipient?.trim() ?? '')) missing.push('recipient');
    if ((request.capabilityId === 'SEND_EMAIL' || request.capabilityId === 'SEND_WHATSAPP') && !request.parameters.body?.trim()) missing.push('body');
    if (missing.length) return { status: 'NEEDS_INPUT', missingFields: missing };
    this.seenRequests.add(request.requestId);
    const preview = await createActionPreview(request);
    this.audit.record({ ...base, stage: 'PREVIEW', outcome: 'READY', previewVersion: preview.previewVersion });
    return { status: 'PREVIEW_READY', preview };
  }
  auditSnapshot() { return this.audit.snapshot(); }
}
