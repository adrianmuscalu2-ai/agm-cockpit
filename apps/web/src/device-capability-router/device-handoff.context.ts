import type { DataSensitivity } from './device-capability.types';

const HANDOFF_KEY = 'agm.device-handoff.context.v1';

type DeviceHandoffContext = {
  schemaVersion: 1;
  handoffId: string;
  route: string;
  moduleId: string;
  sensitivity: DataSensitivity;
  scrollX: number;
  scrollY: number;
  draftSelector?: string;
  draft?: string;
  capturedAtEpochMs: number;
};

let installed = false;

export function captureDeviceHandoffContext(options: {
  moduleId: string;
  sensitivity: DataSensitivity;
  draftSelector?: string;
  draft?: string;
}) {
  const context: DeviceHandoffContext = {
    schemaVersion: 1,
    handoffId: crypto.randomUUID(),
    route: `${location.pathname}${location.search}${location.hash}`,
    moduleId: options.moduleId,
    sensitivity: options.sensitivity,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    draftSelector: options.draftSelector,
    draft: options.sensitivity === 'PUBLIC' || options.sensitivity === 'USER_TEXT' ? options.draft : undefined,
    capturedAtEpochMs: Date.now(),
  };
  sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(context));
  return context;
}

export function restoreDeviceHandoffContext() {
  let context: DeviceHandoffContext | undefined;
  try { context = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) ?? 'null') ?? undefined; } catch {}
  if (!context || context.schemaVersion !== 1) return undefined;
  sessionStorage.removeItem(HANDOFF_KEY);
  if (context.route === `${location.pathname}${location.search}${location.hash}`) {
    requestAnimationFrame(() => {
      window.scrollTo(context!.scrollX, context!.scrollY);
      if (context!.draftSelector && context!.draft !== undefined) {
        const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(context!.draftSelector);
        if (field) {
          field.value = context!.draft;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.focus({ preventScroll: true });
        }
      }
      window.dispatchEvent(new CustomEvent('agm-device-handoff-returned', { detail: { handoffId: context!.handoffId, moduleId: context!.moduleId } }));
    });
  }
  return context;
}

export function installDeviceHandoffResumeListener() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('agm-native-resume', () => restoreDeviceHandoffContext());
  window.addEventListener('pageshow', () => restoreDeviceHandoffContext());
}
