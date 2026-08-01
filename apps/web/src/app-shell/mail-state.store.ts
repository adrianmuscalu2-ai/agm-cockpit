import type { LegacyAppStateFacade, MailState } from './app-state.contract';

export function createMailState(initial: MailState): MailState {
  return initial;
}

export const mailStateFields = [
  'recipient', 'subject', 'message', 'translatorEnabled', 'mailTranslationState',
  'signatureEditorOpen', 'signaturePadOpen', 'mailReviewOpen', 'mailSecurityMessages',
  'emailTone', 'emailComposeMode', 'selectedEmailTemplateId', 'messageLibraryCategory',
  'messageLibrarySearch', 'messageLibraryFavorites', 'messageLibraryRecent',
  'messageTemplateVariables',
] as const satisfies readonly (keyof MailState)[];

function setMailField<Field extends keyof MailState>(
  mail: MailState,
  field: Field,
  value: MailState[Field],
) {
  mail[field] = value;
}

export function attachMailLegacyFacade<Base extends object>(
  base: Base,
  mail: MailState,
): Base & Pick<LegacyAppStateFacade, keyof MailState> {
  for (const field of mailStateFields) {
    Object.defineProperty(base, field, {
      enumerable: true,
      configurable: false,
      get: () => mail[field],
      set: (value: MailState[typeof field]) => setMailField(mail, field, value),
    });
  }
  return base as Base & Pick<LegacyAppStateFacade, keyof MailState>;
}
