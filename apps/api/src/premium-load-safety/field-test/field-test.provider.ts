import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fieldTestReportSchema } from './field-test.schema';
import type { FieldTestInput, FieldTestPhoto, FieldTestReport } from './field-test.types';
import { parseFieldReport } from './field-test.validation';

type OpenAiResponsePayload = { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
const languageNames: Record<string, string> = { ro:'Romanian',de:'German',en:'English',fr:'French',nl:'Dutch',ru:'Russian',pl:'Polish',tr:'Turkish',sq:'Albanian',it:'Italian',es:'Spanish',sv:'Swedish' };

@Injectable()
export class FieldTestProvider {
  constructor(private readonly config: ConfigService) {}

  async analyze(photos: FieldTestPhoto[], input: FieldTestInput, language: string): Promise<FieldTestReport | undefined> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return undefined;
    const imageContent = photos.map((photo) => ({
      type: 'input_image',
      image_url: `data:${photo.mimetype};base64,${photo.buffer.toString('base64')}`,
      detail: 'high',
    }));
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
                  'You are AGM, an advisory visual copilot for professional drivers.',
                  'All supplied photographs belong to one cargo-securing case and are ordered exactly as listed in the user message.',
                  'Compare the two required lateral views and any optional views or details. Report contradictions instead of merging incompatible observations.',
                  'Never certify safety or legal compliance. Never invent counts, LC, STF, weight, friction, angles, capacities, or hidden components.',
                  'Observed certainty requires direct visibility and at least one photo source plus the exact photo role.',
                  'User declarations are not visual observations. Confirmed OCR values may be used only when ocrConfirmed is true.',
                  'Never assume that a hidden opposite side matches a visible side. Treat confirmed-symmetric only as an explicit driver declaration, never as a photo observation.',
                  'Every item without photo in sources must have an empty photoRoles array.',
                  'When ocrConfirmed is true and LC or STF is supplied, include an observation sourced from confirmed-ocr and explain that the driver confirmed or corrected it.',
                  'If a value or element cannot be verified, mark it undetermined with unknown as a source.',
                  'Explain every item in simple educational language. Recommendations are advisory, not commands.',
                  `Write in ${languageNames[language] ?? languageNames.ro}.`,
                ].join(' '),
              }],
            },
            {
              role: 'user',
              content: [
                { type: 'input_text', text: `Photo order and roles: ${JSON.stringify(photos.map((photo) => photo.role))}\nConfirmed driver input: ${JSON.stringify(input)}` },
                ...imageContent,
              ],
            },
          ],
          text: { format: { type: 'json_schema', name: 'field_test_report', strict: true, schema: fieldTestReportSchema } },
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        console.error(`OpenAI field test failed with HTTP ${response.status}.`);
        return undefined;
      }
      return parseFieldReport(extract((await response.json()) as OpenAiResponsePayload));
    } catch (error) {
      console.error('OpenAI field test failed.', error instanceof Error ? { type: error.name, message: error.message.slice(0, 200) } : { type: 'UnknownError' });
      return undefined;
    }
  }
}

function extract(payload: OpenAiResponsePayload) {
  if (payload.output_text?.trim()) return payload.output_text.trim();
  for (const output of payload.output ?? []) for (const content of output.content ?? []) if (content.text?.trim()) return content.text.trim();
  return undefined;
}
