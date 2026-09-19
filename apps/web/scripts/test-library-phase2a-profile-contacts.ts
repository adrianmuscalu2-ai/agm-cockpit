import assert from 'node:assert/strict';
import { emptyContactDraft, saveContacts } from '../src/contact-manager/contact-manager.storage';
import { addContact } from '../src/contact-manager/contact-manager.service';
import { ProfilePersonalContactsResolver, resolveProfilePersonalContactThroughAuthority } from '../src/library-control-plane/profile-personal-contacts.resolver';

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
};
const mona = addContact([], {
  ...emptyContactDraft(),
  name: 'Mona Vodafone',
  phone: '+40 700 123 456',
  email: 'mona.vodafone@example.test',
  messenger: 'mona.vodafone',
  whatsapp: '+40 700 123 456',
  address: 'must-not-enter-context',
  notes: 'must-not-enter-context',
}).contacts[0]!;
saveContacts(storage, [mona]);

let planningReads = 0;
const planningResolver = new ProfilePersonalContactsResolver(() => { planningReads += 1; return [mona]; });
planningResolver.match({
  requestId: '2a-plan', correlationId: '2a-plan', surface: 'PROFILE',
  identity: { tenantId: 'tenant', subjectId: 'owner', roles: ['AGM_PROFILE_OWNER'] },
  query: { text: 'Mona Vodafone', language: 'ro' },
});
assert.equal(planningReads, 0, 'planning must not read Profile data before authorization');

const browserBasic = await resolveProfilePersonalContactThroughAuthority({
  text: 'dă-mi telefonul Monei', language: 'ro', storage, surface: 'BROWSER', domain: 'BASIC', requestId: '2a-browser-basic',
});
assert.equal(browserBasic.package.status, 'CONTEXT_READY');
assert.deepEqual(browserBasic.package.domains, ['BASIC']);
assert.equal(browserBasic.package.mandates[0]?.orchestratorId, 'agm.library.basic');
assert.equal(browserBasic.package.contexts[0]?.contributingSources[0], 'PROFILE_CONTACTS');
assert.equal(browserBasic.command.handled && browserBasic.command.intent, 'PHONE');
assert.equal(browserBasic.command.handled && browserBasic.command.contact?.phone, '+40 700 123 456');
assert.equal(browserBasic.package.dispatch.injectResolvedContext, true);
assert.equal(browserBasic.package.dispatch.genericFallbackAllowed, false);
assert.equal(JSON.stringify(browserBasic.package).includes('must-not-enter-context'), false);

const androidPremium = await resolveProfilePersonalContactThroughAuthority({
  text: 'Sună-o pe Mona Vodafone.', language: 'ro', storage, surface: 'ANDROID', domain: 'PREMIUM', requestId: '2a-android-premium',
});
assert.equal(androidPremium.package.status, 'CONTEXT_READY');
assert.equal(androidPremium.package.mandates[0]?.orchestratorId, 'agm.library.premium');
assert.equal(androidPremium.command.handled, true);
if (androidPremium.command.handled) {
  assert.equal(androidPremium.command.intent, 'CALL');
  assert.equal(androidPremium.command.resolution?.action, 'DIAL');
  assert.equal(androidPremium.command.resolution?.payload?.value, '+40 700 123 456');
  assert.equal(androidPremium.command.resolution?.payload?.contactSource, 'AGM_PERSONAL_CONTACTS');
  assert.equal(androidPremium.command.resolution?.confirmation, 'AGM_REQUIRED');
}
const authorizationStage = androidPremium.package.trace.findIndex((event) => event.stage === 'AUTHORIZATION_EVALUATED');
const resolverStage = androidPremium.package.trace.findIndex((event) => event.stage === 'RESOLVER_CALLED');
assert.ok(authorizationStage >= 0 && authorizationStage < resolverStage);

const browserProfile = await resolveProfilePersonalContactThroughAuthority({
  text: 'Trimite-i un email Monei Vodafone.', language: 'ro', storage, surface: 'BROWSER', domain: 'PROFILE', requestId: '2a-browser-profile',
});
assert.equal(browserProfile.package.status, 'CONTEXT_READY');
assert.equal(browserProfile.package.mandates[0]?.orchestratorId, 'agm.library.profile');
assert.equal(browserProfile.command.handled && browserProfile.command.resolution?.action, 'EMAIL_DRAFT');
assert.equal(browserProfile.command.handled && browserProfile.command.resolution?.payload?.value, 'mona.vodafone@example.test');

const carMoverMandate = await resolveProfilePersonalContactThroughAuthority({
  text: 'contactul Mona Vodafone', language: 'ro', storage, surface: 'ANDROID', domain: 'CAR_MOVER', requestId: '2a-car-mover-profile',
});
assert.equal(carMoverMandate.package.status, 'CONTEXT_READY');
assert.equal(carMoverMandate.package.mandates[0]?.orchestratorId, 'agm.library.car-mover');

const duplicate = { ...mona, id: 'mona-duplicate', phone: '+40 700 654 321', email: 'mona.other@example.test' };
saveContacts(storage, [mona, duplicate]);
const ambiguous = await resolveProfilePersonalContactThroughAuthority({
  text: 'Apelează Mona Vodafone', language: 'ro', storage, surface: 'ANDROID', domain: 'PREMIUM', requestId: '2a-duplicate',
});
assert.equal(ambiguous.package.status, 'CLARIFICATION_REQUIRED');
assert.equal(ambiguous.package.dispatch.assistantAllowed, false);
assert.equal(ambiguous.package.dispatch.genericFallbackAllowed, false);
assert.equal(ambiguous.package.clarifications[0]?.candidateIds.length, 2);
assert.equal(ambiguous.command.handled && ambiguous.command.resolution?.status, 'CLARIFICATION_REQUIRED');
assert.equal(ambiguous.command.handled && ambiguous.command.resolution?.confirmation, 'NONE');

saveContacts(storage, [mona]);
for (const text of ['Care este vremea?', 'Deschide Waze', 'Ce am discutat ieri?']) {
  const negative = await resolveProfilePersonalContactThroughAuthority({
    text, language: 'ro', storage, surface: 'BROWSER', domain: 'PREMIUM', requestId: `2a-negative-${text.length}`,
  });
  assert.equal(negative.package.status, 'VERIFIED_NO_DATA');
  assert.equal(negative.package.dispatch.genericFallbackAllowed, true);
  assert.equal(negative.command.handled, false);
}

console.log('PHASE 2A PROFILE CANONICAL CONTACT SOURCE = PASS');
console.log('PHASE 2A BROWSER + ANDROID DOMAIN MANDATES = PASS');
console.log('PHASE 2A ALIAS + PHONE + EMAIL RESOLUTION = PASS');
console.log('PHASE 2A DUPLICATE CLARIFICATION = PASS');
console.log('PHASE 2A VERIFIED NO-DATA FALLBACK = PASS');
console.log('PHASE 2A ACTION_DIAL SAFETY CONTRACT PRESERVED = PASS');
