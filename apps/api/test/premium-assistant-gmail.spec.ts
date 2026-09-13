import { ConfigService } from '@nestjs/config';
import { GmailCommunicationProvider, GmailProviderError } from '../src/communications/providers/gmail.provider';
import { classifyGmailIntent, composeGmailAnswer } from '../src/premium-assistant/premium-assistant-gmail.service';
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

describe('Premium Assistant Gmail capability', () => {
  afterEach(() => jest.restoreAllMocks());

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
    const service = new PremiumAssistantService({ get: () => 'unused-openai-key' } as any, undefined, knowledge as any, gmail as any);

    const result = await service.respond(user, request);
    const engineeringTrace = service.sourceTrace(user, result.sourceTrace.traceId);

    expect(result).toMatchObject({ provider: 'agm', toolTrace: { tool: 'gmail-inbox', status: 'SUCCESS', operation: 'LATEST_FROM', resultCount: 1, errorCode: null }, externalEffectPerformed: false });
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
    const service = new PremiumAssistantService({ get: () => 'unused-openai-key' } as any, undefined, undefined, gmail as any);

    const result = await service.respond(user, request);

    expect(result.text).toContain('Gmail nu este disponibil');
    expect(result.text).toContain('Nu am căutat pe web');
    expect(result.toolTrace).toEqual({ tool: 'gmail-inbox', status: 'UNAVAILABLE', operation: 'LATEST_FROM', resultCount: 0, errorCode: 'AUTHORIZATION_FAILED' });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('synthesizes several messages without exposing source identifiers', () => {
    const second = { ...message, id: 'second-private-id', from: 'DriveMe <office@driveme.example>', subject: 'Actualizare cursă', bodyText: 'Ora de încărcare s-a schimbat la 09:00.' };
    const result = composeGmailAnswer({ intent: { operation: 'SUMMARIZE_RECENT', gmailQuery: '', maxMessages: 3 }, messages: [message, second], sources: [] }, 'ro');
    expect(result).toContain('ultimele 2 mesaje');
    expect(result).toContain('Onlogist Dispatch');
    expect(result).toContain('DriveMe');
    expect(result).not.toContain('private-id');
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
});
