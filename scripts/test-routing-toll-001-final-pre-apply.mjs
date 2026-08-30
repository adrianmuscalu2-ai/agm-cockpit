import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_PRE_APPLY';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const expectedRegistrySha = 'af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31';
const expectedViewSha = 'eb8e0b1b02b34033ad689b0aa35da616b924cc333d2d22187e466505ffcc801f';
const readText = (relative) => readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, '');
const readJson = (relative) => JSON.parse(readText(relative));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => sha(readFileSync(path.join(root, relative)));

const generatedFiles = [
  'FINAL_ATOMIC_CHANGESET.json',
  'EXACT_BEFORE_AFTER_DIFF.json',
  'SOURCE_ID_TRANSITIONS.json',
  'CANONICAL_ARTIFACT_HASH_MANIFEST.json',
  'PROVENANCE_VERIFICATION.json',
  'DETERMINISTIC_MUTATION_PLAN.md',
  'ROLLBACK_PLAN.md',
  'POST_APPLY_VALIDATION_PLAN.md',
  'FINAL_PRE_APPLY_REPORT.md',
].map((name) => `${outputRoot}/${name}`);
const before = Object.fromEntries(generatedFiles.map((file) => [file, hashFile(file)]));
const generation = spawnSync(process.execPath, [path.join(root, 'scripts/build-routing-toll-001-final-pre-apply.mjs')], { cwd: root, encoding: 'utf8' });
const after = Object.fromEntries(generatedFiles.map((file) => [file, hashFile(file)]));

const registry = readJson(registryPath);
const view = readJson(viewPath);
const owner = readJson(`${outputRoot}/PRODUCT_OWNER_DECISION_16_OF_16.json`);
const changeset = readJson(`${outputRoot}/FINAL_ATOMIC_CHANGESET.json`);
const diff = readJson(`${outputRoot}/EXACT_BEFORE_AFTER_DIFF.json`);
const transitions = readJson(`${outputRoot}/SOURCE_ID_TRANSITIONS.json`);
const artifacts = readJson(`${outputRoot}/CANONICAL_ARTIFACT_HASH_MANIFEST.json`);
const provenance = readJson(`${outputRoot}/PROVENANCE_VERIFICATION.json`);
const pendingReview = readJson('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_HUMAN_AUTHORITY_REVIEW/FINAL_16_SOURCE_AUTHORITY_DECISION_TABLE.json');
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const basic = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/BASIC_LIBRARIAN_INTEGRITY.json');
const registryIds = new Set(registry.sources.map((source) => source.sourceId));
const registryHashes = new Set(registry.sources.map((source) => source.sha256));
const viewMembershipIds = new Set(view.memberships.map((membership) => membership.membershipId));
const sourceRequiredKeys = ['sourceId', 'canonicalPath', 'canonicalUri', 'mediaType', 'sizeBytes', 'sha256', 'sourceDate', 'effectiveDate', 'version', 'status', 'owner', 'authority', 'provenance', 'retention', 'evidenceRefs', 'supersedes', 'supersededBy'];

const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass, actual, expected });
check('GENERATOR_EXIT', generation.status === 0, generation.status, 0);
check('GENERATOR_IDEMPOTENCE', JSON.stringify(before) === JSON.stringify(after), after, before);
check('OWNER_DECISIONS_16_OF_16', owner.counts.approved === 16 && owner.counts.pending === 0 && owner.decisions.length === 16, owner.counts, { approved: 16, pending: 0 });
check('OWNER_CLASSIFICATIONS_12_4', owner.counts.authoritativeWithScope === 12 && owner.counts.contextual === 4, `${owner.counts.authoritativeWithScope}/${owner.counts.contextual}`, '12/4');
check('OWNER_DID_NOT_AUTHORIZE_APPLY', owner.atomicApplyAuthorized === false && owner.registryMutationAuthorized === false, `${owner.atomicApplyAuthorized}/${owner.registryMutationAuthorized}`, 'false/false');
check('PENDING_REVIEW_EVIDENCE_PRESERVED', pendingReview.recordedHumanDecisionCounts.pending === 16, pendingReview.recordedHumanDecisionCounts.pending, 16);
check('REGISTRY_BASELINE', registry.sourceCount === 815 && hashFile(registryPath) === expectedRegistrySha, `${registry.sourceCount}/${hashFile(registryPath)}`, `815/${expectedRegistrySha}`);
check('VIEW_BASELINE', view.sourceCount === 263 && hashFile(viewPath) === expectedViewSha, `${view.sourceCount}/${hashFile(viewPath)}`, `263/${expectedViewSha}`);
check('CHANGESET_NOT_EXECUTED', changeset.status === 'READY_NOT_AUTHORIZED_NOT_EXECUTED' && changeset.executed === false, `${changeset.status}/${changeset.executed}`, 'READY_NOT_AUTHORIZED_NOT_EXECUTED/false');
check('OPERATIONS_16_0_0', changeset.operations.add === 16 && changeset.operations.modifyExistingSources === 0 && changeset.operations.delete === 0, changeset.operations, { add: 16, modifyExistingSources: 0, delete: 0 });
check('ADDITION_COUNT_AND_UNIQUENESS', changeset.additions.length === 16 && new Set(changeset.additions.map((source) => source.sourceId)).size === 16, `${changeset.additions.length}/${new Set(changeset.additions.map((source) => source.sourceId)).size}`, '16/16');
check('SOURCE_SCHEMA_SHAPE', changeset.additions.every((source) => sourceRequiredKeys.every((key) => Object.hasOwn(source, key)) && Object.keys(source).every((key) => sourceRequiredKeys.includes(key))), changeset.additions.filter((source) => !sourceRequiredKeys.every((key) => Object.hasOwn(source, key)) || !Object.keys(source).every((key) => sourceRequiredKeys.includes(key))).map((source) => source.sourceId), []);
check('NEW_SOURCE_IDS_ABSENT', changeset.additions.every((source) => !registryIds.has(source.sourceId)), changeset.additions.filter((source) => registryIds.has(source.sourceId)).map((source) => source.sourceId), []);
check('CLASSIFICATIONS_12_4', changeset.additions.filter((source) => source.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length === 12 && changeset.additions.filter((source) => source.authority.authorityType === 'CONTEXTUAL').length === 4, `${changeset.additions.filter((source) => source.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length}/${changeset.additions.filter((source) => source.authority.authorityType === 'CONTEXTUAL').length}`, '12/4');
check('HUMAN_AUTHORITY_RECORDED', changeset.additions.every((source) => source.authority.humanReviewRequired === false && source.authority.reviewStatus === 'PRODUCT_OWNER_APPROVED_2026_08_30_WITH_EXACT_SCOPE'), changeset.additions.filter((source) => source.authority.humanReviewRequired || source.authority.reviewStatus !== 'PRODUCT_OWNER_APPROVED_2026_08_30_WITH_EXACT_SCOPE').map((source) => source.sourceId), []);
check('ARTIFACTS_16_MATCH', artifacts.artifactCount === 16 && artifacts.matchCount === 16 && artifacts.mismatchCount === 0 && artifacts.artifacts.every((artifact) => hashFile(artifact.canonicalArtifact) === artifact.expectedSha256), `${artifacts.matchCount}/${artifacts.mismatchCount}`, '16/0');
check('NO_CANONICAL_HASH_DUPLICATION', artifacts.duplicateExistingCanonicalHashCount === 0 && changeset.additions.every((source) => !registryHashes.has(source.sha256)), artifacts.duplicateExistingCanonicalHashCount, 0);
check('PROVENANCE_16_VERIFIED', provenance.sourceCount === 16 && provenance.verifiedCount === 16, `${provenance.verifiedCount}/${provenance.sourceCount}`, '16/16');
check('TRANSITIONS_16', transitions.transitionCount === 16 && transitions.preservedCount + transitions.canonicalizedProposalIdCount === 16, `${transitions.transitionCount}/${transitions.preservedCount}/${transitions.canonicalizedProposalIdCount}`, '16 total');
check('MEMBERSHIPS_16_UNIQUE_AND_ABSENT', changeset.routingTollMembershipAdditions.length === 16 && new Set(changeset.routingTollMembershipAdditions.map((membership) => membership.membershipId)).size === 16 && changeset.routingTollMembershipAdditions.every((membership) => !viewMembershipIds.has(membership.membershipId)), changeset.routingTollMembershipAdditions.length, 16);
check('PROJECTED_COUNTS', changeset.projected.registryCount === 831 && changeset.projected.routingTollViewCount === 279, `${changeset.projected.registryCount}/${changeset.projected.routingTollViewCount}`, '831/279');
check('DIFF_COUNTS', diff.sourceRecordOperations.add === 16 && diff.sourceRecordOperations.modify === 0 && diff.sourceRecordOperations.delete === 0 && diff.existingSourceIdsPreserved === 815 && diff.existingMembershipsPreserved === 263, diff.sourceRecordOperations, { add: 16, modify: 0, delete: 0 });
check('GAP_OPEN_IN_PACKAGE', changeset.gapStateAfterApply === 'ROUTING-TOLL-001_OPEN_PARTIALLY_READY' && diff.gapClosed === false, `${changeset.gapStateAfterApply}/${diff.gapClosed}`, 'OPEN_PARTIALLY_READY/false');
for (const gapId of ['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']) {
  const gap = unresolved.gaps.find((item) => item.gapId === gapId);
  check(`${gapId}_OPEN`, gap?.state === 'OPEN', gap?.state ?? 'MISSING', 'OPEN');
}
for (const item of basic.checks) {
  check(`BASIC_HASH_${item.path}`, hashFile(item.path) === item.expectedSha256, hashFile(item.path), item.expectedSha256);
}

const report = {
  schemaVersion: 'agm-routing-toll-001-final-pre-apply-validation.v1',
  generatedAt: new Date().toISOString(),
  verdict: checks.every((item) => item.pass) ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  failedCount: checks.filter((item) => !item.pass).length,
  checks,
  protectedState: { registryMutation: 'NOT_EXECUTED', routingTollViewMutation: 'NOT_EXECUTED', basicLibrarian: 'UNCHANGED', legal003: 'OPEN_UNCHANGED', legal005: 'OPEN_UNCHANGED', runtimeProductionTurnApplicationApi: 'NO_CHANGE' },
  commitPush: 'NOT_EXECUTED',
};
writeFileSync(path.join(root, outputRoot, 'VALIDATION_AND_IDEMPOTENCE_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ verdict: report.verdict, checks: report.checkCount, failed: report.failedCount, projectedRegistry: changeset.projected.registrySha256, projectedView: changeset.projected.routingTollViewSha256 }, null, 2));
if (report.verdict !== 'PASS') process.exitCode = 1;
