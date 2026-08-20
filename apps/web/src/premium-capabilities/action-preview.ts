import type { ActionPreview, CapabilityRequest } from './capability.types';

const encoder = new TextEncoder();
function canonical(request: CapabilityRequest) {
  const p = request.parameters;
  return JSON.stringify({ capabilityId: request.capabilityId, phoneNumber: p.phoneNumber?.trim() ?? '', displayName: p.displayName?.trim() ?? '', destination: p.destination?.trim() ?? '', recipient: p.recipient?.trim() ?? '', subject: p.subject?.trim() ?? '', body: p.body?.trim() ?? '' });
}
export async function contentHash(request: CapabilityRequest) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(canonical(request)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function createActionPreview(request: CapabilityRequest, version = 1, now = new Date()): Promise<ActionPreview> {
  const hash = await contentHash(request);
  const capabilityId = request.capabilityId as ActionPreview['capabilityId'];
  return {
    confirmationId: crypto.randomUUID(), requestId: request.requestId, capabilityId,
    actionType: capabilityId === 'OPEN_DIALER' ? 'DIAL' : capabilityId === 'OPEN_MAPS' ? 'NAVIGATE' : capabilityId === 'SEND_EMAIL' ? 'EMAIL' : 'WHATSAPP',
    recipient: capabilityId === 'OPEN_DIALER' ? { displayName: request.parameters.displayName?.trim(), address: request.parameters.phoneNumber!.trim() } : capabilityId === 'SEND_EMAIL' || capabilityId === 'SEND_WHATSAPP' ? { displayName: request.parameters.displayName?.trim(), address: request.parameters.recipient!.trim() } : undefined,
    destination: capabilityId === 'OPEN_MAPS' ? request.parameters.destination!.trim() : undefined,
    subject: request.parameters.subject?.trim(), body: request.parameters.body?.trim(),
    contentHash: hash, previewVersion: version, createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(), executionMode: capabilityId.startsWith('SEND_') ? 'PROVIDER_HANDOFF' : 'SYSTEM_HANDOFF',
  };
}

export function previewChanged(previous: ActionPreview, next: ActionPreview) {
  return previous.contentHash !== next.contentHash || previous.previewVersion !== next.previewVersion || previous.confirmationId !== next.confirmationId;
}
