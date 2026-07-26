export type MailTranslationState = 'not-requested' | 'pending' | 'succeeded' | 'failed';

export function mailTranslationAllowsSend(
  translatorEnabled: boolean,
  translationState: MailTranslationState,
) {
  return !translatorEnabled || translationState === 'succeeded';
}
