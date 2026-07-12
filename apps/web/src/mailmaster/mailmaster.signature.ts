import { type LanguageCode } from '../emailLanguage';
import { t } from '../i18n/app-i18n';
import { defaultProfile, type ProfileSettings } from '../profileSettings';
import { type MailTone } from './mailmaster.types';

export function buildMailSignature(profile: ProfileSettings, language: LanguageCode, tone: MailTone, useProfileDetails: boolean): string {
  if (!useProfileDetails) {
    return localizedMailClosing(profile.defaultSignature, language, tone);
  }

  const signature = profile.defaultSignature.trim();
  const shouldLocalizeClosing = signature === defaultProfile().defaultSignature || !signature;
  const lines = [
    shouldLocalizeClosing ? localizedMailClosing(signature, language, tone) : signature,
    profile.displayName,
  ].filter((value) => value.trim().length > 0);

  return lines.join('\n');
}

function localizedMailClosing(signature: string, language: LanguageCode, tone: MailTone): string {
  if (!isDefaultClosing(signature)) {
    return signature;
  }

  if (tone === 'friendly') return t(language, 'mail.closing.friendly');
  if (tone === 'polite') return t(language, 'mail.closing.polite');
  if (tone === 'short') return t(language, 'mail.closing.short');
  return t(language, 'mail.closing.default');
}

function isDefaultClosing(signature: string) {
  const normalized = signature
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();

  return (
    !normalized ||
    normalized === 'cu stima' ||
    normalized === 'kind regards' ||
    normalized.startsWith('mit freundlichen')
  );
}
