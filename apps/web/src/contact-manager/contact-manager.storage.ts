import { normalizeContactCategory } from './contact-manager.categories';
import { emptyContactEmailRows, normalizeContactEmails, primaryContactEmail } from './contact-email';
import { validateContactDraft } from './contact-manager.validation';
import { type AgmContact, type ContactDraft, type ContactStorage } from './contact-manager.types';

export const contactStorageKey = 'agm.contact-manager.contacts';

export function emptyContactDraft(): ContactDraft {
  return {
    name: '',
    company: '',
    email: '',
    emails: emptyContactEmailRows(),
    phone: '',
    whatsapp: '',
    messenger: '',
    address: '',
    notes: '',
    categories: [],
    favorite: false,
  };
}

export function readContacts(storage: ContactStorage): AgmContact[] {
  const stored = storage.getItem(contactStorageKey);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as Partial<AgmContact>[];
    return parsed.map(normalizeContact).filter((contact) => validateContactDraft(contact).valid);
  } catch {
    return [];
  }
}

export function saveContacts(storage: ContactStorage, contacts: AgmContact[]) {
  storage.setItem(contactStorageKey, JSON.stringify(contacts.map(normalizeContact)));
}

export function createContact(draft: ContactDraft, now = new Date()): AgmContact {
  const timestamp = now.toISOString();

  return normalizeContact({
    ...draft,
    id: cryptoSafeId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function updateContact(contact: AgmContact, draft: ContactDraft, now = new Date()): AgmContact {
  return normalizeContact({
    ...draft,
    id: contact.id,
    createdAt: contact.createdAt,
    updatedAt: now.toISOString(),
  });
}

function normalizeContact(contact: Partial<AgmContact>): AgmContact {
  const categories = Array.isArray(contact.categories)
    ? contact.categories.map(normalizeContactCategory).filter((category): category is AgmContact['categories'][number] => Boolean(category))
    : [];

  const emails = normalizeContactEmails(contact.emails, String(contact.email || ''));
  const normalized = {
    id: String(contact.id || cryptoSafeId()),
    name: String(contact.name || '').trim(),
    company: String(contact.company || '').trim(),
    email: '',
    emails,
    phone: String(contact.phone || '').trim(),
    whatsapp: String(contact.whatsapp || '').trim(),
    messenger: String(contact.messenger || '').trim(),
    address: String(contact.address || '').trim(),
    notes: String(contact.notes || '').trim(),
    categories,
    favorite: Boolean(contact.favorite || categories.includes('favorites')),
    createdAt: String(contact.createdAt || new Date().toISOString()),
    updatedAt: String(contact.updatedAt || new Date().toISOString()),
  } satisfies AgmContact;
  normalized.email = primaryContactEmail(normalized);
  return normalized;
}

function cryptoSafeId() {
  if ('crypto' in globalThis && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `contact-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
