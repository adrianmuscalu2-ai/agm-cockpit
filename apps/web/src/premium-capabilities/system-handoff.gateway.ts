import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ActionConfirmation, ActionPreview, HandoffReceipt, HandoffStatus } from './capability.types';

interface AgmCapabilityPlugin { open(options: { capabilityId: string; value: string }): Promise<{ status: HandoffStatus; targetPackage?: string }> }
const nativePlugin = registerPlugin<AgmCapabilityPlugin>('AgmCapability');
export class SystemHandoffGateway {
  async open(preview: ActionPreview, confirmation: ActionConfirmation): Promise<HandoffReceipt> {
    if (confirmation.confirmationId !== preview.confirmationId || confirmation.previewVersion !== preview.previewVersion || confirmation.contentHash !== preview.contentHash) throw new Error('CONFIRMATION_BINDING_INVALID');
    let status: HandoffStatus = 'FAILED'; let targetPackage: string | undefined;
    try {
      if (Capacitor.isNativePlatform()) ({ status, targetPackage } = await nativePlugin.open({ capabilityId: preview.capabilityId, value: preview.recipient?.address ?? preview.destination ?? '' }));
      else {
        const uri = preview.capabilityId === 'OPEN_DIALER' ? `tel:${encodeURIComponent(preview.recipient!.address)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(preview.destination!)}`;
        window.location.assign(uri); status = 'OPENED';
      }
    } catch { status = 'FAILED'; }
    return { receiptId: crypto.randomUUID(), confirmationId: preview.confirmationId, capabilityId: preview.capabilityId, handedOffAt: new Date().toISOString(), status, targetPackage };
  }
}
