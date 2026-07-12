import { type AgmContact, type ContactDraft, type ContactValidationResult } from './contact-manager.types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phonePattern = /^[+()\d\s.-]{6,}$/;

export function validateContactDraft(contact: ContactDraft | AgmContact): ContactValidationResult {
  const messages: string[] = [];
  const hasUsefulIdentifier = Boolean(
    contact.name.trim() || contact.email.trim() || contact.phone.trim() || contact.whatsapp.trim(),
  );

  if (!hasUsefulIdentifier) {
    messages.push('contact.validation.identifier');
  }

  if (contact.email.trim() && !emailPattern.test(contact.email.trim())) {
    messages.push('contact.validation.email');
  }

  if (contact.phone.trim() && !phonePattern.test(contact.phone.trim())) {
    messages.push('contact.validation.phone');
  }

  if (contact.whatsapp.trim() && !phonePattern.test(contact.whatsapp.trim())) {
    messages.push('contact.validation.whatsapp');
  }

  return {
    valid: messages.length === 0,
    messages,
  };
}
