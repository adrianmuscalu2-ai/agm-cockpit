import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  LoadSafetyAnalysisResult,
  UploadedImage,
} from './premium-load-safety.types';
import { parseLoadSafetyAnalysisJson } from './premium-load-safety.validation';

type OpenAiResponsePayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

const languageNames: Record<string, string> = {
  ro: 'Romanian',
  de: 'German',
  en: 'English',
  fr: 'French', nl: 'Dutch', ru: 'Russian', pl: 'Polish', tr: 'Turkish', sq: 'Albanian',
  it: 'Italian', es: 'Spanish', sv: 'Swedish',
};

@Injectable()
export class PremiumLoadSafetyProvider {
  constructor(private readonly config: ConfigService) {}

  async analyze(image: UploadedImage, language: string): Promise<LoadSafetyAnalysisResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return unavailable();

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_LOAD_SAFETY_MODEL', 'gpt-4.1-mini'),
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text: [
                    'You are an advisory visual assistant for road cargo securing.',
                    'Inspect only what is visible in the supplied image.',
                    'Consider cargo positioning, apparent need for straps, anti-slip mats, visible anchoring points, and observable risks.',
                    'Never claim legal compliance, safety certification, load weight, strap capacity, or facts not visible.',
                    `Write every observation in ${languageNames[language] ?? languageNames.ro}.`,
                    'Return concise, practical observations in the required JSON categories.',
                  ].join(' '),
                },
              ],
            },
            {
              role: 'user',
              content: [
                { type: 'input_text', text: 'Analyze this cargo-securing image.' },
                {
                  type: 'input_image',
                  image_url: `data:${image.mimetype};base64,${image.buffer.toString('base64')}`,
                  detail: 'high',
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'load_safety_analysis',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  correct: { type: 'array', items: { type: 'string' } },
                  recommendations: { type: 'array', items: { type: 'string' } },
                  risks: { type: 'array', items: { type: 'string' } },
                },
                required: ['correct', 'recommendations', 'risks'],
              },
            },
          },
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(loadSafetyTimeoutMs(this.config.get<string>('OPENAI_LOAD_SAFETY_TIMEOUT_MS'))),
      });

      if (!response.ok) {
        console.error(`OpenAI load safety request failed with HTTP ${response.status}.`);
        return unavailable();
      }

      const payload = (await response.json()) as OpenAiResponsePayload;
      const analysis = parseLoadSafetyAnalysisJson(extractText(payload));
      return analysis ? { available: true, analysis, provider: 'openai' } : unavailable();
    } catch (error) {
      console.error('OpenAI load safety request failed.', safeErrorDetails(error));
      return unavailable();
    }
  }
}

function extractText(payload: OpenAiResponsePayload) {
  if (payload.output_text?.trim()) return payload.output_text.trim();
  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.text?.trim()) return content.text.trim();
    }
  }
  return undefined;
}

function loadSafetyTimeoutMs(value: string | undefined) {
  const parsed = Number(value ?? 45_000);
  return Number.isFinite(parsed) ? Math.min(90_000, Math.max(10_000, parsed)) : 45_000;
}

function unavailable(): LoadSafetyAnalysisResult {
  return { available: false, provider: 'unavailable' };
}

function safeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) return { type: 'UnknownError' };
  return { type: error.name, message: error.message.slice(0, 200) };
}
