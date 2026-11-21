import type { BasicLanguageCode } from '../language-registry';
import { launchAndroidAssistant } from './android-assistant.gateway';
import { androidAssistantText } from '../premium-copilot/copilot.i18n';

const copy: Record<BasicLanguageCode, readonly [string, string, string, string]> = {
  ro: ['Pregătește pentru asistentul telefonului', 'Cererea și planul pentru telefon', 'Revizuiește textul (maximum 2000 de caractere). Asistentul telefonului va primi acest text; acțiunile nu sunt încă executate.', 'Anulează'],
  de: ['Für den Telefonassistenten vorbereiten', 'Anfrage und Plan für das Telefon', 'Prüfe den Text (maximal 2000 Zeichen). Der Telefonassistent erhält diesen Text; die Aktionen wurden noch nicht ausgeführt.', 'Abbrechen'],
  en: ['Prepare for the phone assistant', 'Request and plan for the phone', 'Review the text (up to 2000 characters). The phone assistant receives this text; actions have not been executed.', 'Cancel'],
  fr: ['Préparer pour l’assistant du téléphone', 'Demande et plan pour le téléphone', 'Vérifiez le texte (2000 caractères maximum). L’assistant recevra ce texte ; aucune action n’a encore été exécutée.', 'Annuler'],
  nl: ['Voorbereiden voor de telefoonassistent', 'Verzoek en plan voor de telefoon', 'Controleer de tekst (maximaal 2000 tekens). De telefoonassistent ontvangt deze tekst; acties zijn nog niet uitgevoerd.', 'Annuleren'],
  ru: ['Подготовить для ассистента телефона', 'Запрос и план для телефона', 'Проверьте текст (до 2000 символов). Ассистент телефона получит этот текст; действия ещё не выполнены.', 'Отмена'],
  pl: ['Przygotuj dla asystenta telefonu', 'Prośba i plan dla telefonu', 'Sprawdź tekst (maksymalnie 2000 znaków). Asystent telefonu otrzyma ten tekst; działania nie zostały jeszcze wykonane.', 'Anuluj'],
  tr: ['Telefon asistanı için hazırla', 'Telefon için istek ve plan', 'Metni inceleyin (en fazla 2000 karakter). Telefon asistanı bu metni alır; işlemler henüz gerçekleştirilmedi.', 'İptal'],
  sq: ['Përgatit për asistentin e telefonit', 'Kërkesa dhe plani për telefonin', 'Kontrollo tekstin (deri në 2000 karaktere). Asistenti merr këtë tekst; veprimet ende nuk janë kryer.', 'Anulo'],
  it: ['Prepara per l’assistente del telefono', 'Richiesta e piano per il telefono', 'Controlla il testo (massimo 2000 caratteri). L’assistente riceverà questo testo; le azioni non sono ancora state eseguite.', 'Annulla'],
  es: ['Preparar para el asistente del teléfono', 'Solicitud y plan para el teléfono', 'Revisa el texto (máximo 2000 caracteres). El asistente recibirá este texto; las acciones aún no se han ejecutado.', 'Cancelar'],
  sv: ['Förbered för telefonassistenten', 'Begäran och plan för telefonen', 'Granska texten (högst 2000 tecken). Telefonassistenten får denna text; åtgärder har ännu inte utförts.', 'Avbryt'],
};

export function phonePlanText(request: string, answer: string, answerFor: string) {
  const current = request.trim();
  return current && answerFor === current && answer.trim() ? `${current}\n\n${answer.trim()}` : current;
}

export function canTransferPhonePlan(text: string) {
  return text.trim().length > 0 && text.length <= 2000
    && !/\bsk-[a-zA-Z0-9_-]{16,}|\bBearer\s+[a-zA-Z0-9._-]{16,}|-----BEGIN .*PRIVATE KEY-----/i.test(text);
}

/** Review-only until the user explicitly opens the external assistant. No secret custody. */
export function bindPhonePlanHandoff(root: HTMLElement, language: BasicLanguageCode, tools: Element, openAssistant = launchAndroidAssistant) {
  const [label, title, help, cancelLabel] = copy[language];
  const transcript = root.querySelector<HTMLTextAreaElement>('[data-assistant-transcript]')!;
  const answer = root.querySelector<HTMLElement>('[data-assistant-response]')!;
  const status = root.querySelector<HTMLElement>('[data-assistant-status]')!;
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.phonePlanPrepare = ''; button.textContent = label;
  tools.append(button);
  const panel = document.createElement('section');
  panel.className = 'copilot-action-preview'; panel.dataset.phonePlanPreview = ''; panel.hidden = true;
  const heading = document.createElement('h2'); heading.textContent = title;
  const description = document.createElement('p'); description.textContent = help;
  const editor = document.createElement('textarea'); editor.dataset.phonePlanText = ''; editor.setAttribute('aria-label', title); editor.maxLength = 2000;
  const actions = document.createElement('div');
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = cancelLabel;
  const confirm = document.createElement('button'); confirm.type = 'button'; confirm.dataset.phonePlanConfirm = ''; confirm.textContent = androidAssistantText(language, 'openAssistant');
  actions.append(cancel, confirm); panel.append(heading, description, editor, actions);
  root.querySelector('main')!.append(panel);
  let sourceRequest = ''; let sending = false; let cancelled = false;
  const valid = () => !sending && !cancelled && transcript.value.trim() === sourceRequest && canTransferPhonePlan(editor.value);
  const refresh = () => { confirm.disabled = !valid(); };
  button.addEventListener('click', () => {
    if (sending) return;
    sourceRequest = transcript.value.trim();
    if (!sourceRequest) { status.textContent = androidAssistantText(language, 'textRequired'); return; }
    cancelled = false;
    editor.value = phonePlanText(sourceRequest, answer.textContent ?? '', answer.dataset.answerFor ?? '');
    panel.hidden = false; refresh(); panel.scrollIntoView({block:'center'}); editor.focus();
  });
  transcript.addEventListener('input', () => { cancelled = true; panel.hidden = true; refresh(); });
  editor.addEventListener('input', refresh);
  cancel.addEventListener('click', () => { cancelled = true; panel.hidden = true; refresh(); });
  confirm.addEventListener('click', async () => {
    if (!valid()) { refresh(); return; }
    const text = editor.value.trim(); sending = true; refresh();
    window.dispatchEvent(new CustomEvent('agm-android-assistant-handoff'));
    try {
      const result = await openAssistant({moduleId:'premium-copilot',sensitivity:'USER_TEXT',draftSelector:'[data-assistant-transcript]',draft:sourceRequest,contextText:text,
        stillAuthorized:()=>!cancelled && root.isConnected && transcript.value.trim()===sourceRequest && editor.value.trim()===text});
      status.textContent = androidAssistantText(language, result.status === 'OPENED' ? 'assistantOpened' : 'assistantUnavailable');
      panel.dataset.handoffResult = result.status; // OPENED is never a task-completion receipt.
      if (result.status === 'OPENED') { cancelled = true; panel.hidden = true; }
    } catch { status.textContent = androidAssistantText(language, 'actionFailed'); }
    finally { sending = false; refresh(); }
  });
}
