import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AgmContact } from '../src/contact-manager/contact-manager.types';
import {
  normalizeContactEmails,
  requestedContactEmailLabel,
  selectContactEmail,
} from '../src/contact-manager/contact-email';
import { resolvePersonalContactAction } from '../src/contact-manager/personal-contact';
import { resolvePersonalContactVoiceRequest } from '../src/contact-manager/personal-contact-voice';
import { readContacts, saveContacts } from '../src/contact-manager/contact-manager.storage';

function contact(input: Partial<AgmContact> = {}): AgmContact {
  return {
    id: 'mona', name: 'Mona Vodafone', company: '', email: '', emails: [], phone: '', whatsapp: '', messenger: '',
    address: '', notes: '', categories: ['personal'], favorite: false,
    createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z', ...input,
  };
}

const labelled = contact({
  emails: [
    { id: 'personal', label: 'personal', value: 'mona.personal@example.test', isDefault: false },
    { id: 'work', label: 'work', value: 'mona.work@example.test', isDefault: false },
  ],
});

assert.equal(selectContactEmail(labelled).status, 'AMBIGUOUS');
assert.deepEqual(selectContactEmail(labelled, 'personal'), {
  status: 'RESOLVED', email: labelled.emails[0], availableLabels: ['personal', 'work'],
});
assert.equal(requestedContactEmailLabel('Trimite un email de serviciu lui Mona Vodafone.', ['personal', 'work']), 'work');
assert.equal(requestedContactEmailLabel('Trimite un email personal lui Mona Vodafone.', ['personal', 'work']), 'personal');

const explicit = resolvePersonalContactVoiceRequest('Trimite un email personal lui Mona Vodafone.', [labelled]);
assert.equal(explicit.handled, true);
assert.equal(explicit.handled && explicit.resolution?.payload?.requestedEmailLabel, 'personal');
const explicitAction = explicit.handled && explicit.resolution ? resolvePersonalContactAction(explicit.resolution, [labelled]) : undefined;
assert.equal(explicitAction?.status, 'RESOLVED');
assert.equal(explicitAction?.payload?.value, 'mona.personal@example.test');
assert.equal(explicitAction?.payload?.selectedEmailLabel, 'personal');

const ambiguous = resolvePersonalContactVoiceRequest('Trimite un email lui Mona Vodafone.', [labelled]);
const ambiguousAction = ambiguous.handled && ambiguous.resolution ? resolvePersonalContactAction(ambiguous.resolution, [labelled]) : undefined;
assert.equal(ambiguousAction?.status, 'CLARIFICATION_REQUIRED');
assert.equal(ambiguousAction?.reason, 'AGM_PERSONAL_CONTACT_EMAIL_AMBIGUOUS');
assert.deepEqual(ambiguousAction?.payload?.availableEmailLabels, ['personal', 'work']);

const withDefault = contact({ emails: labelled.emails.map((entry) => ({ ...entry, isDefault: entry.label === 'work' })) });
const defaultAction = ambiguous.handled && ambiguous.resolution ? resolvePersonalContactAction(ambiguous.resolution, [withDefault]) : undefined;
assert.equal(defaultAction?.status, 'RESOLVED');
assert.equal(defaultAction?.payload?.value, 'mona.work@example.test');

const legacy = normalizeContactEmails(undefined, 'legacy@example.test');
assert.equal(legacy.length, 1);
assert.equal(legacy[0]?.value, 'legacy@example.test');
assert.equal(legacy[0]?.isDefault, true);
const storage = new Map<string, string>();
const port = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value) };
saveContacts(port, [contact({ email: 'legacy@example.test', emails: [] })]);
assert.equal(readContacts(port)[0]?.emails[0]?.value, 'legacy@example.test');

const runtime = readFileSync(new URL('../src/premium-voice-shell/premium-assistant.runtime.ts', import.meta.url), 'utf8');
assert.match(runtime, /pendingEmailAction/);
assert.match(runtime, /contact-email-choice-request/);
assert.ok(runtime.indexOf("speakRuntimeMessage(announcement,'contact-email-choice-accepted')") < runtime.indexOf('executeAndroidAction(confirmedText,prepared)'));

console.log('MULTIPLE EMAIL ADDRESSES PER CONTACT = PASS');
console.log('EMAIL LABELS + LEGACY MIGRATION = PASS');
console.log('SEMANTIC EMAIL RESOLUTION = PASS');
console.log('DEFAULT EMAIL SUPPORT = PASS');
console.log('VOICE EMAIL DISAMBIGUATION = PASS');
