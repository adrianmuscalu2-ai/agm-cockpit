import assert from 'node:assert/strict';
import { parseVoiceDecision } from '../src/premium-voice-shell/premium-handsfree';

const cases = [
  ['ro', 'Da, confirmă', 'confirm'], ['de', 'Ja', 'confirm'], ['en', 'no cancel', 'cancel'],
  ['fr', 'oui', 'confirm'], ['nl', 'nee', 'cancel'], ['ru', 'да', 'confirm'],
  ['pl', 'potwierdzam', 'confirm'], ['tr', 'hayır', 'cancel'], ['sq', 'po', 'confirm'],
] as const;
for (const [language, value, expected] of cases) assert.equal(parseVoiceDecision(language, value), expected);
assert.equal(parseVoiceDecision('ro', 'poate'), 'unknown');
console.log('Premium hands-free confirmation: PASS (9/9 languages)');
