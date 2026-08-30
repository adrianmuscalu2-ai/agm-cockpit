import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const output = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CONTINUATION_READ_ONLY';
const expected = {
  registryCount: 831,
  registrySha256: 'f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d',
  viewCount: 279,
  viewSha256: '001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997',
};

const checks = [];
const read = (relative) => readFileSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative).toString('utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashFile = (relative) => hash(read(relative));
const check = (name, pass, actual, wanted) => checks.push({ name, pass: Boolean(pass), actual, expected: wanted });

const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const registry = json(registryPath);
const view = json(viewPath);
const manifest = json(`${output}/RESIDUAL_REMOTE_ACQUISITION_MANIFEST.json`);
const recovery = json(`${output}/RECOVERY_AND_SUPPLEMENTAL_ACQUISITION_RECORD.json`);
const matrix = json(`${output}/RESIDUAL_CLOSURE_MATRIX.json`);
const gaps = json('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const basic = json('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/BASIC_LIBRARIAN_INTEGRITY.json');
const runbook = read(`${output}/FRESHNESS_INVALIDATION_RUNBOOK_DRAFT.md`).toString('utf8');

check('REGISTRY_BASELINE_COUNT', registry.sourceCount === expected.registryCount && registry.sources.length === expected.registryCount, `${registry.sourceCount}/${registry.sources.length}`, '831/831');
check('REGISTRY_BASELINE_HASH', hashFile(registryPath) === expected.registrySha256, hashFile(registryPath), expected.registrySha256);
check('VIEW_BASELINE_COUNT', view.sourceCount === expected.viewCount && view.memberships.length === expected.viewCount, `${view.sourceCount}/${view.memberships.length}`, '279/279');
check('VIEW_BASELINE_HASH', hashFile(viewPath) === expected.viewSha256, hashFile(viewPath), expected.viewSha256);
check('INITIAL_ACQUISITION_TOTAL', manifest.summary.requested === 14 && manifest.summary.captured === 12 && manifest.summary.blocked === 2, manifest.summary, { requested: 14, captured: 12, blocked: 2 });

for (const item of manifest.items.filter((entry) => entry.status === 'INTEGRITY_CAPTURED_PROPOSAL_ONLY')) {
  check(`ARTIFACT_${item.candidateId}`, existsSync(path.join(root, item.canonicalPath)) && hashFile(item.canonicalPath) === item.sha256, existsSync(path.join(root, item.canonicalPath)) ? hashFile(item.canonicalPath) : 'MISSING', item.sha256);
}

const chRecovery = recovery.recoveryAttempts.find((item) => item.candidateId === 'RT001-RES-CH-LSVA-RATES');
const beRecovery = recovery.recoveryAttempts.find((item) => item.candidateId === 'RT001-RES-BE-LIEFKENSHOEK-2026');
const luSupplement = recovery.supplementalEvidence.find((item) => item.candidateId === 'RT001-RES-LU-EUROVIGNETTE-2026-ENFORCEMENT');
check('CH_RECOVERY_INTEGRITY', chRecovery?.result === 'INTEGRITY_CAPTURED_PROPOSAL_ONLY' && hashFile(chRecovery.canonicalPath) === chRecovery.sha256, hashFile(chRecovery.canonicalPath), chRecovery.sha256);
check('BE_BLOCK_RECORDED_NO_SUBSTITUTE', beRecovery?.result === 'INTEGRITY_BLOCKED_CLOUDFLARE_JAVASCRIPT_CHALLENGE' && beRecovery.localCanonicalHash === null, beRecovery?.result, 'INTEGRITY_BLOCKED_CLOUDFLARE_JAVASCRIPT_CHALLENGE');
check('LU_2026_SUPPLEMENT_INTEGRITY', luSupplement?.result === 'INTEGRITY_CAPTURED_PROPOSAL_ONLY' && hashFile(luSupplement.canonicalPath) === luSupplement.sha256, hashFile(luSupplement.canonicalPath), luSupplement.sha256);
check('TOTAL_LOCAL_NEW_ARTIFACTS', manifest.summary.captured + 2 === 14, manifest.summary.captured + 2, 14);

check('MATRIX_GAP_OPEN', matrix.gapState === 'OPEN_PARTIALLY_READY' && matrix.summary.closureVerdict === 'NOT_READY_FOR_CLOSURE', `${matrix.gapState}/${matrix.summary.closureVerdict}`, 'OPEN_PARTIALLY_READY/NOT_READY_FOR_CLOSURE');
check('RESIDUAL_ITEM_COUNT', matrix.items.length === 8, matrix.items.length, 8);
check('RES008_CLOSED_ONLY', matrix.items.filter((item) => item.currentStatus.startsWith('PASS_CLOSED')).map((item) => item.id).join(',') === 'RT001-RES-008', matrix.items.filter((item) => item.currentStatus.startsWith('PASS_CLOSED')).map((item) => item.id), ['RT001-RES-008']);
check('FR_REMAINS_BLOCKED', matrix.items.find((item) => item.id === 'RT001-RES-001')?.currentStatus === 'OPEN_BLOCKED_INCOMPLETE_CONCESSION_SET', matrix.items.find((item) => item.id === 'RT001-RES-001')?.currentStatus, 'OPEN_BLOCKED_INCOMPLETE_CONCESSION_SET');
check('FACILITIES_REMAIN_PARTIAL', matrix.items.find((item) => item.id === 'RT001-RES-005')?.currentStatus === 'PARTIALLY_READY', matrix.items.find((item) => item.id === 'RT001-RES-005')?.currentStatus, 'PARTIALLY_READY');
check('RUNBOOK_DRAFT_NOT_OPERATIONAL', runbook.includes('DRAFT / OWNER REVIEW REQUIRED / NOT OPERATIONAL') && runbook.includes('UNKNOWN != ZERO') && runbook.includes('No universal fixed interval is declared authoritative'), 'DRAFT_SAFETY_GATES_PRESENT', 'DRAFT_SAFETY_GATES_PRESENT');

for (const item of basic.checks) {
  check(`BASIC_HASH_${item.path}`, hashFile(item.path) === item.expectedSha256, hashFile(item.path), item.expectedSha256);
}
for (const gapId of ['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']) {
  check(`${gapId}_OPEN`, gaps.gaps.find((gap) => gap.gapId === gapId)?.state === 'OPEN', gaps.gaps.find((gap) => gap.gapId === gapId)?.state, 'OPEN');
}
check('NO_REGISTRY_MUTATION_IN_PACKAGE', manifest.registryMutation === 'NOT_AUTHORIZED_NOT_EXECUTED' && recovery.registryMutation === 'NOT_AUTHORIZED_NOT_EXECUTED', `${manifest.registryMutation}/${recovery.registryMutation}`, 'NOT_AUTHORIZED_NOT_EXECUTED/NOT_AUTHORIZED_NOT_EXECUTED');
check('NO_AUTHORITY_PROMOTION', manifest.items.every((item) => item.authorityPromotionAuthorized === false) && recovery.authorityPromotion === 'NOT_AUTHORIZED_NOT_EXECUTED', 'NONE', 'NONE');

const failed = checks.filter((item) => !item.pass);
const report = {
  schemaVersion: 'agm-routing-toll-001-continuation-validation.v1',
  generatedAt: new Date().toISOString(),
  verdict: failed.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  failedCount: failed.length,
  checks,
  summary: {
    registry: `${registry.sourceCount}/${hashFile(registryPath)}`,
    routingTollView: `${view.sourceCount}/${hashFile(viewPath)}`,
    newLocalArtifacts: 14,
    officialLocalIntegrityBlocked: 1,
    routingToll001: 'OPEN_PARTIALLY_READY',
    legal003: 'OPEN_UNCHANGED',
    legal005: 'OPEN_UNCHANGED',
    basicLibrarian: '3/3_MATCH',
    registryRuntimeProductionTurnApplicationApi: 'NO_CHANGE',
    commitPush: 'NOT_EXECUTED',
  },
};

writeFileSync(path.join(root, output, 'VALIDATION_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ verdict: report.verdict, checks: report.checkCount, failed: report.failedCount, summary: report.summary }, null, 2));
if (failed.length) process.exitCode = 1;
