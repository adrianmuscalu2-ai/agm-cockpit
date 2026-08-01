export const TRANSLATION_CONTRACT = {
  id: 'API-003',
  version: 'translation-provider.v1',
  provider: 'openai',
  endpoint: 'https://api.openai.com/v1/responses',
  defaultModel: 'gpt-4.1-mini',
  defaultTimeoutMs: 20_000,
  minimumTimeoutMs: 5_000,
  maximumTimeoutMs: 60_000,
  healthCacheMs: 60_000,
  translateThrottle: { limit: 20, ttlMs: 60_000, blockDurationMs: 60_000 },
  healthThrottle: { limit: 30, ttlMs: 60_000, blockDurationMs: 30_000 },
} as const;

