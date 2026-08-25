import { ForbiddenException } from '@nestjs/common';
import { PremiumAssistantService, requiresLiveSearch } from '../src/premium-assistant/premium-assistant.service';

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
    expect(result).toMatchObject({ kind: 'answer', provider: 'openai', productId: 'agm-cockpit', moduleId: 'required-document', externalEffectPerformed: false, timing: { orchestratorMs: expect.any(Number), modelMs: expect.any(Number), serverTotalMs: expect.any(Number) } });
    const body = JSON.parse(String((provider.mock.calls[0]?.[1] as RequestInit).body));
    const supplied = JSON.parse(body.input[1].content);
    expect(supplied.tenantBoundary).toBe('tenant-1');
    expect(supplied).not.toHaveProperty('tenantId');
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(body.max_output_tokens).toBe(220);
    expect(body.store).toBe(false);
    expect(body.input[0].content).toContain('Never claim to send messages');
    expect(body.input[0].content).toContain('telephone numbers');
    expect(body.input[0].content).toContain('live public-web search available');
    expect(body.input[0].content).toContain('official and primary sources');
    expect(body.input[0].content).toContain('Answer only the newest confirmedText');
    expect(body.input[0].content).toContain('at most two compact');
    expect(body.input[0].content).toContain('do not repeat a question already answered');
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
});
