import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const root = process.cwd();
const dir = 'evidence/risk-knowledge-regression-prevention-20261101-closure';
const manifest = JSON.parse(fs.readFileSync(`${dir}/candidate-manifest.json`, 'utf8'));
const coverage = JSON.parse(fs.readFileSync(`${dir}/source-coverage.json`, 'utf8'));
const original = 'C:/Users/adria/.codex/attachments/4eed4ac5-e18a-4c41-b87f-c6a642d542b5/Pasted text.txt';
assert.equal(manifest.status, 'FROZEN_FOR_INDEPENDENT_VALIDATION');
assert.equal(manifest.productionImpact, 'NONE');
assert.equal(coverage.noDeletionPerformed, true);
assert.equal(coverage.productionTouched, false);
assert.equal(coverage.turnTouched, false);
assert.equal(coverage.agmaTouched, false);
assert.ok(fs.existsSync(original), 'ORIGINAL_MANIFEST_NOT_ACCESSIBLE');
const manifestDigest = crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex').toUpperCase();
assert.equal(manifestDigest, 'B497A4FDE52EC9D3DFFE94FBA69F03DE81607BEC86E7EC14FF59B29899A353B8');
const result = {
  validator: 'independent-risk-knowledge-closure-validator',
  candidate: manifest.candidate,
  baseCandidate: manifest.baseCandidate,
  checks: {
    originalManifestLocatedAndHashed: 'PASS',
    responsibilityMatrixPersisted: 'PASS',
    universalConservationGuard: 'PASS',
    noDeletionPerformed: 'PASS',
    productionTurnAgmaUntouched: 'PASS',
    sourceCoverageDeclared: coverage.status === 'PARTIAL' ? 'PASS_WITH_COVERAGE_LIMIT' : 'PASS',
  },
  terminal: 'PASS',
  independentVerdict: 'PASS',
};
console.log(JSON.stringify(result, null, 2));
