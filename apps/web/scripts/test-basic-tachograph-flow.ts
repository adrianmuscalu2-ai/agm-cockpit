import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeTachographText, formatTachographResult } from '../src/basic-photo-analysis/tachograph.analysis';

const cardError = analyzeTachographText('CARD ERROR 03.08.2026 14:32\nȚară: RO', 86);
assert.equal(cardError.status, 'identified');
assert.equal(cardError.event, 'card-problem');
assert.ok(cardError.recommendedActions.some((action) => action.includes('cardului')));
assert.ok(formatTachographResult(cardError).includes('KB-LEGAL-TACH-001'));

const rest = analyzeTachographText('Pauză 00:45\nConducere 04 h 30 min', 82);
assert.equal(rest.event, 'break-rest');
assert.ok(rest.facts.some(({ label }) => label === 'Durată afișată'));

const uncertain = analyzeTachographText('x z 1', 41);
assert.equal(uncertain.status, 'uncertain');

const drivingWithoutCard = analyzeTachographText('driving without card 28', 46);
assert.equal(drivingWithoutCard.event, 'card-problem');
assert.notEqual(drivingWithoutCard.event, 'driving');
assert.ok(drivingWithoutCard.recommendedActions.some((action) => action.includes('cardului')));

const drivingWithoutCardOcrTypo = analyzeTachographText('Driving whithout card 28', 46);
assert.equal(drivingWithoutCardOcrTypo.event, 'card-problem');
assert.ok(uncertain.recommendedActions.some((action) => action.includes('Refă fotografia')));

const main = readFileSync(resolve('src', 'main.ts'), 'utf8');
for (const marker of [
  "renderBasicAction('tachograph-analysis'",
  'confirmTachographText',
  'analyzeTachographText',
  'renderTachographAnalysis',
  'tachographAnalysisToTranslator',
  'tachographAnalysisToEmail',
]) assert.ok(main.includes(marker), `Sprint 2 UI integration is missing ${marker}`);

console.log('AGM Basic Sprint 2 tachograph analyzer: PASS');
