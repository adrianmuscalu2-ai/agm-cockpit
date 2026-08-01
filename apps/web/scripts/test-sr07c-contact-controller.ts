import assert from 'node:assert/strict';
import { createContactManagerController, type ContactControllerState } from '../src/contact-manager/contact-manager.controller';
import { emptyContactDraft } from '../src/contact-manager/contact-manager.storage';

const state: ContactControllerState = {
  contacts: [], contactManagerOpen: false, contactEditingId: '',
  contactDraft: emptyContactDraft(), contactErrors: [], recipient: '', status: '',
};
let persisted = 0;
const controller = createContactManagerController({
  state, render: () => undefined, persist: () => { persisted += 1; },
  emptyDraft: emptyContactDraft, localizeErrors: (messages) => messages,
  displayName: (contact) => contact.name, message: (key) => key,
  markMailDraftChanged: () => undefined,
});
const draft = { ...emptyContactDraft(), name: 'Ana', email: 'ana@example.com' };
controller.open(draft);
assert.equal(state.contactManagerOpen, true);
controller.save(draft);
assert.equal(state.contacts.length, 1);
controller.selectForMail(state.contacts[0].id);
assert.equal(state.recipient, 'ana@example.com');
controller.edit(state.contacts[0].id);
assert.equal(state.contactEditingId, state.contacts[0].id);
controller.remove(state.contacts[0].id);
assert.equal(state.contacts.length, 0);
assert.equal(persisted, 2);
controller.save({ ...emptyContactDraft(), email: 'bad' });
assert.ok(state.contactErrors.length > 0);
console.log('SR-07C Contacts controller characterization: PASS');
