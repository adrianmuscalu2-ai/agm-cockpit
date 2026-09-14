import type { BasicLanguageCode } from '../language-registry';
import { renderPremiumShell } from '../premium-shell';
import { premiumAssistantUiMessages } from './premium-assistant-ui.i18n';
import { premiumConversationMessages } from './premium-conversation.i18n';
import { deviceAssistantCopy } from '../premium-capabilities/device-assistant-handoff.i18n';

export function renderPremiumAssistantView(language: BasicLanguageCode, escapeHtml: (value:string)=>string) {
  const m = premiumAssistantUiMessages[language];
  const d = deviceAssistantCopy[language];
  return renderPremiumShell({
    viewClass:'premium-assistant-view', labelledBy:'premium-assistant-title', brandHref:'/premium', brandModule:'premium', brandAriaLabel:escapeHtml(m.back),
    navigation:`<a href="/premium" data-module="premium" class="premium-back">${escapeHtml(m.back)}</a>`,
    content:`<main data-premium-assistant data-language="${language}">
      <div class="premium-intro"><span>AGM PREMIUM</span><h1 id="premium-assistant-title">${escapeHtml(m.title)}</h1><p>${escapeHtml(m.description)}</p></div>
      <section class="premium-module premium-assistant-panel">
        <div class="premium-module-content">
          <div class="premium-assistant-controls">
            <button class="premium-assistant-mic" type="button" data-assistant-start><span>${escapeHtml(m.start)}</span><span class="premium-assistant-mic-icon" aria-hidden="true">&#127908;</span></button>
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
      <section class="premium-module premium-device-assistant" data-device-assistant-handoff hidden>
        <div class="premium-module-content">
          <span class="premium-device-assistant-kicker">AGM &rarr; Android Assistant</span>
          <h2>${escapeHtml(d.title)}</h2>
          <p>${escapeHtml(d.description)}</p>
          <p><strong>${escapeHtml(d.driverMode)}</strong></p>
          <div class="premium-assistant-controls">
            <button type="button" data-device-assistant-open>${escapeHtml(d.open)}</button>
            <button type="button" data-device-assistant-context>${escapeHtml(d.sendContext)}</button>
            <button type="button" data-device-assistant-settings>${escapeHtml(d.settings)}</button>
          </div>
          <div class="premium-device-handoff-form">
            <label><span>${escapeHtml(d.action)}</span><select data-device-handoff-action>
              <option value="NAVIGATION">${escapeHtml(d.navigation)}</option>
              <option value="DIAL">${escapeHtml(d.dial)}</option>
              <option value="OPEN_APP">${escapeHtml(d.app)}</option>
              <option value="REMINDER">${escapeHtml(d.reminder)}</option>
              <option value="ALARM">${escapeHtml(d.alarm)}</option>
              <option value="CALENDAR">${escapeHtml(d.calendar)}</option>
              <option value="SHARE">${escapeHtml(d.share)}</option>
              <option value="EMAIL_DRAFT">${escapeHtml(d.emailDraft)}</option>
            </select></label>
            <label><span>${escapeHtml(d.value)}</span><input data-device-handoff-value maxlength="500" autocomplete="off"></label>
            <label><span>${escapeHtml(d.time)}</span><input data-device-handoff-time type="time" hidden></label>
            <button type="button" data-device-handoff-execute>${escapeHtml(d.execute)}</button>
          </div>
          <p role="status" aria-live="polite" data-device-handoff-status></p>
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
