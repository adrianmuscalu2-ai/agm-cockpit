import { existsSync, readFileSync } from 'node:fs';
import { BASELINE, absolute, readJson, sha256, verifyProtectedBaseline } from './legal-gap-owner-review-common.mjs';

const OUT = 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW';
const checks = [];
const check = (id, condition, actual, expected) => checks.push({ id, status: condition ? 'PASS' : 'FAIL', actual, expected });
const before = verifyProtectedBaseline();
const assessment = readJson(`${OUT}/AS_IS_ASSESSMENT.json`);
const matrix = readJson(`${OUT}/RESIDUAL_CLOSURE_MATRIX.json`);
const manifest = readJson(`${OUT}/EVIDENCE_MANIFEST.json`);
const packageData = readJson(`${OUT}/CANDIDATE_AUTHORITY_PACKAGE.json`);
const manual = readJson(`${OUT}/OWNER_MANUAL_INGEST_MANIFEST.json`);
const resolvedManualCount = manual.artifacts.filter((item) => item.status === 'RESOLVED_VALIDATED').length;
const remainingManualCount = manual.artifacts.length - resolvedManualCount;
const allManualResolved = remainingManualCount === 0;
const registry = readJson(BASELINE.registry.path);
const registryIds = new Set(registry.sources.map((item) => item.sourceId));
const candidates = packageData.candidates;
const artifact = (id) => manifest.artifacts.find((item) => item.evidenceId === id);
const candidate = (id) => candidates.find((item) => item.sourceId === id);
const text = (id) => readFileSync(absolute(artifact(id).path), 'utf8');
const pdfPages = (id) => (readFileSync(absolute(artifact(id).path)).toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;

check('GAP_ID', assessment.gapId === 'LEGAL-005', assessment.gapId, 'LEGAL-005');
check('STATUS_MATCHES_MANUAL_INGEST', assessment.verdict === (allManualResolved ? 'READY_FOR_PRODUCT_OWNER_AUTHORITY_REVIEW' : 'PARTIALLY_READY_BLOCKED'), assessment.verdict, allManualResolved ? 'READY_FOR_PRODUCT_OWNER_AUTHORITY_REVIEW' : 'PARTIALLY_READY_BLOCKED');
check('COVERAGE_20_OF_20', assessment.coverage.ratio === '20/20', assessment.coverage, '20/20');
check('OFFICIAL_EVIDENCE_MATCHES_INGEST', assessment.officialEvidence.ratio === (allManualResolved ? '20/20' : '19/20'), assessment.officialEvidence, allManualResolved ? '20/20' : '19/20');
check('EXACT_BLOCKERS_MATCH_INGEST', JSON.stringify(assessment.blockers) === JSON.stringify(allManualResolved ? [] : ['FR_OWNER_MANUAL_INGEST_REQUIRED']), assessment.blockers, allManualResolved ? [] : ['FR_OWNER_MANUAL_INGEST_REQUIRED']);
check('FOUR_SCOPE_BLOCKERS_RESOLVED', assessment.resolvedScopeBlockers.length === 4, assessment.resolvedScopeBlockers, 4);
check('MATRIX_20_UNITS', matrix.coverageUnits.length === 20, matrix.coverageUnits.length, 20);
check('MATRIX_10_JURISDICTIONS', new Set(matrix.coverageUnits.map((item) => item.jurisdiction)).size === 10, [...new Set(matrix.coverageUnits.map((item) => item.jurisdiction))], 10);
check('NO_UNRESOLVED_COVERAGE_UNITS', matrix.summary.unresolvedCoverageUnits.length === 0, matrix.summary.unresolvedCoverageUnits, []);
check('FR_PREAPPLY_BLOCKER_MATCHES_INGEST', JSON.stringify(matrix.summary.preApplyEvidenceBlockers) === JSON.stringify(allManualResolved ? [] : ['FR_OWNER_MANUAL_INGEST_REQUIRED']), matrix.summary.preApplyEvidenceBlockers, allManualResolved ? [] : ['FR_OWNER_MANUAL_INGEST_REQUIRED']);
check('CH_TWO_UNITS_DEMONSTRATED', matrix.coverageUnits.filter((item) => item.jurisdiction === 'CH').every((item) => item.evidenceStatus.startsWith('DEMONSTRATED')), matrix.coverageUnits.filter((item) => item.jurisdiction === 'CH'), 'both demonstrated');
check('BE_SCOPE_STRUCTURE_DEMONSTRATED', matrix.coverageUnits.find((item) => item.requirementId === 'LEGAL005-R09')?.evidenceStatus === 'DEMONSTRATED_JURISDICTION_STRUCTURE', matrix.coverageUnits.find((item) => item.requirementId === 'LEGAL005-R09'), 'DEMONSTRATED_JURISDICTION_STRUCTURE');
check('NL_FRAMEWORK_DEMONSTRATED', matrix.coverageUnits.find((item) => item.requirementId === 'LEGAL005-R11')?.evidenceStatus === 'DEMONSTRATED_NATIONAL_FRAMEWORK_LOCAL_APPLICATION', matrix.coverageUnits.find((item) => item.requirementId === 'LEGAL005-R11'), 'framework/local');
check('DK_FRAMEWORK_DEMONSTRATED', matrix.coverageUnits.find((item) => item.requirementId === 'LEGAL005-R19')?.evidenceStatus === 'DEMONSTRATED_NATIONAL_FRAMEWORK_LOCAL_APPLICATION', matrix.coverageUnits.find((item) => item.requirementId === 'LEGAL005-R19'), 'framework/local');

check('EVIDENCE_REPRESENTATIONS_36', manifest.artifacts.length === 36, manifest.artifacts.length, 36);
check('LOCAL_EVIDENCE_PASS_DYNAMIC', manifest.artifacts.filter((item) => item.localValidation === 'PASS').length === 33 + resolvedManualCount, manifest.artifacts.filter((item) => item.localValidation !== 'PASS').map((item) => ({ id: item.evidenceId, status: item.localValidation })), 33 + resolvedManualCount);
check('FR_MANUAL_CAPTURE_REMAINING', manifest.manualCaptureRequired.length === remainingManualCount && manifest.manualCaptureRequired.every((id) => id.startsWith('L005-EV-FR-')), manifest.manualCaptureRequired, remainingManualCount);
check('NO_CAPTURED_BLOCK_PAGE', manifest.artifacts.every((item) => item.localValidation !== 'FAIL_BLOCK_PAGE'), manifest.artifacts.filter((item) => item.localValidation === 'FAIL_BLOCK_PAGE'), 'none');
check('LOCAL_HASHES_RECOMPUTE', manifest.artifacts.filter((item) => item.path).every((item) => sha256(item.path) === item.sha256), manifest.artifacts.filter((item) => item.path).map((item) => item.evidenceId), 'all match');
check('OFFICIAL_PROVENANCE', manifest.artifacts.every((item) => /^https:\/\//.test(item.officialUrl) && item.authority), manifest.artifacts.map((item) => item.officialUrl), 'official HTTPS URL + authority');
check('FR_SHA_ABSENT_NOT_INVENTED', manifest.artifacts.filter((item) => item.status.startsWith('OWNER_MANUAL_CAPTURE_REQUIRED')).every((item) => item.sha256 === null && item.path === null), manifest.artifacts.filter((item) => item.status.startsWith('OWNER_MANUAL_CAPTURE_REQUIRED')), 'null path/hash');

check('CH_VRV_HASH', artifact('L005-EV-CH-VRV-20260701')?.sha256 === '27a366424a1c7c156ffe280a181291947ba7b1ca38a506b2d9f24d6e94571a46', artifact('L005-EV-CH-VRV-20260701')?.sha256, '27a366...71a46');
check('CH_ARV1_HASH', artifact('L005-EV-CH-ARV1-20250501')?.sha256 === '2aae76853d279778352e14ac98006161e9847b9e0be69e10b11d522c6dbd1edb', artifact('L005-EV-CH-ARV1-20250501')?.sha256, '2aae76...d1edb');
check('CH_VRV_70_PAGES', pdfPages('L005-EV-CH-VRV-20260701') === 70, pdfPages('L005-EV-CH-VRV-20260701'), 70);
check('CH_ARV1_30_PAGES', pdfPages('L005-EV-CH-ARV1-20250501') === 30, pdfPages('L005-EV-CH-ARV1-20250501'), 30);
check('CH_ASTRA_SUPPORT_CAPTURED', ['L005-EV-CH-ASTRA-SONNTAG-NACHT','L005-EV-CH-ASTRA-VRV-CHANGE-20260701','L005-EV-CH-ASTRA-ARV1-CHANGE-20261001'].every((id) => artifact(id)?.localValidation === 'PASS'), ['L005-EV-CH-ASTRA-SONNTAG-NACHT','L005-EV-CH-ASTRA-VRV-CHANGE-20260701','L005-EV-CH-ASTRA-ARV1-CHANGE-20261001'].map((id) => artifact(id)?.localValidation), 'all PASS');

check('BE_COMPETENCE_MARKER', /compétence partagée|partagent les compétences/i.test(text('L005-EV-BE-FED-REGIONAL-COMPETENCE')), true, true);
check('BE_FLANDERS_HGV_MARKER', /vrachtwagens \(categorie N2 of N3\)/i.test(text('L005-EV-BE-FLANDERS-LEZ')), true, true);
check('BE_BRUSSELS_HGV_MARKER', /poids lourds|camions/i.test(text('L005-EV-BE-BRUSSELS-LEZ')), true, true);
check('BE_WALLONIA_PRIMARY_MARKER', /2019200758|zone.{0,40}basses émissions/is.test(text('L005-EV-BE-WALLONIA-LEZ')), true, true);
check('NL_RVV_MARKERS', /86e/i.test(text('L005-EV-NL-RVV-20260701')) && /C22c/i.test(text('L005-EV-NL-RVV-20260701')), true, true);
check('NL_RVO_LOCAL_SCOPE_MARKER', /Municipalities in the Netherlands can designate/i.test(text('L005-EV-NL-RVO-ZEZ')), true, true);
check('DK_REG_HASH', artifact('L005-EV-DK-ENV-REG-588')?.sha256 === '7d64ef8fac4128b1dbaaf33d30f8130b24539bc266244422ef264235c6a1e455', artifact('L005-EV-DK-ENV-REG-588')?.sha256, '7d64ef...1e455');
check('DK_REG_8_PAGES', pdfPages('L005-EV-DK-ENV-REG-588') === 8, pdfPages('L005-EV-DK-ENV-REG-588'), 8);
check('DK_PORTAL_HGV_MARKER', /trucks|lorries|lastbiler/i.test(text('L005-EV-DK-ENV-ZONES-PORTAL')) && /Euro VI/i.test(text('L005-EV-DK-ENV-ZONES-PORTAL')), true, true);

check('CANDIDATE_COUNT_23', candidates.length === 23 && packageData.candidateCount === 23, candidates.length, 23);
check('UNIQUE_CANDIDATE_SOURCE_IDS', new Set(candidates.map((item) => item.sourceId)).size === 23, candidates.map((item) => item.sourceId), '23 unique');
check('CLASSIFICATION_SPLIT_21_2', packageData.classificationSummary.AUTHORITATIVE_WITH_SCOPE === 21 && packageData.classificationSummary.CONTEXTUAL === 2, packageData.classificationSummary, '21 scoped authoritative + 2 contextual');
check('NO_ASSUMED_APPROVAL', candidates.every((item) => item.decisionStatus === 'PENDING_PRODUCT_OWNER'), candidates.map((item) => item.decisionStatus), 'all pending');
check('ONLY_TWO_REGISTRY_REUSES', candidates.filter((item) => registryIds.has(item.sourceId)).map((item) => item.sourceId).sort().join('|') === 'CS-DE-STVO|CS-EU-REG-561-2006', candidates.filter((item) => registryIds.has(item.sourceId)).map((item) => item.sourceId), ['CS-DE-STVO','CS-EU-REG-561-2006']);
check('CH_TWO_CANDIDATES', candidates.filter((item) => item.country === 'CH').length === 2, candidates.filter((item) => item.country === 'CH').map((item) => item.sourceId), 2);
check('BE_THREE_SCOPED_CANDIDATES', ['CS-BE-VLAANDEREN-LEZ-CURRENT','CS-BE-BRUSSELS-LEZ-CURRENT','CS-BE-WALLONIA-LEZ-FRAMEWORK'].every((id) => candidate(id)?.proposedClassification === 'AUTHORITATIVE_WITH_SCOPE'), ['CS-BE-VLAANDEREN-LEZ-CURRENT','CS-BE-BRUSSELS-LEZ-CURRENT','CS-BE-WALLONIA-LEZ-FRAMEWORK'].map((id) => candidate(id)?.proposedClassification), 'all scoped');
check('NO_BE_NATIONWIDE_INFERENCE', candidates.filter((item) => item.country.startsWith('BE-')).every((item) => item.limitations.some((value) => /not federal|not nationwide|No conclusion/i.test(value))), candidates.filter((item) => item.country.startsWith('BE-')).map((item) => item.limitations), 'all jurisdiction limited');
check('NL_NO_BLANKET_INFERENCE', candidate('CS-NL-RVV-HGV-ACCESS-20260701')?.limitations.some((item) => /No blanket/i.test(item)), candidate('CS-NL-RVV-HGV-ACCESS-20260701')?.limitations, 'explicit');
check('DK_NO_KMTOLL_REUSE', candidate('CS-DK-ENV-ZONE-REG-2026-588')?.limitations.some((item) => /KmToll authority is not reused/i.test(item)), candidate('CS-DK-ENV-ZONE-REG-2026-588')?.limitations, 'explicit');
check('DK_SCOPE_SEPARATION', candidate('CS-DK-ENV-ZONE-REG-2026-588')?.limitations.some((item) => /Temporary traffic controls and bridge-specific/i.test(item)), candidate('CS-DK-ENV-ZONE-REG-2026-588')?.limitations, 'temporary/local/bridge separate');
check('CH_ARV1_NEW_VERSION_TRIGGER', candidate('CS-CH-ARV1-20250501')?.freshness.currentStatus === 'NEW_VERSION_DETECTED' && candidate('CS-CH-ARV1-20250501')?.freshness.effectiveUntil === '2026-09-30' && candidate('CS-CH-ARV1-20250501')?.freshness.reviewRequired === true, candidate('CS-CH-ARV1-20250501')?.freshness, 'known 2026-10-01 change');
check('FRESHNESS_SCHEMA_READY', candidates.every((item) => item.freshness.policyVersion === 'agm-source-freshness.v1' && 'lastFreshnessCheck' in item.freshness && 'nextFreshnessCheck' in item.freshness && 'reviewRequired' in item.freshness), candidates.map((item) => item.freshness.policyVersion), 'all agm-source-freshness.v1');
check('UNKNOWN_OR_EXPIRED_NEVER_ZERO', candidates.every((item) => !/ZERO/.test(item.freshness.usageFallback)), candidates.map((item) => item.freshness.usageFallback), 'no ZERO');

const france = candidates.filter((item) => item.country === 'FR');
check('FR_APPLY_ELIGIBILITY_MATCHES_INGEST', france.length === 3 && france.every((item) => {
  const metadata = manual.artifacts.find((artifactItem) => artifactItem.sourceId === item.sourceId);
  return metadata.status === 'RESOLVED_VALIDATED'
    ? item.applyEligibility === 'ELIGIBLE_AFTER_PRODUCT_OWNER_APPROVAL' && item.documentEvidence.sha256 === metadata.sha256
    : item.applyEligibility === 'BLOCKED_BY_OWNER_MANUAL_CAPTURE' && item.documentEvidence.sha256 === null;
}), france.map((item) => ({ id: item.sourceId, eligibility: item.applyEligibility, sha: item.documentEvidence.sha256 })), `${resolvedManualCount} resolved / ${remainingManualCount} blocked`);
const fire = candidate('CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026');
check('FR_FIRE_EXPIRY_WARNING', fire?.freshness.currentStatus === 'EXPIRY_WARNING' && fire.freshness.effectiveUntil === '2026-08-31' && fire.freshness.reviewRequired === true, fire?.freshness, 'EXPIRY_WARNING through 2026-08-31');
check('MANUAL_MANIFEST_3', manual.artifacts.length === 3 && manual.status === (allManualResolved ? 'READY_FOR_PRODUCT_OWNER_AUTHORITY_REVIEW' : 'FR_OWNER_MANUAL_INGEST_REQUIRED'), { count: manual.artifacts.length, status: manual.status }, `3 total / ${remainingManualCount} pending`);
check('MANUAL_IDENTIFIERS_EXACT', manual.artifacts.map((item) => item.textId).join('|') === 'JORFTEXT000043416004|JORFTEXT000053324056|JORFTEXT000054633358', manual.artifacts.map((item) => item.textId), 'three exact IDs');
check('MANUAL_NORS_EXACT', manual.artifacts.map((item) => item.nor).join('|') === 'TRAT2031119A|TRAT2529272A|TRAT2621637A', manual.artifacts.map((item) => item.nor), 'three exact NORs');
check('MANUAL_FILENAMES_EXACT', manual.artifacts.map((item) => item.filename).join('|') === 'LEGAL005-FR-BASE-2021.owner-official.pdf|LEGAL005-FR-ANNUAL-2026.owner-official.pdf|LEGAL005-FR-FIRE-DEROGATION-2026.owner-official.pdf', manual.artifacts.map((item) => item.filename), 'canonical filenames');
check('MANUAL_EXPECTED_PAGES', manual.artifacts.map((item) => item.expectedPages).join('|') === '7|2|2', manual.artifacts.map((item) => item.expectedPages), [7,2,2]);
check('MANUAL_FILE_STATE_EXACT', manual.artifacts.every((item) => {
  const fileExists = existsSync(absolute(`${OUT}/OWNER_MANUAL_INGEST/${item.filename}`));
  return item.status === 'RESOLVED_VALIDATED'
    ? fileExists && sha256(`${OUT}/OWNER_MANUAL_INGEST/${item.filename}`) === item.sha256
    : !fileExists && item.status.startsWith('PENDING_OWNER_MANUAL_INGEST');
}), manual.artifacts.map((item) => ({ filename: item.filename, status: item.status })), 'resolved files present/hash-matched; pending files absent');
check('FIRE_EXPIRY_TRANSITION_EXPLICIT', /EXPIRED_REVIEW_REQUIRED/.test(manual.artifacts.find((item) => item.sourceId === 'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026').expiryTransition), manual.artifacts.find((item) => item.sourceId === 'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026').expiryTransition, 'EXPIRED_REVIEW_REQUIRED');
check('AUTHENTICATED_EXTRACT_REQUIRED', /Extrait du Journal officiel électronique authentifié/.test(readFileSync(absolute(`${OUT}/OWNER_MANUAL_INGEST/01_CS-FR-TRUCK-BAN-BASE-2021_CHECKLIST.md`), 'utf8')), true, true);
check('PO_PACKAGE_DECISION_REQUESTS', (readFileSync(absolute(`${OUT}/PRODUCT_OWNER_AUTHORITY_REVIEW_PACKAGE.md`), 'utf8').match(/APPROVE \/ REJECT \/ DEFER/g) ?? []).length === 23, true, true);

check('ELIGIBLE_IMPACT_EXACT', JSON.stringify(packageData.projectedImpact.currentlyApplyEligibleIfApproved) === JSON.stringify({ registryAdd:18 + resolvedManualCount, legislationSafetyViewAdd:19 + resolvedManualCount, registryModify:0, delete:0, projectedRegistryCount:859 + resolvedManualCount, projectedLegislationSafetyViewCount:63 + resolvedManualCount }), packageData.projectedImpact.currentlyApplyEligibleIfApproved, `${18 + resolvedManualCount} registry / ${19 + resolvedManualCount} view`);
check('ALL_CONDITIONAL_IMPACT_EXACT', packageData.projectedImpact.allCandidatesAfterAllConditions.registryAdd === 21 && packageData.projectedImpact.allCandidatesAfterAllConditions.legislationSafetyViewAdd === 22, packageData.projectedImpact.allCandidatesAfterAllConditions, '21 registry / 22 view');
check('GUARDRAILS', Object.values(assessment.guardrails).join('|') === 'NONE|NONE|NONE|NO_CHANGE|NOT_EXECUTED|NOT_EXECUTED', assessment.guardrails, 'no mutation/promotion/runtime/apply/commit');

const after = verifyProtectedBaseline();
check('REGISTRY_UNCHANGED', before.registry.sha256 === after.registry.sha256 && after.registry.sha256 === BASELINE.registry.sha256, after.registry, BASELINE.registry);
check('ROUTING_VIEW_UNCHANGED', before.routingTollView.sha256 === after.routingTollView.sha256 && after.routingTollView.sha256 === BASELINE.routingTollView.sha256, after.routingTollView, BASELINE.routingTollView);
check('LEGISLATION_VIEW_UNCHANGED', before.legislationSafetyView.sha256 === after.legislationSafetyView.sha256 && after.legislationSafetyView.sha256 === BASELINE.legislationSafetyView.sha256, after.legislationSafetyView, BASELINE.legislationSafetyView);

const failed = checks.filter((item) => item.status === 'FAIL');
console.log(JSON.stringify({ validator: 'LEGAL-005_FINAL_BLOCKER_RESOLUTION_READ_ONLY', result: failed.length ? 'FAIL' : 'PASS', passed: checks.length - failed.length, total: checks.length, checks }, null, 2));
if (failed.length) process.exit(1);
