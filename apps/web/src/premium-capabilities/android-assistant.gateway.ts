import { Capacitor, registerPlugin } from '@capacitor/core';
import { routeDeviceOperation } from '../device-capability-router/device-capability.runtime';
import { captureDeviceHandoffContext, installDeviceHandoffResumeListener } from '../device-capability-router/device-handoff.context';
import type { DataSensitivity } from '../device-capability-router/device-capability.types';
import { evaluatePermissionRequest, type GuardianAuthorityState, type GuardianEvaluation } from '../android-action-layer/permission-guardian.client';

interface AgmCapabilityPlugin {
  launchAssistant(options?: { contextText?: string }): Promise<DeviceHandoffResult>;
  performDeviceHandoff(options: DeviceHandoffRequest): Promise<DeviceHandoffResult>;
  shareWithAi(options: { text: string; chooserTitle: string }): Promise<{ status: 'OPENED' }>;
  openAssistantSettings(): Promise<DeviceHandoffResult>;
  getAndroidActionProtocolStatus(): Promise<AndroidActionProtocolStatus>;
  checkContactsPermission(): Promise<{ state: NativePermissionState }>;
  requestContactsPermission(): Promise<{ state: NativePermissionState }>;
  resolveContact(options: { name: string }): Promise<ContactLookupResult>;
}

export type DeviceHandoffAction = 'ASSISTANT' | 'NAVIGATION' | 'DIAL' | 'OPEN_APP' | 'CALENDAR' | 'REMINDER' | 'ALARM' | 'SHARE' | 'EMAIL_DRAFT';
export type DeviceHandoffStatus = 'OPENED' | 'UNAVAILABLE' | 'UNSUPPORTED' | 'INVALID_INPUT';
export type DeviceHandoffResult = {
  protocolVersion?: 'android-action-protocol.v1';
  requestId?: string;
  status: DeviceHandoffStatus;
  reason?: string;
  resolution?: 'RESOLVED' | 'UNRESOLVED';
  target?: string;
  fallback?: string;
  permission?: 'NOT_REQUIRED';
  observedAtEpochMs?: number;
  guardianEvidenceId?: string;
  guardianCorrelationId?: string;
};
export type DeviceHandoffRequest = {
  action: DeviceHandoffAction;
  value?: string;
  navigationApp?: 'MAPS' | 'WAZE' | 'TOMTOM';
  contextText?: string;
  hour?: number;
  minute?: number;
  startEpochMs?: number;
  mimeType?: string;
  contentUri?: string;
  subject?: string;
};

type NativePermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'limited';
export type ContactLookupResult = {
  status: 'RESOLVED' | 'NOT_FOUND' | 'AMBIGUOUS' | 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'INVALID_INPUT';
  reason: string;
  displayName?: string;
  phoneNumber?: string;
  guardianEvidenceId?: string;
  guardianCorrelationId?: string;
};

export type AndroidPermissionStatus = 'AUTHORIZED' | 'DENIED' | 'DENIED_DONT_ASK_AGAIN' | 'REVOKED' | 'NOT_REQUIRED' | 'NOT_PROVEN' | 'UNAVAILABLE';
export type AndroidActionProtocolStatus = {
  schemaVersion: 1;
  capturedAtEpochMs: number;
  selectedAssistantPackage?: string;
  targets: Record<'assistant' | 'navigation' | 'dialer' | 'calendar' | 'share' | 'emailDraft', boolean>;
  permissions: Record<'assistant' | 'navigation' | 'dialer' | 'calendar' | 'share' | 'emailDraft', 'NOT_REQUIRED'>;
  runtimePermissions: { microphone: AndroidPermissionStatus; camera: AndroidPermissionStatus; contacts: AndroidPermissionStatus };
};

const capability = registerPlugin<AgmCapabilityPlugin>('AgmCapability');
installDeviceHandoffResumeListener();

const guardianCapability: Record<DeviceHandoffAction, string> = {
  ASSISTANT: 'ANDROID_ASSISTANT', NAVIGATION: 'NAVIGATION', DIAL: 'DIALER', OPEN_APP: 'OPEN_APP',
  CALENDAR: 'CALENDAR_INSERT', REMINDER: 'REMINDER', ALARM: 'ALARM', SHARE: 'SHARE', EMAIL_DRAFT: 'EMAIL_DRAFT',
};

async function authorize(capabilityId: string, requestor: string, reason: string, risk: 'LOW' | 'MEDIUM' = 'LOW') {
  return evaluatePermissionRequest({
    phase: 'EXECUTION', requestedCapability: capabilityId, requestedPermissionOrScope: 'NOT_REQUIRED',
    requestor, reason, risk, currentAuthority: 'NOT_REQUIRED', evidence: `pre-action:${capabilityId}:${requestor}`,
  });
}

function denied(evaluation: GuardianEvaluation | null): DeviceHandoffResult {
  return {
    status: 'UNAVAILABLE', reason: evaluation?.reasonCode ?? 'GUARDIAN_NOT_PROVEN',
    ...(evaluation?.evidenceId ? { guardianEvidenceId: evaluation.evidenceId } : {}),
    ...(evaluation?.correlationId ? { guardianCorrelationId: evaluation.correlationId } : {}),
  };
}

function withGuardian(result: DeviceHandoffResult, evaluation: GuardianEvaluation): DeviceHandoffResult {
  return { ...result, guardianEvidenceId: evaluation.evidenceId, guardianCorrelationId: evaluation.correlationId };
}

function permissionAuthority(state: NativePermissionState): GuardianAuthorityState {
  if (state === 'granted') return 'AUTHORIZED';
  if (state === 'denied' || state === 'prompt-with-rationale') return 'DENIED';
  return 'NOT_PROVEN';
}

export function isAndroidAssistantAvailable() {
  return Capacitor.getPlatform() === 'android';
}

export async function resolveAndroidContactForDial(name: string): Promise<ContactLookupResult> {
  const contactName = name.trim().slice(0, 120);
  if (!contactName) return { status: 'INVALID_INPUT', reason: 'CONTACT_NAME_REQUIRED' };
  if (!isAndroidAssistantAvailable()) return { status: 'UNAVAILABLE', reason: 'ANDROID_REQUIRED' };

  const before = await capability.checkContactsPermission();
  const requestEvaluation = await evaluatePermissionRequest({
    phase: 'REQUEST', requestedCapability: 'CONTACT_LOOKUP', requestedPermissionOrScope: 'android.permission.READ_CONTACTS',
    requestor: 'agm.android-contact-lookup', reason: 'Resolve a user-requested contact name locally before opening the dialer',
    risk: 'MEDIUM', currentAuthority: permissionAuthority(before.state), evidence: `contacts-before:${before.state}`,
  });
  if (!requestEvaluation?.authorityGranted) return {
    status: 'PERMISSION_DENIED', reason: requestEvaluation?.reasonCode ?? 'GUARDIAN_NOT_PROVEN',
    ...(requestEvaluation?.evidenceId ? { guardianEvidenceId: requestEvaluation.evidenceId } : {}),
    ...(requestEvaluation?.correlationId ? { guardianCorrelationId: requestEvaluation.correlationId } : {}),
  };

  const after = before.state === 'granted' ? before : await capability.requestContactsPermission();
  const executionEvaluation = await evaluatePermissionRequest({
    phase: 'EXECUTION', requestedCapability: 'CONTACT_LOOKUP', requestedPermissionOrScope: 'android.permission.READ_CONTACTS',
    requestor: 'agm.android-contact-lookup', reason: 'Resolve a user-requested contact name locally before opening the dialer',
    risk: 'MEDIUM', currentAuthority: permissionAuthority(after.state), evidence: `contacts-after:${after.state}`,
  });
  if (!executionEvaluation?.authorityGranted) return {
    status: 'PERMISSION_DENIED', reason: executionEvaluation?.reasonCode ?? 'GUARDIAN_NOT_PROVEN',
    ...(executionEvaluation?.evidenceId ? { guardianEvidenceId: executionEvaluation.evidenceId } : {}),
    ...(executionEvaluation?.correlationId ? { guardianCorrelationId: executionEvaluation.correlationId } : {}),
  };

  const result = await capability.resolveContact({ name: contactName });
  return {
    ...result,
    guardianEvidenceId: executionEvaluation.evidenceId,
    guardianCorrelationId: executionEvaluation.correlationId,
  };
}

export async function launchAndroidAssistant(options: {
  moduleId?: string;
  sensitivity?: DataSensitivity;
  draftSelector?: string;
  draft?: string;
  contextText?: string;
} = {}) {
  if (!isAndroidAssistantAvailable()) return { status: 'UNAVAILABLE' as const, reason: 'ANDROID_REQUIRED' };
  const guardian = await authorize('ANDROID_ASSISTANT', options.moduleId ?? 'android-assistant', 'Open the user-selected Android assistant');
  if (!guardian?.authorityGranted) return denied(guardian);
  const sensitivity = options.sensitivity ?? 'PUBLIC';
  const decision = await routeDeviceOperation({
    operation: 'OPEN_DEVICE_ASSISTANT', sensitivity, userConfirmedExternal: true,
  });
  if (decision.authority !== 'EXTERNAL_DEVICE_AI') return { status: 'UNAVAILABLE' as const, reason: decision.reason };
  captureDeviceHandoffContext({
    moduleId: options.moduleId ?? 'android-assistant', sensitivity,
    draftSelector: options.draftSelector, draft: options.draft,
  });
  return withGuardian(await capability.launchAssistant({ contextText: options.contextText?.trim().slice(0, 2000) }), guardian);
}

export async function performAndroidDeviceHandoff(request: DeviceHandoffRequest, options: {
  moduleId?: string;
  sensitivity?: DataSensitivity;
  draftSelector?: string;
} = {}): Promise<DeviceHandoffResult> {
  if (!isAndroidAssistantAvailable()) return { status: 'UNAVAILABLE', reason: 'ANDROID_REQUIRED' };
  const sensitivity = options.sensitivity ?? 'PUBLIC';
  if (request.action === 'ASSISTANT') {
    return launchAndroidAssistant({
      moduleId: options.moduleId, sensitivity, draftSelector: options.draftSelector,
      draft: request.contextText, contextText: request.contextText,
    });
  }
  const guardian = await authorize(
    guardianCapability[request.action], options.moduleId ?? `android-device-${request.action.toLowerCase()}`,
    `Execute allowlisted Android ${request.action} handoff`, request.action === 'SHARE' || request.action === 'EMAIL_DRAFT' ? 'MEDIUM' : 'LOW',
  );
  if (!guardian?.authorityGranted) return denied(guardian);
  if (request.action === 'SHARE') {
    const decision = await routeDeviceOperation({ operation: 'SHARE_CONTEXT', sensitivity, userConfirmedExternal: true });
    if (decision.authority !== 'EXTERNAL_DEVICE_AI') return { status: 'UNAVAILABLE', reason: decision.reason };
  }
  captureDeviceHandoffContext({
    moduleId: options.moduleId ?? 'android-device-handoff', sensitivity,
    draftSelector: options.draftSelector, draft: request.value ?? request.contextText,
  });
  return withGuardian(await capability.performDeviceHandoff({
    ...request,
    value: request.value?.trim().slice(0, 500),
    contextText: request.contextText?.trim().slice(0, 2000),
  }), guardian);
}

export async function shareWithAndroidAi(text: string, chooserTitle: string, options: {
  moduleId?: string;
  sensitivity?: DataSensitivity;
  draftSelector?: string;
} = {}) {
  if (!isAndroidAssistantAvailable()) return { status: 'UNAVAILABLE' as const };
  const guardian = await authorize('SHARE', options.moduleId ?? 'android-share', 'Share user-confirmed text with an Android target', 'MEDIUM');
  if (!guardian?.authorityGranted) return denied(guardian);
  const sensitivity = options.sensitivity ?? 'USER_TEXT';
  const decision = await routeDeviceOperation({
    operation: 'SHARE_CONTEXT', sensitivity, userConfirmedExternal: true,
  });
  if (decision.authority !== 'EXTERNAL_DEVICE_AI') return { status: 'UNAVAILABLE' as const };
  captureDeviceHandoffContext({
    moduleId: options.moduleId ?? 'android-share', sensitivity,
    draftSelector: options.draftSelector, draft: text,
  });
  return withGuardian(await capability.shareWithAi({ text, chooserTitle }), guardian);
}

export async function openAndroidAssistantSettings() {
  if (!isAndroidAssistantAvailable()) return { status: 'UNAVAILABLE' as const };
  const guardian = await authorize('ANDROID_ASSISTANT_SETTINGS', 'agm.android-assistant-settings', 'Open Android assistant settings');
  if (!guardian?.authorityGranted) return denied(guardian);
  return withGuardian(await capability.openAssistantSettings(), guardian);
}

export async function getAndroidActionProtocolStatus(): Promise<AndroidActionProtocolStatus | null> {
  if (!isAndroidAssistantAvailable()) return null;
  return capability.getAndroidActionProtocolStatus();
}
