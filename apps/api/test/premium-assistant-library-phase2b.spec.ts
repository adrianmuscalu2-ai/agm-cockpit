import { classifyGmailIntent } from '../src/premium-assistant/premium-assistant-gmail.service';
import {
  GMAIL_LIBRARY_RESOLVER_ID,
  HISTORY_LIBRARY_RESOLVER_ID,
  PremiumAssistantLibraryService,
  classifyConversationHistoryIntent,
  searchConversationHistory,
} from '../src/premium-assistant/premium-assistant-library.service';
import { PremiumAssistantService } from '../src/premium-assistant/premium-assistant.service';

const NOW = new Date('2026-09-19T12:00:00.000Z');
const user = { userId: 'user-1', companyId: 'tenant-1', roles: ['PREMIUM_ACCESS'], requestId: 'request-2b', correlationId: 'correlation-2b' };
const history = [
  { role: 'user' as const, text: 'Am discutat în Car Mover despre Clicktrans și oferta pentru ruta din Elveția.', occurredAt: '2026-09-18T08:00:00.000Z' },
  { role: 'assistant' as const, text: 'Am stabilit un tarif de 950 EUR și încărcare vineri.', occurredAt: '2026-09-18T08:00:10.000Z' },
  { role: 'user' as const, text: 'Mona gestionează documentele pentru client.', occurredAt: '2026-09-19T09:00:00.000Z' },
  { role: 'assistant' as const, text: 'Am notat responsabilitatea Monei pentru CMR.', occurredAt: '2026-09-19T09:00:10.000Z' },
];

const source = {
  sourceId: 'GMAIL-source-hash', title: 'Răspuns ofertă', origin: 'Clicktrans <office@clicktrans.example>',
  urlOrIdentifier: 'gmail:message:private-id', timestamp: '2026-09-19T10:00:00.000Z', domain: ['GMAIL_INBOX'], language: 'ro', confidence: 1,
  originType: 'GMAIL' as const, retrievalType: 'LIVE' as const,
  freshness: { status: 'CURRENT' as const, checkedAt: NOW.toISOString(), expiresAt: '2026-09-19T12:05:00.000Z', ttlSeconds: 300 },
  provenance: { canonicalPath: null, sha256: null, authorityType: 'AUTHENTICATED_PRIVATE_MAILBOX', reviewStatus: 'LIVE_PROVIDER_OBSERVATION' },
};

function approvedGuardian() {
  return { evaluate: jest.fn(async () => ({
    decision: 'APPROVED', authorityGranted: true, reasonCode: 'ALLOWLIST_AND_AUTHORITY_VERIFIED',
    evidenceId: 'guardian-2b', correlationId: 'guardian-correlation-2b',
  })) };
}

function gmailFixture() {
  return {
    configured: () => true,
    retrieve: jest.fn(async (text: string) => ({
      intent: classifyGmailIntent(text)!,
      messages: [{
        id: 'private-id', threadId: 'private-thread', from: 'Clicktrans <office@clicktrans.example>', to: 'agm@example.test',
        subject: 'Răspuns ofertă', bodyText: 'Clicktrans a confirmat oferta și intervalul de încărcare.', occurredAt: '2026-09-19T10:00:00.000Z', attachments: [],
      }],
      sources: [source], actionContext: null,
    })),
  };
}

function request(confirmedText: string, requestHistory = history) {
  return { productId: 'agm-cockpit' as const, moduleId: 'premium-cockpit', language: 'ro' as const, confirmedText, surface: 'BROWSER' as const, history: requestHistory };
}

describe('Phase 2B semantic Gmail resolution', () => {
  it.each([
    'Citește ultimul email de la Clicktrans.',
    'Ce mi-a scris Clicktrans?',
    'Ai ceva nou de la Clicktrans?',
    'Mi-a răspuns Clicktrans?',
    'Poți verifica dacă mi-a răspuns Clicktrans?',
    'Verifică emailurile de la Clicktrans.',
  ])('maps semantic formulation through one Gmail intent resolver: %s', (text) => {
    const intent = classifyGmailIntent(text);
    expect(intent).not.toBeNull();
    expect(intent?.gmailQuery).toContain('clicktrans');
  });

  it('keeps outbound mail and unrelated public questions out of Gmail retrieval', () => {
    expect(classifyGmailIntent('Trimite un email către Clicktrans.')).toBeNull();
    expect(classifyGmailIntent('Care este vremea în Zürich?')).toBeNull();
  });
});

describe('Phase 2B conversation history resolver', () => {
  it.each([
    ['Ce am discutat ultima dată despre Clicktrans?', 'Clicktrans'],
    ['Ce am stabilit despre Mona?', 'Mona'],
    ['Ce am spus ieri despre Car Mover?', 'Car Mover'],
    ['Când am discutat despre transportul din Elveția?', 'Elveția'],
    ['Ce informații avem deja despre problema Clicktrans?', 'Clicktrans'],
  ])('classifies and retrieves by subject/entity/time/relevance: %s', (text, expected) => {
    expect(classifyConversationHistoryIntent(text).eligible).toBe(true);
    const found = searchConversationHistory(text, history, NOW);
    expect(found.length).toBeGreaterThan(0);
    expect(found.map((item) => item.turn.text).join(' ')).toContain(expected);
  });

  it('returns no data for a missing subject and does not dump the full session', () => {
    expect(searchConversationHistory('Ce am discutat despre Rotterdam?', history, NOW)).toEqual([]);
    const found = searchConversationHistory('Ce am discutat despre Clicktrans?', [...history, ...history, ...history], NOW);
    expect(found.length).toBeLessThanOrEqual(4);
  });

  it('returns only the newest relevant exchange for an explicit last-time query', () => {
    const repeated = [...history, { role: 'user' as const, text: 'Am discutat din nou despre Clicktrans.', occurredAt: '2026-09-19T10:00:00.000Z' }, { role: 'assistant' as const, text: 'Am actualizat oferta Clicktrans la 975 EUR.', occurredAt: '2026-09-19T10:00:10.000Z' }];
    const found = searchConversationHistory('Ce am discutat ultima dată despre Clicktrans?', repeated, NOW);
    expect(found).toHaveLength(2);
    expect(found.map((item) => item.turn.text).join(' ')).toContain('975 EUR');
    expect(found.map((item) => item.turn.text).join(' ')).not.toContain('950 EUR');
  });
});

describe('Phase 2B Global Library Authority integration', () => {
  it('issues one Premium mandate for Gmail and history, authorizes before retrieval, and merges two contexts', async () => {
    const gmail = gmailFixture();
    const guardian = approvedGuardian();
    const service = new PremiumAssistantLibraryService(gmail as never, guardian as never, undefined, () => NOW);
    const resolved = await service.resolve(user, request('Ce am discutat despre Clicktrans și verifică dacă mi-au scris între timp.'));

    expect(resolved.status).toBe('CONTEXT_READY');
    expect(resolved.mandates).toHaveLength(1);
    expect(resolved.mandates[0]?.authorizedResolvers.map((item) => item.resolverId).sort()).toEqual([GMAIL_LIBRARY_RESOLVER_ID, HISTORY_LIBRARY_RESOLVER_ID].sort());
    expect(resolved.contexts).toHaveLength(2);
    expect(resolved.contexts.flatMap((context) => context.contributingSources).sort()).toEqual(['CONVERSATION_HISTORY', 'GMAIL']);
    for (const resolverId of [GMAIL_LIBRARY_RESOLVER_ID, HISTORY_LIBRARY_RESOLVER_ID]) {
      const authorization = resolved.trace.findIndex((event) => event.stage === 'AUTHORIZATION_EVALUATED' && event.resolverId === resolverId);
      const retrieval = resolved.trace.findIndex((event) => event.stage === 'RESOLVER_CALLED' && event.resolverId === resolverId);
      expect(authorization).toBeGreaterThanOrEqual(0);
      expect(authorization).toBeLessThan(retrieval);
    }
    const historyPayload = resolved.contexts.find((context) => context.contributingSources.includes('CONVERSATION_HISTORY'))?.minimalAuthorizedPayload;
    expect(historyPayload?.turns).toHaveLength(2);
    expect(JSON.stringify(historyPayload)).not.toContain('Mona gestionează');
    expect(gmail.retrieve).toHaveBeenCalledTimes(1);
  });

  it('produces one local cross-domain answer and never calls generic Assistant or web', async () => {
    const providerFetch = jest.spyOn(global, 'fetch');
    const gmail = gmailFixture();
    const knowledge = { createTrace: jest.fn((sources, status) => ({ traceId: 'phase-2b-trace', status, generatedAt: NOW.toISOString(), counts: { total: sources.length, library: 1, live: 1, cache: 0 }, sources })) };
    const service = new PremiumAssistantService({ get: () => 'unused-key' } as never, undefined, knowledge as never, gmail as never, approvedGuardian() as never);
    const result = await service.respond(user, request('Ce am discutat despre Clicktrans și verifică dacă mi-au scris între timp.'));

    expect(result).toMatchObject({ provider: 'agm', toolTrace: { tool: 'gmail-inbox', status: 'SUCCESS', resultCount: 1 }, externalEffectPerformed: false });
    expect(result.text).toContain('950 EUR');
    expect(result.text.toLowerCase()).toContain('clicktrans a confirmat oferta');
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('reaches VERIFIED_NO_DATA only after the eligible history resolver ran', async () => {
    const service = new PremiumAssistantLibraryService(undefined, undefined, undefined, () => NOW);
    const resolved = await service.resolve(user, request('Ce am discutat despre Rotterdam?', []));
    expect(resolved.status).toBe('VERIFIED_NO_DATA');
    expect(resolved.verifiedNoData).toEqual([expect.objectContaining({ resolverId: HISTORY_LIBRARY_RESOLVER_ID, source: 'CONVERSATION_HISTORY' })]);
    expect(resolved.trace).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'RESOLVER_CALLED', resolverId: HISTORY_LIBRARY_RESOLVER_ID }),
      expect.objectContaining({ stage: 'DISPATCH_DECIDED', outcome: 'VERIFIED_NO_DATA' }),
    ]));
  });

  it('keeps a Gmail failure visible when history was found and never falls back to web', async () => {
    const providerFetch = jest.spyOn(global, 'fetch');
    const gmail = gmailFixture();
    gmail.retrieve.mockRejectedValueOnce(new Error('provider unavailable'));
    const service = new PremiumAssistantService({ get: () => 'unused-key' } as never, undefined, undefined, gmail as never, approvedGuardian() as never);
    const result = await service.respond(user, request('Ce am discutat despre Clicktrans și verifică dacă mi-au scris între timp.'));
    expect(result.toolTrace).toMatchObject({ status: 'UNAVAILABLE', resultCount: 0, errorCode: 'API_FAILED' });
    expect(result.text).toContain('950 EUR');
    expect(result.text).toContain('Gmail nu este disponibil');
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('reports Gmail verified no-data alongside the recovered history in one response', async () => {
    const providerFetch = jest.spyOn(global, 'fetch');
    const gmail = gmailFixture();
    gmail.retrieve.mockImplementationOnce(async (text: string) => ({ intent: classifyGmailIntent(text)!, messages: [], sources: [], actionContext: null }));
    const service = new PremiumAssistantService({ get: () => 'unused-key' } as never, undefined, undefined, gmail as never, approvedGuardian() as never);
    const result = await service.respond(user, request('Ce am discutat despre Clicktrans și verifică dacă mi-au scris între timp.'));
    expect(result.toolTrace).toMatchObject({ status: 'SUCCESS', resultCount: 0, errorCode: null });
    expect(result.text).toContain('950 EUR');
    expect(result.text).toContain('nu am găsit niciun mesaj');
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('does not call Gmail when Guardian denies authorization', async () => {
    const gmail = gmailFixture();
    const guardian = { evaluate: jest.fn(async () => ({ decision: 'DENIED', authorityGranted: false, reasonCode: 'PERMISSION_DENIED', evidenceId: 'deny-evidence', correlationId: 'deny-correlation' })) };
    const service = new PremiumAssistantLibraryService(gmail as never, guardian as never, undefined, () => NOW);
    const resolved = await service.resolve(user, request('Ce mi-a scris Clicktrans?'));
    expect(resolved.status).toBe('BLOCKED');
    expect(resolved.authorizationDenials).toEqual([expect.objectContaining({ resolverId: GMAIL_LIBRARY_RESOLVER_ID, reasonCode: 'PERMISSION_DENIED' })]);
    expect(gmail.retrieve).not.toHaveBeenCalled();
  });

  it('reports an unconfigured Gmail resolver without mislabeling it as a Guardian denial', async () => {
    const gmail = { configured: () => false, retrieve: jest.fn() };
    const service = new PremiumAssistantService({ get: () => 'unused-key' } as never, undefined, undefined, gmail as never, approvedGuardian() as never);
    const result = await service.respond(user, request('Ce mi-a scris Clicktrans?'));
    expect(result.toolTrace).toMatchObject({ status: 'UNAVAILABLE', errorCode: 'GMAIL_NOT_CONFIGURED' });
    expect(result.text).toContain('Gmail nu este disponibil');
    expect(result.text).not.toContain('Permission Guardian');
    expect(gmail.retrieve).not.toHaveBeenCalled();
  });
});
