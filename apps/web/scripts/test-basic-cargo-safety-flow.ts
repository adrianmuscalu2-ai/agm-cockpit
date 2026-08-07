import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeCargoSafetyText, formatCargoSafetyResult } from '../src/basic-photo-analysis/cargo-safety.analysis';

const label = analyzeCargoSafetyText('EN 12195-2 LC 2500 daN STF 350 daN. Chingă fără tăieturi.', 88);
assert.equal(label.status, 'identified');
assert.match(label.topic ?? '', /Echipament/);
assert.ok(label.facts.some((fact) => fact.label === 'Valori etichetă'));
assert.deepEqual(label.knowledgeReferences, ['KB-LEGAL-CARGO-SECURING-001']);
assert.ok(formatCargoSafetyResult(label).includes('Acțiuni recomandate'));

const publicLabel = analyzeCargoSafetyText('EN 12195-2 PES SHF 50 daN STF 500 daN LC 2500 daN LC 5000 daN Darf nicht zum Heben verwendet werden', 91);
assert.match(publicLabel.topic ?? '', /Echipament/);
assert.ok(publicLabel.facts.some((fact) => fact.value.includes('SHF 50 daN')));
assert.ok(publicLabel.facts.some((fact) => fact.value.includes('STF 500 daN')));
assert.ok(publicLabel.facts.some((fact) => fact.value.includes('LC 2500 daN') && fact.value.includes('LC 5000 daN')));
assert.ok(publicLabel.facts.some((fact) => fact.label === 'Avertisment utilizare'));
assert.ok(publicLabel.limitations.some((limit) => limit.includes('nu calculează numărul de chingi')));

const adr = analyzeCargoSafetyText('ADR UN 1203. Verificare securizare marfă periculoasă.', 80);
assert.equal(adr.topic, 'Mărfuri periculoase — ADR');
assert.ok(adr.facts.some((fact) => fact.label === 'Număr UN menționat'));

const insufficient = analyzeCargoSafetyText('marfă', 90);
assert.equal(insufficient.status, 'uncertain');
assert.equal(insufficient.knowledgeReferences.length, 0);

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
for (const contract of ["'cargo-safety-analysis'", 'confirmCargoSafetyText', 'analyzeCargoSafety', 'renderCargoSafetyAnalysis', 'cargoSafetyAnalysisToTranslator', 'cargoSafetyAnalysisToEmail', 'cargoSafetyAnalysisRetry']) {
  assert.ok(main.includes(contract), `Cargo Safety UI contract missing: ${contract}`);
}
assert.ok(main.includes("knowledgeDestination.id === 'cargo-securing'"), 'Cargo Knowledge must expose the Photo First entry point.');
assert.match(main, /data-basic-action="cargo-safety-analysis"/, 'Cargo Knowledge must route to the validated analysis flow.');

console.log('AGM Basic Cargo Safety functional flow analyzer: PASS');
