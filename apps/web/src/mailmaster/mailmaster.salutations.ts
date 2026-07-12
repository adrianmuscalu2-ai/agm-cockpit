import { type LanguageCode } from '../emailLanguage';
import { type MailTone, type RecipientContext } from './mailmaster.types';

type SalutationKey = MailTone | 'transport' | 'thanks' | 'manual';

const salutationPresets: Record<LanguageCode, Record<SalutationKey, string>> = {
  ro: {
    business: 'Stimate doamne, stimați domni,',
    formal: 'Stimate doamne, stimați domni,',
    friendly: 'Salut,',
    short: 'Buna ziua,',
    polite: 'Buna ziua,',
    transport: 'Buna ziua,',
    thanks: 'Buna ziua,',
    manual: '',
  },
  de: {
    business: 'Sehr geehrte Damen und Herren,',
    formal: 'Sehr geehrte Damen und Herren,',
    friendly: 'Hallo,',
    short: 'Guten Tag,',
    polite: 'Guten Tag,',
    transport: 'Guten Tag,',
    thanks: 'Guten Tag,',
    manual: '',
  },
  en: {
    business: 'Dear Sir or Madam,',
    formal: 'Dear Sir or Madam,',
    friendly: 'Hello,',
    short: 'Hello,',
    polite: 'Hello,',
    transport: 'Hello,',
    thanks: 'Hello,',
    manual: '',
  },
};

export function professionalSalutation(language: LanguageCode, tone: MailTone, recipient: RecipientContext): string {
  const name = recipient.name.trim();

  if (name && recipient.gender !== 'unknown' && (tone === 'formal' || tone === 'business')) {
    if (language === 'de') {
      return recipient.gender === 'female' ? `Sehr geehrte Frau ${name},` : `Sehr geehrter Herr ${name},`;
    }

    if (language === 'en') {
      return recipient.gender === 'female' ? `Dear Ms ${name},` : `Dear Mr ${name},`;
    }

    return recipient.gender === 'female' ? `Stimata doamna ${name},` : `Stimate domnule ${name},`;
  }

  return salutationPresets[language][tone];
}

export function professionalFollowUp(language: LanguageCode, tone: MailTone): string {
  if (tone === 'short') {
    return '';
  }

  if (language === 'de') {
    if (tone === 'business') return 'Bitte geben Sie mir kurz Bescheid, wie wir weiter vorgehen.';
    if (tone === 'friendly') return 'Vielen Dank und ich freue mich auf Ihre Rueckmeldung.';
    return 'Bitte teilen Sie mir mit, falls weitere Informationen benoetigt werden.';
  }

  if (language === 'en') {
    if (tone === 'business') return 'Please let me know how you would like to proceed.';
    if (tone === 'friendly') return 'Thank you, I look forward to your reply.';
    return 'Please let me know if any additional information is required.';
  }

  if (tone === 'business') return 'Va rog sa imi transmiteti cum doriti sa continuam.';
  if (tone === 'friendly') return 'Va multumesc si astept raspunsul dumneavoastra.';
  return 'Va rog sa imi transmiteti daca sunt necesare informatii suplimentare.';
}
