import type { ActionConfirmation, ActionPreview, ConfirmationMethod } from './capability.types';

export class ActionConfirmationStore {
  private active?: { preview: ActionPreview; confirmation?: ActionConfirmation };
  setPreview(preview: ActionPreview) { this.active = { preview }; }
  clear() { this.active = undefined; }
  confirm(input: { confirmationId: string; previewVersion: number; contentHash: string; method: ConfirmationMethod }, now = new Date()) {
    const preview = this.active?.preview;
    if (!preview || preview.confirmationId !== input.confirmationId || preview.previewVersion !== input.previewVersion || preview.contentHash !== input.contentHash || Date.parse(preview.expiresAt) <= now.getTime()) return { status: 'DENIED' as const, reason: 'RECONFIRM_REQUIRED' };
    const confirmation: ActionConfirmation = { ...input, confirmedAt: now.toISOString() };
    this.active!.confirmation = confirmation;
    return { status: 'CONFIRMED' as const, confirmation };
  }
  consume(preview: ActionPreview, now = new Date()) {
    const active = this.active;
    if (!active?.confirmation || active.preview.confirmationId !== preview.confirmationId || active.preview.contentHash !== preview.contentHash || active.preview.previewVersion !== preview.previewVersion || Date.parse(preview.expiresAt) <= now.getTime()) return undefined;
    this.active = undefined;
    return active.confirmation;
  }
}
