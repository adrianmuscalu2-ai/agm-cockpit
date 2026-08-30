import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const closeoutRoot = 'AGM_LIBRARY/PHASE3/FINAL_CONSOLIDATED_CLOSEOUT';
const paths = {
  registry: 'AGM_LIBRARY/REGISTRY/canonical-sources.json',
  legalView: 'AGM_LIBRARY/VIEWS/legislation-safety.view.json',
  routingView: 'AGM_LIBRARY/VIEWS/routing-toll.view.json',
  package: `${closeoutRoot}/FINAL_CONSOLIDATED_CLOSEOUT_PACKAGE.json`,
  report: `${closeoutRoot}/FINAL_CONSOLIDATED_CLOSEOUT_REPORT.md`,
  debt: `${closeoutRoot}/TECHNICAL_DEBT_REGISTER.json`,
  queue: `${closeoutRoot}/TEMPORAL_FRESHNESS_SUCCESSOR_QUEUE.json`,
  routingClosure: 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_ATOMIC_CLOSURE/FINAL_CLOSURE_VALIDATION_REPORT.json',
  routingReceipt: 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_ATOMIC_CLOSURE/ATOMIC_APPLY_RECEIPT.json',
  routingChangeset: 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CONSOLIDATED_PRE_APPLY/FINAL_ATOMIC_CHANGESET.json',
  routingDecisions: 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION/PRODUCT_OWNER_AUTHORITY_DECISIONS.json',
  legal005Execution: 'AGM_LIBRARY/PHASE3/LEGAL_005_ATOMIC_APPLY/ATOMIC_APPLY_EXECUTION_RECORD.json',
  legal005Post: 'AGM_LIBRARY/PHASE3/LEGAL_005_ATOMIC_APPLY/POST_APPLY_VALIDATION_REPORT.json',
  legal005BeforeRegistry: 'AGM_LIBRARY/PHASE3/LEGAL_005_ATOMIC_APPLY/PRE_APPLY_REGISTRY.json',
  legal005BeforeView: 'AGM_LIBRARY/PHASE3/LEGAL_005_ATOMIC_APPLY/PRE_APPLY_LEGISLATION_SAFETY_VIEW.json',
  legal005BeforeRouting: 'AGM_LIBRARY/PHASE3/LEGAL_005_ATOMIC_APPLY/PRE_APPLY_ROUTING_TOLL_VIEW.json',
  legal005ProjectedRegistry: 'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY/PROJECTED_REGISTRY.json',
  legal005ProjectedView: 'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY/PROJECTED_LEGISLATION_SAFETY_VIEW.json',
  legal005Changeset: 'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY/PROJECTED_CHANGESET.json',
  legal005Decisions: 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW/PRODUCT_OWNER_DECISIONS.json',
  legal005Temporal: 'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY/CONSOLIDATED_AUTHORITY_TEMPORAL_REVIEW.json',
  legal003Validation: 'AGM_LIBRARY/PHASE3/LEGAL_003_FINAL_CLOSURE/FINAL_CLOSURE_VALIDATION_REPORT.json',
  legal003Decision: 'AGM_LIBRARY/PHASE3/LEGAL_003_FINAL_CLOSURE/PRODUCT_OWNER_CLOSURE_DECISION.json',
  legal003Reconciliation: 'AGM_LIBRARY/PHASE3/LEGAL_003_FINAL_CLOSURE/CANDIDATE_RECONCILIATION.json',
  legal003Evidence: 'AGM_LIBRARY/PHASE3/LEGAL_003_OWNER_REVIEW/EVIDENCE_MANIFEST.json',
  freshnessValidation: 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/VALIDATION_REPORT.json',
  freshnessPolicy: 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/STATE_MACHINE_AND_POLICY.md',
  freshnessContract: 'apps/api/src/source-freshness/source-freshness.contract.ts',
  freshnessEngine: 'apps/api/src/source-freshness/source-freshness.engine.ts',
  governance: 'AGM_LIBRARY/GOVERNANCE/ADVISORY_NON_CERTIFYING_AUTHORITY_POLICY.json',
  appModule: 'apps/api/src/app.module.ts',
  legacyUiTest: 'apps/web/scripts/test-premium-foundation.ts',
};

const expected = {
  registryCount: 862,
  registrySha256: '7d4901c4479129669e8036197cbdb116674f219ea21db34db7e1d20eefc48245',
  legalViewCount: 66,
  legalViewUniqueHashes: 57,
  legalViewSha256: 'c6d45d7c4fcc86574790add0491e37727691909f287d461e356be05f69a1b0ab',
  routingViewCount: 289,
  routingViewUniqueHashes: 274,
  routingViewSha256: '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0',
};

const absolute = (relative) => path.join(root, relative);
const bytes = (relative) => readFileSync(absolute(relative));
const text = (relative) => bytes(relative).toString('utf8').replace(/^\uFEFF/, '');
const json = (relative) => JSON.parse(text(relative));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fileSha = (relative) => sha(bytes(relative));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const checks = [];
const check = (name, condition, actual, expectedValue) => checks.push({
  name,
  status: condition ? 'PASS' : 'FAIL',
  ...(condition ? {} : { actual, expected: expectedValue }),
});

for (const [name, relative] of Object.entries(paths)) {
  check(`FILE_${name.toUpperCase()}`, existsSync(absolute(relative)), relative, 'exists');
}

const registry = json(paths.registry);
const legalView = json(paths.legalView);
const routingView = json(paths.routingView);
const closeout = json(paths.package);
const debt = json(paths.debt);
const queue = json(paths.queue);
const routingClosure = json(paths.routingClosure);
const routingReceipt = json(paths.routingReceipt);
const routingChangeset = json(paths.routingChangeset);
const routingDecisions = json(paths.routingDecisions);
const legal005Execution = json(paths.legal005Execution);
const legal005Post = json(paths.legal005Post);
const beforeRegistry = json(paths.legal005BeforeRegistry);
const beforeLegalView = json(paths.legal005BeforeView);
const beforeRouting = json(paths.legal005BeforeRouting);
const projectedRegistry = json(paths.legal005ProjectedRegistry);
const projectedLegalView = json(paths.legal005ProjectedView);
const legal005Changeset = json(paths.legal005Changeset);
const legal005Decisions = json(paths.legal005Decisions);
const legal005Temporal = json(paths.legal005Temporal);
const legal003Validation = json(paths.legal003Validation);
const legal003Decision = json(paths.legal003Decision);
const legal003Reconciliation = json(paths.legal003Reconciliation);
const legal003Evidence = json(paths.legal003Evidence);
const freshnessValidation = json(paths.freshnessValidation);
const governance = json(paths.governance);

check('CLOSEOUT_STATUS_EXACT', closeout.status === 'PHASE_3_PASS_CLOSED', closeout.status, 'PHASE_3_PASS_CLOSED');
check('REPORT_VERDICT_EXACT', text(paths.report).includes('PHASE 3 = PASS / CLOSED'), 'present', 'PHASE 3 = PASS / CLOSED');
check('REGISTRY_COUNT_EXACT', registry.sourceCount === expected.registryCount && registry.sources.length === expected.registryCount, { declared: registry.sourceCount, actual: registry.sources.length }, expected.registryCount);
check('REGISTRY_HASH_EXACT', fileSha(paths.registry) === expected.registrySha256, fileSha(paths.registry), expected.registrySha256);
check('LEGAL_VIEW_COUNT_EXACT', legalView.sourceCount === expected.legalViewCount && legalView.memberships.length === expected.legalViewCount, { declared: legalView.sourceCount, actual: legalView.memberships.length }, expected.legalViewCount);
check('LEGAL_VIEW_HASH_EXACT', fileSha(paths.legalView) === expected.legalViewSha256, fileSha(paths.legalView), expected.legalViewSha256);
check('ROUTING_VIEW_COUNT_EXACT', routingView.sourceCount === expected.routingViewCount && routingView.memberships.length === expected.routingViewCount, { declared: routingView.sourceCount, actual: routingView.memberships.length }, expected.routingViewCount);
check('ROUTING_VIEW_HASH_EXACT', fileSha(paths.routingView) === expected.routingViewSha256, fileSha(paths.routingView), expected.routingViewSha256);
check('PACKAGE_BASELINES_BOUND', closeout.finalBaseline.centralRegistry.count === expected.registryCount && closeout.finalBaseline.centralRegistry.sha256 === expected.registrySha256 && closeout.finalBaseline.legislationSafetyView.count === expected.legalViewCount && closeout.finalBaseline.legislationSafetyView.sha256 === expected.legalViewSha256 && closeout.finalBaseline.routingTollView.count === expected.routingViewCount && closeout.finalBaseline.routingTollView.sha256 === expected.routingViewSha256, closeout.finalBaseline, expected);
check('PROJECTED_REGISTRY_BYTE_MATCH', bytes(paths.registry).equals(bytes(paths.legal005ProjectedRegistry)) && equal(registry, projectedRegistry), fileSha(paths.registry), fileSha(paths.legal005ProjectedRegistry));
check('PROJECTED_LEGAL_VIEW_BYTE_MATCH', bytes(paths.legalView).equals(bytes(paths.legal005ProjectedView)) && equal(legalView, projectedLegalView), fileSha(paths.legalView), fileSha(paths.legal005ProjectedView));
check('ROUTING_PRESERVED_THROUGH_LEGAL005', bytes(paths.routingView).equals(bytes(paths.legal005BeforeRouting)) && equal(routingView, beforeRouting), fileSha(paths.routingView), fileSha(paths.legal005BeforeRouting));

check('SOURCE_IDS_862_UNIQUE', new Set(registry.sources.map((item) => item.sourceId)).size === expected.registryCount, new Set(registry.sources.map((item) => item.sourceId)).size, expected.registryCount);
check('LEGAL_MEMBERSHIP_IDS_UNIQUE', new Set(legalView.memberships.map((item) => item.membershipId)).size === expected.legalViewCount, new Set(legalView.memberships.map((item) => item.membershipId)).size, expected.legalViewCount);
check('LEGAL_SOURCE_IDS_UNIQUE', new Set(legalView.memberships.map((item) => item.sourceId)).size === expected.legalViewCount, new Set(legalView.memberships.map((item) => item.sourceId)).size, expected.legalViewCount);
check('ROUTING_MEMBERSHIP_IDS_UNIQUE', new Set(routingView.memberships.map((item) => item.membershipId)).size === expected.routingViewCount, new Set(routingView.memberships.map((item) => item.membershipId)).size, expected.routingViewCount);
check('ROUTING_SOURCE_IDS_UNIQUE', new Set(routingView.memberships.map((item) => item.sourceId)).size === expected.routingViewCount, new Set(routingView.memberships.map((item) => item.sourceId)).size, expected.routingViewCount);
const registryIds = new Set(registry.sources.map((item) => item.sourceId));
check('LEGAL_VIEW_ZERO_ORPHANS', legalView.memberships.every((item) => registryIds.has(item.sourceId)), legalView.memberships.filter((item) => !registryIds.has(item.sourceId)).map((item) => item.sourceId), []);
check('ROUTING_VIEW_ZERO_ORPHANS', routingView.memberships.every((item) => registryIds.has(item.sourceId)), routingView.memberships.filter((item) => !registryIds.has(item.sourceId)).map((item) => item.sourceId), []);
const sourceHashById = new Map(registry.sources.map((item) => [item.sourceId, item.sha256]));
const legalUniqueHashes = new Set(legalView.memberships.map((item) => sourceHashById.get(item.sourceId)).filter(Boolean));
const routingUniqueHashes = new Set(routingView.memberships.map((item) => sourceHashById.get(item.sourceId)).filter(Boolean));
check('LEGAL_UNIQUE_CONTENT_HASHES_RECOMPUTED', legalUniqueHashes.size === expected.legalViewUniqueHashes && legalView.uniqueContentHashes === expected.legalViewUniqueHashes, { recomputed: legalUniqueHashes.size, declared: legalView.uniqueContentHashes }, expected.legalViewUniqueHashes);
check('ROUTING_UNIQUE_CONTENT_HASHES_RECOMPUTED', routingUniqueHashes.size === expected.routingViewUniqueHashes && routingView.uniqueContentHashes === expected.routingViewUniqueHashes, { recomputed: routingUniqueHashes.size, declared: routingView.uniqueContentHashes }, expected.routingViewUniqueHashes);

check('ROUTING_CLOSURE_PASS', routingClosure.verdict === 'PASS' && routingClosure.results.atomicApply === 'PASS' && routingClosure.results.postApplyClosureValidator === '41/41 PASS', routingClosure.results, 'PASS/41/41');
check('ROUTING_DECISIONS_10_APPROVE', routingDecisions.decisions.length === 10 && routingDecisions.decisions.every((item) => item.decision === 'APPROVE'), routingDecisions.summary, '10/10 APPROVE');
check('ROUTING_CLASSIFICATIONS_9_1', routingDecisions.decisions.filter((item) => item.classification === 'AUTHORITATIVE_WITH_SCOPE').length === 9 && routingDecisions.decisions.filter((item) => item.classification === 'CONTEXTUAL').length === 1, routingDecisions.decisions.map((item) => item.classification), '9/1');
check('ROUTING_ATOMIC_OPERATIONS_10_0_0', routingReceipt.transaction?.operations?.add === 10 && routingReceipt.transaction?.operations?.modify === 0 && routingReceipt.transaction?.operations?.delete === 0, routingReceipt.transaction?.operations, { add: 10, modify: 0, delete: 0 });
const routingAddedIds = new Set(routingChangeset.additions.map((item) => item.sourceId));
const liveRoutingAdded = registry.sources.filter((item) => routingAddedIds.has(item.sourceId));
check('ROUTING_10_SOURCES_PRESENT_ONCE', liveRoutingAdded.length === 10 && routingChangeset.additions.every((item) => registry.sources.filter((live) => live.sourceId === item.sourceId).length === 1), liveRoutingAdded.length, 10);
check('ROUTING_10_SOURCE_OBJECTS_PRESERVED', routingChangeset.additions.every((item) => equal(registry.sources.find((live) => live.sourceId === item.sourceId), item)), routingChangeset.additions.filter((item) => !equal(registry.sources.find((live) => live.sourceId === item.sourceId), item)).map((item) => item.sourceId), []);
check('ROUTING_10_MEMBERSHIPS_PRESENT', routingChangeset.routingTollMembershipAdditions.every((item) => routingView.memberships.some((live) => equal(live, item))), routingChangeset.routingTollMembershipAdditions.filter((item) => !routingView.memberships.some((live) => equal(live, item))).map((item) => item.sourceId), []);

check('LEGAL005_EXECUTION_PASS', legal005Execution.result === 'PASS' && legal005Execution.atomicity.partialApply === false, legal005Execution.result, 'PASS');
check('LEGAL005_POST_APPLY_55_PASS', legal005Post.result === 'PASS' && legal005Post.passed === 55 && legal005Post.total === 55 && legal005Post.failedCount === 0, { result: legal005Post.result, passed: legal005Post.passed, total: legal005Post.total }, '55/55 PASS');
check('LEGAL005_IDEMPOTENCE_PASS', legal005Post.summary.idempotence === 'PASS' && equal(legal005Post.summary.secondApplyOperations, { add: 0, modify: 0, delete: 0 }), legal005Post.summary.secondApplyOperations, { add: 0, modify: 0, delete: 0 });
check('LEGAL005_DECISIONS_23_APPROVE', legal005Decisions.decisions.length === 23 && legal005Decisions.decisions.every((item) => item.decision === 'APPROVE'), legal005Decisions.decisions.length, 23);
check('LEGAL005_CLASSIFICATIONS_21_2', legal005Decisions.decisions.filter((item) => item.classification === 'AUTHORITATIVE_WITH_SCOPE').length === 21 && legal005Decisions.decisions.filter((item) => item.classification === 'CONTEXTUAL').length === 2, legal005Decisions.decisions.map((item) => item.classification), '21/2');
check('LEGAL005_BASELINE_COUNTS', beforeRegistry.sourceCount === 841 && beforeLegalView.sourceCount === 44 && beforeRouting.sourceCount === 289, { registry: beforeRegistry.sourceCount, legal: beforeLegalView.sourceCount, routing: beforeRouting.sourceCount }, { registry: 841, legal: 44, routing: 289 });
check('LEGAL005_EXISTING_841_UNCHANGED', registry.sources.slice(0, 841).every((item, index) => equal(item, beforeRegistry.sources[index])), registry.sources.slice(0, 841).findIndex((item, index) => !equal(item, beforeRegistry.sources[index])), -1);
check('LEGAL005_EXISTING_44_MEMBERSHIPS_UNCHANGED', legalView.memberships.slice(0, 44).every((item, index) => equal(item, beforeLegalView.memberships[index])), legalView.memberships.slice(0, 44).findIndex((item, index) => !equal(item, beforeLegalView.memberships[index])), -1);
check('LEGAL005_EXACT_21_ADDITIONS', registry.sources.slice(841).length === 21 && registry.sources.slice(841).every((item, index) => equal(item, legal005Changeset.registryAdditions[index])), registry.sources.slice(841).length, 21);
check('LEGAL005_EXACT_22_MEMBERSHIPS', legalView.memberships.slice(44).length === 22 && legalView.memberships.slice(44).every((item, index) => equal(item, legal005Changeset.legislationSafetyMembershipAdditions[index])), legalView.memberships.slice(44).length, 22);
check('LEGAL005_NO_MODIFY_DELETE', beforeRegistry.sources.every((item, index) => equal(item, registry.sources[index])) && beforeLegalView.memberships.every((item, index) => equal(item, legalView.memberships[index])), 'preserved', 'preserved');
check('LEGAL005_REUSES_EXACT', ['CS-DE-STVO', 'CS-EU-REG-561-2006'].every((id) => registry.sources.filter((item) => item.sourceId === id).length === 1), ['CS-DE-STVO', 'CS-EU-REG-561-2006'], 'present once');
check('NL_RVV_CANONICAL_ONLY', registry.sources.filter((item) => item.sourceId === 'CS-NL-RVV-HGV-ACCESS-20260701').length === 1 && !registry.sources.some((item) => item.sourceId === 'CS-NL-RWV-HGV-ACCESS-20260701'), 'RVV once / RWV absent', 'RVV once / RWV absent');

const duplicateMetrics = (sources) => {
  const groups = new Map();
  for (const source of sources) groups.set(source.sha256, (groups.get(source.sha256) ?? 0) + 1);
  const counts = [...groups.values()];
  return {
    duplicateGroups: counts.filter((count) => count > 1).length,
    duplicateExcess: counts.reduce((sum, count) => sum + Math.max(0, count - 1), 0),
  };
};
const beforeDuplicates = duplicateMetrics(beforeRegistry.sources);
const afterDuplicates = duplicateMetrics(registry.sources);
check('DUPLICATE_METRICS_62_195', equal(afterDuplicates, { duplicateGroups: 62, duplicateExcess: 195 }), afterDuplicates, { duplicateGroups: 62, duplicateExcess: 195 });
check('LEGAL005_DUPLICATE_IMPACT_ZERO', equal(beforeDuplicates, afterDuplicates), afterDuplicates, beforeDuplicates);
const added31 = [...routingChangeset.additions, ...legal005Changeset.registryAdditions];
check('APPLIED_ARTIFACTS_31_HASH_MATCH', added31.length === 31 && added31.every((item) => existsSync(absolute(item.canonicalPath)) && fileSha(item.canonicalPath) === item.sha256 && bytes(item.canonicalPath).length === item.sizeBytes), added31.filter((item) => !existsSync(absolute(item.canonicalPath)) || fileSha(item.canonicalPath) !== item.sha256 || bytes(item.canonicalPath).length !== item.sizeBytes).map((item) => item.sourceId), []);
check('APPLIED_PROVENANCE_31', added31.every((item) => item.provenance?.originalPreserved === true && item.evidenceRefs?.length > 0 && item.canonicalUri?.startsWith('https://')), added31.filter((item) => item.provenance?.originalPreserved !== true || !item.evidenceRefs?.length || !item.canonicalUri?.startsWith('https://')).map((item) => item.sourceId), []);

check('LEGAL003_CLOSED_EXACT', legal003Decision.decision === 'PASS_WITH_EXTERNAL_LICENSED_DEPENDENCY_CLOSED' && legal003Decision.approvedCurrentScope.status === 'COMPLETE', legal003Decision.decision, 'PASS_WITH_EXTERNAL_LICENSED_DEPENDENCY_CLOSED');
check('LEGAL003_VALIDATORS_PASS', legal003Validation.result === 'PASS' && legal003Validation.passed === 39 && legal003Validation.total === 39 && legal003Validation.impactStudyValidator.result === 'PASS' && legal003Validation.impactStudyValidator.passed === 30 && legal003Validation.impactStudyValidator.total === 30, legal003Validation, '39/39 and 30/30 PASS');
check('LEGAL003_EVIDENCE_3_PLUS_1', legal003Decision.metrics.publicAuthoritativeEvidence === '3/4' && legal003Decision.metrics.licensedExternalDependency === '1/4' && legal003Decision.metrics.currentScopeBlockers === 0, legal003Decision.metrics, '3/4 + 1/4; blockers 0');
check('LEGAL003_RECONCILIATION_3_ZERO_PENDING', legal003Reconciliation.candidateCount === 3 && legal003Reconciliation.pendingCount === 0, { count: legal003Reconciliation.candidateCount, pending: legal003Reconciliation.pendingCount }, { count: 3, pending: 0 });
check('LEGAL003_NO_APPLY', Object.values(legal003Reconciliation.currentMutationImpact).every((value) => value === '0/0/0') && legal003Decision.guardrails.apply === 'NOT_EXECUTED', legal003Reconciliation.currentMutationImpact, '0/0/0 and no apply');
check('LEGAL003_VDI_EXTERNAL_ONLY', legal003Decision.vdi.purchase === 'NOT_AUTHORIZED_NOT_EXECUTED' && legal003Decision.vdi.ingest === 'NOT_AUTHORIZED_NOT_EXECUTED' && legal003Decision.vdi.role === 'LICENSED_EXTERNAL_STANDARD', legal003Decision.vdi, 'external/no purchase/no ingest');
check('LEGAL003_EVIDENCE_5_HASH_MATCH', legal003Evidence.artifacts.length === 5 && legal003Evidence.artifacts.every((item) => existsSync(absolute(item.path)) && fileSha(item.path) === item.sha256), legal003Evidence.artifacts.length, 5);

const allCandidateRecords = [
  ...routingDecisions.decisions.map((item) => ({ candidateId: item.candidateId, sourceId: item.proposedSourceId })),
  ...legal005Decisions.decisions.map((item) => ({ candidateId: item.candidateId, sourceId: item.sourceId })),
  ...legal003Reconciliation.records.map((item) => ({ candidateId: item.candidateId, sourceId: item.sourceId })),
];
check('CANDIDATE_IDS_36_UNIQUE', allCandidateRecords.length === 36 && new Set(allCandidateRecords.map((item) => item.candidateId)).size === 36, { total: allCandidateRecords.length, unique: new Set(allCandidateRecords.map((item) => item.candidateId)).size }, { total: 36, unique: 36 });
const candidateSourceCounts = new Map();
for (const item of allCandidateRecords) candidateSourceCounts.set(item.sourceId, (candidateSourceCounts.get(item.sourceId) ?? 0) + 1);
const repeatedCandidateSources = [...candidateSourceCounts.entries()].filter(([, count]) => count > 1);
check('SOLE_INTENTIONAL_SOURCE_REUSE', candidateSourceCounts.size === 35 && equal(repeatedCandidateSources, [['CS-DE-STVO', 2]]), repeatedCandidateSources, [['CS-DE-STVO', 2]]);

const source = (id) => registry.sources.find((item) => item.sourceId === id);
const nl = source('CS-NL-GOV-TRUCK-TOLL-RATES-2026');
const fire = source('CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026');
const arv = source('CS-CH-ARV1-20250501');
const dk = source('CS-DK-KMTOLL-TARIFF-TABLE-V1-2');
const vignette = source('CS-CH-BAZG-MOTORWAY-VIGNETTE-2026');
check('NL_EXPIRY_CONTROL', nl?.freshness.effectiveUntil === '2026-08-31' && nl?.freshness.currentStatus === 'EXPIRY_WARNING' && nl?.freshness.reviewRequired === true && /UNKNOWN/.test(nl?.freshness.usageFallback ?? ''), nl?.freshness, '2026-08-31/EXPIRY_WARNING/review/UNKNOWN');
check('FR_FIRE_EXPIRY_CONTROL', fire?.freshness.effectiveUntil === '2026-08-31' && fire?.freshness.currentStatus === 'EXPIRY_WARNING' && fire?.freshness.reviewRequired === true && fire?.freshness.usageFallback === 'UNKNOWN_HUMAN_VERIFICATION', fire?.freshness, '2026-08-31/EXPIRY_WARNING/review/UNKNOWN');
check('ARV_NEW_VERSION_CONTROL', arv?.freshness.effectiveUntil === '2026-09-30' && arv?.freshness.currentStatus === 'NEW_VERSION_DETECTED' && arv?.freshness.reviewRequired === true && arv?.freshness.nextFreshnessCheck === '2026-09-01' && arv.supersedes.length === 0 && arv.supersededBy.length === 0, arv?.freshness, 'NEW_VERSION_DETECTED/no auto supersession');
check('DK_Q3_CONTROL', dk?.freshness.effectiveUntil === null && dk?.freshness.nextFreshnessCheck === '2026-09-30' && /Q3 2026/.test(dk?.version ?? ''), dk?.freshness, 'no expiry/Q3 2026');
check('CH_VIGNETTE_WINDOW', vignette?.freshness.effectiveFrom === '2025-12-01' && vignette?.freshness.effectiveUntil === '2027-01-31' && vignette?.freshness.nextFreshnessCheck === '2027-01-01', vignette?.freshness, '2025-12-01/2027-01-31/2027-01-01');
for (const id of ['CS-AT-HGV-BAN-CALENDAR-2026', 'CS-AT-A10-SUMMER-HGV-BAN-2026', 'CS-AT-LUEGBRUECKE-HGV-BAN-2026', 'CS-FR-TRUCK-BAN-2026']) {
  check(`ANNUAL_END_${id}`, source(id)?.freshness.effectiveUntil === '2026-12-31' && source(id)?.freshness.nextFreshnessCheck === '2026-12-01', source(id)?.freshness, '2026-12-31/2026-12-01');
}
check('QUEUE_9_ZERO_BLOCKERS', queue.items.length === 9 && queue.summary.phase3CloseoutBlockers === 0 && queue.items.every((item) => item.blockingPhase3Closeout === false), queue.summary, '9 items/0 blockers');
check('QUEUE_SUCCESSOR_COUNTS', queue.summary.successorDetected === 1 && queue.summary.noSuccessorDetected === 8, queue.summary, '1/8');
check('QUEUE_NO_AUTO_ACTIONS', queue.semantics.automaticPromotion === false && queue.semantics.automaticSupersession === false && queue.semantics.automaticRegistryOrViewMutation === false, queue.semantics, 'all false');
check('TEMPORAL_INVARIANTS', legal005Temporal.invariants.unknownIsNotSafePassZeroOrNoRestriction === true && legal005Temporal.invariants.currentAfterEffectiveUntil === 'FORBIDDEN', legal005Temporal.invariants, 'UNKNOWN invariant true / CURRENT after effectiveUntil FORBIDDEN');

const contract = text(paths.freshnessContract);
const engine = text(paths.freshnessEngine);
const policy = text(paths.freshnessPolicy);
for (const state of ['CURRENT', 'EXPIRY_WARNING', 'NEW_VERSION_DETECTED', 'SUPERSEDED_PENDING_REVIEW', 'REVIEW_REQUIRED', 'EXPIRED_REVIEW_REQUIRED', 'FRESHNESS_UNKNOWN']) {
  check(`FRESHNESS_STATE_${state}`, contract.includes(`'${state}'`) && policy.includes(state), state, 'implemented and documented');
}
check('FRESHNESS_NO_AUTO_AUTHORITY', engine.includes("authorityPromotion: 'NONE'") && engine.includes('automaticPromotion: false'), 'NONE/false', 'NONE/false');
check('FRESHNESS_UNKNOWN_NULL', engine.includes('resolvedValue: null') && engine.includes('UNKNOWN_HUMAN_VERIFICATION'), 'null/UNKNOWN', 'null/UNKNOWN');
check('FRESHNESS_HISTORICAL_TESTS_PASS', freshnessValidation.results.apiBuild === 'PASS' && freshnessValidation.results.contractTests.status === 'PASS' && freshnessValidation.results.contractTests.passed === 16 && freshnessValidation.results.readOnlyValidator.status === 'PASS' && freshnessValidation.results.readOnlyValidator.passed === 44, freshnessValidation.results, 'build PASS/tests 16/16/validator 44/44');
check('FRESHNESS_RUNTIME_ACTIVATED', text(paths.appModule).includes('SourceFreshnessModule'), text(paths.appModule).includes('SourceFreshnessModule') ? 'imported' : 'not imported', 'imported');

const env = parseEnv(existsSync(absolute('.env')) ? text('.env') : '');
const recipients = splitRecipients(env.AGM_PRODUCT_OWNER_ALERT_EMAIL);
const gmailAuth = Boolean(env.GMAIL_ACCESS_TOKEN?.trim()) || Boolean(env.GMAIL_OAUTH_CLIENT_ID?.trim() && env.GMAIL_OAUTH_CLIENT_SECRET?.trim() && env.GMAIL_OAUTH_REFRESH_TOKEN?.trim());
check('EMAIL_RECIPIENTS_EXACT', equal(recipients.map((item) => item.toLowerCase()), ['agm.transporte.logistik@gmail.com', 'adrianmuscalu2@gmail.com']), { count: recipients.length }, { count: 2 });
check('EMAIL_SENDER_EXACT', env.GMAIL_FROM_ADDRESS?.trim().toLowerCase() === 'agm.transporte.logistik@gmail.com', Boolean(env.GMAIL_FROM_ADDRESS), true);
check('EMAIL_AUTH_GATE_EXACT', gmailAuth === false && closeout.emailAlerting.deliveryStatus === 'BLOCKED_CONFIGURATION_REQUIRED' && closeout.emailAlerting.scope === 'EMAIL_DELIVERY_ONLY', { gmailAuth, status: closeout.emailAlerting.deliveryStatus }, { gmailAuth: false, status: 'BLOCKED_CONFIGURATION_REQUIRED' });

check('GOVERNANCE_POLICY_APPROVED', governance.status === 'APPROVED' && governance.scope === 'AGM_WIDE', { status: governance.status, scope: governance.scope }, { status: 'APPROVED', scope: 'AGM_WIDE' });
check('GOVERNANCE_HUMAN_FLOW', governance.mandatoryFlow.join('>') === 'AGM_PROPOSAL>HUMAN_PHYSICAL_VERIFICATION>USER_DECISION', governance.mandatoryFlow, 'proposal>verification>decision');
check('GOVERNANCE_NO_AUTOMATIC_PASS', ['COMPLIANT', 'SAFE', 'CERTIFIED', 'PASS'].every((state) => governance.forbiddenAutomaticStates.includes(state)), governance.forbiddenAutomaticStates, 'all forbidden');
check('TECH_DEBT_ZERO_BLOCKERS', debt.phase3ClosureBlockers === 0 && debt.items.every((item) => item.phase3ClosureBlocker === false), debt.phase3ClosureBlockers, 0);
check('TECH_DEBT_EXPECTED_ITEMS', ['P3-TD-001', 'P3-TD-002', 'P3-TD-003', 'P3-TD-004', 'P3-TD-005', 'P3-TD-006', 'P3-TD-007'].every((id) => debt.items.some((item) => item.debtId === id)), debt.items.map((item) => item.debtId), 'P3-TD-001..007');
check('LEGACY_UI_ASSERTION_DOCUMENTED', text(paths.legacyUiTest).includes("includes('Pre-Departure')") && debt.items.some((item) => item.debtId === 'P3-TD-004'), 'present/documented', 'present/documented');

for (const binding of Object.values(closeout.recordBindings)) {
  check(`RECORD_BINDING_${path.basename(binding.path).replaceAll('.', '_').toUpperCase()}_${binding.sha256.slice(0, 8)}`, existsSync(absolute(binding.path)) && fileSha(binding.path) === binding.sha256, existsSync(absolute(binding.path)) ? fileSha(binding.path) : 'missing', binding.sha256);
}
const residue = [
  `${paths.registry}.legal005-stage`, `${paths.registry}.legal005-backup`,
  `${paths.legalView}.legal005-stage`, `${paths.legalView}.legal005-backup`,
  `${paths.registry}.routing-toll-001-stage`, `${paths.registry}.routing-toll-001-backup`,
  `${paths.routingView}.routing-toll-001-stage`, `${paths.routingView}.routing-toll-001-backup`,
  'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY/.atomic-apply.lock',
  'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CONSOLIDATED_PRE_APPLY/.atomic-apply.lock',
].filter((relative) => existsSync(absolute(relative)));
check('ZERO_TRANSACTION_RESIDUE', residue.length === 0, residue, []);
check('NO_CLOSEOUT_APPLY', closeout.guardrails.atomicApplyDuringCloseout === 'NOT_EXECUTED', closeout.guardrails.atomicApplyDuringCloseout, 'NOT_EXECUTED');
check('NO_CLOSEOUT_AUTHORITY_PROMOTION', closeout.guardrails.authorityPromotionDuringCloseout === 'NONE', closeout.guardrails.authorityPromotionDuringCloseout, 'NONE');
check('NO_RUNTIME_PRODUCTION_CHANGE', closeout.guardrails.runtimeProduction === 'NO_CHANGE', closeout.guardrails.runtimeProduction, 'NO_CHANGE');
check('NO_COMMIT_PUSH', closeout.guardrails.commitPush === 'NOT_EXECUTED', closeout.guardrails.commitPush, 'NOT_EXECUTED');

const failed = checks.filter((item) => item.status === 'FAIL');
const result = {
  validator: 'PHASE3_FINAL_CONSOLIDATED_CLOSEOUT_READ_ONLY',
  validationMode: 'READ_ONLY_NO_APPLY',
  asOfDate: '2026-08-30',
  verdict: failed.length === 0 ? 'PASS' : 'FAIL',
  summary: {
    passed: checks.length - failed.length,
    total: checks.length,
    failed: failed.length,
  },
  finalBaseline: {
    centralRegistry: { count: registry.sourceCount, sha256: fileSha(paths.registry) },
    legislationSafetyView: { count: legalView.sourceCount, sha256: fileSha(paths.legalView) },
    routingTollView: { count: routingView.sourceCount, sha256: fileSha(paths.routingView) },
  },
  objectiveStatus: closeout.objectiveStatusMatrix.map((item) => ({ objectiveId: item.objectiveId, status: item.status })),
  integrity: {
    uniqueSourceIds: new Set(registry.sources.map((item) => item.sourceId)).size,
    candidateIds: { total: allCandidateRecords.length, unique: new Set(allCandidateRecords.map((item) => item.candidateId)).size },
    duplicateContent: afterDuplicates,
    legalViewOrphans: legalView.memberships.filter((item) => !registryIds.has(item.sourceId)).length,
    routingViewOrphans: routingView.memberships.filter((item) => !registryIds.has(item.sourceId)).length,
    transactionResidue: residue,
  },
  externalDependencies: closeout.remainingExternalDependencies,
  failedChecks: failed,
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;

function parseEnv(value) {
  const parsed = {};
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let envValue = line.slice(separator + 1).trim();
    if ((envValue.startsWith('"') && envValue.endsWith('"')) || (envValue.startsWith("'") && envValue.endsWith("'"))) envValue = envValue.slice(1, -1);
    parsed[key] = envValue;
  }
  return parsed;
}

function splitRecipients(value = '') {
  return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
}
