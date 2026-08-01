import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranslationProvider, TranslationRequest, TranslationResult } from './translation.types';
import { TRANSLATION_CONTRACT } from './translation.contract';

const languageNames = {
  ro: 'Romanian',
  de: 'German',
  en: 'English',
};

type OpenAiResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

@Injectable()
export class OpenAiTranslationProvider implements TranslationProvider {
  constructor(private readonly config: ConfigService) {}

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const timeoutMs = translationTimeoutMs(this.config.get<string>('OPENAI_TRANSLATION_TIMEOUT_MS'));

    if (!apiKey) {
      console.error('OpenAI translation is unavailable: OPENAI_API_KEY is not configured.');
      return {
        text: request.text,
        available: false,
        provider: 'unavailable',
      };
    }

    const startedAt = performance.now();

    try {
      const response = await fetch(TRANSLATION_CONTRACT.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_TRANSLATION_MODEL', TRANSLATION_CONTRACT.defaultModel),
          input: [
            {
              role: 'system',
              content:
                'You are a professional translation engine for vehicle transport operations. Translate only the user text. Preserve meaning, dates, addresses, names, vehicle data, VINs, license plates, numbers, and line breaks. Do not add explanations.',
            },
            {
              role: 'user',
              content: `Translate from ${languageNames[request.sourceLanguage]} to ${languageNames[request.targetLanguage]}:\n\n${request.text}`,
            },
          ],
          temperature: 0,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const responseBody = await response.text();
        console.error(
          `OpenAI translation request failed with HTTP ${response.status}: ${summarizeProviderError(responseBody)}`,
        );
        return {
          text: request.text,
          available: false,
          provider: 'unavailable',
        };
      }

      const payload = (await response.json()) as OpenAiResponsePayload;
      const translatedText = extractTranslatedText(payload);

      if (!translatedText) {
        return {
          text: request.text,
          available: false,
          provider: 'unavailable',
        };
      }

      return {
        text: translatedText,
        available: true,
        provider: 'openai',
      };
    } catch (error) {
      console.error('OpenAI translation request failed.', safeErrorDetails(error));
      return {
        text: request.text,
        available: false,
        provider: 'unavailable',
      };
    } finally {
      console.info(`OPENAI TRANSLATION DURATION: ${Math.round(performance.now() - startedAt)}ms`);
    }
  }
}

function safeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) return { type: 'UnknownError' };
  return {
    type: error.name,
    message: error.message.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').slice(0, 200),
  };
}

function translationTimeoutMs(configuredValue: string | undefined) {
  const value = Number(configuredValue ?? TRANSLATION_CONTRACT.defaultTimeoutMs);
  return Number.isFinite(value)
    ? Math.min(TRANSLATION_CONTRACT.maximumTimeoutMs, Math.max(TRANSLATION_CONTRACT.minimumTimeoutMs, value))
    : TRANSLATION_CONTRACT.defaultTimeoutMs;
}

function summarizeProviderError(responseBody: string) {
  if (!responseBody) return 'empty response body';

  try {
    const payload = JSON.parse(responseBody) as { error?: { code?: string; message?: string; type?: string } };
    const error = payload.error;
    return [error?.type, error?.code].filter(Boolean).join(' | ') || 'provider error response';
  } catch {
    return 'non-JSON provider error response';
  }
}

function extractTranslatedText(payload: OpenAiResponsePayload): string | undefined {
  const directOutputText = payload.output_text?.trim();

  if (directOutputText) {
    return directOutputText;
  }

  for (const outputItem of payload.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      const nestedText = contentItem.text?.trim();

      if (nestedText) {
        return nestedText;
      }
    }
  }

  return undefined;
}
