import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(root, 'AGM_LIBRARY', 'PHASE3', 'CLOSURE_PROPOSAL');
const decisionTimestamp = '2026-08-29';
const authority = { role: 'Product Owner', name: 'Adrian Muscalu' };
const queue = readJson('AGM_LIBRARY/PHASE2/HUMAN_REVIEW_QUEUE.json').items;
const candidates = readJson('AGM_LIBRARY/PHASE2/CANDIDATES/canonical-source-candidates.json').candidates;
const currentMatrix = readJson('AGM_LIBRARY/PHASE3/CURRENT_SUPERSEDED_MATRIX.json').sources;
const central = readJson('AGM_LIBRARY/REGISTRY/canonical-sources.json');
const basicBaseline = readJson('CAR_MOVER/GOVERNANCE/BASIC_LIBRARIAN_BASELINE.json');
const candidateById = new Map(candidates.map((source) => [source.sourceId, source]));
const classificationById = new Map(currentMatrix.map((source) => [source.sourceId, source.proposedClassification]));

const ownerDecisions = [
  approved(1, 'TACHO-001', ['Authentic 561/2006 = AUTHORITATIVE_WITH_SCOPE.', 'Consolidated form = CONTEXTUAL.', 'Exceptions, AETR and operation type remain context-dependent.']),
  approved(2, 'TACHO-002', ['Authentic 165/2014 = AUTHORITATIVE_WITH_SCOPE.', 'Consolidated form = CONTEXTUAL.', 'Generation transitions and national exceptions are not generalized automatically.']),
  approved(3, 'TACHO-003', ['Authentic 2016/799 = AUTHORITATIVE_WITH_SCOPE.', 'Consolidated form = CONTEXTUAL.', 'Applicability must be correlated with tachograph generation, vehicle and retrofit dates.']),
  approved(4, 'TACHO-004', ['FPersG and FPersV = AUTHORITATIVE_WITH_SCOPE for Germany.', 'They supplement and do not replace directly applicable EU regulations.']),
  approved(5, 'TACHO-005', ['CS-AGM-TACHO-CHANGE-MAP-V1 = CONTEXTUAL ONLY.', 'It has no independent legal authority.', 'Updates require verification against primary sources.']),
  unresolved(6, 'ROUTING-TOLL-001', ['France remains fragmented.', 'Luxembourg evidence is old/insufficient.', 'Tariffs and effective dates are dynamic.', 'National sources require a separate individual review.']),
  approved(7, 'FIELD-001', ['AUTHORITATIVE_WITH_SCOPE only for the internal AGM protocol.', 'Measured results remain EVIDENCE_ONLY.', 'No Production or external-provider authorization.']),
  approved(8, 'CAR-MOVER-001', ['AUTHORITATIVE_WITH_SCOPE for internal Car Mover architecture.', 'Car Mover remains an AGM Premium component.', 'No runtime change and no separate product/project.']),
  approved(9, 'CAR-MOVER-002', ['AUTHORITATIVE_WITH_SCOPE for the internal Job File specification.', 'Existing runtime contracts remain operational until controlled promotion.', 'Referencing a document does not transfer source authority.']),
  approved(10, 'DOCS-001', ['AUTHORITATIVE_WITH_SCOPE for the internal OCR/Documents/Evidence contract.', 'OCR output is not canonical truth without source-document verification.', 'Legal retention remains UNKNOWN pending separate legal review.']),
  approved(11, 'LEGAL-001', ['StVO = AUTHORITATIVE_WITH_SCOPE for Germany.', 'Consumption must be provision-specific.', 'Registry presence does not validate every derived professional rule.']),
  approved(12, 'LEGAL-002', ['StVZO = AUTHORITATIVE_WITH_SCOPE for Germany.', 'Applicability is vehicle-category and provision specific.', 'EU interactions remain context-dependent.']),
  unresolved(13, 'LEGAL-003', ['StVO §22 and HGB §412 may be reviewed individually later.', 'VDI metadata may be CONTEXTUAL.', 'The complete gap stays open until licensed normative material and exact VDI role are reviewed.', 'VDI content must not be reconstructed from summaries.']),
  approved(14, 'LEGAL-004', ['ADR 2025 and GGVSEB = AUTHORITATIVE_WITH_SCOPE within their jurisdictions.', 'Goods classification, exceptions and per-transport applicability are not inferred automatically.']),
  unresolved(15, 'LEGAL-005', ['Multi-jurisdiction coverage is incomplete.', 'BE, NL, LU, PL, CZ and DK complete sources remain missing.', 'AT and CH require reacquisition/validation.', 'French rules and derogations are date-dependent.']),
];

const recordedDecisions = ownerDecisions.map((decision) => {
  const queueItem = queue.find((item) => item.gapId === decision.gapId);
  if (!queueItem) throw new Error(`QUEUE_ITEM_MISSING:${decision.gapId}`);
  return {
    ...decision,
    reviewId: queueItem.reviewId,
    sourceIds: queueItem.sourceIds,
    authority,
    decisionTimestamp,
    explicitHumanDecision: true,
    aiDecision: false,
    sourceEvidence: 'C:/Users/adria/.codex/attachments/026172a4-e8e5-4134-8c87-ad109d4563e7/pasted-text.txt',
  };
});

const approvedRows = recordedDecisions.filter((item) => item.decision === 'APPROVE');
const unresolvedRows = recordedDecisions.filter((item) => item.decision === 'KEEP_UNRESOLVED');
const approvedSourceIds = [...new Set(approvedRows.flatMap((item) => item.sourceIds))];
const approvedReviewIdsBySource = new Map(approvedSourceIds.map((sourceId) => [sourceId, approvedRows.filter((item) => item.sourceIds.includes(sourceId)).map((item) => item.reviewId)]));
const unresolvedOverlapBySource = new Map(approvedSourceIds.map((sourceId) => [sourceId, unresolvedRows.filter((item) => item.sourceIds.includes(sourceId)).map((item) => item.reviewId)]));

const transitions = approvedSourceIds.map((sourceId) => {
  const source = mustCandidate(sourceId);
  const proposedAuthorityClassification = classificationById.get(sourceId);
  if (!proposedAuthorityClassification) throw new Error(`CLASSIFICATION_MISSING:${sourceId}`);
  const isLocal = source.officialUri === null;
  const localReady = isLocal && existsSync(path.join(root, source.canonicalLocation)) && /^[a-f0-9]{64}$/.test(source.integrity.sha256 ?? '');
  const blockers = localReady ? [] : [
    'CENTRAL_SCHEMA_REQUIRES_LOCAL_CANONICAL_PATH_SIZE_AND_SHA256',
    'REMOTE_OFFICIAL_SOURCE_INTEGRITY_NOT_CAPTURED',
    'VALUES_MUST_NOT_BE_INVENTED',
  ];
  return {
    sourceId,
    title: source.title,
    approvedByReviewIds: approvedReviewIdsBySource.get(sourceId),
    overlapsWithUnresolvedReviewIds: unresolvedOverlapBySource.get(sourceId),
    before: { presence: 'ABSENT', documentStatus: null, authorityClassification: null },
    proposedAfter: {
      presence: 'PRESENT',
      documentStatus: proposedStatus(proposedAuthorityClassification),
      authorityClassification: proposedAuthorityClassification,
      canonicalLocation: source.canonicalLocation,
    },
    sourceIdContinuity: 'PRESERVE_PHASE2_SOURCE_ID',
    operation: 'ADD_NEW_CANONICAL_SOURCE',
    applyReadiness: localReady ? 'SCHEMA_READY_PENDING_OWNER_DIFF_CONFIRMATION' : 'NOT_APPLY_READY_PENDING_CANONICAL_INTEGRITY_CAPTURE',
    blockers,
    proposedRegistryEntry: localReady ? centralEntry(source, proposedAuthorityClassification) : null,
  };
});

const readyTransitions = transitions.filter((item) => item.applyReadiness.startsWith('SCHEMA_READY'));
const blockedTransitions = transitions.filter((item) => item.applyReadiness.startsWith('NOT_APPLY_READY'));
const centralIds = new Set(central.sources.map((source) => source.sourceId));
const collisions = transitions.filter((item) => centralIds.has(item.sourceId));

const decisionRegister = {
  schemaVersion: 'agm-phase3-product-owner-decisions.v1',
  authority,
  decisionTimestamp,
  decisionCount: recordedDecisions.length,
  counts: { approve: approvedRows.length, reject: 0, keepUnresolved: unresolvedRows.length },
  humanAuthorityClosure: 'DECISIONS_COMPLETE_PROMOTION_NOT_YET_CONFIRMED',
  aiFabricatedAuthority: false,
  decisions: recordedDecisions,
};

const changeset = {
  schemaVersion: 'agm-phase3-owner-approved-promotion-changeset.v1',
  changesetId: 'AGM-CANONICAL-PROMOTION-PHASE3-OWNER-001',
  status: 'PROPOSED_NOT_APPLIED_AWAITING_PRODUCT_OWNER_DIFF_CONFIRMATION',
  authority,
  decisionRegister: 'AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/PRODUCT_OWNER_DECISIONS.json',
  approvedReviewCount: approvedRows.length,
  unresolvedReviewCount: unresolvedRows.length,
  uniqueApprovedSourceCount: approvedSourceIds.length,
  schemaReadyOperationCount: readyTransitions.length,
  blockedOperationCount: blockedTransitions.length,
  sourceIdCollisionCount: collisions.length,
  atomicApply: 'REQUIRED_AFTER_ALL_APPROVED_OPERATIONS_ARE_SCHEMA_READY',
  centralRegistryMutationAuthorizedNow: false,
  operations: transitions,
};

const diff = {
  schemaVersion: 'agm-phase3-owner-approved-registry-diff.v1',
  changesetId: changeset.changesetId,
  status: 'SIMULATION_ONLY_NO_MUTATION',
  before: { sourceCount: central.sourceCount, sha256: sha('AGM_LIBRARY/REGISTRY/canonical-sources.json') },
  actualAfterThisMandate: { sourceCount: central.sourceCount, sha256: sha('AGM_LIBRARY/REGISTRY/canonical-sources.json'), changed: false },
  proposedAfterAllPreconditionsAndSeparateConfirmation: {
    sourceCount: central.sourceCount + transitions.length,
    additions: transitions.length,
    modifications: 0,
    removals: 0,
    sha256: null,
    sourceIds: transitions.map((item) => item.sourceId),
    note: 'A new hash cannot be generated before integrity capture and separately confirmed atomic application.',
  },
  readiness: {
    schemaReady: readyTransitions.map((item) => item.sourceId),
    blockedPendingIntegrityCapture: blockedTransitions.map((item) => item.sourceId),
  },
  domainViews: { before: 'REFERENCE_ONLY', actualAfter: 'REFERENCE_ONLY_UNCHANGED', requiredAfterFutureApply: 'REFERENCE_ONLY' },
};

const updatedQueue = {
  schemaVersion: 'agm-phase3-owner-reviewed-queue.v3',
  authority,
  humanDecisionCount: 15,
  items: recordedDecisions.map((item) => ({
    reviewId: item.reviewId,
    gapId: item.gapId,
    decision: item.decision,
    conditions: item.conditions,
    humanDecisionComplete: true,
    state: item.decision === 'APPROVE' ? 'HUMAN_APPROVED_AWAITING_CHANGESET_CONFIRMATION' : 'KEEP_UNRESOLVED_OPEN',
    promotionApplied: false,
  })),
};

const unresolvedGaps = {
  schemaVersion: 'agm-phase3-owner-unresolved-gaps.v1',
  gapCount: unresolvedRows.length,
  gaps: unresolvedRows.map((item) => ({
    reviewId: item.reviewId,
    gapId: item.gapId,
    decision: item.decision,
    state: 'OPEN',
    conditions: item.conditions,
    sourceIdsExcludedFromThisChangesetUnlessApprovedElsewhere: item.sourceIds.filter((sourceId) => !approvedSourceIds.includes(sourceId)),
    overlappingSourceIdsApprovedElsewhere: item.sourceIds.filter((sourceId) => approvedSourceIds.includes(sourceId)),
  })),
};

const basicIntegrity = {
  schemaVersion: 'agm-phase3-basic-librarian-integrity.v1',
  baseline: 'CAR_MOVER/GOVERNANCE/BASIC_LIBRARIAN_BASELINE.json',
  protectedFileCount: basicBaseline.protectedHashes.length,
  checks: basicBaseline.protectedHashes.map((item) => ({ path: item.path, expectedSha256: item.sha256, actualSha256: sha(item.path), unchanged: item.sha256 === sha(item.path) })),
};
basicIntegrity.basicLibrarianUnchanged = basicIntegrity.checks.every((item) => item.unchanged);

writeJson('PRODUCT_OWNER_DECISIONS.json', decisionRegister);
writeJson('SOURCE_STATUS_TRANSITIONS.json', { schemaVersion: 'agm-phase3-source-status-transitions.v1', transitionCount: transitions.length, transitions });
writeJson('PROPOSED_CANONICAL_PROMOTION_CHANGESET.json', changeset);
writeJson('REGISTRY_BEFORE_AFTER_DIFF.json', diff);
writeJson('UPDATED_HUMAN_REVIEW_QUEUE.json', updatedQueue);
writeJson('UNRESOLVED_GAPS.json', unresolvedGaps);
writeJson('BASIC_LIBRARIAN_INTEGRITY.json', basicIntegrity);

const report = `# PHASE 3 — Product Owner decision closure proposal

Authority: **Product Owner — Adrian Muscalu**
Human decisions: **15/15**
APPROVE: **12**
KEEP UNRESOLVED: **3**
Central Registry mutation: **NONE**

## Proposed source changes

The 12 approved review elements resolve to ${transitions.length} unique sourceId
additions. No existing source changes status; every transition is
\`ABSENT → PRESENT\` and preserves its PHASE 2 sourceId.

| sourceId | Before | Proposed document status | Proposed authority | Readiness | Approved by | Unresolved overlap |
|---|---|---|---|---|---|---|
${transitions.map((item) => `| ${item.sourceId} | ABSENT | ${item.proposedAfter.documentStatus} | ${item.proposedAfter.authorityClassification} | ${item.applyReadiness} | ${item.approvedByReviewIds.join(', ')} | ${item.overlapsWithUnresolvedReviewIds.join(', ') || 'none'} |`).join('\n')}

## Before / after

- actual before: ${central.sourceCount} sources, SHA-256 \`${diff.before.sha256}\`;
- actual after this mandate: ${central.sourceCount} sources, identical SHA-256;
- conditional after a later confirmed atomic apply: ${diff.proposedAfterAllPreconditionsAndSeparateConfirmation.sourceCount} sources;
- proposed additions: ${transitions.length}; modifications: 0; removals: 0;
- schema-ready local sources: ${readyTransitions.length};
- remote official sources pending integrity capture: ${blockedTransitions.length}.

## Integrity constraint before future application

The Central Registry schema and validator require a real local canonical path,
size and SHA-256. ${blockedTransitions.length} approved official remote sources
currently have an official URI but no captured canonical file/hash. These values
cannot be invented. Therefore the full changeset is not apply-ready and remains
atomic/unapplied until a separately confirmed integrity-acquisition step.

Schema-ready local sourceIds:

${readyTransitions.map((item) => `- ${item.sourceId}`).join('\n')}

Blocked remote sourceIds:

${blockedTransitions.map((item) => `- ${item.sourceId}`).join('\n')}

## Unresolved gaps preserved

${unresolvedRows.map((item) => `- ${item.reviewId} / ${item.gapId} = KEEP UNRESOLVED / OPEN`).join('\n')}

\`CS-DE-STVO\` overlaps LEGAL-003 and LEGAL-005, but its proposed addition is
authorized only through approved LEGAL-001. Its presence must not close or
broaden either unresolved gap.

## Boundary

- BASIC LIBRARIAN = ${basicIntegrity.basicLibrarianUnchanged ? 'UNCHANGED' : 'CHANGED'}
- RUNTIME CHANGE = NONE
- PRODUCTION CHANGE = NONE
- TURN CHANGE = NONE
- CENTRAL REGISTRY MUTATION = NONE
- COMMIT / PUSH = NOT EXECUTED
- NEXT ACTION = STOP FOR PRODUCT OWNER DIFF CONFIRMATION
`;
writeText('PROPOSAL_REPORT.md', report);

console.log('HUMAN_AUTHORITY_DECISIONS=15/15');
console.log(`APPROVE=${approvedRows.length}`);
console.log(`KEEP_UNRESOLVED=${unresolvedRows.length}`);
console.log(`UNIQUE_APPROVED_SOURCES=${transitions.length}`);
console.log(`SCHEMA_READY=${readyTransitions.length}`);
console.log(`BLOCKED_PENDING_INTEGRITY=${blockedTransitions.length}`);
console.log('CENTRAL_REGISTRY_MUTATION=NONE');

function approved(number, gapId, conditions) { return { number, gapId, decision: 'APPROVE', conditions }; }
function unresolved(number, gapId, conditions) { return { number, gapId, decision: 'KEEP_UNRESOLVED', conditions }; }
function mustCandidate(sourceId) { const source = candidateById.get(sourceId); if (!source) throw new Error(`CANDIDATE_MISSING:${sourceId}`); return source; }
function proposedStatus(classification) { return classification === 'SUPERSEDED' ? 'SUPERSEDED' : classification === 'EVIDENCE_ONLY' ? 'EVIDENCE' : 'CURRENT'; }
function centralEntry(source, authorityClassification) {
  const absolute = path.join(root, source.canonicalLocation);
  return {
    sourceId: source.sourceId,
    canonicalPath: source.canonicalLocation,
    canonicalUri: source.officialUri,
    mediaType: 'text/markdown',
    sizeBytes: statSync(absolute).size,
    sha256: sha(source.canonicalLocation),
    sourceDate: source.publicationDate ?? decisionTimestamp,
    effectiveDate: source.effectiveDate,
    version: source.version,
    status: proposedStatus(authorityClassification),
    owner: source.reviewOwner,
    authority: { issuingBody: source.issuingAuthority, authorityType: authorityClassification, jurisdictions: source.jurisdictions, reviewStatus: 'HUMAN_APPROVED_PENDING_CHANGESET_CONFIRMATION', humanReviewRequired: false },
    provenance: { importedFrom: source.provenance.acquiredFrom, observedPath: source.canonicalLocation, originalPreserved: true, libraryCopyCreated: false },
    retention: { classification: source.retentionClass, deleteAuthorized: false, historicalEvidencePreserved: true },
    evidenceRefs: source.evidenceReferences.filter((value) => typeof value === 'string' && !value.includes('\n')),
    supersedes: source.supersedes,
    supersededBy: source.supersededBy,
  };
}
function readJson(relativePath) { return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')); }
function sha(relativePath) { return createHash('sha256').update(readFileSync(path.join(root, relativePath))).digest('hex'); }
function writeJson(relativePath, value) { writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`); }
function writeText(relativePath, value) { const absolute = path.join(outputRoot, relativePath); mkdirSync(path.dirname(absolute), { recursive: true }); writeFileSync(absolute, value, 'utf8'); }
