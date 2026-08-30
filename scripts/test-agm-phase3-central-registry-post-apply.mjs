import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const applyRelative = 'AGM_LIBRARY/PHASE3/CENTRAL_REGISTRY_APPLY';
const applyRoot = path.join(root, applyRelative);
const registryRelative = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const registry = readJson(registryRelative);
const registryHash = sha(registryRelative);
const snapshotBytes = readFileSync(path.join(applyRoot, 'PRE_APPLY_CANONICAL_SOURCES.json'));
const snapshot = JSON.parse(snapshotBytes.toString('utf8'));
const snapshotHash = hash(snapshotBytes);
const changeset = readJson('AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/UPDATED_PROPOSED_CHANGESET.json');
const artifactManifest = readJson('AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/CANONICAL_ARTIFACT_MANIFEST.json');
const applyRecord = readJson(`${applyRelative}/APPLY_EXECUTION_RECORD.json`);
const phase1Baseline = readJson(`${applyRelative}/PHASE1_PRE_APPLY_HASH_BASELINE.json`);
const phase2Baseline = readJson(`${applyRelative}/PHASE2_PRE_APPLY_HASH_BASELINE.json`);
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const basicBaseline = readJson('CAR_MOVER/GOVERNANCE/BASIC_LIBRARIAN_BASELINE.json');
const checks = [];
const phase1Checks = [];
const phase2Checks = [];
const phase3Checks = [];
const expectedBeforeHash = '1c506707200d6c8b27217cdf00d00541a739ef5321bde1e5f892cb9098e61a34';
const proposedEntries = changeset.operations.map((operation) => operation.proposedRegistryEntry);
const proposedIds = new Set(proposedEntries.map((entry) => entry.sourceId));

check(checks, 'APPLY_EVIDENCE_COMPLETE', () => {
  for (const file of [
    'PRE_APPLY_CANONICAL_SOURCES.json', 'PHASE1_PRE_APPLY_HASH_BASELINE.json',
    'PHASE2_PRE_APPLY_HASH_BASELINE.json', 'APPLY_EXECUTION_RECORD.json',
    'POST_APPLY_REGISTRY_DIFF.json', 'APPLY_EXECUTION_REPORT.md',
  ]) assert(existsSync(path.join(applyRoot, file)), `MISSING:${file}`);
});

check(checks, 'REGISTRY_COUNT_AND_ATOMIC_DIFF_EXACT', () => {
  assert(snapshot.sourceCount === 798 && snapshot.sources.length === 798, 'SNAPSHOT_COUNT');
  assert(snapshotHash === expectedBeforeHash, 'SNAPSHOT_HASH');
  assert(registry.sourceCount === 815 && registry.sources.length === 815, 'REGISTRY_COUNT');
  assert(registry.sources.slice(798).length === 17, 'ADDITION_COUNT');
  assert(applyRecord.sourceChanges.additions === 17 && applyRecord.sourceChanges.modifications === 0 && applyRecord.sourceChanges.deletions === 0, 'RECORDED_DIFF');
  assert(applyRecord.before.sha256 === snapshotHash && applyRecord.after.sha256 === registryHash, 'RECORDED_HASH');
});

check(checks, 'EXISTING_798_SOURCES_BYTE_LOGIC_UNCHANGED', () => {
  assert(registry.sources.slice(0, 798).every((source, index) => deepEqual(source, snapshot.sources[index])), 'EXISTING_SOURCE_CHANGED');
  const beforeIds = new Set(snapshot.sources.map((source) => source.sourceId));
  const afterIds = new Set(registry.sources.map((source) => source.sourceId));
  for (const sourceId of beforeIds) assert(afterIds.has(sourceId), `SOURCE_DELETED:${sourceId}`);
  const metadataBefore = { ...snapshot }; delete metadataBefore.generatedAt; delete metadataBefore.sourceCount; delete metadataBefore.sources;
  const metadataAfter = { ...registry }; delete metadataAfter.generatedAt; delete metadataAfter.sourceCount; delete metadataAfter.sources;
  assert(deepEqual(metadataBefore, metadataAfter), 'UNAUTHORIZED_REGISTRY_METADATA_CHANGE');
});

check(checks, 'ALL_17_APPROVED_SOURCE_IDS_PRESENT_EXACTLY', () => {
  assert(proposedIds.size === 17, 'PROPOSED_ID_COUNT');
  assert(new Set(registry.sources.map((source) => source.sourceId)).size === 815, 'DUPLICATE_SOURCE_ID');
  for (let index = 0; index < proposedEntries.length; index += 1) {
    const actual = registry.sources[798 + index];
    const expected = proposedEntries[index];
    assert(deepEqual(actual, expected), `ADDITION_NOT_EXACT_CHANGESET:${expected.sourceId}`);
  }
});

check(checks, 'CLASSIFICATIONS_13_AND_4_EXACT', () => {
  const additions = registry.sources.filter((source) => proposedIds.has(source.sourceId));
  assert(additions.filter((source) => source.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length === 13, 'AUTHORITATIVE_COUNT');
  assert(additions.filter((source) => source.authority.authorityType === 'CONTEXTUAL').length === 4, 'CONTEXTUAL_COUNT');
});

check(checks, 'CANONICAL_ARTIFACT_HASH_SIZE_AND_PROVENANCE_MATCH', () => {
  for (const entry of proposedEntries) {
    const artifact = artifactManifest.sources.find((item) => item.sourceId === entry.sourceId);
    const actual = registry.sources.find((source) => source.sourceId === entry.sourceId);
    assert(artifact && actual, `SOURCE_MISSING:${entry.sourceId}`);
    assert(existsSync(path.join(root, actual.canonicalPath)), `ARTIFACT_MISSING:${entry.sourceId}`);
    assert(statSync(path.join(root, actual.canonicalPath)).size === actual.sizeBytes, `SIZE:${entry.sourceId}`);
    assert(sha(actual.canonicalPath) === actual.sha256 && actual.sha256 === artifact.sha256, `HASH:${entry.sourceId}`);
    assert(actual.sizeBytes === artifact.sizeBytes, `MANIFEST_SIZE:${entry.sourceId}`);
    assert(deepEqual(actual.provenance, entry.provenance), `PROVENANCE:${entry.sourceId}`);
    assert(deepEqual(actual.evidenceRefs, entry.evidenceRefs), `EVIDENCE_REFS:${entry.sourceId}`);
  }
});

check(checks, 'REGISTRY_SCHEMA_CONTRACT_VALID_FOR_815', () => {
  assert(registry.authority === 'AGM_CENTRAL_REGISTRY' && registry.authorityMode === 'SINGLE_SOURCE_OF_TRUTH', 'CENTRAL_AUTHORITY');
  assert(registry.sourceMode === 'REFERENCE_ONLY_NO_PHYSICAL_COPY', 'SOURCE_MODE');
  for (const source of registry.sources) {
    assert(/^[A-Z0-9-]+$/.test(source.sourceId), `SOURCE_ID_FORMAT:${source.sourceId}`);
    for (const field of ['canonicalPath','mediaType','sizeBytes','sha256','sourceDate','version','status','owner','authority','provenance','retention','evidenceRefs','supersedes','supersededBy']) {
      assert(source[field] !== undefined && source[field] !== '', `FIELD:${source.sourceId}:${field}`);
    }
    assert(/^[a-f0-9]{64}$/.test(source.sha256), `HASH_FORMAT:${source.sourceId}`);
    assert(source.provenance.originalPreserved === true && source.provenance.libraryCopyCreated === false, `PROVENANCE_FLAGS:${source.sourceId}`);
    assert(source.retention.deleteAuthorized === false && source.retention.historicalEvidencePreserved === true, `RETENTION:${source.sourceId}`);
  }
});

check(checks, 'BASIC_LIBRARIAN_HASHES_3_OF_3_MATCH', () => {
  assert(basicBaseline.protectedHashes.length === 3, 'BASIC_COUNT');
  for (const item of basicBaseline.protectedHashes) assert(sha(item.path) === item.sha256, `BASIC_DRIFT:${item.path}`);
});

check(checks, 'UNRESOLVED_GAPS_EXACTLY_THREE_AND_OPEN', () => {
  const expected = new Set(['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']);
  assert(unresolved.gapCount === 3 && setEquals(new Set(unresolved.gaps.map((gap) => gap.gapId)), expected), 'GAP_SET');
  assert(unresolved.gaps.every((gap) => gap.state === 'OPEN' && gap.decision === 'KEEP_UNRESOLVED'), 'GAP_STATE');
  assert(setEquals(new Set(applyRecord.unresolvedGapsRemainOpen), expected), 'APPLY_RECORD_GAPS');
});

check(phase1Checks, 'PHASE1_FOUNDATION_FILES_UNCHANGED', () => validateHashBaseline(phase1Baseline));
check(phase1Checks, 'PHASE1_SINGLE_SOURCE_OF_TRUTH_PRESERVED', () => {
  assert(registry.authority === 'AGM_CENTRAL_REGISTRY' && registry.authorityMode === 'SINGLE_SOURCE_OF_TRUTH', 'PHASE1_SOT');
  assert(registry.sourceCount === 815, 'PHASE1_POST_COUNT');
});
check(phase1Checks, 'PHASE1_VIEWS_REMAIN_CONTROLLED_REFERENCE_INDEXES', () => {
  for (const file of ['common-platform','car-mover','routing-toll','documents-ocr-evidence','opportunity-communications','tacho','legislation-safety']) {
    const view = readJson(`AGM_LIBRARY/VIEWS/${file}.view.json`);
    assert(view.viewType === 'CONTROLLED_REFERENCE_INDEX' && view.centralRegistry === registryRelative, `VIEW:${file}`);
  }
});

check(phase2Checks, 'PHASE2_PACKAGE_AND_HISTORY_UNCHANGED', () => validateHashBaseline(phase2Baseline));
check(phase2Checks, 'PHASE2_SOURCE_ID_CONTINUITY_PRESERVED', () => {
  const candidates = readJson('AGM_LIBRARY/PHASE2/CANDIDATES/canonical-source-candidates.json').candidates;
  const candidateIds = new Set(candidates.map((candidate) => candidate.sourceId));
  for (const sourceId of proposedIds) assert(candidateIds.has(sourceId), `PHASE2_SOURCE_ID_MISSING:${sourceId}`);
});

check(phase3Checks, 'PHASE3_CHANGESET_APPLIED_EXACTLY_ONCE', () => {
  assert(changeset.operationCount === 17 && changeset.verifiedOperationCount === 17, 'PHASE3_CHANGESET_COUNT');
  assert(registry.sources.filter((source) => proposedIds.has(source.sourceId)).length === 17, 'PHASE3_APPLIED_COUNT');
});
check(phase3Checks, 'PHASE3_TRACEABILITY_COMPLETE', () => {
  for (const operation of changeset.operations) {
    assert(operation.approvedByReviewIds.length > 0, `APPROVAL_TRACE:${operation.sourceId}`);
    assert(operation.sourceIdContinuity === 'PRESERVE_PHASE2_SOURCE_ID', `CONTINUITY:${operation.sourceId}`);
  }
});
check(phase3Checks, 'PHASE3_BOUNDARIES_UNCHANGED', () => {
  assert(applyRecord.boundaries.basicLibrarian === 'UNCHANGED', 'BASIC_BOUNDARY');
  for (const field of ['runtime','production','turn','architecture']) assert(applyRecord.boundaries[field] === 'NO_CHANGE', `BOUNDARY:${field}`);
  assert(applyRecord.boundaries.commitPush === 'NOT_EXECUTED', 'COMMIT_PUSH_BOUNDARY');
});

const allChecks = [...checks, ...phase1Checks, ...phase2Checks, ...phase3Checks];
const failed = allChecks.filter((item) => item.status === 'FAIL');
const validation = {
  schemaVersion: 'agm-phase3-central-registry-post-apply-validation.v1',
  result: failed.length ? 'FAIL' : 'PASS',
  registry: { sourceCount: registry.sourceCount, sha256: registryHash },
  sourceChanges: { additions: 17, modifications: 0, deletions: 0 },
  classifications: { AUTHORITATIVE_WITH_SCOPE: 13, CONTEXTUAL: 4 },
  basicLibrarian: failedIn(checks, 'BASIC_LIBRARIAN_HASHES_3_OF_3_MATCH') ? 'FAIL' : 'UNCHANGED_3_OF_3_MATCH',
  unresolvedGaps: unresolved.gaps.map((gap) => gap.gapId),
  phase1Regression: phase1Checks.some((item) => item.status === 'FAIL') ? 'FAIL' : 'PASS',
  phase2Regression: phase2Checks.some((item) => item.status === 'FAIL') ? 'FAIL' : 'PASS',
  phase3Validation: phase3Checks.some((item) => item.status === 'FAIL') ? 'FAIL' : 'PASS',
  checks: allChecks,
};
writeJson('POST_APPLY_VALIDATION_REPORT.json', validation);
writeText('POST_APPLY_VALIDATION_REPORT.md', report(validation));
writeText('PHASE1_POST_APPLY_REGRESSION_REPORT.md', subreport('PHASE 1', phase1Checks));
writeText('PHASE2_POST_APPLY_REGRESSION_REPORT.md', subreport('PHASE 2', phase2Checks));
writeText('PHASE3_POST_APPLY_VALIDATION_REPORT.md', subreport('PHASE 3', phase3Checks));

for (const item of allChecks) console.log(`${item.name}=${item.status}${item.error ? ` error=${item.error}` : ''}`);
console.log(`PHASE1_REGRESSION=${validation.phase1Regression}`);
console.log(`PHASE2_REGRESSION=${validation.phase2Regression}`);
console.log(`PHASE3_VALIDATION=${validation.phase3Validation}`);
console.log(`POST_APPLY_VALIDATION=${validation.result}`);
console.log(`CENTRAL_REGISTRY_SHA256=${registryHash}`);
if (failed.length) process.exitCode = 1;

function validateHashBaseline(baseline) {
  assert(baseline.fileCount === baseline.files.length, 'BASELINE_COUNT');
  for (const item of baseline.files) {
    assert(existsSync(path.join(root, item.path)), `BASELINE_FILE_MISSING:${item.path}`);
    assert(statSync(path.join(root, item.path)).size === item.sizeBytes, `BASELINE_SIZE:${item.path}`);
    assert(sha(item.path) === item.sha256, `BASELINE_HASH:${item.path}`);
  }
}
function report(validation) {
  return `# PHASE 3 - Central Registry post-apply validation\n\n- validation: **${validation.result}**;\n- Central Registry: **${validation.registry.sourceCount}** sources;\n- additions / modifications / deletions: **17 / 0 / 0**;\n- AUTHORITATIVE_WITH_SCOPE / CONTEXTUAL: **13 / 4**;\n- registry SHA-256: \`${validation.registry.sha256}\`;\n- canonical artifact hash/provenance: **MATCH**;\n- Basic Librarian: **${validation.basicLibrarian}**;\n- PHASE 1 regression: **${validation.phase1Regression}**;\n- PHASE 2 regression: **${validation.phase2Regression}**;\n- PHASE 3 validation: **${validation.phase3Validation}**;\n- unresolved gaps: ROUTING-TOLL-001, LEGAL-003, LEGAL-005;\n- runtime / Production / TURN / architecture: **NO CHANGE**;\n- commit / push: **NOT EXECUTED**.\n\n## Checks\n\n${validation.checks.map((item) => `- ${item.name} = ${item.status}${item.error ? ` — ${item.error}` : ''}`).join('\n')}\n`;
}
function subreport(label, items) {
  const result = items.some((item) => item.status === 'FAIL') ? 'FAIL' : 'PASS';
  return `# ${label} post-apply regression\n\nResult: **${result}**\n\n${items.map((item) => `- ${item.name} = ${item.status}${item.error ? ` — ${item.error}` : ''}`).join('\n')}\n`;
}
function check(collection, name, operation) {
  try { operation(); collection.push({ name, status: 'PASS' }); }
  catch (error) { collection.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) }); }
}
function failedIn(collection, name) { return collection.find((item) => item.name === name)?.status === 'FAIL'; }
function readJson(relativePath) { return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')); }
function sha(relativePath) { return hash(readFileSync(path.join(root, relativePath))); }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function deepEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function setEquals(left, right) { return left.size === right.size && [...left].every((value) => right.has(value)); }
function writeJson(name, value) { writeText(name, `${JSON.stringify(value, null, 2)}\n`); }
function writeText(name, value) { writeFileSync(path.join(applyRoot, name), value, 'utf8'); }
function assert(value, message) { if (!value) throw new Error(message); }
