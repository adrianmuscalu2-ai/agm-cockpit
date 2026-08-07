import assert from 'node:assert/strict';
import { availableTextCorrectorAgentIds, correctText } from '../src/text-corrector/text-corrector.service';

assert.deepEqual(availableTextCorrectorAgentIds(), ['AG-011-011A', 'AG-011-011B', 'AG-011-011C']);

const sameLanguageCases = [
  ['ro', 'AG-011-011A', 'salutare  ami aici', 'Buna ziua am aici.'],
  ['en', 'AG-011-011B', 'i am arrive', 'I have arrived.'],
  ['de', 'AG-011-011C', 'ich bin man', 'Ich bin angekommen.'],
] as const;

for (const [language, agentId, input, expected] of sameLanguageCases) {
  const result = correctText({
    text: input,
    sourceLanguage: language,
    targetLanguage: language,
    mode: 'correction',
    sourceModule: 'standalone',
  });
  assert.equal(result.agentId, agentId);
  assert.equal(result.correctedText, expected);
  assert.equal(result.originalText, input);
}

const professional = correctText({
  text: 'documentele sunt gata', sourceLanguage: 'ro', targetLanguage: 'de',
  mode: 'professional', sourceModule: 'mailmaster',
});
assert.match(professional.correctedText, /^Buna ziua,/);
assert.equal(professional.sourceModule, 'mailmaster');

const empty = correctText({
  text: '   ', sourceLanguage: 'en', targetLanguage: 'ro',
  mode: 'simplification', sourceModule: 'translator',
});
assert.equal(empty.correctedText, '');
assert.ok(empty.warnings.includes('textCorrector.warning.mvpAgent'));

const dictatedTransportPhrase = correctText({
  text: 'Bună ziua camioane pregătit',
  sourceLanguage: 'ro',
  targetLanguage: 'de',
  mode: 'correction',
  sourceModule: 'translator',
});
assert.equal(dictatedTransportPhrase.correctedText, 'Bună ziua, camionul este pregătit.');

console.log('APP-006 Text Corrector routing, normalization, provenance and modes: PASS');
