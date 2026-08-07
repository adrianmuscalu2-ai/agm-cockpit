import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeLegislationText, formatLegislationResult } from '../src/basic-photo-analysis/legislation.analysis';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
for (const contract of [
  "'legislation-analysis'",
  'confirmLegislationText',
  'analyzeLegislation',
  'renderLegislationAnalysis',
  'legislationAnalysisToTranslator',
  'legislationAnalysisToEmail',
  'legislationAnalysisRetry',
]) {
  assert.ok(main.includes(contract), `Legislation UI contract missing: ${contract}`);
}

const breakRule = analyzeLegislationText('Art. 7: după 4h30 conducere este necesară o pauză de 45 minute.', 82);
assert.equal(breakRule.status, 'identified');
assert.equal(breakRule.topic, 'break');

const publicBreakImage = analyzeLegislationText('4,5 hrs 45 mins', 95);
assert.equal(publicBreakImage.topic, 'break');
assert.ok(publicBreakImage.facts.some((fact) => fact.value.includes('4,5 hrs')));
assert.ok(publicBreakImage.facts.some((fact) => fact.value.includes('45 mins')));
assert.deepEqual(breakRule.knowledgeReferences, ['KB-LEGAL-DRT-001']);
assert.ok(breakRule.facts.some((fact) => fact.label === 'Articol menționat' && fact.value === '7'));

const cmr = analyzeLegislationText('CMR: expeditor, transportator, destinatar și greutate.', 78);
assert.equal(cmr.topic, 'cmr-required-data');
assert.deepEqual(cmr.knowledgeReferences, ['KB-LEGAL-TRANSPORT-DOCS-001']);
assert.ok(formatLegislationResult(cmr).includes('Acțiuni recomandate'));

const unknown = analyzeLegislationText('text fără context suficient', 90);
assert.equal(unknown.status, 'uncertain');
assert.deepEqual(unknown.knowledgeReferences, []);

console.log('AGM Basic Legislation functional flow analyzer: PASS');
