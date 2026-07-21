import assert from 'node:assert/strict';
import { parseSecuringRecommendation } from '../src/premium-load-safety/securing-recommendation/securing-recommendation.validation';
import {
  parseFieldInput,
  parseFieldReport,
  parseFieldRoles,
  finalizeFieldReport,
} from '../src/premium-load-safety/field-test/field-test.validation';

const unsafeVisibleCount = parseSecuringRecommendation(JSON.stringify({
  visibleStraps: {
    estimatedCount: 6,
    recommendedCount: null,
    observations: [{
      id: 'visible-count',
      conclusion: 'Sunt vizibile 6 chingi, conform datelor declarate.',
      certainty: 'observed',
      sources: ['visual', 'user-declared'],
      explanation: 'Numărul declarat este 6.',
    }],
  },
  recommendations: [],
  lcStf: [],
  additionalElements: [{
    id: 'declared-edge-protection',
    conclusion: 'Protecțiile de muchie lipsesc conform datelor introduse.',
    certainty: 'observed',
    sources: ['user-declared'],
    explanation: 'Utilizatorul a declarat că nu există.',
  }],
  missingData: [],
}));

assert.equal(unsafeVisibleCount?.visibleStraps.estimatedCount, null);
assert.equal(unsafeVisibleCount?.additionalElements[0].certainty, 'probable');

const groundedVisibleCount = parseSecuringRecommendation(JSON.stringify({
  visibleStraps: {
    estimatedCount: 3,
    recommendedCount: null,
    observations: [{
      id: 'visible-count',
      conclusion: 'Trei chingi distincte sunt vizibile în fotografie.',
      certainty: 'observed',
      sources: ['visual'],
      explanation: 'Cele trei benzi pot fi urmărite de la încărcătură spre marginea platformei.',
    }],
  },
  recommendations: [],
  lcStf: [],
  additionalElements: [],
  missingData: ['Greutate', 'Coeficient de frecare'],
}));

assert.equal(groundedVisibleCount?.visibleStraps.estimatedCount, 3);
assert.equal(groundedVisibleCount?.visibleStraps.recommendedCount, null);

console.log('Securing recommendation safety tests: PASS');

assert.deepEqual(parseFieldRoles('["front-oblique","rear-oblique"]', 2), ['front-oblique', 'rear-oblique']);
assert.deepEqual(parseFieldRoles('["front-oblique","rear-oblique","opposite-side"]', 3), ['front-oblique', 'rear-oblique', 'opposite-side']);
assert.throws(() => parseFieldRoles('["front-oblique","front-oblique"]', 2));
assert.deepEqual(
  parseFieldInput('{"confirmedLcDan":2500,"confirmedStfDan":350,"ocrConfirmed":false}'),
  {
    weightKg: undefined,
    cargoType: undefined,
    antiSlipMats: 'unknown',
    edgeProtectors: 'unknown',
    frontSupported: 'unknown',
    oppositeSide: 'unknown',
    confirmedLcDan: undefined,
    confirmedStfDan: undefined,
    ocrConfirmed: false,
  },
);

const fieldReport = parseFieldReport(JSON.stringify({
  observations: [{
    id: 'declared-only',
    statement: 'Utilizatorul declară covorașe.',
    certainty: 'observed',
    sources: ['user-declared'],
    explanation: 'Informația provine din formular.',
    photoRoles: [],
  }],
  visibleRisks: [],
  recommendations: [],
  missingInformation: [],
  conflicts: [],
}));
assert.equal(fieldReport?.observations[0].certainty, 'probable');
const finalizedFieldReport = finalizeFieldReport(
  fieldReport!,
  {
    antiSlipMats: 'unknown',
    edgeProtectors: 'unknown',
    frontSupported: 'unknown',
    oppositeSide: 'confirmed-symmetric',
    confirmedLcDan: 2500,
    confirmedStfDan: 350,
    ocrConfirmed: true,
  },
  'ro',
);
assert.deepEqual(finalizedFieldReport.observations[0].photoRoles, []);
assert.equal(finalizedFieldReport.observations[1].sources[0], 'confirmed-ocr');
assert.ok(finalizedFieldReport.observations[1].statement.includes('LC 2500 daN'));
assert.equal(finalizedFieldReport.observations[2].sources[0], 'user-declared');
assert.ok(finalizedFieldReport.observations[2].statement.includes('partea opusă'));

const oppositeSideUnknown = finalizeFieldReport(fieldReport!, {
  antiSlipMats: 'unknown',
  edgeProtectors: 'unknown',
  frontSupported: 'unknown',
  oppositeSide: 'not-visible',
  ocrConfirmed: false,
}, 'ro');
assert.ok(oppositeSideUnknown.missingInformation.some((item) => item.statement.includes('Partea opusă nu este vizibilă')));

console.log('Field test safety tests: PASS');
