export type CapabilityAuditEntry = {
  occurredAt: string;
  requestId: string;
  capabilityId: string;
  productId: string;
  moduleId: string;
  tenantId: string;
  subjectId: string;
  stage: 'DECISION' | 'PREVIEW' | 'CONFIRMATION' | 'HANDOFF' | 'RECEIPT';
  outcome: string;
  previewVersion?: number;
};

export class CapabilityAuditLog {
  private readonly entries: CapabilityAuditEntry[] = [];
  record(entry: CapabilityAuditEntry) { this.entries.push(Object.freeze({ ...entry })); }
  snapshot() { return this.entries.map((entry) => ({ ...entry })); }
}
