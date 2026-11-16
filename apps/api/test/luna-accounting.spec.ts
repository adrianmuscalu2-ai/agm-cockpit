import { CopilotProviderError, OpenAIResponsesAgmatccProvider } from '../src/agmatcc-copilot/agmatcc-copilot.provider';
import { AgmatccCopilotService } from '../src/agmatcc-copilot/agmatcc-copilot.service';

describe('Luna accounting boundary', () => {
  const user = { userId: 'owner', companyId: 'tenant', roles: ['PREMIUM_ACCESS'], requestId: 'r', correlationId: 'c' };
  const config = { get: (k: string) => ({ AGMATCC_COPILOT_ISOLATED_ENABLED: 'true', AGMATCC_COPILOT_PROVIDER: 'openai' })[k] };
  it('retains provider usage on malformed structured output', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: 'invalid', usage: { input_tokens: 100, output_tokens: 20 } })));
    const provider = new OpenAIResponsesAgmatccProvider('EXAMPLE_TEST_KEY', fetcher);
    await expect(provider.complete([{ role: 'user', content: 'test' }], false)).rejects.toMatchObject({ usage: { inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.000035 } });
  });
  it('does not silently turn absent usage into zero cost', async () => {
    const provider = new OpenAIResponsesAgmatccProvider('EXAMPLE_TEST_KEY', jest.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: '{}' }))));
    await expect(provider.complete([], false)).rejects.toThrow('ACPM_USAGE_UNCONFIRMED');
  });
  it('does not call a paid provider if reservation is refused', async () => {
    const provider = { provider: 'openai' as const, model: 'gpt-6-luna' as const, complete: jest.fn() };
    const ledger = { reserve: jest.fn().mockRejectedValue(new Error('ACPM_BUDGET_EXHAUSTED')), settle: jest.fn() };
    const service = new AgmatccCopilotService(config as never, {} as never, {} as never, provider, ledger as never);
    expect((await service.respond(user, 'test')).status).toBe('BLOCKED');
    expect(provider.complete).not.toHaveBeenCalled();
  });
  it('settles malformed output with known usage and includes it in the response', async () => {
    const usage = { inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.000035 };
    const provider = { provider: 'openai' as const, model: 'gpt-6-luna' as const, complete: jest.fn().mockRejectedValue(new CopilotProviderError('ACPM_PROVIDER_STRUCTURED_OUTPUT_INVALID', usage)) };
    const ledger = { reserve: jest.fn().mockResolvedValue({ callId: 'call' }), settle: jest.fn() };
    const service = new AgmatccCopilotService(config as never, {} as never, {} as never, provider, ledger as never);
    expect((await service.respond(user, 'test')).usage).toEqual(usage);
    expect(ledger.settle).toHaveBeenCalledWith({ callId: 'call' }, usage, 'ACPM_PROVIDER_STRUCTURED_OUTPUT_INVALID', [], undefined, undefined);
  });
  it('marks network failure as unconfirmed rather than refunded', async () => {
    const provider = { provider: 'openai' as const, model: 'gpt-6-luna' as const, complete: jest.fn().mockRejectedValue(new Error('ACPM_PROVIDER_TIMEOUT')) };
    const ledger = { reserve: jest.fn().mockResolvedValue({ callId: 'call' }), settle: jest.fn() };
    const service = new AgmatccCopilotService(config as never, {} as never, {} as never, provider, ledger as never);
    expect((await service.respond(user, 'test')).status).toBe('FAIL');
    expect(ledger.settle).toHaveBeenCalledWith({ callId: 'call' }, undefined, 'ACPM_PROVIDER_TIMEOUT', [], undefined, undefined);
  });
});
