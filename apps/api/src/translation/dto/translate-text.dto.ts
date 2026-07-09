import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const supportedTranslationLanguages = ['ro', 'de', 'en'] as const;
export type TranslationLanguage = (typeof supportedTranslationLanguages)[number];

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
