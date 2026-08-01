import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  parseLoadSafetyAnalysis,
  parseLoadSafetyAnalysisJson,
} from '../src/premium-load-safety/premium-load-safety.validation';
import { parseFieldReport } from '../src/premium-load-safety/field-test/field-test.validation';

assert.deepEqual(
  parseLoadSafetyAnalysis({
    correct: ['  Chinga este vizibilă.  '],
    recommendations: [],
    risks: ['x'.repeat(600)],
  }),
  {
    correct: ['Chinga este vizibilă.'],
    recommendations: [],
    risks: ['x'.repeat(500)],
  },
);
assert.equal(parseLoadSafetyAnalysisJson('{bad'), undefined);
assert.equal(parseLoadSafetyAnalysis({ correct: [], recommendations: [], risks: ['ok'], extra: true }), undefined);
assert.equal(
  parseLoadSafetyAnalysis({ correct: [], recommendations: [], risks: Array(21).fill('risk') }),
  undefined,
);

const mixedSourceReport = parseFieldReport(JSON.stringify({
  observations: [{
    id: 'mixed-source',
    statement: 'Observație mixtă',
    certainty: 'observed',
    sources: ['photo', 'user-declared'],
    explanation: 'Combină fotografia și declarația.',
    photoRoles: ['front-oblique'],
  }],
  visibleRisks: [],
  recommendations: [],
  missingInformation: [],
  conflicts: [],
}));
assert.equal(mixedSourceReport?.observations[0].certainty, 'probable');

const controller = readFileSync(
  resolve(__dirname, '../src/premium-load-safety/premium-load-safety.controller.ts'),
  'utf8',
);
assert.match(controller, /parseLoadSafetyAnalysisJson\(rawVisualAnalysis\)/);
assert.match(controller, /photos\.length < 2/);
assert.match(controller, /limit: 10, ttl: 60_000/);
assert.match(controller, /limit: 6, ttl: 60_000/);
assert.match(controller, /fileSize: maxImageBytes/);

for (const provider of [
  'premium-load-safety.provider.ts',
  'securing-recommendation/securing-recommendation.provider.ts',
  'field-test/field-test.provider.ts',
]) {
  const source = readFileSync(resolve(__dirname, `../src/premium-load-safety/${provider}`), 'utf8');
  assert.match(source, /OPENAI_API_KEY/);
  assert.match(source, /if \(!apiKey\) return/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*apiKey/);
}

console.log('API-008 Premium Load Safety Service contract: PASS');
