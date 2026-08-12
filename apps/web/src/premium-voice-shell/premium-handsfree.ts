import type { BasicLanguageCode } from '../language-registry';

export type VoiceDecision = 'confirm' | 'cancel' | 'unknown';

const confirmWords: Record<BasicLanguageCode, string[]> = {
  ro: ['da', 'confirm', 'confirmă', 'trimite'],
  de: ['ja', 'bestätigen', 'bestätige', 'senden'],
  en: ['yes', 'confirm', 'send'],
  fr: ['oui', 'confirmer', 'confirme', 'envoyer'],
  nl: ['ja', 'bevestig', 'bevestigen', 'versturen'],
  ru: ['да', 'подтвердить', 'подтверждаю', 'отправить'],
  pl: ['tak', 'potwierdź', 'potwierdzam', 'wyślij'],
  tr: ['evet', 'onayla', 'onaylıyorum', 'gönder'],
  sq: ['po', 'konfirmo', 'konfirmoj', 'dërgo'],
};

const cancelWords: Record<BasicLanguageCode, string[]> = {
  ro: ['nu', 'anulează', 'anulare', 'oprește'],
  de: ['nein', 'abbrechen', 'stopp'],
  en: ['no', 'cancel', 'stop'],
  fr: ['non', 'annuler', 'arrête'],
  nl: ['nee', 'annuleren', 'stop'],
  ru: ['нет', 'отмена', 'отменить', 'стоп'],
  pl: ['nie', 'anuluj', 'stop'],
  tr: ['hayır', 'iptal', 'dur'],
  sq: ['jo', 'anulo', 'ndalo'],
};

export const handsfreeText: Record<BasicLanguageCode, { review: (text: string) => string; retry: string; standby: string }> = {
  ro: { review: text => `Am înțeles: ${text}. Spune da pentru confirmare sau nu pentru anulare.`, retry: 'Nu am înțeles confirmarea. Spune da sau nu.', standby: 'AGM este pregătit pentru următoarea solicitare.' },
  de: { review: text => `Ich habe verstanden: ${text}. Sagen Sie Ja zum Bestätigen oder Nein zum Abbrechen.`, retry: 'Bestätigung nicht verstanden. Sagen Sie Ja oder Nein.', standby: 'AGM ist für die nächste Anfrage bereit.' },
  en: { review: text => `I understood: ${text}. Say yes to confirm or no to cancel.`, retry: 'I did not understand the confirmation. Say yes or no.', standby: 'AGM is ready for the next request.' },
  fr: { review: text => `J'ai compris : ${text}. Dites oui pour confirmer ou non pour annuler.`, retry: 'Confirmation non comprise. Dites oui ou non.', standby: 'AGM est prêt pour la prochaine demande.' },
  nl: { review: text => `Ik heb begrepen: ${text}. Zeg ja om te bevestigen of nee om te annuleren.`, retry: 'Bevestiging niet begrepen. Zeg ja of nee.', standby: 'AGM is klaar voor de volgende vraag.' },
  ru: { review: text => `Я понял: ${text}. Скажите да для подтверждения или нет для отмены.`, retry: 'Подтверждение не распознано. Скажите да или нет.', standby: 'AGM готов к следующему запросу.' },
  pl: { review: text => `Zrozumiałem: ${text}. Powiedz tak, aby potwierdzić, lub nie, aby anulować.`, retry: 'Nie rozumiem potwierdzenia. Powiedz tak lub nie.', standby: 'AGM jest gotowy na kolejne pytanie.' },
  tr: { review: text => `Şunu anladım: ${text}. Onaylamak için evet, iptal etmek için hayır deyin.`, retry: 'Onay anlaşılamadı. Evet veya hayır deyin.', standby: 'AGM bir sonraki istek için hazır.' },
  sq: { review: text => `Kuptova: ${text}. Thuaj po për konfirmim ose jo për anulim.`, retry: 'Konfirmimi nuk u kuptua. Thuaj po ose jo.', standby: 'AGM është gati për kërkesën tjetër.' },
};

export function parseVoiceDecision(language: BasicLanguageCode, value: string): VoiceDecision {
  const normalized = value.toLocaleLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const matches = (words: string[]) => words.some(word => {
    const candidate = word.toLocaleLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    return normalized === candidate || normalized.startsWith(`${candidate} `);
  });
  if (matches(confirmWords[language])) return 'confirm';
  if (matches(cancelWords[language])) return 'cancel';
  return 'unknown';
}
