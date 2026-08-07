import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  analyzeTransportDocument,
  formatTransportDocumentResult,
} from '../src/basic-photo-analysis/transport-document.analysis';

const cmr = analyzeTransportDocument(`
CMR Nr. RO-2026-184
Data: 03.08.2026
Expeditor: AGM Logistics SRL
Destinatar: Muster GmbH
Transportator: AGM Transport
Vehicul: B 123 AGM
Greutate: 12400 kg
`, 88);

assert.equal(cmr.status, 'identified');
assert.equal(cmr.facts.find(({ key }) => key === 'documentType')?.value, 'Scrisoare de trăsură CMR');
assert.equal(cmr.facts.find(({ key }) => key === 'documentNumber')?.value, 'RO-2026-184');
assert.equal(cmr.facts.find(({ key }) => key === 'weight')?.value, '12400 kg');
assert.ok(cmr.recommendedActions.length >= 2);
assert.ok(formatTransportDocumentResult(cmr).includes('Acțiuni recomandate'));

const partial = analyzeTransportDocument('Aviz nr. AV-17\nData 03.08.2026', 62);
assert.equal(partial.status, 'identified');
assert.ok(partial.explanation.includes('trebuie verificate'));

const uncertain = analyzeTransportDocument('imagine neclara x', 42);
assert.equal(uncertain.status, 'uncertain');
assert.ok(uncertain.recommendedActions.some((action) => action.includes('Refă fotografia')));
assert.deepEqual(uncertain.knowledgeReferences, ['KB-LEGAL-TRANSPORT-DOCS-001']);

const blankCmrOcr = analyzeTransportDocument('Xalqaro tovar va transport CMR yuk xati\nBelgilar va raqamiar\ni 10 SEE', 72);
assert.equal(blankCmrOcr.status, 'partial');
assert.equal(blankCmrOcr.facts.length, 1);
assert.equal(blankCmrOcr.facts[0]?.key, 'documentType');
assert.ok(!blankCmrOcr.facts.some((fact) => fact.key === 'documentNumber' || fact.key === 'vehicle'));

const main = readFileSync(resolve('src', 'main.ts'), 'utf8');
for (const requiredMarker of [
  "renderBasicAction('transport-document'",
  'confirmTransportDocumentText',
  'analyzeTransportDocument',
  'renderTransportDocumentAnalysis',
  'transportAnalysisToTranslator',
  'transportAnalysisToEmail',
  'transportAnalysisRetry',
]) {
  assert.ok(main.includes(requiredMarker), `Sprint 1 UI integration is missing ${requiredMarker}`);
}

console.log('AGM Basic Sprint 1 transport document analyzer: PASS');
