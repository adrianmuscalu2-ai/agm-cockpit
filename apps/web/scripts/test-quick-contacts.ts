import assert from 'node:assert/strict';
import { emptyContactDraft, saveContacts } from '../src/contact-manager/contact-manager.storage';
import { addContact, editContact } from '../src/contact-manager/contact-manager.service';
import { PERSONAL_CONTACT_LIMIT, personalContactCounts, resolvePersonalContactAction } from '../src/contact-manager/personal-contact';
import { routeAndroidAction } from '../src/android-action-layer/android-action.router';
import { driverActionMessage, driverDialConfirmationSummary } from '../src/android-action-layer/driver-voice-mode';
import { executeAndroidAction } from '../src/android-action-layer/android-action.executor';

let contacts = [] as ReturnType<typeof addContact>['contacts'];
for (let index = 0; index < PERSONAL_CONTACT_LIMIT; index += 1) {
  contacts = addContact(contacts, {
    ...emptyContactDraft(),
    name: `Person ${index}`,
    email: `person${index}@example.com`,
    phone: `+49 170 000 ${String(index).padStart(3, '0')}`,
    messenger: `person.${index}`,
  }).contacts;
}
assert.deepEqual(personalContactCounts(contacts), { people: 20, email: 20, phone: 20, messenger: 20 });
const blockedPerson = addContact(contacts, { ...emptyContactDraft(), name: 'Extra', email: 'extra@example.com' });
assert.deepEqual(blockedPerson.result.messages, ['contact.validation.limit.person']);
const duplicatePerson = addContact([contacts[0]!], {
  ...emptyContactDraft(), name: 'Person 0', phone: '+49 170 000 000',
});
assert.deepEqual(duplicatePerson.result.messages, ['contact.validation.duplicatePerson']);

const mona = addContact([], {
  ...emptyContactDraft(),
  name: 'Mona Vodafone',
  phone: '+40 700 123 456',
  email: 'mona.vodafone@gmail.com',
  messenger: 'mona.vodafone',
}).contacts[0]!;
const monaContacts = [mona];
const withContactNoun = resolvePersonalContactAction(routeAndroidAction('Apelează contactul Mona Vodafone', null), monaContacts);
const withoutContactNoun = resolvePersonalContactAction(routeAndroidAction('Apelează Mona Vodafone', null), monaContacts);
const withCallContactNoun = resolvePersonalContactAction(routeAndroidAction('Sună contactul Mona Vodafone', null), monaContacts);
assert.equal(withContactNoun.payload?.contactName, 'Mona Vodafone');
assert.equal(withContactNoun.payload?.value, '+40 700 123 456');
assert.equal(withContactNoun.payload?.contactSource, 'AGM_PERSONAL_CONTACTS');
assert.equal(withContactNoun.payload?.requestedChannel, 'PHONE');
assert.equal(withContactNoun.payload?.contactId, mona.id);
assert.deepEqual(withContactNoun, withoutContactNoun);
assert.deepEqual(withContactNoun, withCallContactNoun);
assert.match(driverDialConfirmationSummary(withContactNoun, 'ro'), /Contact selectat: Mona Vodafone/);
assert.match(driverDialConfirmationSummary(withContactNoun, 'ro'), /Număr: \+40 700 123 456/);
assert.match(driverDialConfirmationSummary(withContactNoun, 'ro'), /Sursă: Contacte personale AGM/);
assert.match(driverDialConfirmationSummary(withContactNoun, 'ro'), /Apelul nu va fi inițiat automat/);

const duplicateMona = { ...mona, id: 'mona-duplicate', phone: '+40 700 654 321', email: 'mona.other@gmail.com', messenger: 'mona.other' };
const duplicateResolution = resolvePersonalContactAction(routeAndroidAction('Apelează contactul Mona Vodafone', null), [mona, duplicateMona]);
assert.equal(duplicateResolution.status, 'CLARIFICATION_REQUIRED');
assert.equal(duplicateResolution.reason, 'AGM_PERSONAL_CONTACT_AMBIGUOUS');
assert.equal(duplicateResolution.confirmation, 'NONE');
assert.equal(
  driverActionMessage('CLARIFICATION_REQUIRED', duplicateResolution.reason, 'ro', duplicateResolution),
  'Am găsit mai multe contacte cu numele Mona Vodafone. Pe care vrei să îl apelezi?',
);

const persistentMemory = new Map<string, string>();
const persistentStorage = {
  getItem: (key: string) => persistentMemory.get(key) ?? null,
  setItem: (key: string, value: string) => { persistentMemory.set(key, value); },
};
const ephemeralMemory = new Map<string, string>();
const ephemeralStorage = {
  getItem: (key: string) => ephemeralMemory.get(key) ?? null,
  setItem: (key: string, value: string) => { ephemeralMemory.set(key, value); },
};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: persistentStorage });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: ephemeralStorage });
saveContacts(persistentStorage, monaContacts);
ephemeralMemory.clear(); // Simulate closing and reopening the AGM WebView session.
const confirmationGate = await executeAndroidAction(
  'Apelează contactul Mona Vodafone',
  routeAndroidAction('Apelează contactul Mona Vodafone', null),
);
assert.equal(confirmationGate.result, 'CONFIRMATION_REQUIRED');
assert.equal(confirmationGate.resolution.payload?.contactName, 'Mona Vodafone');
assert.equal(confirmationGate.resolution.payload?.value, '+40 700 123 456');
assert.equal(confirmationGate.resolution.payload?.contactSource, 'AGM_PERSONAL_CONTACTS');
assert.equal(confirmationGate.resolution.payload?.requestedChannel, 'PHONE');
assert.equal(confirmationGate.contactGuardianEvidenceId, undefined);

const gmail = resolvePersonalContactAction(routeAndroidAction('Trimite un Gmail lui Mona Vodafone.', null), monaContacts);
assert.equal(gmail.action, 'EMAIL_DRAFT');
assert.equal(gmail.payload?.value, 'mona.vodafone@gmail.com');
assert.equal(gmail.payload?.contactSource, 'AGM_PERSONAL_CONTACTS');
assert.equal(gmail.payload?.requestedChannel, 'EMAIL');
const gmailGate = await executeAndroidAction('Trimite un Gmail lui Mona Vodafone.', routeAndroidAction('Trimite un Gmail lui Mona Vodafone.', null));
assert.notEqual(gmailGate.result, 'CONFIRMATION_REQUIRED');
assert.equal(gmailGate.resolution.payload?.contactSource, 'AGM_PERSONAL_CONTACTS');

const messenger = resolvePersonalContactAction(routeAndroidAction('Deschide Messenger la Mona.', null), monaContacts);
assert.equal(messenger.action, 'MESSENGER_CHAT');
assert.equal(messenger.payload?.value, 'mona.vodafone');
assert.equal(messenger.payload?.contactSource, 'AGM_PERSONAL_CONTACTS');
assert.equal(messenger.payload?.requestedChannel, 'MESSENGER');
const messengerCall = resolvePersonalContactAction(routeAndroidAction('Apelează Mona pe Messenger.', null), monaContacts);
assert.equal(messengerCall.action, 'MESSENGER_CHAT');
assert.equal(messengerCall.payload?.value, 'mona.vodafone');
const messengerGate = await executeAndroidAction('Apelează Mona pe Messenger.', routeAndroidAction('Apelează Mona pe Messenger.', null));
assert.notEqual(messengerGate.result, 'CONFIRMATION_REQUIRED');
assert.equal(messengerGate.resolution.payload?.contactSource, 'AGM_PERSONAL_CONTACTS');

saveContacts(persistentStorage, [mona, duplicateMona]);
ephemeralMemory.clear(); // Duplicates must also survive a fresh WebView session.
const duplicateGate = await executeAndroidAction(
  'Apelează contactul Mona Vodafone',
  routeAndroidAction('Apelează contactul Mona Vodafone', null),
);
assert.equal(duplicateGate.result, 'CLARIFICATION_REQUIRED');
assert.equal(duplicateGate.target, null);
assert.equal(duplicateGate.fallback, 'AGM_PERSONAL_CONTACT_AMBIGUOUS');
const ambiguousGmail = resolvePersonalContactAction(routeAndroidAction('Trimite un Gmail lui Mona Vodafone.', null), [mona, { ...duplicateMona, email: '' }]);
assert.equal(ambiguousGmail.status, 'CLARIFICATION_REQUIRED');
assert.equal(ambiguousGmail.reason, 'AGM_PERSONAL_CONTACT_AMBIGUOUS');
assert.equal(ambiguousGmail.confirmation, 'NONE');
assert.equal(
  driverActionMessage('CLARIFICATION_REQUIRED', ambiguousGmail.reason, 'ro', ambiguousGmail),
  'Am găsit mai multe persoane cu numele Mona Vodafone. Căreia vrei să îi pregătesc mesajul Gmail?',
);

const editing = editContact(contacts, contacts[0]!.id, {
  ...emptyContactDraft(), name: 'Person 0', email: 'changed@example.com', phone: '+49 170 999 999', messenger: 'person.changed',
});
assert.equal(editing.result.valid, true);
assert.equal(editing.contacts.length, PERSONAL_CONTACT_LIMIT);
console.log('AGM PERSONAL CONTACTS 20 PEOPLE + PHONE/GMAIL/MESSENGER RESOLUTION: PASS');
