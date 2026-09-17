import assert from 'node:assert/strict';
import { emptyContactDraft } from '../src/contact-manager/contact-manager.storage';
import { addContact, editContact } from '../src/contact-manager/contact-manager.service';
import { QUICK_CONTACT_LIMIT, quickContactCounts, resolveQuickContactAction } from '../src/contact-manager/quick-contact';
import { routeAndroidAction } from '../src/android-action-layer/android-action.router';

let contacts = [] as ReturnType<typeof addContact>['contacts'];
for (let index = 0; index < QUICK_CONTACT_LIMIT; index += 1) {
  contacts = addContact(contacts, { ...emptyContactDraft(), name: `Email ${index}`, email: `e${index}@example.com` }).contacts;
}
const blockedEmail = addContact(contacts, { ...emptyContactDraft(), name: 'Extra', email: 'extra@example.com' });
assert.deepEqual(blockedEmail.result.messages, ['contact.validation.limit.email']);

const phoneAllowed = addContact(contacts, {
  ...emptyContactDraft(), name: 'Andrei', phone: '+40 700 000 001', messenger: 'andrei.popescu',
});
assert.equal(phoneAllowed.result.valid, true);
contacts = phoneAllowed.contacts;

for (let index = 1; index < QUICK_CONTACT_LIMIT; index += 1) {
  contacts = addContact(contacts, {
    ...emptyContactDraft(), name: `Phone ${index}`, phone: `+49 170 000 ${String(index).padStart(3, '0')}`,
  }).contacts;
  contacts = addContact(contacts, {
    ...emptyContactDraft(), name: `Messenger ${index}`, messenger: `messenger.user.${index}`,
  }).contacts;
}
assert.deepEqual(quickContactCounts(contacts), { email: 20, phone: 20, messenger: 20 });
assert.deepEqual(
  addContact(contacts, { ...emptyContactDraft(), name: 'Phone Extra', phone: '+49 170 999 999' }).result.messages,
  ['contact.validation.limit.phone'],
);
assert.deepEqual(
  addContact(contacts, { ...emptyContactDraft(), name: 'Messenger Extra', messenger: 'messenger.extra' }).result.messages,
  ['contact.validation.limit.messenger'],
);

const dial = resolveQuickContactAction(routeAndroidAction('Suna-l pe Andrei.', null), contacts);
assert.equal(dial.action, 'DIAL');
assert.equal(dial.payload?.value, '+40 700 000 001');
const email = resolveQuickContactAction(routeAndroidAction('Trimite email lui Email 2.', null), contacts);
assert.equal(email.action, 'EMAIL_DRAFT');
assert.equal(email.payload?.value, 'e2@example.com');
const messenger = resolveQuickContactAction(routeAndroidAction('Deschide Messenger pentru Andrei.', null), contacts);
assert.equal(messenger.action, 'MESSENGER_CHAT');
assert.equal(messenger.payload?.value, 'andrei.popescu');

const editing = editContact(contacts, contacts[0]!.id, {
  ...emptyContactDraft(), name: 'Email 0', email: 'changed@example.com',
});
assert.equal(editing.result.valid, true);
console.log('QUICK CONTACTS 20/20/20 + VOICE RESOLUTION: PASS');
