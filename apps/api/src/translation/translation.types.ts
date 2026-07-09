import { TranslationLanguage } from './dto/translate-text.dto';

export interface TranslationRequest {
  text: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
}

export interface TranslationResult {
  text: string;
  available: boolean;
  provider: 'openai' | 'unavailable';
}

export interface TranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}
