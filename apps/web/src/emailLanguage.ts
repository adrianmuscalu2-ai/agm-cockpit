export type LanguageCode = 'ro' | 'en' | 'de';

export const supportedLanguages: LanguageCode[] = ['ro', 'de', 'en'];

export const languageLabels: Record<LanguageCode, string> = {
  ro: 'Romana',
  en: 'English',
  de: 'Deutsch',
};

export interface TranslationResult {
  text: string;
  available: boolean;
}

const germanDictionary: Record<string, string> = {
  'ich kontaktiere sie bezueglich des fahrzeugtransports': 'ich Sie bezueglich des Fahrzeugtransports kontaktiere',
  'ich sie bezueglich des fahrzeugtransports kontaktiere': 'ich Sie bezueglich des Fahrzeugtransports kontaktiere',
  'ich bin am standort angekommen': 'ich am Standort angekommen bin',
  'ich am standort angekommen bin': 'ich am Standort angekommen bin',
  'das fahrzeug ist zur abholung bereit': 'das Fahrzeug zur Abholung bereit ist',
  'das fahrzeug zur abholung bereit ist': 'das Fahrzeug zur Abholung bereit ist',
  'sie die dokumente senden': 'Sie die Dokumente senden',
  'sich der transport verspaeten wird': 'sich der Transport verspaeten wird',
  'ich die lieferung des fahrzeugs bestaetige': 'ich die Lieferung des Fahrzeugs bestaetige',
  'va contactez in legatura cu transportul vehiculului': 'ich Sie bezueglich des Fahrzeugtransports kontaktiere',
  'am ajuns la locatie': 'ich am Standort angekommen bin',
  'vehiculul este pregatit pentru preluare': 'das Fahrzeug zur Abholung bereit ist',
  'va rog sa trimiteti documentele': 'Sie die Dokumente senden',
  'transportul va intarzia': 'sich der Transport verspaeten wird',
  'confirm livrarea vehiculului': 'ich die Lieferung des Fahrzeugs bestaetige',
  'i am contacting you regarding the vehicle transport': 'ich Sie bezueglich des Fahrzeugtransports kontaktiere',
  'i have arrived at the location': 'ich am Standort angekommen bin',
  'the vehicle is ready for pickup': 'das Fahrzeug zur Abholung bereit ist',
  'please send the documents': 'Sie die Dokumente senden',
  'the transport will be delayed': 'sich der Transport verspaeten wird',
  'i confirm the vehicle delivery': 'ich die Lieferung des Fahrzeugs bestaetige',
};

const romanianDictionary: Record<string, string> = {
  'va contactez in legatura cu transportul vehiculului': 'va contactez in legatura cu transportul vehiculului',
  'am ajuns la locatie': 'am ajuns la locatie',
  'vehiculul este pregatit pentru preluare': 'vehiculul este pregatit pentru preluare',
  'va rog sa trimiteti documentele': 'va rog sa trimiteti documentele',
  'transportul va intarzia': 'transportul va intarzia',
  'confirm livrarea vehiculului': 'confirm livrarea vehiculului',
  'ich kontaktiere sie bezueglich des fahrzeugtransports': 'va contactez in legatura cu transportul vehiculului',
  'ich kontaktiere sie bezuglich des fahrzeugtransports': 'va contactez in legatura cu transportul vehiculului',
  'ich sie bezueglich des fahrzeugtransports kontaktiere': 'va contactez in legatura cu transportul vehiculului',
  'ich bin am standort angekommen': 'am ajuns la locatie',
  'ich am standort angekommen bin': 'am ajuns la locatie',
  'das fahrzeug ist zur abholung bereit': 'vehiculul este pregatit pentru preluare',
  'das fahrzeug zur abholung bereit ist': 'vehiculul este pregatit pentru preluare',
  'bitte senden sie die dokumente': 'va rog sa trimiteti documentele',
  'sie die dokumente senden': 'va rog sa trimiteti documentele',
  'der transport wird sich verspaeten': 'transportul va intarzia',
  'sich der transport verspaeten wird': 'transportul va intarzia',
  'ich bestaetige die lieferung des fahrzeugs': 'confirm livrarea vehiculului',
  'ich bestatige die lieferung des fahrzeugs': 'confirm livrarea vehiculului',
  'ich die lieferung des fahrzeugs bestaetige': 'confirm livrarea vehiculului',
  'i am contacting you regarding the vehicle transport': 'va contactez in legatura cu transportul vehiculului',
  'i have arrived at the location': 'am ajuns la locatie',
  'the vehicle is ready for pickup': 'vehiculul este pregatit pentru preluare',
  'please send the documents': 'va rog sa trimiteti documentele',
  'the transport will be delayed': 'transportul va intarzia',
  'i confirm the vehicle delivery': 'confirm livrarea vehiculului',
};

const englishDictionary: Record<string, string> = {
  'i am contacting you regarding the vehicle transport': 'I am contacting you regarding the vehicle transport',
  'i have arrived at the location': 'I have arrived at the location',
  'the vehicle is ready for pickup': 'the vehicle is ready for pickup',
  'please send the documents': 'please send the documents',
  'the transport will be delayed': 'the transport will be delayed',
  'i confirm the vehicle delivery': 'I confirm the vehicle delivery',
  'va contactez in legatura cu transportul vehiculului': 'I am contacting you regarding the vehicle transport',
  'am ajuns la locatie': 'I have arrived at the location',
  'ich bin am standort angekommen': 'I have arrived at the location',
  'ich am standort angekommen bin': 'I have arrived at the location',
  'vehiculul este pregatit pentru preluare': 'the vehicle is ready for pickup',
  'das fahrzeug ist zur abholung bereit': 'the vehicle is ready for pickup',
  'das fahrzeug zur abholung bereit ist': 'the vehicle is ready for pickup',
  'va rog sa trimiteti documentele': 'please send the documents',
  'sie die dokumente senden': 'please send the documents',
  'transportul va intarzia': 'the transport will be delayed',
  'sich der transport verspaeten wird': 'the transport will be delayed',
  'confirm livrarea vehiculului': 'I confirm the vehicle delivery',
  'ich die lieferung des fahrzeugs bestaetige': 'I confirm the vehicle delivery',
};

export function professionalizeMessage(text: string, language: LanguageCode, signature: string): string {
  const core = text || defaultIntent(language);
  const closing = localizeClosing(signature, language);

  if (language === 'en') {
    return `Hello,\n\n${polishSentence(core, 'en')}\n\nPlease let me know if any additional information is required.\n\n${closing}`;
  }

  if (language === 'de') {
    return `Guten Tag,\n\n${polishSentence(core, 'de')}\n\nBitte teilen Sie mir mit, falls weitere Informationen benoetigt werden.\n\n${closing}`;
  }

  return `Buna ziua,\n\n${polishSentence(core, 'ro')}\n\nVa rog sa imi transmiteti daca sunt necesare informatii suplimentare.\n\n${closing}`;
}

export function localizedDefaultClosing(language: LanguageCode): string {
  if (language === 'de') {
    return 'Mit freundlichen Grüßen';
  }

  if (language === 'en') {
    return 'Kind regards';
  }

  return 'Cu stimă';
}

export function translateMessage(text: string, targetLanguage: LanguageCode): string {
  return translateMessageWithStatus(text, targetLanguage).text;
}

export function translateMessageWithStatus(text: string, targetLanguage: LanguageCode): TranslationResult {
  const source = text.trim();

  if (!source) {
    return {
      text: defaultIntent(targetLanguage),
      available: true,
    };
  }

  const normalized = normalizeMessage(source);
  const dictionary = getDictionary(targetLanguage);
  const translated = dictionary[normalized];

  if (!translated) {
    return {
      text,
      available: false,
    };
  }

  return {
    text: translated,
    available: true,
  };
}

export function detectMessageLanguage(text: string, fallbackLanguage: LanguageCode): LanguageCode {
  const source = text.trim();

  if (!source) {
    return fallbackLanguage;
  }

  const lower = source.toLocaleLowerCase();
  const normalized = normalizeMessage(source);

  if (/[äöüß]/i.test(source) || /\b(ich|bin|sie|das|der|die|und|nicht|bitte|danke|standort|fahrzeug)\b/.test(normalized)) {
    return 'de';
  }

  if (/[ăâîșşțţ]/i.test(source) || /\b(sunt|este|ajuns|locatie|locație|vehicul|transportul|documentele|rog|multumesc|mulțumesc)\b/.test(lower)) {
    return 'ro';
  }

  if (/\b(i|am|have|arrived|location|vehicle|transport|please|documents|thank|regards)\b/.test(normalized)) {
    return 'en';
  }

  return fallbackLanguage;
}

function polishSentence(text: string, language: LanguageCode): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const first = normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
  const body = lowerFirst(first);

  if (language === 'en') {
    return `I would like to inform you that ${removeFinalPeriod(body)}.`;
  }

  if (language === 'de') {
    return `Ich moechte Sie darueber informieren, dass ${removeFinalPeriod(body)}.`;
  }

  return `Doresc sa va informez ca ${removeFinalPeriod(body)}.`;
}

function getDictionary(targetLanguage: LanguageCode): Record<string, string> {
  if (targetLanguage === 'de') {
    return germanDictionary;
  }

  if (targetLanguage === 'ro') {
    return romanianDictionary;
  }

  return englishDictionary;
}

function defaultIntent(language: LanguageCode): string {
  if (language === 'en') return 'I am contacting you regarding the vehicle transport.';
  if (language === 'de') return 'ich kontaktiere Sie bezueglich des Fahrzeugtransports.';
  return 'va contactez in legatura cu transportul vehiculului.';
}

function localizeClosing(signature: string, language: LanguageCode): string {
  const normalizedSignature = normalizeMessage(signature);
  const isDefaultClosing =
    !normalizedSignature ||
    normalizedSignature === 'cu stima' ||
    normalizedSignature === 'kind regards' ||
    normalizedSignature === 'mit freundlichen grußen' ||
    normalizedSignature === 'mit freundlichen grussen' ||
    normalizedSignature === 'mit freundlichen gruessen';

  if (!isDefaultClosing) {
    return signature;
  }

  return localizedDefaultClosing(language);
}

function normalizeMessage(text: string): string {
  return removeFinalPeriod(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function removeFinalPeriod(text: string): string {
  return text.trim().endsWith('.') ? text.trim().slice(0, -1) : text.trim();
}

function lowerFirst(text: string): string {
  if (text.startsWith('I ')) {
    return text;
  }

  return text.charAt(0).toLocaleLowerCase() + text.slice(1);
}
