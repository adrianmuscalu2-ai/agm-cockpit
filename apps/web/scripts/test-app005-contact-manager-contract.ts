import assert from 'node:assert/strict';
import { addContact, editContact, removeContact, searchContacts } from '../src/contact-manager/contact-manager.service';
import { contactStorageKey, emptyContactDraft, readContacts, saveContacts } from '../src/contact-manager/contact-manager.storage';
import { validateContactDraft } from '../src/contact-manager/contact-manager.validation';

assert.equal(validateContactDraft(emptyContactDraft()).valid, false);
assert.equal(validateContactDraft({ ...emptyContactDraft(), email: 'invalid' }).valid, false);
assert.equal(validateContactDraft({ ...emptyContactDraft(), phone: '+49 170 1234567' }).valid, true);

const added = addContact([], {
  ...emptyContactDraft(),
  name: '  Ana Popescu  ', company: '  AGM  ', email: ' ana@example.com ',
  phone: ' +40 700 000 000 ', categories: ['clients'], favorite: true,
});
assert.equal(added.result.valid, true);
assert.equal(added.contacts[0].name, 'Ana Popescu');
assert.equal(added.contacts[0].email, 'ana@example.com');
assert.deepEqual(searchContacts(added.contacts, '  AGM '), added.contacts);

const edited = editContact(added.contacts, added.contacts[0].id, {
  ...added.contacts[0], name: 'Ana Actualizată', notes: ' Confirmat ',
});
assert.equal(edited.contacts[0].name, 'Ana Actualizată');
assert.equal(edited.contacts[0].notes, 'Confirmat');
assert.deepEqual(removeContact(edited.contacts, edited.contacts[0].id), []);

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
};
saveContacts(storage, edited.contacts);
assert.equal(readContacts(storage)[0].email, 'ana@example.com');
values.set(contactStorageKey, '{corrupted');
assert.deepEqual(readContacts(storage), []);

console.log('APP-005 Contact Manager validation, normalization, search and storage recovery: PASS');
