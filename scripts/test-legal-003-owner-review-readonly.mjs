import { readFileSync } from 'node:fs';
import { BASELINE, absolute, readJson, sha256, verifyProtectedBaseline } from './legal-gap-owner-review-common.mjs';

const OUT = 'AGM_LIBRARY/PHASE3/LEGAL_003_OWNER_REVIEW';
const checks = [];
const check = (id, condition, actual, expected) => checks.push({ id, status: condition ? 'PASS' : 'FAIL', actual, expected });

const before = verifyProtectedBaseline();
const assessment = readJson(`${OUT}/AS_IS_ASSESSMENT.json`);
const matrix = readJson(`${OUT}/RESIDUAL_CLOSURE_MATRIX.json`);
const manifest = readJson(`${OUT}/EVIDENCE_MANIFEST.json`);
const candidates = readJson(`${OUT}/CANDIDATE_AUTHORITY_PACKAGE.json`);
const licensedInventory = readJson(`${OUT}/LICENSED_CONTENT_INVENTORY.json`);

check('GAP_ID', assessment.gapId === 'LEGAL-003', assessment.gapId, 'LEGAL-003');
check('STATUS_PARTIAL_BLOCKED', assessment.verdict === 'PARTIALLY_READY_BLOCKED', assessment.verdict, 'PARTIALLY_READY_BLOCKED');
check('COVERAGE_3_OF_4', assessment.coverage.ratio === '3/4', assessment.coverage, '3/4');
check('OFFICIAL_EVIDENCE_3_OF_4', assessment.officialEvidence.ratio === '3/4', assessment.officialEvidence, '3/4');
check('ONE_EXACT_ACQUISITION_BLOCKER', JSON.stringify(assessment.blockers) === JSON.stringify(['OWNER_LICENSED_ACQUISITION_REQUIRED']), assessment.blockers, ['OWNER_LICENSED_ACQUISITION_REQUIRED']);
check('OTHER_THREE_CANDIDATES_NOT_BLOCKED', assessment.reviewReadiness.readyCandidateIds.length === 3 && /does not block/.test(assessment.reviewReadiness.note), assessment.reviewReadiness, 'three review-ready candidates');
check('RESIDUAL_MATRIX_4', matrix.items.length === 4, matrix.items.length, 4);
check('LICENSED_NORMATIVE_MISSING', matrix.items.find((item) => item.requirementId === 'LEGAL003-R4')?.evidenceStatus === 'MISSING_LICENSED_CONTENT', matrix.items.find((item) => item.requirementId === 'LEGAL003-R4')?.evidenceStatus, 'MISSING_LICENSED_CONTENT');
check('AUTHORIZED_INVENTORY_NO_LICENSED_FILE', licensedInventory.licensedNormativeFilesFound === 0 && licensedInventory.result === 'OWNER_LICENSED_ACQUISITION_REQUIRED', licensedInventory, 'no licensed normative file found');
check('THREE_CANDIDATES', candidates.candidates.length === 3, candidates.candidates.length, 3);
check('NO_ASSUMED_APPROVAL', candidates.candidates.every((item) => item.decisionStatus === 'PENDING_PRODUCT_OWNER'), candidates.candidates.map((item) => item.decisionStatus), 'all PENDING_PRODUCT_OWNER');
check('CLASSIFICATION_SPLIT', candidates.candidates.filter((item) => item.proposedClassification === 'AUTHORITATIVE_WITH_SCOPE').length === 2 && candidates.candidates.filter((item) => item.proposedClassification === 'CONTEXTUAL').length === 1, candidates.candidates.map((item) => item.proposedClassification), '2 scoped authoritative + 1 contextual');
check('STVO_REUSED', candidates.candidates.find((item) => item.sourceId === 'CS-DE-STVO')?.ifApprove.registryAdd === 0, candidates.candidates.find((item) => item.sourceId === 'CS-DE-STVO')?.ifApprove, 'no duplicate add');
check('VDI_CONTEXTUAL_ONLY', candidates.candidates.find((item) => item.sourceId === 'CS-VDI-2700-HANDBOOK')?.applyEligibility === 'DECISION_REQUIRED_CONTEXTUAL_ONLY', candidates.candidates.find((item) => item.sourceId === 'CS-VDI-2700-HANDBOOK')?.applyEligibility, 'DECISION_REQUIRED_CONTEXTUAL_ONLY');
check('UNKNOWN_NOT_ZERO', candidates.candidates.every((item) => !/ZERO/.test(item.freshness.usageFallback) && item.freshness.usageFallback.includes('USE_ONLY')), candidates.candidates.map((item) => item.freshness.usageFallback), 'no ZERO fallback');
check('NO_INVENTED_EXPIRY', candidates.candidates.every((item) => item.freshness.effectiveUntil === null), candidates.candidates.map((item) => item.freshness.effectiveUntil), 'all null');
check('EVIDENCE_COUNT_5', manifest.artifacts.length === 5, manifest.artifacts.length, 5);
check('ALL_CAPTURED_EVIDENCE_VALID', manifest.artifacts.every((item) => item.localValidation === 'PASS'), manifest.artifacts.map((item) => ({ id: item.evidenceId, status: item.localValidation })), 'all PASS');
check('HGB_HASH', manifest.artifacts.find((item) => item.evidenceId === 'LEGAL003-EV-HGB-412')?.sha256 === '30dd1fc834d186097de827e80c3ebda61a63967996066525701658c3871acc09', manifest.artifacts.find((item) => item.evidenceId === 'LEGAL003-EV-HGB-412')?.sha256, '30dd...c09');
check('STVO_HASH_REUSED', manifest.artifacts.find((item) => item.evidenceId === 'LEGAL003-EV-STVO-EXISTING')?.sha256 === '0173e104e503f6abfdd5b081aa6b0bb5ea816ce1c1613f50f3dfecdf9ec68559', manifest.artifacts.find((item) => item.evidenceId === 'LEGAL003-EV-STVO-EXISTING')?.sha256, '0173...559');
check('OFFICIAL_PROVENANCE', manifest.artifacts.every((item) => /^https:\/\//.test(item.officialUrl) && item.authority), manifest.artifacts.map((item) => item.officialUrl), 'official HTTPS URLs and authorities');
check('VDI_METADATA_NOT_NORMATIVE', assessment.authorityGaps.some((item) => /cannot.*substitute|cannot.*normative/i.test(item)), assessment.authorityGaps, 'explicit non-substitution');
check('LICENSE_CHECKLIST_PRESENT', /OWNER_LICENSED_ACQUISITION_REQUIRED/.test(readFileSync(absolute(`${OUT}/OWNER_LICENSED_ACQUISITION_CHECKLIST.md`), 'utf8')), true, true);
check('LICENSE_MINIMUM_EXACT', /VDI 2700 Blatt 8\.1:2024-09 plus Berichtigung:2025-10/.test(assessment.reviewReadiness.blockedNormativeCandidate) && /Required edition:\*\* 2024-09/.test(readFileSync(absolute(`${OUT}/OWNER_LICENSED_ACQUISITION_CHECKLIST.md`), 'utf8')) && /Required correction:\*\* VDI 2700 Blatt 8\.1 Berichtigung, 2025-10/.test(readFileSync(absolute(`${OUT}/OWNER_LICENSED_ACQUISITION_CHECKLIST.md`), 'utf8')), assessment.reviewReadiness.blockedNormativeCandidate, 'exact edition and correction');
check('PO_PACKAGE_DECISION_REQUESTS', (readFileSync(absolute(`${OUT}/PRODUCT_OWNER_AUTHORITY_REVIEW_PACKAGE.md`), 'utf8').match(/APPROVE \/ REJECT \/ DEFER/g) ?? []).length === 3, true, true);
check('GUARDRAILS', Object.values(assessment.guardrails).join('|') === 'NONE|NONE|NONE|NO_CHANGE|NOT_EXECUTED|NOT_EXECUTED', assessment.guardrails, 'no mutation/promotion/runtime/apply/commit');

const after = verifyProtectedBaseline();
check('REGISTRY_UNCHANGED', before.registry.sha256 === after.registry.sha256 && after.registry.sha256 === BASELINE.registry.sha256, after.registry, BASELINE.registry);
check('ROUTING_VIEW_UNCHANGED', before.routingTollView.sha256 === after.routingTollView.sha256 && after.routingTollView.sha256 === BASELINE.routingTollView.sha256, after.routingTollView, BASELINE.routingTollView);
check('LEGISLATION_VIEW_UNCHANGED', before.legislationSafetyView.sha256 === after.legislationSafetyView.sha256 && after.legislationSafetyView.sha256 === BASELINE.legislationSafetyView.sha256, after.legislationSafetyView, BASELINE.legislationSafetyView);

const failed = checks.filter((item) => item.status === 'FAIL');
console.log(JSON.stringify({ validator: 'LEGAL-003_OWNER_REVIEW_READ_ONLY', result: failed.length ? 'FAIL' : 'PASS', passed: checks.length - failed.length, total: checks.length, checks }, null, 2));
if (failed.length) process.exit(1);
