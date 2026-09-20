import { type AgmContact } from './contact-manager.types';
import { primaryContactEmail } from './contact-email';

export function contactDisplayName(contact: AgmContact): string {
  return contact.name || contact.company || primaryContactEmail(contact) || contact.phone || contact.whatsapp || contact.messenger || '';
}

export function contactCategoryLabels(contact: AgmContact): string {
  return contact.categories.join(', ');
}
