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
  contractVersion: 'premium-assistant.v1';
  kind: 'answer' | 'clarification';
  text: string;
  provider: 'openai';
  productId: 'agm-cockpit';
  moduleId: string;
  contextRefs: readonly string[];
  externalEffectPerformed: false;
};

export function createPremiumAssistantClient(input: {
  apiBaseUrl: string;
  fetch: typeof fetch;
  sessionStorage: Pick<Storage, 'getItem'>;
}) {
  const baseUrl = input.apiBaseUrl.trim().replace(/\/$/, '');
  return {
    async respond(request: PremiumAssistantClientRequest): Promise<PremiumAssistantClientResponse> {
      const token = input.sessionStorage.getItem(USER_ACCESS_TOKEN_KEY);
      if (!token) throw new PremiumAssistantClientError('authentication-required');
      let response: Response;
      try {
        response = await input.fetch(`${baseUrl}/premium-assistant/respond`, {
          method: 'POST',
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });
      } catch {
        throw new PremiumAssistantClientError('network');
      }
      if (response.status === 401) throw new PremiumAssistantClientError('authentication-required');
      if (response.status === 403) throw new PremiumAssistantClientError('premium-required');
      if (!response.ok) throw new PremiumAssistantClientError('provider-unavailable');
      const envelope = await response.json().catch(() => ({})) as { data?: PremiumAssistantClientResponse };
      const value = envelope.data;
      if (!value || value.contractVersion !== 'premium-assistant.v1' || value.externalEffectPerformed !== false || !value.text?.trim()) {
        throw new PremiumAssistantClientError('invalid-response');
      }
      return value;
    },
  };
}

export class PremiumAssistantClientError extends Error {
  constructor(readonly reason: 'authentication-required' | 'premium-required' | 'network' | 'provider-unavailable' | 'invalid-response') {
    super(`Premium assistant client failed: ${reason}`);
  }
}

