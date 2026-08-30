import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const phase3Root = path.join(root, 'AGM_LIBRARY', 'PHASE3');
const phase2Candidates = readJson('AGM_LIBRARY/PHASE2/CANDIDATES/canonical-source-candidates.json');
const phase2Queue = readJson('AGM_LIBRARY/PHASE2/HUMAN_REVIEW_QUEUE.json');
const central = readJson('AGM_LIBRARY/REGISTRY/canonical-sources.json');
const decisions = readJson('AGM_LIBRARY/PHASE3/HUMAN_AUTHORITY_DECISIONS.json');
const currentness = readJson('AGM_LIBRARY/PHASE3/CURRENT_SUPERSEDED_MATRIX.json');
const applicability = readJson('AGM_LIBRARY/PHASE3/JURISDICTION_APPLICABILITY_MATRIX.json');
const unresolved = readJson('AGM_LIBRARY/PHASE3/UNRESOLVED_AUTHORITY_GAPS.json');
const changeset = readJson('AGM_LIBRARY/PHASE3/PROPOSED_CANONICAL_PROMOTION_CHANGESET.json');
const diff = readJson('AGM_LIBRARY/PHASE3/REGISTRY_BEFORE_AFTER_DIFF.json');
const queue = readJson('AGM_LIBRARY/PHASE3/UPDATED_HUMAN_REVIEW_QUEUE.json');
const readiness = readJson('AGM_LIBRARY/PHASE3/DOMAIN_READINESS_REASSESSMENT.json');
const checks = [];
const allowedVerdicts = new Set(['AUTHORITATIVE_CURRENT', 'AUTHORITATIVE_WITH_SCOPE', 'CONTEXTUAL', 'EVIDENCE_ONLY', 'SUPERSEDED', 'REJECTED', 'UNRESOLVED']);

check('PHASE3_DELIVERABLES_COMPLETE', () => {
  for (const file of [
    'HUMAN_AUTHORITY_DECISIONS.json', 'AUTHORITY_REVIEW_REPORT.md',
    'CURRENT_SUPERSEDED_MATRIX.json', 'JURISDICTION_APPLICABILITY_MATRIX.json',
    'UNRESOLVED_AUTHORITY_GAPS.json', 'PROPOSED_CANONICAL_PROMOTION_CHANGESET.json',
    'REGISTRY_BEFORE_AFTER_DIFF.json', 'UPDATED_HUMAN_REVIEW_QUEUE.json',
    'DOMAIN_READINESS_REASSESSMENT.json', 'OFFICIAL_SOURCE_REVIEW_NOTES.md',
  ]) assert(existsSync(path.join(phase3Root, file)), `MISSING:${file}`);
});

check('ALL_FIFTEEN_QUEUE_ELEMENTS_REVIEWED', () => {
  assert(decisions.decisionCount === 15 && decisions.decisions.length === 15, 'DECISION_COUNT_INVALID');
  assert(new Set(decisions.decisions.map((item) => item.reviewId)).size === 15, 'DUPLICATE_REVIEW_ID');
  const phase2Ids = new Set(phase2Queue.items.map((item) => item.reviewId));
  for (const decision of decisions.decisions) assert(phase2Ids.has(decision.reviewId), `UNKNOWN_REVIEW:${decision.reviewId}`);
  for (const item of phase2Queue.items) assert(decisions.decisions.some((decision) => decision.reviewId === item.reviewId), `REVIEW_MISSING:${item.reviewId}`);
});

check('MANDATORY_DECISION_METADATA_COMPLETE', () => {
  for (const decision of decisions.decisions) {
    for (const field of ['candidateSourceIds','domain','issuingAuthorities','jurisdictions','applicabilityScope','versionRevision','supersedes','supersededBy','authorityRationale','provenanceEvidence','reviewOwner','reviewTimestamp','humanDecision','verdict','conditionsLimitations','evidenceReferences']) {
      assert(decision[field] !== undefined && decision[field] !== '', `DECISION_FIELD_MISSING:${decision.reviewId}:${field}`);
    }
    assert(allowedVerdicts.has(decision.verdict), `INVALID_VERDICT:${decision.reviewId}`);
    assert(decision.candidateSourceIds.length > 0 && decision.sourceAssessments.length === decision.candidateSourceIds.length, `SOURCE_ASSESSMENT_COUNT:${decision.reviewId}`);
    assert(decision.evidenceReferences.length > 0, `EVIDENCE_MISSING:${decision.reviewId}`);
  }
});

check('NO_FABRICATED_HUMAN_DECISION', () => {
  assert(decisions.completedHumanDecisions === 0 && decisions.pendingHumanDecisions === 15, 'HUMAN_COUNT_FALSE');
  assert(decisions.rule === 'Technical recommendation is not a human authority decision.', 'HUMAN_BOUNDARY_MISSING');
  for (const decision of decisions.decisions) {
    assert(decision.humanDecision === 'PENDING_NAMED_OWNER_SIGNATURE', `FALSE_HUMAN_SIGNATURE:${decision.reviewId}`);
    assert(decision.verdict === 'UNRESOLVED', `UNSIGNED_NON_UNRESOLVED:${decision.reviewId}`);
    for (const source of decision.sourceAssessments) assert(source.humanApproved === false && source.currentStatus === 'UNKNOWN_PENDING_HUMAN_DECISION', `SOURCE_FALSE_APPROVAL:${source.sourceId}`);
  }
});

check('CURRENT_SUPERSEDED_UNKNOWN_IS_HONEST', () => {
  assert(currentness.sources.length === phase2Candidates.candidateCount, 'CURRENTNESS_SOURCE_COUNT');
  for (const source of currentness.sources) {
    assert(allowedVerdicts.has(source.proposedClassification), `INVALID_SOURCE_RECOMMENDATION:${source.sourceId}`);
    assert(source.finalCurrentStatus === 'UNKNOWN_PENDING_HUMAN_DECISION', `FALSE_CURRENT:${source.sourceId}`);
    assert(source.finalSupersededStatus === 'UNKNOWN_PENDING_HUMAN_DECISION', `FALSE_SUPERSEDED:${source.sourceId}`);
    assert(source.automaticPromotion === false, `AUTO_PROMOTION:${source.sourceId}`);
  }
});

check('TACHO_RELATIONSHIP_SCOPE_AND_AUTHORITY_REVIEWED', () => {
  const tacho = decisions.decisions.filter((item) => item.gapId.startsWith('TACHO-'));
  assert(tacho.length === 5, 'TACHO_REVIEW_COUNT');
  assert(tacho.find((item) => item.gapId === 'TACHO-001').applicabilityScope.includes('2026-07-01'), 'TACHO_LIGHT_VEHICLE_SCOPE_MISSING');
  assert(tacho.find((item) => item.gapId === 'TACHO-001').conditionsLimitations.some((text) => text.includes('AETR')), 'AETR_BOUNDARY_MISSING');
  assert(tacho.find((item) => item.gapId === 'TACHO-002').legalRelationships.some((row) => row.relation === 'REPEALS'), 'REG165_REPEAL_RELATION_MISSING');
  assert(tacho.find((item) => item.gapId === 'TACHO-003').legalRelationships.some((row) => row.relation === 'IMPLEMENTS'), 'REG799_IMPLEMENTATION_RELATION_MISSING');
  assert(tacho.find((item) => item.gapId === 'TACHO-004').authorityRationale.includes('directly applicable EU rules'), 'GERMAN_EU_BOUNDARY_MISSING');
  assert(tacho.find((item) => item.gapId === 'TACHO-005').technicalRecommendation === 'CONTEXTUAL', 'INTERNAL_CHANGE_MAP_FALSE_AUTHORITY');
});

check('ROUTING_TOLL_FIELD_AUTHORITY_LAYERS_SEPARATED', () => {
  const requiredLayers = ['OFFICIAL_AUTHORITY','PROVIDER_DOCUMENTATION','AGM_INTERNAL_POLICY','FIELD_EVIDENCE','HUMAN_CONFIRMATION_RULE'];
  assert(applicability.authorityLayers.length === requiredLayers.length, 'AUTHORITY_LAYER_COUNT');
  for (const layer of requiredLayers) assert(applicability.authorityLayers.some((item) => item.layer === layer), `AUTHORITY_LAYER_MISSING:${layer}`);
  const toll = applicability.tollSources;
  assert(toll.length === 11, 'TOLL_SOURCE_COUNT');
  const jurisdictions = new Set(toll.map((item) => item.jurisdiction));
  for (const jurisdiction of ['DE','AT','CH','BE','PL','CZ','DK','NL','FR','LU']) assert(jurisdictions.has(jurisdiction), `TOLL_JURISDICTION_MISSING:${jurisdiction}`);
  for (const source of toll) {
    for (const field of ['sourceId','jurisdiction','authorityProvider','authorityClass','vehicleScope','freshnessPolicy','evidenceReferences']) assert(source[field] !== undefined && source[field] !== '', `TOLL_FIELD_MISSING:${source.sourceId}:${field}`);
    assert(source.humanApproved === false && source.finalStatus === 'UNRESOLVED', `TOLL_FALSE_APPROVAL:${source.sourceId}`);
  }
  assert(toll.find((item) => item.jurisdiction === 'DK').vehicleScope.includes('12 t'), 'DK_CURRENT_SCOPE_MISSING');
  assert(toll.find((item) => item.jurisdiction === 'LU').vehicleScope.startsWith('UNKNOWN'), 'LU_STALE_NOT_UNKNOWN');
  assert(toll.find((item) => item.jurisdiction === 'FR').freshnessPolicy.includes('CONCESSION'), 'FR_CONCESSION_POLICY_MISSING');
  const field = decisions.decisions.find((item) => item.gapId === 'FIELD-001');
  assert(field.authorityRationale.includes('measured observations are evidence only'), 'FIELD_FALSE_RULE_AUTHORITY');
});

check('CAR_MOVER_PREMIUM_BOUNDARY_PRESERVED', () => {
  const report = read('AGM_LIBRARY/PHASE3/AUTHORITY_REVIEW_REPORT.md');
  assert(report.includes('inside AGM Premium, not a separate\nproduct/project'), 'CAR_MOVER_BOUNDARY_MISSING');
  for (const gapId of ['CAR-MOVER-001','CAR-MOVER-002']) {
    const decision = decisions.decisions.find((item) => item.gapId === gapId);
    assert(decision.domain === 'car-mover', `CAR_MOVER_DOMAIN_INVALID:${gapId}`);
    assert(decision.technicalRecommendation === 'AUTHORITATIVE_WITH_SCOPE', `CAR_MOVER_RECOMMENDATION_INVALID:${gapId}`);
    assert(decision.verdict === 'UNRESOLVED', `CAR_MOVER_UNSIGNED_PROMOTION:${gapId}`);
  }
});

check('OCR_DOCUMENT_DERIVED_EVIDENCE_RETENTION_SEPARATED', () => {
  const decision = decisions.decisions.find((item) => item.gapId === 'DOCS-001');
  assert(decision.applicabilityScope.includes('source documents, derived OCR output, extracted values and retention'), 'OCR_LAYERS_MISSING');
  assert(decision.authorityRationale.includes('OCR output cannot become canonical truth'), 'OCR_TRUTH_GATE_MISSING');
  assert(decision.conditionsLimitations.some((text) => text.includes('legal retention periods')), 'RETENTION_UNKNOWN_MISSING');
});

check('LEGISLATION_SAFETY_REMAINS_NOT_READY', () => {
  const legal = readiness.domains.find((item) => item.domain === 'LEGISLATION / SAFETY');
  assert(legal?.verdict === 'NOT READY', 'LEGAL_FALSE_READY');
  assert(decisions.decisions.find((item) => item.gapId === 'LEGAL-003').technicalRecommendation === 'UNRESOLVED', 'VDI_GAP_FALSE_CLOSURE');
  assert(decisions.decisions.find((item) => item.gapId === 'LEGAL-005').technicalRecommendation === 'UNRESOLVED', 'JURISDICTION_GAP_FALSE_CLOSURE');
  const vdi = currentness.sources.find((item) => item.sourceId === 'CS-VDI-2700-HANDBOOK');
  assert(vdi.proposedClassification === 'CONTEXTUAL', 'VDI_FALSE_AUTHORITATIVE');
});

check('PROPOSED_CHANGESET_NOT_APPLIED_AND_CONTINUITY_VALID', () => {
  assert(changeset.status === 'PROPOSED_NOT_APPLIED' && changeset.applyAuthority === 'NOT_GRANTED_BY_CURRENT_MANDATE', 'CHANGESET_APPLY_STATE');
  assert(changeset.operationCount === phase2Candidates.candidateCount, 'CHANGESET_OPERATION_COUNT');
  assert(changeset.operations.every((operation) => operation.applied === false), 'CHANGESET_OPERATION_APPLIED');
  assert(changeset.operations.every((operation) => operation.sourceIdContinuity === 'PRESERVE_PHASE2_SOURCE_ID'), 'SOURCE_ID_CONTINUITY_MISSING');
  assert(new Set(changeset.operations.map((operation) => operation.sourceId)).size === changeset.operations.length, 'CHANGESET_DUPLICATE_SOURCE_ID');
  const centralIds = new Set(central.sources.map((source) => source.sourceId));
  for (const operation of changeset.operations) assert(!centralIds.has(operation.sourceId), `CENTRAL_SOURCE_ID_COLLISION:${operation.sourceId}`);
  assert(changeset.centralRegistryBeforeSha256 === sha('AGM_LIBRARY/REGISTRY/canonical-sources.json'), 'CENTRAL_HASH_DRIFT');
});

check('BEFORE_AFTER_DIFF_PROVES_ZERO_MUTATION', () => {
  assert(diff.status === 'SIMULATION_ONLY_NOT_APPLIED', 'DIFF_STATUS_INVALID');
  assert(diff.before.sourceCount === 798 && diff.afterApplied.sourceCount === 798, 'ACTUAL_SOURCE_COUNT_CHANGED');
  assert(diff.before.sha256 === diff.afterApplied.sha256 && diff.afterApplied.changed === false, 'ACTUAL_HASH_CHANGED');
  assert(diff.conditionalAfterIfEveryOperationIsHumanApproved.sourceCount === 833, 'CONDITIONAL_COUNT_INVALID');
  assert(diff.domainViews.modeBefore === 'REFERENCE_ONLY' && diff.domainViews.modeAfterApplied === 'REFERENCE_ONLY_UNCHANGED', 'DOMAIN_VIEW_MUTATION');
});

check('UPDATED_QUEUE_OPEN_AND_TRACEABLE', () => {
  assert(queue.queueCount === 15 && queue.technicalReviewComplete === 15 && queue.humanReviewComplete === 0, 'QUEUE_COUNTS_INVALID');
  for (const item of queue.items) {
    assert(item.state === 'AWAITING_NAMED_OWNER_DECISION', `QUEUE_FALSE_CLOSED:${item.reviewId}`);
    assert(item.technicalReviewComplete === true && item.humanDecisionComplete === false, `QUEUE_REVIEW_FLAGS:${item.reviewId}`);
    assert(item.phase3Verdict === 'UNRESOLVED' && item.decisionRef.includes(item.reviewId), `QUEUE_TRACEABILITY:${item.reviewId}`);
  }
  assert(unresolved.gapCount === 15 && unresolved.gaps.length === 15, 'UNRESOLVED_GAP_COUNT');
});

check('DOMAIN_READINESS_VALUES_VALID', () => {
  assert(readiness.domains.length === 5, 'DOMAIN_COUNT_INVALID');
  for (const item of readiness.domains) assert(['READY FOR AUTHORITATIVE VIEW','PARTIALLY READY','NOT READY'].includes(item.verdict), `DOMAIN_VERDICT_INVALID:${item.domain}`);
  assert(readiness.domains.every((item) => item.verdict !== 'READY FOR AUTHORITATIVE VIEW'), 'UNSIGNED_DOMAIN_FALSE_READY');
});

check('NO_RUNTIME_TURN_PRODUCTION_BASIC_OR_HISTORY_MUTATION', () => {
  const report = read('AGM_LIBRARY/PHASE3/AUTHORITY_REVIEW_REPORT.md');
  for (const statement of ['RUNTIME CHANGE = NONE','PRODUCTION CHANGE = NONE','TURN CHANGE = NONE','BASIC LIBRARIAN = UNCHANGED','CENTRAL REGISTRY MUTATION = NONE']) assert(report.includes(statement), `SCOPE_STATEMENT_MISSING:${statement}`);
  assert(central.sourceCount === 798, 'CENTRAL_COUNT_DRIFT');
});

const failed = checks.filter((item) => item.status === 'FAIL');
const report = `# PHASE 3 package validation report

Generated: \`2026-08-29\`
Package validation: **${failed.length ? 'FAIL' : 'PASS'}**
Human authority closure: **FAIL / OPEN**
Final PHASE 3 verdict: **FAIL**

## Checks

${checks.map((item) => `- ${item.name} = ${item.status}${item.error ? ` — ${item.error}` : ''}`).join('\n')}

## Counts and boundary

- technical reviews: ${decisions.decisionCount}/15;
- named human decisions: ${decisions.completedHumanDecisions}/15;
- proposed conditional operations: ${changeset.operationCount};
- applied operations: 0;
- Central Registry sources: ${central.sourceCount};
- Central Registry SHA-256: \`${sha('AGM_LIBRARY/REGISTRY/canonical-sources.json')}\`;
- automatic promotions: 0.

The package can proceed to named human review. It cannot proceed to canonical
promotion under the current mandate.
`;
writeFileSync(path.join(phase3Root, 'PHASE3_VALIDATION_REPORT.md'), report, 'utf8');

for (const item of checks) console.log(`${item.name}=${item.status}${item.error ? ` error=${item.error}` : ''}`);
console.log(`PHASE3_PACKAGE_VALIDATION=${failed.length ? 'FAIL' : 'PASS'}`);
console.log('PHASE3_HUMAN_AUTHORITY_CLOSURE=FAIL_OPEN');
console.log('PHASE3_FINAL_VERDICT=FAIL');
if (failed.length) process.exitCode = 1;

function check(name, operation) { try { operation(); checks.push({ name, status: 'PASS' }); } catch (error) { checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) }); } }
function read(relativePath) { return readFileSync(path.join(root, relativePath), 'utf8'); }
function readJson(relativePath) { return JSON.parse(read(relativePath)); }
function sha(relativePath) { return createHash('sha256').update(readFileSync(path.join(root, relativePath))).digest('hex'); }
function assert(value, message) { if (!value) throw new Error(message); }
