import { Module } from '@nestjs/common';
import { OpenAiTranslationProvider } from './openai-translation.provider';
import { TranslationController } from './translation.controller';
import { TranslationService } from './translation.service';

@Module({
  controllers: [TranslationController],
  providers: [OpenAiTranslationProvider, TranslationService],
  exports: [TranslationService],
})
export class TranslationModule {}
