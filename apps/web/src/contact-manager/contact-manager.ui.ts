import { type AgmContact } from './contact-manager.types';

export function contactDisplayName(contact: AgmContact): string {
  return contact.name || contact.company || contact.email || contact.phone || contact.whatsapp || '';
}

export function contactCategoryLabels(contact: AgmContact): string {
  return contact.categories.join(', ');
}
