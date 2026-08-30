import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const phase2Root = path.join(root, 'AGM_LIBRARY', 'PHASE2');
const registry = readJson('AGM_LIBRARY/REGISTRY/canonical-sources.json');
const candidates = readJson('AGM_LIBRARY/PHASE2/CANDIDATES/canonical-source-candidates.json');
const gaps = readJson('AGM_LIBRARY/PHASE2/REGISTRY/canonical-source-gaps.updated.json');
const decisions = readJson('AGM_LIBRARY/PHASE2/MATRICES/candidate-authoritative-decision-matrix.json');
const provenance = readJson('AGM_LIBRARY/PHASE2/MATRICES/provenance-matrix.json');
const authority = readJson('AGM_LIBRARY/PHASE2/MATRICES/authority-jurisdiction-matrix.json');
const currentness = readJson('AGM_LIBRARY/PHASE2/MATRICES/current-superseded-unknown-assessment.json');
const unresolved = readJson('AGM_LIBRARY/PHASE2/UNRESOLVED_GAPS.json');
const proposed = readJson('AGM_LIBRARY/PHASE2/PROPOSED_REGISTRY_UPDATES.json');
const queue = readJson('AGM_LIBRARY/PHASE2/HUMAN_REVIEW_QUEUE.json');
const checks = [];

check('DELIVERABLE_SET_COMPLETE', () => {
  for (const file of [
    'README.md',
    'REPORTS/CANONICAL_SOURCE_ACQUISITION_REPORT.md',
    'REPORTS/OFFICIAL_SOURCE_AND_AUTHORITY_REGISTER.md',
    'CANDIDATES/canonical-source-candidates.json',
    'REGISTRY/canonical-source-gaps.updated.json',
    'MATRICES/candidate-authoritative-decision-matrix.json',
    'MATRICES/provenance-matrix.json',
    'MATRICES/authority-jurisdiction-matrix.json',
    'MATRICES/current-superseded-unknown-assessment.json',
    'UNRESOLVED_GAPS.json', 'PROPOSED_REGISTRY_UPDATES.json', 'HUMAN_REVIEW_QUEUE.json',
  ]) assert(existsSync(path.join(phase2Root, file)), `MISSING:${file}`);
});

check('CENTRAL_REGISTRY_UNCHANGED_BY_PHASE2', () => {
  assert(registry.sourceCount === 798 && registry.sources.length === 798, 'PHASE1_SOURCE_COUNT_DRIFT');
  assert(registry.authority === 'AGM_CENTRAL_REGISTRY', 'CENTRAL_AUTHORITY_DRIFT');
  assert(registry.authorityMode === 'SINGLE_SOURCE_OF_TRUTH', 'CENTRAL_SOT_DRIFT');
  const centralIds = new Set(registry.sources.map((source) => source.sourceId));
  for (const candidate of candidates.candidates) assert(!centralIds.has(candidate.sourceId), `CANDIDATE_AUTO_INSERTED:${candidate.sourceId}`);
  assert(candidates.centralRegistryMutated === false, 'CANDIDATE_REGISTRY_MUTATION_FLAG');
  assert(proposed.status === 'PROPOSAL_ONLY_NOT_APPLIED' && proposed.centralRegistryMutated === false, 'PROPOSAL_APPLIED_FLAG');
});

check('CANDIDATE_IDENTITIES_AND_LOCATIONS_VALID', () => {
  assert(candidates.candidateCount === candidates.candidates.length, 'CANDIDATE_COUNT_MISMATCH');
  assert(candidates.candidates.length > 15, 'CANDIDATE_SET_IMPLAUSIBLY_SMALL');
  assert(new Set(candidates.candidates.map((source) => source.sourceId)).size === candidates.candidates.length, 'DUPLICATE_SOURCE_ID');
  const uriOwner = new Map();
  for (const source of candidates.candidates) {
    for (const field of ['sourceId', 'title', 'issuingAuthority', 'authorityLevel', 'jurisdictions', 'canonicalLocation', 'documentStatus', 'domains', 'provenance', 'retrievalDate', 'integrity', 'retentionClass', 'evidenceReferences', 'reviewOwner', 'reviewStatus', 'gapIds']) {
      assert(source[field] !== undefined && source[field] !== '', `MISSING_FIELD:${source.sourceId}:${field}`);
    }
    assert(/^[A-Z0-9-]+$/.test(source.sourceId), `INVALID_SOURCE_ID:${source.sourceId}`);
    assert(source.jurisdictions.length > 0 && source.domains.length > 0 && source.gapIds.length > 0, `EMPTY_SCOPE:${source.sourceId}`);
    if (source.officialUri) {
      assert(source.officialUri.startsWith('https://'), `NON_HTTPS_OFFICIAL_URI:${source.sourceId}`);
      assert(source.canonicalLocation === source.officialUri, `REMOTE_LOCATION_DRIFT:${source.sourceId}`);
      assert(source.integrity.sha256 === null, `REMOTE_HASH_FALSE_CLAIM:${source.sourceId}`);
      assert(source.integrity.status === 'NOT_CAPTURED_DYNAMIC_OR_REMOTE_OFFICIAL_SOURCE', `REMOTE_HASH_REASON_MISSING:${source.sourceId}`);
      assert(!uriOwner.has(source.officialUri), `DUPLICATE_CANONICAL_URI:${source.sourceId}:${uriOwner.get(source.officialUri)}`);
      uriOwner.set(source.officialUri, source.sourceId);
    } else {
      assert(source.canonicalLocation.startsWith('AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/'), `INTERNAL_PATH_INVALID:${source.sourceId}`);
      assert(existsSync(path.join(root, source.canonicalLocation)), `INTERNAL_SOURCE_MISSING:${source.sourceId}`);
      assert(source.integrity.sha256 === sha(source.canonicalLocation), `INTERNAL_HASH_INVALID:${source.sourceId}`);
    }
  }
});

check('NO_AUTOMATIC_AUTHORITY_PROMOTION', () => {
  assert(candidates.authority === 'CANDIDATE_REGISTRY_ONLY', 'CANDIDATE_AUTHORITY_INVALID');
  assert(candidates.automaticAuthorityPromotion === false, 'AUTO_PROMOTION_FLAG');
  assert(decisions.rules.unknownCannotBecomeCurrent && decisions.rules.contextualCannotBecomeAuthoritative && decisions.rules.humanReviewRequired, 'DECISION_RULES_INVALID');
  for (const source of candidates.candidates) {
    assert(!['CURRENT', 'AUTHORITATIVE', 'PASS'].includes(source.documentStatus), `FALSE_DOCUMENT_PROMOTION:${source.sourceId}`);
    assert(!['CURRENT', 'AUTHORITATIVE', 'PASS'].includes(source.reviewStatus), `FALSE_REVIEW_PROMOTION:${source.sourceId}`);
  }
  for (const row of decisions.decisions) assert(row.authoritative === false && row.current === false, `FALSE_MATRIX_PROMOTION:${row.sourceId}`);
  for (const row of currentness.assessments) assert(row.current === false && row.superseded === false, `UNREVIEWED_CURRENTNESS_CLAIM:${row.sourceId}`);
});

check('ALL_FIFTEEN_GAPS_ASSESSED_WITH_HONEST_STATUS', () => {
  assert(gaps.gapCount === 15 && gaps.decisions.length === 15, 'GAP_COUNT_INVALID');
  assert(new Set(gaps.decisions.map((gap) => gap.gapId)).size === 15, 'DUPLICATE_GAP_ID');
  const required = ['TACHO-001','TACHO-002','TACHO-003','TACHO-004','TACHO-005','LEGAL-001','LEGAL-002','LEGAL-003','LEGAL-004','LEGAL-005','ROUTING-TOLL-001','FIELD-001','CAR-MOVER-001','CAR-MOVER-002','DOCS-001'];
  for (const gapId of required) assert(gaps.decisions.some((gap) => gap.gapId === gapId), `GAP_MISSING:${gapId}`);
  for (const gap of gaps.decisions) {
    assert(gap.candidateSourceIds.length > 0, `NO_CANDIDATE_EVIDENCE:${gap.gapId}`);
    assert(gap.promotedToCurrent === false && gap.promotedToAuthoritative === false, `GAP_AUTO_PROMOTED:${gap.gapId}`);
    assert(!['PASS', 'CURRENT', 'AUTHORITATIVE'].includes(gap.status), `GAP_FALSE_PASS:${gap.gapId}`);
  }
  assert(gaps.decisions.find((gap) => gap.gapId === 'LEGAL-005').status === 'OPEN_UNRESOLVED', 'LEGAL_005_NOT_OPEN');
  assert(gaps.decisions.find((gap) => gap.gapId === 'ROUTING-TOLL-001').status === 'PARTIAL_UNRESOLVED', 'TOLL_GAP_NOT_PARTIAL');
});

check('GAP_CANDIDATE_MAPPING_IS_BIDIRECTIONAL', () => {
  const byId = new Map(candidates.candidates.map((source) => [source.sourceId, source]));
  for (const gap of gaps.decisions) {
    for (const sourceId of gap.candidateSourceIds) assert(byId.get(sourceId)?.gapIds.includes(gap.gapId), `GAP_TO_SOURCE_MISMATCH:${gap.gapId}:${sourceId}`);
  }
  for (const source of candidates.candidates) {
    for (const gapId of source.gapIds) assert(gaps.decisions.find((gap) => gap.gapId === gapId)?.candidateSourceIds.includes(source.sourceId), `SOURCE_TO_GAP_MISMATCH:${source.sourceId}:${gapId}`);
  }
});

check('TACHO_AND_LEGAL_OFFICIAL_PROVENANCE_REVIEW_GATE', () => {
  const regulated = candidates.candidates.filter((source) => source.domains.includes('tacho') || source.domains.includes('legislation-safety'));
  assert(regulated.length > 0, 'REGULATED_SET_EMPTY');
  for (const source of regulated) {
    assert(source.jurisdictions.length > 0, `JURISDICTION_MISSING:${source.sourceId}`);
    assert(source.reviewOwner, `REVIEW_OWNER_MISSING:${source.sourceId}`);
    assert(source.reviewStatus.includes('REVIEW') || source.reviewStatus.includes('CANDIDATE') || source.reviewStatus.includes('DOCUMENTATION_AID') || source.reviewStatus.includes('CONTEXTUAL') || source.reviewStatus.includes('REACQUISITION_REQUIRED'), `HUMAN_GATE_NOT_EXPLICIT:${source.sourceId}`);
  }
  const legalVerdict = gaps.domainVerdicts.find((row) => row.domain === 'LEGISLATION / SAFETY');
  assert(legalVerdict?.verdict === 'NOT READY', 'LEGAL_FALSE_READINESS');
});

check('PROVIDER_POLICY_FIELD_EVIDENCE_AND_INTERNAL_POLICY_SEPARATED', () => {
  const routingSources = candidates.candidates.filter((source) => source.domains.includes('routing-toll'));
  assert(routingSources.some((source) => source.authorityLevel === 'OFFICIAL_TOLL_AUTHORITY_GUIDANCE'), 'PROVIDER_GUIDANCE_MISSING');
  assert(routingSources.some((source) => source.sourceId === 'CS-AGM-CM-ARCH-V1'), 'AGM_POLICY_CANDIDATE_MISSING');
  assert(routingSources.some((source) => source.sourceId === 'CS-AGM-CM-FIELD-RUNBOOK-V1'), 'FIELD_RUNBOOK_CANDIDATE_MISSING');
  const runbook = read('AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/FIELD_TESTER_CLIENT_RUNBOOK.v1.md');
  assert(runbook.includes('not\nProduction authorization, a provider specification or measured field outcome'), 'FIELD_SEPARATION_MISSING');
  assert(runbook.includes('PARTIAL FIELD DATA — NON-CONCLUSIVE'), 'FIELD_NON_CONCLUSIVE_RULE_MISSING');
});

check('CAR_MOVER_BOUNDARY_AND_INTERNAL_SPECS_VALID', () => {
  const architecture = read('AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_ARCHITECTURE_SPEC.v1.md');
  assert(architecture.includes('inside AGM Premium'), 'PREMIUM_BOUNDARY_MISSING');
  assert(architecture.includes('not a\nseparate AGM product or project'), 'NOT_SEPARATE_BOUNDARY_MISSING');
  assert(architecture.includes('PASSENGER_CAR'), 'DEFAULT_PROFILE_MISSING');
  assert(architecture.includes('HERE and TollGuru are inactive'), 'PAID_PROVIDER_BOUNDARY_MISSING');
  assert(read('AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_JOB_FILE_SPEC.v1.md').includes('DRAFT → READY'), 'JOB_LIFECYCLE_MISSING');
  assert(read('AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_OCR_EVIDENCE_CONTRACT.v1.md').includes('must not\n  be inferred, invented'), 'OCR_UNKNOWN_RULE_MISSING');
});

check('HUMAN_REVIEW_QUEUE_COMPLETE', () => {
  assert(queue.automaticPromotionForbidden === true, 'QUEUE_AUTO_PROMOTION_FLAG');
  assert(queue.items.length === 15, 'REVIEW_QUEUE_COUNT_INVALID');
  const queueGaps = new Set(queue.items.map((item) => item.gapId));
  for (const gap of gaps.decisions) assert(queueGaps.has(gap.gapId), `REVIEW_ITEM_MISSING:${gap.gapId}`);
  for (const item of queue.items) {
    assert(item.state === 'OPEN', `REVIEW_PREMATURELY_CLOSED:${item.reviewId}`);
    assert(item.owner && item.sourceIds.length > 0, `REVIEW_METADATA_MISSING:${item.reviewId}`);
    assert(item.forbiddenOutcome.includes('AUTO_CURRENT') && item.forbiddenOutcome.includes('AUTO_AUTHORITATIVE'), `REVIEW_GUARD_MISSING:${item.reviewId}`);
  }
});

check('OFFICIAL_SOURCE_AND_VALIDATION_AUTHORITY_ANSWERABLE', () => {
  const register = read('AGM_LIBRARY/PHASE2/REPORTS/OFFICIAL_SOURCE_AND_AUTHORITY_REGISTER.md');
  for (const gap of gaps.decisions) assert(register.includes(`| ${gap.gapId} |`), `AUTHORITY_REGISTER_GAP_MISSING:${gap.gapId}`);
  assert(register.includes('UNKNOWN — complete current official source set not demonstrated'), 'UNRESOLVED_UNKNOWN_NOT_EXPLICIT');
  assert(register.includes('Central Librarian and domain views may index that decision; they cannot'), 'LIBRARIAN_AUTHORITY_BOUNDARY_MISSING');
});

check('MATRICES_COMPLETE_AND_ALIGNED', () => {
  const count = candidates.candidates.length;
  assert(decisions.decisions.length === count, 'DECISION_MATRIX_COUNT');
  assert(provenance.sources.length === count, 'PROVENANCE_MATRIX_COUNT');
  assert(authority.sources.length === count, 'AUTHORITY_MATRIX_COUNT');
  assert(currentness.assessments.length === count, 'CURRENTNESS_MATRIX_COUNT');
  assert(proposed.additionsAfterHumanApprovalOnly.length === count, 'PROPOSED_UPDATE_COUNT');
  for (const row of provenance.sources) assert(row.originalPreserved === true && row.physicalLibraryCopyCreated === false, `PROVENANCE_PRESERVATION_INVALID:${row.sourceId}`);
});

check('NO_RUNTIME_TURN_PRODUCTION_OR_BASIC_CHANGE_AUTHORIZED', () => {
  const report = read('AGM_LIBRARY/PHASE2/REPORTS/CANONICAL_SOURCE_ACQUISITION_REPORT.md');
  assert(report.includes('runtime, TURN and Production changes: 0'), 'SCOPE_STATEMENT_MISSING');
  assert(report.includes('Basic Librarian is unchanged'), 'BASIC_BOUNDARY_MISSING');
  for (const source of candidates.candidates.filter((item) => !item.officialUri)) assert(source.canonicalLocation.startsWith('AGM_LIBRARY/PHASE2/'), `INTERNAL_CANDIDATE_OUTSIDE_PHASE2:${source.sourceId}`);
});

const failed = checks.filter((item) => item.status === 'FAIL');
const validationReport = `# PHASE 2 validation report

Generated: \`2026-08-29\`
Verdict: **${failed.length === 0 ? 'PASS' : 'FAIL'}**

## Checks

${checks.map((item) => `- ${item.name} = ${item.status}${item.error ? ` — ${item.error}` : ''}`).join('\n')}

## Counts

- Phase 1 Central Registry sources: ${registry.sourceCount};
- Phase 2 candidates: ${candidates.candidateCount};
- gaps assessed: ${gaps.gapCount};
- gaps retaining unresolved work: ${unresolved.gaps.length};
- human-review items open: ${queue.items.length};
- automatic CURRENT/AUTHORITATIVE promotions: 0.

## Domain verdicts

${gaps.domainVerdicts.map((item) => `- ${item.domain} = ${item.verdict} — ${item.reason}`).join('\n')}

## Scope

- RUNTIME CHANGE = NONE
- PRODUCTION CHANGE = NONE
- TURN CHANGE = NONE
- BASIC LIBRARIAN = UNCHANGED
- CENTRAL REGISTRY MUTATION = NONE
`;
writeFileSync(path.join(phase2Root, 'REPORTS', 'PHASE2_VALIDATION_REPORT.md'), validationReport, 'utf8');

for (const result of checks) console.log(`${result.name}=${result.status}${result.error ? ` error=${result.error}` : ''}`);
console.log(`PHASE2_CANDIDATES=${candidates.candidateCount}`);
console.log(`PHASE2_GAPS=${gaps.gapCount}`);
console.log(`PHASE2_UNRESOLVED=${unresolved.gaps.length}`);
console.log(`PHASE2_VALIDATION=${failed.length === 0 ? 'PASS' : 'FAIL'}`);
if (failed.length) process.exitCode = 1;

function check(name, operation) {
  try { operation(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) }); }
}

function readJson(relativePath) { return JSON.parse(read(relativePath)); }
function read(relativePath) { return readFileSync(path.join(root, relativePath), 'utf8'); }
function sha(relativePath) { const absolute = path.join(root, relativePath); assert(statSync(absolute).isFile(), `NOT_FILE:${relativePath}`); return createHash('sha256').update(readFileSync(absolute)).digest('hex'); }
function assert(value, message) { if (!value) throw new Error(message); }
