import { USER_ACCESS_TOKEN_KEY } from '../premium-access/premium-access.client';
import type { BasicLanguageCode } from '../language-registry';
import type { GmailActionContext } from '../android-action-layer/android-action.contract';

export type PremiumAssistantClientRequest = {
  productId: 'agm-cockpit';
  moduleId: string;
  language: BasicLanguageCode;
  confirmedText: string;
  surface?: 'ANDROID' | 'BROWSER';
  tripId?: string;
  operationalCaseId?: string;
  situationId?: string;
  history: readonly { role: 'user' | 'assistant'; text: string; occurredAt?: string }[];
};

export type PremiumAssistantClientResponse = {
  contractVersion: 'premium-assistant.v1' | 'premium-assistant.v2';
  kind: 'answer' | 'clarification';
  text: string;
  provider: 'openai' | 'agm';
  productId: 'agm-cockpit';
  moduleId: string;
  contextRefs: readonly string[];
  sourceTrace: Omit<AssistantSourceTrace, 'sources'>;
  toolTrace?: {
    tool: 'gmail-inbox'; status: 'SUCCESS' | 'UNAVAILABLE'; operation: string; resultCount: number; errorCode: string | null;
    guardianDecision?: 'APPROVED' | 'DENIED' | 'NOT_PROVEN'; guardianEvidenceId?: string; guardianCorrelationId?: string;
    translationStatus?: 'NOT_REQUIRED' | 'SUCCESS' | 'UNAVAILABLE'; translationSourceLanguages?: readonly string[];
    translationTargetLanguage?: string; translationProvider?: 'openai' | 'unavailable' | 'none';
  };
  actionContext?: GmailActionContext;
  cache: { disposition: 'HIT' | 'MISS'; ttlSeconds: number };
  externalEffectPerformed: false;
  timing: {
    timeToFirstTokenMs: number;
    orchestratorMs: number;
    modelMs: number;
    answerCompleteMs: number;
    serverTotalMs: number;
    sourceResolutionMs: number;
  };
};

export type AssistantSourceReference = {
  sourceId: string;
  title: string;
  origin: string;
  urlOrIdentifier: string | null;
  timestamp: string | null;
  domain: readonly string[];
  language: string;
  confidence: number;
  originType: 'AGM_INTERNAL' | 'DOCUMENT_LIBRARY' | 'WEB' | 'GMAIL';
  retrievalType: 'LIBRARY' | 'CACHE' | 'LIVE';
  freshness: {
    status: 'CURRENT' | 'STALE' | 'EXPIRED' | 'UNKNOWN' | 'INVALIDATED';
    checkedAt: string | null;
    expiresAt: string | null;
    ttlSeconds: number;
  };
  provenance: {
    canonicalPath: string | null;
    sha256: string | null;
    authorityType: string;
    reviewStatus: string;
  };
};

export type AssistantSourceTrace = {
  traceId: string;
  status: 'READY' | 'LIVE_VERIFICATION_IN_PROGRESS' | 'LIBRARY_ONLY' | 'NO_VERIFIED_SOURCES';
  generatedAt: string;
  counts: { total: number; library: number; cache: number; live: number };
  sources: readonly AssistantSourceReference[];
};

export function createPremiumAssistantClient(input: {
  apiBaseUrl: string;
  fetch: typeof fetch;
  sessionStorage: Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem' | 'removeItem'>>;
}) {
  const baseUrl = input.apiBaseUrl.trim().replace(/\/$/, '');
  let refreshPromise: Promise<string | null> | null = null;
  return {
    async respond(request: PremiumAssistantClientRequest, options: { signal?: AbortSignal } = {}): Promise<PremiumAssistantClientResponse> {
      let response: Response;
      try {
        response = await fetchWithAutomaticRefresh(`${baseUrl}/premium-assistant/respond`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: options.signal,
        });
      } catch (error) {
        if (error instanceof PremiumAssistantClientError) throw error;
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new PremiumAssistantClientError('network');
      }
      if (response.status === 401) throw new PremiumAssistantClientError('authentication-required');
      if (response.status === 403) throw new PremiumAssistantClientError('premium-required');
      if (!response.ok) throw new PremiumAssistantClientError('provider-unavailable');
      const envelope = await response.json().catch(() => ({})) as { data?: PremiumAssistantClientResponse };
      const value = envelope.data;
      if (!value || !['premium-assistant.v1', 'premium-assistant.v2'].includes(value.contractVersion) || value.externalEffectPerformed !== false || !value.text?.trim() || !value.sourceTrace?.traceId) {
        throw new PremiumAssistantClientError('invalid-response');
      }
      return value;
    },
    async sources(traceId: string, options: { signal?: AbortSignal } = {}): Promise<AssistantSourceTrace> {
      let response: Response;
      try {
        response = await fetchWithAutomaticRefresh(baseUrl + '/premium-assistant/sources/' + encodeURIComponent(traceId), {
          method: 'GET',
          credentials: 'include',
          signal: options.signal,
        });
      } catch (error) {
        if (error instanceof PremiumAssistantClientError) throw error;
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new PremiumAssistantClientError('network');
      }
      if (response.status === 401) throw new PremiumAssistantClientError('authentication-required');
      if (response.status === 403) throw new PremiumAssistantClientError('premium-required');
      if (!response.ok) throw new PremiumAssistantClientError('provider-unavailable');
      const envelope = await response.json().catch(() => ({})) as { data?: AssistantSourceTrace };
      const value = envelope.data;
      if (!value?.traceId || !Array.isArray(value.sources)) throw new PremiumAssistantClientError('invalid-response');
      return value;
    },
  };

  async function fetchWithAutomaticRefresh(url: string, init: RequestInit) {
    let token = input.sessionStorage.getItem(USER_ACCESS_TOKEN_KEY);
    if (!token) token = await refreshAccessToken();
    if (!token) throw new PremiumAssistantClientError('authentication-required');
    let response = await fetchWithToken(url, token, init);
    if (response.status !== 401) return response;
    token = await refreshAccessToken(true);
    if (!token) return response;
    response = await fetchWithToken(url, token, init);
    return response;
  }

  function fetchWithToken(url: string, token: string, init: RequestInit) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return input.fetch(url, { ...init, credentials: 'include', headers });
  }

  async function refreshAccessToken(force = false) {
    const existing = input.sessionStorage.getItem(USER_ACCESS_TOKEN_KEY);
    if (existing && !force) return existing;
    if (!refreshPromise) {
      refreshPromise = (async () => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          let response: Response;
          try {
            response = await input.fetch(`${baseUrl}/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
              headers: { Accept: 'application/json' },
            });
          } catch {
            throw new PremiumAssistantClientError('network');
          }
          if (response.status === 409 && attempt < 2) {
            await delay(100 * (attempt + 1));
            continue;
          }
          if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
              input.sessionStorage.removeItem?.(USER_ACCESS_TOKEN_KEY);
              return null;
            }
            throw new PremiumAssistantClientError('provider-unavailable');
          }
          const envelope = await response.json().catch(() => ({})) as { data?: { accessToken?: string } };
          const refreshed = envelope.data?.accessToken?.trim();
          if (!refreshed) throw new PremiumAssistantClientError('invalid-response');
          input.sessionStorage.setItem?.(USER_ACCESS_TOKEN_KEY, refreshed);
          return refreshed;
        }
        throw new PremiumAssistantClientError('provider-unavailable');
      })().finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  }
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

export class PremiumAssistantClientError extends Error {
  constructor(readonly reason: 'authentication-required' | 'premium-required' | 'network' | 'provider-unavailable' | 'invalid-response') {
    super(`Premium assistant client failed: ${reason}`);
  }
}
