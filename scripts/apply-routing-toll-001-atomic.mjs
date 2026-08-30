import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const registryRelative = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewRelative = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const changesetRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_PRE_APPLY/FINAL_ATOMIC_CHANGESET.json';
const ownerDecisionRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_PRE_APPLY/PRODUCT_OWNER_DECISION_16_OF_16.json';
const applyAuthorizationRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_ATOMIC_APPLY/PRODUCT_OWNER_ATOMIC_APPLY_AUTHORIZATION.json';
const applyRootRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_ATOMIC_APPLY';
const applyRoot = path.join(root, applyRootRelative);
const registryPath = path.join(root, registryRelative);
const viewPath = path.join(root, viewRelative);
const registryBackupRelative = `${applyRootRelative}/PRE_APPLY_REGISTRY.json`;
const viewBackupRelative = `${applyRootRelative}/PRE_APPLY_ROUTING_TOLL_VIEW.json`;
const registryTemp = path.join(path.dirname(registryPath), '.canonical-sources.routing-toll-001.tmp');
const viewTemp = path.join(path.dirname(viewPath), '.routing-toll.routing-toll-001.tmp');
const registryRollbackTemp = path.join(path.dirname(registryPath), '.canonical-sources.routing-toll-001.rollback.tmp');
const viewRollbackTemp = path.join(path.dirname(viewPath), '.routing-toll.routing-toll-001.rollback.tmp');
const expectedBeforeRegistryHash = 'af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31';
const expectedBeforeViewHash = 'eb8e0b1b02b34033ad689b0aa35da616b924cc333d2d22187e466505ffcc801f';
const expectedAfterRegistryHash = 'f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d';
const expectedAfterViewHash = '001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997';
const generatedAt = '2026-08-30T01:00:00.000Z';

const changeset = readJson(changesetRelative);
const ownerDecision = readJson(ownerDecisionRelative);
const applyAuthorization = readJson(applyAuthorizationRelative);
const currentRegistryBytes = readFileSync(registryPath);
const currentViewBytes = readFileSync(viewPath);
const currentRegistry = JSON.parse(currentRegistryBytes.toString('utf8'));
const currentView = JSON.parse(currentViewBytes.toString('utf8'));
mkdirSync(applyRoot, { recursive: true });

validateAuthorizationPackage();

if (currentRegistry.sourceCount === 831 || currentView.sourceCount === 279) {
  assert(currentRegistry.sourceCount === 831 && currentView.sourceCount === 279, 'PARTIAL_APPLY_STATE_DETECTED');
  assert(hash(currentRegistryBytes) === expectedAfterRegistryHash, 'ALREADY_APPLIED_REGISTRY_HASH_MISMATCH');
  assert(hash(currentViewBytes) === expectedAfterViewHash, 'ALREADY_APPLIED_VIEW_HASH_MISMATCH');
  validateAppliedFromBackups();
  console.log(JSON.stringify({ atomicApply: 'PASS_ALREADY_APPLIED_IDEMPOTENT', registry: '831', view: '279', registrySha256: expectedAfterRegistryHash, viewSha256: expectedAfterViewHash }, null, 2));
  process.exit(0);
}

assert(currentRegistry.sourceCount === 815 && currentRegistry.sources.length === 815, 'PRECONDITION_REGISTRY_COUNT_NOT_815');
assert(hash(currentRegistryBytes) === expectedBeforeRegistryHash, 'PRECONDITION_REGISTRY_HASH_MISMATCH');
assert(currentView.sourceCount === 263 && currentView.memberships.length === 263, 'PRECONDITION_VIEW_COUNT_NOT_263');
assert(hash(currentViewBytes) === expectedBeforeViewHash, 'PRECONDITION_VIEW_HASH_MISMATCH');

const proposedIds = new Set(changeset.additions.map((source) => source.sourceId));
const proposedMembershipIds = new Set(changeset.routingTollMembershipAdditions.map((membership) => membership.membershipId));
assert(proposedIds.size === 16 && changeset.additions.length === 16, 'PROPOSED_SOURCE_ID_COUNT');
assert(proposedMembershipIds.size === 16 && changeset.routingTollMembershipAdditions.length === 16, 'PROPOSED_MEMBERSHIP_COUNT');
assert(changeset.additions.every((source) => !currentRegistry.sources.some((existing) => existing.sourceId === source.sourceId)), 'PROPOSED_SOURCE_ALREADY_PRESENT');
assert(changeset.routingTollMembershipAdditions.every((membership) => !currentView.memberships.some((existing) => existing.membershipId === membership.membershipId || existing.sourceId === membership.sourceId)), 'PROPOSED_MEMBERSHIP_ALREADY_PRESENT');

writeOrValidateBackup(registryBackupRelative, currentRegistryBytes, expectedBeforeRegistryHash);
writeOrValidateBackup(viewBackupRelative, currentViewBytes, expectedBeforeViewHash);

const candidateRegistry = {
  ...currentRegistry,
  registryVersion: '1.1.0',
  generatedAt,
  sourceCount: 831,
  sources: [...currentRegistry.sources, ...changeset.additions],
};
const candidateView = {
  ...currentView,
  viewVersion: '1.2.0',
  generatedAt,
  sourceCount: 279,
  uniqueContentHashes: 264,
  memberships: [...currentView.memberships, ...changeset.routingTollMembershipAdditions],
};
validateCandidates(currentRegistry, currentView, candidateRegistry, candidateView);
const candidateRegistryBytes = Buffer.from(`${JSON.stringify(candidateRegistry, null, 2)}\n`, 'utf8');
const candidateViewBytes = Buffer.from(`${JSON.stringify(candidateView, null, 2)}\n`, 'utf8');
assert(hash(candidateRegistryBytes) === expectedAfterRegistryHash && hash(candidateRegistryBytes) === changeset.projected.registrySha256, 'STAGED_REGISTRY_HASH_MISMATCH');
assert(hash(candidateViewBytes) === expectedAfterViewHash && hash(candidateViewBytes) === changeset.projected.routingTollViewSha256, 'STAGED_VIEW_HASH_MISMATCH');
writeDurable(registryTemp, candidateRegistryBytes);
writeDurable(viewTemp, candidateViewBytes);

let rollbackExecuted = false;
try {
  renameSync(registryTemp, registryPath);
  renameSync(viewTemp, viewPath);
  const appliedRegistry = readJson(registryRelative);
  const appliedView = readJson(viewRelative);
  validateCandidates(currentRegistry, currentView, appliedRegistry, appliedView);
  assert(hash(readFileSync(registryPath)) === expectedAfterRegistryHash, 'POST_REGISTRY_HASH_MISMATCH');
  assert(hash(readFileSync(viewPath)) === expectedAfterViewHash, 'POST_VIEW_HASH_MISMATCH');
  validateProtectedState();
} catch (error) {
  rollbackExecuted = true;
  rollback();
  writeJson('FAILED_APPLY_RECORD.json', {
    schemaVersion: 'agm-routing-toll-001-failed-apply.v1',
    result: 'FAIL_ROLLED_BACK',
    error: error instanceof Error ? error.message : String(error),
    restored: { registryCount: 815, registrySha256: hash(readFileSync(registryPath)), viewCount: 263, viewSha256: hash(readFileSync(viewPath)) },
  });
  throw error;
}

const record = {
  schemaVersion: 'agm-routing-toll-001-atomic-apply.v1',
  authority: { role: 'Product Owner', name: 'Adrian Muscalu', decisionReference: ownerDecisionRelative },
  changeset: changesetRelative,
  result: 'PASS',
  before: { registryCount: 815, registrySha256: expectedBeforeRegistryHash, viewCount: 263, viewSha256: expectedBeforeViewHash },
  after: { registryCount: 831, registrySha256: expectedAfterRegistryHash, viewCount: 279, viewSha256: expectedAfterViewHash },
  operations: { additions: 16, modifications: 0, deletions: 0, membershipsAdded: 16 },
  classifications: { AUTHORITATIVE_WITH_SCOPE: 12, CONTEXTUAL: 4 },
  integrity: { artifacts: '16/16_MATCH', provenance: '16/16_VERIFIED', canonicalDuplicates: 0 },
  rollback: { available: true, executed: rollbackExecuted, registryBackup: registryBackupRelative, viewBackup: viewBackupRelative },
  gapState: 'ROUTING-TOLL-001_OPEN_PARTIALLY_READY',
  protections: { basicLibrarian: 'UNCHANGED', legal003: 'OPEN_UNCHANGED', legal005: 'OPEN_UNCHANGED', runtimeProductionTurnApplicationApi: 'NO_CHANGE', commitPush: 'NOT_EXECUTED' },
};
writeJson('ATOMIC_APPLY_EXECUTION_RECORD.json', record);
writeJson('POST_APPLY_DIFF.json', {
  schemaVersion: 'agm-routing-toll-001-post-apply-diff.v1',
  before: record.before,
  after: record.after,
  additions: changeset.additions.map((source) => ({ sourceId: source.sourceId, classification: source.authority.authorityType, sha256: source.sha256 })),
  modifications: [],
  deletions: [],
  membershipsAdded: changeset.routingTollMembershipAdditions,
  gapClosed: false,
});
writeFileSync(path.join(applyRoot, 'ATOMIC_APPLY_REPORT.md'), `# ROUTING-TOLL-001 — atomic apply\n\n- result: **PASS**;\n- Registry: **815 → 831**;\n- Routing/Toll view: **263 → 279**;\n- ADD/MODIFY/DELETE: **16/0/0**;\n- classification: **12 AUTHORITATIVE_WITH_SCOPE + 4 CONTEXTUAL**;\n- Registry SHA-256: \`${expectedAfterRegistryHash}\`;\n- Routing/Toll view SHA-256: \`${expectedAfterViewHash}\`;\n- artifact/provenance: **16/16 MATCH / 16/16 VERIFIED**;\n- canonical duplicates: **0**;\n- rollback: **NOT EXECUTED / AVAILABLE**;\n- ROUTING-TOLL-001: **OPEN / PARTIALLY_READY**;\n- commit/push: **NOT EXECUTED**.\n`, 'utf8');

console.log(JSON.stringify({ atomicApply: 'PASS', registry: '815_TO_831', view: '263_TO_279', addModifyDelete: '16/0/0', registrySha256: expectedAfterRegistryHash, viewSha256: expectedAfterViewHash, rollbackExecuted, gap: 'OPEN_PARTIALLY_READY' }, null, 2));

function validateAuthorizationPackage() {
  assert(ownerDecision.counts.approved === 16 && ownerDecision.counts.pending === 0, 'OWNER_DECISIONS_NOT_16_OF_16');
  assert(ownerDecision.atomicApplyAuthorized === false, 'OWNER_DECISION_RECORD_BOUNDARY_DRIFT');
  assert(applyAuthorization.atomicApplyAuthorized === true && applyAuthorization.partialApplyForbidden === true && applyAuthorization.rollbackAuthorizedOnFailure === true, 'ATOMIC_APPLY_NOT_AUTHORIZED');
  assert(applyAuthorization.authorizedChangeset === changesetRelative && applyAuthorization.authorizedChangesetSha256 === hash(readFileSync(path.join(root, changesetRelative))), 'AUTHORIZED_CHANGESET_MISMATCH');
  assert(applyAuthorization.expectedFinalHashes.registry === expectedAfterRegistryHash && applyAuthorization.expectedFinalHashes.routingTollView === expectedAfterViewHash, 'AUTHORIZED_FINAL_HASH_MISMATCH');
  assert(changeset.status === 'READY_NOT_AUTHORIZED_NOT_EXECUTED' && changeset.executed === false, 'CHANGESET_PRE_APPLY_STATUS_DRIFT');
  assert(changeset.activationCondition === 'SEPARATE_EXPLICIT_PRODUCT_OWNER_ATOMIC_APPLY_AUTHORIZATION', 'CHANGESET_ACTIVATION_CONDITION');
  assert(changeset.operations.add === 16 && changeset.operations.modifyExistingSources === 0 && changeset.operations.delete === 0, 'CHANGESET_OPERATION_COUNTS');
  assert(changeset.additions.filter((source) => source.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length === 12, 'AUTHORITATIVE_COUNT');
  assert(changeset.additions.filter((source) => source.authority.authorityType === 'CONTEXTUAL').length === 4, 'CONTEXTUAL_COUNT');
  assert(changeset.canonicalDuplication === false && changeset.gapStateAfterApply === 'ROUTING-TOLL-001_OPEN_PARTIALLY_READY', 'CHANGESET_GOVERNANCE_BOUNDARY');
  for (const source of changeset.additions) {
    assert(existsSync(path.join(root, source.canonicalPath)), `ARTIFACT_MISSING:${source.sourceId}`);
    assert(statSync(path.join(root, source.canonicalPath)).size === source.sizeBytes, `ARTIFACT_SIZE:${source.sourceId}`);
    assert(hash(readFileSync(path.join(root, source.canonicalPath))) === source.sha256, `ARTIFACT_HASH:${source.sourceId}`);
    assert(source.authority.reviewStatus === 'PRODUCT_OWNER_APPROVED_2026_08_30_WITH_EXACT_SCOPE' && source.authority.humanReviewRequired === false, `AUTHORITY_REVIEW:${source.sourceId}`);
  }
}

function validateCandidates(beforeRegistry, beforeView, afterRegistry, afterView) {
  assert(afterRegistry.sourceCount === 831 && afterRegistry.sources.length === 831, 'REGISTRY_POST_COUNT');
  assert(new Set(afterRegistry.sources.map((source) => source.sourceId)).size === 831, 'REGISTRY_DUPLICATE_SOURCE_ID');
  assert(afterRegistry.sources.slice(0, 815).every((source, index) => deepEqual(source, beforeRegistry.sources[index])), 'EXISTING_REGISTRY_SOURCE_MODIFIED');
  assert(afterRegistry.sources.slice(815).every((source, index) => deepEqual(source, changeset.additions[index])), 'REGISTRY_ADDITION_DRIFT');
  assert(afterView.sourceCount === 279 && afterView.memberships.length === 279 && afterView.uniqueContentHashes === 264, 'VIEW_POST_COUNTS');
  assert(new Set(afterView.memberships.map((membership) => membership.membershipId)).size === 279, 'VIEW_DUPLICATE_MEMBERSHIP_ID');
  assert(new Set(afterView.memberships.map((membership) => membership.sourceId)).size === 279, 'VIEW_DUPLICATE_SOURCE_ID');
  assert(afterView.memberships.slice(0, 263).every((membership, index) => deepEqual(membership, beforeView.memberships[index])), 'EXISTING_VIEW_MEMBERSHIP_MODIFIED');
  assert(afterView.memberships.slice(263).every((membership, index) => deepEqual(membership, changeset.routingTollMembershipAdditions[index])), 'VIEW_ADDITION_DRIFT');
}

function validateProtectedState() {
  const gaps = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
  for (const gapId of ['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']) assert(gaps.gaps.find((gap) => gap.gapId === gapId)?.state === 'OPEN', `PROTECTED_GAP:${gapId}`);
  const basic = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/BASIC_LIBRARIAN_INTEGRITY.json');
  for (const item of basic.checks) assert(hash(readFileSync(path.join(root, item.path))) === item.expectedSha256, `BASIC_HASH:${item.path}`);
}

function validateAppliedFromBackups() {
  assert(existsSync(path.join(root, registryBackupRelative)) && hash(readFileSync(path.join(root, registryBackupRelative))) === expectedBeforeRegistryHash, 'IDEMPOTENCE_REGISTRY_BACKUP');
  assert(existsSync(path.join(root, viewBackupRelative)) && hash(readFileSync(path.join(root, viewBackupRelative))) === expectedBeforeViewHash, 'IDEMPOTENCE_VIEW_BACKUP');
  const beforeRegistry = JSON.parse(readFileSync(path.join(root, registryBackupRelative), 'utf8'));
  const beforeView = JSON.parse(readFileSync(path.join(root, viewBackupRelative), 'utf8'));
  validateCandidates(beforeRegistry, beforeView, currentRegistry, currentView);
  validateProtectedState();
}

function rollback() {
  const registryBackup = readFileSync(path.join(root, registryBackupRelative));
  const viewBackup = readFileSync(path.join(root, viewBackupRelative));
  assert(hash(registryBackup) === expectedBeforeRegistryHash && hash(viewBackup) === expectedBeforeViewHash, 'ROLLBACK_BACKUP_INVALID');
  writeDurable(registryRollbackTemp, registryBackup);
  writeDurable(viewRollbackTemp, viewBackup);
  renameSync(registryRollbackTemp, registryPath);
  renameSync(viewRollbackTemp, viewPath);
  assert(hash(readFileSync(registryPath)) === expectedBeforeRegistryHash && hash(readFileSync(viewPath)) === expectedBeforeViewHash, 'ROLLBACK_HASH_MISMATCH');
}

function writeOrValidateBackup(relative, bytes, expectedHash) {
  const absolute = path.join(root, relative);
  if (existsSync(absolute)) assert(hash(readFileSync(absolute)) === expectedHash, `BACKUP_HASH_MISMATCH:${relative}`);
  else writeDurable(absolute, bytes);
}
function writeDurable(absolute, bytes) {
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, bytes);
  assert(hash(readFileSync(absolute)) === hash(bytes), `WRITE_READBACK_HASH_MISMATCH:${path.relative(root, absolute)}`);
}
function writeJson(name, value) { writeFileSync(path.join(applyRoot, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(relative) { return JSON.parse(readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, '')); }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function deepEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function assert(value, message) { if (!value) throw new Error(message); }
