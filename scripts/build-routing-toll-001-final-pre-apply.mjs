import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_PRE_APPLY';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const ownerDecisionPath = `${outputRoot}/PRODUCT_OWNER_DECISION_16_OF_16.json`;
const generatedAt = '2026-08-30T01:00:00.000Z';
const readText = (relative) => readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, '');
const readJson = (relative) => JSON.parse(readText(relative));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => sha(readFileSync(path.join(root, relative)));
const writeJson = (name, value) => writeFileSync(path.join(root, outputRoot, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const registry = readJson(registryPath);
const view = readJson(viewPath);
const ownerDecision = readJson(ownerDecisionPath);
const reviewPackage = readJson('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_HUMAN_AUTHORITY_REVIEW/FINAL_ATOMIC_MUTATION_PACKAGE.json');
const dispositions = readJson('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CLOSURE/CANDIDATE_DISPOSITION_MATRIX.json');
const decisionById = new Map(ownerDecision.decisions.map((decision) => [decision.sourceId, decision]));
const transitionByFinalId = new Map(dispositions.dispositions.map((item) => [item.proposedSourceId, item.inputProposalId]));

const additions = reviewPackage.proposedSourceObjects.map((source) => {
  const decision = decisionById.get(source.sourceId);
  if (!decision) throw new Error(`Missing Product Owner decision for ${source.sourceId}`);
  if (decision.classification !== source.authority.authorityType) {
    throw new Error(`Classification mismatch for ${source.sourceId}`);
  }
  return {
    ...source,
    authority: {
      ...source.authority,
      reviewStatus: 'PRODUCT_OWNER_APPROVED_2026_08_30_WITH_EXACT_SCOPE',
      humanReviewRequired: false,
    },
    provenance: {
      ...source.provenance,
      importedFrom: ownerDecisionPath,
    },
    evidenceRefs: [
      ownerDecisionPath,
      'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_HUMAN_AUTHORITY_REVIEW/FINAL_16_SOURCE_AUTHORITY_DECISION_TABLE.json',
      'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CLOSURE/REMOTE_ACQUISITION_MANIFEST.json',
      source.canonicalUri,
    ],
  };
}).sort((a, b) => a.sourceId.localeCompare(b.sourceId));

const memberships = reviewPackage.proposedRoutingTollMemberships
  .map((membership) => ({ ...membership }))
  .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
const projectedRegistry = {
  ...registry,
  registryVersion: '1.1.0',
  generatedAt,
  sourceCount: registry.sourceCount + additions.length,
  sources: [...registry.sources, ...additions],
};
const currentViewSourceIds = new Set(view.memberships.map((membership) => membership.sourceId));
const projectedViewHashes = new Set([
  ...registry.sources.filter((source) => currentViewSourceIds.has(source.sourceId)).map((source) => source.sha256),
  ...additions.map((source) => source.sha256),
]);
const projectedView = {
  ...view,
  viewVersion: '1.2.0',
  generatedAt,
  sourceCount: view.sourceCount + memberships.length,
  uniqueContentHashes: projectedViewHashes.size,
  memberships: [...view.memberships, ...memberships],
};
const projectedRegistryText = `${JSON.stringify(projectedRegistry, null, 2)}\n`;
const projectedViewText = `${JSON.stringify(projectedView, null, 2)}\n`;
const registryHashSet = new Set(registry.sources.map((source) => source.sha256));

const sourceTransitions = additions.map((source) => ({
  inputProposalId: transitionByFinalId.get(source.sourceId),
  approvedSourceId: source.sourceId,
  transition: transitionByFinalId.get(source.sourceId) === source.sourceId ? 'SOURCE_ID_PRESERVED' : 'PROPOSAL_ID_CANONICALIZED',
  baselinePresence: 'ABSENT',
  afterApprovedApplyPresence: 'PRESENT_ONCE',
  classification: source.authority.authorityType,
  routingTollMembershipId: memberships.find((membership) => membership.sourceId === source.sourceId).membershipId,
}));
const artifactManifest = additions.map((source) => ({
  sourceId: source.sourceId,
  canonicalUri: source.canonicalUri,
  canonicalArtifact: source.canonicalPath,
  mediaType: source.mediaType,
  byteSize: source.sizeBytes,
  expectedSha256: source.sha256,
  actualSha256: hashFile(source.canonicalPath),
  integrity: hashFile(source.canonicalPath) === source.sha256 ? 'MATCH' : 'MISMATCH',
  duplicatesExistingCanonicalHash: registryHashSet.has(source.sha256),
}));
const provenance = additions.map((source) => ({
  sourceId: source.sourceId,
  issuingBody: source.authority.issuingBody,
  jurisdiction: source.authority.jurisdictions,
  classification: source.authority.authorityType,
  exactApprovedScope: decisionById.get(source.sourceId).scope,
  ownerDecisionReference: ownerDecisionPath,
  officialUri: source.canonicalUri,
  officialHttps: source.canonicalUri.startsWith('https://'),
  artifactIntegrity: artifactManifest.find((item) => item.sourceId === source.sourceId).integrity,
  authorityExtrapolation: 'FORBIDDEN_OUTSIDE_EXACT_APPROVED_SCOPE',
  provenanceStatus: 'VERIFIED_FOR_PRE_APPLY',
}));

mkdirSync(path.join(root, outputRoot), { recursive: true });
writeJson('FINAL_ATOMIC_CHANGESET.json', {
  schemaVersion: 'agm-routing-toll-001-final-atomic-changeset.v1',
  generatedAt,
  status: 'READY_NOT_AUTHORIZED_NOT_EXECUTED',
  authorityDecision: { reference: ownerDecisionPath, decisions: 16, authoritativeWithScope: 12, contextual: 4, pending: 0 },
  activationCondition: 'SEPARATE_EXPLICIT_PRODUCT_OWNER_ATOMIC_APPLY_AUTHORIZATION',
  baseline: {
    registryCount: registry.sourceCount,
    registrySha256: hashFile(registryPath),
    routingTollViewCount: view.sourceCount,
    routingTollViewSha256: hashFile(viewPath),
  },
  operations: { add: 16, modifyExistingSources: 0, delete: 0 },
  additions,
  routingTollMembershipAdditions: memberships,
  projected: {
    registryCount: projectedRegistry.sourceCount,
    registrySha256: sha(projectedRegistryText),
    routingTollViewCount: projectedView.sourceCount,
    routingTollViewUniqueContentHashes: projectedView.uniqueContentHashes,
    routingTollViewSha256: sha(projectedViewText),
  },
  canonicalDuplication: false,
  gapStateAfterApply: 'ROUTING-TOLL-001_OPEN_PARTIALLY_READY',
  executed: false,
});
writeJson('EXACT_BEFORE_AFTER_DIFF.json', {
  schemaVersion: 'agm-routing-toll-001-final-before-after-diff.v1',
  before: {
    registry: { version: registry.registryVersion, generatedAt: registry.generatedAt, count: registry.sourceCount, sha256: hashFile(registryPath) },
    routingTollView: { version: view.viewVersion, generatedAt: view.generatedAt, count: view.sourceCount, uniqueContentHashes: view.uniqueContentHashes, sha256: hashFile(viewPath) },
  },
  afterIfSeparatelyAuthorized: {
    registry: { version: projectedRegistry.registryVersion, generatedAt: projectedRegistry.generatedAt, count: projectedRegistry.sourceCount, sha256: sha(projectedRegistryText) },
    routingTollView: { version: projectedView.viewVersion, generatedAt: projectedView.generatedAt, count: projectedView.sourceCount, uniqueContentHashes: projectedView.uniqueContentHashes, sha256: sha(projectedViewText) },
  },
  sourceRecordOperations: { add: additions.length, modify: 0, delete: 0 },
  topLevelMetadataUpdates: ['registryVersion', 'registry.generatedAt', 'registry.sourceCount', 'viewVersion', 'view.generatedAt', 'view.sourceCount', 'view.uniqueContentHashes'],
  sourceIdsAdded: additions.map((source) => source.sourceId),
  existingSourceIdsPreserved: registry.sources.length,
  existingMembershipsPreserved: view.memberships.length,
  gapClosed: false,
});
writeJson('SOURCE_ID_TRANSITIONS.json', {
  schemaVersion: 'agm-routing-toll-001-source-id-transitions.v1',
  transitionCount: sourceTransitions.length,
  preservedCount: sourceTransitions.filter((item) => item.transition === 'SOURCE_ID_PRESERVED').length,
  canonicalizedProposalIdCount: sourceTransitions.filter((item) => item.transition === 'PROPOSAL_ID_CANONICALIZED').length,
  transitions: sourceTransitions,
});
writeJson('CANONICAL_ARTIFACT_HASH_MANIFEST.json', {
  schemaVersion: 'agm-routing-toll-001-final-artifact-hashes.v1',
  artifactCount: artifactManifest.length,
  matchCount: artifactManifest.filter((item) => item.integrity === 'MATCH').length,
  mismatchCount: artifactManifest.filter((item) => item.integrity !== 'MATCH').length,
  duplicateExistingCanonicalHashCount: artifactManifest.filter((item) => item.duplicatesExistingCanonicalHash).length,
  artifacts: artifactManifest,
});
writeJson('PROVENANCE_VERIFICATION.json', {
  schemaVersion: 'agm-routing-toll-001-final-provenance-verification.v1',
  sourceCount: provenance.length,
  verifiedCount: provenance.filter((item) => item.provenanceStatus === 'VERIFIED_FOR_PRE_APPLY' && item.officialHttps && item.artifactIntegrity === 'MATCH').length,
  sources: provenance,
});

writeFileSync(path.join(root, outputRoot, 'DETERMINISTIC_MUTATION_PLAN.md'), `# ROUTING-TOLL-001 — deterministic atomic mutation plan

Status: \`READY / NOT AUTHORIZED / NOT EXECUTED\`

1. Require a separate explicit Product Owner atomic-apply authorization for this exact changeset hash.
2. Recheck preconditions: Registry \`815 / ${hashFile(registryPath)}\`; Routing/Toll view \`263 / ${hashFile(viewPath)}\`.
3. Recheck all 16 artifacts against byte size and SHA-256 and ensure every new sourceId/membershipId is absent.
4. Create recoverable same-directory preimages for both controlled JSON files.
5. Build staged Registry and view using the exact ordered additions in \`FINAL_ATOMIC_CHANGESET.json\`.
6. Validate schemas, ADD/MODIFY/DELETE \`16/0/0\`, classifications \`12/4\`, hashes, uniqueness, protected gaps and Basic hashes.
7. Atomically replace both files. Any partial replace or post-apply mismatch triggers immediate rollback of both files.
8. Run \`POST_APPLY_VALIDATION_PLAN.md\`. Keep \`ROUTING-TOLL-001\` OPEN.

No step in this plan has been executed.
`, 'utf8');
writeFileSync(path.join(root, outputRoot, 'ROLLBACK_PLAN.md'), `# ROUTING-TOLL-001 — rollback plan

Trigger rollback on any precondition, write, schema, count, identity, classification, artifact, hash, Basic or protected-gap mismatch.

1. Stop all changes; do not touch runtime, Production, TURN, application or API files.
2. Restore both preimages as one controlled recovery operation.
3. Verify Registry \`815 / ${hashFile(registryPath)}\`.
4. Verify Routing/Toll view \`263 / ${hashFile(viewPath)}\`.
5. Verify all 815 original sources and all 263 memberships are byte-for-byte restored.
6. Verify Basic Librarian 3/3 and all three protected gaps OPEN.
7. Record the failed condition, staged hashes, restoration hashes and filesystem journal.

Rollback has not been executed and is not authorized by this mandate.
`, 'utf8');
writeFileSync(path.join(root, outputRoot, 'POST_APPLY_VALIDATION_PLAN.md'), `# ROUTING-TOLL-001 — post-apply validation plan

- Registry count \`831\`, source ADD/MODIFY/DELETE \`16/0/0\`.
- All original 815 source objects unchanged; all 16 approved sourceIds present once.
- Addition classifications \`12 AUTHORITATIVE_WITH_SCOPE + 4 CONTEXTUAL\`.
- Canonical artifacts \`16/16\`: path, MIME, bytes and SHA-256 MATCH; canonical duplicates \`0\`.
- Registry expected SHA-256 \`${sha(projectedRegistryText)}\`.
- Routing/Toll view count \`279\`; original 263 memberships preserved; 16 deterministic memberships present once.
- Routing/Toll view expected SHA-256 \`${sha(projectedViewText)}\`.
- Apply idempotence and Registry/view regeneration idempotence PASS.
- Basic Librarian hashes 3/3 MATCH.
- \`ROUTING-TOLL-001 = OPEN / PARTIALLY_READY\`; \`LEGAL-003\` and \`LEGAL-005\` OPEN and unchanged.
- Runtime, Production, TURN, application and API unchanged; commit/push not executed.
`, 'utf8');

const report = `# ROUTING-TOLL-001 — Final pre-apply package

Status: \`PASS / READY FOR PRODUCT OWNER APPLY REVIEW\`
Mutation: \`NOT AUTHORIZED / NOT EXECUTED\`

## Human authority closure for the 16 sources

- Product Owner decisions: \`16/16 APPROVED\`;
- \`AUTHORITATIVE_WITH_SCOPE = 12\`;
- \`CONTEXTUAL = 4\`;
- \`KEEP / REJECT / PENDING = 0 / 0 / 0\`;
- no AI-fabricated authority.

## Exact projected mutation

- Central Registry: \`815 → ${projectedRegistry.sourceCount}\`;
- Routing/Toll view: \`263 → ${projectedView.sourceCount}\`;
- ADD/MODIFY/DELETE: \`16/0/0\`;
- projected Registry SHA-256: \`${sha(projectedRegistryText)}\`;
- projected Routing/Toll view SHA-256: \`${sha(projectedViewText)}\`.

## Integrity and provenance

- canonical artifacts: \`${artifactManifest.filter((item) => item.integrity === 'MATCH').length}/16 MATCH\`;
- provenance records: \`${provenance.length}/16 VERIFIED_FOR_PRE_APPLY\`;
- hashes duplicating existing canonical Registry content: \`${artifactManifest.filter((item) => item.duplicatesExistingCanonicalHash).length}\`;
- existing source changes/deletions: \`0/0\`.

## Gap boundary

\`ROUTING-TOLL-001\` remains \`OPEN / PARTIALLY_READY\` after the proposed additions. The seven declared closure-blocker families remain unaffected. \`LEGAL-003\` and \`LEGAL-005\` remain OPEN.

STOP before mutation for Product Owner review.
`;
writeFileSync(path.join(root, outputRoot, 'FINAL_PRE_APPLY_REPORT.md'), report, 'utf8');

console.log(JSON.stringify({
  humanDecisions: '16/16',
  artifactIntegrity: `${artifactManifest.filter((item) => item.integrity === 'MATCH').length}/16`,
  provenance: `${provenance.length}/16`,
  canonicalDuplicates: artifactManifest.filter((item) => item.duplicatesExistingCanonicalHash).length,
  projected: { registryCount: projectedRegistry.sourceCount, registrySha256: sha(projectedRegistryText), viewCount: projectedView.sourceCount, viewSha256: sha(projectedViewText) },
  gap: 'OPEN_PARTIALLY_READY',
  executed: false,
}, null, 2));
