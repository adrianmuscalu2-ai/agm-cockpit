import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const expectedRegistrySha256 = 'af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31';
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
const hashFile = (relativePath) => createHash('sha256').update(readFileSync(path.join(root, relativePath))).digest('hex');

const registry = readJson('AGM_LIBRARY/REGISTRY/canonical-sources.json');
const view = readJson('AGM_LIBRARY/VIEWS/routing-toll.view.json');
const audit = readJson('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_ASSESSMENT/ROUTING_TOLL_VIEW_263_SOURCE_AUDIT.json');
const matrix = readJson('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_ASSESSMENT/ROUTING_TOLL_001_REQUIREMENT_MATRIX.json');
const candidates = readJson('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_ASSESSMENT/PROPOSED_OFFICIAL_SOURCE_CANDIDATES.json');
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const basic = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/BASIC_LIBRARIAN_INTEGRITY.json');
const registryIds = new Set(registry.sources.map((source) => source.sourceId));

const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass, actual, expected });

check('CENTRAL_REGISTRY_COUNT', registry.sources.length === 815, registry.sources.length, 815);
check('CENTRAL_REGISTRY_SHA256', hashFile('AGM_LIBRARY/REGISTRY/canonical-sources.json') === expectedRegistrySha256, hashFile('AGM_LIBRARY/REGISTRY/canonical-sources.json'), expectedRegistrySha256);
check('ROUTING_TOLL_VIEW_COUNT', view.sourceCount === 263 && view.memberships.length === 263, `${view.sourceCount}/${view.memberships.length}`, '263/263');
check('SOURCE_AUDIT_COUNT', audit.sources.length === 263 && audit.summary.sourcesEvaluated === 263, `${audit.sources.length}/${audit.summary.sourcesEvaluated}`, '263/263');
check('SOURCE_AUDIT_INTEGRITY', audit.summary.artifactHashMatches === 263 && audit.summary.artifactHashMismatches === 0, `${audit.summary.artifactHashMatches} match / ${audit.summary.artifactHashMismatches} mismatch`, '263 match / 0 mismatch');
check('EXTERNAL_AUTHORITY_IN_REGISTRY', audit.summary.externalOfficialAuthoritiesInRegistry === 0, audit.summary.externalOfficialAuthoritiesInRegistry, 0);
check('INTERNAL_AUTHORITY_COUNT', audit.summary.internalAuthoritiesWithScope === 2, audit.summary.internalAuthoritiesWithScope, 2);
check('REQUIREMENT_MATRIX_VERDICT', matrix.closureVerdict === 'PARTIALLY_READY' && matrix.gapClosed === false, `${matrix.closureVerdict}; closed=${matrix.gapClosed}`, 'PARTIALLY_READY; closed=false');
check('CANDIDATE_MANIFEST_COUNT', candidates.candidateCount === 20 && candidates.candidates.length === 20, `${candidates.candidateCount}/${candidates.candidates.length}`, '20/20');
check('CANDIDATES_NOT_REGISTERED', candidates.candidates.every((candidate) => !registryIds.has(candidate.proposalId)), candidates.candidates.filter((candidate) => registryIds.has(candidate.proposalId)).map((candidate) => candidate.proposalId), []);
check('NO_CANDIDATE_FAKE_HASH', candidates.candidates.every((candidate) => candidate.artifactSha256 === null), candidates.candidates.filter((candidate) => candidate.artifactSha256 !== null).length, 0);
for (const gapId of ['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']) {
  const gap = unresolved.gaps.find((item) => item.gapId === gapId);
  check(`${gapId}_OPEN`, gap?.state === 'OPEN', gap?.state ?? 'MISSING', 'OPEN');
}
for (const item of basic.checks) {
  const actual = hashFile(item.path);
  check(`BASIC_HASH_${item.path}`, actual === item.expectedSha256, actual, item.expectedSha256);
}

const report = {
  schemaVersion: 'agm-routing-toll-001-validation.v1',
  generatedAt: new Date().toISOString(),
  verdict: checks.every((item) => item.pass) ? 'PASS' : 'FAIL',
  checks,
  runtimeProductionTurnChange: 'NONE',
  centralRegistryMutation: false,
  basicLibrarianChange: 'NONE',
  commitPush: 'NOT_EXECUTED',
};
writeFileSync(
  path.join(root, 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_ASSESSMENT/VALIDATION_REPORT.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify({ verdict: report.verdict, checks: checks.length, failed: checks.filter((item) => !item.pass) }, null, 2));
if (report.verdict !== 'PASS') process.exitCode = 1;
