import { type AgmContact, type ContactDraft, type ContactValidationResult } from './contact-manager.types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phonePattern = /^[+()\d\s.-]{6,}$/;

export function validateContactDraft(contact: ContactDraft | AgmContact): ContactValidationResult {
  const messages: string[] = [];
  const hasUsefulIdentifier = Boolean(
    contact.name.trim() || contact.email.trim() || contact.phone.trim() || contact.whatsapp.trim(),
  );

  if (!hasUsefulIdentifier) {
    messages.push('Contactul trebuie sa contina cel putin nume, e-mail, telefon sau WhatsApp.');
  }

  if (contact.email.trim() && !emailPattern.test(contact.email.trim())) {
    messages.push('Adresa de e-mail nu pare valida.');
  }

  if (contact.phone.trim() && !phonePattern.test(contact.phone.trim())) {
    messages.push('Numarul de telefon nu pare valid.');
  }

  if (contact.whatsapp.trim() && !phonePattern.test(contact.whatsapp.trim())) {
    messages.push('Numarul WhatsApp nu pare valid.');
  }

  return {
    valid: messages.length === 0,
    messages,
  };
}
