import { validateContactDraft } from './contact-manager.validation';
import { createContact, saveContacts, updateContact } from './contact-manager.storage';
import { type AgmContact, type ContactDraft, type ContactValidationResult } from './contact-manager.types';
import { validateQuickContactCapacity } from './quick-contact';

export function addContact(contacts: AgmContact[], draft: ContactDraft): { contacts: AgmContact[]; result: ContactValidationResult } {
  const result = validateContact(contacts, draft);

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
  const result = validateContact(contacts, draft, contactId);

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
    [contact.name, contact.company, contact.email, contact.phone, contact.whatsapp, contact.messenger, contact.address, contact.notes]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}

export function persistContactList(storage: Storage, contacts: AgmContact[]) {
  saveContacts(storage, contacts);
}

function validateContact(contacts: AgmContact[], draft: ContactDraft, editingId = ''): ContactValidationResult {
  const content = validateContactDraft(draft);
  const capacity = validateQuickContactCapacity(contacts, draft, editingId);
  return {
    valid: content.valid && capacity.valid,
    messages: [...content.messages, ...capacity.messages],
  };
}
