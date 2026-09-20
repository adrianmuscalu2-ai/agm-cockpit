import { type AgmContact, type ContactDraft, type ContactValidationResult } from './contact-manager.types';
import { normalizeContactEmails } from './contact-email';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phonePattern = /^[+()\d\s.-]{6,}$/;
const messengerPattern = /^(?:(?:https?:\/\/)?(?:www\.)?m\.me\/[a-z0-9._-]{2,80}\/?|[a-z0-9._-]{2,80})$/i;

export function validateContactDraft(contact: ContactDraft | AgmContact): ContactValidationResult {
  const messages: string[] = [];
  const emails = normalizeContactEmails(contact.emails, contact.email);
  const hasUsefulIdentifier = Boolean(
    contact.name.trim() || emails.length || contact.phone.trim() || contact.whatsapp.trim() || contact.messenger.trim(),
  );

  if (!hasUsefulIdentifier) {
    messages.push('contact.validation.identifier');
  }

  if (emails.some((entry) => !entry.label.trim() || !emailPattern.test(entry.value))) {
    messages.push('contact.validation.email');
  }

  if (new Set(emails.map((entry) => entry.label.trim().toLocaleLowerCase())).size !== emails.length) {
    messages.push('contact.validation.emailLabelUnique');
  }

  if (contact.phone.trim() && !phonePattern.test(contact.phone.trim())) {
    messages.push('contact.validation.phone');
  }

  if (contact.whatsapp.trim() && !phonePattern.test(contact.whatsapp.trim())) {
    messages.push('contact.validation.whatsapp');
  }

  if (contact.messenger.trim() && !messengerPattern.test(contact.messenger.trim())) {
    messages.push('contact.validation.messenger');
  }

  return {
    valid: messages.length === 0,
    messages,
  };
}
