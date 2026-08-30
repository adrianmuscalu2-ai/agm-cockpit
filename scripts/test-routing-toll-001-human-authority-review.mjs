import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_HUMAN_AUTHORITY_REVIEW';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const expectedRegistrySha = 'af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31';
const expectedViewSha = 'eb8e0b1b02b34033ad689b0aa35da616b924cc333d2d22187e466505ffcc801f';
const readText = (relative) => readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, '');
const readJson = (relative) => JSON.parse(readText(relative));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => sha(readFileSync(path.join(root, relative)));
const membershipId = (sourceId) => `DM-${sha(`${sourceId}:routing-toll`).slice(0, 20).toUpperCase()}`;

const generated = [
  'FINAL_16_SOURCE_AUTHORITY_DECISION_TABLE.json',
  'PRE_MUTATION_BASELINE.json',
  'FINAL_ATOMIC_MUTATION_PACKAGE.json',
  'BEFORE_AFTER_DIFF_PROPOSAL.json',
  'DETERMINISTIC_MUTATION_PLAN.md',
  'ROLLBACK_PLAN.md',
  'POST_MUTATION_VALIDATION_PLAN.md',
  'HUMAN_AUTHORITY_REVIEW_REPORT.md',
].map((name) => `${outputRoot}/${name}`);
const before = Object.fromEntries(generated.map((file) => [file, hashFile(file)]));
const rerun = spawnSync(process.execPath, [path.join(root, 'scripts/build-routing-toll-001-human-authority-review.mjs')], { cwd: root, encoding: 'utf8' });
const after = Object.fromEntries(generated.map((file) => [file, hashFile(file)]));

const registry = readJson(registryPath);
const view = readJson(viewPath);
const decisions = readJson(`${outputRoot}/FINAL_16_SOURCE_AUTHORITY_DECISION_TABLE.json`);
const atomic = readJson(`${outputRoot}/FINAL_ATOMIC_MUTATION_PACKAGE.json`);
const baseline = readJson(`${outputRoot}/PRE_MUTATION_BASELINE.json`);
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const basic = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/BASIC_LIBRARIAN_INTEGRITY.json');
const registryIds = new Set(registry.sources.map((source) => source.sourceId));
const membershipIds = new Set(view.memberships.map((membership) => membership.membershipId));

const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass, actual, expected });
check('GENERATOR_EXIT', rerun.status === 0, rerun.status, 0);
check('GENERATOR_IDEMPOTENCE', JSON.stringify(before) === JSON.stringify(after), after, before);
check('REGISTRY_BASELINE_COUNT', registry.sourceCount === 815, registry.sourceCount, 815);
check('REGISTRY_BASELINE_SHA', hashFile(registryPath) === expectedRegistrySha, hashFile(registryPath), expectedRegistrySha);
check('VIEW_BASELINE_COUNT', view.sourceCount === 263, view.sourceCount, 263);
check('VIEW_BASELINE_SHA', hashFile(viewPath) === expectedViewSha, hashFile(viewPath), expectedViewSha);
check('BASELINE_PACKAGE_MATCH', baseline.centralRegistry.sha256 === expectedRegistrySha && baseline.routingTollView.sha256 === expectedViewSha, `${baseline.centralRegistry.sha256}/${baseline.routingTollView.sha256}`, `${expectedRegistrySha}/${expectedViewSha}`);
check('REVIEW_ROWS_16', decisions.sources.length === 16, decisions.sources.length, 16);
check('AI_RECOMMENDATION_COUNTS', decisions.recommendationCounts.approveAsAuthoritativeWithScope === 12 && decisions.recommendationCounts.approveAsContextual === 4 && decisions.recommendationCounts.keepCandidate === 0 && decisions.recommendationCounts.reject === 0, decisions.recommendationCounts, { approveAsAuthoritativeWithScope: 12, approveAsContextual: 4, keepCandidate: 0, reject: 0 });
check('HUMAN_DECISIONS_PENDING_16', decisions.recordedHumanDecisionCounts.approved === 0 && decisions.recordedHumanDecisionCounts.pending === 16 && decisions.sources.every((source) => source.humanDecision === 'PENDING_PRODUCT_OWNER'), decisions.recordedHumanDecisionCounts, { approved: 0, pending: 16 });
check('INTEGRITY_16', decisions.sources.every((source) => source.integrityVerified && hashFile(source.canonicalArtifact) === source.sha256), decisions.sources.filter((source) => !source.integrityVerified || hashFile(source.canonicalArtifact) !== source.sha256).map((source) => source.sourceId), []);
check('NO_ADJACENT_REGIME_EXTRAPOLATION', decisions.sources.every((source) => source.adjacentRegimeExtrapolationAuthorized === false), decisions.sources.filter((source) => source.adjacentRegimeExtrapolationAuthorized).map((source) => source.sourceId), []);
check('SOURCE_IDS_ABSENT_FROM_BASELINE', atomic.proposedSourceObjects.every((source) => !registryIds.has(source.sourceId)), atomic.proposedSourceObjects.filter((source) => registryIds.has(source.sourceId)).map((source) => source.sourceId), []);
check('SOURCE_IDS_UNIQUE', new Set(atomic.proposedSourceObjects.map((source) => source.sourceId)).size === 16, new Set(atomic.proposedSourceObjects.map((source) => source.sourceId)).size, 16);
check('MEMBERSHIPS_DETERMINISTIC', atomic.proposedRoutingTollMemberships.every((membership) => membership.membershipId === membershipId(membership.sourceId)), atomic.proposedRoutingTollMemberships, 'sha256(sourceId:routing-toll) prefix');
check('MEMBERSHIPS_ABSENT_AND_UNIQUE', atomic.proposedRoutingTollMemberships.every((membership) => !membershipIds.has(membership.membershipId)) && new Set(atomic.proposedRoutingTollMemberships.map((membership) => membership.membershipId)).size === 16, atomic.proposedRoutingTollMemberships.length, 16);
check('ATOMIC_MUTATION_COUNTS', atomic.mutations.additions === 16 && atomic.mutations.modifications === 0 && atomic.mutations.deletions === 0, atomic.mutations, { additions: 16, modifications: 0, deletions: 0 });
check('CLASSIFICATION_COUNTS', atomic.classifications.authoritativeWithScope === 12 && atomic.classifications.contextual === 4, atomic.classifications, { authoritativeWithScope: 12, contextual: 4 });
check('PROJECTED_COUNTS', atomic.projected.registryCount === 831 && atomic.projected.routingTollViewCount === 279, `${atomic.projected.registryCount}/${atomic.projected.routingTollViewCount}`, '831/279');
check('PACKAGE_NOT_EXECUTED', atomic.status === 'PREPARED_NOT_AUTHORIZED_NOT_EXECUTED' && atomic.executed === false, `${atomic.status}/${atomic.executed}`, 'PREPARED_NOT_AUTHORIZED_NOT_EXECUTED/false');
check('GAP_REMAINS_OPEN_AFTER_APPLY', atomic.gapStateAfterApply === 'OPEN', atomic.gapStateAfterApply, 'OPEN');
for (const gapId of ['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']) {
  const gap = unresolved.gaps.find((item) => item.gapId === gapId);
  check(`${gapId}_OPEN`, gap?.state === 'OPEN', gap?.state ?? 'MISSING', 'OPEN');
}
for (const item of basic.checks) {
  check(`BASIC_HASH_${item.path}`, hashFile(item.path) === item.expectedSha256, hashFile(item.path), item.expectedSha256);
}

const report = {
  schemaVersion: 'agm-routing-toll-001-human-authority-review-validation.v1',
  generatedAt: new Date().toISOString(),
  verdict: checks.every((item) => item.pass) ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  failedCount: checks.filter((item) => !item.pass).length,
  checks,
  noAiFabricatedAuthority: decisions.recordedHumanDecisionCounts.approved === 0,
  registryMutation: 'NOT_EXECUTED',
  commitPush: 'NOT_EXECUTED',
};
writeFileSync(path.join(root, outputRoot, 'VALIDATION_AND_IDEMPOTENCE_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ verdict: report.verdict, checks: report.checkCount, failed: report.failedCount, noAiFabricatedAuthority: report.noAiFabricatedAuthority }, null, 2));
if (report.verdict !== 'PASS') process.exitCode = 1;
