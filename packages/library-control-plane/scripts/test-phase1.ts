import assert from 'node:assert/strict';
import {
  AgmGlobalLibraryAuthority,
  assertGenericFallbackAuthorized,
  createDomainOrchestrators,
  ExplicitLibraryAuthorizationPolicy,
  type AgmLibraryDomain,
  type AgmLibrarySourceId,
  type LibraryAuthorizationPort,
  type LibraryRequest,
  type LibraryResolver,
  type LibraryResolverResult,
} from '../src';

const NOW = '2026-09-19T12:00:00.000Z';
const request = (overrides: Partial<LibraryRequest> = {}): LibraryRequest => ({
  requestId: 'phase1-request',
  correlationId: 'phase1-correlation',
  surface: 'BROWSER',
  activeDomain: 'PROFILE',
  identity: { tenantId: 'tenant-1', subjectId: 'user-1', roles: ['PROFILE_LIBRARY_READER'] },
  query: { text: 'Sună-o pe Mona Vodafone.', language: 'ro', intentHints: ['CALL'], subjectHints: ['Mona Vodafone'] },
  ...overrides,
});

function result(status: LibraryResolverResult['status'], payload: Record<string, unknown> = {}): LibraryResolverResult {
  return {
    status,
    identity: { subjectType: 'PERSON', subjectId: status === 'NO_DATA' ? null : 'person:mona', displayName: 'Mona Vodafone' },
    query: { intent: 'CALL', normalizedText: 'suna mona vodafone' },
    result: { summary: status === 'FOUND' ? 'Contact personal găsit.' : status === 'NO_DATA' ? 'Nu există rezultat.' : 'Sunt necesare clarificări.', recordCount: status === 'NO_DATA' ? 0 : 1 },
    confidence: status === 'NO_DATA' ? 1 : 0.95,
    ambiguity: { ambiguous: status === 'AMBIGUOUS', candidateIds: status === 'AMBIGUOUS' ? ['person:mona-1', 'person:mona-2'] : [], ...(status === 'AMBIGUOUS' ? { clarificationPrompt: 'Pe care Mona?' } : {}) },
    provenance: { sourceRecordId: 'record:mona', owner: 'user-1', namespace: 'profile', evidenceRefs: ['fixture:phase1'] },
    freshness: { status: 'CURRENT', observedAt: NOW, expiresAt: null },
    minimalAuthorizedPayload: payload,
    deduplicationKey: 'person:mona',
  };
}

function resolver(input: {
  resolverId: string;
  source: AgmLibrarySourceId;
  domains: readonly AgmLibraryDomain[];
  status?: LibraryResolverResult['status'];
  payload?: Record<string, unknown>;
  onResolve?: () => void;
  confidence?: number;
}): LibraryResolver {
  return {
    descriptor: {
      resolverId: input.resolverId,
      source: input.source,
      owner: 'AGM',
      supportedDomains: input.domains,
      sensitivity: 'PERSONAL',
      authorizationAction: `library:read:${input.source.toLowerCase()}`,
    },
    match: () => ({ eligible: true, confidence: input.confidence ?? 0.9, intent: 'TEST_LOOKUP', subject: 'fixture' }),
    resolve: async () => {
      input.onResolve?.();
      return result(input.status ?? 'FOUND', input.payload ?? { name: 'Mona Vodafone' });
    },
  };
}

function authorityFor(rules: ConstructorParameters<typeof ExplicitLibraryAuthorizationPolicy>[0], setup: (orchestrators: ReturnType<typeof createDomainOrchestrators>) => void, authorization?: LibraryAuthorizationPort) {
  const orchestrators = createDomainOrchestrators();
  setup(orchestrators);
  return new AgmGlobalLibraryAuthority(orchestrators, authorization ?? new ExplicitLibraryAuthorizationPolicy(rules), undefined, () => NOW);
}

{
  const orchestrators = createDomainOrchestrators();
  const authority = new AgmGlobalLibraryAuthority(orchestrators, new ExplicitLibraryAuthorizationPolicy([]), undefined, () => NOW);
  assert.deepEqual(authority.registeredDomains(), ['BASIC', 'CAR_MOVER', 'PREMIUM', 'PROFILE']);
  assert.deepEqual(orchestrators.map((item) => item.id), ['agm.library.basic', 'agm.library.premium', 'agm.library.profile', 'agm.library.car-mover']);
}

{
  const events: string[] = [];
  const policy = new ExplicitLibraryAuthorizationPolicy([
    { role: 'PROFILE_LIBRARY_READER', domain: 'PROFILE', source: 'PROFILE_CONTACTS', allowedPayloadFields: ['name', 'phone'] },
  ]);
  const recordingPolicy: LibraryAuthorizationPort = {
    authorize: async (input) => { events.push('authorize'); return policy.authorize(input); },
  };
  const authority = authorityFor([], ([, , profile]) => profile.register(resolver({
    resolverId: 'profile.contacts', source: 'PROFILE_CONTACTS', domains: ['PROFILE'], payload: { name: 'Mona Vodafone', phone: '+40 700 000 000' }, onResolve: () => events.push('resolve'),
  })), recordingPolicy);
  const resolved = await authority.resolve(request());
  assert.equal(resolved.status, 'CONTEXT_READY');
  assert.deepEqual(events, ['authorize', 'resolve']);
  assert.equal(resolved.contexts.length, 1);
  assert.equal(resolved.contexts[0]?.minimalAuthorizedPayload.name, 'Mona Vodafone');
  assert.equal(resolved.dispatch.injectResolvedContext, true);
  assert.equal(resolved.dispatch.genericFallbackAllowed, false);
  assert.throws(() => assertGenericFallbackAuthorized(resolved), /GENERIC_FALLBACK_DENIED/);
  const authorizationStage = resolved.trace.findIndex((event) => event.stage === 'AUTHORIZATION_EVALUATED');
  const resolverStage = resolved.trace.findIndex((event) => event.stage === 'RESOLVER_CALLED');
  assert.ok(authorizationStage >= 0 && authorizationStage < resolverStage, 'authorization must precede retrieval');
}

{
  let deniedResolverCalls = 0;
  const authority = authorityFor([], ([, , profile]) => profile.register(resolver({
    resolverId: 'profile.denied', source: 'PROFILE_CONTACTS', domains: ['PROFILE'], onResolve: () => deniedResolverCalls += 1,
  })));
  const denied = await authority.resolve(request());
  assert.equal(denied.status, 'BLOCKED');
  assert.equal(deniedResolverCalls, 0);
  assert.equal(denied.authorizationDenials[0]?.reasonCode, 'DENY_BY_DEFAULT');
  assert.equal(denied.dispatch.assistantAllowed, false);
  assert.equal(denied.dispatch.genericFallbackAllowed, false);
}

{
  let noDataCalls = 0;
  const authority = authorityFor([
    { role: 'PROFILE_LIBRARY_READER', domain: 'PROFILE', source: 'PROFILE_CONTACTS', allowedPayloadFields: [] },
  ], ([, , profile]) => profile.register(resolver({
    resolverId: 'profile.empty', source: 'PROFILE_CONTACTS', domains: ['PROFILE'], status: 'NO_DATA', onResolve: () => noDataCalls += 1,
  })));
  const noData = await authority.resolve(request());
  assert.equal(noDataCalls, 1);
  assert.equal(noData.status, 'VERIFIED_NO_DATA');
  assert.equal(noData.dispatch.genericFallbackAllowed, true);
  assert.equal(assertGenericFallbackAuthorized(noData), noData);
}

{
  const authority = authorityFor([
    { role: 'PROFILE_LIBRARY_READER', domain: 'PROFILE', source: 'PROFILE_CONTACTS', allowedPayloadFields: ['name'] },
  ], ([, , profile]) => profile.register(resolver({
    resolverId: 'profile.ambiguous', source: 'PROFILE_CONTACTS', domains: ['PROFILE'], status: 'AMBIGUOUS',
  })));
  const ambiguous = await authority.resolve(request());
  assert.equal(ambiguous.status, 'CLARIFICATION_REQUIRED');
  assert.equal(ambiguous.dispatch.assistantAllowed, false);
  assert.equal(ambiguous.dispatch.genericFallbackAllowed, false);
}

{
  const rules = [
    { role: 'CROSS_DOMAIN_READER', domain: 'PREMIUM' as const, source: 'GMAIL' as const, allowedPayloadFields: ['subject'] },
    { role: 'CROSS_DOMAIN_READER', domain: 'CAR_MOVER' as const, source: 'GMAIL' as const, allowedPayloadFields: ['subject'] },
  ];
  const authority = authorityFor(rules, ([, premium, , carMover]) => {
    premium.register(resolver({ resolverId: 'premium.gmail', source: 'GMAIL', domains: ['PREMIUM'], payload: { subject: 'Transport confirmat' }, confidence: 0.95 }));
    carMover.register(resolver({ resolverId: 'car-mover.gmail', source: 'GMAIL', domains: ['CAR_MOVER'], payload: { subject: 'Transport actualizat' }, confidence: 0.8 }));
  });
  const crossDomain = await authority.resolve(request({
    surface: 'ANDROID', activeDomain: 'CAR_MOVER', requestedDomains: ['CAR_MOVER', 'PREMIUM'],
    identity: { tenantId: 'tenant-1', subjectId: 'user-1', roles: ['CROSS_DOMAIN_READER'] },
  }));
  assert.equal(crossDomain.status, 'CONTEXT_READY');
  assert.deepEqual(crossDomain.domains, ['CAR_MOVER', 'PREMIUM']);
  assert.equal(crossDomain.mandates.length, 2);
  assert.equal(crossDomain.contexts.length, 1, 'duplicate identity must produce one context');
  assert.equal(crossDomain.conflicts.length, 1, 'different payloads for one identity must be recorded as a conflict');
  assert.deepEqual(crossDomain.contexts[0]?.contributingSources, ['GMAIL']);
}

{
  const authority = new AgmGlobalLibraryAuthority(createDomainOrchestrators(), new ExplicitLibraryAuthorizationPolicy([]), undefined, () => NOW);
  const unresolvedOrigin = await authority.resolve(request({ surface: 'ANDROID', activeDomain: undefined, requestedDomains: undefined }));
  assert.equal(unresolvedOrigin.status, 'BLOCKED');
  assert.equal(unresolvedOrigin.dispatch.genericFallbackAllowed, false);
  const noRegisteredResolver = await authority.resolve(request({ surface: 'BASIC', activeDomain: undefined }));
  assert.equal(noRegisteredResolver.status, 'BLOCKED');
  assert.equal(noRegisteredResolver.dispatch.genericFallbackAllowed, false);
}

console.log('GLOBAL LIBRARY AUTHORITY = IMPLEMENTED');
console.log('4 DOMAIN ORCHESTRATORS = REGISTERED');
console.log('COMMON RESOLVER CONTRACT = PASS');
console.log('AUTHORIZATION BEFORE RETRIEVAL = PASS');
console.log('CROSS-DOMAIN MANDATES + DEDUPLICATION = PASS');
console.log('NO GENERIC ASSISTANT FALLBACK BEFORE LIBRARY RESOLUTION = PASS');
