import assert from 'node:assert/strict';
import {
  attachContactsLegacyFacade,
  contactsStateFields,
  createContactsState,
} from '../src/app-shell/contacts-state.store';
import { createContactManagerController } from '../src/contact-manager/contact-manager.controller';
import { emptyContactDraft } from '../src/contact-manager/contact-manager.storage';

const contacts = createContactsState({
  contacts: [],
  contactManagerOpen: false,
  contactSearch: '',
  contactEditingId: '',
  contactDraft: emptyContactDraft(),
  contactErrors: [],
});
const legacy = attachContactsLegacyFacade({ recipient: '', status: '' }, contacts);

legacy.contactSearch = 'legacy';
assert.equal(contacts.contactSearch, 'legacy');
contacts.contactManagerOpen = true;
assert.equal(legacy.contactManagerOpen, true);

for (const field of contactsStateFields) {
  const descriptor = Object.getOwnPropertyDescriptor(legacy, field);
  assert.equal(typeof descriptor?.get, 'function');
  assert.equal(typeof descriptor?.set, 'function');
  assert.equal('value' in (descriptor ?? {}), false);
}

let persisted = 0;
const controller = createContactManagerController({
  state: legacy,
  contactsState: contacts,
  render: () => undefined,
  persist: () => { persisted += 1; },
  emptyDraft: emptyContactDraft,
  localizeErrors: (messages) => messages,
  displayName: (contact) => contact.name,
  message: (key) => key,
  markMailDraftChanged: () => undefined,
});
const draft = { ...emptyContactDraft(), name: 'Ana', email: 'ana@example.com' };
controller.save(draft);
assert.equal(contacts.contacts.length, 1);
assert.equal(legacy.contacts, contacts.contacts);
controller.selectForMail(contacts.contacts[0].id);
assert.equal(legacy.recipient, 'ana@example.com');
controller.remove(contacts.contacts[0].id);
assert.equal(contacts.contacts.length, 0);
assert.equal(persisted, 2);

console.log('SR-08C Contacts composed state and legacy facade: PASS');
