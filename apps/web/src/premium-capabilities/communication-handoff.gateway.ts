import type { HandoffPort } from '../capabilities/handoff/handoff.port';
import { selectHandoffPort } from '../capabilities/handoff/handoff.facade';
import type { ActionConfirmation, ActionPreview, HandoffReceipt } from './capability.types';

export const WAVE_2B_LEDGER = 'agm.wave2b.communication-ledger.v1';
type LedgerEntry = { confirmationId: string; contentHash: string; status: 'HANDOFF_STARTED' | 'OPENED' | 'FAILED'; receipt?: HandoffReceipt };

export class CommunicationHandoffGateway {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage, private readonly port: HandoffPort = selectHandoffPort(), private readonly online = () => navigator.onLine) {}
  async open(preview: ActionPreview, confirmation: ActionConfirmation): Promise<HandoffReceipt> {
    if (!['SEND_EMAIL', 'SEND_WHATSAPP'].includes(preview.capabilityId)) throw new Error('CAPABILITY_NOT_SUPPORTED');
    if (confirmation.method !== 'VOICE') throw new Error('VERBAL_CONFIRMATION_REQUIRED');
    if (confirmation.confirmationId !== preview.confirmationId || confirmation.previewVersion !== preview.previewVersion || confirmation.contentHash !== preview.contentHash) throw new Error('CONFIRMATION_BINDING_INVALID');
    if (Date.parse(preview.expiresAt) <= Date.now()) throw new Error('PREVIEW_EXPIRED');
    const ledger = this.read(); const existing = ledger[preview.confirmationId];
    if (existing?.contentHash !== undefined) return existing.receipt ?? this.receipt(preview, 'FAILED');
    if (!this.online()) return this.receipt(preview, 'FAILED');
    ledger[preview.confirmationId] = { confirmationId: preview.confirmationId, contentHash: preview.contentHash, status: 'HANDOFF_STARTED' }; this.write(ledger);
    let receipt: HandoffReceipt;
    try {
      if (preview.capabilityId === 'SEND_EMAIL') await this.port.composeEmail({ recipient: preview.recipient!.address, subject: preview.subject ?? '', body: preview.body ?? '' });
      else await this.port.share({ subject: preview.subject ?? '', body: `${preview.body ?? ''}\n\nDestinatar confirmat: ${preview.recipient!.address}` });
      receipt = this.receipt(preview, 'OPENED'); ledger[preview.confirmationId] = { ...ledger[preview.confirmationId], status: 'OPENED', receipt };
    } catch { receipt = this.receipt(preview, 'FAILED'); ledger[preview.confirmationId] = { ...ledger[preview.confirmationId], status: 'FAILED', receipt }; }
    this.write(ledger); return receipt;
  }
  private receipt(preview: ActionPreview, status: 'OPENED' | 'FAILED'): HandoffReceipt { return { receiptId: crypto.randomUUID(), confirmationId: preview.confirmationId, capabilityId: preview.capabilityId, handedOffAt: new Date().toISOString(), status, targetPackage: this.port.platform }; }
  private read(): Record<string, LedgerEntry> { try { return JSON.parse(this.storage.getItem(WAVE_2B_LEDGER) ?? '{}'); } catch { return {}; } }
  private write(value: Record<string, LedgerEntry>) { this.storage.setItem(WAVE_2B_LEDGER, JSON.stringify(value)); }
}
