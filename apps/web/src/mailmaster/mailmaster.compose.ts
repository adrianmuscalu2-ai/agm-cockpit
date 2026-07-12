import { type LanguageCode } from '../emailLanguage';
import { t } from '../i18n/app-i18n';
import { professionalSalutation } from './mailmaster.salutations';
import { type MailDraft, type MailPreview } from './mailmaster.types';

export function buildMailPreview(draft: MailDraft): MailPreview {
  const body = composeBody(draft.message, draft.language, draft.tone, draft.signature, draft.recipientContext);

  return {
    recipient: draft.recipient.trim(),
    subject: draft.subject.trim(),
    body,
    language: draft.language,
    tone: draft.tone,
    signature: draft.signature,
    attachmentsLabel: t(draft.language, 'mail.noAttachments'),
    hasDrawnSignature: draft.hasDrawnSignature,
  };
}

export function composeBody(
  message: string,
  language: LanguageCode,
  tone: MailDraft['tone'],
  signature: string,
  recipientContext: MailDraft['recipientContext'],
): string {
  const core = message.trim();

  if (looksComposed(core, signature)) {
    return core;
  }

  const salutation = professionalSalutation(language, tone, recipientContext);
  const compactBody = [salutation, '', core || defaultManualMessage(language), '', signature]
    .filter((line) => line.length > 0)
    .join('\n');

  return compactBody.replace(/\n{3,}/g, '\n\n').trim();
}

function looksComposed(message: string, signature: string): boolean {
  const normalized = message.toLocaleLowerCase();
  const normalizedSignature = signature.trim().toLocaleLowerCase();
  const hasSalutation =
    normalized.startsWith('buna ziua') ||
    normalized.startsWith('stimate') ||
    normalized.startsWith('guten tag') ||
    normalized.startsWith('hallo') ||
    normalized.startsWith('hello') ||
    normalized.startsWith('dear');
  const hasSignature = normalizedSignature.length > 0 && normalized.includes(normalizedSignature);

  return hasSalutation || hasSignature;
}

function defaultManualMessage(language: LanguageCode): string {
  return t(language, 'mail.defaultManualMessage');
}
