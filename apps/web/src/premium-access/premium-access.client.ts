import type { AccessEntitlementSnapshot } from './premium-access.contract';

export const USER_ACCESS_TOKEN_KEY = 'agm.auth.accessToken';

// One-time fail-closed migration: access tokens are session-only.
globalThis.localStorage?.removeItem(USER_ACCESS_TOKEN_KEY);

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
    logout: async () => { input.sessionStorage.removeItem(USER_ACCESS_TOKEN_KEY); await input.fetch(`${baseUrl}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined); },
    async login(email: string, password: string): Promise<UserIdentity> {
      const payload = await request<{ accessToken: string; user: UserIdentity }>('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!payload.accessToken.trim()) throw new PremiumAccessClientError('invalid-response');
      input.sessionStorage.setItem(USER_ACCESS_TOKEN_KEY, payload.accessToken);
      return payload.user;
    },
    async restore(): Promise<boolean> {
      try {
        const payload = await refreshSession();
        input.sessionStorage.setItem(USER_ACCESS_TOKEN_KEY, payload.accessToken);
        return true;
      } catch { input.sessionStorage.removeItem(USER_ACCESS_TOKEN_KEY); return false; }
    },
    async entitlements(): Promise<AccessEntitlementSnapshot> {
      const token = input.sessionStorage.getItem(USER_ACCESS_TOKEN_KEY);
      if (!token) throw new PremiumAccessClientError('unauthenticated');
      try {
        return await request<AccessEntitlementSnapshot>('/auth/entitlements', {
          cache: 'no-store',
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

  async function refreshSession() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await request<{ accessToken: string; user: UserIdentity }>('/auth/refresh', { method: 'POST', credentials: 'include' });
      } catch (error) {
        if (!(error instanceof PremiumAccessClientError) || error.status !== 409 || attempt === 2) throw error;
        await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
    throw new PremiumAccessClientError('request', 409);
  }
}

export class PremiumAccessClientError extends Error {
  constructor(readonly reason: 'network' | 'request' | 'invalid-response' | 'unauthenticated', readonly status?: number) {
    super(`Premium access client failed: ${reason}${status ? ` (${status})` : ''}`);
  }
}
