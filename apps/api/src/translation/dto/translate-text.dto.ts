import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  supportedTranslationLanguages,
  type TranslationLanguage,
} from './translation-languages';
export { supportedTranslationLanguages, type TranslationLanguage } from './translation-languages';

export class TranslateTextDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;

  @IsIn(supportedTranslationLanguages)
  sourceLanguage!: TranslationLanguage;

  @IsIn(supportedTranslationLanguages)
  targetLanguage!: TranslationLanguage;
}
