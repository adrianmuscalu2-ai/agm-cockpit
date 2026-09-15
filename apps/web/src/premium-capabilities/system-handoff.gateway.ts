import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ActionConfirmation, ActionPreview, HandoffReceipt, HandoffStatus } from './capability.types';
import { evaluatePermissionRequest } from '../android-action-layer/permission-guardian.client';

interface AgmCapabilityPlugin { open(options: { capabilityId: string; value: string }): Promise<{ status: HandoffStatus; targetPackage?: string }> }
const nativePlugin = registerPlugin<AgmCapabilityPlugin>('AgmCapability');
export class SystemHandoffGateway {
  async open(preview: ActionPreview, confirmation: ActionConfirmation): Promise<HandoffReceipt> {
    if (confirmation.confirmationId !== preview.confirmationId || confirmation.previewVersion !== preview.previewVersion || confirmation.contentHash !== preview.contentHash) throw new Error('CONFIRMATION_BINDING_INVALID');
    const guardian = await evaluatePermissionRequest({
      phase: 'EXECUTION',
      requestedCapability: preview.capabilityId === 'OPEN_DIALER' ? 'DIALER' : 'NAVIGATION',
      requestedPermissionOrScope: 'NOT_REQUIRED',
      requestor: 'agm.premium-copilot.system-handoff',
      reason: `Execute confirmed ${preview.actionType.toLowerCase()} handoff`,
      risk: preview.capabilityId === 'OPEN_DIALER' ? 'MEDIUM' : 'LOW',
      currentAuthority: 'NOT_REQUIRED',
      evidence: `confirmation:${confirmation.confirmationId}:request:${preview.requestId}`,
    });
    if (!guardian?.authorityGranted) {
      return {
        receiptId: crypto.randomUUID(), confirmationId: preview.confirmationId,
        capabilityId: preview.capabilityId, handedOffAt: new Date().toISOString(), status: 'FAILED',
        guardianEvidenceId: guardian?.evidenceId, guardianCorrelationId: guardian?.correlationId,
      };
    }
    let status: HandoffStatus = 'FAILED'; let targetPackage: string | undefined;
    try {
      if (Capacitor.isNativePlatform()) ({ status, targetPackage } = await nativePlugin.open({ capabilityId: preview.capabilityId, value: preview.recipient?.address ?? preview.destination ?? '' }));
      else {
        const uri = preview.capabilityId === 'OPEN_DIALER' ? `tel:${encodeURIComponent(preview.recipient!.address)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(preview.destination!)}`;
        window.location.assign(uri); status = 'OPENED';
      }
    } catch { status = 'FAILED'; }
    return {
      receiptId: crypto.randomUUID(), confirmationId: preview.confirmationId,
      capabilityId: preview.capabilityId, handedOffAt: new Date().toISOString(), status, targetPackage,
      guardianEvidenceId: guardian.evidenceId, guardianCorrelationId: guardian.correlationId,
    };
  }
}
