import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CONSOLIDATED_PRE_APPLY';
const registryRelative = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewRelative = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const packageRelative = `${packageRoot}/FINAL_PRE_APPLY_PACKAGE.json`;
const changesetRelative = `${packageRoot}/FINAL_ATOMIC_CHANGESET.json`;
const decisionsRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION/PRODUCT_OWNER_AUTHORITY_DECISIONS.json';
const expected = {
  baselineRegistrySha256: 'f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d',
  baselineViewSha256: '001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997',
  packageSha256: '9047cb3e0c11ec9bd7f7133df397ad0bed2bc3b6e6f4bcca591d186bf219eac7',
  changesetSha256: '1b3654578a99cca7fbae5761fed27c4ff4c8a9b57a4db53bc80f2163ea12c04a',
  projectedRegistrySha256: '462db7f3a72204010972aa605901783997feff9ada7aac760ab03b358b2cd076',
  projectedViewSha256: '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0',
};

if (!process.argv.includes('--product-owner-authorized')) {
  throw new Error('PRODUCT_OWNER_AUTHORIZATION_FLAG_REQUIRED');
}

const absolute = (relative) => path.join(root, relative);
const read = (relative) => readFileSync(absolute(relative));
const json = (relative) => JSON.parse(read(relative).toString('utf8').replace(/^\uFEFF/, ''));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fileSha = (relative) => sha(read(relative));
const serialize = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const assert = (condition, code) => { if (!condition) throw new Error(code); };

assert(fileSha(packageRelative) === expected.packageSha256, 'FINAL_PACKAGE_HASH_MISMATCH');
assert(fileSha(changesetRelative) === expected.changesetSha256, 'FINAL_CHANGESET_HASH_MISMATCH');
const packageData = json(packageRelative);
const changeset = json(changesetRelative);
const decisions = json(decisionsRelative);
assert(packageData.status === 'PASS_READY_FOR_PRODUCT_OWNER_APPLY_REVIEW_NOT_AUTHORIZED_NOT_EXECUTED', 'FINAL_PACKAGE_STATUS_INVALID');
assert(decisions.summary.total === 10 && decisions.summary.approved === 10 && decisions.summary.pending === 0 && decisions.summary.rejected === 0 && decisions.summary.deferred === 0, 'DECISION_REGISTER_NOT_10_OF_10_APPROVE');
assert(changeset.operations.add === 10 && changeset.operations.modify === 0 && changeset.operations.delete === 0, 'CHANGESET_OPERATIONS_NOT_10_0_0');
assert(changeset.additions.length === 10 && changeset.routingTollMembershipAdditions.length === 10, 'CHANGESET_CARDINALITY_INVALID');
assert(Object.values(changeset.collisionChecks).every(Boolean), 'CHANGESET_COLLISION_CHECK_FAILED');
assert(changeset.projected.registrySha256 === expected.projectedRegistrySha256 && changeset.projected.routingTollViewSha256 === expected.projectedViewSha256, 'PROJECTED_HASH_BINDING_INVALID');

const currentRegistrySha = fileSha(registryRelative);
const currentViewSha = fileSha(viewRelative);
if (currentRegistrySha === expected.projectedRegistrySha256 && currentViewSha === expected.projectedViewSha256) {
  const registry = json(registryRelative);
  const view = json(viewRelative);
  assert(registry.sourceCount === 841 && registry.sources.length === 841, 'ALREADY_APPLIED_REGISTRY_COUNT_INVALID');
  assert(view.sourceCount === 289 && view.memberships.length === 289, 'ALREADY_APPLIED_VIEW_COUNT_INVALID');
  console.log(JSON.stringify({ status: 'ALREADY_APPLIED_IDEMPOTENT_PASS', registry: { count: 841, sha256: currentRegistrySha }, routingTollView: { count: 289, sha256: currentViewSha }, operationsReexecuted: 0 }, null, 2));
  process.exit(0);
}
assert(currentRegistrySha === expected.baselineRegistrySha256, 'REGISTRY_BASELINE_PRECONDITION_FAILED');
assert(currentViewSha === expected.baselineViewSha256, 'VIEW_BASELINE_PRECONDITION_FAILED');

const registry = json(registryRelative);
const view = json(viewRelative);
assert(registry.sourceCount === 831 && registry.sources.length === 831, 'REGISTRY_BASELINE_COUNT_INVALID');
assert(view.sourceCount === 279 && view.memberships.length === 279, 'VIEW_BASELINE_COUNT_INVALID');
const registryIds = new Set(registry.sources.map((source) => source.sourceId));
const registryHashes = new Set(registry.sources.map((source) => source.sha256));
const registryUris = new Set(registry.sources.map((source) => source.canonicalUri));
const membershipIds = new Set(view.memberships.map((membership) => membership.membershipId));
assert(changeset.additions.every((source) => !registryIds.has(source.sourceId) && !registryHashes.has(source.sha256) && !registryUris.has(source.canonicalUri)), 'LIVE_REGISTRY_COLLISION');
assert(changeset.routingTollMembershipAdditions.every((membership) => !membershipIds.has(membership.membershipId)), 'LIVE_VIEW_COLLISION');
for (const source of changeset.additions) {
  assert(fileSha(source.canonicalPath) === source.sha256 && read(source.canonicalPath).length === source.sizeBytes, `ARTIFACT_INTEGRITY_FAILED:${source.sourceId}`);
}

const projectedRegistry = {
  ...registry,
  registryVersion: '1.3.0',
  generatedAt: changeset.generatedAt,
  sourceCount: registry.sourceCount + changeset.additions.length,
  sources: [...registry.sources, ...changeset.additions],
};
const currentViewSourceIds = new Set(view.memberships.map((membership) => membership.sourceId));
const projectedHashes = new Set([
  ...registry.sources.filter((source) => currentViewSourceIds.has(source.sourceId)).map((source) => source.sha256),
  ...changeset.additions.map((source) => source.sha256),
]);
const projectedView = {
  ...view,
  viewVersion: '1.3.0',
  generatedAt: changeset.generatedAt,
  sourceCount: view.sourceCount + changeset.routingTollMembershipAdditions.length,
  uniqueContentHashes: projectedHashes.size,
  memberships: [...view.memberships, ...changeset.routingTollMembershipAdditions],
};
const projectedRegistryBytes = serialize(projectedRegistry);
const projectedViewBytes = serialize(projectedView);
assert(sha(projectedRegistryBytes) === expected.projectedRegistrySha256, 'RECOMPUTED_REGISTRY_HASH_MISMATCH');
assert(sha(projectedViewBytes) === expected.projectedViewSha256, 'RECOMPUTED_VIEW_HASH_MISMATCH');
assert(projectedRegistry.sourceCount === 841 && projectedView.sourceCount === 289 && projectedView.uniqueContentHashes === 274, 'PROJECTED_COUNTS_INVALID');

const registryPath = absolute(registryRelative);
const viewPath = absolute(viewRelative);
const registryStage = `${registryPath}.routing-toll-001-stage`;
const viewStage = `${viewPath}.routing-toll-001-stage`;
const registryBackup = `${registryPath}.routing-toll-001-backup`;
const viewBackup = `${viewPath}.routing-toll-001-backup`;
const lockPath = absolute(`${packageRoot}/.atomic-apply.lock`);
for (const transactionPath of [registryStage, viewStage, registryBackup, viewBackup, lockPath]) assert(!existsSync(transactionPath), `TRANSACTION_PATH_ALREADY_EXISTS:${transactionPath}`);

let lockHandle;
try {
  lockHandle = openSync(lockPath, 'wx');
  writeAndSync(registryStage, projectedRegistryBytes);
  writeAndSync(viewStage, projectedViewBytes);
  assert(sha(readFileSync(registryStage)) === expected.projectedRegistrySha256, 'STAGED_REGISTRY_HASH_MISMATCH');
  assert(sha(readFileSync(viewStage)) === expected.projectedViewSha256, 'STAGED_VIEW_HASH_MISMATCH');
  try {
    renameSync(registryPath, registryBackup);
    renameSync(viewPath, viewBackup);
    renameSync(registryStage, registryPath);
    renameSync(viewStage, viewPath);
    assert(fileSha(registryRelative) === expected.projectedRegistrySha256, 'COMMITTED_REGISTRY_HASH_MISMATCH');
    assert(fileSha(viewRelative) === expected.projectedViewSha256, 'COMMITTED_VIEW_HASH_MISMATCH');
    unlinkSync(registryBackup);
    unlinkSync(viewBackup);
  } catch (error) {
    rollback(registryPath, registryBackup, registryStage);
    rollback(viewPath, viewBackup, viewStage);
    throw error;
  }
} finally {
  if (lockHandle !== undefined) closeSync(lockHandle);
  if (existsSync(lockPath)) unlinkSync(lockPath);
  if (existsSync(registryStage)) unlinkSync(registryStage);
  if (existsSync(viewStage)) unlinkSync(viewStage);
}

console.log(JSON.stringify({
  status: 'ATOMIC_APPLY_PASS',
  operations: { add: 10, modify: 0, delete: 0 },
  registry: { beforeCount: 831, afterCount: 841, beforeSha256: expected.baselineRegistrySha256, afterSha256: fileSha(registryRelative) },
  routingTollView: { beforeCount: 279, afterCount: 289, beforeSha256: expected.baselineViewSha256, afterSha256: fileSha(viewRelative) },
  rollbackRequired: false,
}, null, 2));

function writeAndSync(target, content) {
  const handle = openSync(target, 'wx');
  try {
    writeSync(handle, content);
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
}

function rollback(target, backup, stage) {
  if (existsSync(target) && existsSync(backup)) unlinkSync(target);
  if (existsSync(backup)) renameSync(backup, target);
  if (existsSync(stage)) unlinkSync(stage);
}
