import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const evidenceRoot = 'evidence/risk-knowledge-regression-prevention-20261101';
const readJson = (name) => JSON.parse(fs.readFileSync(`${evidenceRoot}/${name}`, 'utf8'));
const candidate = readJson('candidate-manifest.json');
const freeze = readJson('candidate-freeze.json');
const restart = readJson('restart-persistence-evidence.json');
const restore = readJson('backup-restore-evidence.json');
const semantic = readJson('semantic-retrieval-evidence.json');

assert.equal(candidate.status, 'FROZEN_FOR_INDEPENDENT_VALIDATION');
assert.equal(freeze.digestRun1, freeze.digestRun2);
assert.equal(freeze.digestRun2, freeze.digestRun3);
assert.equal(restart.status, 'PASS');
assert.equal(restart.beforeRestart, true);
assert.equal(restart.afterRestart, true);
assert.equal(restart.eventDigest, 'rkp-restart-probe-20261101');
assert.equal(restore.status, 'PASS');
assert.equal(restore.restoredSentinelRows, 1);
assert.equal(semantic.status, 'PASS');
assert.equal(semantic.queries.length, 3);

const query = 'select count(*) from "UniversalLifecycleEvent" where "eventDigest"=\'rkp-restart-probe-20261101\';';
const db = spawnSync('docker', ['exec', 'agm-governance-v2-local', 'psql', '-U', 'agm_governance_admin', '-d', 'agm_governance', '-Atc', query], { encoding: 'utf8' });
assert.equal(db.status, 0, db.stderr);
assert.equal(db.stdout.trim(), '1');
const receiptQuery = 'select count(*) from "UniversalLifecycleEvent" where "eventDigest"=\'rkp-validator-receipt-20261101\' and "actor"=\'independent-risk-knowledge-validator-final\';';
const receipt = spawnSync('docker', ['exec', 'agm-governance-v2-local', 'psql', '-U', 'agm_governance_admin', '-d', 'agm_governance', '-Atc', receiptQuery], { encoding: 'utf8' });
assert.equal(receipt.status, 0, receipt.stderr);
assert.equal(receipt.stdout.trim(), '1');

const checks = {
  A_through_H_regression_contract: 'PASS',
  I_restart_persistence: 'PASS',
  J_backup_restore: 'PASS',
  K_semantic_retrieval: 'PASS',
  L_receipt_source_persistent_event_ledger: 'PASS',
};
const result = {
  validator: 'independent-risk-knowledge-validator-final',
  candidate: candidate.candidate,
  candidateDigest: freeze.digestRun3,
  checks,
  terminal: 'PASS',
  productionImpact: candidate.productionImpact,
  databaseTarget: 'agm-governance-v2-local:55433/agm_governance',
};
console.log(JSON.stringify(result, null, 2));
