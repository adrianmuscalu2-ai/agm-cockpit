import type { AccessEntitlementSnapshot } from './premium-access.contract';

export const USER_ACCESS_TOKEN_KEY = 'agm.auth.accessToken';

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type FetchPort = typeof fetch;

export type UserIdentity = {
  id: string;
  displayName: string;
  email: string;
  roles: readonly string[];
};

type ApiEnvelope<T> = { data?: T; message?: string | string[] };

export function createPremiumAccessClient(input: {
  apiBaseUrl: string;
  fetch: FetchPort;
  sessionStorage: StoragePort;
}) {
  const baseUrl = input.apiBaseUrl.trim().replace(/\/$/, '');

  return {
    hasSession: () => Boolean(input.sessionStorage.getItem(USER_ACCESS_TOKEN_KEY)),
    logout: () => input.sessionStorage.removeItem(USER_ACCESS_TOKEN_KEY),
    async login(email: string, password: string): Promise<UserIdentity> {
      const payload = await request<{ accessToken: string; user: UserIdentity }>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!payload.accessToken.trim()) throw new PremiumAccessClientError('invalid-response');
      input.sessionStorage.setItem(USER_ACCESS_TOKEN_KEY, payload.accessToken);
      return payload.user;
    },
    async entitlements(): Promise<AccessEntitlementSnapshot> {
      const token = input.sessionStorage.getItem(USER_ACCESS_TOKEN_KEY);
      if (!token) throw new PremiumAccessClientError('unauthenticated');
      try {
        return await request<AccessEntitlementSnapshot>('/auth/entitlements', {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        if (error instanceof PremiumAccessClientError && error.status === 401) {
          input.sessionStorage.removeItem(USER_ACCESS_TOKEN_KEY);
        }
        throw error;
      }
    },
  };

  async function request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await input.fetch(`${baseUrl}${path}`, init);
    } catch {
      throw new PremiumAccessClientError('network');
    }
    const envelope = await response.json().catch(() => ({})) as ApiEnvelope<T>;
    if (!response.ok) throw new PremiumAccessClientError('request', response.status);
    if (envelope.data === undefined) throw new PremiumAccessClientError('invalid-response', response.status);
    return envelope.data;
  }
}

export class PremiumAccessClientError extends Error {
  constructor(readonly reason: 'network' | 'request' | 'invalid-response' | 'unauthenticated', readonly status?: number) {
    super(`Premium access client failed: ${reason}${status ? ` (${status})` : ''}`);
  }
}
