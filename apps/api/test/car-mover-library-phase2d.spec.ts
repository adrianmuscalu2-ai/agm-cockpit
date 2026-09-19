import {
  AGM_LIBRARY_CONTROL_PLANE_VERSION,
  type AgmLibrarySourceId,
  type ResolvedContextPackage,
} from '@agm/library-control-plane';
import { GMAIL_LIBRARY_RESOLVER_ID } from '../src/premium-assistant/premium-assistant-library.service';
import { PremiumAssistantGmailService } from '../src/premium-assistant/premium-assistant-gmail.service';
import { SHARED_ARCHIVE_RESOLVER_ID } from '../src/premium-assistant/shared-archive-library.resolver';
import { PermissionGuardianService } from '../src/permission-guardian/permission-guardian.service';
import { SharedArchiveService } from '../src/shared-archive/shared-archive.service';
import { TranslationService } from '../src/translation/translation.service';
import {
  CAR_MOVER_LIBRARY_RESOLVERS,
  classifyCarMoverSources,
  planCarMoverDomains,
} from '../src/car-mover/car-mover-library.resolvers';
import {
  PrismaCarMoverLibraryRepository,
  type CarMoverLibraryRecord,
  type CarMoverLibraryRepositoryPort,
} from '../src/car-mover/car-mover-library.repository';
import { CarMoverLibraryService } from '../src/car-mover/car-mover-library.service';

const NOW = '2026-09-19T12:00:00.000Z';
const user = {
  userId: 'user-2d',
  companyId: 'tenant-2d',
  roles: ['PREMIUM_ACCESS'],
  requestId: 'request-2d',
  correlationId: 'correlation-2d',
};
const history = [
  {
    role: 'user' as const,
    text: 'Am discutat despre oferta pentru ruta Basel - București și clientul Clicktrans.',
    occurredAt: '2026-09-18T10:00:00.000Z',
  },
  {
    role: 'assistant' as const,
    text: 'Am stabilit 950 EUR pentru transport și încărcare vineri.',
    occurredAt: '2026-09-18T10:00:10.000Z',
  },
];

class MemoryCarMoverRepository implements CarMoverLibraryRepositoryPort {
  readonly search = jest.fn(async (source: AgmLibrarySourceId): Promise<readonly CarMoverLibraryRecord[]> => {
    const value = this.records.get(source);
    return value === undefined ? [record(source)] : value;
  });

  constructor(private readonly records = new Map<AgmLibrarySourceId, readonly CarMoverLibraryRecord[]>()) {}
}

function record(source: AgmLibrarySourceId, overrides: Partial<CarMoverLibraryRecord> = {}): CarMoverLibraryRecord {
  return {
    id: `${source.toLowerCase()}-1`,
    entityType: source,
    title: `${source} Clicktrans Basel București`,
    summary: 'Date operaționale autorizate pentru transport.',
    observedAt: NOW,
    payload: { recordId: `${source.toLowerCase()}-1`, amount: '950', currencyCode: 'EUR' },
    deduplicationKey: `${source.toLowerCase()}:1`,
    confidence: 0.96,
    ...overrides,
  };
}

function gmailFixture() {
  return {
    configured: () => true,
    retrieve: jest.fn(async () => ({
      intent: { operation: 'SEARCH' as const, gmailQuery: 'Clicktrans', requestedLanguage: 'ro' },
      messages: [{
        id: 'gmail-message-1',
        threadId: 'gmail-thread-1',
        from: 'Clicktrans <office@clicktrans.example>',
        to: 'agm@example.test',
        subject: 'Transport mașină',
        bodyText: 'Clicktrans a confirmat transportul mașinii.',
        occurredAt: NOW,
        attachments: [],
      }],
      sources: [{
        sourceId: 'GMAIL-redacted-id',
        title: 'Transport mașină',
        origin: 'Clicktrans <office@clicktrans.example>',
        urlOrIdentifier: 'gmail:message:redacted',
        timestamp: NOW,
        domain: ['GMAIL_INBOX'],
        language: 'ro',
        confidence: 1,
        originType: 'GMAIL' as const,
        retrievalType: 'LIVE' as const,
        freshness: { status: 'CURRENT' as const, checkedAt: NOW, expiresAt: null, ttlSeconds: 300 },
        provenance: {
          canonicalPath: null,
          sha256: null,
          authorityType: 'AUTHENTICATED_PRIVATE_MAILBOX',
          reviewStatus: 'LIVE_PROVIDER_OBSERVATION',
        },
      }],
      actionContext: null,
    })),
  };
}

function approvedGuardian() {
  return {
    evaluate: jest.fn(async () => ({
      decision: 'APPROVED',
      authorityGranted: true,
      reasonCode: 'ALLOWLIST_AND_AUTHORITY_VERIFIED',
      evidenceId: 'guardian-2d',
      correlationId: 'guardian-correlation-2d',
    })),
  };
}

function archiveFixture(records: unknown[] = [archiveRecord()]) {
  return { query: jest.fn(async () => records) };
}

function archiveRecord() {
  return {
    id: 'archive-transport-1',
    category: 'OTHER',
    namespace: 'agm.shared.user-approved',
    title: 'Ofertă similară Clicktrans',
    payload: { summary: 'Ofertă anterioară Basel - București: 950 EUR.' },
    syncPolicy: 'SYNC_ALLOWED',
    persistence: 'USER_APPROVED_PERSISTENT',
    sourceSurface: 'ANDROID',
    observedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    revokedAt: null,
    deletedAt: null,
    provenance: {
      ownerUserId: user.userId,
      namespace: 'agm.shared.user-approved',
      contractVersion: 'phase2c',
      approvalEvidence: 'USER_ARCHIVE_ACTION',
    },
  };
}

function profilePackage(): ResolvedContextPackage {
  return {
    contractVersion: AGM_LIBRARY_CONTROL_PLANE_VERSION,
    requestId: 'profile-phase2a',
    correlationId: 'profile-correlation',
    status: 'CONTEXT_READY',
    domains: ['PROFILE'],
    mandates: [],
    contexts: [{
      contextId: 'profile-contact:mona',
      identity: { subjectType: 'PROFILE_PERSON', subjectId: 'contact-mona', displayName: 'Mona Vodafone' },
      summary: 'CONTACT_RESOLVED',
      confidence: 1,
      provenance: [{
        sourceRecordId: 'contact-mona',
        owner: user.userId,
        namespace: 'AGM_SHARED_PROFILE/contacts',
        evidenceRefs: ['phase2a'],
      }],
      freshness: { status: 'CURRENT', observedAt: NOW, expiresAt: null },
      minimalAuthorizedPayload: {
        contactCommand: {
          status: 'READY',
          contact: { id: 'contact-mona', name: 'Mona Vodafone', phone: '+40700000000', email: 'mona@example.test' },
        },
      },
      contributingSources: ['PROFILE_CONTACTS'],
    }],
    verifiedNoData: [],
    clarifications: [],
    conflicts: [],
    authorizationDenials: [],
    failures: [],
    dispatch: {
      assistantAllowed: true,
      injectResolvedContext: true,
      genericFallbackAllowed: false,
      reason: 'RESOLVED_CONTEXT_REQUIRED',
    },
    trace: [],
  };
}

function dto(query: string, overrides: Record<string, unknown> = {}) {
  return {
    query,
    language: 'ro',
    surface: 'BROWSER' as const,
    history,
    ...overrides,
  };
}

describe('Phase 2D Car Mover source planning', () => {
  it.each([
    ['transporturi anterioare', 'CAR_MOVER_TRANSPORTS'],
    ['oferte similare', 'CAR_MOVER_OFFERS'],
    ['clientul Clicktrans', 'CAR_MOVER_CLIENTS'],
    ['mașina cu VIN X', 'CAR_MOVER_VEHICLES'],
    ['ruta Basel București', 'CAR_MOVER_TRIP_HISTORY'],
    ['platforma Clicktrans', 'CAR_MOVER_PLATFORMS'],
    ['costuri transport', 'CAR_MOVER_COSTS'],
    ['tarif transport', 'CAR_MOVER_RATES'],
    ['kilometri goi pentru ofertă', 'CAR_MOVER_EMPTY_KILOMETRES'],
    ['document CMR', 'CAR_MOVER_DOCUMENTS'],
  ])('maps %s to the real source %s', (query, source) => {
    expect(classifyCarMoverSources(query)).toContain(source);
  });

  it('plans shared domains only when the request issues their mandate', () => {
    expect(planCarMoverDomains('Arată transporturile recente.')).toEqual({
      domains: ['CAR_MOVER'],
      intentHints: [],
    });
    expect(planCarMoverDomains('Ce am discutat despre client și verifică emailurile și contactele?')).toEqual({
      domains: ['CAR_MOVER', 'BASIC', 'PREMIUM', 'PROFILE'],
      intentHints: ['CONVERSATION_HISTORY', 'GMAIL', 'PROFILE_CONTACTS'],
    });
  });
});

describe('Phase 2D Global Library Authority integration', () => {
  it.each([
    ['Am mai transportat ceva pentru clientul acesta?', ['CONVERSATION_HISTORY'], false],
    ['Ce am cerut ultima dată pe ruta asta?', ['AGM_SHARED_ARCHIVE'], true],
    ['Compară transportul acesta cu ofertele similare pe care le-am făcut anterior.', ['CONVERSATION_HISTORY', 'AGM_SHARED_ARCHIVE'], true],
  ])('merges the required domains through one package: %s', async (query, expectedSources, archiveExpected) => {
    const repository = new MemoryCarMoverRepository();
    const archive = archiveFixture();
    const service = new CarMoverLibraryService(repository as never, undefined, undefined, undefined, archive as never);
    const resolved = await service.resolve(user, dto(query));

    expect(resolved.status).toBe('CONTEXT_READY');
    expect(resolved.domains).toEqual(['CAR_MOVER', 'BASIC']);
    expect(resolved.contexts.flatMap((context) => context.contributingSources)).toEqual(expect.arrayContaining(expectedSources));
    expect(resolved.mandates).toHaveLength(2);
    expect(resolved.dispatch).toMatchObject({ injectResolvedContext: true, genericFallbackAllowed: false });
    if (archiveExpected) expect(archive.query).toHaveBeenCalled();
    else expect(resolved.contexts.flatMap((context) => context.contributingSources)).not.toContain('AGM_SHARED_ARCHIVE');
    for (const mandate of resolved.mandates) {
      for (const authorized of mandate.authorizedResolvers) {
        const authorizationIndex = resolved.trace.findIndex((event) =>
          event.stage === 'AUTHORIZATION_EVALUATED' && event.resolverId === authorized.resolverId);
        const retrievalIndex = resolved.trace.findIndex((event) =>
          event.stage === 'RESOLVER_CALLED' && event.resolverId === authorized.resolverId);
        expect(authorizationIndex).toBeGreaterThanOrEqual(0);
        expect(authorizationIndex).toBeLessThan(retrievalIndex);
      }
    }
  });

  it.each([
    ['Verifică și emailurile dacă avem informații despre mașina asta.', 'CAR_MOVER_VEHICLES'],
    ['Avem vreun email de la client despre transportul acesta?', 'CAR_MOVER_TRANSPORTS'],
  ])('uses the existing Phase 2B Gmail resolver with Car Mover data: %s', async (query, expectedSource) => {
    const repository = new MemoryCarMoverRepository();
    const gmail = gmailFixture();
    const guardian = approvedGuardian();
    const service = new CarMoverLibraryService(repository as never, gmail as never, guardian as never);
    const resolved = await service.resolve(user, dto(query));

    expect(resolved.status).toBe('CONTEXT_READY');
    expect(resolved.domains).toEqual(['CAR_MOVER', 'PREMIUM']);
    expect(resolved.mandates.flatMap((mandate) => mandate.authorizedResolvers.map((item) => item.resolverId)))
      .toContain(GMAIL_LIBRARY_RESOLVER_ID);
    expect(resolved.contexts.flatMap((context) => context.contributingSources))
      .toEqual(expect.arrayContaining([expectedSource, 'GMAIL']));
    expect(gmail.retrieve).toHaveBeenCalledTimes(1);
    expect(guardian.evaluate).toHaveBeenCalledTimes(1);
  });

  it('bridges the already-authorized Phase 2A Profile package without duplicating the contact store', async () => {
    const repository = new MemoryCarMoverRepository();
    const service = new CarMoverLibraryService(repository as never);
    const resolved = await service.resolve(user, dto(
      'Ce știm despre clientul acesta și ce contacte avem?',
      { profileContext: profilePackage() },
    ));

    expect(resolved.status).toBe('CONTEXT_READY');
    expect(resolved.domains).toEqual(['CAR_MOVER', 'PROFILE']);
    expect(resolved.mandates.flatMap((mandate) => mandate.authorizedResolvers.map((item) => item.resolverId)))
      .toContain(CAR_MOVER_LIBRARY_RESOLVERS.profileBridge);
    const profile = resolved.contexts.find((context) => context.contributingSources.includes('PROFILE_CONTACTS'));
    expect(profile?.minimalAuthorizedPayload).toEqual(profilePackage().contexts[0]?.minimalAuthorizedPayload);
  });

  it('uses a proven Phase 2A name-first result even when the utterance contains only the known name', async () => {
    const repository = new MemoryCarMoverRepository();
    const service = new CarMoverLibraryService(repository as never);
    const resolved = await service.resolve(user, dto('Mona Vodafone', { profileContext: profilePackage() }));

    expect(resolved.domains).toEqual(['CAR_MOVER', 'PROFILE']);
    expect(resolved.contexts.flatMap((context) => context.contributingSources)).toContain('PROFILE_CONTACTS');
    expect(resolved.dispatch).toMatchObject({ injectResolvedContext: true, genericFallbackAllowed: false });
  });

  it('issues one full Car Mover + Basic + Premium + Profile cross-domain package', async () => {
    const repository = new MemoryCarMoverRepository();
    const gmail = gmailFixture();
    const guardian = approvedGuardian();
    const archive = archiveFixture();
    const service = new CarMoverLibraryService(repository as never, gmail as never, guardian as never, undefined, archive as never);
    const resolved = await service.resolve(user, dto(
      'Ce am discutat anterior despre client și verifică emailurile, contactele și arhiva?',
      { profileContext: profilePackage() },
    ));

    expect(resolved.status).toBe('CONTEXT_READY');
    expect(resolved.domains).toEqual(['CAR_MOVER', 'BASIC', 'PREMIUM', 'PROFILE']);
    expect(resolved.mandates.map((mandate) => mandate.domain)).toEqual(['CAR_MOVER', 'BASIC', 'PREMIUM', 'PROFILE']);
    expect(resolved.contexts.flatMap((context) => context.contributingSources)).toEqual(expect.arrayContaining([
      'CAR_MOVER_CLIENTS',
      'CONVERSATION_HISTORY',
      'AGM_SHARED_ARCHIVE',
      'GMAIL',
      'PROFILE_CONTACTS',
    ]));
    expect(resolved.dispatch).toMatchObject({
      assistantAllowed: true,
      injectResolvedContext: true,
      genericFallbackAllowed: false,
    });
  });

  it('deduplicates conflicting records and selects current provenance over stale provenance', async () => {
    const sharedKey = 'business-entity:clicktrans';
    const repository = new MemoryCarMoverRepository(new Map([
      ['CAR_MOVER_TRANSPORTS', [record('CAR_MOVER_TRANSPORTS', {
        observedAt: '2026-01-01T00:00:00.000Z',
        deduplicationKey: sharedKey,
        payload: { amount: '900' },
      })]],
      ['CAR_MOVER_CLIENTS', [record('CAR_MOVER_CLIENTS', {
        observedAt: new Date().toISOString(),
        deduplicationKey: sharedKey,
        payload: { amount: '950' },
      })]],
    ]));
    const service = new CarMoverLibraryService(repository as never);
    const resolved = await service.resolve(user, dto('transporturi pentru clientul acesta'));

    expect(resolved.status).toBe('CONTEXT_READY');
    expect(resolved.contexts).toHaveLength(1);
    expect(resolved.contexts[0]).toMatchObject({
      contextId: sharedKey,
      freshness: { status: 'CURRENT' },
      minimalAuthorizedPayload: { records: [expect.objectContaining({ payload: { amount: '950' } })] },
    });
    expect(resolved.contexts[0]?.provenance).toHaveLength(2);
    expect(resolved.conflicts).toEqual([expect.objectContaining({
      deduplicationKey: sharedKey,
      selectedResolverId: CAR_MOVER_LIBRARY_RESOLVERS.client,
      rejectedResolverIds: [CAR_MOVER_LIBRARY_RESOLVERS.transport],
    })]);
  });

  it('injects only minimal authorized payloads', async () => {
    const repository = new MemoryCarMoverRepository();
    const service = new CarMoverLibraryService(repository as never);
    const resolved = await service.resolve(user, dto('Arată costurile și tarifele transportului.'));
    const serialized = JSON.stringify(resolved.contexts.map((context) => context.minimalAuthorizedPayload));

    expect(serialized).toContain('recordId');
    expect(serialized).not.toContain('rawMessageSha256');
    expect(serialized).not.toContain('analysis');
    expect(serialized).not.toContain('createdByUserId');
    expect(serialized).not.toContain('accessToken');
  });
});

describe('Phase 2D negative controls and fallback', () => {
  it('does not call Gmail, Profile, history or archive without an issued mandate', async () => {
    const repository = new MemoryCarMoverRepository();
    const gmail = gmailFixture();
    const archive = archiveFixture();
    const service = new CarMoverLibraryService(repository as never, gmail as never, approvedGuardian() as never, undefined, archive as never);
    const resolved = await service.resolve(user, dto('Arată transporturile recente.'));

    expect(resolved.domains).toEqual(['CAR_MOVER']);
    expect(resolved.mandates).toHaveLength(1);
    expect(gmail.retrieve).not.toHaveBeenCalled();
    expect(archive.query).not.toHaveBeenCalled();
    expect(resolved.mandates[0]?.authorizedResolvers.map((item) => item.resolverId)).not.toContain(CAR_MOVER_LIBRARY_RESOLVERS.profileBridge);
  });

  it('does not read Car Mover data without premium authority', async () => {
    const repository = new MemoryCarMoverRepository();
    const service = new CarMoverLibraryService(repository as never);
    const resolved = await service.resolve({ ...user, roles: [] }, dto('Arată transporturile clientului Clicktrans.'));

    expect(resolved.status).toBe('BLOCKED');
    expect(resolved.authorizationDenials.map((item) => item.resolverId)).toEqual(expect.arrayContaining([
      CAR_MOVER_LIBRARY_RESOLVERS.transport,
      CAR_MOVER_LIBRARY_RESOLVERS.client,
      CAR_MOVER_LIBRARY_RESOLVERS.platform,
    ]));
    expect(resolved.authorizationDenials.every((item) => item.reasonCode === 'PREMIUM_ENTITLEMENT_REQUIRED')).toBe(true);
    expect(repository.search).not.toHaveBeenCalled();
    expect(resolved.dispatch.genericFallbackAllowed).toBe(false);
  });

  it('does not substitute Car Mover context for a denied Gmail mandate', async () => {
    const repository = new MemoryCarMoverRepository();
    const gmail = gmailFixture();
    const guardian = {
      evaluate: jest.fn(async () => ({
        decision: 'DENIED',
        authorityGranted: false,
        reasonCode: 'PERMISSION_DENIED',
        evidenceId: 'guardian-denied',
        correlationId: 'guardian-denied-correlation',
      })),
    };
    const service = new CarMoverLibraryService(repository as never, gmail as never, guardian as never);
    const resolved = await service.resolve(user, dto('Verifică emailurile despre mașina asta.'));

    expect(resolved.status).toBe('BLOCKED');
    expect(resolved.authorizationDenials).toEqual([
      expect.objectContaining({ resolverId: GMAIL_LIBRARY_RESOLVER_ID, reasonCode: 'PERMISSION_DENIED' }),
    ]);
    expect(gmail.retrieve).not.toHaveBeenCalled();
    expect(resolved.dispatch.genericFallbackAllowed).toBe(false);
  });

  it('requires a Phase 2A authorization package before Profile retrieval', async () => {
    const repository = new MemoryCarMoverRepository();
    const service = new CarMoverLibraryService(repository as never);
    const resolved = await service.resolve(user, dto('Ce știm despre client și ce contacte avem?'));

    expect(resolved.status).toBe('BLOCKED');
    expect(resolved.authorizationDenials).toEqual([
      expect.objectContaining({
        resolverId: CAR_MOVER_LIBRARY_RESOLVERS.profileBridge,
        reasonCode: 'PROFILE_CONTEXT_MANDATE_NOT_PROVEN',
      }),
    ]);
    expect(resolved.contexts.flatMap((context) => context.contributingSources)).not.toContain('PROFILE_CONTACTS');
    expect(resolved.dispatch.genericFallbackAllowed).toBe(false);
  });

  it('allows generic fallback only after every eligible resolver returned verified no-data', async () => {
    const emptySources = new Map<AgmLibrarySourceId, readonly CarMoverLibraryRecord[]>();
    for (const source of classifyCarMoverSources('Ce am cerut ultima dată pe ruta asta?')) emptySources.set(source, []);
    const repository = new MemoryCarMoverRepository(emptySources);
    const archive = archiveFixture([]);
    const service = new CarMoverLibraryService(repository as never, undefined, undefined, undefined, archive as never);
    const resolved = await service.resolve(user, dto('Ce am cerut ultima dată pe ruta asta?', { history: [] }));

    expect(resolved.status).toBe('VERIFIED_NO_DATA');
    expect(resolved.verifiedNoData.map((item) => item.resolverId)).toEqual(expect.arrayContaining([
      CAR_MOVER_LIBRARY_RESOLVERS.quote,
      CAR_MOVER_LIBRARY_RESOLVERS.route,
      SHARED_ARCHIVE_RESOLVER_ID,
    ]));
    expect(resolved.dispatch).toMatchObject({
      assistantAllowed: true,
      injectResolvedContext: false,
      genericFallbackAllowed: true,
      reason: 'VERIFIED_NO_DATA',
    });
    expect(resolved.trace.at(-1)).toMatchObject({ stage: 'DISPATCH_DECIDED', outcome: 'VERIFIED_NO_DATA' });
  });
});

describe('Phase 2D Prisma source adapters', () => {
  it('reads empty kilometres from the tenant-scoped operational cost assessment model', async () => {
    const findMany = jest.fn(async () => [{
      id: 'assessment-1',
      costAssessmentId: 'cost-1',
      opportunityId: 'opportunity-1',
      emptyKm: 82,
      estimatedTotalCost: { toString: () => '420.00' },
      currencyCode: 'EUR',
      financialRisk: 'MEDIUM',
      calculatedAt: new Date(NOW),
    }]);
    const repository = new PrismaCarMoverLibraryRepository({
      opportunityCostAssessment: { findMany },
    } as never);
    const result = await repository.search('CAR_MOVER_EMPTY_KILOMETRES', 'kilometri goi', user);

    expect(findMany).toHaveBeenCalledWith({
      where: { companyId: user.companyId },
      orderBy: { calculatedAt: 'desc' },
      take: 100,
    });
    expect(result).toEqual([
      expect.objectContaining({
        entityType: 'EMPTY_KILOMETRES',
        payload: expect.objectContaining({ emptyKm: 82, estimatedTotalCost: '420.00' }),
      }),
    ]);
  });
});

describe('Phase 2D Nest runtime wiring', () => {
  it('preserves concrete injection tokens for every reused Phase 2A/2B/2C dependency', () => {
    expect(Reflect.getMetadata('design:paramtypes', CarMoverLibraryService)).toEqual([
      PrismaCarMoverLibraryRepository,
      PremiumAssistantGmailService,
      PermissionGuardianService,
      TranslationService,
      SharedArchiveService,
    ]);
  });
});
