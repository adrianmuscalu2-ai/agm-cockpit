import { type ContactCategory } from './contact-manager.types';

export const contactCategories: Array<{ id: ContactCategory; label: string }> = [
  { id: 'clients', label: 'Clienti' },
  { id: 'dispatchers', label: 'Dispeceri' },
  { id: 'employers', label: 'Angajatori' },
  { id: 'service', label: 'Service' },
  { id: 'partners', label: 'Parteneri' },
  { id: 'favorites', label: 'Favorite' },
  { id: 'personal', label: 'Personal' },
];

export function normalizeContactCategory(value: unknown): ContactCategory | null {
  return contactCategories.some((category) => category.id === value) ? (value as ContactCategory) : null;
}
