import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { basicLanguageCodes, type BasicLanguageCode } from '../src/language-registry';
import { premiumAssistantUiMessages } from '../src/premium-voice-shell/premium-assistant-ui.i18n';
import { handsfreeText } from '../src/premium-voice-shell/premium-handsfree';
import { premiumVoiceShellMessage } from '../src/premium-voice-shell/premium-voice-shell.i18n';
import { copilotKeys, copilotText } from '../src/premium-copilot/copilot.i18n';
import {
  AGMA_ASSISTANT_NAME,
  assistantIdentityAnswer,
  assistantTextForSpeech,
  canonicalizeAgmaAssistantName,
  withAgmaAssistantName,
} from '../src/premium-voice-shell/assistant-identity';

const questions: Readonly<Record<BasicLanguageCode, string>> = {
  ro: 'Cum te cheamă?', de: 'Wie heißt du?', en: 'What is your name?', fr: "Comment tu t'appelles ?",
  nl: 'Hoe heet je?', ru: 'Как тебя зовут?', pl: 'Jak masz na imię?', tr: 'Senin adın ne?',
  sq: 'Si quhesh?', it: 'Come ti chiami?', es: '¿Cómo te llamas?', sv: 'Vad heter du?',
};

assert.equal(AGMA_ASSISTANT_NAME, 'AGMa');
for (const sample of ['agma, deschide', 'AGMa, deschide', 'A G M A, deschide', 'a-g-m-a, deschide', 'agmeni, deschide']) {
  assert.equal(canonicalizeAgmaAssistantName(sample), 'AGMa, deschide', `Canonical STT alias: ${sample}`);
}
for (const language of basicLanguageCodes) {
  assert.equal(assistantIdentityAnswer(questions[language], language), 'AGMa.', `Self-identification: ${language}`);
  const visibleMessages = withAgmaAssistantName(premiumAssistantUiMessages[language]);
  assert.match(Object.values(visibleMessages).join('\n'), /AGMa/u, `Visible persona label: ${language}`);
  assert.doesNotMatch(Object.values(visibleMessages).join('\n'), /\bAGM\b/u, `No acronym persona label: ${language}`);
  assert.match(handsfreeText[language].standby, /AGMa/u, `Hands-free standby: ${language}`);
  assert.doesNotMatch(handsfreeText[language].standby, /\bAGM\b/u, `No acronym in standby: ${language}`);
  assert.match(premiumVoiceShellMessage(language, 'title'), /AGMa/u, `Voice invocation title: ${language}`);
  assert.doesNotMatch(premiumVoiceShellMessage(language, 'title'), /\bAGM\b/u, `No acronym in voice invocation title: ${language}`);
  const copilotPersona = copilotKeys.map(key => copilotText(language, key)).join('\n');
  assert.match(copilotPersona, /AGMa/u, `Copilot persona identity: ${language}`);
  assert.doesNotMatch(copilotPersona, /\bAGM\b/u, `No acronym persona identity in Copilot: ${language}`);
}
assert.equal(assistantTextForSpeech('AGMa.'), 'Agma.');
assert.equal(assistantTextForSpeech('AGM Transport și AGMa.'), 'AGM Transport și Agma.');

const androidStrings = readFileSync(resolve('android/app/src/main/res/values/strings.xml'), 'utf8');
const androidManifest = readFileSync(resolve('android/app/src/main/AndroidManifest.xml'), 'utf8');
const runtime = readFileSync(resolve('src/premium-voice-shell/premium-assistant.runtime.ts'), 'utf8');
const copilot = readFileSync(resolve('src/premium-copilot/copilot.view.ts'), 'utf8');

assert.match(androidStrings, /<string name="agma_assistant_name">AGMa<\/string>/u);
assert.match(androidStrings, /<string name="app_name">AGM Transporte<\/string>/u, 'Product label remains separate');
assert.match(androidManifest, /android:label="@string\/agma_assistant_name"/u);
assert.match(runtime, /assistantTextForSpeech\(text\)/u, 'TTS pronunciation normalization is enforced');
assert.match(runtime, /assistantIdentityAnswer\(confirmedText,language\)/u, 'Identity response is enforced before routing');
assert.match(copilot, /<h2>AGMa<\/h2>/u);

console.log('AGMa DISPLAY IDENTITY = PASS');
console.log('AGMa STT CANONICALIZATION = PASS');
console.log('AGMa TTS PRONUNCIATION CONTRACT = PASS');
console.log('AGMa 12-LANGUAGE SELF-IDENTIFICATION = PASS');
console.log('AGM PRODUCT LABEL SEPARATION = PASS');
