export const API_CORE_CONTRACT = {
  id: 'API-001',
  version: 'api-core-health.v1',
  service: 'agm-api',
  globalPrefix: 'api/v1',
  defaultHost: {
    production: '127.0.0.1',
    nonProduction: '0.0.0.0',
  },
  defaultPort: 3000,
  throttle: {
    limit: 100,
    ttlMs: 60_000,
  },
  health: {
    livePath: 'health/live',
    readyPath: 'health/ready',
    requiredDependencies: ['database', 'translationProvider'] as const,
  },
} as const;

