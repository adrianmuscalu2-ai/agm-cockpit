import { type MailDraft } from '../mailmaster/mailmaster.types';
import { type MailSecurityCheck } from './mail-security.types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function evaluateMailDraftSecurity(draft: MailDraft): MailSecurityCheck {
  const messages: string[] = [];

  if (!draft.recipient.trim()) {
    messages.push('Introdu destinatarul inainte de pregatirea mesajului.');
  } else if (!emailPattern.test(draft.recipient.trim())) {
    messages.push('Adresa destinatarului nu pare valida.');
  }

  if (!draft.subject.trim()) {
    messages.push('Completeaza subiectul inainte de pregatirea mesajului.');
  }

  if (!draft.message.trim()) {
    messages.push('Completeaza corpul mesajului inainte de pregatirea mesajului.');
  }

  return {
    status: messages.length > 0 ? 'blocked' : 'safe',
    messages,
  };
}

export function realMailSendingIsApproved(): boolean {
  return false;
}
