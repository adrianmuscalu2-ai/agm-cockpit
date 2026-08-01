export const AUTH_CONTRACT = {
  id: 'API-002',
  version: 'auth-users.v1',
  tokenScope: 'user',
  defaultExpiresIn: '1h',
  activeStatus: 'Active',
  loginThrottle: {
    limit: 5,
    ttlMs: 60_000,
    blockDurationMs: 60_000,
  },
} as const;

