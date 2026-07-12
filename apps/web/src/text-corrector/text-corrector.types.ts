import { type LanguageCode } from '../emailLanguage';

export type TextCorrectorMode = 'correction' | 'improvement' | 'professional' | 'simplification';

export type TextCorrectorSourceModule = 'translator' | 'mailmaster' | 'document-assistant' | 'standalone';

export interface TextCorrectorRequest {
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  mode: TextCorrectorMode;
  sourceModule: TextCorrectorSourceModule;
}

export interface TextCorrectorResult {
  originalText: string;
  correctedText: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  mode: TextCorrectorMode;
  sourceModule: TextCorrectorSourceModule;
  agentId: TextCorrectorAgentId;
  confidence: number;
  warnings: string[];
}

export type TextCorrectorAgentId = 'AG-011-011A' | 'AG-011-011B' | 'AG-011-011C';

export interface TextCorrectorAgent {
  id: TextCorrectorAgentId;
  supportedPairs: Array<Readonly<[LanguageCode, LanguageCode]>>;
  canHandle(request: TextCorrectorRequest): boolean;
  correct(request: TextCorrectorRequest): TextCorrectorResult;
}
