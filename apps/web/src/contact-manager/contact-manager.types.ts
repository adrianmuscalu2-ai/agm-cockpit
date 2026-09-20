export type ContactCategory =
  | 'clients'
  | 'dispatchers'
  | 'employers'
  | 'service'
  | 'partners'
  | 'favorites'
  | 'personal';

export interface ContactEmailAddress {
  id: string;
  label: string;
  value: string;
  isDefault: boolean;
}

export interface AgmContact {
  id: string;
  name: string;
  company: string;
  /** Compatibility projection of the default or first labelled address. */
  email: string;
  emails: ContactEmailAddress[];
  phone: string;
  whatsapp: string;
  messenger: string;
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
