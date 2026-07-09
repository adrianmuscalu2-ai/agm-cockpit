import { type LanguageCode, translateMessageWithStatus } from './emailLanguage';

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
const defaultTranslationApiBaseUrl = 'http://127.0.0.1:3000/api/v1';
const configuredTranslationApiBaseUrl = viteEnv?.VITE_AGM_API_BASE_URL?.trim();
const translationApiBaseUrl = (configuredTranslationApiBaseUrl || defaultTranslationApiBaseUrl).replace(/\/$/, '');
export const translationEndpointUrl = `${translationApiBaseUrl}/translation/actions/translate-text`;

export async function translateText(request: TranslateRequest): Promise<TranslateResult> {
  const apiResult = await translateWithAgmApi(request);

  if (apiResult.available) {
    return apiResult;
  }

  if (request.sourceLanguage === request.targetLanguage) {
    return {
      text: request.text,
      available: true,
      provider: 'local-fallback',
    };
  }

  const fallback = translateMessageWithStatus(request.text, request.targetLanguage);

  return {
    text: fallback.text,
    available: fallback.available,
    provider: fallback.available ? 'local-fallback' : 'unavailable',
  };
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
      return unavailable(request.text);
    }

    const payload = (await response.json()) as ApiTranslationResponse;
    const translatedText = payload.data?.text?.trim();

    if (!payload.data?.available || !translatedText) {
      return unavailable(request.text);
    }

    return {
      text: translatedText,
      available: true,
      provider: 'agm-api',
    };
  } catch {
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
