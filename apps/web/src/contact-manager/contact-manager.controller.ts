import { addContact, editContact, removeContact } from './contact-manager.service';
import type { ContactsState } from '../app-shell/app-state.contract';
import type { AgmContact, ContactDraft } from './contact-manager.types';

export type ContactControllerState = {
  contacts: AgmContact[];
  contactManagerOpen: boolean;
  contactEditingId: string;
  contactDraft: ContactDraft;
  contactErrors: string[];
  recipient: string;
  status: string;
};

export function createContactManagerController(dependencies: {
  state: ContactControllerState;
  contactsState?: ContactsState;
  render(): void;
  persist(contacts: AgmContact[]): void;
  emptyDraft(): ContactDraft;
  localizeErrors(messages: string[]): string[];
  displayName(contact: AgmContact): string;
  message(key: string, parameters?: Record<string, string>): string;
  markMailDraftChanged(): void;
}) {
  const { state } = dependencies;
  const contacts = dependencies.contactsState ?? state;
  const invalid = (draft: ContactDraft, messages: string[], open = false) => {
    if (open) contacts.contactManagerOpen = true;
    contacts.contactDraft = draft;
    contacts.contactErrors = dependencies.localizeErrors(messages);
    state.status = contacts.contactErrors[0] ?? dependencies.message('contact.status.cannotSave');
    dependencies.render();
  };
  return {
    open(draft: ContactDraft): void {
      contacts.contactManagerOpen = true;
      contacts.contactEditingId = '';
      contacts.contactErrors = [];
      contacts.contactDraft = draft;
      state.status = dependencies.message('status.contactsOpen');
      dependencies.render();
    },
    saveRecipient(draft: ContactDraft): void {
      const output = addContact(contacts.contacts, draft);
      if (!output.result.valid) return invalid(draft, output.result.messages, true);
      contacts.contacts = output.contacts;
      dependencies.persist(contacts.contacts);
      contacts.contactErrors = [];
      state.status = dependencies.message('contact.status.savedFromRecipient');
      dependencies.render();
    },
    save(draft: ContactDraft): void {
      const output = contacts.contactEditingId
        ? editContact(contacts.contacts, contacts.contactEditingId, draft)
        : addContact(contacts.contacts, draft);
      if (!output.result.valid) return invalid(draft, output.result.messages);
      contacts.contacts = output.contacts;
      dependencies.persist(contacts.contacts);
      contacts.contactEditingId = '';
      contacts.contactDraft = dependencies.emptyDraft();
      contacts.contactErrors = [];
      state.status = dependencies.message('contact.status.saved');
      dependencies.render();
    },
    selectForMail(contactId: string): void {
      const contact = contacts.contacts.find((item) => item.id === contactId);
      if (!contact) {
        state.status = dependencies.message('contact.status.missing');
      } else if (!contact.email.trim()) {
        state.status = dependencies.message('contact.status.missingEmail');
      } else {
        state.recipient = contact.email;
        contacts.contactManagerOpen = false;
        dependencies.markMailDraftChanged();
        state.status = dependencies.message('status.recipientSelected', {
          contact: dependencies.displayName(contact),
        });
      }
      dependencies.render();
    },
    edit(contactId: string): void {
      const contact = contacts.contacts.find((item) => item.id === contactId);
      if (!contact) {
        state.status = dependencies.message('contact.status.missing');
        dependencies.render();
        return;
      }
      contacts.contactEditingId = contact.id;
      contacts.contactDraft = {
        name: contact.name, company: contact.company, email: contact.email,
        phone: contact.phone, whatsapp: contact.whatsapp, address: contact.address,
        notes: contact.notes, categories: contact.categories, favorite: contact.favorite,
      };
      contacts.contactErrors = [];
      state.status = dependencies.message('contact.status.editing', {
        contact: dependencies.displayName(contact),
      });
      dependencies.render();
    },
    remove(contactId: string): void {
      contacts.contacts = removeContact(contacts.contacts, contactId);
      dependencies.persist(contacts.contacts);
      if (contacts.contactEditingId === contactId) {
        contacts.contactEditingId = '';
        contacts.contactDraft = dependencies.emptyDraft();
      }
      contacts.contactErrors = [];
      state.status = dependencies.message('contact.status.deleted');
      dependencies.render();
    },
  };
}
