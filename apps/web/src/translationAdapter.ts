import { type LanguageCode, translateMessageWithStatus } from './emailLanguage';
import { recordRoutingMetric, routeDeviceOperation } from './device-capability-router/device-capability.runtime';

export interface TranslateRequest {
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

export interface TranslateResult {
  text: string;
  available: boolean;
  provider: 'agm-api' | 'local-fallback' | 'unavailable';
}

interface ApiTranslationResponse {
  data?: {
    text?: string;
    available?: boolean;
    provider?: string;
  };
}

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const configuredTranslationApiBaseUrl = viteEnv?.VITE_AGM_API_BASE_URL?.trim();
const developmentTranslationApiBaseUrl = import.meta.env.DEV ? '/api/v1' : undefined;
const translationApiBaseUrl = (developmentTranslationApiBaseUrl || configuredTranslationApiBaseUrl)?.replace(/\/$/, '');

if (!translationApiBaseUrl) {
  throw new Error('VITE_AGM_API_BASE_URL is required outside development.');
}

export const translationEndpointUrl = `${translationApiBaseUrl}/translation/actions/translate-text`;
export const translationLiveEndpointUrl = `${translationApiBaseUrl}/health/live`;
export const translationReadyEndpointUrl = `${translationApiBaseUrl}/health/ready`;
export const translationFunctionalHealthEndpointUrl = `${translationApiBaseUrl}/translation/health`;

export async function translateText(request: TranslateRequest): Promise<TranslateResult> {
  const fallback = translateMessageWithStatus(request.text, request.targetLanguage);
  const localResult: TranslateResult = request.sourceLanguage === request.targetLanguage
    ? { text: request.text, available: true, provider: 'local-fallback' }
    : { text: fallback.text, available: fallback.available, provider: fallback.available ? 'local-fallback' : 'unavailable' };
  const decision = await routeDeviceOperation({
    operation: 'SIMPLE_TRANSLATION',
    sensitivity: 'USER_TEXT',
    localCandidateAvailable: localResult.available,
  });

  if (decision.authority === 'LOCAL_DEVICE') {
    recordRoutingMetric({
      operation: 'SIMPLE_TRANSLATION', authority: 'LOCAL_DEVICE', executionMode: decision.executionMode,
      decisionLatencyMs: decision.decisionLatencyMs, executionLatencyMs: 0, success: true,
      fallbackUsed: false, atEpochMs: Date.now(),
    });
    return localResult;
  }

  if (decision.authority === 'AGM_AI') {
    const startedAt = performance.now();
    const apiResult = await translateWithAgmApi(request);
    recordRoutingMetric({
      operation: 'SIMPLE_TRANSLATION', authority: 'AGM_AI', executionMode: decision.executionMode,
      decisionLatencyMs: decision.decisionLatencyMs, executionLatencyMs: performance.now() - startedAt,
      success: apiResult.available, fallbackUsed: !apiResult.available && localResult.available, atEpochMs: Date.now(),
    });
    if (apiResult.available) return apiResult;
  }

  return localResult;
}

async function translateWithAgmApi(request: TranslateRequest): Promise<TranslateResult> {
  try {
    const response = await fetch(translationEndpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      console.error(`Translation API returned HTTP ${response.status} from ${translationEndpointUrl}.`);
      return unavailable(request.text);
    }

    const payload = (await response.json()) as ApiTranslationResponse;
    const translatedText = payload.data?.text?.trim();

    if (!payload.data?.available || !translatedText) {
      console.error(`Translation provider is unavailable through ${translationEndpointUrl}.`);
      return unavailable(request.text);
    }

    return {
      text: translatedText,
      available: true,
      provider: 'agm-api',
    };
  } catch (error) {
    console.error(`Translation API request failed for ${translationEndpointUrl}.`, error);
    return unavailable(request.text);
  }
}

function unavailable(text: string): TranslateResult {
  return {
    text,
    available: false,
    provider: 'unavailable',
  };
}
