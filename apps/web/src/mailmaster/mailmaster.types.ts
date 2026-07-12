import { type LanguageCode } from '../emailLanguage';

export type MailTone = 'formal' | 'business' | 'friendly' | 'short' | 'polite';
export type RecipientGender = 'female' | 'male' | 'unknown';

export interface RecipientContext {
  name: string;
  gender: RecipientGender;
}

export interface MailDraft {
  recipient: string;
  subject: string;
  message: string;
  language: LanguageCode;
  tone: MailTone;
  recipientContext: RecipientContext;
  signature: string;
  hasDrawnSignature: boolean;
}

export interface MailPreview {
  recipient: string;
  subject: string;
  body: string;
  language: LanguageCode;
  tone: MailTone;
  signature: string;
  attachmentsLabel: string;
  hasDrawnSignature: boolean;
}

export const mailToneLabels: Record<MailTone, string> = {
  formal: 'Formal',
  business: 'Business',
  friendly: 'Prietenos',
  short: 'Scurt',
  polite: 'Politicos',
};
