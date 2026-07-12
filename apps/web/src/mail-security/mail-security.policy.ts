import { type MailDraft } from '../mailmaster/mailmaster.types';
import { type MailSecurityCheck } from './mail-security.types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function evaluateMailDraftSecurity(draft: MailDraft): MailSecurityCheck {
  const messages: string[] = [];

  if (!draft.recipient.trim()) {
    messages.push('mail.security.missingRecipient');
  } else if (!emailPattern.test(draft.recipient.trim())) {
    messages.push('mail.security.invalidRecipient');
  }

  if (!draft.subject.trim()) {
    messages.push('mail.security.missingSubject');
  }

  if (!draft.message.trim()) {
    messages.push('mail.security.missingBody');
  }

  return {
    status: messages.length > 0 ? 'blocked' : 'safe',
    messages,
  };
}

export function realMailSendingIsApproved(): boolean {
  return false;
}
