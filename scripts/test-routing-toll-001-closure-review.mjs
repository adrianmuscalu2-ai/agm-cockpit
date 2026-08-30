import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const evidenceRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CLOSURE';
const expectedRegistrySha256 = 'af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31';
const expectedViewSha256 = 'eb8e0b1b02b34033ad689b0aa35da616b924cc333d2d22187e466505ffcc801f';
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));
const hashFile = (relative) => createHash('sha256').update(readFileSync(path.join(root, relative))).digest('hex');

const generatedFiles = [
  'OFFICIAL_AUTHORITY_COVERAGE_MATRIX.json',
  'CANDIDATE_DISPOSITION_MATRIX.json',
  'REMAINING_COUNTRY_REGIME_GAPS.json',
  'PROPOSED_REGISTRY_REVIEW_CHANGESET.json',
  'EXPECTED_ROUTING_TOLL_VIEW_IMPACT.json',
  'ROUTING_TOLL_001_CLOSURE_REVIEW_REPORT.md',
].map((name) => `${evidenceRoot}/${name}`);
const beforeHashes = Object.fromEntries(generatedFiles.map((file) => [file, hashFile(file)]));
const generation = spawnSync(process.execPath, [path.join(root, 'scripts/build-routing-toll-001-closure-review.mjs')], { cwd: root, encoding: 'utf8' });
const afterHashes = Object.fromEntries(generatedFiles.map((file) => [file, hashFile(file)]));

const registry = readJson('AGM_LIBRARY/REGISTRY/canonical-sources.json');
const view = readJson('AGM_LIBRARY/VIEWS/routing-toll.view.json');
const acquisition = readJson(`${evidenceRoot}/REMOTE_ACQUISITION_MANIFEST.json`);
const dispositions = readJson(`${evidenceRoot}/CANDIDATE_DISPOSITION_MATRIX.json`);
const coverage = readJson(`${evidenceRoot}/OFFICIAL_AUTHORITY_COVERAGE_MATRIX.json`);
const changeset = readJson(`${evidenceRoot}/PROPOSED_REGISTRY_REVIEW_CHANGESET.json`);
const residual = readJson(`${evidenceRoot}/REMAINING_COUNTRY_REGIME_GAPS.json`);
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const basic = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/BASIC_LIBRARIAN_INTEGRITY.json');
const registryIds = new Set(registry.sources.map((source) => source.sourceId));

const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass, actual, expected });
check('GENERATOR_EXIT', generation.status === 0, generation.status, 0);
check('GENERATOR_IDEMPOTENCE', JSON.stringify(beforeHashes) === JSON.stringify(afterHashes), afterHashes, beforeHashes);
check('CENTRAL_REGISTRY_COUNT', registry.sources.length === 815, registry.sources.length, 815);
check('CENTRAL_REGISTRY_SHA256', hashFile('AGM_LIBRARY/REGISTRY/canonical-sources.json') === expectedRegistrySha256, hashFile('AGM_LIBRARY/REGISTRY/canonical-sources.json'), expectedRegistrySha256);
check('ROUTING_TOLL_VIEW_COUNT', view.sourceCount === 263, view.sourceCount, 263);
check('ROUTING_TOLL_VIEW_SHA256', hashFile('AGM_LIBRARY/VIEWS/routing-toll.view.json') === expectedViewSha256, hashFile('AGM_LIBRARY/VIEWS/routing-toll.view.json'), expectedViewSha256);
check('ACQUISITION_20_OF_20', acquisition.capturedCount === 20 && acquisition.failedCount === 0, `${acquisition.capturedCount}/${acquisition.failedCount}`, '20/0');
check('REMOTE_ARTIFACT_HASHES', acquisition.records.every((record) => record.localEvidencePath && hashFile(record.localEvidencePath) === record.sha256), acquisition.records.filter((record) => !record.localEvidencePath || hashFile(record.localEvidencePath) !== record.sha256).map((record) => record.proposalId), []);
check('DISPOSITIONS_20_OF_20', dispositions.dispositions.length === 20 && dispositions.hashMatches === 20, `${dispositions.dispositions.length}/${dispositions.hashMatches}`, '20/20');
check('PROPOSED_SOURCE_IDS_UNIQUE', new Set(dispositions.dispositions.map((item) => item.proposedSourceId)).size === 20, new Set(dispositions.dispositions.map((item) => item.proposedSourceId)).size, 20);
check('NO_REGISTRY_COLLISION', dispositions.dispositions.every((item) => !registryIds.has(item.proposedSourceId)), dispositions.dispositions.filter((item) => registryIds.has(item.proposedSourceId)).map((item) => item.proposedSourceId), []);
check('PROPOSED_ATOMIC_ADD_COUNTS', changeset.atomic === true && changeset.expectedAfterApproval.additions === 16 && changeset.expectedAfterApproval.modifications === 0 && changeset.expectedAfterApproval.deletions === 0, changeset.expectedAfterApproval, { additions: 16, modifications: 0, deletions: 0 });
check('PROPOSED_CLASSIFICATION_COUNTS', changeset.expectedAfterApproval.authoritativeWithScope === 12 && changeset.expectedAfterApproval.contextual === 4, `${changeset.expectedAfterApproval.authoritativeWithScope}/${changeset.expectedAfterApproval.contextual}`, '12/4');
check('EXPECTED_COUNTS', changeset.expectedAfterApproval.registrySourceCount === 831 && changeset.expectedAfterApproval.routingTollViewSourceCount === 279, `${changeset.expectedAfterApproval.registrySourceCount}/${changeset.expectedAfterApproval.routingTollViewSourceCount}`, '831/279');
for (const [country, regimes] of Object.entries({ AT: ['VIGNETTE', 'SECTION_TOLL', 'GO_DISTANCE_TOLL'], CZ: ['EDALNICE_VIGNETTE', 'MYTO_DISTANCE_TOLL'], DK: ['KMTOLL_DISTANCE_CHARGE', 'STOREBAELT_BRIDGE', 'ORESUND_BRIDGE'], NL: ['TRUCK_CHARGING', 'A24_ETOL'], FR: ['CONCESSION_FRAMEWORK', 'CONCESSION_TARIFFS'] })) {
  const actual = coverage.rows.filter((row) => row.country === country).map((row) => row.regime);
  check(`REGIME_SEPARATION_${country}`, regimes.every((regime) => actual.includes(regime)), actual, regimes);
}
check('RESIDUAL_GAPS_OPEN', residual.items.length === 8 && residual.items.every((item) => item.status === 'OPEN'), residual.items.map((item) => `${item.id}:${item.status}`), '8 OPEN');
check('FINAL_RECOMMENDATION', residual.recommendation === 'REMAINS_PARTIALLY_READY', residual.recommendation, 'REMAINS_PARTIALLY_READY');
for (const gapId of ['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']) {
  const gap = unresolved.gaps.find((item) => item.gapId === gapId);
  check(`${gapId}_OPEN`, gap?.state === 'OPEN', gap?.state ?? 'MISSING', 'OPEN');
}
for (const item of basic.checks) {
  check(`BASIC_HASH_${item.path}`, hashFile(item.path) === item.expectedSha256, hashFile(item.path), item.expectedSha256);
}

const report = {
  schemaVersion: 'agm-routing-toll-001-closure-review-validation.v1',
  generatedAt: new Date().toISOString(),
  verdict: checks.every((item) => item.pass) ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  failedCount: checks.filter((item) => !item.pass).length,
  checks,
  protectedChanges: { centralRegistry: 'NONE', routingTollView: 'NONE', basicLibrarian: 'NONE', legal003: 'NONE', legal005: 'NONE', runtimeProductionTurnApplicationApi: 'NONE' },
  commitPush: 'NOT_EXECUTED',
};
writeFileSync(path.join(root, evidenceRoot, 'VALIDATION_AND_IDEMPOTENCE_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ verdict: report.verdict, checks: report.checkCount, failed: report.failedCount }, null, 2));
if (report.verdict !== 'PASS') process.exitCode = 1;
