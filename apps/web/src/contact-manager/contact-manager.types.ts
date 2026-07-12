export type ContactCategory =
  | 'clients'
  | 'dispatchers'
  | 'employers'
  | 'service'
  | 'partners'
  | 'favorites'
  | 'personal';

export interface AgmContact {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  notes: string;
  categories: ContactCategory[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ContactDraft = Omit<AgmContact, 'id' | 'createdAt' | 'updatedAt'>;

export interface ContactStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ContactValidationResult {
  valid: boolean;
  messages: string[];
}
