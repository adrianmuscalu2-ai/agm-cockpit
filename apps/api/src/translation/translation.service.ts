import { Injectable } from '@nestjs/common';
import { TranslateTextDto } from './dto/translate-text.dto';
import { OpenAiTranslationProvider } from './openai-translation.provider';
import { TranslationResult } from './translation.types';

@Injectable()
export class TranslationService {
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
}
