import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const OUT = 'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY';
const rel = (value) => path.join(root, value);
const bytes = (value) => readFileSync(rel(value));
const readJson = (value) => JSON.parse(bytes(value).toString('utf8').replace(/^\uFEFF/, ''));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (value) => sha(bytes(value));
const checks = [];
const check = (id, condition, actual, expected) => checks.push({ id, status: condition ? 'PASS' : 'FAIL', actual, expected });

const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const legislationViewPath = 'AGM_LIBRARY/VIEWS/legislation-safety.view.json';
const routingViewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const decisionsPath = 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW/PRODUCT_OWNER_DECISIONS.json';
const candidatesPath = 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW/CANDIDATE_AUTHORITY_PACKAGE.json';
const evidencePath = 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW/EVIDENCE_MANIFEST.json';
const freshnessQueuePath = 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/INITIAL_PRODUCT_OWNER_REVIEW_PACKAGE.json';

const baselineBefore = {
  registry: hashFile(registryPath),
  legislation: hashFile(legislationViewPath),
  routing: hashFile(routingViewPath),
};
const registry = readJson(registryPath);
const legislation = readJson(legislationViewPath);
const routing = readJson(routingViewPath);
const decisions = readJson(decisionsPath);
const candidates = readJson(candidatesPath);
const evidence = readJson(evidencePath);
const freshnessQueue = readJson(freshnessQueuePath);
const pkg = readJson(`${OUT}/FINAL_PRE_APPLY_PACKAGE.json`);
const changeset = readJson(`${OUT}/PROJECTED_CHANGESET.json`);
const temporal = readJson(`${OUT}/CONSOLIDATED_AUTHORITY_TEMPORAL_REVIEW.json`);
const projectedRegistry = readJson(`${OUT}/PROJECTED_REGISTRY.json`);
const projectedView = readJson(`${OUT}/PROJECTED_LEGISLATION_SAFETY_VIEW.json`);

check('DECISIONS_23', decisions.decisionCount === 23 && decisions.decisions.length === 23, decisions.decisionCount, 23);
check('APPROVE_23', decisions.totals.APPROVE === 23, decisions.totals, 'APPROVE 23');
check('REJECT_ZERO', decisions.totals.REJECT === 0, decisions.totals.REJECT, 0);
check('DEFER_ZERO', decisions.totals.DEFER === 0, decisions.totals.DEFER, 0);
check('PENDING_ZERO', decisions.totals.PENDING === 0, decisions.totals.PENDING, 0);
check('DECISIONS_ALL_APPROVED', decisions.decisions.every((item) => item.decision === 'APPROVE'), decisions.decisions.map((item) => item.decision), 'all APPROVE');
check('CLASSIFICATION_21_SCOPED', decisions.decisions.filter((item) => item.classification === 'AUTHORITATIVE_WITH_SCOPE').length === 21, decisions.decisions.filter((item) => item.classification === 'AUTHORITATIVE_WITH_SCOPE').length, 21);
check('CLASSIFICATION_2_CONTEXTUAL', decisions.decisions.filter((item) => item.classification === 'CONTEXTUAL').length === 2, decisions.decisions.filter((item) => item.classification === 'CONTEXTUAL').length, 2);
check('CANDIDATES_23', candidates.candidates.length === 23, candidates.candidates.length, 23);
check('DECISION_CANONICAL_IDS_MATCH', candidates.candidates.every((item) => decisions.decisions.some((decision) => decision.candidateId === item.candidateId && decision.sourceId === item.sourceId)), true, true);
check('NO_APPLY_AUTHORIZED_IN_DECISIONS', decisions.decisions.every((item) => item.applyAuthorized === false), decisions.decisions.map((item) => item.applyAuthorized), 'all false');
check('NO_AUTHORITY_PROMOTED_IN_DECISIONS', decisions.decisions.every((item) => item.authorityPromoted === false), decisions.decisions.map((item) => item.authorityPromoted), 'all false');

check('BASELINE_REGISTRY_841', registry.sourceCount === 841, registry.sourceCount, 841);
check('BASELINE_LEGISLATION_44', legislation.sourceCount === 44, legislation.sourceCount, 44);
check('BASELINE_ROUTING_289', routing.sourceCount === 289, routing.sourceCount, 289);
check('BASELINE_REGISTRY_HASH', baselineBefore.registry === '462db7f3a72204010972aa605901783997feff9ada7aac760ab03b358b2cd076', baselineBefore.registry, '462db7...d076');
check('BASELINE_LEGISLATION_HASH', baselineBefore.legislation === '2db4f2b915e256f013bc4ed59188d810230a33c335333ec8cf364c6f1284dac1', baselineBefore.legislation, '2db4f2...dac1');
check('BASELINE_ROUTING_HASH', baselineBefore.routing === '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0', baselineBefore.routing, '049deb...62b0');

check('EVIDENCE_FILES_EXIST', candidates.candidates.every((item) => existsSync(rel(item.documentEvidence.canonicalArtifact))), candidates.candidates.map((item) => item.documentEvidence.canonicalArtifact), 'all exist');
check('EVIDENCE_HASHES_MATCH', candidates.candidates.every((item) => hashFile(item.documentEvidence.canonicalArtifact) === item.documentEvidence.sha256), candidates.candidates.map((item) => item.sourceId), 'all match');
check('EVIDENCE_MANIFEST_HASHES_MATCH', evidence.artifacts.filter((item) => item.path).every((item) => hashFile(item.path) === item.sha256), evidence.artifacts.filter((item) => item.path).map((item) => item.evidenceId), 'all match');

const candidateIds = candidates.candidates.map((item) => item.candidateId);
const sourceIds = candidates.candidates.map((item) => item.sourceId);
const newCandidates = candidates.candidates.filter((item) => item.proposedAction === 'ADD_SOURCE_AND_MEMBERSHIP');
check('UNIQUE_CANDIDATE_IDS', new Set(candidateIds).size === 23, candidateIds, '23 unique');
check('UNIQUE_SOURCE_IDS', new Set(sourceIds).size === 23, sourceIds, '23 unique');
check('NEW_CANDIDATES_21', newCandidates.length === 21, newCandidates.length, 21);
check('NEW_SOURCE_ID_COLLISIONS_NONE', newCandidates.every((item) => !registry.sources.some((source) => source.sourceId === item.sourceId)), true, true);
check('NEW_HASH_COLLISIONS_NONE', newCandidates.every((item) => !registry.sources.some((source) => source.sha256 === item.documentEvidence.sha256)), true, true);
check('NEW_INTERNAL_HASH_DUPLICATES_NONE', new Set(newCandidates.map((item) => item.documentEvidence.sha256)).size === 21, newCandidates.map((item) => item.documentEvidence.sha256), '21 unique');
check('REGISTRY_REUSES_EXACT', pkg.reconciliation.registryReuses.slice().sort().join('|') === 'CS-DE-STVO|CS-EU-REG-561-2006', pkg.reconciliation.registryReuses, ['CS-DE-STVO','CS-EU-REG-561-2006']);
check('VIEW_REUSE_EXACT', pkg.reconciliation.viewReuses.join('|') === 'CS-DE-STVO', pkg.reconciliation.viewReuses, ['CS-DE-STVO']);

check('REGISTRY_IMPACT_21_0_0', JSON.stringify(pkg.exactImpact.registry) === JSON.stringify({ add:21, modify:0, delete:0, from:841, to:862 }), pkg.exactImpact.registry, '21/0/0 841->862');
check('LEGISLATION_IMPACT_22_0_0', JSON.stringify(pkg.exactImpact.legislationSafetyView) === JSON.stringify({ add:22, modify:0, delete:0, from:44, to:66 }), pkg.exactImpact.legislationSafetyView, '22/0/0 44->66');
check('ROUTING_IMPACT_ZERO', JSON.stringify(pkg.exactImpact.routingTollView) === JSON.stringify({ add:0, modify:0, delete:0, from:289, to:289 }), pkg.exactImpact.routingTollView, '0/0/0 289->289');
check('CHANGESET_OPERATIONS', JSON.stringify(changeset.operations) === JSON.stringify({ add:21, modify:0, delete:0 }), changeset.operations, '21/0/0');
check('PROJECTED_REGISTRY_862', projectedRegistry.sourceCount === 862 && projectedRegistry.sources.length === 862, {count:projectedRegistry.sourceCount,length:projectedRegistry.sources.length}, 862);
check('PROJECTED_VIEW_66', projectedView.sourceCount === 66 && projectedView.memberships.length === 66, {count:projectedView.sourceCount,length:projectedView.memberships.length}, 66);
check('PROJECTED_VIEW_UNIQUE_HASHES_57', projectedView.uniqueContentHashes === 57, projectedView.uniqueContentHashes, 57);
check('PROJECTED_REGISTRY_UNIQUE_IDS', new Set(projectedRegistry.sources.map((item) => item.sourceId)).size === 862, true, true);
check('PROJECTED_VIEW_UNIQUE_IDS', new Set(projectedView.memberships.map((item) => item.sourceId)).size === 66, true, true);
check('PROJECTED_VIEW_NO_ORPHANS', projectedView.memberships.every((item) => projectedRegistry.sources.some((source) => source.sourceId === item.sourceId)), true, true);
check('PROJECTED_SOURCE_STATUS_EVIDENCE', changeset.registryAdditions.every((item) => item.status === 'EVIDENCE'), changeset.registryAdditions.map((item) => item.status), 'all EVIDENCE');
check('PROJECTED_SOURCE_AUTHORITY_TYPES', changeset.registryAdditions.filter((item) => item.authority.authorityType === 'CONTEXTUAL').length === 2 && changeset.registryAdditions.filter((item) => item.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length === 19, true, '19 scoped additions + 2 contextual additions');

check('PROJECTED_REGISTRY_HASH_MATCH', hashFile(`${OUT}/PROJECTED_REGISTRY.json`) === pkg.projectedHashes.registrySha256, hashFile(`${OUT}/PROJECTED_REGISTRY.json`), pkg.projectedHashes.registrySha256);
check('PROJECTED_VIEW_HASH_MATCH', hashFile(`${OUT}/PROJECTED_LEGISLATION_SAFETY_VIEW.json`) === pkg.projectedHashes.legislationSafetyViewSha256, hashFile(`${OUT}/PROJECTED_LEGISLATION_SAFETY_VIEW.json`), pkg.projectedHashes.legislationSafetyViewSha256);
check('ROUTING_PROJECTED_HASH_UNCHANGED', pkg.projectedHashes.routingTollViewSha256 === baselineBefore.routing, pkg.projectedHashes.routingTollViewSha256, baselineBefore.routing);

check('EXPIRY_20260831_EXACT', temporal.expiryAt20260831.length === 1 && temporal.expiryAt20260831[0].sourceId === 'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026', temporal.expiryAt20260831, 'French fire only');
check('FIRE_WARNING_20260830', temporal.specialTransitions.some((item) => item.sourceId === 'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026' && item.at20260830 === 'EXPIRY_WARNING'), temporal.specialTransitions, 'EXPIRY_WARNING');
check('FIRE_EXPIRED_AT_AFTER_20260831', temporal.specialTransitions.some((item) => item.sourceId === 'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026' && item.atAndAfter20260831 === 'EXPIRED_REVIEW_REQUIRED' && item.postExpiryCurrent === 'FORBIDDEN'), temporal.specialTransitions, 'expired/current forbidden');
check('NEW_VERSION_ARV1_EXACT', temporal.newVersionDetected.length === 1 && temporal.newVersionDetected[0].sourceId === 'CS-CH-ARV1-20250501', temporal.newVersionDetected, 'ARV1 only');
check('ARV1_CURRENT_FORBIDDEN_20261001', temporal.specialTransitions.some((item) => item.sourceId === 'CS-CH-ARV1-20250501' && item.from20261001 === 'CURRENT_FORBIDDEN'), temporal.specialTransitions, 'forbidden');
check('NO_AUTO_SUPERSESSION', temporal.newVersionDetected.every((item) => item.automaticSupersession === false), temporal.newVersionDetected, 'all false');
check('FRESHNESS_QUEUE_ARV1', freshnessQueue.items.some((item) => item.sourceId === 'CS-CH-ARV1-20250501' && item.detectedChangeEffectiveFrom === '2026-10-01'), freshnessQueue.items.map((item) => item.sourceId), 'ARV1 queued');
check('UNKNOWN_INVARIANT', temporal.invariants.unknownIsNotSafePassZeroOrNoRestriction === true, temporal.invariants, true);
check('EXPIRED_NOT_ZERO', temporal.invariants.expiredIsNotZero === true, temporal.invariants, true);
check('CURRENT_AFTER_EXPIRY_FORBIDDEN', temporal.invariants.currentAfterEffectiveUntil === 'FORBIDDEN', temporal.invariants, 'FORBIDDEN');

check('RWV_ALIAS_RECONCILED', pkg.reconciliation.nlIdentifierReconciliation.resolution === 'OWNER_SUBMITTED_ALIAS_RECONCILED_TO_VALIDATED_CANONICAL_IDENTIFIERS_NO_ALIAS_SOURCE_ADDED', pkg.reconciliation.nlIdentifierReconciliation, 'canonical RVV');
check('CANONICAL_RVV_PRESENT', projectedRegistry.sources.some((item) => item.sourceId === 'CS-NL-RVV-HGV-ACCESS-20260701'), true, true);
check('RWV_ALIAS_ABSENT', !projectedRegistry.sources.some((item) => item.sourceId === 'CS-NL-RWV-HGV-ACCESS-20260701'), true, true);
check('AT_STALE_NO_OPERATION', pkg.reconciliation.candidateLevelStale.operation === 'DOCUMENT_ONLY_NO_DELETE_NO_MODIFY_NO_AUTOMATIC_SUPERSESSION' && !projectedRegistry.sources.some((item) => item.sourceId === 'CS-AT-STVO-42-20260213'), pkg.reconciliation.candidateLevelStale, 'document only');

check('NO_DUPLICATE_BLOCKERS', Object.values(pkg.duplicateCollisionAnalysis).every((items) => items.length === 0), pkg.duplicateCollisionAnalysis, 'all empty');
check('REMAINING_BLOCKERS_NONE', pkg.remainingBlockers.length === 0, pkg.remainingBlockers, []);
check('PACKAGE_READY', pkg.status === 'READY_FOR_PRODUCT_OWNER_APPLY_REVIEW_NOT_AUTHORIZED_NOT_EXECUTED', pkg.status, 'ready/not authorized');
check('CHANGESET_NOT_EXECUTED', changeset.atomicApplyAuthorized === false && changeset.executed === false, {authorized:changeset.atomicApplyAuthorized,executed:changeset.executed}, 'false/false');
check('GUARDRAILS', Object.values(pkg.guardrails).join('|') === 'NONE|NONE|NONE|NONE|NO_CHANGE|NOT_EXECUTED|NOT_EXECUTED', pkg.guardrails, 'no mutation/promotion/runtime/apply/commit');

const baselineAfter = {
  registry: hashFile(registryPath),
  legislation: hashFile(legislationViewPath),
  routing: hashFile(routingViewPath),
};
check('REGISTRY_UNCHANGED', baselineAfter.registry === baselineBefore.registry, baselineAfter.registry, baselineBefore.registry);
check('LEGISLATION_VIEW_UNCHANGED', baselineAfter.legislation === baselineBefore.legislation, baselineAfter.legislation, baselineBefore.legislation);
check('ROUTING_VIEW_UNCHANGED', baselineAfter.routing === baselineBefore.routing, baselineAfter.routing, baselineBefore.routing);

const failed = checks.filter((item) => item.status === 'FAIL');
console.log(JSON.stringify({ validator:'LEGAL005_FINAL_PRE_APPLY_READ_ONLY', result:failed.length ? 'FAIL' : 'PASS', passed:checks.length-failed.length, total:checks.length, checks }, null, 2));
if (failed.length) process.exit(1);
