import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_HUMAN_AUTHORITY_REVIEW';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const generatedAt = '2026-08-30T00:30:00.000Z';
const readText = (relative) => readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, '');
const readJson = (relative) => JSON.parse(readText(relative));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => sha(readFileSync(path.join(root, relative)));
const writeJson = (name, value) => writeFileSync(path.join(root, outputRoot, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const membershipId = (sourceId) => `DM-${sha(`${sourceId}:routing-toll`).slice(0, 20).toUpperCase()}`;

const registry = readJson(registryPath);
const view = readJson(viewPath);
const closureChangeset = readJson('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CLOSURE/PROPOSED_REGISTRY_REVIEW_CHANGESET.json');
const dispositions = readJson('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CLOSURE/CANDIDATE_DISPOSITION_MATRIX.json');
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const dispositionBySourceId = new Map(dispositions.dispositions.map((item) => [item.proposedSourceId, item]));

const metadata = {
  'CS-DE-TOLL-COLLECT-RATES': ['2026-08-29', '2024-07-01', 'Live official tariff page captured 2026-08-29', ['DE']],
  'CS-DE-BFSTRMG': ['2026-05-15', '2026-05-15', 'Last amended 2026-05-15', ['DE']],
  'CS-AT-ASFINAG-GO-TOLL': ['2025-12-18', '2026-01-01', 'GO-Maut Tarife 2026', ['AT']],
  'CS-AT-ASFINAG-VIGNETTE-SECTION-2026': ['2025-11-18', '2026-01-01', 'Vignette und Streckenmaut 2026', ['AT']],
  'CS-BE-VIAPASS': ['2026-08-29', null, 'Official authority portal captured 2026-08-29', ['BE']],
  'CS-BE-VIAPASS-RATES-2026': ['2026-07-01', '2026-07-01', 'Viapass edition 2026-07-01', ['BE']],
  'CS-PL-ETOLL-RATES': ['2026-08-29', '2026-02-01', 'Rates effective 2026-02-01', ['PL']],
  'CS-CZ-MYTO-RATES-2026': ['2026-01-01', '2026-01-01', '2026 official rates', ['CZ']],
  'CS-CZ-EDALNICE-VIGNETTE-2026': ['2026-08-29', null, 'Official eDalnice portal captured 2026-08-29', ['CZ']],
  'CS-DK-KMTOLL-EETS': ['2026-08-29', '2025-01-01', 'Current network scope captured 2026-08-29', ['DK']],
  'CS-DK-STOREBAELT-RATES-2026': ['2026-01-01', '2026-01-01', 'Storebaelt prices 2026', ['DK']],
  'CS-DK-SE-ORESUND-RATES-2026': ['2026-05-18', '2026-05-18', 'Oresund prices effective 2026-05-18', ['DK', 'SE']],
  'CS-NL-TRUCK-TOLL': ['2026-08-29', '2026-07-01', 'Official truck-charge portal captured 2026-08-29', ['NL']],
  'CS-NL-A24-ETOL-2026': ['2026-01-01', '2026-01-01', 'A24 toll amounts effective 2026-01-01', ['NL']],
  'CS-FR-MOTORWAY-TOLLS': ['2026-08-29', null, 'Official motorway toll framework captured 2026-08-29', ['FR']],
  'CS-FR-ART-TARIFF-GOVERNANCE': ['2026-08-29', null, 'Official tariff-governance page captured 2026-08-29', ['FR']],
};

const reviewRows = closureChangeset.additions.map((addition, index) => {
  const disposition = dispositionBySourceId.get(addition.sourceId);
  if (!disposition) throw new Error(`Missing disposition for ${addition.sourceId}`);
  const supportedDecision = addition.proposedClassification === 'AUTHORITATIVE_WITH_SCOPE'
    ? 'APPROVE_AS_AUTHORITATIVE_WITH_SCOPE'
    : 'APPROVE_AS_CONTEXTUAL';
  return {
    item: index + 1,
    sourceId: addition.sourceId,
    officialPublisher: addition.authority,
    jurisdiction: addition.jurisdiction,
    exactScope: disposition.regimeScope,
    effectiveOrVersionDate: addition.effectiveOrVersionDate,
    canonicalArtifact: addition.canonicalArtifact,
    byteSize: addition.byteSize,
    sha256: addition.sha256,
    integrityVerified: hashFile(addition.canonicalArtifact) === addition.sha256,
    adjacentRegimeExtrapolationAuthorized: false,
    aiRecommendation: supportedDecision,
    recommendationBasis: disposition.rationale,
    humanDecision: 'PENDING_PRODUCT_OWNER',
    humanDecisionReference: null,
  };
});

const sourceObjects = reviewRows.map((row) => {
  const addition = closureChangeset.additions.find((item) => item.sourceId === row.sourceId);
  const meta = metadata[row.sourceId];
  if (!meta) throw new Error(`Missing exact metadata for ${row.sourceId}`);
  return {
    sourceId: row.sourceId,
    canonicalPath: row.canonicalArtifact,
    canonicalUri: addition.canonicalUri,
    mediaType: addition.mediaType,
    sizeBytes: addition.byteSize,
    sha256: addition.sha256,
    sourceDate: meta[0],
    effectiveDate: meta[1],
    version: meta[2],
    status: 'CURRENT',
    owner: 'Mobility & Routing Steward',
    authority: {
      issuingBody: row.officialPublisher,
      authorityType: addition.proposedClassification,
      jurisdictions: meta[3],
      reviewStatus: 'PRODUCT_OWNER_APPROVED_WITH_EXACT_SCOPE',
      humanReviewRequired: false,
    },
    provenance: {
      importedFrom: 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_HUMAN_AUTHORITY_REVIEW/FINAL_16_SOURCE_AUTHORITY_DECISION_TABLE.json',
      observedPath: row.canonicalArtifact,
      originalPreserved: true,
      libraryCopyCreated: false,
    },
    retention: {
      classification: 'PERMANENT_VERSION_AND_JURISDICTION_HISTORY',
      deleteAuthorized: false,
      historicalEvidencePreserved: true,
    },
    evidenceRefs: [
      'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CLOSURE/REMOTE_ACQUISITION_MANIFEST.json',
      'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_HUMAN_AUTHORITY_REVIEW/FINAL_16_SOURCE_AUTHORITY_DECISION_TABLE.json',
      addition.canonicalUri,
    ],
    supersedes: [],
    supersededBy: [],
  };
}).sort((a, b) => a.sourceId.localeCompare(b.sourceId));

const projectedRegistry = {
  ...registry,
  registryVersion: '1.1.0',
  generatedAt,
  sourceCount: registry.sourceCount + sourceObjects.length,
  sources: [...registry.sources, ...sourceObjects],
};
const newMemberships = sourceObjects.map((source) => ({ membershipId: membershipId(source.sourceId), sourceId: source.sourceId }));
const projectedView = {
  ...view,
  viewVersion: '1.2.0',
  generatedAt,
  sourceCount: view.sourceCount + newMemberships.length,
  uniqueContentHashes: new Set([...registry.sources.filter((source) => view.memberships.some((member) => member.sourceId === source.sourceId)).map((source) => source.sha256), ...sourceObjects.map((source) => source.sha256)]).size,
  memberships: [...view.memberships, ...newMemberships],
};
const projectedRegistryText = `${JSON.stringify(projectedRegistry, null, 2)}\n`;
const projectedViewText = `${JSON.stringify(projectedView, null, 2)}\n`;

mkdirSync(path.join(root, outputRoot), { recursive: true });
writeJson('FINAL_16_SOURCE_AUTHORITY_DECISION_TABLE.json', {
  schemaVersion: 'agm-routing-toll-001-human-authority-review.v1',
  generatedAt,
  finalAuthority: 'Product Owner — Adrian Muscalu',
  governance: 'AI_RECOMMENDS_PRODUCT_OWNER_DECIDES',
  sourceCount: reviewRows.length,
  recommendationCounts: {
    approveAsAuthoritativeWithScope: reviewRows.filter((row) => row.aiRecommendation === 'APPROVE_AS_AUTHORITATIVE_WITH_SCOPE').length,
    approveAsContextual: reviewRows.filter((row) => row.aiRecommendation === 'APPROVE_AS_CONTEXTUAL').length,
    keepCandidate: 0,
    reject: 0,
  },
  recordedHumanDecisionCounts: { approved: 0, keepCandidate: 0, rejected: 0, pending: 16 },
  sources: reviewRows,
});
writeJson('PRE_MUTATION_BASELINE.json', {
  schemaVersion: 'agm-routing-toll-001-pre-mutation-baseline.v1',
  capturedAt: generatedAt,
  centralRegistry: { path: registryPath, count: registry.sourceCount, sha256: hashFile(registryPath) },
  routingTollView: { path: viewPath, count: view.sourceCount, sha256: hashFile(viewPath) },
  unresolvedGaps: unresolved.gaps.map((gap) => ({ gapId: gap.gapId, state: gap.state })),
  basicLibrarian: 'UNCHANGED_3_OF_3_HASH_MATCH_REQUIRED',
});
writeJson('FINAL_ATOMIC_MUTATION_PACKAGE.json', {
  schemaVersion: 'agm-routing-toll-001-final-atomic-mutation-package.v1',
  generatedAt,
  status: 'PREPARED_NOT_AUTHORIZED_NOT_EXECUTED',
  activationCondition: 'PRODUCT_OWNER_EXPLICIT_DECISIONS_16_OF_16_AND_ATOMIC_APPLY_AUTHORIZATION',
  preconditions: {
    registryCount: 815,
    registrySha256: hashFile(registryPath),
    routingTollViewCount: 263,
    routingTollViewSha256: hashFile(viewPath),
  },
  mutations: { additions: 16, modifications: 0, deletions: 0 },
  classifications: { authoritativeWithScope: 12, contextual: 4 },
  proposedSourceObjects: sourceObjects,
  proposedRoutingTollMemberships: newMemberships,
  projected: {
    registryCount: projectedRegistry.sourceCount,
    registrySha256: sha(projectedRegistryText),
    routingTollViewCount: projectedView.sourceCount,
    routingTollViewUniqueContentHashes: projectedView.uniqueContentHashes,
    routingTollViewSha256: sha(projectedViewText),
  },
  gapStateAfterApply: 'OPEN',
  executed: false,
});
writeJson('BEFORE_AFTER_DIFF_PROPOSAL.json', {
  schemaVersion: 'agm-routing-toll-001-before-after-diff-proposal.v1',
  before: { registryCount: 815, routingTollViewCount: 263 },
  afterIfApproved: { registryCount: 831, routingTollViewCount: 279 },
  addModifyDelete: { add: 16, modify: 0, delete: 0 },
  sourceIds: sourceObjects.map((source) => source.sourceId),
  existingSourceRecordsChanged: 0,
  gapClosed: false,
});

writeFileSync(path.join(root, outputRoot, 'DETERMINISTIC_MUTATION_PLAN.md'), `# Deterministic atomic mutation plan

Status: \`PREPARED / NOT AUTHORIZED / NOT EXECUTED\`

1. Require explicit Product Owner decisions for all 16 rows and a separate atomic-apply authorization.
2. Verify Registry count/hash \`815 / ${hashFile(registryPath)}\` and Routing/Toll view count/hash \`263 / ${hashFile(viewPath)}\`.
3. Verify all 16 sourceIds are absent and every canonical artifact matches its approved byte size and SHA-256.
4. Create same-directory preimage backups of the Registry and Routing/Toll view.
5. Build staged JSON by appending the 16 source objects in lexical sourceId order and the 16 deterministic memberships defined in the package.
6. Validate schemas, counts, uniqueness, classifications, artifacts, protected gaps and Basic hashes against staged files.
7. Atomically replace both controlled files as one governed operation; if the second replace or any validation fails, execute rollback immediately.
8. Run the post-mutation validation plan. Do not close \`ROUTING-TOLL-001\`.

Projected hashes are valid only for this exact package and formatting:

- Registry: \`${sha(projectedRegistryText)}\`;
- Routing/Toll view: \`${sha(projectedViewText)}\`.
`, 'utf8');

writeFileSync(path.join(root, outputRoot, 'ROLLBACK_PLAN.md'), `# Rollback plan

Rollback trigger: any precondition, atomic-write or post-apply validation mismatch.

1. Stop without touching any other Registry, view, runtime or application file.
2. Restore the same-directory Registry and Routing/Toll view preimages.
3. Verify Registry \`815\` and SHA-256 \`${hashFile(registryPath)}\`.
4. Verify Routing/Toll view \`263\` and SHA-256 \`${hashFile(viewPath)}\`.
5. Verify Basic Librarian hashes 3/3 and all three protected gaps OPEN.
6. Record the failing check, staged hashes, rollback hashes and filesystem error details.

The rollback operation is not authorized or executed by this review mandate.
`, 'utf8');

writeFileSync(path.join(root, outputRoot, 'POST_MUTATION_VALIDATION_PLAN.md'), `# Post-mutation validation plan

- Registry count \`831\`; exactly 16 additions, 0 existing-source modifications, 0 deletions.
- All 16 approved sourceIds present exactly once.
- Classification totals within the additions: 12 \`AUTHORITATIVE_WITH_SCOPE\`, 4 \`CONTEXTUAL\`.
- Canonical artifacts 16/16 present with byte size and SHA-256 match.
- Routing/Toll view count \`279\`; 16 deterministic memberships; no duplicate membershipId/sourceId.
- Projected Registry hash \`${sha(projectedRegistryText)}\` and projected view hash \`${sha(projectedViewText)}\`.
- Apply generator and Registry/view regeneration idempotence PASS.
- Central Registry remains single source of truth; no canonical copies created.
- Basic Librarian 3/3 hashes MATCH.
- \`ROUTING-TOLL-001\`, \`LEGAL-003\`, \`LEGAL-005\` remain OPEN.
- Runtime, Production, TURN, application and API remain unchanged.
`, 'utf8');

const reviewReport = `# ROUTING-TOLL-001 — Human Authority Review

Status: \`STOP FOR PRODUCT OWNER DECISION\`
Registry mutation: \`NOT AUTHORIZED / NOT EXECUTED\`

## Decision boundary

All 16 sources have sufficient evidence for the listed scoped recommendation. AI recommendations are not human approvals. The Product Owner decision is still \`PENDING\` for all 16 rows.

## Counts

- AI recommendation: 12 \`APPROVE AS AUTHORITATIVE_WITH_SCOPE\`, 4 \`APPROVE AS CONTEXTUAL\`, 0 KEEP, 0 REJECT.
- Recorded human decisions: 0 approved, 0 keep, 0 rejected, 16 pending.
- Mutation-eligible sources before Product Owner decision: 0.
- Projected after explicit 16/16 approval: Registry \`815 → 831\`; Routing/Toll view \`263 → 279\`; ADD/MODIFY/DELETE \`16/0/0\`.

## Authority recommendations

| # | sourceId | Recommendation | Exact scope | Human decision |
|---:|---|---|---|---|
${reviewRows.map((row) => `| ${row.item} | ${row.sourceId} | ${row.aiRecommendation} | ${row.exactScope} | ${row.humanDecision} |`).join('\n')}

## Gap status

Approval of these sources does not close \`ROUTING-TOLL-001\`. France concession tariffs, Poland passenger concessions, Switzerland exact tariffs, Luxembourg 2026 applicability, separate facilities, DK/NL exact distance rates and the common freshness mechanism remain independent blockers.
`;
writeFileSync(path.join(root, outputRoot, 'HUMAN_AUTHORITY_REVIEW_REPORT.md'), reviewReport, 'utf8');

console.log(JSON.stringify({
  recommendations: { authoritativeWithScope: 12, contextual: 4, keep: 0, reject: 0 },
  humanDecisions: { approved: 0, pending: 16 },
  projected: { registry: 831, view: 279, registrySha256: sha(projectedRegistryText), viewSha256: sha(projectedViewText) },
  gap: 'OPEN',
  executed: false,
}, null, 2));
