import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_OWNER_PRE_APPLY_10_OF_10';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const decisionsPath = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION/PRODUCT_OWNER_AUTHORITY_DECISIONS.json';
const readBytes = (relative) => readFileSync(path.join(root, relative));
const readJson = (relative) => JSON.parse(readBytes(relative).toString('utf8').replace(/^\uFEFF/, ''));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => sha(readBytes(relative));

const registry = readJson(registryPath);
const view = readJson(viewPath);
const decisions = readJson(decisionsPath);
const packageData = readJson(`${outputRoot}/FINAL_PRE_APPLY_PACKAGE.json`);
const changeset = readJson(`${outputRoot}/ELIGIBLE_9_SOURCE_INFORMATIONAL_CHANGESET.json`);
const impact = readJson(`${outputRoot}/EXACT_ATOMIC_APPLY_IMPACT.json`);
const blockers = readJson(`${outputRoot}/BLOCKERS_AND_CONDITIONS.json`);
const registryIds = new Set(registry.sources.map((source) => source.sourceId));
const registryHashes = new Set(registry.sources.map((source) => source.sha256));
const viewMembershipIds = new Set(view.memberships.map((membership) => membership.membershipId));
const requiredKeys = ['sourceId', 'canonicalPath', 'canonicalUri', 'mediaType', 'sizeBytes', 'sha256', 'sourceDate', 'effectiveDate', 'version', 'status', 'owner', 'authority', 'provenance', 'retention', 'evidenceRefs', 'supersedes', 'supersededBy'];

const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass, actual, expected });
check('DECISIONS_10_OF_10', decisions.summary.total === 10 && decisions.summary.decided === 10 && decisions.summary.approved === 10 && decisions.summary.pending === 0 && decisions.decisions.length === 10, decisions.summary, { total: 10, decided: 10, approved: 10, pending: 0 });
check('CLASSIFICATIONS_9_1', decisions.decisions.filter((item) => item.classification === 'AUTHORITATIVE_WITH_SCOPE').length === 9 && decisions.decisions.filter((item) => item.classification === 'CONTEXTUAL').length === 1, packageData.authorityReview, { authoritativeWithScope: 9, contextual: 1 });
check('NO_APPLY_AUTHORIZATION', decisions.decisions.every((item) => item.atomicApplyAuthorized === false) && packageData.guardrails.atomicApplyAuthorized === false, packageData.guardrails.atomicApplyAuthorized, false);
check('BASELINE_REGISTRY', registry.sourceCount === 831 && registry.sources.length === 831 && hashFile(registryPath) === impact.baseline.registry.sha256, `${registry.sourceCount}/${hashFile(registryPath)}`, `831/${impact.baseline.registry.sha256}`);
check('BASELINE_VIEW', view.sourceCount === 279 && view.memberships.length === 279 && hashFile(viewPath) === impact.baseline.routingTollView.sha256, `${view.sourceCount}/${hashFile(viewPath)}`, `279/${impact.baseline.routingTollView.sha256}`);
check('PACKAGE_DECISION_HASH', packageData.decisionRegisterSha256 === hashFile(decisionsPath), packageData.decisionRegisterSha256, hashFile(decisionsPath));
check('ELIGIBILITY_9_1', packageData.approvalVsApplyEligibility.eligibleForInformationalPreApplyStaging === 9 && packageData.approvalVsApplyEligibility.blockedFromApply === 1, packageData.approvalVsApplyEligibility, { eligibleForInformationalPreApplyStaging: 9, blockedFromApply: 1 });
check('OPEN_BLOCKER_EXACT', blockers.openBlockerCount === 1 && blockers.blockers[0].candidateId === 'RT001-RES-CH-VIGNETTE-2026' && blockers.blockers[0].currentApplyEligibility === 'BLOCKED_BY_EVIDENCE_RECAPTURE', blockers.blockers, 'Swiss vignette evidence recapture blocker');
const invalidVignette = readBytes('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CONTINUATION_READ_ONLY/REMOTE_ARTIFACTS/RT001-RES-CH-VIGNETTE-2026.official.html').toString('utf8');
check('BLOCKED_ARTIFACT_IS_404', /Error Page \(404\)/i.test(invalidVignette), /Error Page \(404\)/i.test(invalidVignette), true);
check('OPERATIONS_9_0_0', changeset.operations.add === 9 && changeset.operations.modify === 0 && changeset.operations.delete === 0, changeset.operations, { add: 9, modify: 0, delete: 0 });
check('ADDITIONS_9_UNIQUE', changeset.additions.length === 9 && new Set(changeset.additions.map((source) => source.sourceId)).size === 9, changeset.additions.length, 9);
check('SOURCE_IDS_ABSENT', changeset.additions.every((source) => !registryIds.has(source.sourceId)), changeset.additions.filter((source) => registryIds.has(source.sourceId)).map((source) => source.sourceId), []);
check('SOURCE_SCHEMA_SHAPE', changeset.additions.every((source) => requiredKeys.every((key) => Object.hasOwn(source, key)) && Object.keys(source).every((key) => requiredKeys.includes(key))), changeset.additions.filter((source) => !requiredKeys.every((key) => Object.hasOwn(source, key))).map((source) => source.sourceId), []);
check('ARTIFACTS_9_HASH_AND_SIZE', changeset.additions.every((source) => hashFile(source.canonicalPath) === source.sha256 && readBytes(source.canonicalPath).length === source.sizeBytes), changeset.additions.filter((source) => hashFile(source.canonicalPath) !== source.sha256 || readBytes(source.canonicalPath).length !== source.sizeBytes).map((source) => source.sourceId), []);
check('NO_ELIGIBLE_HASH_DUPLICATES', changeset.additions.every((source) => !registryHashes.has(source.sha256)) && new Set(changeset.additions.map((source) => source.sha256)).size === 9, changeset.additions.filter((source) => registryHashes.has(source.sha256)).map((source) => source.sourceId), []);
check('CLASSIFICATIONS_IN_CHANGESET_8_1', changeset.classifications.authoritativeWithScope === 8 && changeset.classifications.contextual === 1, changeset.classifications, { authoritativeWithScope: 8, contextual: 1 });
check('MEMBERSHIPS_9_UNIQUE_ABSENT', changeset.routingTollMembershipAdditions.length === 9 && new Set(changeset.routingTollMembershipAdditions.map((item) => item.membershipId)).size === 9 && changeset.routingTollMembershipAdditions.every((item) => !viewMembershipIds.has(item.membershipId)), changeset.routingTollMembershipAdditions.length, 9);
check('PROJECTED_COUNTS_840_288', changeset.projected.registryCount === 840 && changeset.projected.routingTollViewCount === 288, `${changeset.projected.registryCount}/${changeset.projected.routingTollViewCount}`, '840/288');
check('FULL_IMPACT_841_289', impact.fullTenSourceImpactAfterBlockerResolution.projectedCounts.registry === 841 && impact.fullTenSourceImpactAfterBlockerResolution.projectedCounts.routingTollView === 289, impact.fullTenSourceImpactAfterBlockerResolution.projectedCounts, { registry: 841, routingTollView: 289 });
check('FULL_HASHES_WITHHELD', impact.fullTenSourceImpactAfterBlockerResolution.projectedHashes === 'UNAVAILABLE_UNTIL_RECAPTURED_CANONICAL_BYTES_AND_SHA256_EXIST', impact.fullTenSourceImpactAfterBlockerResolution.projectedHashes, 'UNAVAILABLE_UNTIL_RECAPTURED_CANONICAL_BYTES_AND_SHA256_EXIST');
check('NL_WINDOW_EXACT', decisions.decisions[9].applicabilityWindow.from === '2026-07-01' && decisions.decisions[9].applicabilityWindow.through === '2026-08-31' && decisions.decisions[9].generic2026UseAuthorized === false, decisions.decisions[9].applicabilityWindow, { from: '2026-07-01', through: '2026-08-31' });
check('PROTECTED_MUTATIONS_NONE', packageData.guardrails.registryMutation === 'NONE' && packageData.guardrails.routingTollViewMutation === 'NONE' && packageData.guardrails.authorityPromotion === 'NONE' && packageData.guardrails.runtimeProduction === 'NO_CHANGE' && packageData.guardrails.commitPush === 'NOT_EXECUTED', packageData.guardrails, 'all protected states unchanged');
check('CHANGESET_NOT_EXECUTED', changeset.status === 'INFORMATIONAL_STAGED_NOT_AUTHORIZED_NOT_EXECUTED' && changeset.executed === false, `${changeset.status}/${changeset.executed}`, 'INFORMATIONAL_STAGED_NOT_AUTHORIZED_NOT_EXECUTED/false');

const result = {
  validator: 'ROUTING-TOLL-001_FINAL_OWNER_PRE_APPLY_READ_ONLY',
  generatedAt: new Date().toISOString(),
  verdict: checks.every((item) => item.pass) ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passedCount: checks.filter((item) => item.pass).length,
  failedCount: checks.filter((item) => !item.pass).length,
  checks,
  protectedFiles: {
    registry: { count: registry.sourceCount, sha256: hashFile(registryPath) },
    routingTollView: { count: view.sourceCount, sha256: hashFile(viewPath) },
  },
};
console.log(JSON.stringify(result, null, 2));
if (result.verdict !== 'PASS') process.exitCode = 1;
