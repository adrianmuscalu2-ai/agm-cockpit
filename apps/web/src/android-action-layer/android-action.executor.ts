import {
  launchAndroidAssistant,
  openAndroidAssistantSettings,
  performAndroidDeviceHandoff,
  resolveAndroidContactForDial,
  type DeviceHandoffAction,
} from '../premium-capabilities/android-assistant.gateway';
import type { AndroidActionReceipt, AndroidActionResolution } from './android-action.contract';
import { evaluatePermissionRequest } from './permission-guardian.client';
import { readContacts } from '../contact-manager/contact-manager.storage';
import { resolvePersonalContactAction } from '../contact-manager/personal-contact';

const RECEIPTS_KEY = 'agm.android-action.receipts.v1';
const capabilityNames: Record<NonNullable<AndroidActionResolution['action']>, string> = {
  READ_CONTEXT: 'READ_CONTEXT', ASSISTANT: 'ANDROID_ASSISTANT', NAVIGATION: 'NAVIGATION', DIAL: 'DIALER',
  OPEN_APP: 'OPEN_APP', CALENDAR: 'CALENDAR_INSERT', REMINDER: 'REMINDER', ALARM: 'ALARM',
  SHARE: 'SHARE', EMAIL_DRAFT: 'EMAIL_DRAFT', MESSENGER_CHAT: 'MESSENGER_CHAT', SETTINGS: 'ANDROID_ASSISTANT_SETTINGS',
};

type GuardianLink = { evidenceId?: string; correlationId?: string };

export async function executeAndroidAction(text: string, resolution: AndroidActionResolution, options: { agmConfirmed?: boolean } = {}): Promise<AndroidActionReceipt> {
  if (resolution.status !== 'RESOLVED' || !resolution.action) {
    const result = resolution.status === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'CLARIFICATION_REQUIRED';
    return receipt(text, resolution, result, null, resolution.reason);
  }
  let effectiveResolution = resolveStoredPersonalContact(resolution);
  if (effectiveResolution.status !== 'RESOLVED' || !effectiveResolution.action) {
    return receipt(text, effectiveResolution, 'CLARIFICATION_REQUIRED', null, effectiveResolution.reason);
  }
  if (effectiveResolution.action === 'READ_CONTEXT') return receipt(text, effectiveResolution, 'READ', null, null);
  if (effectiveResolution.confirmation === 'AGM_REQUIRED' && !options.agmConfirmed) return receipt(text, effectiveResolution, 'CONFIRMATION_REQUIRED', null, 'AGM_CONFIRMATION_REQUIRED');

  const capabilityName = capabilityNames[effectiveResolution.action];
  let payload = effectiveResolution.payload ?? {};
  let contactGuardian: GuardianLink | undefined;

  if (effectiveResolution.action === 'DIAL' && payload.contactName && !payload.value) {
    const contact = await resolveAndroidContactForDial(payload.contactName);
    contactGuardian = { evidenceId: contact.guardianEvidenceId, correlationId: contact.guardianCorrelationId };
    if (contact.status !== 'RESOLVED' || !contact.phoneNumber) {
      const result = contact.status === 'PERMISSION_DENIED'
        ? 'AUTH_PERMISSION_FAILURE'
        : contact.status === 'NOT_FOUND' || contact.status === 'AMBIGUOUS' || contact.status === 'INVALID_INPUT'
          ? 'CLARIFICATION_REQUIRED'
          : 'UNAVAILABLE';
      return receipt(text, effectiveResolution, result, null, contact.reason, undefined, undefined, contactGuardian);
    }
    payload = {
      ...payload,
      contactName: contact.displayName?.trim() || payload.contactName,
      contactSource: 'ANDROID_CONTACTS',
      value: contact.phoneNumber,
    };
    effectiveResolution = { ...effectiveResolution, reason: 'CONTACT_PHONE_RESOLVED', payload };
  }

  const sensitivity = effectiveResolution.source === 'ACTIVE_GMAIL_CONTEXT' || Boolean(payload.contextText) || Boolean(payload.contactName)
    || effectiveResolution.action === 'SHARE' || effectiveResolution.action === 'EMAIL_DRAFT'
    || effectiveResolution.action === 'MESSENGER_CHAT' || effectiveResolution.action === 'DIAL'
    ? 'USER_TEXT' : 'PUBLIC';
  const native = effectiveResolution.action === 'SETTINGS'
    ? await openAndroidAssistantSettings()
    : effectiveResolution.action === 'ASSISTANT'
      ? await launchAndroidAssistant({ moduleId: 'android-action-layer', sensitivity, contextText: payload.contextText })
      : await performAndroidDeviceHandoff({ action: effectiveResolution.action as DeviceHandoffAction, ...payload }, {
        moduleId: `android-action-${effectiveResolution.action!.toLowerCase()}`, sensitivity,
      });
  const value = receipt(
    text, effectiveResolution,
    native.status === 'OPENED' ? 'OPENED' : native.status === 'UNSUPPORTED' ? 'UNSUPPORTED' : native.reason?.startsWith('GUARDIAN_') ? 'AUTH_PERMISSION_FAILURE' : 'UNAVAILABLE',
    native.target ?? null, native.status === 'OPENED' ? null : native.reason ?? 'NATIVE_HANDLER_UNAVAILABLE',
    native.guardianEvidenceId, native.guardianCorrelationId, contactGuardian,
  );
  void evaluatePermissionRequest({
    phase: 'OBSERVATION', requestedCapability: capabilityName, requestedPermissionOrScope: 'NOT_REQUIRED',
    requestor: 'agm.android-action-layer', reason: 'Record native intent result', risk: 'LOW', currentAuthority: 'NOT_REQUIRED',
    evidence: `receipt:${native.requestId ?? 'no-native-id'}:${native.status}:${native.target ?? 'no-target'}`,
  });
  return value;
}

function receipt(
  text: string,
  resolution: AndroidActionResolution,
  result: AndroidActionReceipt['result'],
  target: string | null,
  fallback: string | null,
  guardianEvidenceId?: string,
  guardianCorrelationId?: string,
  contactGuardian?: GuardianLink,
): AndroidActionReceipt {
  const value: AndroidActionReceipt = {
    contractVersion: 'android-action-receipt.v1', request: { text: text.slice(0, 500), action: resolution.action }, resolution,
    target, result, fallback, observedAt: new Date().toISOString(),
    ...(guardianEvidenceId ? { guardianEvidenceId } : {}),
    ...(guardianCorrelationId ? { guardianCorrelationId } : {}),
    ...(contactGuardian?.evidenceId ? { contactGuardianEvidenceId: contactGuardian.evidenceId } : {}),
    ...(contactGuardian?.correlationId ? { contactGuardianCorrelationId: contactGuardian.correlationId } : {}),
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

function resolveStoredPersonalContact(resolution: AndroidActionResolution): AndroidActionResolution {
  if (resolution.payload?.contactSource === 'AGM_PERSONAL_CONTACTS' && resolution.payload.value) return resolution;
  try {
    return resolvePersonalContactAction(resolution, readContacts(localStorage));
  } catch {
    return resolution;
  }
}
