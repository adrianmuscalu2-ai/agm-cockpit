import { type LanguageCode } from '../emailLanguage';
import { t } from '../i18n/app-i18n';
import { type MailTone, type RecipientContext } from './mailmaster.types';

type SalutationKey = MailTone | 'transport' | 'thanks' | 'manual';

export function professionalSalutation(language: LanguageCode, tone: MailTone, recipient: RecipientContext): string {
  const name = recipient.name.trim();

  if (name && recipient.gender !== 'unknown' && (tone === 'formal' || tone === 'business')) {
    return t(language, recipient.gender === 'female' ? 'mail.salutation.female' : 'mail.salutation.male', { name });
  }

  return t(language, `mail.salutation.${normalizeSalutationTone(tone)}`);
}

export function professionalFollowUp(language: LanguageCode, tone: MailTone): string {
  if (tone === 'short') {
    return '';
  }

  if (tone === 'business') return t(language, 'mail.followUp.business');
  if (tone === 'friendly') return t(language, 'mail.followUp.friendly');
  return t(language, 'mail.followUp.default');
}

function normalizeSalutationTone(tone: SalutationKey): MailTone {
  return tone === 'transport' || tone === 'thanks' || tone === 'manual' ? 'polite' : tone;
}
