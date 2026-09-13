import type { BasicLanguageCode } from '../language-registry';
import {
  isAndroidAssistantAvailable, launchAndroidAssistant, openAndroidAssistantSettings,
  performAndroidDeviceHandoff, type DeviceHandoffAction, type DeviceHandoffResult,
} from './android-assistant.gateway';
import { deviceAssistantCopy } from './device-assistant-handoff.i18n';

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
  const result = await launchAndroidAssistant({ moduleId: 'premium-voice-spoken-handoff', draft: text })
    .catch((): DeviceHandoffResult => ({ status: 'UNAVAILABLE', reason: 'ANDROID_BRIDGE_ERROR' }));
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
  on(panel.querySelector('[data-device-assistant-open]'), 'click', () => run(launchAndroidAssistant({ moduleId: 'premium-device-assistant' })));
  on(panel.querySelector('[data-device-assistant-context]'), 'click', () => {
    const contextText = transcript?.value.trim() ?? '';
    if (!contextText) { status.textContent = copy.valueRequired; return; }
    run(launchAndroidAssistant({ moduleId: 'premium-device-assistant-context', sensitivity: 'USER_TEXT', draftSelector: '[data-assistant-transcript]', draft: contextText, contextText }));
  });
  on(panel.querySelector('[data-device-assistant-settings]'), 'click', () => run(openAndroidAssistantSettings()));
  on(action, 'change', () => { time.hidden = action.value !== 'ALARM'; });
  on(panel.querySelector('[data-device-handoff-execute]'), 'click', () => {
    const selected = action.value as DeviceHandoffAction;
    const input = value.value.trim();
    if (!input) { status.textContent = copy.valueRequired; return; }
    const [hour, minute] = time.value.split(':').map(Number);
    run(performAndroidDeviceHandoff({ action: selected, value: input, hour, minute }, {
      moduleId: `premium-device-${selected.toLowerCase()}`, draftSelector: '[data-device-handoff-value]', sensitivity: 'PUBLIC',
    }));
  });
  return () => listeners.forEach(([element, event, listener]) => element.removeEventListener(event, listener));
}

function resultMessage(result: DeviceHandoffResult, language: BasicLanguageCode) {
  const copy = deviceAssistantCopy[language];
  if (result.status === 'OPENED') return copy.opened;
  if (result.status === 'UNSUPPORTED') return copy.unsupported;
  if (result.status === 'INVALID_INPUT') return copy.invalid;
  return copy.unavailable;
}
