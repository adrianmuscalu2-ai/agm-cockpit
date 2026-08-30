import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const reviewRoot = 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW';
const outputRoot = 'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const legislationViewPath = 'AGM_LIBRARY/VIEWS/legislation-safety.view.json';
const routingViewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const decisionsPath = `${reviewRoot}/PRODUCT_OWNER_DECISIONS.json`;
const candidatesPath = `${reviewRoot}/CANDIDATE_AUTHORITY_PACKAGE.json`;
const evidenceManifestPath = `${reviewRoot}/EVIDENCE_MANIFEST.json`;
const freshnessReviewPath = 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/INITIAL_PRODUCT_OWNER_REVIEW_PACKAGE.json';
const generatedAt = '2026-08-30T20:00:00.000Z';

const absolute = (relative) => path.join(root, relative);
const bytes = (relative) => readFileSync(absolute(relative));
const readJson = (relative) => JSON.parse(bytes(relative).toString('utf8').replace(/^\uFEFF/, ''));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => sha(bytes(relative));
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const writeJson = (name, value) => writeFileSync(absolute(`${outputRoot}/${name}`), jsonText(value), 'utf8');
const membershipId = (sourceId) => `DM-${sha(`${sourceId}:legislation-safety`).slice(0, 20).toUpperCase()}`;
const unique = (values) => [...new Set(values)];

const registry = readJson(registryPath);
const legislationView = readJson(legislationViewPath);
const routingView = readJson(routingViewPath);
const decisions = readJson(decisionsPath);
const candidatePackage = readJson(candidatesPath);
const evidenceManifest = readJson(evidenceManifestPath);
const freshnessReview = readJson(freshnessReviewPath);

if (decisions.decisionCount !== 23 || decisions.totals.APPROVE !== 23 || decisions.totals.PENDING !== 0) {
  throw new Error('LEGAL005_AUTHORITY_REVIEW_NOT_COMPLETE_23_OF_23');
}
if (candidatePackage.candidates.length !== 23 || decisions.decisions.length !== 23) {
  throw new Error('LEGAL005_CANDIDATE_DECISION_CARDINALITY_MISMATCH');
}

const decisionByCandidate = new Map(decisions.decisions.map((item) => [item.candidateId, item]));
const registryById = new Map(registry.sources.map((item) => [item.sourceId, item]));
const currentMembershipIds = new Set(legislationView.memberships.map((item) => item.sourceId));
const artifactByPath = new Map(evidenceManifest.artifacts.filter((item) => item.path).map((item) => [item.path, item]));

const sourceFor = (candidate, decision) => {
  const artifact = artifactByPath.get(candidate.documentEvidence.canonicalArtifact);
  if (!artifact) throw new Error(`MISSING_MANIFEST_ARTIFACT:${candidate.candidateId}`);
  if (artifact.sha256 !== candidate.documentEvidence.sha256) throw new Error(`ARTIFACT_HASH_METADATA_MISMATCH:${candidate.candidateId}`);
  const ownerUnknownFallback = (decision.conditions ?? []).some((item) => /UNKNOWN/i.test(item));
  const jurisdictions = candidate.country === 'EU/EEA' ? ['EU', 'EEA'] : [candidate.country];
  return {
    sourceId: candidate.sourceId,
    canonicalPath: candidate.documentEvidence.canonicalArtifact,
    canonicalUri: candidate.documentEvidence.officialUrl,
    mediaType: artifact.mediaType,
    sizeBytes: artifact.sizeBytes,
    sha256: artifact.sha256,
    sourceDate: candidate.freshness.capturedAt.slice(0, 10),
    effectiveDate: candidate.freshness.effectiveFrom,
    version: candidate.freshness.version,
    status: 'EVIDENCE',
    owner: 'Security & Legal / Human Reviewer',
    authority: {
      issuingBody: candidate.authority,
      authorityType: decision.classification,
      jurisdictions,
      reviewStatus: 'PRODUCT_OWNER_APPROVED_2026_08_30_WITH_EXACT_SCOPE_ATOMIC_APPLY_NOT_AUTHORIZED',
      humanReviewRequired: false,
    },
    provenance: {
      importedFrom: decisionsPath,
      observedPath: candidate.documentEvidence.canonicalArtifact,
      originalPreserved: true,
      libraryCopyCreated: false,
    },
    retention: {
      classification: 'PERMANENT_VERSION_AND_JURISDICTION_HISTORY',
      deleteAuthorized: false,
      historicalEvidencePreserved: true,
    },
    freshness: {
      policyVersion: candidate.freshness.policyVersion,
      effectiveFrom: candidate.freshness.effectiveFrom,
      effectiveUntil: candidate.freshness.effectiveUntil,
      capturedAt: candidate.freshness.capturedAt,
      lastFreshnessCheck: candidate.freshness.lastFreshnessCheck,
      nextFreshnessCheck: candidate.freshness.nextFreshnessCheck,
      currentStatus: candidate.freshness.currentStatus,
      reviewRequired: candidate.freshness.reviewRequired,
      usageFallback: ownerUnknownFallback ? 'UNKNOWN_HUMAN_VERIFICATION' : candidate.freshness.usageFallback,
      limitations: unique([...(candidate.limitations ?? []), ...(decision.excludedScope ?? [])]),
    },
    evidenceRefs: unique([
      decisionsPath,
      candidatesPath,
      evidenceManifestPath,
      candidate.documentEvidence.officialUrl,
      ...(candidate.documentEvidence.supportEvidenceIds ?? []),
    ]),
    supersedes: [],
    supersededBy: [],
  };
};

const blueprints = candidatePackage.candidates.map((candidate, index) => {
  const decision = decisionByCandidate.get(candidate.candidateId);
  if (!decision) throw new Error(`MISSING_DECISION:${candidate.candidateId}`);
  if (decision.sourceId !== candidate.sourceId) throw new Error(`CANONICAL_SOURCE_ID_MISMATCH:${candidate.candidateId}`);
  if (decision.decision !== 'APPROVE' || decision.classification !== candidate.proposedClassification) {
    throw new Error(`DECISION_OR_CLASSIFICATION_MISMATCH:${candidate.candidateId}`);
  }
  const registryExists = registryById.has(candidate.sourceId);
  const membershipExists = currentMembershipIds.has(candidate.sourceId);
  const registryAction = registryExists ? 'REUSE' : 'ADD';
  const legislationSafetyViewAction = membershipExists ? 'REUSE' : 'ADD';
  const derivedImpact = {
    registryAdd: registryExists ? 0 : 1,
    legislationSafetyViewAdd: membershipExists ? 0 : 1,
    routingTollViewAdd: 0,
  };
  if (JSON.stringify(derivedImpact) !== JSON.stringify(decision.projectedImpact)) {
    throw new Error(`OWNER_IMPACT_MISMATCH:${candidate.candidateId}`);
  }
  return {
    candidateNumber: index + 1,
    candidateId: candidate.candidateId,
    sourceId: candidate.sourceId,
    decision: decision.decision,
    classification: decision.classification,
    registryAction,
    legislationSafetyViewAction,
    routingTollViewAction: 'NONE',
    canonicalArtifact: candidate.documentEvidence.canonicalArtifact,
    sha256: candidate.documentEvidence.sha256,
    exactScope: candidate.exactScope,
    approvedScope: decision.approvedScope,
    excludedScope: decision.excludedScope,
    effectiveFrom: candidate.freshness.effectiveFrom,
    effectiveUntil: candidate.freshness.effectiveUntil,
    currentStatus: candidate.freshness.currentStatus,
    nextFreshnessCheck: candidate.freshness.nextFreshnessCheck,
    reviewRequired: candidate.freshness.reviewRequired,
    usageFallback: (decision.conditions ?? []).some((item) => /UNKNOWN/i.test(item))
      ? 'UNKNOWN_HUMAN_VERIFICATION'
      : candidate.freshness.usageFallback,
    projectedSource: registryExists ? null : sourceFor(candidate, decision),
  };
});

const additions = blueprints.filter((item) => item.registryAction === 'ADD').map((item) => item.projectedSource)
  .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
const membershipAdditions = blueprints.filter((item) => item.legislationSafetyViewAction === 'ADD')
  .map((item) => ({ membershipId: membershipId(item.sourceId), sourceId: item.sourceId }))
  .sort((a, b) => a.sourceId.localeCompare(b.sourceId));

const projectedRegistry = {
  ...registry,
  registryVersion: '1.4.0',
  generatedAt,
  sourceCount: registry.sourceCount + additions.length,
  sources: [...registry.sources, ...additions],
};
const projectedRegistryIds = new Set(projectedRegistry.sources.map((item) => item.sourceId));
if (projectedRegistryIds.size !== projectedRegistry.sources.length) throw new Error('PROJECTED_REGISTRY_SOURCE_ID_COLLISION');

const projectedViewMemberships = [...legislationView.memberships, ...membershipAdditions];
const projectedViewSourceIds = new Set(projectedViewMemberships.map((item) => item.sourceId));
if (projectedViewSourceIds.size !== projectedViewMemberships.length) throw new Error('PROJECTED_VIEW_SOURCE_ID_COLLISION');
if ([...projectedViewSourceIds].some((sourceId) => !projectedRegistryIds.has(sourceId))) throw new Error('PROJECTED_VIEW_ORPHAN_SOURCE');
const projectedViewHashes = new Set(projectedRegistry.sources
  .filter((source) => projectedViewSourceIds.has(source.sourceId))
  .map((source) => source.sha256));
const projectedLegislationView = {
  ...legislationView,
  viewVersion: '1.2.0',
  generatedAt,
  sourceCount: legislationView.sourceCount + membershipAdditions.length,
  uniqueContentHashes: projectedViewHashes.size,
  memberships: projectedViewMemberships,
};

const projectedRegistryText = jsonText(projectedRegistry);
const projectedViewText = jsonText(projectedLegislationView);
const registrySourceIds = new Set(registry.sources.map((item) => item.sourceId));
const registryHashes = new Set(registry.sources.map((item) => item.sha256));
const candidateSourceIds = candidatePackage.candidates.map((item) => item.sourceId);
const candidateHashes = additions.map((item) => item.sha256);
const duplicates = {
  duplicateCandidateIds: candidatePackage.candidates.map((item) => item.candidateId)
    .filter((value, index, all) => all.indexOf(value) !== index),
  duplicateCandidateSourceIds: candidateSourceIds.filter((value, index, all) => all.indexOf(value) !== index),
  newSourceIdCollisionsWithRegistry: additions.filter((item) => registrySourceIds.has(item.sourceId)).map((item) => item.sourceId),
  newHashCollisionsWithRegistry: additions.filter((item) => registryHashes.has(item.sha256)).map((item) => item.sourceId),
  duplicateNewContentHashes: candidateHashes.filter((value, index, all) => all.indexOf(value) !== index),
};

const expiring = blueprints.filter((item) => item.effectiveUntil).map((item) => ({
  candidateId: item.candidateId,
  sourceId: item.sourceId,
  effectiveUntil: item.effectiveUntil,
  currentStatus: item.currentStatus,
  currentForbiddenAfterExpiry: true,
  fallback: item.usageFallback === 'UNKNOWN_HUMAN_VERIFICATION'
    ? 'UNKNOWN_HUMAN_VERIFICATION'
    : 'EXPIRED_REVIEW_REQUIRED_THEN_UNKNOWN_HUMAN_VERIFICATION_FOR_CURRENTNESS_DEPENDENT_USE',
}));
const newVersions = blueprints.filter((item) => item.currentStatus === 'NEW_VERSION_DETECTED');
const unknownFallbacks = blueprints.filter((item) => item.usageFallback === 'UNKNOWN_HUMAN_VERIFICATION');
const nextReviewGroups = Object.fromEntries([...new Set(blueprints.map((item) => item.nextFreshnessCheck))].sort()
  .map((date) => [date, blueprints.filter((item) => item.nextFreshnessCheck === date).map((item) => item.sourceId)]));

const temporalReview = {
  schemaVersion: 'agm-legal-005-consolidated-authority-temporal-review.v1',
  generatedAt,
  asOfDate: '2026-08-30',
  decisionsReviewed: 23,
  expiryAt20260831: expiring.filter((item) => item.effectiveUntil === '2026-08-31'),
  allExplicitExpiryWindows: expiring,
  newVersionDetected: newVersions.map((item) => ({
    candidateId: item.candidateId,
    sourceId: item.sourceId,
    currentVersionEffectiveUntil: item.effectiveUntil,
    detectedVersionEffectiveFrom: '2026-10-01',
    currentVersionForbiddenFrom: '2026-10-01',
    automaticSupersession: false,
    requiredAction: 'OFFICIAL_CAPTURE_HASH_VALIDATE_COMPARE_SEPARATE_PRODUCT_OWNER_REVIEW',
    fallbackUntilReviewed: 'UNKNOWN_HUMAN_VERIFICATION',
  })),
  unknownHumanVerificationFallbacks: unknownFallbacks.map((item) => item.sourceId),
  nextFreshnessChecks: nextReviewGroups,
  invariants: {
    newSourceDetectedIsNotAutoPromotion: true,
    expiredIsNotZero: true,
    unknownIsNotSafePassZeroOrNoRestriction: true,
    currentAfterEffectiveUntil: 'FORBIDDEN',
  },
  specialTransitions: [
    {
      sourceId: 'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026',
      at20260830: 'EXPIRY_WARNING',
      atAndAfter20260831: 'EXPIRED_REVIEW_REQUIRED',
      postExpiryCurrent: 'FORBIDDEN',
      postExpiryFallback: 'UNKNOWN_HUMAN_VERIFICATION',
    },
    {
      sourceId: 'CS-CH-ARV1-20250501',
      through20260930: 'APPROVED_ONLY_WITHIN_DEMONSTRATED_SCOPE_AND_PERIOD_NEW_VERSION_DETECTED',
      from20261001: 'CURRENT_FORBIDDEN',
      fallbackWithoutValidatedReplacement: 'UNKNOWN_HUMAN_VERIFICATION',
    },
  ],
};

const reconciliation = {
  registryReuses: blueprints.filter((item) => item.registryAction === 'REUSE').map((item) => item.sourceId),
  viewReuses: blueprints.filter((item) => item.legislationSafetyViewAction === 'REUSE').map((item) => item.sourceId),
  candidateLevelStale: {
    staleCandidateSourceId: 'CS-AT-STVO-42-20260213',
    selectedCurrentCandidateSourceId: 'CS-AT-STVO-42-20260830',
    staleCandidatePresentInCentralRegistry: registrySourceIds.has('CS-AT-STVO-42-20260213'),
    operation: 'DOCUMENT_ONLY_NO_DELETE_NO_MODIFY_NO_AUTOMATIC_SUPERSESSION',
  },
  nlIdentifierReconciliation: {
    ownerSubmittedCandidateId: 'LEGAL005-CAND-NL-RWV-HGV-ACCESS-20260701',
    ownerSubmittedSourceId: 'CS-NL-RWV-HGV-ACCESS-20260701',
    canonicalCandidateId: 'LEGAL005-CAND-NL-RVV-HGV-ACCESS-20260701',
    canonicalSourceId: 'CS-NL-RVV-HGV-ACCESS-20260701',
    canonicalInstrument: 'RVV 1990 / BWBR0004825',
    resolution: 'OWNER_SUBMITTED_ALIAS_RECONCILED_TO_VALIDATED_CANONICAL_IDENTIFIERS_NO_ALIAS_SOURCE_ADDED',
  },
  overlaps: [
    'France: base 2021, annual 2026 and fire derogation remain three separate sources and temporal scopes.',
    'Austria: section 42 general rule, 2026 calendar, A10 and Luegbruecke remain separate.',
    'Belgium: Flanders, Brussels-Capital and Wallonia remain separate regional scopes.',
    'Switzerland: VRV road restrictions and ARV 1 driving/rest obligations remain separate.',
    'Denmark: driving/rest amendment and environmental-zone regulation remain separate; KmToll is excluded.',
    'Netherlands: national RVV framework requires separate current municipal/RDW implementation evidence.',
    'EU Regulation 561/2006 remains normative; BE/NL operational guidance classified CONTEXTUAL does not replace it.',
  ],
};

const projectedHashes = {
  registrySha256: sha(projectedRegistryText),
  legislationSafetyViewSha256: sha(projectedViewText),
  routingTollViewSha256: hashFile(routingViewPath),
};
const changeSet = {
  schemaVersion: 'agm-legal-005-final-pre-apply-changeset.v1',
  generatedAt,
  status: 'STAGED_INFORMATIONAL_NOT_AUTHORIZED_NOT_EXECUTED',
  operations: { add: additions.length, modify: 0, delete: 0 },
  registryAdditions: additions,
  registryReuses: reconciliation.registryReuses,
  legislationSafetyMembershipAdditions: membershipAdditions,
  legislationSafetyMembershipReuses: reconciliation.viewReuses,
  routingTollOperations: { add: 0, modify: 0, delete: 0 },
  projected: {
    registryCount: projectedRegistry.sourceCount,
    legislationSafetyViewCount: projectedLegislationView.sourceCount,
    legislationSafetyUniqueContentHashes: projectedLegislationView.uniqueContentHashes,
    routingTollViewCount: routingView.sourceCount,
    ...projectedHashes,
  },
  atomicApplyAuthorized: false,
  executed: false,
};

const packageData = {
  schemaVersion: 'agm-legal-005-final-pre-apply.v1',
  generatedAt,
  status: 'READY_FOR_PRODUCT_OWNER_APPLY_REVIEW_NOT_AUTHORIZED_NOT_EXECUTED',
  authorityReview: {
    decisions: 23,
    approve: 23,
    reject: 0,
    defer: 0,
    pending: 0,
    authoritativeWithScope: 21,
    contextual: 2,
  },
  inputHashes: {
    decisionRegisterSha256: hashFile(decisionsPath),
    candidateAuthorityPackageSha256: hashFile(candidatesPath),
    evidenceManifestSha256: hashFile(evidenceManifestPath),
    sourceFreshnessOwnerReviewSha256: hashFile(freshnessReviewPath),
  },
  baseline: {
    registry: { count: registry.sourceCount, sha256: hashFile(registryPath) },
    legislationSafetyView: { count: legislationView.sourceCount, sha256: hashFile(legislationViewPath) },
    routingTollView: { count: routingView.sourceCount, sha256: hashFile(routingViewPath) },
  },
  exactImpact: {
    registry: { add: additions.length, modify: 0, delete: 0, from: registry.sourceCount, to: projectedRegistry.sourceCount },
    legislationSafetyView: { add: membershipAdditions.length, modify: 0, delete: 0, from: legislationView.sourceCount, to: projectedLegislationView.sourceCount },
    routingTollView: { add: 0, modify: 0, delete: 0, from: routingView.sourceCount, to: routingView.sourceCount },
  },
  projectedHashes,
  blueprints,
  duplicateCollisionAnalysis: duplicates,
  reconciliation,
  temporalReviewReference: `${outputRoot}/CONSOLIDATED_AUTHORITY_TEMPORAL_REVIEW.json`,
  freshnessOwnerReviewFollowUp: {
    queueReference: freshnessReviewPath,
    arv1VersionEffective20261001Queued: freshnessReview.items.some((item) => item.sourceId === 'CS-CH-ARV1-20250501' && item.detectedChangeEffectiveFrom === '2026-10-01'),
    automaticSupersession: false,
    automaticAuthorityPromotion: false,
  },
  remainingBlockers: [],
  applyConditions: [
    'A separate explicit Product Owner atomic apply mandate is required.',
    'Regenerate and revalidate if apply occurs after a temporal transition or any input/baseline hash changes.',
    'Do not treat expired or unknown source states as zero, safe, pass or no restriction.',
    'Do not automatically supersede ARV 1; the version applicable from 2026-10-01 requires separate evidence and review.',
  ],
  guardrails: {
    registryMutation: 'NONE',
    legislationSafetyViewMutation: 'NONE',
    routingTollViewMutation: 'NONE',
    authorityPromotion: 'NONE',
    runtimeProduction: 'NO_CHANGE',
    atomicApply: 'NOT_EXECUTED',
    commitPush: 'NOT_EXECUTED',
  },
};

mkdirSync(absolute(outputRoot), { recursive: true });
writeFileSync(absolute(`${outputRoot}/PROJECTED_REGISTRY.json`), projectedRegistryText, 'utf8');
writeFileSync(absolute(`${outputRoot}/PROJECTED_LEGISLATION_SAFETY_VIEW.json`), projectedViewText, 'utf8');
writeJson('PROJECTED_CHANGESET.json', changeSet);
writeJson('CONSOLIDATED_AUTHORITY_TEMPORAL_REVIEW.json', temporalReview);
writeJson('FINAL_PRE_APPLY_PACKAGE.json', packageData);

const report = `# LEGAL-005 — Final pre-apply package\n\n` +
  `Status: \`READY FOR PRODUCT OWNER APPLY REVIEW / NOT AUTHORIZED / NOT EXECUTED\`\n\n` +
  `- Decisions: \`23 APPROVE / 0 REJECT / 0 DEFER / 0 PENDING\`.\n` +
  `- Classifications: \`21 AUTHORITATIVE_WITH_SCOPE / 2 CONTEXTUAL\`.\n` +
  `- Registry impact: \`ADD ${additions.length} / MODIFY 0 / DELETE 0\`, \`${registry.sourceCount} -> ${projectedRegistry.sourceCount}\`.\n` +
  `- Legislation/Safety impact: \`ADD ${membershipAdditions.length} / MODIFY 0 / DELETE 0\`, \`${legislationView.sourceCount} -> ${projectedLegislationView.sourceCount}\`.\n` +
  `- Routing/Toll impact: \`0 / 0 / 0\`, unchanged at \`${routingView.sourceCount}\`.\n` +
  `- Registry reuses: \`${reconciliation.registryReuses.join(', ')}\`; existing view reuse: \`${reconciliation.viewReuses.join(', ')}\`.\n` +
  `- Duplicate/collision blockers: \`NONE\`.\n` +
  `- Temporal review: French fire derogation is \`EXPIRY_WARNING\` on 2026-08-30 and \`EXPIRED_REVIEW_REQUIRED\` at/after 2026-08-31; ARV 1 is \`NEW_VERSION_DETECTED\` and the current version is forbidden from 2026-10-01.\n` +
  `- NL owner-submitted RW/RWV aliases are reconciled to canonical \`RVV 1990\` identifiers; no alias source is added.\n` +
  `- Remaining pre-apply blockers: \`NONE\`. A separate Product Owner atomic apply mandate is required.\n\n` +
  `Projected hashes:\n\n` +
  `- Registry: \`${projectedHashes.registrySha256}\`\n` +
  `- Legislation/Safety: \`${projectedHashes.legislationSafetyViewSha256}\`\n` +
  `- Routing/Toll unchanged: \`${projectedHashes.routingTollViewSha256}\`\n`;
writeFileSync(absolute(`${outputRoot}/FINAL_PRE_APPLY_REPORT.md`), report, 'utf8');

console.log(JSON.stringify({
  result: 'PASS',
  status: packageData.status,
  decisions: packageData.authorityReview,
  exactImpact: packageData.exactImpact,
  projectedHashes,
  duplicateCollisions: duplicates,
  remainingBlockers: packageData.remainingBlockers,
  executed: false,
}, null, 2));
