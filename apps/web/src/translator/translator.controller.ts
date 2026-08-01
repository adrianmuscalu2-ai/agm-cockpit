import type { LanguageCode } from '../emailLanguage';
import type { TextCorrectorResult } from '../text-corrector/text-corrector.types';
import type { TranslatorState } from '../app-shell/app-state.contract';

export type TranslatorAvailability = 'checking' | 'online' | 'offline';

export type TranslatorResult = {
  text: string;
  available: boolean;
  provider: string;
};

export type TranslatorControllerState = {
  profile: { preferredLanguage: LanguageCode };
  translatorText: string;
  translatorResult: string;
  translatorInternetStatus: TranslatorAvailability;
  translatorAiStatus: TranslatorAvailability;
  translatorServiceStatus: TranslatorAvailability;
  translatorTargetLanguage: LanguageCode;
  ocrImageDataUrl: string;
  ocrExtractedText: string;
  ocrConfidence: number;
  correctorText: string;
  correctorResult: TextCorrectorResult | null;
  recipient: string;
  subject: string;
  message: string;
  targetLanguage: LanguageCode;
  emailComposeMode: 'general' | 'manual';
  selectedEmailTemplateId: string;
  mailReviewOpen: boolean;
  mailSecurityMessages: string[];
  status: string;
};

export type TranslatorControllerDependencies = {
  state: TranslatorControllerState;
  translatorState?: TranslatorState;
  render(): void;
  translate(text: string, sourceLanguage: LanguageCode, targetLanguage: LanguageCode): Promise<TranslatorResult>;
  detectLanguage(text: string, fallback: LanguageCode): LanguageCode;
  correct(request: {
    text: string;
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
    mode: 'correction';
    sourceModule: 'translator';
  }): TextCorrectorResult;
  copy(text: string): Promise<'clipboard' | 'fallback'>;
  saveTranslation(source: string, translation: string): void;
  navigateToEmail(): void;
  message(
    key: string,
    parameters?: Record<string, string | number>,
  ): string;
  languageLabel(language: LanguageCode): string;
};

export function createTranslatorController(dependencies: TranslatorControllerDependencies) {
  const { state } = dependencies;
  const translator = dependencies.translatorState ?? state;

  return {
    async translate(): Promise<void> {
      const source = translator.translatorText.trim();

      if (!source) {
        state.status = dependencies.message('translator.status.enterText');
        dependencies.render();
        return;
      }

      const sourceLanguage = dependencies.detectLanguage(source, state.profile.preferredLanguage);
      const translation = await dependencies.translate(source, sourceLanguage, translator.translatorTargetLanguage);

      if (!translation.available) {
        translator.translatorServiceStatus = 'offline';
        state.status = dependencies.message('translator.status.unavailable', {
          language: dependencies.languageLabel(translator.translatorTargetLanguage),
        });
        translator.translatorResult = dependencies.message('translator.status.unavailableBody');
        dependencies.render();
        return;
      }

      translator.translatorResult = translation.text;
      translator.translatorInternetStatus = 'online';
      translator.translatorAiStatus =
        translation.provider === 'agm-api' ? 'online' : translator.translatorAiStatus;
      translator.translatorServiceStatus = 'online';
      dependencies.saveTranslation(source, translation.text);
      state.status = dependencies.message('translator.status.translated', {
        language: dependencies.languageLabel(translator.translatorTargetLanguage),
        provider: translation.provider,
      });
      dependencies.render();
    },

    correct(): void {
      const text = translator.translatorText.trim();

      if (!text) {
        state.status = dependencies.message('translator.status.enterText');
        dependencies.render();
        return;
      }

      const sourceLanguage = dependencies.detectLanguage(text, state.profile.preferredLanguage);
      const result = dependencies.correct({
        text,
        sourceLanguage,
        targetLanguage: translator.translatorTargetLanguage,
        mode: 'correction',
        sourceModule: 'translator',
      });

      translator.translatorText = result.correctedText;
      state.correctorText = result.originalText;
      state.correctorResult = result;
      state.status = dependencies.message('translator.status.corrected', {
        agent: result.agentId,
        language: dependencies.languageLabel(sourceLanguage),
      });
      dependencies.render();
    },

    clear(): void {
      translator.translatorText = '';
      translator.translatorResult = '';
      state.ocrImageDataUrl = '';
      state.ocrExtractedText = '';
      state.ocrConfidence = 0;
      state.status = dependencies.message('translator.status.cleared');
      dependencies.render();
    },

    async copyResult(): Promise<void> {
      const text = translator.translatorResult.trim() || translator.translatorText.trim();

      if (!text) {
        state.status = dependencies.message('translator.status.noCopyText');
        dependencies.render();
        return;
      }

      const method = await dependencies.copy(text);
      state.status = dependencies.message(
        method === 'clipboard'
          ? 'translator.status.copied'
          : 'translator.status.copiedFallback',
      );
      dependencies.render();
    },

    createEmail(): void {
      const translatedText = translator.translatorResult.trim() || translator.translatorText.trim();

      if (!translatedText) {
        state.status = dependencies.message('translator.status.noEmailText');
        dependencies.render();
        return;
      }

      state.message = translatedText;
      state.targetLanguage = translator.translatorTargetLanguage;
      state.emailComposeMode = 'manual';
      state.selectedEmailTemplateId = '';
      state.mailReviewOpen = false;
      state.mailSecurityMessages = [];
      dependencies.navigateToEmail();
      state.status = dependencies.message('translator.status.emailCreated');
      dependencies.render();
    },
  };
}
