import type { BasicLanguageCode } from '../language-registry';
import {
  getAndroidActionProtocolStatus, isAndroidAssistantAvailable, type DeviceHandoffAction, type DeviceHandoffResult,
} from './android-assistant.gateway';
import { deviceAssistantCopy } from './device-assistant-handoff.i18n';
import { executeAndroidAction } from '../android-action-layer/android-action.executor';
import { confirmationFor } from '../android-action-layer/confirmation-policy';
import type { AndroidActionKind, AndroidActionResolution } from '../android-action-layer/android-action.contract';
import { evaluatePermissionRequest } from '../android-action-layer/permission-guardian.client';

const commandPatterns = [
  /\b(deschide|porneste|apeleaza)\s+(asistentul\s+)?(android|telefonului|telefon)\b/i,
  /\b(open|launch|start)\s+(the\s+)?(android|phone|device)\s+assistant\b/i,
  /\b(offne|starte)\s+(den\s+)?(android|telefon|gerate)[ -]?assistent/i,
  /\b(ouvre|lance)\s+(l[' ]?)?assistant\s+(android|du telephone)/i,
  /\b(apri|avvia)\s+l[' ]assistente\s+(android|del telefono)/i,
  /\b(abrir|abre)\s+(el\s+)?asistente\s+(android|del telefono)/i,
];

export function detectAndroidAssistantCommand(text: string) {
  return commandPatterns.some((pattern) => pattern.test(text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')));
}

export async function handleSpokenAndroidAssistantCommand(text: string, language: BasicLanguageCode, status: HTMLElement) {
  if (!detectAndroidAssistantCommand(text) || !isAndroidAssistantAvailable()) return false;
  const resolution: AndroidActionResolution = {
    contractVersion:'android-action-resolution.v1',status:'RESOLVED',action:'ASSISTANT',reason:'SPOKEN_ASSISTANT_REQUEST',
    source:'GENERAL_HANDOFF',confirmation:confirmationFor('ASSISTANT'),payload:{contextText:text},
  };
  const receipt = await executeAndroidAction(text, resolution);
  const result = receiptToHandoff(receipt);
  status.textContent = resultMessage(result, language);
  if (result.status === 'OPENED') window.dispatchEvent(new CustomEvent('agm-android-assistant-handoff'));
  return true;
}

export function bindDeviceAssistantHandoff(root: HTMLElement, language: BasicLanguageCode) {
  const panel = root.querySelector<HTMLElement>('[data-device-assistant-handoff]');
  if (!panel) return () => undefined;
  if (!isAndroidAssistantAvailable()) { panel.hidden = true; return () => undefined; }
  panel.hidden = false;
  const copy = deviceAssistantCopy[language];
  const status = panel.querySelector<HTMLElement>('[data-device-handoff-status]')!;
  const action = panel.querySelector<HTMLSelectElement>('[data-device-handoff-action]')!;
  const value = panel.querySelector<HTMLInputElement>('[data-device-handoff-value]')!;
  const time = panel.querySelector<HTMLInputElement>('[data-device-handoff-time]')!;
  const transcript = root.querySelector<HTMLTextAreaElement>('[data-assistant-transcript]');
  const listeners: Array<[Element, string, EventListener]> = [];
  const on = (element: Element | null, event: string, listener: EventListener) => {
    if (!element) return; element.addEventListener(event, listener); listeners.push([element, event, listener]);
  };
  const show = (result: DeviceHandoffResult) => {
    status.textContent = resultMessage(result, language);
    if (result.status === 'OPENED') window.dispatchEvent(new CustomEvent('agm-android-assistant-handoff'));
  };
  const run = (task: Promise<DeviceHandoffResult>) => void task.then(show).catch(() => show({ status: 'UNAVAILABLE', reason: 'ANDROID_BRIDGE_ERROR' }));
  const execute = (text: string, resolution: AndroidActionResolution, agmConfirmed = false) => run(
    executeAndroidAction(text, resolution, { agmConfirmed }).then(receiptToHandoff),
  );
  const observePermissionProtocol = () => void getAndroidActionProtocolStatus().then((snapshot) => {
    if (!snapshot) return;
    const targets = Object.entries(snapshot.targets).map(([name, available]) => `${name}=${available}`).join(',');
    void evaluatePermissionRequest({
      phase:'OBSERVATION',requestedCapability:'ANDROID_PERMISSION_PROTOCOL',requestedPermissionOrScope:'NOT_REQUIRED',requestor:'agm.android-action-protocol',
      reason:'Record physical Android permission and target snapshot',risk:'LOW',currentAuthority:'NOT_REQUIRED',
      evidence:`permission-snapshot:microphone=${snapshot.runtimePermissions.microphone}:camera=${snapshot.runtimePermissions.camera}:targets=${targets}`,
    });
  }).catch(() => undefined);
  observePermissionProtocol();
  window.addEventListener('agm-native-resume', observePermissionProtocol);
  on(panel.querySelector('[data-device-assistant-open]'), 'click', () => execute('Open Android assistant', {
    contractVersion:'android-action-resolution.v1',status:'RESOLVED',action:'ASSISTANT',reason:'EXPLICIT_UI_REQUEST',source:'GENERAL_HANDOFF',confirmation:confirmationFor('ASSISTANT'),
  }));
  on(panel.querySelector('[data-device-assistant-context]'), 'click', () => {
    const contextText = transcript?.value.trim() ?? '';
    if (!contextText) { status.textContent = copy.valueRequired; return; }
    execute(contextText, { contractVersion:'android-action-resolution.v1',status:'RESOLVED',action:'ASSISTANT',reason:'EXPLICIT_CONTEXT_HANDOFF',source:'REQUEST',confirmation:confirmationFor('ASSISTANT'),payload:{contextText} });
  });
  on(panel.querySelector('[data-device-assistant-settings]'), 'click', () => execute('Open Android assistant settings', {
    contractVersion:'android-action-resolution.v1',status:'RESOLVED',action:'SETTINGS',reason:'EXPLICIT_UI_REQUEST',source:'REQUEST',confirmation:confirmationFor('SETTINGS'),
  }));
  on(action, 'change', () => { time.hidden = action.value !== 'ALARM'; });
  on(panel.querySelector('[data-device-handoff-execute]'), 'click', () => {
    const selected = action.value as DeviceHandoffAction;
    const input = value.value.trim();
    if (!input) { status.textContent = copy.valueRequired; return; }
    const [hour, minute] = time.value.split(':').map(Number);
    const androidAction = selected as AndroidActionKind;
    const contextText = androidAction === 'SHARE' || androidAction === 'EMAIL_DRAFT' ? transcript?.value.trim() || input : undefined;
    execute(input, {
      contractVersion:'android-action-resolution.v1',status:'RESOLVED',action:androidAction,reason:'EXPLICIT_UI_REQUEST',source:'REQUEST',confirmation:confirmationFor(androidAction),
      payload:{value:input,contextText,mimeType:androidAction==='SHARE'?'text/plain':undefined,hour,minute},
    }, true);
  });
  return () => { listeners.forEach(([element, event, listener]) => element.removeEventListener(event, listener)); window.removeEventListener('agm-native-resume', observePermissionProtocol); };
}

function receiptToHandoff(receipt: Awaited<ReturnType<typeof executeAndroidAction>>): DeviceHandoffResult {
  return {
    status: receipt.result === 'OPENED' ? 'OPENED' : receipt.result === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'UNAVAILABLE',
    reason: receipt.fallback ?? undefined, target: receipt.target ?? undefined,
    guardianEvidenceId: receipt.guardianEvidenceId, guardianCorrelationId: receipt.guardianCorrelationId,
  };
}

function resultMessage(result: DeviceHandoffResult, language: BasicLanguageCode) {
  const copy = deviceAssistantCopy[language];
  if (result.status === 'OPENED') return copy.opened;
  if (result.status === 'UNSUPPORTED') return copy.unsupported;
  if (result.status === 'INVALID_INPUT') return copy.invalid;
  return copy.unavailable;
}
