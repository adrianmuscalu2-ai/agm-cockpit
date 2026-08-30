import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageRelative = 'AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY';
const packageRoot = path.join(root, packageRelative);
const centralPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const central = readJson(centralPath);
const artifactManifest = readJson(`${packageRelative}/CANONICAL_ARTIFACT_MANIFEST.json`);
const hashManifest = readJson(`${packageRelative}/FINAL_SOURCE_HASH_MANIFEST.json`);
const changeset = readJson(`${packageRelative}/UPDATED_PROPOSED_CHANGESET.json`);
const basic = readJson(`${packageRelative}/BASIC_LIBRARIAN_INTEGRITY.json`);
const decisions = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/PRODUCT_OWNER_DECISIONS.json');
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const candidates = readJson('AGM_LIBRARY/PHASE2/CANDIDATES/canonical-source-candidates.json').candidates;
const candidateById = new Map(candidates.map((item) => [item.sourceId, item]));
const checks = [];

const expectedSources = new Set([
  'CS-EU-REG-561-2006', 'CS-EU-REG-561-2006-CONS-20241231',
  'CS-EU-REG-165-2014', 'CS-EU-REG-165-2014-CONS-20241231',
  'CS-EU-IMPL-REG-2016-799', 'CS-EU-IMPL-REG-2016-799-CONS-20230821',
  'CS-DE-FPERSG', 'CS-DE-FPERSV', 'CS-AGM-TACHO-CHANGE-MAP-V1',
  'CS-AGM-CM-FIELD-RUNBOOK-V1', 'CS-AGM-CM-ARCH-V1', 'CS-AGM-CM-JOB-V1',
  'CS-AGM-CM-OCR-EVIDENCE-V1', 'CS-DE-STVO', 'CS-DE-STVZO',
  'CS-UNECE-ADR-2025', 'CS-DE-GGVSEB',
]);
const contextualSources = new Set([
  'CS-EU-REG-561-2006-CONS-20241231', 'CS-EU-REG-165-2014-CONS-20241231',
  'CS-EU-IMPL-REG-2016-799-CONS-20230821', 'CS-AGM-TACHO-CHANGE-MAP-V1',
]);
const allowedOfficialDomains = new Set(['eur-lex.europa.eu', 'www.gesetze-im-internet.de', 'digitallibrary.un.org']);

check('FINAL_PRE_APPLY_DELIVERABLES_PRESENT', () => {
  for (const file of [
    'REMOTE_SOURCE_INTEGRITY_REPORT.md', 'CANONICAL_ARTIFACT_MANIFEST.json',
    'FINAL_SOURCE_HASH_MANIFEST.json', 'UPDATED_PROPOSED_CHANGESET.json',
    'BASIC_LIBRARIAN_INTEGRITY.json',
  ]) assert(existsSync(path.join(packageRoot, file)), `MISSING:${file}`);
});

check('HUMAN_DECISION_BOUNDARY_PRESERVED', () => {
  assert(decisions.decisionCount === 15, 'DECISION_COUNT');
  assert(decisions.counts.approve === 12 && decisions.counts.keepUnresolved === 3, 'DECISION_TOTALS');
  assert(decisions.authority.name === 'Adrian Muscalu' && decisions.authority.role === 'Product Owner', 'AUTHORITY');
  assert(decisions.aiFabricatedAuthority === false, 'AI_AUTHORITY');
});

check('SOURCE_SET_AND_COUNTS_EXACT', () => {
  assert(artifactManifest.sourceCount === 17 && artifactManifest.sources.length === 17, 'SOURCE_COUNT');
  assert(artifactManifest.remoteSourceCount === 12 && artifactManifest.internalSourceCount === 5, 'KIND_COUNTS');
  assert(artifactManifest.integrityVerifiedCount === 17 && artifactManifest.integrityBlockedCount === 0, 'INTEGRITY_COUNTS');
  assert(artifactManifest.approvedAuthorityCounts.AUTHORITATIVE_WITH_SCOPE === 13, 'AUTHORITY_COUNT');
  assert(artifactManifest.approvedAuthorityCounts.CONTEXTUAL === 4, 'CONTEXTUAL_COUNT');
  assert(setEquals(new Set(artifactManifest.sources.map((item) => item.sourceId)), expectedSources), 'SOURCE_SET');
});

check('REMOTE_ARTIFACT_BYTES_HASH_SIGNATURE_AND_IDENTITY_VALID', () => {
  const remote = artifactManifest.sources.filter((item) => item.sourceKind === 'REMOTE_OFFICIAL_CANONICAL_CAPTURE');
  assert(remote.length === 12, 'REMOTE_COUNT');
  for (const item of remote) {
    const absolute = path.join(root, item.canonicalArtifactPath);
    assert(existsSync(absolute), `FILE_MISSING:${item.sourceId}`);
    const bytes = readFileSync(absolute);
    const latin = bytes.toString('latin1');
    assert(bytes.length === item.sizeBytes && statSync(absolute).size === item.sizeBytes, `SIZE:${item.sourceId}`);
    assert(hash(bytes) === item.sha256, `HASH:${item.sourceId}`);
    assert(item.validation.result === 'INTEGRITY_VERIFIED', `STATUS:${item.sourceId}`);
    assert(item.validation.signatureValid === true && item.validation.nonEmpty === true, `SIGNATURE:${item.sourceId}`);
    assert(item.validation.pageCountMatches === true && item.validation.identityMarkersPresent === true, `IDENTITY:${item.sourceId}`);
    if (item.mediaType === 'application/pdf') {
      assert(latin.startsWith('%PDF-') && latin.trimEnd().endsWith('%%EOF'), `PDF_CONTAINER:${item.sourceId}`);
      assert((latin.match(/\/Type\s*\/Page\b/g) ?? []).length === item.validation.expectedPageObjects, `PDF_PAGES:${item.sourceId}`);
    } else {
      assert(item.sourceId === 'CS-EU-REG-561-2006' && /<!DOCTYPE html|<html/i.test(latin), `HTML_SCOPE:${item.sourceId}`);
      for (const marker of item.validation.htmlIdentityMarkers) assert(latin.includes(marker), `HTML_MARKER:${marker}`);
    }
  }
});

check('REMOTE_PROVENANCE_OFFICIAL_AND_NO_SUBSTITUTION', () => {
  const remote = artifactManifest.sources.filter((item) => item.sourceKind === 'REMOTE_OFFICIAL_CANONICAL_CAPTURE');
  for (const item of remote) {
    const candidate = candidateById.get(item.sourceId);
    assert(candidate && item.approvedSourceUri === candidate.officialUri, `APPROVED_URI:${item.sourceId}`);
    assert(allowedOfficialDomains.has(new URL(item.finalCanonicalUri).hostname), `UNAPPROVED_DOMAIN:${item.sourceId}`);
    assert(item.provenance.originalPreserved === true, `ORIGINAL_NOT_PRESERVED:${item.sourceId}`);
    assert(item.provenance.secondaryOrGeneratedSubstitution === false, `SUBSTITUTION:${item.sourceId}`);
    assert(item.sourceAuthority === candidate.issuingAuthority, `AUTHORITY_DRIFT:${item.sourceId}`);
    assert(item.version === candidate.version && arrayEquals(item.jurisdictions, candidate.jurisdictions), `METADATA_DRIFT:${item.sourceId}`);
  }
  const adr = remote.find((item) => item.sourceId === 'CS-UNECE-ADR-2025');
  assert(adr.provenance.officialIdentifier === 'ECE/TRANS/352', 'ADR_IDENTIFIER');
  assert(adr.provenance.provenanceChain[0] === 'https://unece.org/info/Transport/pub/395786', 'ADR_APPROVED_ORIGIN');
  assert(adr.validation.observedPageObjects === 1348, 'ADR_COMPLETE_SET');
});

check('INTERNAL_FIVE_REVERIFIED_AGAINST_PHASE2', () => {
  const internal = artifactManifest.sources.filter((item) => item.sourceKind === 'AGM_INTERNAL_CANONICAL_CANDIDATE');
  assert(internal.length === 5, 'INTERNAL_COUNT');
  for (const item of internal) {
    const candidate = candidateById.get(item.sourceId);
    assert(candidate, `CANDIDATE:${item.sourceId}`);
    assert(item.canonicalArtifactPath === candidate.canonicalLocation, `PATH:${item.sourceId}`);
    assert(item.sha256 === candidate.integrity.sha256, `CANDIDATE_HASH:${item.sourceId}`);
    assert(item.validation.exists && item.validation.nonEmpty && item.validation.hashMatchesPhase2Candidate && item.validation.sourceIdConsistent, `INTERNAL_VALIDATION:${item.sourceId}`);
    assert(item.validation.result === 'INTEGRITY_VERIFIED', `INTERNAL_STATUS:${item.sourceId}`);
  }
});

check('FINAL_HASH_MANIFEST_MATCHES_ARTIFACT_MANIFEST', () => {
  assert(hashManifest.sourceCount === 17 && hashManifest.entries.length === 17, 'HASH_COUNT');
  const expectedTotal = artifactManifest.sources.reduce((sum, item) => sum + item.sizeBytes, 0);
  assert(hashManifest.totalSizeBytes === expectedTotal, 'TOTAL_BYTES');
  for (const entry of hashManifest.entries) {
    const source = artifactManifest.sources.find((item) => item.sourceId === entry.sourceId);
    assert(source && entry.sha256 === source.sha256 && entry.sizeBytes === source.sizeBytes, `HASH_MANIFEST:${entry.sourceId}`);
    assert(entry.integrityStatus === 'INTEGRITY_VERIFIED', `HASH_STATUS:${entry.sourceId}`);
  }
});

check('UPDATED_CHANGESET_ATOMIC_COMPLETE_AND_UNAPPLIED', () => {
  assert(changeset.status === 'FINAL_PRE_APPLY_INTEGRITY_VERIFIED_NOT_APPLIED', 'CHANGESET_STATUS');
  assert(changeset.centralRegistryMutationAuthorized === false, 'MUTATION_AUTHORIZED');
  assert(changeset.atomicApply === true && changeset.partialApplyForbidden === true, 'ATOMIC_RULE');
  assert(changeset.operationCount === 17 && changeset.verifiedOperationCount === 17 && changeset.blockedOperationCount === 0, 'OPERATION_COUNTS');
  assert(changeset.operations.every((item) => item.applied === false), 'OPERATION_APPLIED');
  assert(changeset.operations.every((item) => item.applyReadiness === 'INTEGRITY_VERIFIED_AWAITING_SEPARATE_OWNER_APPLY_AUTHORIZATION'), 'READINESS');
  assert(setEquals(new Set(changeset.operations.map((item) => item.sourceId)), expectedSources), 'CHANGESET_SOURCE_SET');
});

check('PROPOSED_REGISTRY_ENTRIES_SCHEMA_AND_ARTIFACTS_VALID', () => {
  for (const operation of changeset.operations) {
    const entry = operation.proposedRegistryEntry;
    assert(entry && entry.sourceId === operation.sourceId, `ENTRY:${operation.sourceId}`);
    for (const field of ['canonicalPath','mediaType','sizeBytes','sha256','sourceDate','version','status','owner','authority','provenance','retention','evidenceRefs','supersedes','supersededBy']) {
      assert(entry[field] !== undefined && entry[field] !== '', `FIELD:${operation.sourceId}:${field}`);
    }
    assert(/^[a-f0-9]{64}$/.test(entry.sha256), `SHA_FORMAT:${operation.sourceId}`);
    assert(existsSync(path.join(root, entry.canonicalPath)), `CANONICAL_PATH:${operation.sourceId}`);
    assert(statSync(path.join(root, entry.canonicalPath)).size === entry.sizeBytes, `ENTRY_SIZE:${operation.sourceId}`);
    assert(sha(entry.canonicalPath) === entry.sha256, `ENTRY_HASH:${operation.sourceId}`);
    const expectedAuthority = contextualSources.has(operation.sourceId) ? 'CONTEXTUAL' : 'AUTHORITATIVE_WITH_SCOPE';
    assert(entry.authority.authorityType === expectedAuthority, `ENTRY_AUTHORITY:${operation.sourceId}`);
    assert(entry.status === 'CURRENT', `ENTRY_STATUS:${operation.sourceId}`);
    assert(entry.authority.reviewStatus === 'HUMAN_APPROVED_INTEGRITY_VERIFIED_PENDING_REGISTRY_APPLY_AUTHORIZATION', `REVIEW_STATUS:${operation.sourceId}`);
  }
});

check('CENTRAL_REGISTRY_UNCHANGED_AND_NO_SOURCE_PREAPPLIED', () => {
  const actualHash = sha(centralPath);
  assert(central.sourceCount === 798, 'CENTRAL_COUNT');
  assert(changeset.before.sourceCount === 798 && changeset.actualAfterThisMandate.sourceCount === 798, 'BEFORE_AFTER_COUNT');
  assert(changeset.before.sha256 === actualHash && changeset.actualAfterThisMandate.sha256 === actualHash, 'BEFORE_AFTER_HASH');
  assert(changeset.actualAfterThisMandate.changed === false, 'FALSE_CHANGE');
  assert(changeset.conditionalAfterSeparateOwnerApplyAuthorization.sourceCount === 815, 'CONDITIONAL_COUNT');
  assert(changeset.conditionalAfterSeparateOwnerApplyAuthorization.sha256 === null, 'FABRICATED_FUTURE_HASH');
  const centralIds = new Set(central.sources.map((item) => item.sourceId));
  for (const sourceId of expectedSources) assert(!centralIds.has(sourceId), `PREAPPLIED:${sourceId}`);
});

check('THREE_GAPS_REMAIN_OPEN_WITH_STVO_SCOPE_LIMIT', () => {
  const expected = new Set(['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']);
  assert(unresolved.gapCount === 3 && setEquals(new Set(unresolved.gaps.map((item) => item.gapId)), expected), 'OPEN_GAPS');
  assert(unresolved.gaps.every((item) => item.state === 'OPEN' && item.decision === 'KEEP_UNRESOLVED'), 'GAP_STATE');
  assert(setEquals(new Set(changeset.unresolvedGapsRemainOpen), expected), 'CHANGESET_OPEN_GAPS');
  const stvo = changeset.operations.find((item) => item.sourceId === 'CS-DE-STVO');
  assert(stvo.approvedByReviewIds.includes('REVIEW-LEGAL-001'), 'STVO_APPROVAL');
  assert(stvo.overlapsWithUnresolvedReviewIds.includes('REVIEW-LEGAL-003') && stvo.overlapsWithUnresolvedReviewIds.includes('REVIEW-LEGAL-005'), 'STVO_OVERLAPS');
});

check('BASIC_LIBRARIAN_UNCHANGED', () => {
  assert(basic.result === 'UNCHANGED' && basic.protectedFileCount === 3, 'BASIC_RESULT');
  assert(basic.checks.every((item) => item.unchanged && item.actualSha256 === item.expectedSha256), 'BASIC_HASH');
});

check('NO_RUNTIME_PRODUCTION_TURN_COMMIT_OR_PUSH', () => {
  const report = read(`${packageRelative}/REMOTE_SOURCE_INTEGRITY_REPORT.md`);
  for (const marker of [
    'Central Registry mutation during acquisition: **NONE**', 'partial application: **FORBIDDEN**',
    'runtime / Production / TURN: **NO CHANGE**', 'commit / push: **NOT EXECUTED**',
  ]) assert(report.includes(marker), `BOUNDARY:${marker}`);
});

const failed = checks.filter((item) => item.status === 'FAIL');
const registryHash = sha(centralPath);
const report = `# FINAL PRE-APPLY VALIDATION REPORT\n\nGenerated: \`2026-08-29\`  \nValidation: **${failed.length ? 'FAIL' : 'PASS'}**  \nIntegrity: **${failed.length ? 'BLOCKED' : '17/17 VERIFIED'}**  \nCentral Registry mutation: **NONE**  \nApply authorization: **NOT GRANTED**\n\n## Checks\n\n${checks.map((item) => `- ${item.name} = ${item.status}${item.error ? ` — ${item.error}` : ''}`).join('\n')}\n\n## Final pre-apply state\n\n- remote sources: 12/12 integrity verified;\n- AGM internal sources: 5/5 integrity verified;\n- AUTHORITATIVE_WITH_SCOPE: 13;\n- CONTEXTUAL: 4;\n- integrity blocked: 0;\n- proposed atomic additions: 17;\n- applied additions: 0;\n- Central Registry sources: ${central.sourceCount};\n- Central Registry SHA-256: \`${registryHash}\`;\n- open gaps: ROUTING-TOLL-001, LEGAL-003, LEGAL-005;\n- Basic Librarian: UNCHANGED;\n- runtime / Production / TURN: NO CHANGE;\n- commit / push: NOT EXECUTED.\n\nSTOP FOR PRODUCT OWNER REVIEW. A separate explicit Product Owner decision is\nrequired before any Central Registry mutation.\n`;
writeFileSync(path.join(packageRoot, 'FINAL_PRE_APPLY_VALIDATION_REPORT.md'), report, 'utf8');

for (const item of checks) console.log(`${item.name}=${item.status}${item.error ? ` error=${item.error}` : ''}`);
console.log(`FINAL_PRE_APPLY_VALIDATION=${failed.length ? 'FAIL' : 'PASS'}`);
console.log(`INTEGRITY_VERIFIED=${failed.length ? 'BLOCKED' : '17/17'}`);
console.log('CENTRAL_REGISTRY_MUTATION=NONE');
console.log(`CENTRAL_REGISTRY_SHA256=${registryHash}`);
if (failed.length) process.exitCode = 1;

function check(name, operation) {
  try { operation(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) }); }
}
function read(relativePath) { return readFileSync(path.join(root, relativePath), 'utf8'); }
function readJson(relativePath) { return JSON.parse(read(relativePath)); }
function sha(relativePath) { return hash(readFileSync(path.join(root, relativePath))); }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function assert(value, message) { if (!value) throw new Error(message); }
function setEquals(left, right) { return left.size === right.size && [...left].every((value) => right.has(value)); }
function arrayEquals(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
