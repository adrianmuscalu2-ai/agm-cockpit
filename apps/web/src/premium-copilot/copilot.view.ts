import type { BasicLanguageCode } from '../language-registry';
import { renderPremiumShell } from '../premium-shell';
import { copilotText as t } from './copilot.i18n';

export function renderCopilot(l: BasicLanguageCode, e: (value: string) => string) {
  return renderPremiumShell({
    viewClass: 'premium-copilot-view',
    labelledBy: 'copilot-title',
    brandHref: '/',
    brandModule: 'home',
    brandAriaLabel: e(t(l, 'back')),
    navigation: `<a href="/" data-module="home" class="premium-back">${e(t(l, 'back'))}</a>`,
    content: `<main data-premium-copilot data-language="${l}">
      <header class="copilot-intro"><small>AGM PREMIUM</small><h1 id="copilot-title">${e(t(l, 'title'))}</h1><p>${e(t(l, 'subtitle'))}</p></header>
      <section class="copilot-core">
        <h2>${e(t(l, 'prompt'))}</h2>
        <button class="copilot-mic" type="button" data-assistant-start aria-pressed="false"><span>ASCULTARE ON</span><span class="copilot-mic-icon" aria-hidden="true">&#127908;</span></button>
        <button type="button" data-assistant-stop hidden>${e(t(l, 'cancel'))}</button>
        <div class="copilot-tools"><button type="button" data-copilot-camera>📷 ${e(t(l, 'camera'))}</button><button type="button" data-copilot-text>⌨ ${e(t(l, 'keyboard'))}</button><button type="button" data-assistant-replay>🔊 ${e(t(l, 'speaker'))}</button><button type="button" data-copilot-alert>🔔 Alertă</button><button type="button" data-copilot-whatsapp>WhatsApp</button><button type="button" data-copilot-email>Email</button></div>
        <p role="status" data-assistant-status>${e(t(l, 'textHint'))}</p>
        <button type="button" data-assistant-open-settings hidden>⚙ Settings</button>
        <div class="copilot-transcript"><label><strong>${e(t(l, 'transcript'))}</strong><textarea data-assistant-transcript maxlength="2000" rows="4" placeholder="${e(t(l, 'textHint'))}"></textarea></label><div><button type="button" data-assistant-cancel>${e(t(l, 'cancel'))}</button><button type="button" data-assistant-retry hidden>↻ Retry</button><button type="button" data-copilot-route>${e(t(l, 'confirm'))}</button></div></div>
      </section>
      <section class="copilot-active" data-copilot-active hidden><h2>${e(t(l, 'interpreted'))}</h2><p data-copilot-intent></p><div data-copilot-safety hidden><strong>${e(t(l, 'safeQuestion'))}</strong><button data-safe="true">${e(t(l, 'safeYes'))}</button><button data-safe="false">${e(t(l, 'safeNo'))}</button><p role="alert" data-copilot-safe-stop hidden>${e(t(l, 'safeStop'))}</p></div><button data-assistant-confirm hidden>${e(t(l, 'confirm'))}</button></section>
      <section class="copilot-action-preview" data-capability-preview hidden><h2 data-capability-title></h2><p data-capability-summary></p><div><button type="button" data-capability-cancel></button><button type="button" data-capability-confirm></button></div><p role="status" data-capability-receipt></p></section>
      <section class="premium-module" data-assistant-response-panel hidden><div class="premium-module-content"><h2>AGM</h2><p data-assistant-response aria-live="polite"></p><small data-assistant-latency hidden></small><button type="button" data-assistant-stop-playback>${e(t(l, 'cancel'))}</button></div></section>
      <section data-assistant-history-panel hidden><ol data-assistant-history></ol></section>
      <details class="copilot-diagnostics"><summary>${e(t(l, 'diagnostics'))}</summary><p data-copilot-diagnostic></p></details>
    </main>`,
    footer: `<span>${e(t(l, 'title'))} · Voice Wave 1</span>`,
  });
}
