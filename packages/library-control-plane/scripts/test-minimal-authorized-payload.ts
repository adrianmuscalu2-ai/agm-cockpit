import assert from 'node:assert/strict';
import {
  AgmGlobalLibraryAuthority,
  createDomainOrchestrators,
  ExplicitLibraryAuthorizationPolicy,
  type LibraryResolver,
} from '../src';

const orchestrators = createDomainOrchestrators();
const resolver: LibraryResolver = {
  descriptor: {
    resolverId: 'profile.payload-boundary',
    source: 'PROFILE_CONTACTS',
    owner: 'AGM',
    supportedDomains: ['PROFILE'],
    sensitivity: 'PERSONAL',
    authorizationAction: 'library:read:profile-contacts',
  },
  match: () => ({ eligible: true, confidence: 1, intent: 'CONTACT_LOOKUP' }),
  resolve: async () => ({
    status: 'FOUND',
    identity: { subjectType: 'PERSON', subjectId: 'person:fixture' },
    query: { intent: 'CONTACT_LOOKUP', normalizedText: 'fixture' },
    result: { summary: 'Fixture resolved.', recordCount: 1 },
    confidence: 1,
    ambiguity: { ambiguous: false, candidateIds: [] },
    provenance: { sourceRecordId: 'fixture', owner: 'user', namespace: 'profile', evidenceRefs: [] },
    freshness: { status: 'CURRENT', observedAt: '2026-09-19T12:00:00.000Z', expiresAt: null },
    minimalAuthorizedPayload: { name: 'Mona Fixture', phone: '+40 700 000 000', internalNote: 'must-not-cross-boundary' },
    deduplicationKey: 'person:fixture',
  }),
};
orchestrators[2].register(resolver);

const authority = new AgmGlobalLibraryAuthority(orchestrators, new ExplicitLibraryAuthorizationPolicy([
  { role: 'PROFILE_LIBRARY_READER', domain: 'PROFILE', source: 'PROFILE_CONTACTS', allowedPayloadFields: ['name', 'phone'] },
]));
const resolved = await authority.resolve({
  requestId: 'payload-test', correlationId: 'payload-test', surface: 'PROFILE',
  identity: { tenantId: 'tenant', subjectId: 'user', roles: ['PROFILE_LIBRARY_READER'] },
  query: { text: 'Mona', language: 'ro' },
});

assert.deepEqual(resolved.contexts[0]?.minimalAuthorizedPayload, { name: 'Mona Fixture', phone: '+40 700 000 000' });
assert.equal(JSON.stringify(resolved).includes('must-not-cross-boundary'), false);
console.log('MINIMAL AUTHORIZED PAYLOAD ENFORCEMENT = PASS');
