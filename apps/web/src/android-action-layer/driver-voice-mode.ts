import { routeAndroidAction } from './android-action.router';
import { readDriverContext } from './driver-context';

const driverCommands = /\b(citeste l|read it|lies es|navigheaza|navigate|route|navigiere|suna|apeleaza|dial|call|anrufen|raspunde|reply|antworte|calendar|kalender|distribuie|partajeaza|share|teilen|asistent|assistant|assistent)\b|\b(?:deschide|porneste|open|launch|offne|starte)\s+(?:google\s+)?(?:maps|gmail|camera|kamera)\b/i;

export function resolveDriverVoiceCommand(text: string) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!driverCommands.test(normalized)) return { handled: false as const };
  const context = readDriverContext();
  const needsGmailContext = /\b(?:navigheaza|navigate|route|navigiere)\b.*\b(?:ultim(?:ul|a)?\s+(?:e-?mail|mail|mesaj)|latest\s+(?:e-?mail|message)|letzte[nrs]?\s+(?:e-?mail|nachricht))\b/i.test(normalized);
  if (needsGmailContext && !context) return { handled: false as const };
  return { handled: true as const, resolution: routeAndroidAction(text, context) };
}

export function driverActionMessage(result: string, reason: string, language: string) {
  const values: Record<string, Record<string, string>> = {
    ro: {
      OPENED: 'Acțiunea este pregătită în aplicația Android. Verifică și confirmă acolo pasul final.',
      CONFIRMATION_REQUIRED: 'Am pregătit acțiunea. Confirmă înainte de transferul informației.',
      AUTH_PERMISSION_FAILURE: 'AUTH / PERMISSION FAILURE: Guardian nu a demonstrat autoritatea pentru această acțiune.',
      UNAVAILABLE: 'Aplicația Android necesară nu este disponibilă. Nu am executat nicio acțiune.',
      UNSUPPORTED: 'Această acțiune nu este acceptată de Android Action Layer.',
      CLARIFICATION_REQUIRED: 'Am nevoie de informația lipsă înainte de a pregăti acțiunea.',
    },
    de: {
      OPENED: 'Die Aktion ist in der Android-App vorbereitet. Prüfen und bestätigen Sie dort den letzten Schritt.',
      CONFIRMATION_REQUIRED: 'Die Aktion ist vorbereitet. Bestätigen Sie die Datenübertragung.',
      AUTH_PERMISSION_FAILURE: 'AUTH / PERMISSION FAILURE: Guardian konnte die Berechtigung für diese Aktion nicht nachweisen.',
      UNAVAILABLE: 'Die erforderliche Android-App ist nicht verfügbar. Es wurde nichts ausgeführt.',
      UNSUPPORTED: 'Diese Aktion wird vom Android Action Layer nicht unterstützt.',
      CLARIFICATION_REQUIRED: 'Vor der Vorbereitung der Aktion fehlt eine Information.',
    },
    en: {
      OPENED: 'The action is prepared in the Android app. Review and confirm the final step there.',
      CONFIRMATION_REQUIRED: 'The action is ready. Confirm before the information is transferred.',
      AUTH_PERMISSION_FAILURE: 'AUTH / PERMISSION FAILURE: Guardian did not prove authority for this action.',
      UNAVAILABLE: 'The required Android app is unavailable. No action was performed.',
      UNSUPPORTED: 'Android Action Layer does not support this action.',
      CLARIFICATION_REQUIRED: 'I need the missing information before preparing the action.',
    },
  };
  return (values[language] ?? values.en!)[result] ?? (values[language] ?? values.en!).UNAVAILABLE ?? reason;
}
