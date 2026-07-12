import { type LanguageCode } from '../emailLanguage';
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
  const normalized = signature
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();
  const isDefault =
    !normalized ||
    normalized === 'cu stima' ||
    normalized === 'cu stimäƒ' ||
    normalized === 'kind regards' ||
    normalized.startsWith('mit freundlichen');

  if (!isDefault) {
    return signature;
  }

  if (language === 'de') {
    if (tone === 'friendly') return 'Viele Grüße';
    if (tone === 'polite') return 'Freundliche Grüße';
    if (tone === 'short') return 'Danke und viele Grüße';
    return 'Mit freundlichen Grüßen';
  }

  if (language === 'en') {
    if (tone === 'friendly') return 'Best wishes,';
    if (tone === 'polite') return 'Best regards,';
    if (tone === 'short') return 'Thank you,';
    return 'Kind regards,';
  }

  if (tone === 'friendly') return 'Toate cele bune,';
  if (tone === 'polite') return 'Cu respect,';
  if (tone === 'short') return 'Mulțumesc,';
  return 'Cu stimă,';
}
