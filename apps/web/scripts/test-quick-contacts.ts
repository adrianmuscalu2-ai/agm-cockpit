import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyContactDraft, saveContacts } from '../src/contact-manager/contact-manager.storage';
import { addContact, editContact } from '../src/contact-manager/contact-manager.service';
import { PERSONAL_CONTACT_LIMIT, personalContactCounts, resolvePersonalContactAction } from '../src/contact-manager/personal-contact';
import { routeAndroidAction } from '../src/android-action-layer/android-action.router';
import { driverActionMessage, driverDialConfirmationSummary } from '../src/android-action-layer/driver-voice-mode';
import { executeAndroidAction } from '../src/android-action-layer/android-action.executor';
import { resolvePersonalContactVoiceRequest } from '../src/contact-manager/personal-contact-voice';
import { personalContactVoiceMessage } from '../src/contact-manager/personal-contact-voice.i18n';

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
  whatsapp: '+40 700 123 456',
}).contacts[0]!;
const monaContacts = [mona];

const voiceCases = [
  ['Apelează contactul Mona Vodafone', 'CALL', 'ACTION', 'DIAL'],
  ['Apelează Mona Vodafone', 'CALL', 'ACTION', 'DIAL'],
  ['accesează în bibliotecă contactul Mona Vodafone', 'LOOKUP', 'LOOKUP', undefined],
  ['numărul de telefon Mona Vodafone', 'PHONE', 'LOOKUP', undefined],
  ['poți să trimiți un mail contactului Mona Vodafone', 'EMAIL', 'ACTION', 'EMAIL_DRAFT'],
  ['Mona Vodafone', 'LOOKUP', 'CLARIFICATION', undefined],
  ['telefon Mona Vodafone', 'PHONE', 'LOOKUP', undefined],
  ['numărul Monei Vodafone', 'PHONE', 'LOOKUP', undefined],
  ['dă-mi telefonul Monei', 'PHONE', 'LOOKUP', undefined],
  ['sun-o pe Mona', 'CALL', 'ACTION', 'DIAL'],
  ['mail Mona Vodafone', 'EMAIL', 'LOOKUP', undefined],
  ['dă-mi emailul Monei', 'EMAIL', 'LOOKUP', undefined],
  ['poți să-i trimiți un mail Monei?', 'EMAIL', 'ACTION', 'EMAIL_DRAFT'],
  ['scrie-i Monei', 'EMAIL', 'ACTION', 'EMAIL_DRAFT'],
  ['contactul Mona Vodafone', 'LOOKUP', 'LOOKUP', undefined],
  ['Mona Vodafone acceseaza in biblioteca', 'LOOKUP', 'LOOKUP', undefined],
  ['NUMARUL MONEI', 'PHONE', 'LOOKUP', undefined],
  ['Messenger Mona', 'MESSENGER', 'LOOKUP', undefined],
  ['deschide Messenger la Mona', 'MESSENGER', 'ACTION', 'MESSENGER_CHAT'],
  ['WhatsApp Mona', 'WHATSAPP', 'LOOKUP', undefined],
] as const;
for (const [text, intent, mode, action] of voiceCases) {
  const result = resolvePersonalContactVoiceRequest(text, monaContacts);
  assert.equal(result.handled, true, `known contact must be handled locally: ${text}`);
  if (!result.handled) continue;
  assert.equal(result.intent, intent, `intent mismatch: ${text}`);
  assert.equal(result.mode, mode, `mode mismatch: ${text}`);
  assert.equal(result.resolution?.action, action, `action mismatch: ${text}`);
}
const phoneLookup = resolvePersonalContactVoiceRequest('numărul de telefon Mona Vodafone', monaContacts);
assert.equal(phoneLookup.handled, true);
if (phoneLookup.handled) {
  assert.match(personalContactVoiceMessage(phoneLookup, 'ro'), /Contact selectat: Mona Vodafone/);
  assert.match(personalContactVoiceMessage(phoneLookup, 'ro'), /Sursă: Contacte personale AGM/);
}
for (const text of ['trimite un mail', 'telefon Vodafone', 'Monalisa este aici', 'apelează numărul 0700123456']) {
  assert.equal(resolvePersonalContactVoiceRequest(text, monaContacts).handled, false, `negative control: ${text}`);
}
const negated = resolvePersonalContactVoiceRequest('nu o suna pe Mona', monaContacts);
assert.equal(negated.handled, true);
if (negated.handled) {
  assert.equal(negated.reason, 'AGM_PERSONAL_CONTACT_NEGATED_ACTION');
  assert.equal(negated.resolution, undefined);
}
const partialDuplicate = { ...mona, id: 'mona-orange', name: 'Mona Orange' };
const ambiguousNameFirst = resolvePersonalContactVoiceRequest('sun-o pe Mona', [mona, partialDuplicate]);
assert.equal(ambiguousNameFirst.handled, true);
assert.equal(ambiguousNameFirst.handled && ambiguousNameFirst.resolution?.payload?.contactName, 'Mona');
const ambiguousNameFirstAction = ambiguousNameFirst.handled && ambiguousNameFirst.resolution
  ? resolvePersonalContactAction(ambiguousNameFirst.resolution, [mona, partialDuplicate])
  : undefined;
assert.equal(ambiguousNameFirstAction?.status, 'CLARIFICATION_REQUIRED');
assert.equal(ambiguousNameFirstAction?.confirmation, 'NONE');
const runtimeSource = readFileSync(new URL('../src/premium-voice-shell/premium-assistant.runtime.ts', import.meta.url), 'utf8');
const nameFirstCall = runtimeSource.indexOf('resolvePersonalContactVoiceRequest(confirmedVoiceText');
assert.ok(nameFirstCall > 0);
assert.ok(nameFirstCall < runtimeSource.indexOf('resolveDriverVoiceCommand(confirmedVoiceText'));
assert.ok(nameFirstCall < runtimeSource.indexOf('client.respond({productId'));
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
const copilotViewSource = readFileSync(new URL('../src/premium-copilot/copilot.view.ts', import.meta.url), 'utf8');
assert.match(copilotViewSource, /data-assistant-action-panel/);
assert.match(copilotViewSource, /data-assistant-action-summary/);
assert.match(copilotViewSource, /data-assistant-action-confirm/);
assert.match(copilotViewSource, /data-assistant-action-reject/);
console.log('AGM PERSONAL CONTACTS 20 PEOPLE + PHONE/GMAIL/MESSENGER RESOLUTION: PASS');
