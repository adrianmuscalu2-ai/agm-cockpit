import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LoadSafetyAnalysis, UploadedImage } from '../premium-load-safety.types';
import { securingRecommendationSchema } from './securing-recommendation.schema';
import type {
  SecuringRecommendation,
  SecuringRecommendationInput,
} from './securing-recommendation.types';
import { parseSecuringRecommendation } from './securing-recommendation.validation';

type OpenAiResponsePayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

const languageNames: Record<string, string> = { ro: 'Romanian', de: 'German', en: 'English' };

@Injectable()
export class SecuringRecommendationProvider {
  constructor(private readonly config: ConfigService) {}

  async recommend(
    image: UploadedImage,
    language: string,
    input: SecuringRecommendationInput,
    visualAnalysis?: LoadSafetyAnalysis,
  ): Promise<SecuringRecommendation | undefined> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return undefined;

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_LOAD_SAFETY_MODEL', 'gpt-4.1-mini'),
          input: [
            {
              role: 'system',
              content: [{
                type: 'input_text',
                text: [
                  'You are AGM, an educational copilot for professional drivers.',
                  'Observe, explain, and recommend; never decide, certify safety, or claim legal compliance.',
                  'Use only the image, explicitly user-declared data, and clearly identified general good practice.',
                  'Never infer LC or STF from appearance. Use them only when declared by the user or clearly readable on a label.',
                  'If LC or STF cannot be confirmed, explicitly say they cannot be confirmed and the strap labels must be checked.',
                  'The lcStf array must always contain at least one item. Even when values are declared, explain that visual confirmation still requires a clearly readable label.',
                  'Count visible straps only when reasonably visible. Otherwise estimatedCount must be null.',
                  'estimatedCount is exclusively a count from the pixels in the image. Never copy or reconcile it with availableStraps or any other user-declared number.',
                  'A visible-strap count observation must use only visual as its source. If user-declared data influenced it, estimatedCount must be null.',
                  'Use observed certainty only for facts directly visible in the image. User-declared facts must not be labeled observed.',
                  'recommendedCount must be null unless weight, cargo type, dimensions, vehicle, securing method, friction information, and usable equipment provide enough data. Do not perform or imitate a normative calculation.',
                  'Discuss apparent strap distribution, positioning, uniform tension, anchoring angles, anchor points, edge protection, anti-slip materials, and longitudinal/lateral stops.',
                  'Every conclusion needs a simple educational explanation and one or more truthful sources.',
                  'Use certainty observed only for directly visible facts, probable only for supported inference, and undetermined when the image or data is insufficient.',
                  `Write in ${languageNames[language] ?? languageNames.ro}.`,
                ].join(' '),
              }],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `User-declared data: ${JSON.stringify(input)}\nExisting advisory visual analysis: ${JSON.stringify(visualAnalysis ?? null)}`,
                },
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
              name: 'securing_recommendation',
              strict: true,
              schema: securingRecommendationSchema,
            },
          },
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(timeoutMs(this.config.get<string>('OPENAI_LOAD_SAFETY_TIMEOUT_MS'))),
      });
      if (!response.ok) {
        console.error(`OpenAI securing recommendation failed with HTTP ${response.status}.`);
        return undefined;
      }
      return parseSecuringRecommendation(extractText((await response.json()) as OpenAiResponsePayload));
    } catch (error) {
      console.error('OpenAI securing recommendation failed.', safeError(error));
      return undefined;
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

function timeoutMs(value: string | undefined) {
  const parsed = Number(value ?? 60_000);
  return Number.isFinite(parsed) ? Math.min(120_000, Math.max(15_000, parsed)) : 60_000;
}

function safeError(error: unknown) {
  return error instanceof Error ? { type: error.name, message: error.message.slice(0, 200) } : { type: 'UnknownError' };
}
