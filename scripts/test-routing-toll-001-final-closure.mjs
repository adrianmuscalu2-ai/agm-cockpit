import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const out = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const expected = {
  registryCount: 831,
  registrySha256: 'f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d',
  viewCount: 279,
  viewSha256: '001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997',
};
const derivedFiles = [
  'FRANCE_OFFICIAL_CONCESSION_COVERAGE.json',
  'FACILITIES_SCOPE_INTEGRITY_MATRIX.json',
  'OWNER_AUTHORITY_REVIEW_PACKAGE.json',
  'UNRESOLVED_BLOCKERS.json',
  'FINAL_CLOSURE_ACQUISITION_REPORT.md',
];
const read = (relative) => readFileSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative).toString('utf8'));
const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashFile = (relative) => hashBytes(read(relative));
const checks = [];
const check = (name, pass, actual, wanted) => checks.push({ name, pass: Boolean(pass), actual, expected: wanted });

const registry = json(registryPath);
const view = json(viewPath);
const acquisition = json(`${out}/FINAL_CLOSURE_ACQUISITION_MANIFEST.json`);
const france = json(`${out}/FRANCE_OFFICIAL_CONCESSION_COVERAGE.json`);
const facilities = json(`${out}/FACILITIES_SCOPE_INTEGRITY_MATRIX.json`);
const ownerReview = json(`${out}/OWNER_AUTHORITY_REVIEW_PACKAGE.json`);
const blockers = json(`${out}/UNRESOLVED_BLOCKERS.json`);
const priorResidualMatrix = json('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CONTINUATION_READ_ONLY/RESIDUAL_CLOSURE_MATRIX.json');
const gaps = json('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const basic = json('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/BASIC_LIBRARIAN_INTEGRITY.json');
const runbookPath = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CONTINUATION_READ_ONLY/FRESHNESS_INVALIDATION_RUNBOOK_DRAFT.md';
const runbook = read(runbookPath).toString('utf8');

check('REGISTRY_COUNT_831', registry.sourceCount === expected.registryCount && registry.sources.length === expected.registryCount, `${registry.sourceCount}/${registry.sources.length}`, '831/831');
check('REGISTRY_SHA_UNCHANGED', hashFile(registryPath) === expected.registrySha256, hashFile(registryPath), expected.registrySha256);
check('VIEW_COUNT_279', view.sourceCount === expected.viewCount && view.memberships.length === expected.viewCount, `${view.sourceCount}/${view.memberships.length}`, '279/279');
check('VIEW_SHA_UNCHANGED', hashFile(viewPath) === expected.viewSha256, hashFile(viewPath), expected.viewSha256);
check('ACQUISITION_SCOPE', acquisition.summary.requested === 23 && acquisition.registryMutation === 'NONE' && acquisition.viewMutation === 'NONE' && acquisition.authorityPromotion === 'NONE', acquisition.summary, { requested: 23, mutations: 'NONE' });

for (const item of acquisition.items.filter((entry) => entry.status === 'INTEGRITY_CAPTURED_REVIEW_ONLY')) {
  check(`ARTIFACT_${item.artifactId}`, Boolean(item.canonicalPath) && existsSync(path.join(root, item.canonicalPath)) && hashFile(item.canonicalPath) === item.sha256, item.canonicalPath && existsSync(path.join(root, item.canonicalPath)) ? hashFile(item.canonicalPath) : 'MISSING', item.sha256);
}
const blockedIds = acquisition.items.filter((item) => item.status === 'INTEGRITY_BLOCKED').map((item) => item.artifactId).sort();
const liefkenshoekCaptured = acquisition.items.find((item) => item.artifactId === 'RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026')?.status === 'INTEGRITY_CAPTURED_REVIEW_ONLY';
const expectedBlockedIds = liefkenshoekCaptured ? [] : ['RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026'];
check('OFFICIAL_CAPTURE_BLOCKS_EXPLICIT', JSON.stringify(blockedIds) === JSON.stringify(expectedBlockedIds), blockedIds, expectedBlockedIds);

check('FRANCE_ENTITY_INVENTORY_22_22', france.summary.entitiesAccounted === 22 && france.summary.entitiesTotal === 22, `${france.summary.entitiesAccounted}/${france.summary.entitiesTotal}`, '22/22');
check('FRANCE_REGIME_MAPPING_26_26', france.summary.regimesAccounted === 26 && france.summary.regimesTotal === 26, `${france.summary.regimesAccounted}/${france.summary.regimesTotal}`, '26/26');
check('FRANCE_EXACT_EVIDENCE_STATUS', france.summary.captured === 24 && france.summary.notApplicableWithEvidence === 2 && france.summary.integrityBlocked === 0 && france.summary.integrityComplete === true, france.summary, { captured: 24, notApplicable: 2, blocked: 0, complete: true });
check('FRANCE_NO_EXTRAPOLATION', france.regimes.length === 26 && france.regimes.every((item) => item.authorityPromotion === 'NONE_REVIEW_ONLY' && item.tariffOrApplicabilityEvidenceId), france.regimes.length, 26);

check('FACILITY_INVENTORY_9_PRESERVED_SCOPE_8', facilities.summary.inventoryAccounted === 9 && facilities.summary.inventoryTotal === 9 && facilities.summary.accounted === 8 && facilities.summary.total === 8 && facilities.summary.outOfScopeByOwner === 1, facilities.summary, { inventory: '9/9', scope: '8/8', outOfScope: 1 });
const expectedFacilityIntegrity = liefkenshoekCaptured ? { complete: 8, blocked: 0, status: 'CAPTURED' } : { complete: 7, blocked: 1, status: 'BLOCKED' };
check('FACILITY_INTEGRITY_8', facilities.summary.integrityComplete === expectedFacilityIntegrity.complete && facilities.summary.integrityBlocked === expectedFacilityIntegrity.blocked, `${facilities.summary.integrityComplete}/8 blocked=${facilities.summary.integrityBlocked}`, `${expectedFacilityIntegrity.complete}/8 blocked=${expectedFacilityIntegrity.blocked}`);
const liefkenshoekFacility = facilities.items.find((item) => item.facility === 'Liefkenshoek Tunnel');
check('LIEFKENSHOEK_NO_UNOFFICIAL_SUBSTITUTE', liefkenshoekFacility?.status === expectedFacilityIntegrity.status && (liefkenshoekCaptured ? Boolean(liefkenshoekFacility?.tariffEvidence?.sha256) : liefkenshoekFacility?.tariffEvidence?.sha256 === null), { status: liefkenshoekFacility?.status, sha256: liefkenshoekFacility?.tariffEvidence?.sha256 }, liefkenshoekCaptured ? 'CAPTURED/hashed official artifact' : 'BLOCKED/no local hash');
check('DE_EXACT_FMODEL_SCOPE', facilities.items.filter((item) => item.country === 'DE').length === 2 && facilities.items.filter((item) => item.country === 'DE').every((item) => item.status === 'CAPTURED'), facilities.items.filter((item) => item.country === 'DE').map((item) => item.facility), ['Warnowquerung', 'Herrentunnel']);

for (const candidate of ownerReview.candidates) {
  check(`OWNER_REVIEW_ARTIFACT_${candidate.candidateId}`, Boolean(candidate.artifact.canonicalPath) && existsSync(path.join(root, candidate.artifact.canonicalPath)) && hashFile(candidate.artifact.canonicalPath) === candidate.artifact.sha256, candidate.artifact.canonicalPath && existsSync(path.join(root, candidate.artifact.canonicalPath)) ? hashFile(candidate.artifact.canonicalPath) : 'MISSING', candidate.artifact.sha256);
}
check('OWNER_REVIEW_PENDING_10_10', ownerReview.summary.total === 10 && ownerReview.summary.integrityVerified === 10 && ownerReview.summary.pending === 10 && ownerReview.summary.approved === 0, ownerReview.summary, { total: 10, integrityVerified: 10, pending: 10, approved: 0 });
check('NO_AUTHORITY_PROMOTION', ownerReview.candidates.every((item) => item.authorityPromotion === 'NONE' && item.decisionStatus === 'PENDING_PRODUCT_OWNER_AUTHORITY_REVIEW'), 'NONE', 'NONE');

const expectedEvidenceBlockers = liefkenshoekCaptured ? 0 : 1;
const expectedEvidenceVerdict = liefkenshoekCaptured ? 'READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW' : 'BLOCKED';
check('MINIMAL_EVIDENCE_BLOCKERS', blockers.minimalBlockerCount === expectedEvidenceBlockers && blockers.blockedRegimeCount === expectedEvidenceBlockers && blockers.verdict === expectedEvidenceVerdict, { minimal: blockers.minimalBlockerCount, affectedRegimesOrFacilities: blockers.blockedRegimeCount, verdict: blockers.verdict }, { minimal: expectedEvidenceBlockers, affectedRegimesOrFacilities: expectedEvidenceBlockers, verdict: expectedEvidenceVerdict });
check('RT001_RES_008_REMAINS_CLOSED', priorResidualMatrix.items.find((item) => item.id === 'RT001-RES-008')?.currentStatus === 'PASS_CLOSED_BY_PRODUCT_OWNER_16_OF_16', priorResidualMatrix.items.find((item) => item.id === 'RT001-RES-008')?.currentStatus, 'PASS_CLOSED_BY_PRODUCT_OWNER_16_OF_16');
check('RUNBOOK_REMAINS_DRAFT', runbook.includes('DRAFT / OWNER REVIEW REQUIRED / NOT OPERATIONAL') && runbook.includes('UNKNOWN != ZERO') && runbook.includes('No universal fixed interval is declared authoritative'), 'DRAFT_SAFETY_GATES_PRESENT', 'DRAFT_SAFETY_GATES_PRESENT');

for (const item of basic.checks) {
  check(`BASIC_HASH_${item.path}`, hashFile(item.path) === item.expectedSha256, hashFile(item.path), item.expectedSha256);
}
for (const gapId of ['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']) {
  check(`${gapId}_OPEN`, gaps.gaps.find((gap) => gap.gapId === gapId)?.state === 'OPEN', gaps.gaps.find((gap) => gap.gapId === gapId)?.state, 'OPEN');
}

const before = Object.fromEntries(derivedFiles.map((file) => [file, hashFile(`${out}/${file}`)]));
const first = spawnSync(process.execPath, ['scripts/build-routing-toll-001-final-closure.mjs'], { cwd: root, encoding: 'utf8' });
const afterFirst = Object.fromEntries(derivedFiles.map((file) => [file, hashFile(`${out}/${file}`)]));
const second = spawnSync(process.execPath, ['scripts/build-routing-toll-001-final-closure.mjs'], { cwd: root, encoding: 'utf8' });
const afterSecond = Object.fromEntries(derivedFiles.map((file) => [file, hashFile(`${out}/${file}`)]));
const idempotent = first.status === 0 && second.status === 0 && JSON.stringify(before) === JSON.stringify(afterFirst) && JSON.stringify(afterFirst) === JSON.stringify(afterSecond);
check('GENERATOR_IDEMPOTENCE', idempotent, { firstExit: first.status, secondExit: second.status, before, afterFirst, afterSecond }, 'three identical hash sets');

const failed = checks.filter((item) => !item.pass);
const report = {
  schemaVersion: 'agm-routing-toll-001-final-closure-validation.v1',
  generatedAt: new Date().toISOString(),
  validatorVerdict: failed.length === 0 ? 'PASS' : 'FAIL',
  closureVerdict: blockers.verdict,
  checkCount: checks.length,
  failedCount: failed.length,
  checks,
  baseline: {
    registry: { count: registry.sourceCount, sha256: hashFile(registryPath) },
    routingTollView: { count: view.sourceCount, sha256: hashFile(viewPath) },
    basicLibrarian: '3/3_MATCH',
    routingToll001: blockers.verdict === 'READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW' ? 'OPEN_READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW' : 'OPEN_PARTIALLY_READY',
    legal003: 'OPEN_UNCHANGED',
    legal005: 'OPEN_UNCHANGED',
    runtimeProductionTurnApplicationApi: 'NO_CHANGE',
    commitPush: 'NOT_EXECUTED',
  },
  evidence: {
    newOfficialArtifactsCaptured: acquisition.summary.captured,
    officialArtifactBlocks: acquisition.summary.blocked,
    france: france.summary,
    facilities: facilities.summary,
    ownerAuthorityReview: ownerReview.summary,
    minimalEvidenceBlockers: blockers.minimalBlockerCount,
  },
  idempotence: { pass: idempotent, fileHashes: afterSecond },
};

writeFileSync(path.join(root, out, 'VALIDATION_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ validator: report.validatorVerdict, closure: report.closureVerdict, checks: report.checkCount, failed: report.failedCount, baseline: report.baseline, evidence: report.evidence, idempotence: report.idempotence.pass }, null, 2));
if (failed.length) process.exitCode = 1;
