import type { BasicLanguageCode } from '../language-registry';

export type DeviceAssistantCopy = {
  title: string; description: string; open: string; sendContext: string; settings: string;
  action: string; value: string; time: string; execute: string;
  navigation: string; dial: string; app: string; reminder: string; alarm: string;
  opened: string; unavailable: string; unsupported: string; invalid: string; valueRequired: string;
};

const en: DeviceAssistantCopy = {
  title: 'DEVICE ASSISTANT / ANDROID HANDOFF',
  description: 'Hand off phone, Maps, apps, reminders and alarms to Android. AGM keeps transport, Gmail, translation and professional context.',
  open: 'Open Android assistant', sendContext: 'Hand off current request', settings: 'Assistant settings',
  action: 'Native phone action', value: 'Address, phone number, app or reminder', time: 'Time', execute: 'Continue in Android',
  navigation: 'Navigate to address', dial: 'Open phone dialer', app: 'Open an app', reminder: 'Create reminder', alarm: 'Set alarm',
  opened: 'Android opened the selected function.', unavailable: 'No compatible Android handler is configured. Choose one in Android settings or use the function manually.',
  unsupported: 'This action is not supported on this device.', invalid: 'Check the value and try again.', valueRequired: 'Enter the address, number, app or reminder first.',
};
const ro: DeviceAssistantCopy = {
  title: 'DEVICE ASSISTANT / ANDROID HANDOFF',
  description: 'Preda telefonul, Maps, aplicatiile, mementourile si alarmele catre Android. AGM pastreaza transportul, Gmail, traducerea si contextul profesional.',
  open: 'Deschide asistentul Android', sendContext: 'Preda cererea curenta', settings: 'Setari asistent',
  action: 'Actiune nativa pe telefon', value: 'Adresa, numar, aplicatie sau memento', time: 'Ora', execute: 'Continua in Android',
  navigation: 'Navigatie catre adresa', dial: 'Deschide apelarea', app: 'Deschide o aplicatie', reminder: 'Creeaza memento', alarm: 'Seteaza alarma',
  opened: 'Android a deschis functia selectata.', unavailable: 'Nu este configurata o aplicatie Android compatibila. Alege una din setarile Android sau foloseste functia manual.',
  unsupported: 'Aceasta actiune nu este suportata pe dispozitiv.', invalid: 'Verifica valoarea si incearca din nou.', valueRequired: 'Introdu mai intai adresa, numarul, aplicatia sau mementoul.',
};
const de: DeviceAssistantCopy = {
  title: 'DEVICE ASSISTANT / ANDROID HANDOFF',
  description: 'Ubergibt Telefon, Maps, Apps, Erinnerungen und Wecker an Android. AGM behalt Transport, Gmail, Ubersetzung und beruflichen Kontext.',
  open: 'Android-Assistent offnen', sendContext: 'Aktuelle Anfrage ubergeben', settings: 'Assistent-Einstellungen',
  action: 'Native Telefonaktion', value: 'Adresse, Rufnummer, App oder Erinnerung', time: 'Uhrzeit', execute: 'In Android fortfahren',
  navigation: 'Zu einer Adresse navigieren', dial: 'Telefonwahl offnen', app: 'App offnen', reminder: 'Erinnerung erstellen', alarm: 'Wecker stellen',
  opened: 'Android hat die ausgewahlte Funktion geoffnet.', unavailable: 'Keine kompatible Android-App ist eingerichtet. Wahlen Sie eine in den Android-Einstellungen oder verwenden Sie die Funktion manuell.',
  unsupported: 'Diese Aktion wird auf dem Gerat nicht unterstutzt.', invalid: 'Prufen Sie die Eingabe und versuchen Sie es erneut.', valueRequired: 'Geben Sie zuerst Adresse, Nummer, App oder Erinnerung ein.',
};

export const deviceAssistantCopy: Record<BasicLanguageCode, DeviceAssistantCopy> = {
  ro, de, en, fr: en, nl: en, ru: en, pl: en, tr: en, sq: en, it: en, es: en, sv: en,
};
