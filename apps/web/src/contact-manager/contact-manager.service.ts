import { validateContactDraft } from './contact-manager.validation';
import { createContact, saveContacts, updateContact } from './contact-manager.storage';
import { type AgmContact, type ContactDraft, type ContactValidationResult } from './contact-manager.types';

export function addContact(contacts: AgmContact[], draft: ContactDraft): { contacts: AgmContact[]; result: ContactValidationResult } {
  const result = validateContactDraft(draft);

  if (!result.valid) {
    return { contacts, result };
  }

  return {
    contacts: [...contacts, createContact(draft)],
    result,
  };
}

export function editContact(
  contacts: AgmContact[],
  contactId: string,
  draft: ContactDraft,
): { contacts: AgmContact[]; result: ContactValidationResult } {
  const result = validateContactDraft(draft);

  if (!result.valid) {
    return { contacts, result };
  }

  return {
    contacts: contacts.map((contact) => (contact.id === contactId ? updateContact(contact, draft) : contact)),
    result,
  };
}

export function removeContact(contacts: AgmContact[], contactId: string): AgmContact[] {
  return contacts.filter((contact) => contact.id !== contactId);
}

export function searchContacts(contacts: AgmContact[], query: string): AgmContact[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return contacts;
  }

  return contacts.filter((contact) =>
    [contact.name, contact.company, contact.email, contact.phone, contact.whatsapp, contact.address, contact.notes]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}

export function persistContactList(storage: Storage, contacts: AgmContact[]) {
  saveContacts(storage, contacts);
}
