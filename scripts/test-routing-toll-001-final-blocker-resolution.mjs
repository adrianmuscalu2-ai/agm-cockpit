import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const out = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION';
const expected = {
  registryCount: 831,
  registrySha256: 'f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d',
  viewCount: 279,
  viewSha256: '001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997',
};
const read = (relative) => readFileSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative).toString('utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashFile = (relative) => hash(read(relative));
const checks = [];
const check = (name, pass, actual, wanted) => checks.push({ name, pass: Boolean(pass), actual, expected: wanted });

const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const registry = json(registryPath);
const view = json(viewPath);
const resolution = json(`${out}/FINAL_BLOCKER_RESOLUTION_REPORT.json`);
const scope = json(`${out}/NIEUWERBRUG_OWNER_SCOPE_DECISION_PACKAGE.json`);
const status = json(`${out}/FINAL_BLOCKER_STATUS.json`);
const ownerReview = json(`${out}/OWNER_AUTHORITY_REVIEW_PACKAGE.json`);
const browser = json(`${out}/BROWSER_OFFICIAL_CAPTURE_REPORT.json`);
const gaps = json('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const basic = json('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/BASIC_LIBRARIAN_INTEGRITY.json');
const priorMatrix = json('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CONTINUATION_READ_ONLY/RESIDUAL_CLOSURE_MATRIX.json');
const runbook = read('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CONTINUATION_READ_ONLY/FRESHNESS_INVALIDATION_RUNBOOK_DRAFT.md').toString('utf8');
const officialResolvedCount = resolution.blockers.filter((item) => item.result === 'RESOLVED').length;
const officialBlocked = resolution.blockers.filter((item) => item.result === 'STILL_BLOCKED');
const officialBlockedCount = officialBlocked.length;

check('REGISTRY_COUNT', registry.sourceCount === expected.registryCount && registry.sources.length === expected.registryCount, `${registry.sourceCount}/${registry.sources.length}`, '831/831');
check('REGISTRY_HASH', hashFile(registryPath) === expected.registrySha256, hashFile(registryPath), expected.registrySha256);
check('VIEW_COUNT', view.sourceCount === expected.viewCount && view.memberships.length === expected.viewCount, `${view.sourceCount}/${view.memberships.length}`, '279/279');
check('VIEW_HASH', hashFile(viewPath) === expected.viewSha256, hashFile(viewPath), expected.viewSha256);
check('OFFICIAL_BLOCKER_SET_EXACT', resolution.blockers.length === 5 && officialResolvedCount + officialBlockedCount === 5 && officialBlockedCount <= 1 && officialBlocked.every((item) => item.artifactId === 'RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026'), resolution.blockers.map((item) => `${item.artifactId}:${item.result}`), '5 exact blockers / only Liefkenshoek may remain blocked');
check('NO_FALSE_LOCAL_ARTIFACT', resolution.blockers.filter((item) => item.result === 'STILL_BLOCKED').every((item) => item.artifactPath === null && item.sha256 === null), resolution.blockers.filter((item) => item.result === 'STILL_BLOCKED').map((item) => [item.artifactId, item.artifactPath, item.sha256]), 'unresolved all null');
const resolvedOwnerArtifact = resolution.blockers.find((item) => item.artifactId === 'RT001-FINAL-FR-ORDER-12-2026');
check('OWNER_ARTIFACT_01_RESOLVED', resolvedOwnerArtifact?.result === 'RESOLVED' && existsSync(path.join(root, resolvedOwnerArtifact.artifactPath)) && hashFile(resolvedOwnerArtifact.artifactPath) === resolvedOwnerArtifact.sha256 && resolvedOwnerArtifact.ingestionMethod === 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION', { result: resolvedOwnerArtifact?.result, hash: resolvedOwnerArtifact?.artifactPath ? hashFile(resolvedOwnerArtifact.artifactPath) : null, method: resolvedOwnerArtifact?.ingestionMethod }, { result: 'RESOLVED', hash: resolvedOwnerArtifact?.sha256, method: 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION' });
const resolvedSanefArtifact = resolution.blockers.find((item) => item.artifactId === 'RT001-FINAL-FR-SANEF-2026');
check('OWNER_ARTIFACT_02_RESOLVED', resolvedSanefArtifact?.result === 'RESOLVED' && existsSync(path.join(root, resolvedSanefArtifact.artifactPath)) && hashFile(resolvedSanefArtifact.artifactPath) === resolvedSanefArtifact.sha256 && resolvedSanefArtifact.ingestionMethod === 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION', { result: resolvedSanefArtifact?.result, hash: resolvedSanefArtifact?.artifactPath ? hashFile(resolvedSanefArtifact.artifactPath) : null, method: resolvedSanefArtifact?.ingestionMethod }, { result: 'RESOLVED', hash: resolvedSanefArtifact?.sha256, method: 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION' });
const resolvedSapnArtifact = resolution.blockers.find((item) => item.artifactId === 'RT001-FINAL-FR-SAPN-2026');
check('OWNER_ARTIFACT_03_RESOLVED', resolvedSapnArtifact?.result === 'RESOLVED' && existsSync(path.join(root, resolvedSapnArtifact.artifactPath)) && hashFile(resolvedSapnArtifact.artifactPath) === resolvedSapnArtifact.sha256 && resolvedSapnArtifact.ingestionMethod === 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION', { result: resolvedSapnArtifact?.result, hash: resolvedSapnArtifact?.artifactPath ? hashFile(resolvedSapnArtifact.artifactPath) : null, method: resolvedSapnArtifact?.ingestionMethod }, { result: 'RESOLVED', hash: resolvedSapnArtifact?.sha256, method: 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION' });
const resolvedCciseArtifact = resolution.blockers.find((item) => item.artifactId === 'RT001-FINAL-FR-CCISE-ORDER-2026');
check('OWNER_ARTIFACT_04_RESOLVED', resolvedCciseArtifact?.result === 'RESOLVED' && existsSync(path.join(root, resolvedCciseArtifact.artifactPath)) && hashFile(resolvedCciseArtifact.artifactPath) === resolvedCciseArtifact.sha256 && resolvedCciseArtifact.ingestionMethod === 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION', { result: resolvedCciseArtifact?.result, hash: resolvedCciseArtifact?.artifactPath ? hashFile(resolvedCciseArtifact.artifactPath) : null, method: resolvedCciseArtifact?.ingestionMethod }, { result: 'RESOLVED', hash: resolvedCciseArtifact?.sha256, method: 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION' });
const liefkenshoekArtifact = resolution.blockers.find((item) => item.artifactId === 'RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026');
const liefkenshoekResolved = liefkenshoekArtifact?.result === 'RESOLVED';
check('OWNER_ARTIFACT_05_STATE', liefkenshoekResolved
  ? existsSync(path.join(root, liefkenshoekArtifact.artifactPath)) && hashFile(liefkenshoekArtifact.artifactPath) === liefkenshoekArtifact.sha256 && liefkenshoekArtifact.ingestionMethod === 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION'
  : liefkenshoekArtifact?.artifactPath === null && liefkenshoekArtifact?.sha256 === null,
{ result: liefkenshoekArtifact?.result, hash: liefkenshoekArtifact?.artifactPath ? hashFile(liefkenshoekArtifact.artifactPath) : null, method: liefkenshoekArtifact?.ingestionMethod },
liefkenshoekResolved ? { result: 'RESOLVED', hash: liefkenshoekArtifact?.sha256, method: 'OWNER_ASSISTED_MANUAL_EVIDENCE_INGESTION' } : { result: 'STILL_BLOCKED', hash: null });
check('OFFICIAL_METHODS_EXHAUSTED', resolution.blockers.every((item) => item.methodsAttempted.length === 3 && item.methodsAttempted.some((attempt) => attempt.method.includes('PLAYWRIGHT'))), resolution.blockers.map((item) => item.methodsAttempted.length), '3 methods each including controlled Playwright');
check('NO_UNOFFICIAL_SUBSTITUTE', resolution.guardrails.unofficialCopiesUsed === false && resolution.guardrails.thirdPartyCachesUsedAsAuthority === false && resolution.guardrails.ocrOrReconstructionUsed === false, resolution.guardrails, 'all false');
check('BROWSER_CAPTURE_0_OF_5', browser.summary.attempted === 5 && browser.summary.resolved === 0 && browser.summary.blocked === 5, browser.summary, { attempted: 5, resolved: 0, blocked: 5 });
for (const item of browser.results) {
  check(`BROWSER_EVIDENCE_${item.artifactId}`, item.status === 'STILL_BLOCKED' && item.sha256 === null && existsSync(path.join(root, resolution.blockers.find((blocker) => blocker.artifactId === item.artifactId).screenshot)), { status: item.status, sha256: item.sha256, screenshot: resolution.blockers.find((blocker) => blocker.artifactId === item.artifactId).screenshot }, 'STILL_BLOCKED/null hash/screenshot present');
}

check('NIEUWERBRUG_TWO_OPTIONS', scope.options.length === 2 && scope.options[0].option === 'OPTION_1_IN_SCOPE' && scope.options[1].option === 'OPTION_2_OUT_OF_SCOPE', scope.options.map((item) => item.option), ['OPTION_1_IN_SCOPE', 'OPTION_2_OUT_OF_SCOPE']);
check('NIEUWERBRUG_OWNER_OUT_OF_SCOPE', scope.decision === 'OUT_OF_SCOPE_BY_PRODUCT_OWNER' && scope.aiDecision === 'NONE' && scope.options[1].ownerDecision === 'APPROVED_BY_PRODUCT_OWNER', `${scope.decision}/${scope.aiDecision}/${scope.options[1].ownerDecision}`, 'OUT_OF_SCOPE_BY_PRODUCT_OWNER/NONE/APPROVED_BY_PRODUCT_OWNER');
check('NIEUWERBRUG_CURRENT_ARTIFACT', existsSync(path.join(root, scope.item.currentEvidence.artifactPath)) && hashFile(scope.item.currentEvidence.artifactPath) === scope.item.currentEvidence.sha256, hashFile(scope.item.currentEvidence.artifactPath), scope.item.currentEvidence.sha256);
check('UNKNOWN_INVARIANT_PRESERVED', scope.options[1].functionalImpact.includes('UNKNOWN') && scope.options[1].functionalImpact.includes('zero toll'), scope.options[1].functionalImpact, 'UNKNOWN and no zero-toll inference');
const expectedCurrentIntegrity = officialBlockedCount === 0 ? '8/8' : '7/8';
check('FACILITIES_DENOMINATOR_8', scope.decisionConsequences.facilitiesDenominatorBefore === 9 && scope.decisionConsequences.facilitiesDenominatorAfter === 8 && scope.decisionConsequences.currentIntegrity === expectedCurrentIntegrity && scope.decisionConsequences.fieldEncounterRule === 'UNKNOWN_TO_HUMAN_CONFIRMATION' && scope.decisionConsequences.zeroTollInference === 'FORBIDDEN', scope.decisionConsequences, { before: 9, after: 8, integrity: expectedCurrentIntegrity, fieldRule: 'UNKNOWN_TO_HUMAN_CONFIRMATION', zero: 'FORBIDDEN' });

for (const candidate of ownerReview.candidates) {
  check(`OWNER_PENDING_${candidate.candidateId}`, candidate.decisionStatus === 'PENDING_PRODUCT_OWNER_AUTHORITY_REVIEW' && candidate.authorityPromotion === 'NONE' && existsSync(path.join(root, candidate.artifact.canonicalPath)) && hashFile(candidate.artifact.canonicalPath) === candidate.artifact.sha256, { decision: candidate.decisionStatus, promotion: candidate.authorityPromotion, hash: hashFile(candidate.artifact.canonicalPath) }, { decision: 'PENDING_PRODUCT_OWNER_AUTHORITY_REVIEW', promotion: 'NONE', hash: candidate.artifact.sha256 });
}
check('OWNER_PACKAGE_10_PENDING', ownerReview.summary.total === 10 && ownerReview.summary.integrityVerified === 10 && ownerReview.summary.pending === 10 && ownerReview.summary.approved === 0, ownerReview.summary, { total: 10, integrityVerified: 10, pending: 10, approved: 0 });

for (const item of basic.checks) {
  check(`BASIC_${item.path}`, hashFile(item.path) === item.expectedSha256, hashFile(item.path), item.expectedSha256);
}
for (const gapId of ['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']) {
  check(`${gapId}_OPEN`, gaps.gaps.find((item) => item.gapId === gapId)?.state === 'OPEN', gaps.gaps.find((item) => item.gapId === gapId)?.state, 'OPEN');
}
check('RT001_RES008_CLOSED', priorMatrix.items.find((item) => item.id === 'RT001-RES-008')?.currentStatus === 'PASS_CLOSED_BY_PRODUCT_OWNER_16_OF_16', priorMatrix.items.find((item) => item.id === 'RT001-RES-008')?.currentStatus, 'PASS_CLOSED_BY_PRODUCT_OWNER_16_OF_16');
check('RUNBOOK_DRAFT', runbook.includes('DRAFT / OWNER REVIEW REQUIRED / NOT OPERATIONAL') && runbook.includes('UNKNOWN != ZERO') && runbook.includes('No universal fixed interval is declared authoritative'), 'DRAFT_SAFETY_GATES_PRESENT', 'DRAFT_SAFETY_GATES_PRESENT');
check('NO_MUTATIONS', resolution.guardrails.registryMutation === 'NONE' && resolution.guardrails.viewMutation === 'NONE' && resolution.guardrails.authorityPromotion === 'NONE' && scope.registryMutation === 'NONE' && scope.viewMutation === 'NONE', { resolution: resolution.guardrails, scope: { registry: scope.registryMutation, view: scope.viewMutation } }, 'NONE');
const expectedStatusVerdict = officialBlockedCount === 0 ? 'READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW' : 'BLOCKED';
const expectedRoutingState = officialBlockedCount === 0 ? 'OPEN_READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW' : 'OPEN_PARTIALLY_READY';
check('FINAL_STATUS', status.verdict === expectedStatusVerdict && status.officialEvidenceBlockersResolved === officialResolvedCount && status.officialEvidenceBlockersRemaining === officialBlockedCount && status.nieuwerbrugScopeDecision === 'OUT_OF_SCOPE_BY_PRODUCT_OWNER' && status.routingToll001 === expectedRoutingState, status, `${expectedStatusVerdict} / ${officialResolvedCount} resolved / ${officialBlockedCount} evidence / Nieuwerbrug out of scope / ${expectedRoutingState}`);

const derived = ['FINAL_BLOCKER_RESOLUTION_REPORT.json', 'NIEUWERBRUG_OWNER_SCOPE_DECISION_PACKAGE.json', 'FINAL_BLOCKER_STATUS.json'];
const before = Object.fromEntries(derived.map((file) => [file, hashFile(`${out}/${file}`)]));
const first = spawnSync(process.execPath, ['scripts/build-routing-toll-001-final-blocker-resolution.mjs'], { cwd: root, encoding: 'utf8' });
const afterFirst = Object.fromEntries(derived.map((file) => [file, hashFile(`${out}/${file}`)]));
const second = spawnSync(process.execPath, ['scripts/build-routing-toll-001-final-blocker-resolution.mjs'], { cwd: root, encoding: 'utf8' });
const afterSecond = Object.fromEntries(derived.map((file) => [file, hashFile(`${out}/${file}`)]));
const idempotent = first.status === 0 && second.status === 0 && JSON.stringify(before) === JSON.stringify(afterFirst) && JSON.stringify(afterFirst) === JSON.stringify(afterSecond);
check('GENERATOR_IDEMPOTENCE', idempotent, { firstExit: first.status, secondExit: second.status, hashes: afterSecond }, 'PASS / identical hashes');

const failed = checks.filter((item) => !item.pass);
const report = {
  schemaVersion: 'agm-routing-toll-001-final-blocker-validation.v1',
  generatedAt: new Date().toISOString(),
  validatorVerdict: failed.length === 0 ? 'PASS' : 'FAIL',
  closureVerdict: status.verdict,
  checkCount: checks.length,
  failedCount: failed.length,
  checks,
  baseline: {
    registry: { count: registry.sourceCount, sha256: hashFile(registryPath) },
    routingTollView: { count: view.sourceCount, sha256: hashFile(viewPath) },
    basicLibrarian: '3/3_MATCH',
    legal003: 'OPEN_UNCHANGED',
    legal005: 'OPEN_UNCHANGED',
    runtimeProductionTurnApplicationApi: 'NO_CHANGE',
    commitPush: 'NOT_EXECUTED',
  },
  blockerState: { officialEvidenceResolved: status.officialEvidenceBlockersResolved, officialEvidenceRemaining: status.officialEvidenceBlockersRemaining, nieuwerbrugDecision: scope.decision, ownerAuthorityPending: 10 },
  idempotence: { pass: idempotent, hashes: afterSecond },
};
writeFileSync(path.join(root, out, 'FINAL_BLOCKER_VALIDATION_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ validator: report.validatorVerdict, checks: report.checkCount, failed: report.failedCount, closure: report.closureVerdict, blockerState: report.blockerState, baseline: report.baseline, idempotence: report.idempotence.pass }, null, 2));
if (failed.length) process.exitCode = 1;
