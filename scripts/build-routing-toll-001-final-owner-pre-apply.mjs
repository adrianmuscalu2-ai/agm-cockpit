import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_OWNER_PRE_APPLY_10_OF_10';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const decisionsPath = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION/PRODUCT_OWNER_AUTHORITY_DECISIONS.json';
const reviewPath = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION/OWNER_AUTHORITY_REVIEW_PACKAGE.json';
const manifestPath = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CONTINUATION_READ_ONLY/RESIDUAL_REMOTE_ACQUISITION_MANIFEST.json';
const generatedAt = '2026-08-30T12:39:14.672Z';
const blockedCandidateId = 'RT001-RES-CH-VIGNETTE-2026';

const readBytes = (relative) => readFileSync(path.join(root, relative));
const readJson = (relative) => JSON.parse(readBytes(relative).toString('utf8').replace(/^\uFEFF/, ''));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => sha(readBytes(relative));
const membershipId = (sourceId) => `DM-${sha(`${sourceId}:routing-toll`).slice(0, 20).toUpperCase()}`;
const writeJson = (name, value) => writeFileSync(path.join(root, outputRoot, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const registry = readJson(registryPath);
const view = readJson(viewPath);
const decisions = readJson(decisionsPath);
const review = readJson(reviewPath);
const decisionByCandidate = new Map(decisions.decisions.map((decision) => [decision.candidateId, decision]));

const metadata = {
  'RT001-RES-PL-A1-2026': {
    sourceDate: '2026-08-30', effectiveDate: null,
    version: 'Official AmberOne tariff surface captured 2026-08-30; effectivity not stated', jurisdictions: ['PL'],
  },
  'RT001-RES-PL-A2-2026': {
    sourceDate: '2026-08-30', effectiveDate: null,
    version: 'Official A2 tariff PDF captured 2026-08-30; effective period bounded by document', jurisdictions: ['PL'],
  },
  'RT001-RES-PL-A4-2026': {
    sourceDate: '2026-08-30', effectiveDate: '2026-04-01',
    version: 'Tariffs effective 2026-04-01', jurisdictions: ['PL'],
  },
  'RT001-RES-CH-LSVA-RATES': {
    sourceDate: '2025-12-01', effectiveDate: null,
    version: 'Directive 15-02 LSVA III v1.2 (December 2025)', jurisdictions: ['CH'],
  },
  'RT001-RES-LU-EUROVIGNETTE-SCOPE': {
    sourceDate: '2026-08-30', effectiveDate: null,
    version: 'Official Luxembourg Eurovignette scope captured 2026-08-30', jurisdictions: ['LU'],
  },
  'RT001-RES-LU-EUROVIGNETTE-RATES': {
    sourceDate: '2025-03-25', effectiveDate: '2025-03-25',
    version: 'Eurovignette tariff grid effective 2025-03-25', jurisdictions: ['LU'],
  },
  'RT001-RES-LU-EUROVIGNETTE-2026-ENFORCEMENT': {
    sourceDate: '2026-01-19', effectiveDate: null,
    version: 'Published 2026-01-19; updated 2026-02-10', jurisdictions: ['LU'],
  },
  'RT001-RES-DK-KMTOLL-TARIFF-V12': {
    sourceDate: '2025-11-07', effectiveDate: null,
    version: 'Annex B Tariff Table v1.2; last update 2025-11-07; Q3 2026 review due', jurisdictions: ['DK'],
  },
  'RT001-RES-NL-TRUCK-RATES-2026': {
    sourceDate: '2025-11-24', effectiveDate: '2026-07-01',
    version: 'Tariffs price level 2026; applicability 2026-07-01 through 2026-08-31', jurisdictions: ['NL'],
  },
};

const conditionedCandidateIds = [
  'RT001-RES-PL-A1-2026',
  'RT001-RES-PL-A2-2026',
  'RT001-RES-CH-LSVA-RATES',
  blockedCandidateId,
  'RT001-RES-LU-EUROVIGNETTE-RATES',
  'RT001-RES-DK-KMTOLL-TARIFF-V12',
  'RT001-RES-NL-TRUCK-RATES-2026',
];

const makeSourceObject = (candidate, decision) => {
  const meta = metadata[candidate.candidateId];
  if (!meta) throw new Error(`Missing metadata for ${candidate.candidateId}`);
  const artifact = candidate.artifact;
  return {
    sourceId: decision.proposedSourceId,
    canonicalPath: artifact.canonicalPath,
    canonicalUri: artifact.officialUrl,
    mediaType: artifact.mediaType ?? 'text/html',
    sizeBytes: artifact.sizeBytes,
    sha256: artifact.sha256,
    sourceDate: meta.sourceDate,
    effectiveDate: meta.effectiveDate,
    version: meta.version,
    status: 'EVIDENCE',
    owner: 'Mobility & Routing Steward',
    authority: {
      issuingBody: candidate.authority,
      authorityType: decision.classification,
      jurisdictions: meta.jurisdictions,
      reviewStatus: 'PRODUCT_OWNER_APPROVED_2026_08_30_WITH_EXACT_SCOPE_PRE_APPLY_NOT_PROMOTED',
      humanReviewRequired: false,
    },
    provenance: {
      importedFrom: decisionsPath,
      observedPath: artifact.canonicalPath,
      originalPreserved: true,
      libraryCopyCreated: false,
    },
    retention: {
      classification: 'PERMANENT_VERSION_AND_JURISDICTION_HISTORY',
      deleteAuthorized: false,
      historicalEvidencePreserved: true,
    },
    evidenceRefs: [decisionsPath, reviewPath, manifestPath, artifact.officialUrl],
    supersedes: [],
    supersededBy: [],
  };
};

const blueprints = review.candidates.map((candidate) => {
  const decision = decisionByCandidate.get(candidate.candidateId);
  if (!decision) throw new Error(`Missing Product Owner decision for ${candidate.candidateId}`);
  const blocked = candidate.candidateId === blockedCandidateId;
  return {
    ordinal: decision.ordinal,
    candidateId: candidate.candidateId,
    sourceId: decision.proposedSourceId,
    decision: decision.decision,
    classification: decision.classification,
    approvedScope: decision.approvedScope,
    conditionedApproval: conditionedCandidateIds.includes(candidate.candidateId),
    applyEligibility: blocked ? 'BLOCKED_BY_EVIDENCE_RECAPTURE' : 'ELIGIBLE_FOR_PRE_APPLY_STAGING_ONLY',
    artifact: blocked ? {
      status: 'INVALID_404_NOT_ELIGIBLE',
      previousCanonicalPath: candidate.artifact.canonicalPath,
      previousSha256: candidate.artifact.sha256,
      requiredReplacementSha256: null,
    } : {
      status: 'HASH_MATCH_REQUIRED',
      canonicalPath: candidate.artifact.canonicalPath,
      mediaType: candidate.artifact.mediaType ?? 'text/html',
      sizeBytes: candidate.artifact.sizeBytes,
      sha256: candidate.artifact.sha256,
    },
    proposedSourceObject: blocked ? null : makeSourceObject(candidate, decision),
  };
});

const additions = blueprints.filter((item) => item.proposedSourceObject).map((item) => item.proposedSourceObject)
  .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
const memberships = additions.map((source) => ({ membershipId: membershipId(source.sourceId), sourceId: source.sourceId }));
const projectedRegistry = {
  ...registry,
  registryVersion: '1.2.0',
  generatedAt,
  sourceCount: registry.sourceCount + additions.length,
  sources: [...registry.sources, ...additions],
};
const currentViewIds = new Set(view.memberships.map((membership) => membership.sourceId));
const projectedViewHashes = new Set([
  ...registry.sources.filter((source) => currentViewIds.has(source.sourceId)).map((source) => source.sha256),
  ...additions.map((source) => source.sha256),
]);
const projectedView = {
  ...view,
  viewVersion: '1.3.0',
  generatedAt,
  sourceCount: view.sourceCount + memberships.length,
  uniqueContentHashes: projectedViewHashes.size,
  memberships: [...view.memberships, ...memberships],
};
const projectedRegistryText = `${JSON.stringify(projectedRegistry, null, 2)}\n`;
const projectedViewText = `${JSON.stringify(projectedView, null, 2)}\n`;
const registryHashes = new Set(registry.sources.map((source) => source.sha256));

const eligibleChangeset = {
  schemaVersion: 'agm-routing-toll-001-final-owner-eligible-changeset.v1',
  generatedAt,
  status: 'INFORMATIONAL_STAGED_NOT_AUTHORIZED_NOT_EXECUTED',
  scope: 'NINE_CURRENTLY_EVIDENCED_APPROVALS_ONLY_EXCLUDES_CONDITIONED_CANDIDATE_5',
  operations: { add: additions.length, modify: 0, delete: 0 },
  classifications: {
    authoritativeWithScope: additions.filter((source) => source.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length,
    contextual: additions.filter((source) => source.authority.authorityType === 'CONTEXTUAL').length,
  },
  additions,
  routingTollMembershipAdditions: memberships,
  projected: {
    registryCount: projectedRegistry.sourceCount,
    registrySha256: sha(projectedRegistryText),
    routingTollViewCount: projectedView.sourceCount,
    routingTollViewUniqueContentHashes: projectedView.uniqueContentHashes,
    routingTollViewSha256: sha(projectedViewText),
  },
  atomicApplyAuthorized: false,
  executed: false,
};

const blockers = [{
  blockerId: 'PREAPPLY-EVIDENCE-RECAPTURE-CH-VIGNETTE-2026',
  candidateId: blockedCandidateId,
  sourceId: decisionByCandidate.get(blockedCandidateId).proposedSourceId,
  state: 'OPEN',
  reason: 'The pinned local artifact is an official-domain 404 page and cannot support the approved source object.',
  requiredForResolution: decisionByCandidate.get(blockedCandidateId).atomicApplyEvidenceRequirements,
  currentApplyEligibility: 'BLOCKED_BY_EVIDENCE_RECAPTURE',
}];

const fullImpact = {
  activationCondition: 'BLOCKER_RESOLVED_AND_SEPARATE_EXPLICIT_PRODUCT_OWNER_ATOMIC_APPLY_MANDATE',
  operations: { add: 10, modify: 0, delete: 0 },
  projectedCounts: { registry: registry.sourceCount + 10, routingTollView: view.sourceCount + 10 },
  projectedHashes: 'UNAVAILABLE_UNTIL_RECAPTURED_CANONICAL_BYTES_AND_SHA256_EXIST',
  projectedUniqueContentHashes: 'UNAVAILABLE_UNTIL_RECAPTURED_HASH_IS_TESTED_FOR_DUPLICATION',
};

mkdirSync(path.join(root, outputRoot), { recursive: true });
writeJson('ELIGIBLE_9_SOURCE_INFORMATIONAL_CHANGESET.json', eligibleChangeset);
writeJson('BLOCKERS_AND_CONDITIONS.json', {
  schemaVersion: 'agm-routing-toll-001-final-owner-blockers-conditions.v1',
  generatedAt,
  openBlockerCount: blockers.length,
  blockers,
  conditionedApprovals: blueprints.filter((item) => item.conditionedApproval).map((item) => ({
    ordinal: item.ordinal, candidateId: item.candidateId, sourceId: item.sourceId,
  })),
});
writeJson('EXACT_ATOMIC_APPLY_IMPACT.json', {
  schemaVersion: 'agm-routing-toll-001-final-owner-impact.v1',
  generatedAt,
  baseline: {
    registry: { count: registry.sourceCount, sha256: hashFile(registryPath) },
    routingTollView: { count: view.sourceCount, uniqueContentHashes: view.uniqueContentHashes, sha256: hashFile(viewPath) },
  },
  currentlyEvidencedInformationalSubset: eligibleChangeset.projected,
  currentlyEvidencedOperations: eligibleChangeset.operations,
  fullTenSourceImpactAfterBlockerResolution: fullImpact,
  protectedExistingRecords: { registrySourcesPreserved: registry.sourceCount, viewMembershipsPreserved: view.sourceCount },
});
writeJson('FINAL_PRE_APPLY_PACKAGE.json', {
  schemaVersion: 'agm-routing-toll-001-final-owner-pre-apply.v1',
  generatedAt,
  status: 'PREPARED_WITH_OPEN_EVIDENCE_BLOCKER_NOT_AUTHORIZED_NOT_EXECUTED',
  authorityReview: {
    reference: decisionsPath,
    decisions: 10,
    approved: 10,
    authoritativeWithScope: 9,
    contextual: 1,
    rejected: 0,
    deferred: 0,
    pending: 0,
    stopped: true,
  },
  decisionRegisterSha256: hashFile(decisionsPath),
  ownerReviewPackageSha256: hashFile(reviewPath),
  approvalVsApplyEligibility: {
    productOwnerApproved: 10,
    eligibleForInformationalPreApplyStaging: 9,
    blockedFromApply: 1,
  },
  blueprints,
  blockers,
  impact: {
    currentlyEvidencedInformationalSubset: {
      operations: eligibleChangeset.operations,
      projected: eligibleChangeset.projected,
    },
    fullTenSourceAfterBlockerResolution: fullImpact,
  },
  guardrails: {
    registryMutation: 'NONE',
    routingTollViewMutation: 'NONE',
    authorityPromotion: 'NONE',
    runtimeProduction: 'NO_CHANGE',
    commitPush: 'NOT_EXECUTED',
    atomicApplyAuthorized: false,
    atomicApplyRequiresSeparateProductOwnerMandate: true,
  },
});

const report = `# ROUTING-TOLL-001 — Final Product Owner pre-apply package (10/10)\n\n` +
`Status: \`PREPARED WITH OPEN EVIDENCE BLOCKER / NOT AUTHORIZED / NOT EXECUTED\`\n\n` +
`## Authority decisions\n\n` +
`- Product Owner decisions: \`10/10 APPROVE\`;\n` +
`- classifications: \`9 AUTHORITATIVE_WITH_SCOPE + 1 CONTEXTUAL\`;\n` +
`- rejected/deferred/pending: \`0/0/0\`.\n\n` +
`## Apply eligibility\n\n` +
`- evidenced informational staging: \`9/10\`;\n` +
`- blocked: \`1/10\` — Swiss 2026 vignette canonical evidence recapture;\n` +
`- full atomic apply remains blocked and requires a separate Product Owner mandate after blocker resolution.\n\n` +
`## Exact impact\n\n` +
`- current baseline Registry/view: \`${registry.sourceCount}/${view.sourceCount}\`;\n` +
`- evidenced nine-source projection: \`${projectedRegistry.sourceCount}/${projectedView.sourceCount}\`, ADD/MODIFY/DELETE \`9/0/0\`;\n` +
`- full ten-source projection after recapture: \`${registry.sourceCount + 10}/${view.sourceCount + 10}\`, ADD/MODIFY/DELETE \`10/0/0\`;\n` +
`- full projected hashes are intentionally unavailable until the replacement canonical artifact and SHA-256 exist.\n\n` +
`Registry/view, authority promotion, runtime/Production and commit/push remain unchanged.\n`;
writeFileSync(path.join(root, outputRoot, 'FINAL_PRE_APPLY_REPORT.md'), report, 'utf8');

console.log(JSON.stringify({
  status: 'PREPARED_WITH_OPEN_EVIDENCE_BLOCKER',
  decisions: '10/10 APPROVE',
  classifications: '9/1',
  eligibleInformationalSubset: additions.length,
  blocked: blockers.length,
  projectedNine: eligibleChangeset.projected,
  projectedTenCounts: fullImpact.projectedCounts,
  existingHashDuplicatesAmongEligible: additions.filter((source) => registryHashes.has(source.sha256)).length,
  executed: false,
}, null, 2));
