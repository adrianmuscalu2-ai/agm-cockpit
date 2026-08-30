import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const proposalRoot = path.join(root, 'AGM_LIBRARY', 'PHASE3', 'CLOSURE_PROPOSAL');
const centralPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const central = readJson(centralPath);
const decisions = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/PRODUCT_OWNER_DECISIONS.json');
const transitions = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/SOURCE_STATUS_TRANSITIONS.json');
const changeset = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/PROPOSED_CANONICAL_PROMOTION_CHANGESET.json');
const diff = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/REGISTRY_BEFORE_AFTER_DIFF.json');
const queue = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UPDATED_HUMAN_REVIEW_QUEUE.json');
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const basic = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/BASIC_LIBRARIAN_INTEGRITY.json');
const checks = [];

const expectedDecisions = new Map([
  ['TACHO-001', 'APPROVE'], ['TACHO-002', 'APPROVE'], ['TACHO-003', 'APPROVE'],
  ['TACHO-004', 'APPROVE'], ['TACHO-005', 'APPROVE'],
  ['ROUTING-TOLL-001', 'KEEP_UNRESOLVED'], ['FIELD-001', 'APPROVE'],
  ['CAR-MOVER-001', 'APPROVE'], ['CAR-MOVER-002', 'APPROVE'], ['DOCS-001', 'APPROVE'],
  ['LEGAL-001', 'APPROVE'], ['LEGAL-002', 'APPROVE'], ['LEGAL-003', 'KEEP_UNRESOLVED'],
  ['LEGAL-004', 'APPROVE'], ['LEGAL-005', 'KEEP_UNRESOLVED'],
]);

const expectedApprovedSources = new Set([
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

const unresolvedOnlySources = new Set([
  'CS-DE-HGB-412', 'CS-VDI-2700-HANDBOOK', 'CS-AT-STVO-42-20260213',
  'CS-CH-VRV-20220401',
]);

check('DELIVERABLES_COMPLETE', () => {
  for (const file of [
    'PRODUCT_OWNER_DECISIONS.json', 'SOURCE_STATUS_TRANSITIONS.json',
    'PROPOSED_CANONICAL_PROMOTION_CHANGESET.json', 'REGISTRY_BEFORE_AFTER_DIFF.json',
    'UPDATED_HUMAN_REVIEW_QUEUE.json', 'UNRESOLVED_GAPS.json',
    'BASIC_LIBRARIAN_INTEGRITY.json', 'PROPOSAL_REPORT.md',
  ]) assert(existsSync(path.join(proposalRoot, file)), `MISSING:${file}`);
});

check('HUMAN_AUTHORITY_DECISIONS_15_OF_15', () => {
  assert(decisions.authority.role === 'Product Owner' && decisions.authority.name === 'Adrian Muscalu', 'WRONG_AUTHORITY');
  assert(decisions.decisionCount === 15 && decisions.decisions.length === 15, 'DECISION_COUNT');
  assert(decisions.counts.approve === 12 && decisions.counts.reject === 0 && decisions.counts.keepUnresolved === 3, 'DECISION_TOTALS');
  assert(decisions.aiFabricatedAuthority === false, 'AI_AUTHORITY_FLAG');
  assert(new Set(decisions.decisions.map((item) => item.number)).size === 15, 'DUPLICATE_NUMBER');
  for (const item of decisions.decisions) {
    assert(expectedDecisions.get(item.gapId) === item.decision, `WRONG_DECISION:${item.gapId}`);
    assert(item.explicitHumanDecision === true && item.aiDecision === false, `NOT_EXPLICIT_HUMAN:${item.gapId}`);
    assert(item.authority.name === 'Adrian Muscalu', `WRONG_ITEM_AUTHORITY:${item.gapId}`);
  }
});

check('APPROVED_SOURCE_IDS_EXACT_AND_UNIQUE', () => {
  assert(transitions.transitionCount === 17 && transitions.transitions.length === 17, 'TRANSITION_COUNT');
  const actual = new Set(transitions.transitions.map((item) => item.sourceId));
  assert(actual.size === 17, 'DUPLICATE_SOURCE_ID');
  assert(setEquals(actual, expectedApprovedSources), 'APPROVED_SOURCE_SET_MISMATCH');
  for (const sourceId of unresolvedOnlySources) assert(!actual.has(sourceId), `UNRESOLVED_SOURCE_INCLUDED:${sourceId}`);
});

check('NO_CENTRAL_COLLISION_OR_EXISTING_MUTATION', () => {
  const centralIds = new Set(central.sources.map((item) => item.sourceId));
  for (const item of transitions.transitions) {
    assert(!centralIds.has(item.sourceId), `CENTRAL_COLLISION:${item.sourceId}`);
    assert(item.operation === 'ADD_NEW_CANONICAL_SOURCE', `NON_ADD_OPERATION:${item.sourceId}`);
    assert(item.before.presence === 'ABSENT' && item.proposedAfter.presence === 'PRESENT', `NOT_ABSENT_PRESENT:${item.sourceId}`);
    assert(item.sourceIdContinuity === 'PRESERVE_PHASE2_SOURCE_ID', `SOURCE_ID_CONTINUITY:${item.sourceId}`);
  }
  assert(diff.proposedAfterAllPreconditionsAndSeparateConfirmation.modifications === 0, 'MODIFICATION_PROPOSED');
  assert(diff.proposedAfterAllPreconditionsAndSeparateConfirmation.removals === 0, 'REMOVAL_PROPOSED');
});

check('OWNER_CLASSIFICATION_CONDITIONS_PRESERVED', () => {
  for (const item of transitions.transitions) {
    const expected = contextualSources.has(item.sourceId) ? 'CONTEXTUAL' : 'AUTHORITATIVE_WITH_SCOPE';
    assert(item.proposedAfter.authorityClassification === expected, `CLASSIFICATION:${item.sourceId}`);
    assert(item.proposedAfter.documentStatus === 'CURRENT', `DOCUMENT_STATUS:${item.sourceId}`);
  }
});

check('INTEGRITY_GATE_IS_HONEST_AND_ATOMIC', () => {
  const ready = transitions.transitions.filter((item) => item.applyReadiness === 'SCHEMA_READY_PENDING_OWNER_DIFF_CONFIRMATION');
  const blocked = transitions.transitions.filter((item) => item.applyReadiness === 'NOT_APPLY_READY_PENDING_CANONICAL_INTEGRITY_CAPTURE');
  assert(ready.length === 5 && blocked.length === 12, 'READINESS_COUNTS');
  assert(ready.every((item) => item.proposedRegistryEntry !== null && item.blockers.length === 0), 'READY_ENTRY_INVALID');
  assert(blocked.every((item) => item.proposedRegistryEntry === null && item.blockers.includes('VALUES_MUST_NOT_BE_INVENTED')), 'BLOCKED_ENTRY_INVALID');
  assert(changeset.atomicApply === 'REQUIRED_AFTER_ALL_APPROVED_OPERATIONS_ARE_SCHEMA_READY', 'ATOMIC_GATE_MISSING');
  assert(changeset.centralRegistryMutationAuthorizedNow === false, 'MUTATION_FALSELY_AUTHORIZED');
  assert(changeset.status === 'PROPOSED_NOT_APPLIED_AWAITING_PRODUCT_OWNER_DIFF_CONFIRMATION', 'CHANGESET_STATUS');
});

check('REGISTRY_BEFORE_AFTER_PROVES_NO_MUTATION', () => {
  const actualHash = sha(centralPath);
  assert(central.sourceCount === 798, 'CENTRAL_COUNT_DRIFT');
  assert(diff.before.sourceCount === 798 && diff.actualAfterThisMandate.sourceCount === 798, 'ACTUAL_COUNTS');
  assert(diff.before.sha256 === actualHash && diff.actualAfterThisMandate.sha256 === actualHash, 'CENTRAL_HASH_DRIFT');
  assert(diff.actualAfterThisMandate.changed === false, 'FALSE_MUTATION');
  assert(diff.proposedAfterAllPreconditionsAndSeparateConfirmation.sourceCount === 815, 'PROPOSED_COUNT');
  assert(diff.proposedAfterAllPreconditionsAndSeparateConfirmation.additions === 17, 'PROPOSED_ADDITIONS');
  assert(diff.proposedAfterAllPreconditionsAndSeparateConfirmation.sha256 === null, 'FABRICATED_PROPOSED_HASH');
});

check('THREE_GAPS_REMAIN_OPEN', () => {
  const expected = new Set(['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']);
  assert(unresolved.gapCount === 3 && unresolved.gaps.length === 3, 'UNRESOLVED_COUNT');
  assert(setEquals(new Set(unresolved.gaps.map((item) => item.gapId)), expected), 'UNRESOLVED_SET');
  assert(unresolved.gaps.every((item) => item.decision === 'KEEP_UNRESOLVED' && item.state === 'OPEN'), 'UNRESOLVED_NOT_OPEN');
  const overlap = unresolved.gaps.filter((item) => ['LEGAL-003', 'LEGAL-005'].includes(item.gapId));
  assert(overlap.every((item) => item.overlappingSourceIdsApprovedElsewhere.includes('CS-DE-STVO')), 'STVO_OVERLAP_NOT_RECORDED');
});

check('QUEUE_TRACEABILITY_COMPLETE_WITHOUT_PROMOTION', () => {
  assert(queue.humanDecisionCount === 15 && queue.items.length === 15, 'QUEUE_COUNT');
  for (const item of queue.items) {
    assert(item.humanDecisionComplete === true && item.promotionApplied === false, `QUEUE_FLAGS:${item.gapId}`);
    const expectedState = item.decision === 'APPROVE' ? 'HUMAN_APPROVED_AWAITING_CHANGESET_CONFIRMATION' : 'KEEP_UNRESOLVED_OPEN';
    assert(item.state === expectedState, `QUEUE_STATE:${item.gapId}`);
  }
});

check('BASIC_LIBRARIAN_UNCHANGED', () => {
  assert(basic.basicLibrarianUnchanged === true, 'BASIC_CHANGED');
  assert(basic.checks.length === basic.protectedFileCount && basic.checks.length > 0, 'BASIC_CHECK_COUNT');
  assert(basic.checks.every((item) => item.unchanged && item.actualSha256 === item.expectedSha256), 'BASIC_HASH_DRIFT');
});

check('NO_RUNTIME_PRODUCTION_TURN_OR_COMMIT_SCOPE', () => {
  const report = read('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/PROPOSAL_REPORT.md');
  for (const line of [
    'RUNTIME CHANGE = NONE', 'PRODUCTION CHANGE = NONE', 'TURN CHANGE = NONE',
    'CENTRAL REGISTRY MUTATION = NONE', 'COMMIT / PUSH = NOT EXECUTED',
    'NEXT ACTION = STOP FOR PRODUCT OWNER DIFF CONFIRMATION',
  ]) assert(report.includes(line), `BOUNDARY_MISSING:${line}`);
});

const failed = checks.filter((item) => item.status === 'FAIL');
const registryHash = sha(centralPath);
const report = `# PHASE 3 owner-decision proposal validation\n\nGenerated: \`2026-08-29\`  \nProposal package: **${failed.length ? 'FAIL' : 'PASS'}**  \nHuman authority decisions recorded: **15/15**  \nCentral Registry mutation: **NONE**  \nApplication readiness: **BLOCKED PENDING CANONICAL INTEGRITY CAPTURE + PRODUCT OWNER DIFF CONFIRMATION**\n\n## Checks\n\n${checks.map((item) => `- ${item.name} = ${item.status}${item.error ? ` — ${item.error}` : ''}`).join('\n')}\n\n## Verified boundary\n\n- APPROVE: 12;\n- KEEP UNRESOLVED: 3;\n- unique proposed source additions: 17;\n- schema-ready local additions: 5;\n- remote additions awaiting real local canonical file/size/SHA-256: 12;\n- current Central Registry sources: ${central.sourceCount};\n- current Central Registry SHA-256: \`${registryHash}\`;\n- proposed conditional source count: 815;\n- applied additions/modifications/removals: 0/0/0;\n- Basic Librarian: UNCHANGED;\n- runtime / Production / TURN: NO CHANGE.\n\nNo registry hash for the conditional state was generated because the approved\nremote documents have not yet been captured with demonstrable local integrity.\n`;
writeFileSync(path.join(proposalRoot, 'VALIDATION_REPORT.md'), report, 'utf8');

for (const item of checks) console.log(`${item.name}=${item.status}${item.error ? ` error=${item.error}` : ''}`);
console.log(`OWNER_DECISION_PROPOSAL_VALIDATION=${failed.length ? 'FAIL' : 'PASS'}`);
console.log('CENTRAL_REGISTRY_MUTATION=NONE');
console.log(`CENTRAL_REGISTRY_SHA256=${registryHash}`);
if (failed.length) process.exitCode = 1;

function check(name, operation) {
  try { operation(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) }); }
}
function read(relativePath) { return readFileSync(path.join(root, relativePath), 'utf8'); }
function readJson(relativePath) { return JSON.parse(read(relativePath)); }
function sha(relativePath) { return createHash('sha256').update(readFileSync(path.join(root, relativePath))).digest('hex'); }
function assert(value, message) { if (!value) throw new Error(message); }
function setEquals(left, right) { return left.size === right.size && [...left].every((value) => right.has(value)); }
