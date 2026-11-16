import 'reflect-metadata';
import { AgmatccCopilotModule } from '../src/agmatcc-copilot/agmatcc-copilot.module';
import { AGMATCC_COPILOT_PROVIDER } from '../src/agmatcc-copilot/agmatcc-copilot.service';

const factory = Reflect.getMetadata('providers', AgmatccCopilotModule).find((p: { provide?: symbol }) => p.provide === AGMATCC_COPILOT_PROVIDER).useFactory;
const config = (values: Record<string, string | undefined>) => ({ get: (key: string, fallback?: string) => values[key] ?? fallback });
describe('AGMaTCC Production provider selection', () => {
  it('never selects the simulator in Production, including the default configuration', async () => {
    for (const values of [{ NODE_ENV: 'production' }, { NODE_ENV: 'production', AGMATCC_COPILOT_PROVIDER: 'simulated' }]) {
      const provider = factory(config(values));
      expect(provider.provider).toBe('disabled');
      await expect(provider.complete()).rejects.toThrow('AGMATCC_LIVE_PROVIDER_DISABLED');
    }
  });
  it('retains the explicit isolated test simulator', () => {
    expect(factory(config({ NODE_ENV: 'test', AGMATCC_COPILOT_PROVIDER: 'simulated' })).provider).toBe('simulated');
  });
  it('requires the existing activation and key gates for the real provider', () => {
    expect(() => factory(config({ NODE_ENV: 'production', AGMATCC_COPILOT_PROVIDER: 'openai' }))).toThrow();
    expect(() => factory(config({ NODE_ENV: 'production', AGMATCC_COPILOT_PROVIDER: 'openai', AGMATCC_LUNA_PRODUCTION_ENABLED: 'true' }))).toThrow('ACPM_OPENAI_KEY_REQUIRED');
  });
});
