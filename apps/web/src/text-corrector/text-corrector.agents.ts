import { type LanguageCode } from '../emailLanguage';
import {
  type TextCorrectorAgent,
  type TextCorrectorAgentId,
  type TextCorrectorRequest,
  type TextCorrectorResult,
} from './text-corrector.types';

const roDePairs = [['ro', 'de'], ['de', 'ro']] as Array<Readonly<[LanguageCode, LanguageCode]>>;
const roEnPairs = [['ro', 'en'], ['en', 'ro']] as Array<Readonly<[LanguageCode, LanguageCode]>>;
const deEnPairs = [['de', 'en'], ['en', 'de']] as Array<Readonly<[LanguageCode, LanguageCode]>>;

export const textCorrectorAgents: TextCorrectorAgent[] = [
  createAgent('AG-011-011A', roDePairs),
  createAgent('AG-011-011B', roEnPairs),
  createAgent('AG-011-011C', deEnPairs),
];

function createAgent(id: TextCorrectorAgentId, supportedPairs: Array<Readonly<[LanguageCode, LanguageCode]>>): TextCorrectorAgent {
  return {
    id,
    supportedPairs,
    canHandle(request) {
      return supportsPair(supportedPairs, request.sourceLanguage, request.targetLanguage);
    },
    correct(request) {
      return createMvpCorrectionResult(request, id);
    },
  };
}

function supportsPair(supportedPairs: Array<Readonly<[LanguageCode, LanguageCode]>>, sourceLanguage: LanguageCode, targetLanguage: LanguageCode) {
  return supportedPairs.some(([source, target]) => source === sourceLanguage && target === targetLanguage);
}

function createMvpCorrectionResult(request: TextCorrectorRequest, agentId: TextCorrectorAgentId): TextCorrectorResult {
  const correctedText = normalizeText(request.text, request.sourceLanguage, request.mode);

  return {
    originalText: request.text,
    correctedText,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    mode: request.mode,
    sourceModule: request.sourceModule,
    agentId,
    confidence: correctedText === request.text ? 0.72 : 0.78,
    warnings: ['textCorrector.warning.mvpAgent'],
  };
}

function normalizeText(text: string, language: LanguageCode, mode: TextCorrectorRequest['mode']) {
  const compact = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])([^\s\n])/g, '$1 $2')
    .trim();

  if (!compact) {
    return '';
  }

  return compact
    .split('\n')
    .map((line) => normalizeSentenceLine(applyLanguageCorrections(line, language, mode)))
    .join('\n');
}

function normalizeSentenceLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed) {
    return '';
  }

  const capitalized = trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function applyLanguageCorrections(text: string, language: LanguageCode, mode: TextCorrectorRequest['mode']) {
  const withoutDuplicates = text.replace(/\b(\p{L}+)\s+\1\b/giu, '$1');
  const corrected = replacementsFor(language).reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    withoutDuplicates,
  );

  if (mode === 'professional') {
    return professionalize(corrected, language);
  }

  if (mode === 'simplification') {
    return simplify(corrected, language);
  }

  return corrected;
}

function replacementsFor(language: LanguageCode): Array<[RegExp, string]> {
  if (language === 'de') {
    return [
      [/\bich bin man\b/gi, 'ich bin angekommen'],
      [/\bbitte schicken dokumente\b/gi, 'bitte schicken Sie die Dokumente'],
      [/\bfahrzeug ist fertig\b/gi, 'das Fahrzeug ist bereit'],
    ];
  }

  if (language === 'en') {
    return [
      [/\bi am arrive\b/gi, 'I have arrived'],
      [/\bplease send documents\b/gi, 'please send the documents'],
      [/\bcar is ready\b/gi, 'the vehicle is ready'],
    ];
  }

  return [
    [/\bami\b/gi, 'am'],
    [/\bsalutare\b/gi, 'buna ziua'],
    [/\bmasina\b/gi, 'vehiculul'],
    [/\bva rog trimiteti\b/gi, 'va rog sa trimiteti'],
  ];
}

function professionalize(text: string, language: LanguageCode) {
  if (/^(buna ziua|guten tag|hello|dear|stimate|sehr geehrte)/i.test(text.trim())) {
    return text;
  }

  if (language === 'de') return `Guten Tag, ${lowercaseFirst(text)}`;
  if (language === 'en') return `Hello, ${lowercaseFirst(text)}`;
  return `Buna ziua, ${lowercaseFirst(text)}`;
}

function simplify(text: string, language: LanguageCode) {
  const simplified = text
    .replace(/\bva rog sa imi transmiteti\b/gi, 'va rog sa trimiteti')
    .replace(/\bplease let me know\b/gi, 'please tell me')
    .replace(/\bbitte teilen Sie mir mit\b/gi, 'bitte sagen Sie mir');

  if (language === 'de') return simplified.replace(/\bFahrzeugtransport\b/g, 'Transport');
  if (language === 'en') return simplified.replace(/\bvehicle transport\b/gi, 'transport');
  return simplified.replace(/\btransportul vehiculului\b/gi, 'transportul');
}

function lowercaseFirst(text: string) {
  const trimmed = text.trim();
  return trimmed.charAt(0).toLocaleLowerCase() + trimmed.slice(1);
}
