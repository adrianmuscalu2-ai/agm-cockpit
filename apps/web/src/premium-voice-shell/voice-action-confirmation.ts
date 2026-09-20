import type { BasicLanguageCode } from '../language-registry';
import type { AndroidActionResolution } from '../android-action-layer/android-action.contract';

export type VoiceConfirmationResult<T> =
  | { status: 'NO_PENDING' }
  | { status: 'CONFIRMED'; pending: T }
  | { status: 'REJECTED'; pending: T }
  | { status: 'REPEAT'; pending: T };

export class VoiceActionConfirmationGate<T> {
  private pending?: T;

  prepare(value: T) {
    this.pending = value;
  }

  hasPending() {
    return this.pending !== undefined;
  }

  clear() {
    this.pending = undefined;
  }

  consume() {
    const value = this.pending;
    this.pending = undefined;
    return value;
  }

  respond(text: string, language: BasicLanguageCode): VoiceConfirmationResult<T> {
    if (this.pending === undefined) return { status: 'NO_PENDING' };
    const decision = classifyVoiceConfirmation(text, language);
    if (decision === 'UNKNOWN') return { status: 'REPEAT', pending: this.pending };
    const pending = this.pending;
    this.pending = undefined;
    return { status: decision === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED', pending };
  }
}

export function classifyVoiceConfirmation(text: string, language: BasicLanguageCode): 'CONFIRM' | 'REJECT' | 'UNKNOWN' {
  const value = normalize(text);
  const confirmations: Record<BasicLanguageCode, RegExp> = {
    ro: /^(?:da|confirm|confirma|sigur|ok|bine|apeleaza|suna|da apeleaza|da suna)$/,
    de: /^(?:ja|bestatigen|bestatige|ok|in ordnung|anrufen)$/,
    en: /^(?:yes|confirm|confirmed|ok|okay|go ahead|call)$/,
    fr: /^(?:oui|confirmer|confirme|ok|d accord|appelle)$/,
    nl: /^(?:ja|bevestig|bevestigen|ok|bel)$/,
    ru: /^(?:da|podtverzhdayu|podtverdit|ok)$/,
    pl: /^(?:tak|potwierdzam|potwierdz|ok|dzwon)$/,
    tr: /^(?:evet|onayliyorum|onayla|tamam|ara)$/,
    sq: /^(?:po|konfirmoj|konfirmo|ok|telefono)$/,
    it: /^(?:si|confermo|conferma|ok|chiama)$/,
    es: /^(?:si|confirmo|confirma|ok|llama)$/,
    sv: /^(?:ja|bekrafta|ok|ring)$/,
  };
  const rejections: Record<BasicLanguageCode, RegExp> = {
    ro: /^(?:nu(?: anuleaza| apela| suna)?|anuleaza|renunta|opreste)$/,
    de: /^(?:nein|abbrechen|stopp|nicht anrufen)$/,
    en: /^(?:no|cancel|stop|do not call|dont call)$/,
    fr: /^(?:non|annuler|arrete|ne pas appeler)$/,
    nl: /^(?:nee|annuleer|stop|niet bellen)$/,
    ru: /^(?:net|otmena|ostanovi)$/,
    pl: /^(?:nie|anuluj|stop|nie dzwon)$/,
    tr: /^(?:hayir|iptal|dur|arama)$/,
    sq: /^(?:jo|anulo|ndalo|mos telefono)$/,
    it: /^(?:no|annulla|ferma|non chiamare)$/,
    es: /^(?:no|cancela|detente|no llames)$/,
    sv: /^(?:nej|avbryt|stopp|ring inte)$/,
  };
  if (rejections[language].test(value)) return 'REJECT';
  if (confirmations[language].test(value)) return 'CONFIRM';
  return 'UNKNOWN';
}

export function voiceActionConfirmationPrompt(resolution: AndroidActionResolution, language: BasicLanguageCode) {
  const name = resolution.payload?.contactName?.trim();
  if (resolution.action === 'DIAL' && name) {
    if (language === 'ro') return `Am găsit ${name}. Vrei să apelez ${name}?`;
    if (language === 'de') return `Ich habe ${name} gefunden. Soll ich den Anruf für ${name} öffnen?`;
    return `I found ${name}. Do you want me to open the call for ${name}?`;
  }
  if (language === 'ro') return 'Acțiunea este pregătită. Spune „Da” pentru confirmare sau „Nu” pentru anulare.';
  if (language === 'de') return 'Die Aktion ist vorbereitet. Sagen Sie „Ja“ zum Bestätigen oder „Nein“ zum Abbrechen.';
  return 'The action is ready. Say “Yes” to confirm or “No” to cancel.';
}

export function voiceActionRepeatPrompt(resolution: AndroidActionResolution, language: BasicLanguageCode) {
  const name = resolution.payload?.contactName?.trim();
  if (language === 'ro') return `Nu am înțeles confirmarea. Spune „Da” pentru ${name ? `a apela ${name}` : 'continuare'} sau „Nu” pentru anulare.`;
  if (language === 'de') return 'Ich habe die Bestätigung nicht verstanden. Sagen Sie „Ja“ oder „Nein“.';
  return 'I did not understand the confirmation. Say “Yes” or “No”.';
}

export function voiceActionExecutionAnnouncement(resolution: AndroidActionResolution, language: BasicLanguageCode) {
  const name = resolution.payload?.contactName?.trim();
  if (resolution.action === 'DIAL') {
    if (language === 'ro') return `Deschid dialerul pentru ${name || 'numărul selectat'}. Apelul nu va fi inițiat automat.`;
    if (language === 'de') return `Ich öffne den Dialer für ${name || 'die ausgewählte Nummer'}. Der Anruf wird nicht automatisch gestartet.`;
    return `Opening the dialer for ${name || 'the selected number'}. The call will not start automatically.`;
  }
  if (language === 'ro') return 'Confirmarea vocală a fost acceptată. Deschid acțiunea.';
  if (language === 'de') return 'Die Sprachbestätigung wurde akzeptiert. Ich öffne die Aktion.';
  return 'Voice confirmation accepted. Opening the action.';
}

export function voiceActionCancelledMessage(language: BasicLanguageCode) {
  if (language === 'ro') return 'Am anulat acțiunea. Nu am deschis nicio aplicație externă.';
  if (language === 'de') return 'Ich habe die Aktion abgebrochen. Es wurde keine externe App geöffnet.';
  return 'I cancelled the action. No external app was opened.';
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ').trim();
}
