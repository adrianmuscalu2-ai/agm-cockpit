import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const registryRelative = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const registryPath = path.join(root, registryRelative);
const applyRoot = path.join(root, 'AGM_LIBRARY', 'PHASE3', 'CENTRAL_REGISTRY_APPLY');
const snapshotRelative = 'AGM_LIBRARY/PHASE3/CENTRAL_REGISTRY_APPLY/PRE_APPLY_CANONICAL_SOURCES.json';
const snapshotPath = path.join(root, snapshotRelative);
const tempPath = path.join(root, 'AGM_LIBRARY', 'REGISTRY', '.canonical-sources.phase3-atomic.tmp');
const applyTimestamp = '2026-08-29T18:15:07.867Z';
const expectedBeforeHash = '1c506707200d6c8b27217cdf00d00541a739ef5321bde1e5f892cb9098e61a34';
const changeset = readJson('AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/UPDATED_PROPOSED_CHANGESET.json');
const manifest = readJson('AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/CANONICAL_ARTIFACT_MANIFEST.json');
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const currentBytes = readFileSync(registryPath);
const currentHash = hash(currentBytes);
const current = JSON.parse(currentBytes.toString('utf8'));
const proposedEntries = changeset.operations.map((operation) => operation.proposedRegistryEntry);
const proposedIds = new Set(proposedEntries.map((entry) => entry.sourceId));

mkdirSync(applyRoot, { recursive: true });
validateAuthorizationPackage();

if (current.sourceCount === 815) {
  validateAlreadyApplied(current);
  console.log('ATOMIC_APPLY=PASS_ALREADY_APPLIED_IDEMPOTENT');
  console.log('REGISTRY_REGENERATION=NO_OP');
  console.log(`CENTRAL_REGISTRY_SHA256=${currentHash}`);
  process.exit(0);
}

assert(current.sourceCount === 798 && current.sources.length === 798, 'PRECONDITION_REGISTRY_COUNT_NOT_798');
assert(currentHash === expectedBeforeHash && currentHash === changeset.before.sha256, 'PRECONDITION_REGISTRY_HASH_MISMATCH');
assert([...proposedIds].every((sourceId) => !current.sources.some((source) => source.sourceId === sourceId)), 'PRECONDITION_SOURCE_ALREADY_PRESENT');

if (existsSync(snapshotPath)) {
  assert(hash(readFileSync(snapshotPath)) === expectedBeforeHash, 'EXISTING_SNAPSHOT_HASH_MISMATCH');
} else {
  writeDurable(snapshotPath, currentBytes);
}

const phase1Baseline = buildHashBaseline([
  'AGM_LIBRARY/SCHEMAS', 'AGM_LIBRARY/MAPPINGS', 'AGM_LIBRARY/VIEWS',
  'AGM_LIBRARY/GOVERNANCE',
  'AGM_LIBRARY/REPORTS/canonical-source-gaps.phase2.json',
  'AGM_LIBRARY/REPORTS/PHASE2_CANONICAL_SOURCE_GAPS.md',
  'CAR_MOVER/INDEX.json',
]);
const phase2Baseline = buildHashBaseline(['AGM_LIBRARY/PHASE2']);
writeJson('PHASE1_PRE_APPLY_HASH_BASELINE.json', phase1Baseline);
writeJson('PHASE2_PRE_APPLY_HASH_BASELINE.json', phase2Baseline);

const candidate = {
  ...current,
  generatedAt: applyTimestamp,
  sourceCount: current.sourceCount + proposedEntries.length,
  sources: [...current.sources, ...proposedEntries],
};
validateCandidate(current, candidate);

const candidateBytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`, 'utf8');
writeDurable(tempPath, candidateBytes);
assert(hash(readFileSync(tempPath)) === hash(candidateBytes), 'TEMP_CANDIDATE_WRITE_HASH_MISMATCH');

let post;
let postHash;
try {
  renameSync(tempPath, registryPath);
  post = readJson(registryRelative);
  postHash = sha(registryRelative);
  validateCandidate(current, post);
} catch (error) {
  rollbackToSnapshot();
  throw error;
}

const record = {
  schemaVersion: 'agm-phase3-central-registry-atomic-apply.v1',
  changesetId: changeset.changesetId,
  authority: { role: 'Product Owner', name: 'Adrian Muscalu' },
  applyTimestamp,
  mode: 'ATOMIC_APPLY',
  result: 'PASS',
  before: { sourceCount: 798, sha256: expectedBeforeHash, snapshotPath: snapshotRelative },
  after: { sourceCount: 815, sha256: postHash },
  sourceChanges: { additions: 17, modifications: 0, deletions: 0 },
  classificationCounts: { AUTHORITATIVE_WITH_SCOPE: 13, CONTEXTUAL: 4 },
  sourceIds: proposedEntries.map((entry) => entry.sourceId),
  unresolvedGapsRemainOpen: unresolved.gaps.map((gap) => gap.gapId),
  boundaries: {
    basicLibrarian: 'UNCHANGED', runtime: 'NO_CHANGE', production: 'NO_CHANGE', turn: 'NO_CHANGE',
    architecture: 'NO_CHANGE', commitPush: 'NOT_EXECUTED',
  },
  rollback: {
    available: true,
    script: 'scripts/rollback-agm-phase3-central-registry.mjs',
    authorizedOnlyOnPostApplyFailure: true,
    expectedRestoredCount: 798,
    expectedRestoredSha256: expectedBeforeHash,
  },
};
writeJson('APPLY_EXECUTION_RECORD.json', record);
writeJson('POST_APPLY_REGISTRY_DIFF.json', {
  schemaVersion: 'agm-phase3-post-apply-registry-diff.v1',
  before: record.before,
  after: record.after,
  additions: proposedEntries.map((entry) => ({ sourceId: entry.sourceId, authorityType: entry.authority.authorityType, sha256: entry.sha256 })),
  modifications: [],
  deletions: [],
});
writeText('APPLY_EXECUTION_REPORT.md', `# PHASE 3 - Central Registry atomic apply\n\n- authority: Product Owner - Adrian Muscalu;\n- timestamp: \`${applyTimestamp}\`;\n- transition: **798 -> 815**;\n- additions / modifications / deletions: **17 / 0 / 0**;\n- AUTHORITATIVE_WITH_SCOPE / CONTEXTUAL: **13 / 4**;\n- before SHA-256: \`${expectedBeforeHash}\`;\n- after SHA-256: \`${postHash}\`;\n- atomic apply: **PASS**;\n- partial apply: **NONE**;\n- rollback snapshot: \`${snapshotRelative}\`;\n- unresolved gaps: ROUTING-TOLL-001, LEGAL-003, LEGAL-005;\n- Basic Librarian / runtime / Production / TURN / architecture: **NO CHANGE**;\n- commit / push: **NOT EXECUTED**.\n`);

console.log('CENTRAL_REGISTRY_TRANSITION=798_TO_815');
console.log('ADD=17');
console.log('MODIFY=0');
console.log('DELETE=0');
console.log('ATOMIC_APPLY=PASS');
console.log(`CENTRAL_REGISTRY_SHA256=${postHash}`);

function validateAuthorizationPackage() {
  assert(changeset.status === 'FINAL_PRE_APPLY_INTEGRITY_VERIFIED_NOT_APPLIED', 'CHANGESET_NOT_FINAL_PRE_APPLY');
  assert(changeset.operationCount === 17 && changeset.verifiedOperationCount === 17 && changeset.blockedOperationCount === 0, 'CHANGESET_COUNTS');
  assert(changeset.atomicApply === true && changeset.partialApplyForbidden === true, 'CHANGESET_NOT_ATOMIC');
  assert(changeset.centralRegistryMutationAuthorized === false, 'PRE_APPLY_PACKAGE_BOUNDARY_DRIFT');
  assert(proposedEntries.length === 17 && proposedEntries.every(Boolean), 'PROPOSED_ENTRY_COUNT');
  assert(proposedIds.size === 17, 'PROPOSED_SOURCE_ID_DUPLICATE');
  assert(manifest.integrityVerifiedCount === 17 && manifest.integrityBlockedCount === 0, 'INTEGRITY_NOT_17_OF_17');
  assert(proposedEntries.filter((entry) => entry.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length === 13, 'AUTHORITATIVE_COUNT');
  assert(proposedEntries.filter((entry) => entry.authority.authorityType === 'CONTEXTUAL').length === 4, 'CONTEXTUAL_COUNT');
  for (const entry of proposedEntries) {
    const artifact = manifest.sources.find((item) => item.sourceId === entry.sourceId);
    assert(artifact?.validation.result === 'INTEGRITY_VERIFIED', `INTEGRITY:${entry.sourceId}`);
    assert(entry.canonicalPath === artifact.canonicalArtifactPath, `PATH:${entry.sourceId}`);
    assert(entry.sizeBytes === artifact.sizeBytes && entry.sha256 === artifact.sha256, `HASH_OR_SIZE:${entry.sourceId}`);
    assert(existsSync(path.join(root, entry.canonicalPath)), `ARTIFACT_MISSING:${entry.sourceId}`);
    assert(statSync(path.join(root, entry.canonicalPath)).size === entry.sizeBytes && sha(entry.canonicalPath) === entry.sha256, `ARTIFACT_DRIFT:${entry.sourceId}`);
  }
}

function validateCandidate(before, after) {
  assert(after.sourceCount === 815 && after.sources.length === 815, 'POST_COUNT_NOT_815');
  assert(new Set(after.sources.map((source) => source.sourceId)).size === 815, 'POST_DUPLICATE_SOURCE_ID');
  assert(after.sources.slice(0, 798).every((source, index) => deepEqual(source, before.sources[index])), 'EXISTING_SOURCE_MODIFIED');
  assert(after.sources.slice(798).length === 17, 'POST_ADDITION_COUNT');
  for (let index = 0; index < proposedEntries.length; index += 1) {
    assert(deepEqual(after.sources[798 + index], proposedEntries[index]), `ADDITION_MISMATCH:${proposedEntries[index].sourceId}`);
  }
  const afterIds = new Set(after.sources.map((source) => source.sourceId));
  for (const source of before.sources) assert(afterIds.has(source.sourceId), `SOURCE_DELETED:${source.sourceId}`);
}

function validateAlreadyApplied(after) {
  assert(existsSync(snapshotPath), 'IDEMPOTENCE_SNAPSHOT_MISSING');
  const beforeBytes = readFileSync(snapshotPath);
  assert(hash(beforeBytes) === expectedBeforeHash, 'IDEMPOTENCE_SNAPSHOT_HASH');
  const before = JSON.parse(beforeBytes.toString('utf8'));
  validateCandidate(before, after);
  const record = readJson('AGM_LIBRARY/PHASE3/CENTRAL_REGISTRY_APPLY/APPLY_EXECUTION_RECORD.json');
  assert(record.after.sha256 === hash(readFileSync(registryPath)), 'IDEMPOTENCE_POST_HASH_DRIFT');
}

function rollbackToSnapshot() {
  const snapshot = readFileSync(snapshotPath);
  assert(hash(snapshot) === expectedBeforeHash, 'ROLLBACK_SNAPSHOT_INVALID');
  const rollbackTemp = path.join(root, 'AGM_LIBRARY', 'REGISTRY', '.canonical-sources.phase3-rollback.tmp');
  writeDurable(rollbackTemp, snapshot);
  renameSync(rollbackTemp, registryPath);
  assert(sha(registryRelative) === expectedBeforeHash, 'ROLLBACK_HASH_MISMATCH');
  const restored = readJson(registryRelative);
  assert(restored.sourceCount === 798 && restored.sources.length === 798, 'ROLLBACK_COUNT_MISMATCH');
}

function buildHashBaseline(targets) {
  const files = [];
  for (const target of targets) {
    const absolute = path.join(root, target);
    if (statSync(absolute).isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return {
    generatedAt: applyTimestamp,
    fileCount: files.length,
    files: files.sort().map((absolute) => ({ path: relative(absolute), sizeBytes: statSync(absolute).size, sha256: hash(readFileSync(absolute)) })),
  };
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function writeDurable(absolutePath, bytes) {
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, bytes);
  assert(hash(readFileSync(absolutePath)) === hash(bytes), `WRITE_READBACK_HASH_MISMATCH:${relative(absolutePath)}`);
}
function writeJson(name, value) { writeText(name, `${JSON.stringify(value, null, 2)}\n`); }
function writeText(name, value) { writeFileSync(path.join(applyRoot, name), value, 'utf8'); }
function readJson(relativePath) { return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')); }
function sha(relativePath) { return hash(readFileSync(path.join(root, relativePath))); }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function deepEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function relative(absolute) { return path.relative(root, absolute).replaceAll('\\', '/'); }
function assert(value, message) { if (!value) throw new Error(message); }
