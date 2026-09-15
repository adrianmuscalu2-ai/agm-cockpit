import { launchAndroidAssistant, openAndroidAssistantSettings, performAndroidDeviceHandoff, type DeviceHandoffAction } from '../premium-capabilities/android-assistant.gateway';
import type { AndroidActionReceipt, AndroidActionResolution } from './android-action.contract';
import { evaluatePermissionRequest } from './permission-guardian.client';

const RECEIPTS_KEY = 'agm.android-action.receipts.v1';
const capabilityNames: Record<NonNullable<AndroidActionResolution['action']>, string> = {
  READ_CONTEXT: 'READ_CONTEXT', ASSISTANT: 'ANDROID_ASSISTANT', NAVIGATION: 'NAVIGATION', DIAL: 'DIALER',
  OPEN_APP: 'OPEN_APP', CALENDAR: 'CALENDAR_INSERT', REMINDER: 'REMINDER', ALARM: 'ALARM',
  SHARE: 'SHARE', EMAIL_DRAFT: 'EMAIL_DRAFT', SETTINGS: 'ANDROID_ASSISTANT_SETTINGS',
};

export async function executeAndroidAction(text: string, resolution: AndroidActionResolution, options: { agmConfirmed?: boolean } = {}): Promise<AndroidActionReceipt> {
  if (resolution.status !== 'RESOLVED' || !resolution.action) return receipt(text, resolution, resolution.status === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'UNAVAILABLE', null, resolution.reason);
  if (resolution.action === 'READ_CONTEXT') return receipt(text, resolution, 'READ', null, null);
  if (resolution.confirmation === 'AGM_REQUIRED' && !options.agmConfirmed) return receipt(text, resolution, 'CONFIRMATION_REQUIRED', null, 'AGM_CONFIRMATION_REQUIRED');

  const capabilityName = capabilityNames[resolution.action];
  const payload = resolution.payload ?? {};
  const sensitivity = resolution.source === 'ACTIVE_GMAIL_CONTEXT' || Boolean(payload.contextText) || resolution.action === 'SHARE' || resolution.action === 'EMAIL_DRAFT'
    ? 'USER_TEXT' : 'PUBLIC';
  const native = resolution.action === 'SETTINGS'
    ? await openAndroidAssistantSettings()
    : resolution.action === 'ASSISTANT'
    ? await launchAndroidAssistant({ moduleId: 'android-action-layer', sensitivity, contextText: payload.contextText })
    : await performAndroidDeviceHandoff({ action: resolution.action as DeviceHandoffAction, ...payload }, {
      moduleId: `android-action-${resolution.action.toLowerCase()}`, sensitivity,
    });
  const value = receipt(
    text, resolution,
    native.status === 'OPENED' ? 'OPENED' : native.status === 'UNSUPPORTED' ? 'UNSUPPORTED' : native.reason?.startsWith('GUARDIAN_') ? 'AUTH_PERMISSION_FAILURE' : 'UNAVAILABLE',
    native.target ?? null, native.status === 'OPENED' ? null : native.reason ?? 'NATIVE_HANDLER_UNAVAILABLE',
    native.guardianEvidenceId, native.guardianCorrelationId,
  );
  void evaluatePermissionRequest({
    phase: 'OBSERVATION', requestedCapability: capabilityName, requestedPermissionOrScope: 'NOT_REQUIRED',
    requestor: 'agm.android-action-layer', reason: 'Record native intent result', risk: 'LOW', currentAuthority: 'NOT_REQUIRED',
    evidence: `receipt:${native.requestId ?? 'no-native-id'}:${native.status}:${native.target ?? 'no-target'}`,
  });
  return value;
}

function receipt(text: string, resolution: AndroidActionResolution, result: AndroidActionReceipt['result'], target: string | null, fallback: string | null, guardianEvidenceId?: string, guardianCorrelationId?: string): AndroidActionReceipt {
  const value: AndroidActionReceipt = {
    contractVersion: 'android-action-receipt.v1', request: { text: text.slice(0, 500), action: resolution.action }, resolution,
    target, result, fallback, observedAt: new Date().toISOString(),
    ...(guardianEvidenceId ? { guardianEvidenceId } : {}),
    ...(guardianCorrelationId ? { guardianCorrelationId } : {}),
  };
  try {
    const existing = JSON.parse(sessionStorage.getItem(RECEIPTS_KEY) ?? '[]');
    const rows = Array.isArray(existing) ? existing : [];
    rows.push(value);
    sessionStorage.setItem(RECEIPTS_KEY, JSON.stringify(rows.slice(-100)));
    window.dispatchEvent(new CustomEvent('agm-android-action-receipt', { detail: value }));
  } catch {}
  return value;
}

export function readAndroidActionReceipts(): AndroidActionReceipt[] {
  try { const value = JSON.parse(sessionStorage.getItem(RECEIPTS_KEY) ?? '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}
