import { ForbiddenException } from '@nestjs/common';
import { composeUserAnswer, PremiumAssistantService, requiresLiveSearch } from '../src/premium-assistant/premium-assistant.service';

describe('Premium assistant read-only contract', () => {
  const config = { get: (key: string, fallback?: string) => key === 'OPENAI_API_KEY' ? 'test-key' : fallback } as any;
  const request = {
    productId: 'agm-cockpit' as const,
    moduleId: 'required-document',
    language: 'ro',
    confirmedText: 'Ce trebuie să verific?',
    tripId: 'trip-1',
    operationalCaseId: 'case-1',
    history: [],
  };
  const premiumUser = { userId: 'user-1', companyId: 'tenant-1', roles: ['PREMIUM_ACCESS'], requestId: '', correlationId: '' };

  afterEach(() => jest.restoreAllMocks());

  it('denies a user without Premium entitlement before provider access', async () => {
    const provider = jest.spyOn(global, 'fetch');
    await expect(new PremiumAssistantService(config).respond({ ...premiumUser, roles: [] }, request)).rejects.toBeInstanceOf(ForbiddenException);
    expect(provider).not.toHaveBeenCalled();
  });

  it('uses the authenticated tenant boundary and never performs an external effect', async () => {
    const provider = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ output_text: 'Verifică documentul și valabilitatea lui.' }), { status: 200 }));
    const result = await new PremiumAssistantService(config).respond(premiumUser, request);
    expect(result).toMatchObject({ contractVersion: 'premium-assistant.v1', kind: 'answer', provider: 'openai', productId: 'agm-cockpit', moduleId: 'required-document', sourceTrace: { status: 'NO_VERIFIED_SOURCES', counts: { total: 0 } }, externalEffectPerformed: false, timing: { timeToFirstTokenMs: expect.any(Number), orchestratorMs: expect.any(Number), modelMs: expect.any(Number), answerCompleteMs: expect.any(Number), serverTotalMs: expect.any(Number), sourceResolutionMs: expect.any(Number) } });
    const body = JSON.parse(String((provider.mock.calls[0]?.[1] as RequestInit).body));
    const supplied = JSON.parse(body.input[1].content);
    expect(supplied.tenantBoundary).toBe('tenant-1');
    expect(supplied).not.toHaveProperty('tenantId');
    expect(supplied.knowledgeContext).toEqual([]);
    expect(supplied.sourcePolicy).toEqual({
      libraryFirst: true,
      liveSearchRequired: false,
      egressEligibility: 'CURRENT_APPROVED_ONLY',
      maxSources: 6,
      maxCharsPerSource: 900,
      sensitiveDataRedaction: true,
    });
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(body.max_output_tokens).toBe(220);
    expect(body.store).toBe(false);
    expect(body.stream).toBe(true);
    expect(body.input[0].content).toContain('Never claim to send messages');
    expect(body.input[0].content).toContain('telephone numbers');
    expect(body.input[0].content).toContain('Use live public-web search only');
    expect(body.input[0].content).toContain('official and primary sources');
    expect(body.input[0].content).toContain('Answer only the newest confirmedText');
    expect(body.input[0].content).toContain('Source provenance is captured separately');
    expect(body.input[0].content).toContain('never include citations');
    expect(body.input[0].content).toContain('never reproduce an hourly/event timeline');
    expect(body.input[0].content).toContain('do not repeat a question already answered');
  });

  it('persists real provider usage for the Product Owner projection', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ output_text: 'Răspuns operațional.' }), { status: 200 }));
    const prisma = { providerUsageEvent: { create: jest.fn().mockResolvedValue({}) } };
    await new PremiumAssistantService(config, prisma as never).respond(premiumUser, request);
    expect(prisma.providerUsageEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      companyId: 'tenant-1', userId: 'user-1', adapterId: 'premium-assistant', eventType: 'PROVIDER_REQUEST', outcome: 'SUCCESS',
    }) });
  });

  it('classifies a provider question as a clarification', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ output_text: 'Despre ce document este vorba?' }), { status: 200 }));
    await expect(new PremiumAssistantService(config).respond(premiumUser, request)).resolves.toMatchObject({ kind: 'clarification', externalEffectPerformed: false });
  });

  it('enables web search only when the newest question needs current information', async () => {
    expect(requiresLiveSearch('Care este vremea astăzi?')).toBe(true);
    expect(requiresLiveSearch('Rezuma documentul încărcat.')).toBe(false);
    const provider = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ output_text: 'Acum sunt 18 grade.' }), { status: 200 }));
    await new PremiumAssistantService(config).respond(premiumUser, { ...request, confirmedText: 'Care este vremea astăzi?' });
    const body = JSON.parse(String((provider.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.tools).toEqual([{ type: 'web_search' }]);
    expect(body.tool_choice).toBe('auto');
  });

  it('keeps provider citations in engineering trace but out of the user response', async () => {
    const liveUrl = 'https://weather.example.test/heilbronn';
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      output_text: 'Mâine vor fi aproximativ 23°C. ([weather.example.test](https://weather.example.test/heilbronn))',
      output: [{ content: [{ annotations: [{ type: 'url_citation', url: liveUrl, title: 'Weather Heilbronn' }] }] }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    let storedTrace: any;
    const knowledge = {
      cacheKey: jest.fn().mockReturnValue('weather-key'),
      cachedAnswer: jest.fn().mockReturnValue(null),
      resolve: jest.fn().mockReturnValue({ sources: [], requiresLiveSearch: true, context: [] }),
      createTrace: jest.fn().mockImplementation((sources, status, companyId, observedAt) => {
        storedTrace = {
          traceId: 'weather-trace',
          status,
          generatedAt: observedAt.toISOString(),
          counts: { total: sources.length, library: 0, cache: 0, live: sources.length },
          sources,
          ownerCompanyId: companyId,
        };
        return storedTrace;
      }),
      trace: jest.fn().mockImplementation(() => storedTrace),
      storeAnswer: jest.fn(),
    };
    const service = new PremiumAssistantService(config, undefined, knowledge as any);

    const result = await service.respond(premiumUser, { ...request, confirmedText: 'Cum va fi vremea mâine în Heilbronn?' });
    const engineeringTrace = service.sourceTrace(premiumUser, result.sourceTrace.traceId);

    expect(result.text).toBe('Mâine vor fi aproximativ 23°C.');
    expect(result.text).not.toContain('http');
    expect(result).not.toHaveProperty('sources');
    expect(engineeringTrace.sources).toEqual([
      expect.objectContaining({ urlOrIdentifier: liveUrl, retrievalType: 'LIVE', originType: 'WEB' }),
    ]);
  });

  it('collapses a raw hourly appendix and preserves the synthesized factual conclusion', () => {
    const providerText = [
      'Mâine, în Heilbronn, vremea va fi variabilă, cu aproximativ 23°C după-amiaza și posibile averse.',
      '## Prognoză orară:',
      '* 04:00: 15°C, noros',
      '* 05:00: 15°C, noros',
      '* 06:00: 15°C, noros',
      '* 07:00: 14°C, noros',
    ].join('\n');

    expect(composeUserAnswer(providerText)).toBe(
      'Mâine, în Heilbronn, vremea va fi variabilă, cu aproximativ 23°C după-amiaza și posibile averse.',
    );
  });

  it('removes inline links, citation markers, document identifiers, and source sections from user text', () => {
    const providerText = [
      'Verifică valabilitatea în [ghidul aplicabil](https://example.test/guide) înainte de plecare. [1]',
      '### Surse',
      '- AGM_LIBRARY/operations/guide.md',
      '- WEB-0123456789abcdef',
      '- https://example.test/guide',
    ].join('\n');

    expect(composeUserAnswer(providerText)).toBe(
      'Verifică valabilitatea în ghidul aplicabil înainte de plecare.',
    );
  });

  it('applies the same clean user-text boundary to cached answers', async () => {
    const provider = jest.spyOn(global, 'fetch');
    const trace = {
      traceId: 'cached-trace',
      status: 'READY' as const,
      generatedAt: new Date().toISOString(),
      counts: { total: 1, library: 0, cache: 0, live: 1 },
      sources: [],
    };
    const knowledge = {
      cacheKey: jest.fn().mockReturnValue('cached-weather'),
      cachedAnswer: jest.fn().mockReturnValue({
        text: 'Va fi mai cald după-amiaza. ([weather.example.test](https://weather.example.test))',
        kind: 'answer',
        sources: [],
        expiresAtMs: Date.now() + 60_000,
      }),
      createTrace: jest.fn().mockReturnValue(trace),
    };

    const result = await new PremiumAssistantService(config, undefined, knowledge as any).respond(premiumUser, request);

    expect(result.text).toBe('Va fi mai cald după-amiaza.');
    expect(result.cache.disposition).toBe('HIT');
    expect(provider).not.toHaveBeenCalled();
  });
});
