import { contactCategories } from './contact-manager.categories';
import { type AgmContact } from './contact-manager.types';

export function contactDisplayName(contact: AgmContact): string {
  return contact.name || contact.company || contact.email || contact.phone || contact.whatsapp || 'Contact fara nume';
}

export function contactCategoryLabels(contact: AgmContact): string {
  const labels = contact.categories
    .map((categoryId) => contactCategories.find((category) => category.id === categoryId)?.label)
    .filter((label): label is string => Boolean(label));

  return labels.length > 0 ? labels.join(', ') : 'Fara categorie';
}
