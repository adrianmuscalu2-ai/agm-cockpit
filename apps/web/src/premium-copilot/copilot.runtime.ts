import { PREMIUM_COPILOT_STATE, routeCopilotIntent, type CopilotDecision } from './copilot.contract';
import { copilotText as t } from './copilot.i18n';
import type { BasicLanguageCode } from '../language-registry';

type State = {
  schemaVersion: 1;
  confirmedText: string;
  decision: CopilotDecision;
  safetyConfirmed?: boolean;
  updatedAt: string;
};

export function bindCopilotRuntime() {
  const root = document.querySelector<HTMLElement>('[data-premium-copilot]');
  if (!root) return;
  const l = root.dataset.language as BasicLanguageCode;
  const transcript = root.querySelector<HTMLTextAreaElement>('[data-assistant-transcript]')!;
  const active = root.querySelector<HTMLElement>('[data-copilot-active]')!;
  const intent = root.querySelector<HTMLElement>('[data-copilot-intent]')!;
  const safety = root.querySelector<HTMLElement>('[data-copilot-safety]')!;
  const safeStop = root.querySelector<HTMLElement>('[data-copilot-safe-stop]')!;
  const ask = root.querySelector<HTMLButtonElement>('[data-assistant-confirm]')!;
  const diagnostic = root.querySelector<HTMLElement>('[data-copilot-diagnostic]')!;

  const save = (state: State) => {
    localStorage.setItem(PREMIUM_COPILOT_STATE, JSON.stringify(state));
    diagnostic.textContent = `${state.decision.intent} · ${state.decision.capabilityId ?? 'clarification'} · ${state.updatedAt}`;
  };
  const render = (state: State) => {
    transcript.value = state.confirmedText;
    active.hidden = false;
    intent.textContent = state.decision.requiresClarification
      ? t(l, 'clarify')
      : `${state.decision.intent} · ${state.decision.capabilityId}`;
    safety.hidden = !state.decision.safetyGate;
    const unsafe = state.decision.safetyGate && state.safetyConfirmed === false;
    safeStop.hidden = !unsafe;
    transcript.disabled = unsafe;
    ask.hidden = state.decision.requiresClarification || (state.decision.safetyGate && state.safetyConfirmed !== true);
    if (state.decision.capabilityId && !['conversation', 'safety-guidance'].includes(state.decision.capabilityId)) {
      root.querySelector<HTMLElement>('[data-assistant-status]')!.textContent = t(l, 'notActive');
    }
  };

  root.querySelector('[data-copilot-route]')?.addEventListener('click', () => {
    const confirmedText = transcript.value.trim();
    const state: State = {
      schemaVersion: 1,
      confirmedText,
      decision: routeCopilotIntent(confirmedText),
      updatedAt: new Date().toISOString(),
    };
    save(state);
    render(state);
  });
  root.querySelector('[data-safe="false"]')?.addEventListener('click', () => {
    const state = read();
    if (!state) return;
    state.safetyConfirmed = false;
    state.updatedAt = new Date().toISOString();
    save(state);
    render(state);
  });
  root.querySelector('[data-safe="true"]')?.addEventListener('click', () => {
    const state = read();
    if (!state) return;
    state.safetyConfirmed = true;
    state.updatedAt = new Date().toISOString();
    save(state);
    render(state);
  });
  root.querySelector('[data-copilot-text]')?.addEventListener('click', () => transcript.focus());
  root.querySelector('[data-copilot-camera]')?.addEventListener('click', () => {
    root.querySelector<HTMLElement>('[data-assistant-status]')!.textContent = t(l, 'notActive');
  });

  const restored = read();
  if (restored) render(restored);

  function read(): State | undefined {
    try {
      const value = JSON.parse(localStorage.getItem(PREMIUM_COPILOT_STATE) ?? 'null');
      return value?.schemaVersion === 1 ? value : undefined;
    } catch {
      return undefined;
    }
  }
}
