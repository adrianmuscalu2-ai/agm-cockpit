import { USER_ACCESS_TOKEN_KEY } from '../premium-access/premium-access.client';
import type { BasicLanguageCode } from '../language-registry';

export type PremiumAssistantClientRequest = {
  productId: 'agm-cockpit';
  moduleId: string;
  language: BasicLanguageCode;
  confirmedText: string;
  tripId?: string;
  operationalCaseId?: string;
  situationId?: string;
  history: readonly { role: 'user' | 'assistant'; text: string }[];
};

export type PremiumAssistantClientResponse = {
  contractVersion: 'premium-assistant.v1' | 'premium-assistant.v2';
  kind: 'answer' | 'clarification';
  text: string;
  provider: 'openai';
  productId: 'agm-cockpit';
  moduleId: string;
  contextRefs: readonly string[];
  sourceTrace: Omit<AssistantSourceTrace, 'sources'>;
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
  originType: 'AGM_INTERNAL' | 'DOCUMENT_LIBRARY' | 'WEB';
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
  sessionStorage: Pick<Storage, 'getItem'>;
}) {
  const baseUrl = input.apiBaseUrl.trim().replace(/\/$/, '');
  return {
    async respond(request: PremiumAssistantClientRequest, options: { signal?: AbortSignal } = {}): Promise<PremiumAssistantClientResponse> {
      const token = input.sessionStorage.getItem(USER_ACCESS_TOKEN_KEY);
      if (!token) throw new PremiumAssistantClientError('authentication-required');
      let response: Response;
      try {
        response = await input.fetch(`${baseUrl}/premium-assistant/respond`, {
          method: 'POST',
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: options.signal,
        });
      } catch (error) {
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
      const token = input.sessionStorage.getItem(USER_ACCESS_TOKEN_KEY);
      if (!token) throw new PremiumAssistantClientError('authentication-required');
      let response: Response;
      try {
        response = await input.fetch(baseUrl + '/premium-assistant/sources/' + encodeURIComponent(traceId), {
          method: 'GET',
          credentials: 'include',
          headers: { Authorization: 'Bearer ' + token },
          signal: options.signal,
        });
      } catch (error) {
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
}

export class PremiumAssistantClientError extends Error {
  constructor(readonly reason: 'authentication-required' | 'premium-required' | 'network' | 'provider-unavailable' | 'invalid-response') {
    super(`Premium assistant client failed: ${reason}`);
  }
}
