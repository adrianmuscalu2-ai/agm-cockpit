import { Capacitor, registerPlugin } from '@capacitor/core';
import { evaluatePermissionRequest } from '../android-action-layer/permission-guardian.client';

type WakeStatus = { state: string; armed: boolean; selectedAssistant: boolean; failure: string; detections: number; assistantName?: string };
const wake = registerPlugin<{ status(): Promise<WakeStatus>; prepare(): Promise<{ microphone: string }>; arm(): Promise<void>; stop(): Promise<void>; pause(): Promise<void>; resume(): Promise<void> }>('AgmWake');

/** Native capability, available only when the Android wake plugin is packaged. */
export function bindLocalWakeControls(root: HTMLElement, language: string) {
  if (!Capacitor.isPluginAvailable('AgmWake')) return () => undefined;
  const ro = language === 'ro';
  const section = document.createElement('section');
  section.className = 'premium-module';
  section.dataset.localWake = '';
  section.innerHTML = `<div class="premium-module-content"><h2>${ro ? 'Activare vocală: Hei, AGMA' : 'Voice activation: Hey, AGMA'}</h2>
    <p>${ro ? 'Activare experimentală: detectare locală, fără trimiterea sunetului. Activează pentru o sesiune de maximum o oră. Android afișează o notificare cu buton de oprire. După repornirea telefonului, reactivează manual.' : 'Experimental activation: local detection with no audio upload. Enable for a session of up to one hour. Android shows a notification with a stop button. Enable again manually after restarting the phone.'}</p>
    <button type="button" data-wake-arm>${ro ? 'Activează Hei, AGMA' : 'Enable Hey, AGMA'}</button>
    <button type="button" data-wake-stop>${ro ? 'Oprește activarea vocală' : 'Stop voice activation'}</button>
    <p role="status" aria-live="polite" data-wake-status></p></div>`;
  root.append(section);
  const status = section.querySelector<HTMLElement>('[data-wake-status]')!;
  let disposed = false;
  let busy = false;
  let idleSince = 0;
  const idle = () => root.querySelector('[data-assistant-start]')?.getAttribute('aria-pressed') !== 'true' && !root.dataset.activeVoiceTurn && !root.querySelector('[data-active-voice-turn]');
  const refresh = async () => {
    if (disposed || busy) return;
    busy = true;
    try {
      const value = await wake.status();
      if (disposed) return;
      status.textContent = !value.selectedAssistant
        ? (ro ? `Selectează ${value.assistantName ?? 'AGMa'} în Setări asistent pentru activare din fundal.` : `Select ${value.assistantName ?? 'AGMa'} in Assistant settings for background activation.`)
        : `${value.state}${value.failure ? ` · ${value.failure}` : ''} · ${ro ? 'Activări' : 'Detections'}: ${value.detections}`;
      if (value.armed && value.state === 'PAUSED' && idle() && document.visibilityState === 'visible') {
        if (!idleSince) idleSince = Date.now();
        if (Date.now() - idleSince >= 2500) { await wake.resume(); idleSince = 0; }
      } else idleSince = 0;
    } catch { if (!disposed) status.textContent = ro ? 'Detectorul local nu este disponibil.' : 'Local detector unavailable.'; }
    finally { busy = false; }
  };
  section.querySelector('[data-wake-arm]')!.addEventListener('click', () => void (async () => {
    if (!idle()) { status.textContent = ro ? 'Oprește conversația înainte de activare.' : 'Stop the conversation before enabling wake.'; return; }
    const approval = await evaluatePermissionRequest({ phase:'REQUEST', requestedCapability:'MICROPHONE_STT', requestedPermissionOrScope:'android.permission.RECORD_AUDIO', requestor:'agm.local-wake', reason:'User enables local-only keyword detector with a visible foreground notification', risk:'MEDIUM', currentAuthority:'NOT_PROVEN', evidence:'explicit-local-wake-button' });
    if (!approval?.authorityGranted) { status.textContent = approval?.reasonCode ?? 'GUARDIAN_NOT_PROVEN'; return; }
    try {
      const prepared = await wake.prepare();
      const execution = await evaluatePermissionRequest({ phase:'EXECUTION', requestedCapability:'MICROPHONE_STT', requestedPermissionOrScope:'android.permission.RECORD_AUDIO', requestor:'agm.local-wake', reason:'Arm local keyword detector after Android permissions', risk:'MEDIUM', currentAuthority:prepared.microphone === 'granted' ? 'AUTHORIZED' : 'NOT_PROVEN', evidence:`local-wake-permission:${prepared.microphone}` });
      if (!execution?.authorityGranted) { status.textContent = execution?.reasonCode ?? 'GUARDIAN_NOT_PROVEN'; return; }
      await wake.arm(); await refresh();
    }
    catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
  })());
  section.querySelector('[data-wake-stop]')!.addEventListener('click', () => void wake.stop().then(refresh));
  const timer = window.setInterval(() => void refresh(), 1000);
  void refresh();
  return () => { disposed = true; window.clearInterval(timer); section.remove(); };
}
