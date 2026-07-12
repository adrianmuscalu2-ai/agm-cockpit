import { type ContactCategory } from './contact-manager.types';

export const contactCategories: Array<{ id: ContactCategory }> = [
  { id: 'clients' },
  { id: 'dispatchers' },
  { id: 'employers' },
  { id: 'service' },
  { id: 'partners' },
  { id: 'favorites' },
  { id: 'personal' },
];

export function normalizeContactCategory(value: unknown): ContactCategory | null {
  return contactCategories.some((category) => category.id === value) ? (value as ContactCategory) : null;
}
