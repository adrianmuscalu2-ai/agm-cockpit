import { ConfigService } from '@nestjs/config';
import { GmailCommunicationProvider, GmailProviderError } from '../src/communications/providers/gmail.provider';
import { classifyGmailIntent, composeGmailAnswer, composeGmailAnswerForUser, detectGmailContentLanguage } from '../src/premium-assistant/premium-assistant-gmail.service';
import { PremiumAssistantService } from '../src/premium-assistant/premium-assistant.service';

const user = { userId: 'user-1', companyId: 'tenant-1', roles: ['PREMIUM_ACCESS'], requestId: 'request-1', correlationId: 'correlation-1' };
const request = { productId: 'agm-cockpit' as const, moduleId: 'premium-cockpit', language: 'ro', confirmedText: 'Citește ultimul mesaj de la Onlogist', history: [] };
const message = {
  id: 'gmail-message-private-id', threadId: 'gmail-thread-private-id', from: 'Onlogist Dispatch <dispatch@onlogist.example>', to: 'agm@example.test',
  subject: 'Confirmare transport AGM', bodyText: 'Transportul este confirmat pentru mâine la ora 08:30. Șoferul trebuie să prezinte CMR-ul. https://private.example/link',
  occurredAt: '2026-09-13T06:30:00.000Z', attachments: [],
};
const source = {
  sourceId: 'GMAIL-source-hash', title: message.subject, origin: message.from, urlOrIdentifier: `gmail:message:${message.id}`, timestamp: message.occurredAt,
  domain: ['GMAIL_INBOX'], language: 'und', confidence: 1, originType: 'GMAIL' as const, retrievalType: 'LIVE' as const,
  freshness: { status: 'CURRENT' as const, checkedAt: '2026-09-13T07:00:00.000Z', expiresAt: '2026-09-13T07:05:00.000Z', ttlSeconds: 300 },
  provenance: { canonicalPath: null, sha256: null, authorityType: 'AUTHENTICATED_PRIVATE_MAILBOX', reviewStatus: 'LIVE_PROVIDER_OBSERVATION' },
};
const approvedGuardian = () => ({
  evaluate: jest.fn(async () => ({
    decision: 'APPROVED', authorityGranted: true, reasonCode: 'ALLOWLIST_AND_AUTHORITY_VERIFIED',
    evidenceId: 'guardian-allow-1', correlationId: 'guardian-correlation-1',
  })),
});

describe('Premium Assistant Gmail capability', () => {
  afterEach(() => jest.restoreAllMocks());

  it('preserves the requested count from the exact physical Samsung utterance', () => {
    expect(classifyGmailIntent('Redă-mi te rog ultimele două emailuri.')).toMatchObject({
      operation: 'LIST_RECENT',
      maxMessages: 2,
    });
  });

  it.each([
    ['Ce e-mailuri am primit azi?', 'LIST_TODAY'],
    ['Citește ultimul mesaj de la Onlogist', 'LATEST_FROM'],
    ['Am primit ceva de la DriveMe?', 'SEARCH_FROM'],
    ['Ce spune ultimul e-mail despre contul meu?', 'SEARCH_TOPIC'],
    ['Caută în Gmail mesajele despre AGM', 'SEARCH_TOPIC'],
    ['Rezuma ultimele trei e-mailuri', 'SUMMARIZE_RECENT'],
  ])('routes %s to Gmail operation %s', (text, operation) => {
    expect(classifyGmailIntent(text)).toMatchObject({ operation });
  });

  it('limits a latest-message summary to exactly one Gmail result', () => {
    expect(classifyGmailIntent('Rezuma ultimul e-mail')).toMatchObject({ operation: 'SUMMARIZE_RECENT', maxMessages: 1 });
  });

  it('keeps outbound email intent separate from Gmail inbox access', () => {
    expect(classifyGmailIntent('Trimite un e-mail către dispecer')).toBeNull();
  });

  it('returns a natural local answer and engineering trace without model or web egress', async () => {
    const providerFetch = jest.spyOn(global, 'fetch');
    const gmail = { configured: () => true, retrieve: jest.fn().mockResolvedValue({ intent: classifyGmailIntent(request.confirmedText)!, messages: [message], sources: [source] }) };
    let storedTrace: any;
    const knowledge = { createTrace: jest.fn().mockImplementation((sources, status, companyId) => (storedTrace = { traceId: 'gmail-trace', status, generatedAt: new Date().toISOString(), counts: { total: sources.length, library: 0, live: sources.length, cache: 0 }, sources, companyId })), trace: jest.fn().mockImplementation(() => storedTrace) };
    const guardian = approvedGuardian();
    const service = new PremiumAssistantService({ get: () => 'unused-openai-key' } as any, undefined, knowledge as any, gmail as any, guardian as any);

    const result = await service.respond(user, request);
    const engineeringTrace = service.sourceTrace(user, result.sourceTrace.traceId);

    expect(result).toMatchObject({ provider: 'agm', toolTrace: { tool: 'gmail-inbox', status: 'SUCCESS', operation: 'LATEST_FROM', resultCount: 1, errorCode: null }, externalEffectPerformed: false });
    expect(result.toolTrace).toMatchObject({ guardianDecision: 'APPROVED', guardianEvidenceId: 'guardian-allow-1', guardianCorrelationId: 'guardian-correlation-1' });
    expect(guardian.evaluate.mock.invocationCallOrder[0]).toBeLessThan(gmail.retrieve.mock.invocationCallOrder[0]!);
    expect(result.text).toContain('Onlogist Dispatch');
    expect(result.text).toContain('transportul este confirmat');
    expect(result.text).not.toContain('gmail-message-private-id');
    expect(result.text).not.toContain('http');
    expect(engineeringTrace.sources).toEqual([expect.objectContaining({ originType: 'GMAIL', urlOrIdentifier: 'gmail:message:gmail-message-private-id' })]);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('fails closed with an explicit Gmail response and never invokes model or web', async () => {
    const providerFetch = jest.spyOn(global, 'fetch');
    const gmail = { configured: () => true, retrieve: jest.fn().mockRejectedValue(new GmailProviderError('AUTHORIZATION_FAILED', 401)) };
    const guardian = approvedGuardian();
    const service = new PremiumAssistantService({ get: () => 'unused-openai-key' } as any, undefined, undefined, gmail as any, guardian as any);

    const result = await service.respond(user, request);

    expect(result.text).toContain('Gmail nu este disponibil');
    expect(result.text).toContain('Nu am căutat pe web');
    expect(result.toolTrace).toMatchObject({ tool: 'gmail-inbox', status: 'UNAVAILABLE', operation: 'LATEST_FROM', resultCount: 0, errorCode: 'AUTHORIZATION_FAILED', guardianDecision: 'APPROVED' });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('denies Gmail before retrieval when Guardian does not grant authority', async () => {
    const gmail = { configured: () => true, retrieve: jest.fn() };
    const guardian = { evaluate: jest.fn(async () => ({
      decision: 'DENIED', authorityGranted: false, reasonCode: 'PERMISSION_OR_SCOPE_NOT_ALLOWLISTED',
      evidenceId: 'guardian-deny-1', correlationId: 'guardian-correlation-deny-1',
    })) };
    const service = new PremiumAssistantService({ get: () => 'unused-openai-key' } as any, undefined, undefined, gmail as any, guardian as any);

    const result = await service.respond(user, request);

    expect(gmail.retrieve).not.toHaveBeenCalled();
    expect(result.toolTrace).toMatchObject({ status: 'UNAVAILABLE', guardianDecision: 'DENIED', guardianEvidenceId: 'guardian-deny-1' });
    expect(result.text).toContain('Permission Guardian');
  });

  it('synthesizes several messages without exposing source identifiers', () => {
    const second = { ...message, id: 'second-private-id', from: 'DriveMe <office@driveme.example>', subject: 'Actualizare cursă', bodyText: 'Ora de încărcare s-a schimbat la 09:00.' };
    const result = composeGmailAnswer({ intent: { operation: 'SUMMARIZE_RECENT', gmailQuery: '', maxMessages: 3 }, messages: [message, second], sources: [] }, 'ro');
    expect(result).toContain('ultimele 2 mesaje');
    expect(result).toContain('Onlogist Dispatch');
    expect(result).toContain('DriveMe');
    expect(result).not.toContain('private-id');
  });

  it('translates a foreign Gmail summary into the active language with minimized private egress', async () => {
    const german = {
      ...message,
      subject: 'Bestätigung für dispatch@example.test',
      bodyText: 'Die Lieferung ist morgen; Telefon +49 711 1234567 und VIN WDB12345678901234 bleiben unverändert. Bitte halten Sie die Unterlagen bereit.',
    };
    const translation = {
      translateText: jest.fn(async ({ text }: { text: string }) => ({
        text: text.includes('Bestätigung')
          ? 'Confirmarea pentru [AGM_PRIVATE_0]'
          : 'Livrarea este mâine; telefon [AGM_PRIVATE_0] și VIN [AGM_PRIVATE_1] rămân neschimbate. Pregătiți documentele.',
        available: true,
        provider: 'openai' as const,
      })),
    };
    const result = await composeGmailAnswerForUser({
      intent: { operation: 'LATEST_FROM', gmailQuery: '', maxMessages: 1 }, messages: [german], sources: [],
    }, 'ro', translation);

    expect(detectGmailContentLanguage(`${german.subject}\n${german.bodyText}`, 'ro')).toBe('de');
    expect(result.translation).toMatchObject({ status: 'SUCCESS', sourceLanguages: ['de'], targetLanguage: 'ro', provider: 'openai' });
    expect(result.text).toContain('Confirmarea pentru dispatch@example.test');
    expect(result.text).toContain('livrarea este mâine');
    expect(result.text).toContain('dispatch@example.test');
    expect(result.text).toContain('+49 711 1234567');
    expect(result.text).toContain('WDB12345678901234');
    expect(result.text).not.toContain('Die Lieferung');
    expect(translation.translateText).toHaveBeenCalledTimes(2);
    for (const [{ text }] of translation.translateText.mock.calls) {
      expect(text.length).toBeLessThanOrEqual(420);
      expect(text).not.toMatch(/https?:\/\/|gmail:message:|GMAIL-/i);
      expect(text).not.toContain('dispatch@example.test');
      expect(text).not.toContain('+49 711 1234567');
      expect(text).not.toContain('WDB12345678901234');
    }
  });
});

describe('Gmail provider OAuth continuity', () => {
  afterEach(() => jest.restoreAllMocks());

  it('refreshes and retries once after a 401 access-token failure', async () => {
    const config = new ConfigService({ GMAIL_FROM_ADDRESS: 'agm@example.test', GMAIL_OAUTH_CLIENT_ID: 'client-id', GMAIL_OAUTH_CLIENT_SECRET: 'client-secret', GMAIL_OAUTH_REFRESH_TOKEN: 'persistent-refresh-token' });
    const providerFetch = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-one', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-two', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [] }), { status: 200 }));

    await expect(new GmailCommunicationProvider(config).searchInbox('from:Onlogist', 1)).resolves.toEqual([]);

    expect(providerFetch).toHaveBeenCalledTimes(4);
    expect(String(providerFetch.mock.calls[0]![0])).toBe('https://oauth2.googleapis.com/token');
    expect(String(providerFetch.mock.calls[2]![0])).toBe('https://oauth2.googleapis.com/token');
    expect(String(providerFetch.mock.calls[3]![0])).toContain('q=in%3Ainbox%20from%3AOnlogist');
  });

  it('uses the persistent refresh token again after a fresh service instance', async () => {
    const config = new ConfigService({ GMAIL_FROM_ADDRESS: 'agm@example.test', GMAIL_OAUTH_CLIENT_ID: 'client-id', GMAIL_OAUTH_CLIENT_SECRET: 'client-secret', GMAIL_OAUTH_REFRESH_TOKEN: 'persistent-refresh-token' });
    const providerFetch = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-one', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-two', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [] }), { status: 200 }));

    await new GmailCommunicationProvider(config).searchInbox('', 1);
    await new GmailCommunicationProvider(config).searchInbox('', 1);

    expect(providerFetch.mock.calls.filter(([url]) => String(url) === 'https://oauth2.googleapis.com/token')).toHaveLength(2);
  });

  it('classifies a revoked refresh token as an authorization failure', async () => {
    const config = new ConfigService({ GMAIL_FROM_ADDRESS:'agm@example.test',GMAIL_OAUTH_CLIENT_ID:'client-id',GMAIL_OAUTH_CLIENT_SECRET:'client-secret',GMAIL_OAUTH_REFRESH_TOKEN:'revoked-refresh-token' });
    jest.spyOn(global,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({error:'invalid_grant'}),{status:400}));
    await expect(new GmailCommunicationProvider(config).searchInbox('',1)).rejects.toMatchObject({code:'AUTHORIZATION_FAILED',reason:'invalid_grant'});
  });

  it('recovers automatically after temporary network loss without Google reauthorization', async () => {
    const config = new ConfigService({ GMAIL_FROM_ADDRESS:'agm@example.test',GMAIL_OAUTH_CLIENT_ID:'client-id',GMAIL_OAUTH_CLIENT_SECRET:'client-secret',GMAIL_OAUTH_REFRESH_TOKEN:'persistent-refresh-token' });
    const provider = new GmailCommunicationProvider(config);
    const providerFetch = jest.spyOn(global,'fetch')
      .mockRejectedValueOnce(new TypeError('network offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({access_token:'recovered-access',expires_in:3600}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({messages:[]}),{status:200}));
    await expect(provider.searchInbox('',1)).rejects.toMatchObject({code:'NETWORK_UNAVAILABLE'});
    await expect(provider.searchInbox('',1)).resolves.toEqual([]);
    expect(providerFetch).toHaveBeenCalledTimes(3);
  });

  it('refreshes proactively when the cached access token is inside the 60 second expiry window', async () => {
    const config = new ConfigService({ GMAIL_FROM_ADDRESS:'agm@example.test',GMAIL_OAUTH_CLIENT_ID:'client-id',GMAIL_OAUTH_CLIENT_SECRET:'client-secret',GMAIL_OAUTH_REFRESH_TOKEN:'persistent-refresh-token' });
    const providerFetch = jest.spyOn(global,'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({access_token:'short-access',expires_in:30}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({messages:[]}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({access_token:'fresh-access',expires_in:3600}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({messages:[]}),{status:200}));
    const provider = new GmailCommunicationProvider(config);
    await provider.searchInbox('',1); await provider.searchInbox('',1);
    expect(providerFetch.mock.calls.filter(([url])=>String(url)==='https://oauth2.googleapis.com/token')).toHaveLength(2);
  });
});
