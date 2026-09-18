import { routeAndroidAction } from './android-action.router';
import { readDriverContext } from './driver-context';
import type { AndroidActionResolution } from './android-action.contract';

const driverCommands = /\b(citeste l|read it|lies es|navigheaza|navigate|route|navigiere|du[ -]ma|condu[ -]ma|suna|apeleaza|formeaza|dial|call|anrufen|raspunde|reply|antworte|calendar|kalender|distribuie|partajeaza|share|teilen|trimite|scrie|compune|send|write|compose|sende|schreibe|asistent|assistant|assistent)\b|\b(?:deschide|porneste|open|launch|offne|starte)\s+(?:google\s+)?(?:maps|waze|tom\s*tom|gmail|camera|kamera|messenger)\b/i;

export function resolveDriverVoiceCommand(text: string) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!driverCommands.test(normalized)) return { handled: false as const };
  const context = readDriverContext();
  const needsGmailContext = /\b(?:navigheaza|navigate|route|navigiere)\b.*\b(?:ultim(?:ul|a)?\s+(?:e-?mail|mail|mesaj)|latest\s+(?:e-?mail|message)|letzte[nrs]?\s+(?:e-?mail|nachricht))\b/i.test(normalized);
  if (needsGmailContext && !context) return { handled: false as const };
  return { handled: true as const, resolution: routeAndroidAction(text, context) };
}

export function driverActionMessage(result: string, reason: string, language: string, resolution?: AndroidActionResolution) {
  const contactName = resolution?.payload?.contactName?.trim();
  if (result === 'CLARIFICATION_REQUIRED' && (reason === 'AGM_PERSONAL_CONTACT_AMBIGUOUS' || reason === 'QUICK_CONTACT_AMBIGUOUS') && contactName) {
    if (resolution?.action === 'EMAIL_DRAFT') {
      if (language === 'ro') return `Am găsit mai multe persoane cu numele ${contactName}. Căreia vrei să îi pregătesc mesajul Gmail?`;
      if (language === 'de') return `Ich habe mehrere Personen namens ${contactName} gefunden. Für welche soll ich den Gmail-Entwurf vorbereiten?`;
      return `I found multiple people named ${contactName}. Which one should receive the Gmail draft?`;
    }
    if (resolution?.action === 'MESSENGER_CHAT') {
      if (language === 'ro') return `Am găsit mai multe persoane cu numele ${contactName}. Pe care vrei să o deschid în Messenger?`;
      if (language === 'de') return `Ich habe mehrere Personen namens ${contactName} gefunden. Welche soll ich in Messenger öffnen?`;
      return `I found multiple people named ${contactName}. Which one should I open in Messenger?`;
    }
    if (language === 'ro') return `Am găsit mai multe contacte cu numele ${contactName}. Pe care vrei să îl apelezi?`;
    if (language === 'de') return `Ich habe mehrere Kontakte mit dem Namen ${contactName} gefunden. Welchen möchten Sie anrufen?`;
    return `I found multiple contacts named ${contactName}. Which one do you want to call?`;
  }
  if (result === 'CLARIFICATION_REQUIRED' && reason === 'AGM_PERSONAL_CONTACT_CHANNEL_MISSING' && contactName) {
    const channel = resolution?.payload?.requestedChannel === 'EMAIL' ? 'Gmail' : resolution?.payload?.requestedChannel === 'MESSENGER' ? 'Messenger' : 'telefon';
    if (language === 'ro') return `${contactName} nu are un canal ${channel} salvat în Contacte personale AGM.`;
    if (language === 'de') return `${contactName} hat keinen gespeicherten ${channel}-Kanal in den persönlichen AGM-Kontakten.`;
    return `${contactName} does not have a saved ${channel} channel in AGM Personal Contacts.`;
  }
  const values: Record<string, Record<string, string>> = {
    ro: {
      OPENED:'Acțiunea este pregătită în aplicația Android. Verifică și confirmă acolo pasul final.',CONFIRMATION_REQUIRED:'Am pregătit acțiunea. Confirmă înainte de transferul informației.',AUTH_PERMISSION_FAILURE:'AUTH / PERMISSION FAILURE: Guardian nu a demonstrat autoritatea pentru această acțiune.',UNAVAILABLE:'Aplicația Android necesară nu este disponibilă. Nu am executat nicio acțiune.',UNSUPPORTED:'Această acțiune nu este acceptată de Android Action Layer.',CLARIFICATION_REQUIRED:reason === 'CONTACT_AMBIGUOUS' ? 'Am găsit mai multe contacte cu acest nume. Spune numele complet.' : reason === 'CONTACT_NOT_FOUND' ? 'Nu am găsit contactul în agenda telefonului. Spune numele complet sau numărul.' : 'Am nevoie de informația lipsă înainte de a pregăti acțiunea.',
    },
    de: { OPENED:'Die Aktion ist in der Android-App vorbereitet. Prüfen und bestätigen Sie dort den letzten Schritt.',CONFIRMATION_REQUIRED:'Die Aktion ist vorbereitet. Bestätigen Sie die Datenübertragung.',AUTH_PERMISSION_FAILURE:'AUTH / PERMISSION FAILURE: Guardian konnte die Berechtigung für diese Aktion nicht nachweisen.',UNAVAILABLE:'Die erforderliche Android-App ist nicht verfügbar. Es wurde nichts ausgeführt.',UNSUPPORTED:'Diese Aktion wird vom Android Action Layer nicht unterstützt.',CLARIFICATION_REQUIRED:'Vor der Vorbereitung der Aktion fehlt eine Information.' },
    en: { OPENED:'The action is prepared in the Android app. Review and confirm the final step there.',CONFIRMATION_REQUIRED:'The action is ready. Confirm before the information is transferred.',AUTH_PERMISSION_FAILURE:'AUTH / PERMISSION FAILURE: Guardian did not prove authority for this action.',UNAVAILABLE:'The required Android app is unavailable. No action was performed.',UNSUPPORTED:'Android Action Layer does not support this action.',CLARIFICATION_REQUIRED:reason === 'CONTACT_AMBIGUOUS' ? 'I found multiple contacts with that name. Say the full name.' : reason === 'CONTACT_NOT_FOUND' ? 'I could not find that contact. Say the full name or phone number.' : 'I need the missing information before preparing the action.' },
  };
  return (values[language] ?? values.en!)[result] ?? (values[language] ?? values.en!).UNAVAILABLE ?? reason;
}

export function driverDialConfirmationSummary(resolution: AndroidActionResolution, language: string) {
  if (resolution.action !== 'DIAL') return driverActionMessage('CONFIRMATION_REQUIRED', 'AGM_CONFIRMATION_REQUIRED', language, resolution);
  const name = resolution.payload?.contactName?.trim() || (language === 'ro' ? 'Număr introdus' : language === 'de' ? 'Eingegebene Nummer' : 'Entered number');
  const number = resolution.payload?.value?.trim() || '—';
  const source = resolution.payload?.contactSource === 'AGM_PERSONAL_CONTACTS'
    ? (language === 'ro' ? 'Contacte personale AGM' : language === 'de' ? 'Persönliche AGM-Kontakte' : 'AGM Personal Contacts')
    : resolution.payload?.contactSource === 'ANDROID_CONTACTS'
      ? (language === 'ro' ? 'Agenda Android' : language === 'de' ? 'Android-Kontakte' : 'Android Contacts')
      : (language === 'ro' ? 'Comandă utilizator' : language === 'de' ? 'Benutzerbefehl' : 'User command');
  if (language === 'ro') return `Contact selectat: ${name}\nNumăr: ${number}\nSursă: ${source}\nConfirmă pentru a deschide dialerul Android. Apelul nu va fi inițiat automat.`;
  if (language === 'de') return `Ausgewählter Kontakt: ${name}\nNummer: ${number}\nQuelle: ${source}\nBestätigen Sie, um den Android-Dialer zu öffnen. Der Anruf wird nicht automatisch gestartet.`;
  return `Selected contact: ${name}\nNumber: ${number}\nSource: ${source}\nConfirm to open the Android dialer. The call will not start automatically.`;
}
