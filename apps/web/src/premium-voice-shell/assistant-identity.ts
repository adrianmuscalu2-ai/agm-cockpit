import type { BasicLanguageCode } from '../language-registry';

export const AGMA_ASSISTANT_NAME = 'AGMa' as const;

const identityQuestions: Readonly<Record<BasicLanguageCode, readonly RegExp[]>> = {
  ro: [/\bcum te cheama\b/u, /\bcum iti spune\b/u, /\bcine esti\b/u],
  de: [/\bwie heisst du\b/u, /\bwie ist dein name\b/u, /\bwer bist du\b/u],
  en: [/\bwhat is your name\b/u, /\bwhats your name\b/u, /\bwho are you\b/u],
  fr: [/\bcomment tu t appelles\b/u, /\bcomment vous appelez vous\b/u, /\bqui es tu\b/u],
  nl: [/\bhoe heet je\b/u, /\bwat is je naam\b/u, /\bwie ben je\b/u],
  ru: [/как тебя зовут/u, /как вас зовут/u, /кто ты/u],
  pl: [/\bjak masz na imie\b/u, /\bjak sie nazywasz\b/u, /\bkim jestes\b/u],
  tr: [/\badin ne\b/u, /\bsenin adin ne\b/u, /\bkimsin\b/u],
  sq: [/\bsi quhesh\b/u, /\bcili eshte emri yt\b/u, /\bkush je\b/u],
  it: [/\bcome ti chiami\b/u, /\bqual e il tuo nome\b/u, /\bchi sei\b/u],
  es: [/\bcomo te llamas\b/u, /\bcual es tu nombre\b/u, /\bquien eres\b/u],
  sv: [/\bvad heter du\b/u, /\bvad ar ditt namn\b/u, /\bvem ar du\b/u],
};

function semanticText(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/ı/g, 'i')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalizeAgmaAssistantName(value: string): string {
  return value
    .replace(/\ba\s*[.\-]?\s*g\s*[.\-]?\s*m\s*[.\-]?\s*a\b/giu, AGMA_ASSISTANT_NAME)
    .replace(/\bagmeni\b/giu, AGMA_ASSISTANT_NAME)
    .replace(/\bagma\b/giu, AGMA_ASSISTANT_NAME);
}

export function assistantIdentityAnswer(value: string, language: BasicLanguageCode): string | null {
  const normalized = semanticText(canonicalizeAgmaAssistantName(value));
  return identityQuestions[language].some(pattern => pattern.test(normalized)) ? `${AGMA_ASSISTANT_NAME}.` : null;
}

export function withAgmaAssistantName<T extends Record<string, string>>(messages: T): T {
  return Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [key, value.replace(/\bAGM\b/g, AGMA_ASSISTANT_NAME)]),
  ) as T;
}

export function assistantTextForSpeech(value: string): string {
  // Title case makes TTS engines speak the persona as one word instead of
  // expanding the uppercase company acronym letter by letter.
  return value.replace(/\bAGMa\b/g, 'Agma');
}
