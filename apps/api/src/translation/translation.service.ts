import { Injectable } from '@nestjs/common';
import { TranslateTextDto } from './dto/translate-text.dto';
import { OpenAiTranslationProvider } from './openai-translation.provider';
import { TranslationResult } from './translation.types';
import { TRANSLATION_CONTRACT } from './translation.contract';

@Injectable()
export class TranslationService {
  private healthCache?: { expiresAt: number; result: { status: 'available' | 'unavailable'; provider: string; functional: boolean } };

  constructor(private readonly openAiProvider: OpenAiTranslationProvider) {}

  async translateText(dto: TranslateTextDto): Promise<TranslationResult> {
    if (dto.sourceLanguage === dto.targetLanguage) {
      return {
        text: dto.text,
        available: true,
        provider: 'openai',
      };
    }

    return this.openAiProvider.translate(dto);
  }

  async functionalHealth() {
    const now = Date.now();
    if (this.healthCache && this.healthCache.expiresAt > now) {
      return this.healthCache.result;
    }

    const probe = await this.openAiProvider.translate({
      text: 'Operational check',
      sourceLanguage: 'en',
      targetLanguage: 'de',
    });
    const functional =
      probe.available &&
      probe.provider === 'openai' &&
      Boolean(probe.text.trim()) &&
      probe.text.trim().toLocaleLowerCase() !== 'operational check';
    const result = {
      status: functional ? ('available' as const) : ('unavailable' as const),
      provider: probe.provider,
      functional,
    };
    this.healthCache = { expiresAt: now + TRANSLATION_CONTRACT.healthCacheMs, result };
    return result;
  }
}
