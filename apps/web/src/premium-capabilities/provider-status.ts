import type { CapabilityId, HandoffReceipt } from './capability.types';

export const WAVE_2C_STATUS_LEDGER = 'agm.wave2c.provider-status.v1';
export type ProviderStatus = 'STATUS_UNKNOWN' | 'PROVIDER_ACCEPTED' | 'SENT' | 'DELIVERED' | 'READ';
export type ProviderEvidence = {
  evidenceId: string;
  provider: 'GMAIL' | 'WHATSAPP';
  source: 'VERIFIED_PROVIDER_API' | 'VERIFIED_PROVIDER_WEBHOOK';
  status: Exclude<ProviderStatus, 'STATUS_UNKNOWN'>;
  providerReference: string;
  observedAt: string;
};
export type ProviderStatusRecord = {
  schemaVersion: 1;
  actionId: string;
  capabilityId: Extract<CapabilityId, 'SEND_EMAIL' | 'SEND_WHATSAPP'>;
  handoffReceiptId: string;
  handoffStatus: 'HANDOFF_CONFIRMED' | 'HANDOFF_FAILED';
  providerEvidence?: ProviderEvidence;
  status: ProviderStatus;
  reason?: 'PROVIDER_EVIDENCE_UNAVAILABLE' | 'HANDOFF_NOT_CONFIRMED';
  updatedAt: string;
};

const rank: Record<ProviderStatus, number> = { STATUS_UNKNOWN: 0, PROVIDER_ACCEPTED: 1, SENT: 2, DELIVERED: 3, READ: 4 };

export class ProviderStatusLedger {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {}
  recordHandoff(actionId: string, receipt: HandoffReceipt, now = new Date()): ProviderStatusRecord {
    const existing = this.read()[actionId];
    if (existing) {
      if (existing.handoffReceiptId !== receipt.receiptId || existing.capabilityId !== receipt.capabilityId) throw new Error('ACTION_CORRELATION_CONFLICT');
      return existing;
    }
    if (!['SEND_EMAIL', 'SEND_WHATSAPP'].includes(receipt.capabilityId)) throw new Error('CAPABILITY_NOT_SUPPORTED');
    const confirmed = receipt.status === 'OPENED';
    const record: ProviderStatusRecord = { schemaVersion: 1, actionId, capabilityId: receipt.capabilityId as ProviderStatusRecord['capabilityId'], handoffReceiptId: receipt.receiptId, handoffStatus: confirmed ? 'HANDOFF_CONFIRMED' : 'HANDOFF_FAILED', status: 'STATUS_UNKNOWN', reason: confirmed ? 'PROVIDER_EVIDENCE_UNAVAILABLE' : 'HANDOFF_NOT_CONFIRMED', updatedAt: now.toISOString() };
    this.save(actionId, record); return record;
  }
  applyEvidence(actionId: string, evidence: ProviderEvidence): ProviderStatusRecord {
    const current = this.read()[actionId]; if (!current) throw new Error('ACTION_NOT_FOUND');
    if (!evidence.evidenceId.trim() || !evidence.providerReference.trim() || !Number.isFinite(Date.parse(evidence.observedAt))) throw new Error('PROVIDER_EVIDENCE_INVALID');
    const expectedProvider = current.capabilityId === 'SEND_EMAIL' ? 'GMAIL' : 'WHATSAPP';
    if (evidence.provider !== expectedProvider) throw new Error('PROVIDER_EVIDENCE_SCOPE_MISMATCH');
    if (rank[evidence.status] < rank[current.status]) throw new Error('PROVIDER_STATUS_REGRESSION');
    const duplicate = Object.values(this.read()).find(record => record.providerEvidence?.evidenceId === evidence.evidenceId && record.actionId !== actionId);
    if (duplicate) throw new Error('PROVIDER_EVIDENCE_DUPLICATE');
    const next: ProviderStatusRecord = { ...current, providerEvidence: { ...evidence }, status: evidence.status, reason: undefined, updatedAt: evidence.observedAt };
    this.save(actionId, next); return next;
  }
  get(actionId: string) { const value = this.read()[actionId]; return value ? structuredClone(value) : undefined; }
  private read(): Record<string, ProviderStatusRecord> { try { return JSON.parse(this.storage.getItem(WAVE_2C_STATUS_LEDGER) ?? '{}'); } catch { return {}; } }
  private save(actionId: string, record: ProviderStatusRecord) { const all = this.read(); all[actionId] = record; this.storage.setItem(WAVE_2C_STATUS_LEDGER, JSON.stringify(all)); }
}
