import { launchAndroidAssistant, performAndroidDeviceHandoff, type DeviceHandoffAction } from '../premium-capabilities/android-assistant.gateway';
import type { AndroidActionReceipt, AndroidActionResolution } from './android-action.contract';
import { evaluatePermissionRequest } from './permission-guardian.client';

const RECEIPTS_KEY = 'agm.android-action.receipts.v1';
const capabilityNames: Record<NonNullable<AndroidActionResolution['action']>, string> = {
  READ_CONTEXT: 'READ_CONTEXT', ASSISTANT: 'ANDROID_ASSISTANT', NAVIGATION: 'NAVIGATION', DIAL: 'DIALER',
  CALENDAR: 'CALENDAR_INSERT', SHARE: 'SHARE', EMAIL_DRAFT: 'EMAIL_DRAFT',
};

export async function executeAndroidAction(text: string, resolution: AndroidActionResolution, options: { agmConfirmed?: boolean } = {}): Promise<AndroidActionReceipt> {
  if (resolution.status !== 'RESOLVED' || !resolution.action) return receipt(text, resolution, resolution.status === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'UNAVAILABLE', null, resolution.reason);
  if (resolution.action === 'READ_CONTEXT') return receipt(text, resolution, 'READ', null, null);
  if (resolution.confirmation === 'AGM_REQUIRED' && !options.agmConfirmed) return receipt(text, resolution, 'CONFIRMATION_REQUIRED', null, 'AGM_CONFIRMATION_REQUIRED');

  const capabilityName = capabilityNames[resolution.action];
  const guardian = await evaluatePermissionRequest({
    phase: 'EXECUTION', requestedCapability: capabilityName, requestedPermissionOrScope: 'NOT_REQUIRED',
    requestor: 'agm.android-action-layer', reason: resolution.reason, risk: resolution.action === 'SHARE' ? 'MEDIUM' : 'LOW',
    currentAuthority: 'NOT_REQUIRED', evidence: `resolution:${resolution.contractVersion}:${resolution.source}`,
  });
  if (!guardian?.authorityGranted) return receipt(text, resolution, 'AUTH_PERMISSION_FAILURE', null, guardian?.reasonCode ?? 'GUARDIAN_NOT_PROVEN');

  const payload = resolution.payload ?? {};
  const sensitivity = resolution.source === 'ACTIVE_GMAIL_CONTEXT' || resolution.action === 'SHARE' || resolution.action === 'EMAIL_DRAFT'
    ? 'USER_TEXT' : 'PUBLIC';
  const native = resolution.action === 'ASSISTANT'
    ? await launchAndroidAssistant({ moduleId: 'android-action-layer', sensitivity, contextText: payload.contextText })
    : await performAndroidDeviceHandoff({ action: resolution.action as DeviceHandoffAction, ...payload }, {
      moduleId: `android-action-${resolution.action.toLowerCase()}`, sensitivity,
    });
  const value = receipt(text, resolution, native.status === 'OPENED' ? 'OPENED' : native.status === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'UNAVAILABLE', native.target ?? null, native.status === 'OPENED' ? null : native.reason ?? 'NATIVE_HANDLER_UNAVAILABLE');
  void evaluatePermissionRequest({
    phase: 'OBSERVATION', requestedCapability: capabilityName, requestedPermissionOrScope: 'NOT_REQUIRED',
    requestor: 'agm.android-action-layer', reason: 'Record native intent result', risk: 'LOW', currentAuthority: 'NOT_REQUIRED',
    evidence: `receipt:${native.requestId ?? 'no-native-id'}:${native.status}:${native.target ?? 'no-target'}`,
  });
  return value;
}

function receipt(text: string, resolution: AndroidActionResolution, result: AndroidActionReceipt['result'], target: string | null, fallback: string | null): AndroidActionReceipt {
  const value: AndroidActionReceipt = {
    contractVersion: 'android-action-receipt.v1', request: { text: text.slice(0, 500), action: resolution.action }, resolution,
    target, result, fallback, observedAt: new Date().toISOString(),
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
