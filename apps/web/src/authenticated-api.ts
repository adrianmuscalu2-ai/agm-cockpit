import { USER_ACCESS_TOKEN_KEY } from './premium-access/premium-access.client';

let refreshPromise: Promise<string | null> | null = null;

export function apiBaseUrl() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
  const configured = typeof env?.VITE_AGM_API_BASE_URL === 'string' ? env.VITE_AGM_API_BASE_URL.trim() : '';
  const development = env?.DEV ? '/api/v1' : '';
  return (configured || development).replace(/\/$/, '');
}

export function resolveApiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${apiBaseUrl()}${normalized}`;
}

export async function authenticatedApiFetch(pathOrUrl: string, init: RequestInit = {}) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : resolveApiUrl(pathOrUrl);
  let token = globalThis.sessionStorage?.getItem(USER_ACCESS_TOKEN_KEY) ?? null;
  if (!token) token = await refreshAccessToken();
  let response = await fetchWithToken(url, token, init);
  if (response.status !== 401) return response;
  token = await refreshAccessToken(true);
  if (!token) return response;
  response = await fetchWithToken(url, token, init);
  return response;
}

function fetchWithToken(url: string, token: string | null, init: RequestInit) {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, credentials: 'include', headers });
}

async function refreshAccessToken(force = false) {
  const existing = globalThis.sessionStorage?.getItem(USER_ACCESS_TOKEN_KEY) ?? null;
  if (existing && !force) return existing;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const base = apiBaseUrl();
      if (!base) return null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch(`${base}/auth/refresh`, { method: 'POST', credentials: 'include' });
          if (response.status === 409 && attempt < 2) {
            await delay(100 * (attempt + 1));
            continue;
          }
          const payload = await response.json().catch(() => ({})) as { data?: { accessToken?: string } };
          const token = response.ok ? payload.data?.accessToken?.trim() : '';
          if (!token) {
            if (response.status !== 409) globalThis.sessionStorage?.removeItem(USER_ACCESS_TOKEN_KEY);
            return null;
          }
          globalThis.sessionStorage?.setItem(USER_ACCESS_TOKEN_KEY, token);
          return token;
        } catch {
          return null;
        }
      }
      return null;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));
}
