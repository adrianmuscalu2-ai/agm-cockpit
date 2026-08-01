import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTranslatorController, type TranslatorControllerState } from '../src/translator/translator.controller';

function state(): TranslatorControllerState {
  return {
    profile: { preferredLanguage: 'ro' },
    translatorText: ' Bună ziua ',
    translatorResult: '',
    translatorInternetStatus: 'checking',
    translatorAiStatus: 'checking',
    translatorServiceStatus: 'checking',
    translatorTargetLanguage: 'de',
    ocrImageDataUrl: 'image',
    ocrExtractedText: 'Bună ziua',
    ocrConfidence: 97,
    correctorText: '',
    correctorResult: null,
    recipient: '',
    subject: '',
    message: '',
    targetLanguage: 'ro',
    emailComposeMode: 'general',
    selectedEmailTemplateId: 'legacy',
    mailReviewOpen: true,
    mailSecurityMessages: ['legacy'],
    status: '',
  };
}

function harness(current = state()) {
  let renders = 0;
  let saved: [string, string] | undefined;
  let navigated = false;
  let copied = '';
  const controller = createTranslatorController({
    state: current,
    render: () => { renders += 1; },
    translate: async () => ({ text: 'Guten Tag', available: true, provider: 'agm-api' }),
    detectLanguage: () => 'ro',
    correct: (request) => ({
      ...request,
      originalText: request.text,
      correctedText: 'Bună ziua',
      agentId: 'AG-011-011A',
      confidence: 1,
      warnings: [],
    }),
    copy: async (text) => { copied = text; return 'clipboard'; },
    saveTranslation: (source, translation) => { saved = [source, translation]; },
    navigateToEmail: () => { navigated = true; },
    message: (key) => key,
    languageLabel: (language) => language,
  });
  return {
    controller,
    current,
    renders: () => renders,
    saved: () => saved,
    navigated: () => navigated,
    copied: () => copied,
  };
}

const translated = harness();
await translated.controller.translate();
assert.equal(translated.current.translatorResult, 'Guten Tag');
assert.equal(translated.current.translatorInternetStatus, 'online');
assert.equal(translated.current.translatorAiStatus, 'online');
assert.equal(translated.current.translatorServiceStatus, 'online');
assert.deepEqual(translated.saved(), ['Bună ziua', 'Guten Tag']);
assert.equal(translated.renders(), 1);

const corrected = harness();
corrected.controller.correct();
assert.equal(corrected.current.translatorText, 'Bună ziua');
assert.equal(corrected.current.correctorText, 'Bună ziua');
assert.equal(corrected.current.status, 'translator.status.corrected');

const copied = harness();
await copied.controller.copyResult();
assert.equal(copied.copied(), 'Bună ziua');
assert.equal(copied.current.status, 'translator.status.copied');

const email = harness();
email.current.translatorResult = 'Guten Tag';
email.controller.createEmail();
assert.equal(email.current.message, 'Guten Tag');
assert.equal(email.current.targetLanguage, 'de');
assert.equal(email.current.emailComposeMode, 'manual');
assert.equal(email.navigated(), true);

const cleared = harness();
cleared.controller.clear();
assert.equal(cleared.current.translatorText, '');
assert.equal(cleared.current.translatorResult, '');
assert.equal(cleared.current.ocrImageDataUrl, '');
assert.equal(cleared.current.ocrConfidence, 0);

const empty = harness();
empty.current.translatorText = ' ';
await empty.controller.translate();
assert.equal(empty.current.status, 'translator.status.enterText');

const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert.match(mainSource, /createTranslatorController\(\{/);
assert.match(mainSource, /await translatorController\.translate\(\)/);
assert.match(mainSource, /translatorController\.correct\(\)/);
assert.match(mainSource, /translatorController\.clear\(\)/);
assert.match(mainSource, /await translatorController\.copyResult\(\)/);
assert.match(mainSource, /translatorController\.createEmail\(\)/);
assert.doesNotMatch(mainSource, /state\.translatorResult = translation\.text/);

console.log('SR-07A Translator controller characterization: PASS');
