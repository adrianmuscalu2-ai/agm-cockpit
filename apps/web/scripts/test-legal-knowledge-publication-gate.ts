import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { drivingRestTimesKnowledgePackage } from '../src/legal-knowledge/driving-rest-times.package';
import { isKnowledgePackagePublishable } from '../src/legal-knowledge/knowledge.contract';
import { legalKnowledgeRegistry, publishedLegalKnowledge } from '../src/legal-knowledge/legal-knowledge.registry';
import { tachographKnowledgePackage } from '../src/legal-knowledge/tachograph.package';
import { dashboardWarningLightsKnowledgePackage } from '../src/legal-knowledge/dashboard-warning-lights.package';
import { dashboardWarningAssetManifest } from '../src/legal-knowledge/dashboard-warning-assets.manifest';
import { transportDocumentsKnowledgePackage } from '../src/legal-knowledge/transport-documents.package';
import { cargoSecuringKnowledgePackage } from '../src/legal-knowledge/cargo-securing.package';

assert.equal(legalKnowledgeRegistry.length, 5);
const mainSource = readFileSync(resolve('src', 'main.ts'), 'utf8');
assert.match(mainSource, /renderBasicAction\('legislation-analysis',[^\n]+Analizează situație legislativă/);
assert.match(mainSource, /renderBasicAction\('dashboard-warning-analysis',[^\n]+Identifică martor din bord/);
assert.match(mainSource, /renderBasicAction\('tachograph-analysis',[^\n]+Analizează tahograf/);
assert.match(mainSource, /renderBasicModule\('legal', '\/legal', '[^']+', 'Ancorarea mărfii'/);
assert.doesNotMatch(mainSource, /renderBasicPlanned\([^\n]+(?:Martori în bord|Tahograf|Legislație)/);
assert.equal(drivingRestTimesKnowledgePackage.items.length, 9);
assert.equal(drivingRestTimesKnowledgePackage.status, 'published');
assert.equal(isKnowledgePackagePublishable(drivingRestTimesKnowledgePackage, new Date('2026-08-02')), true);
assert.deepEqual(publishedLegalKnowledge(new Date('2026-08-02')), [drivingRestTimesKnowledgePackage, tachographKnowledgePackage, dashboardWarningLightsKnowledgePackage, transportDocumentsKnowledgePackage, cargoSecuringKnowledgePackage]);
assert.equal(cargoSecuringKnowledgePackage.status, 'published');
assert.equal(cargoSecuringKnowledgePackage.version, '0.1.1');
assert.equal(cargoSecuringKnowledgePackage.items.length, 13);
assert.equal(isKnowledgePackagePublishable(cargoSecuringKnowledgePackage, new Date('2026-08-02')), true);
assert.deepEqual(cargoSecuringKnowledgePackage.items.map(({ id, topic }) => [id, topic]), [
  ['LOAD-000', 'Domeniu și obiectivul controlului'], ['LOAD-001', 'Forțe de proiectare'], ['LOAD-002', 'Distribuție și axe'],
  ['LOAD-003', 'Vehicul și puncte'], ['LOAD-004', 'Metode de fixare'], ['LOAD-005', 'Echipament, LC și STF'],
  ['LOAD-006', 'Frecare, goluri și piese libere'], ['LOAD-007', 'Reverificare — bună practică CTU'], ['LOAD-008', 'Deficiențe și măsuri la control'],
  ['LOAD-009', 'CTU și intermodal'], ['LOAD-010', 'Germania — §22 StVO'], ['LOAD-011', 'Stop și escaladare AGM'],
  ['LOAD-012', 'Mărfuri periculoase — ADR'],
]);
for (const entry of cargoSecuringKnowledgePackage.items) {
  assert.ok(entry.legalRule.length > 0);
  assert.ok(entry.practicalExplanation.length > 0);
  assert.ok(entry.examples.length > 0);
  assert.ok(entry.commonMistakes.length > 0);
  assert.ok(entry.sourceReferences.length > 0);
  assert.ok(entry.sourceReferences.every((reference) => reference.locator.length > 0));
  assert.equal(entry.verifiedAt, '2026-08-02');
  assert.equal(entry.reviewDueAt, '2026-11-02');
}
assert.match(cargoSecuringKnowledgePackage.jurisdiction, /art\. 2/);
assert.match(cargoSecuringKnowledgePackage.items.find((entry) => entry.id === 'LOAD-005')?.legalRule ?? '', /LC.*STF.*Nu sunt interschimbabile/);
assert.match(cargoSecuringKnowledgePackage.items.find((entry) => entry.id === 'LOAD-007')?.sourceReferences[0]?.locator ?? '', /annex 7, section 4\.1\.8/);
assert.deepEqual(cargoSecuringKnowledgePackage.items.find((entry) => entry.id === 'LOAD-012')?.sourceReferences.map((entry) => entry.sourceId), ['EU-CARGO-001', 'UNECE-ADR-2025']);
assert.equal(cargoSecuringKnowledgePackage.items.some((entry) => 'visualReference' in entry), false);
assert.equal(transportDocumentsKnowledgePackage.status, 'published');
assert.equal(transportDocumentsKnowledgePackage.version, '0.1.3');
assert.equal(transportDocumentsKnowledgePackage.items.length, 15);
assert.equal(isKnowledgePackagePublishable(transportDocumentsKnowledgePackage, new Date('2026-08-02')), true);
for (const entry of transportDocumentsKnowledgePackage.items) {
  assert.ok(entry.legalRule.length > 0);
  assert.ok(entry.practicalExplanation.length > 0);
  assert.ok(entry.examples.length > 0);
  assert.ok(entry.commonMistakes.length > 0);
  assert.ok(entry.sourceReferences.length > 0);
  assert.ok(entry.sourceReferences.every((reference) => reference.locator.length > 0));
  assert.equal(entry.verifiedAt, '2026-08-02');
  assert.equal(entry.reviewDueAt, '2026-11-02');
}
assert.match(transportDocumentsKnowledgePackage.items.find((entry) => entry.id === 'DOC-004')?.legalRule ?? '', /6\(2\).*6\(3\)/);
assert.match(transportDocumentsKnowledgePackage.items.find((entry) => entry.id === 'DOC-005')?.legalRule ?? '', /acceptare expresă/);
assert.match(transportDocumentsKnowledgePackage.items.find((entry) => entry.id === 'DOC-008')?.legalRule ?? '', /primul exemplar/);
assert.match(transportDocumentsKnowledgePackage.items.find((entry) => entry.id === 'DOC-008')?.legalRule ?? '', /nu dividă expediția/);
assert.deepEqual(transportDocumentsKnowledgePackage.items.find((entry) => entry.id === 'DOC-010')?.sourceReferences.map((entry) => entry.sourceId), ['UN-ECMR-001', 'UN-ECMR-001', 'UN-ECMR-001', 'UN-ECMR-001', 'UN-ECMR-STATUS']);
assert.deepEqual(transportDocumentsKnowledgePackage.items.slice(0, 12).map((entry) => entry.id), [
  'DOC-000', 'DOC-001', 'DOC-002', 'DOC-003', 'DOC-004', 'DOC-005',
  'DOC-006', 'DOC-007', 'DOC-008', 'DOC-009', 'DOC-010', 'DOC-011',
]);
assert.deepEqual(transportDocumentsKnowledgePackage.items.map(({ id, topic }) => [id, topic]), [
  ['DOC-000', 'Domeniu CMR'], ['DOC-001', 'Rolul CMR'], ['DOC-002', 'CMR pe hârtie: exemplare și semnături'],
  ['DOC-003', 'Date obligatorii'], ['DOC-004', 'Date suplimentare și alte mențiuni'], ['DOC-005', 'Verificare la preluare și rezerve'],
  ['DOC-006', 'Efect probator'], ['DOC-007', 'Vamă și formalități'], ['DOC-008', 'Dreptul de dispoziție și instrucțiuni'],
  ['DOC-009', 'Livrare și rezerve la destinație'], ['DOC-010', 'e-CMR'], ['DOC-011', 'eFTI versus e-CMR'],
  ['DOC-012', 'Răspunderea pentru date'], ['DOC-013', 'Ambalare defectuoasă'], ['DOC-014', 'Impedimente la transport sau livrare'],
]);
assert.match(transportDocumentsKnowledgePackage.items.find((entry) => entry.id === 'DOC-009')?.legalRule ?? '', /verificarea comună.*daună neaparentă.*rezervă scrisă.*7 zile/);
const validatedTransportDocuments = {
  ...transportDocumentsKnowledgePackage,
  status: 'published' as const,
  validation: {
    domainReviewed: true, legalReviewed: true, qaReviewed: true,
    domainValidator: 'Domain', legalValidator: 'Legal', qaValidator: 'QA',
    domainReviewedAt: '2026-08-02', legalReviewedAt: '2026-08-02', qaReviewedAt: '2026-08-02',
    holdReasons: [], contradictions: [],
  },
};
assert.equal(isKnowledgePackagePublishable(validatedTransportDocuments, new Date('2026-08-02')), true);
assert.equal(tachographKnowledgePackage.status, 'published');
assert.equal(isKnowledgePackagePublishable(tachographKnowledgePackage, new Date('2026-08-02')), true);
assert.equal(dashboardWarningLightsKnowledgePackage.status, 'published');
assert.equal(dashboardWarningLightsKnowledgePackage.version, '0.1.3');
assert.equal(dashboardWarningLightsKnowledgePackage.items.length, 11);
assert.equal(isKnowledgePackagePublishable(dashboardWarningLightsKnowledgePackage, new Date('2026-08-02')), true);
for (const entry of dashboardWarningLightsKnowledgePackage.items) {
  assert.ok(entry.practicalExplanation.length > 0);
  assert.ok(entry.examples.length > 0);
  assert.ok(entry.commonMistakes.length > 0);
  assert.ok(entry.recommendedAction.length > 0);
  assert.ok(entry.vehicleVariation.length > 0);
  assert.ok(entry.sourceReferences.length > 0);
  assert.match(entry.visualReference.assetId, /^VA-WL-/);
  assert.equal(entry.visualReference.assetStatus, 'verified');
  assert.ok(entry.visualReference.assetPath);
  assert.ok(entry.visualReference.sha256);
  const assetBytes = readFileSync(resolve('public', entry.visualReference.assetPath!.replace(/^\//, '').replace(/^assets\//, 'assets/')));
  assert.equal(createHash('sha256').update(assetBytes).digest('hex').toUpperCase(), entry.visualReference.sha256);
  assert.equal(entry.verifiedAt, '2026-08-02');
  assert.equal(entry.reviewDueAt, '2026-11-02');
}
assert.equal(Object.keys(dashboardWarningAssetManifest).length, 11);
const editoriallyValidatedDashboard = {
  ...dashboardWarningLightsKnowledgePackage,
  status: 'published' as const,
  validation: {
    domainReviewed: true, legalReviewed: true, qaReviewed: true,
    domainValidator: 'Domain', legalValidator: 'Legal', qaValidator: 'QA',
    domainReviewedAt: '2026-08-02', legalReviewedAt: '2026-08-02', qaReviewedAt: '2026-08-02',
    holdReasons: [], contradictions: [],
  },
};
assert.equal(isKnowledgePackagePublishable(editoriallyValidatedDashboard, new Date('2026-08-02')), true);

const fakeVerifiedWithoutProvenance = {
  ...editoriallyValidatedDashboard,
  items: editoriallyValidatedDashboard.items.map((entry) => ({
    ...entry,
    visualReference: { ...entry.visualReference, rightsHolder: '' },
  })),
};
assert.equal(isKnowledgePackagePublishable(fakeVerifiedWithoutProvenance, new Date('2026-08-02')), false);
assert.equal(tachographKnowledgePackage.version, '0.1.1');
assert.equal(tachographKnowledgePackage.items.length, 11);
assert.deepEqual(tachographKnowledgePackage.items.map((entry) => entry.id), [
  'TACH-000', 'TACH-001', 'TACH-002', 'TACH-003', 'TACH-004', 'TACH-005',
  'TACH-006', 'TACH-007', 'TACH-008', 'TACH-009', 'TACH-010',
]);

for (const entry of tachographKnowledgePackage.items) {
  assert.ok(entry.legalRule.length > 0);
  assert.ok(entry.practicalExplanation.length > 0);
  assert.ok(entry.examples.length > 0);
  assert.ok(entry.commonMistakes.length > 0);
  assert.ok(entry.sourceReferences.length > 0);
  assert.match(entry.jurisdiction, /Uniunea Europeană/);
  assert.equal(entry.verifiedAt, '2026-08-02');
  assert.equal(entry.reviewDueAt, '2026-11-02');
}

assert.deepEqual(tachographKnowledgePackage.items.find((entry) => entry.id === 'TACH-005')?.sourceReferences.map((entry) => entry.sourceId), ['EU-TACH-001', 'EU-TACH-002']);
assert.match(tachographKnowledgePackage.items.find((entry) => entry.id === 'TACH-006')?.legalRule ?? '', /56/);
assert.match(tachographKnowledgePackage.items.find((entry) => entry.id === 'TACH-007')?.legalRule ?? '', /7 zile/);
assert.match(tachographKnowledgePackage.items.find((entry) => entry.id === 'TACH-007')?.practicalExplanation ?? '', /15 zile/);
assert.match(tachographKnowledgePackage.items.find((entry) => entry.id === 'TACH-008')?.legalRule ?? '', /o săptămână/);
const smartV2 = tachographKnowledgePackage.items.find((entry) => entry.id === 'TACH-010');
assert.match(smartV2?.legalRule ?? '', /21\.08\.2023/);
assert.match(smartV2?.legalRule ?? '', /31\.12\.2024/);
assert.match(smartV2?.legalRule ?? '', /18\.08\.2025/);
assert.match(smartV2?.practicalExplanation ?? '', /01\.07\.2026/);
assert.deepEqual(smartV2?.sourceReferences.map((entry) => entry.sourceId), ['EU-TACH-001', 'EU-TACH-002', 'EU-TACH-003', 'EU-TACH-004']);

const validatedTachograph = {
  ...tachographKnowledgePackage,
  status: 'published' as const,
  validation: {
    domainReviewed: true,
    legalReviewed: true,
    qaReviewed: true,
    domainValidator: 'Domain Validator',
    legalValidator: 'Legal Validator',
    qaValidator: 'QA Validator',
    domainReviewedAt: '2026-08-02',
    legalReviewedAt: '2026-08-02',
    qaReviewedAt: '2026-08-02',
    holdReasons: [],
    contradictions: [],
  },
};
assert.equal(isKnowledgePackagePublishable(validatedTachograph, new Date('2026-08-02')), true);

for (const entry of drivingRestTimesKnowledgePackage.items) {
  assert.ok(entry.legalRule.length > 0);
  assert.ok(entry.practicalExplanation.length > 0);
  assert.ok(entry.sourceReferences.length > 0);
  assert.ok(entry.sourceReferences.every((reference) => reference.locator.length > 0));
  assert.match(entry.jurisdiction, /UE/);
  assert.equal(entry.verifiedAt, '2026-08-02');
  assert.equal(entry.reviewDueAt, '2026-11-02');
}

const fullyValidated: typeof drivingRestTimesKnowledgePackage = {
  ...drivingRestTimesKnowledgePackage,
  status: 'published',
  validation: {
    domainReviewed: true,
    legalReviewed: true,
    qaReviewed: true,
    domainValidator: 'Domain Validator',
    legalValidator: 'Legal Validator',
    qaValidator: 'QA Validator',
    domainReviewedAt: '2026-08-02',
    legalReviewedAt: '2026-08-02',
    qaReviewedAt: '2026-08-02',
    holdReasons: [],
    contradictions: [],
  },
};

assert.equal(isKnowledgePackagePublishable(fullyValidated, new Date('2026-11-01')), true);
assert.equal(isKnowledgePackagePublishable(fullyValidated, new Date('2026-11-03')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  validation: { ...fullyValidated.validation, holdReasons: ['HOLD'] },
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  validation: { ...fullyValidated.validation, contradictions: ['contradicție'] },
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  validation: { ...fullyValidated.validation, legalValidator: '   ' },
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  validation: { ...fullyValidated.validation, qaReviewedAt: 'invalid' },
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  validation: { ...fullyValidated.validation, qaReviewedAt: '2026-02-31' },
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  validation: { ...fullyValidated.validation, qaReviewedAt: '2026-11-02' },
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  sources: [{ ...fullyValidated.sources[0], reachable: false }],
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  sources: [{ ...fullyValidated.sources[0], checkedAt: 'invalid' }],
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  sources: [{ ...fullyValidated.sources[0], reviewDueAt: '2026-10-31' }],
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  items: [{ ...fullyValidated.items[0], reviewDueAt: '2026-10-31' }],
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  sources: [fullyValidated.sources[0], fullyValidated.sources[0]],
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  items: [fullyValidated.items[0], fullyValidated.items[0]],
}, new Date('2026-11-01')), false);

assert.equal(isKnowledgePackagePublishable({
  ...fullyValidated,
  items: [{ ...fullyValidated.items[0], sourceReferences: [{ sourceId: 'MISSING', locator: 'art. 1' }] }],
}, new Date('2026-11-01')), false);

console.log('Legal knowledge publication gate: PASS');
