import type { BasicLanguageCode } from '../language-registry';
import { renderPremiumShell } from '../premium-shell';
import { premiumAssistantUiMessages } from './premium-assistant-ui.i18n';
import { premiumConversationMessages } from './premium-conversation.i18n';

export function renderPremiumAssistantView(language: BasicLanguageCode, escapeHtml: (value:string)=>string) {
  const m = premiumAssistantUiMessages[language];
  return renderPremiumShell({
    viewClass:'premium-assistant-view', labelledBy:'premium-assistant-title', brandHref:'/premium', brandModule:'premium', brandAriaLabel:escapeHtml(m.back),
    navigation:`<a href="/premium" data-module="premium" class="premium-back">${escapeHtml(m.back)}</a>`,
    content:`<main data-premium-assistant data-language="${language}">
      <div class="premium-intro"><span>AGM PREMIUM</span><h1 id="premium-assistant-title">${escapeHtml(m.title)}</h1><p>${escapeHtml(m.description)}</p></div>
      <section class="premium-module premium-assistant-panel">
        <div class="premium-module-content">
          <div class="premium-assistant-controls">
            <button type="button" data-assistant-start><span>${escapeHtml(m.start)}</span></button>
            <button type="button" data-assistant-stop hidden>${escapeHtml(m.stop)}</button>
          </div>
          <p role="status" data-assistant-status>${escapeHtml(m.textFallback)}</p>
          <button type="button" data-assistant-open-settings hidden>⚙ Settings</button>
          <label><strong>${escapeHtml(m.transcript)}</strong><textarea data-assistant-transcript maxlength="2000" rows="5" placeholder="${escapeHtml(m.textFallback)}"></textarea></label>
          <small>${escapeHtml(m.transcriptHint)}</small>
          <div class="premium-assistant-controls">
            <button type="button" data-assistant-confirm>${escapeHtml(m.confirm)}</button>
            <button type="button" data-assistant-retry hidden>↻ Retry</button>
            <button type="button" data-assistant-cancel>${escapeHtml(m.cancel)}</button>
          </div>
        </div>
      </section>
      <section class="premium-module" data-assistant-response-panel hidden>
        <div class="premium-module-content"><h2>${escapeHtml(m.answer)}</h2><p data-assistant-response aria-live="polite"></p><small data-assistant-latency hidden></small>
          <div class="premium-assistant-controls"><button type="button" data-assistant-replay>${escapeHtml(m.replay)}</button><button type="button" data-assistant-stop-playback>${escapeHtml(m.stopPlayback)}</button></div>
        </div>
      </section>
      <section class="premium-module" data-assistant-action-panel hidden>
        <div class="premium-module-content"><p data-assistant-action-summary aria-live="polite"></p>
          <div class="premium-assistant-controls"><button type="button" data-assistant-action-confirm>${escapeHtml(premiumConversationMessages[language].confirmAction)}</button><button type="button" data-assistant-action-reject>${escapeHtml(premiumConversationMessages[language].rejectAction)}</button></div>
        </div>
      </section>
      <section class="premium-module" data-assistant-history-panel hidden>
        <div class="premium-module-content"><h2>${escapeHtml(m.title)}</h2><ol data-assistant-history aria-live="polite"></ol></div>
      </section>
    </main>`,
    footer:`<span>AGM Premium · ${escapeHtml(m.title)}</span>`,
  });
}
