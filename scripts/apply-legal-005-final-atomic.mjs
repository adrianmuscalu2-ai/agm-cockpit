import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageRoot = 'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY';
const applyRoot = 'AGM_LIBRARY/PHASE3/LEGAL_005_ATOMIC_APPLY';
const registryRelative = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const legislationViewRelative = 'AGM_LIBRARY/VIEWS/legislation-safety.view.json';
const routingViewRelative = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const packageRelative = `${packageRoot}/FINAL_PRE_APPLY_PACKAGE.json`;
const changesetRelative = `${packageRoot}/PROJECTED_CHANGESET.json`;
const projectedRegistryRelative = `${packageRoot}/PROJECTED_REGISTRY.json`;
const projectedViewRelative = `${packageRoot}/PROJECTED_LEGISLATION_SAFETY_VIEW.json`;
const decisionsRelative = 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW/PRODUCT_OWNER_DECISIONS.json';
const expected = {
  baselineRegistrySha256: '462db7f3a72204010972aa605901783997feff9ada7aac760ab03b358b2cd076',
  baselineLegislationViewSha256: '2db4f2b915e256f013bc4ed59188d810230a33c335333ec8cf364c6f1284dac1',
  routingViewSha256: '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0',
  packageSha256: 'da18b651e4994b0ff213e5d7441757bc638cd9523eaae03573c388c87399dd79',
  changesetSha256: '6a8ab4afe7ab6f183f9e2e8ed945d38bd55f1dc7c74d5fbfbff639d07f2469a7',
  decisionsSha256: 'db40d51b3175f3de99854e7dff5fdd02725c7a30d935fbcb20b74a8455f647bf',
  projectedRegistrySha256: '7d4901c4479129669e8036197cbdb116674f219ea21db34db7e1d20eefc48245',
  projectedLegislationViewSha256: 'c6d45d7c4fcc86574790add0491e37727691909f287d461e356be05f69a1b0ab',
};

if (!process.argv.includes('--product-owner-authorized')) throw new Error('PRODUCT_OWNER_AUTHORIZATION_FLAG_REQUIRED');

const absolute = (relative) => path.join(root, relative);
const read = (relative) => readFileSync(absolute(relative));
const json = (relative) => JSON.parse(read(relative).toString('utf8').replace(/^\uFEFF/, ''));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fileSha = (relative) => sha(read(relative));
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const deepEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

assert(fileSha(packageRelative) === expected.packageSha256, 'FINAL_PACKAGE_HASH_MISMATCH');
assert(fileSha(changesetRelative) === expected.changesetSha256, 'FINAL_CHANGESET_HASH_MISMATCH');
assert(fileSha(decisionsRelative) === expected.decisionsSha256, 'OWNER_DECISIONS_HASH_MISMATCH');
assert(fileSha(projectedRegistryRelative) === expected.projectedRegistrySha256, 'PROJECTED_REGISTRY_FILE_HASH_MISMATCH');
assert(fileSha(projectedViewRelative) === expected.projectedLegislationViewSha256, 'PROJECTED_LEGISLATION_VIEW_FILE_HASH_MISMATCH');
assert(fileSha(routingViewRelative) === expected.routingViewSha256, 'ROUTING_TOLL_PRECONDITION_FAILED');

const packageData = json(packageRelative);
const changeset = json(changesetRelative);
const decisions = json(decisionsRelative);
const projectedRegistry = json(projectedRegistryRelative);
const projectedView = json(projectedViewRelative);
assert(packageData.status === 'READY_FOR_PRODUCT_OWNER_APPLY_REVIEW_NOT_AUTHORIZED_NOT_EXECUTED', 'PACKAGE_STATUS_INVALID');
assert(decisions.decisionCount === 23 && decisions.totals.APPROVE === 23 && decisions.totals.REJECT === 0 && decisions.totals.DEFER === 0 && decisions.totals.PENDING === 0, 'DECISIONS_NOT_23_APPROVE');
assert(decisions.decisions.filter((item) => item.classification === 'AUTHORITATIVE_WITH_SCOPE').length === 21, 'AUTHORITY_CLASSIFICATION_COUNT_INVALID');
assert(decisions.decisions.filter((item) => item.classification === 'CONTEXTUAL').length === 2, 'CONTEXTUAL_CLASSIFICATION_COUNT_INVALID');
assert(changeset.operations.add === 21 && changeset.operations.modify === 0 && changeset.operations.delete === 0, 'CHANGESET_OPERATIONS_INVALID');
assert(changeset.registryAdditions.length === 21 && changeset.legislationSafetyMembershipAdditions.length === 22, 'CHANGESET_CARDINALITY_INVALID');
assert(changeset.routingTollOperations.add === 0 && changeset.routingTollOperations.modify === 0 && changeset.routingTollOperations.delete === 0, 'ROUTING_TOLL_OPERATION_FORBIDDEN');
assert(changeset.registryReuses.slice().sort().join('|') === 'CS-DE-STVO|CS-EU-REG-561-2006', 'REGISTRY_REUSES_INVALID');
assert(changeset.legislationSafetyMembershipReuses.join('|') === 'CS-DE-STVO', 'VIEW_REUSES_INVALID');
assert(packageData.remainingBlockers.length === 0, 'PRE_APPLY_BLOCKERS_EXIST');
assert(packageData.projectedHashes.registrySha256 === expected.projectedRegistrySha256, 'PACKAGE_REGISTRY_HASH_BINDING_INVALID');
assert(packageData.projectedHashes.legislationSafetyViewSha256 === expected.projectedLegislationViewSha256, 'PACKAGE_VIEW_HASH_BINDING_INVALID');
assert(packageData.projectedHashes.routingTollViewSha256 === expected.routingViewSha256, 'PACKAGE_ROUTING_HASH_BINDING_INVALID');
assert(projectedRegistry.sourceCount === 862 && projectedRegistry.sources.length === 862, 'PROJECTED_REGISTRY_COUNT_INVALID');
assert(projectedView.sourceCount === 66 && projectedView.memberships.length === 66 && projectedView.uniqueContentHashes === 57, 'PROJECTED_VIEW_COUNT_INVALID');
assert(!projectedRegistry.sources.some((item) => item.sourceId === 'CS-NL-RWV-HGV-ACCESS-20260701'), 'RWV_ALIAS_SOURCE_FORBIDDEN');
assert(projectedRegistry.sources.some((item) => item.sourceId === 'CS-NL-RVV-HGV-ACCESS-20260701'), 'CANONICAL_RVV_SOURCE_MISSING');

const currentRegistrySha = fileSha(registryRelative);
const currentViewSha = fileSha(legislationViewRelative);
if (currentRegistrySha === expected.projectedRegistrySha256 && currentViewSha === expected.projectedLegislationViewSha256) {
  const registry = json(registryRelative);
  const view = json(legislationViewRelative);
  assert(registry.sourceCount === 862 && registry.sources.length === 862, 'ALREADY_APPLIED_REGISTRY_COUNT_INVALID');
  assert(view.sourceCount === 66 && view.memberships.length === 66, 'ALREADY_APPLIED_VIEW_COUNT_INVALID');
  assert(fileSha(routingViewRelative) === expected.routingViewSha256 && json(routingViewRelative).sourceCount === 289, 'ALREADY_APPLIED_ROUTING_CHANGED');
  console.log(JSON.stringify({
    status: 'ALREADY_APPLIED_IDEMPOTENT_PASS',
    operationsReexecuted: { add:0, modify:0, delete:0 },
    registry: { count:862, sha256:currentRegistrySha },
    legislationSafetyView: { count:66, sha256:currentViewSha },
    routingTollView: { count:289, sha256:fileSha(routingViewRelative) },
  }, null, 2));
  process.exit(0);
}

assert(currentRegistrySha === expected.baselineRegistrySha256, 'REGISTRY_BASELINE_PRECONDITION_FAILED');
assert(currentViewSha === expected.baselineLegislationViewSha256, 'LEGISLATION_VIEW_BASELINE_PRECONDITION_FAILED');
const registry = json(registryRelative);
const view = json(legislationViewRelative);
assert(registry.sourceCount === 841 && registry.sources.length === 841, 'REGISTRY_BASELINE_COUNT_INVALID');
assert(view.sourceCount === 44 && view.memberships.length === 44, 'LEGISLATION_VIEW_BASELINE_COUNT_INVALID');
assert(projectedRegistry.sources.slice(0, 841).every((item, index) => deepEqual(item, registry.sources[index])), 'UNRELATED_REGISTRY_ENTRY_WOULD_CHANGE');
assert(projectedView.memberships.slice(0, 44).every((item, index) => deepEqual(item, view.memberships[index])), 'UNRELATED_VIEW_ENTRY_WOULD_CHANGE');

const registryIds = new Set(registry.sources.map((item) => item.sourceId));
const registryHashes = new Set(registry.sources.map((item) => item.sha256));
const registryUris = new Set(registry.sources.map((item) => item.canonicalUri).filter(Boolean));
const membershipIds = new Set(view.memberships.map((item) => item.membershipId));
const membershipSourceIds = new Set(view.memberships.map((item) => item.sourceId));
assert(changeset.registryAdditions.every((item) => !registryIds.has(item.sourceId)), 'LIVE_SOURCE_ID_COLLISION');
assert(changeset.registryAdditions.every((item) => !registryHashes.has(item.sha256)), 'LIVE_CONTENT_HASH_COLLISION');
assert(changeset.registryAdditions.every((item) => !registryUris.has(item.canonicalUri)), 'LIVE_CANONICAL_URI_COLLISION');
assert(changeset.legislationSafetyMembershipAdditions.every((item) => !membershipIds.has(item.membershipId) && !membershipSourceIds.has(item.sourceId)), 'LIVE_MEMBERSHIP_COLLISION');
for (const source of changeset.registryAdditions) {
  assert(existsSync(absolute(source.canonicalPath)), `ARTIFACT_MISSING:${source.sourceId}`);
  assert(read(source.canonicalPath).length === source.sizeBytes, `ARTIFACT_SIZE_MISMATCH:${source.sourceId}`);
  assert(fileSha(source.canonicalPath) === source.sha256, `ARTIFACT_HASH_MISMATCH:${source.sourceId}`);
}

const fire = changeset.registryAdditions.find((item) => item.sourceId === 'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026');
assert(fire?.freshness.effectiveUntil === '2026-08-31' && fire.freshness.currentStatus === 'EXPIRY_WARNING' && fire.freshness.reviewRequired === true && fire.freshness.usageFallback === 'UNKNOWN_HUMAN_VERIFICATION', 'FR_FIRE_TEMPORAL_CONTROL_INVALID');
const arv1 = changeset.registryAdditions.find((item) => item.sourceId === 'CS-CH-ARV1-20250501');
assert(arv1?.freshness.effectiveUntil === '2026-09-30' && arv1.freshness.currentStatus === 'NEW_VERSION_DETECTED' && arv1.freshness.reviewRequired === true && arv1.freshness.usageFallback === 'UNKNOWN_HUMAN_VERIFICATION', 'CH_ARV1_TEMPORAL_CONTROL_INVALID');
for (const sourceId of ['CS-AT-HGV-BAN-CALENDAR-2026','CS-AT-A10-SUMMER-HGV-BAN-2026','CS-AT-LUEGBRUECKE-HGV-BAN-2026','CS-FR-TRUCK-BAN-2026']) {
  assert(changeset.registryAdditions.find((item) => item.sourceId === sourceId)?.freshness.effectiveUntil === '2026-12-31', `END_DATE_20261231_MISSING:${sourceId}`);
}
assert(changeset.registryAdditions.every((item) => item.status === 'EVIDENCE'), 'UNAUTHORIZED_SOURCE_STATUS_PROMOTION');
assert(changeset.registryAdditions.filter((item) => item.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length === 19, 'NEW_SCOPED_AUTHORITY_COUNT_INVALID');
assert(changeset.registryAdditions.filter((item) => item.authority.authorityType === 'CONTEXTUAL').length === 2, 'NEW_CONTEXTUAL_COUNT_INVALID');

mkdirSync(absolute(applyRoot), { recursive:true });
const preRegistryRelative = `${applyRoot}/PRE_APPLY_REGISTRY.json`;
const preViewRelative = `${applyRoot}/PRE_APPLY_LEGISLATION_SAFETY_VIEW.json`;
const preRoutingRelative = `${applyRoot}/PRE_APPLY_ROUTING_TOLL_VIEW.json`;
for (const backup of [preRegistryRelative, preViewRelative, preRoutingRelative]) assert(!existsSync(absolute(backup)), `PERSISTENT_BACKUP_ALREADY_EXISTS:${backup}`);
writeAndSync(absolute(preRegistryRelative), read(registryRelative));
writeAndSync(absolute(preViewRelative), read(legislationViewRelative));
writeAndSync(absolute(preRoutingRelative), read(routingViewRelative));
assert(fileSha(preRegistryRelative) === expected.baselineRegistrySha256, 'PERSISTENT_REGISTRY_BACKUP_HASH_MISMATCH');
assert(fileSha(preViewRelative) === expected.baselineLegislationViewSha256, 'PERSISTENT_VIEW_BACKUP_HASH_MISMATCH');
assert(fileSha(preRoutingRelative) === expected.routingViewSha256, 'PERSISTENT_ROUTING_BACKUP_HASH_MISMATCH');

const registryPath = absolute(registryRelative);
const viewPath = absolute(legislationViewRelative);
const registryStage = `${registryPath}.legal-005-stage`;
const viewStage = `${viewPath}.legal-005-stage`;
const registryTransactionBackup = `${registryPath}.legal-005-backup`;
const viewTransactionBackup = `${viewPath}.legal-005-backup`;
const lockPath = absolute(`${applyRoot}/.atomic-apply.lock`);
for (const transactionPath of [registryStage, viewStage, registryTransactionBackup, viewTransactionBackup, lockPath]) assert(!existsSync(transactionPath), `TRANSACTION_PATH_ALREADY_EXISTS:${transactionPath}`);

let lockHandle;
try {
  lockHandle = openSync(lockPath, 'wx');
  writeAndSync(registryStage, read(projectedRegistryRelative));
  writeAndSync(viewStage, read(projectedViewRelative));
  assert(sha(readFileSync(registryStage)) === expected.projectedRegistrySha256, 'STAGED_REGISTRY_HASH_MISMATCH');
  assert(sha(readFileSync(viewStage)) === expected.projectedLegislationViewSha256, 'STAGED_VIEW_HASH_MISMATCH');
  try {
    renameSync(registryPath, registryTransactionBackup);
    renameSync(viewPath, viewTransactionBackup);
    renameSync(registryStage, registryPath);
    renameSync(viewStage, viewPath);
    assert(fileSha(registryRelative) === expected.projectedRegistrySha256, 'COMMITTED_REGISTRY_HASH_MISMATCH');
    assert(fileSha(legislationViewRelative) === expected.projectedLegislationViewSha256, 'COMMITTED_VIEW_HASH_MISMATCH');
    assert(fileSha(routingViewRelative) === expected.routingViewSha256, 'ROUTING_TOLL_CHANGED_DURING_COMMIT');
    assert(json(registryRelative).sourceCount === 862 && json(legislationViewRelative).sourceCount === 66 && json(routingViewRelative).sourceCount === 289, 'COMMITTED_COUNT_MISMATCH');
    unlinkSync(registryTransactionBackup);
    unlinkSync(viewTransactionBackup);
  } catch (error) {
    rollback(registryPath, registryTransactionBackup, registryStage);
    rollback(viewPath, viewTransactionBackup, viewStage);
    throw error;
  }
} finally {
  if (lockHandle !== undefined) closeSync(lockHandle);
  if (existsSync(lockPath)) unlinkSync(lockPath);
  if (existsSync(registryStage)) unlinkSync(registryStage);
  if (existsSync(viewStage)) unlinkSync(viewStage);
}

const execution = {
  schemaVersion: 'agm-legal-005-final-atomic-apply-execution.v1',
  executedAt: '2026-08-30T20:30:00.000Z',
  result: 'PASS',
  authorization: 'PRODUCT_OWNER_MANDATE_LEGAL_005_FINAL_ATOMIC_APPLY',
  operations: { registryAdd:21, registryModify:0, registryDelete:0, legislationSafetyAdd:22, legislationSafetyModify:0, legislationSafetyDelete:0, routingTollAdd:0, routingTollModify:0, routingTollDelete:0 },
  registry: { beforeCount:841, afterCount:862, beforeSha256:expected.baselineRegistrySha256, afterSha256:fileSha(registryRelative) },
  legislationSafetyView: { beforeCount:44, afterCount:66, beforeSha256:expected.baselineLegislationViewSha256, afterSha256:fileSha(legislationViewRelative) },
  routingTollView: { beforeCount:289, afterCount:289, beforeSha256:expected.routingViewSha256, afterSha256:fileSha(routingViewRelative), unchanged:true },
  atomicity: { partialApply:false, rollbackAvailable:true, rollbackExecuted:false, persistentPreimages:[preRegistryRelative,preViewRelative,preRoutingRelative] },
  authorityPromotionBeyondDecisions:false,
  runtimeProductionDeployment:'NOT_AUTHORIZED_NOT_EXECUTED',
  commitPush:'NOT_AUTHORIZED_NOT_EXECUTED',
};
writeFileSync(absolute(`${applyRoot}/ATOMIC_APPLY_EXECUTION_RECORD.json`), `${JSON.stringify(execution, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  status:'ATOMIC_APPLY_PASS',
  operations:execution.operations,
  registry:execution.registry,
  legislationSafetyView:execution.legislationSafetyView,
  routingTollView:execution.routingTollView,
  rollbackRequired:false,
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
