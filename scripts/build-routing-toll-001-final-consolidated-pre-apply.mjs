import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CONSOLIDATED_PRE_APPLY';
const evidenceRoot = `${outputRoot}/EVIDENCE`;
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const decisionsPath = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION/PRODUCT_OWNER_AUTHORITY_DECISIONS.json';
const reviewPath = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION/OWNER_AUTHORITY_REVIEW_PACKAGE.json';
const priorManifestPath = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CONTINUATION_READ_ONLY/RESIDUAL_REMOTE_ACQUISITION_MANIFEST.json';
const freshnessPolicyPath = 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/STATE_MACHINE_AND_POLICY.md';
const browserReportPath = `${evidenceRoot}/CH_VIGNETTE_BROWSER_CAPTURE_REPORT.json`;
const generatedAt = '2026-08-30T13:30:00.000Z';

const readBytes = (relative) => readFileSync(path.join(root, relative));
const readJson = (relative) => JSON.parse(readBytes(relative).toString('utf8').replace(/^\uFEFF/, ''));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => sha(readBytes(relative));
const sizeFile = (relative) => readBytes(relative).length;
const membershipId = (sourceId) => `DM-${sha(`${sourceId}:routing-toll`).slice(0, 20).toUpperCase()}`;
const writeJson = (name, value) => writeFileSync(path.join(root, outputRoot, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const registry = readJson(registryPath);
const view = readJson(viewPath);
const decisions = readJson(decisionsPath);
const review = readJson(reviewPath);
const browserReport = readJson(browserReportPath);
const decisionByCandidate = new Map(decisions.decisions.map((decision) => [decision.candidateId, decision]));

const chArtifacts = {
  primary: {
    canonicalPath: `${evidenceRoot}/RT001-RES-CH-VIGNETTE-2026.bazg-support.official.html`,
    officialUrl: 'https://www.bazg.admin.ch/en/faq-vignette-and-e-vignette-purchase',
    mediaType: 'text/html',
  },
  viaProduct: {
    canonicalPath: `${evidenceRoot}/RT001-RES-CH-VIGNETTE-2026.via-product.official.js`,
    officialUrl: 'https://via.admin.ch/shop/main-42DWTXKQ.js',
    mediaType: 'text/javascript',
  },
  renderedReview: {
    canonicalPath: `${evidenceRoot}/RT001-RES-CH-VIGNETTE-2026.via-rendered.official.html`,
    mediaType: 'text/html',
  },
  renderedText: {
    canonicalPath: `${evidenceRoot}/RT001-RES-CH-VIGNETTE-2026.via-rendered.official.txt`,
    mediaType: 'text/plain',
  },
  screenshot: {
    canonicalPath: `${evidenceRoot}/RT001-RES-CH-VIGNETTE-2026.via-rendered.official.png`,
    mediaType: 'image/png',
  },
};
for (const artifact of Object.values(chArtifacts)) {
  artifact.sizeBytes = sizeFile(artifact.canonicalPath);
  artifact.sha256 = hashFile(artifact.canonicalPath);
}

if (browserReport.verdict !== 'PASS' || browserReport.checks.some((item) => !item.pass)) {
  throw new Error('CH_VIGNETTE_BROWSER_EVIDENCE_NOT_PASS');
}
if (chArtifacts.primary.sha256 !== 'fc6f19ae9ec162f08542bca6fbfc065ddb7d3939567bf04bd91682ffa7350ffc') {
  throw new Error('CH_VIGNETTE_BAZG_HASH_DRIFT');
}
if (chArtifacts.viaProduct.sha256 !== '9075cfb58828ffae99b55f65f2123b1b097d56127e9395b0f449bb1c7f75da07') {
  throw new Error('CH_VIGNETTE_VIA_HASH_DRIFT');
}

const metadata = {
  'RT001-RES-PL-A1-2026': metadataRecord('2026-08-30', null, null, 'Official AmberOne tariff surface captured 2026-08-30; effectivity not stated', ['PL'], 'BEFORE_USE', 'CURRENT'),
  'RT001-RES-PL-A2-2026': metadataRecord('2026-08-30', null, null, 'Official A2 tariff PDF captured 2026-08-30; effective period bounded by document', ['PL'], 'BEFORE_USE_IF_EFFECTIVITY_NOT_EXPLICIT', 'CURRENT'),
  'RT001-RES-PL-A4-2026': metadataRecord('2026-04-01', '2026-04-01', null, 'Tariffs effective 2026-04-01', ['PL'], null, 'CURRENT'),
  'RT001-RES-CH-LSVA-RATES': metadataRecord('2025-12-01', null, null, 'Directive 15-02 LSVA III v1.2 (December 2025)', ['CH'], 'BEFORE_USE_IF_APPLICABILITY_NOT_DEMONSTRATED', 'CURRENT'),
  'RT001-RES-CH-VIGNETTE-2026': metadataRecord('2026-08-30', '2025-12-01', '2027-01-31', 'E-vignette 2026; CHF 40; valid 2025-12-01 through 2027-01-31', ['CH'], '2027-01-01', 'CURRENT'),
  'RT001-RES-LU-EUROVIGNETTE-SCOPE': metadataRecord('2026-08-30', null, null, 'Official Luxembourg Eurovignette scope captured 2026-08-30', ['LU'], 'BEFORE_USE', 'CURRENT'),
  'RT001-RES-LU-EUROVIGNETTE-RATES': metadataRecord('2025-03-25', '2025-03-25', null, 'Eurovignette tariff grid effective 2025-03-25', ['LU'], 'BEFORE_USE', 'CURRENT'),
  'RT001-RES-LU-EUROVIGNETTE-2026-ENFORCEMENT': metadataRecord('2026-01-19', null, null, 'Published 2026-01-19; updated 2026-02-10', ['LU'], null, 'CURRENT'),
  'RT001-RES-DK-KMTOLL-TARIFF-V12': metadataRecord('2025-11-07', null, null, 'Annex B Tariff Table v1.2; last update 2025-11-07; Q3 2026 review due', ['DK'], '2026-09-30', 'CURRENT'),
  'RT001-RES-NL-TRUCK-RATES-2026': metadataRecord('2025-11-24', '2026-07-01', '2026-08-31', 'Tariffs price level 2026; applicability 2026-07-01 through 2026-08-31', ['NL'], '2026-08-31', 'EXPIRY_WARNING'),
};

const reviewByCandidate = new Map(review.candidates.map((candidate) => [candidate.candidateId, candidate]));
const blueprints = decisions.decisions.map((decision) => {
  const candidate = reviewByCandidate.get(decision.candidateId);
  if (!candidate) throw new Error(`MISSING_REVIEW_CANDIDATE:${decision.candidateId}`);
  const isVignette = decision.candidateId === 'RT001-RES-CH-VIGNETTE-2026';
  const artifact = isVignette ? chArtifacts.primary : {
    canonicalPath: candidate.artifact.canonicalPath,
    officialUrl: candidate.artifact.officialUrl,
    mediaType: candidate.artifact.mediaType ?? 'text/html',
    sizeBytes: candidate.artifact.sizeBytes,
    sha256: candidate.artifact.sha256,
  };
  if (hashFile(artifact.canonicalPath) !== artifact.sha256 || sizeFile(artifact.canonicalPath) !== artifact.sizeBytes) {
    throw new Error(`ARTIFACT_HASH_OR_SIZE_MISMATCH:${decision.candidateId}`);
  }
  const source = makeSourceObject(candidate, decision, artifact, metadata[decision.candidateId], isVignette);
  return {
    ordinal: decision.ordinal,
    candidateId: decision.candidateId,
    sourceId: decision.proposedSourceId,
    decision: decision.decision,
    classification: decision.classification,
    approvedScope: decision.approvedScope,
    applyCondition: isVignette ? 'SATISFIED' : (decision.applyCondition ?? null),
    applyEligibility: 'ELIGIBLE_FOR_PRODUCT_OWNER_APPLY_REVIEW_NOT_AUTHORIZED',
    artifact: {
      status: 'HASH_MATCH_PASS',
      canonicalPath: artifact.canonicalPath,
      officialUrl: artifact.officialUrl,
      mediaType: artifact.mediaType,
      sizeBytes: artifact.sizeBytes,
      sha256: artifact.sha256,
      supportingArtifacts: isVignette ? Object.entries(chArtifacts).filter(([name]) => name !== 'primary').map(([role, value]) => ({ role, ...value })) : [],
    },
    productOwnerDecisionSnapshot: decision,
    proposedSourceObject: source,
  };
});

const additions = blueprints.map((item) => item.proposedSourceObject).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
const memberships = additions.map((source) => ({ membershipId: membershipId(source.sourceId), sourceId: source.sourceId }));
const projectedRegistry = {
  ...registry,
  registryVersion: '1.3.0',
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
const registryIds = new Set(registry.sources.map((source) => source.sourceId));
const registryHashes = new Set(registry.sources.map((source) => source.sha256));
const registryUris = new Set(registry.sources.map((source) => source.canonicalUri));
const viewMembershipIds = new Set(view.memberships.map((membership) => membership.membershipId));
const artifactInventory = blueprints.flatMap((item) => [
  { candidateId: item.candidateId, role: 'primary', path: item.artifact.canonicalPath, officialUrl: item.artifact.officialUrl, mediaType: item.artifact.mediaType, sizeBytes: item.artifact.sizeBytes, sha256: item.artifact.sha256 },
  ...item.artifact.supportingArtifacts.map((artifact) => ({ candidateId: item.candidateId, ...artifact, path: artifact.canonicalPath })),
]);

const collisionChecks = {
  sourceIdsUniqueWithinAdditions: new Set(additions.map((source) => source.sourceId)).size === additions.length,
  sourceIdsAbsentFromRegistry: additions.every((source) => !registryIds.has(source.sourceId)),
  membershipIdsUniqueWithinAdditions: new Set(memberships.map((item) => item.membershipId)).size === memberships.length,
  membershipIdsAbsentFromView: memberships.every((item) => !viewMembershipIds.has(item.membershipId)),
  primaryHashesUniqueWithinAdditions: new Set(additions.map((source) => source.sha256)).size === additions.length,
  primaryHashesAbsentFromRegistry: additions.every((source) => !registryHashes.has(source.sha256)),
  canonicalUrisUniqueWithinAdditions: new Set(additions.map((source) => source.canonicalUri)).size === additions.length,
  canonicalUrisAbsentFromRegistry: additions.every((source) => !registryUris.has(source.canonicalUri)),
};
if (Object.values(collisionChecks).some((pass) => !pass)) throw new Error('FINAL_CHANGESET_COLLISION');

const recaptureManifest = {
  schemaVersion: 'agm-ch-vignette-2026-recapture.v1',
  generatedAt,
  blockerId: 'PREAPPLY-EVIDENCE-RECAPTURE-CH-VIGNETTE-2026',
  candidateId: 'RT001-RES-CH-VIGNETTE-2026',
  sourceId: 'CS-CH-BAZG-MOTORWAY-VIGNETTE-2026',
  blockerState: 'RESOLVED',
  applyCondition: 'SATISFIED',
  officialProvenanceOnly: true,
  validatedClaims: browserReport.reconciledClaim,
  browserEvidence: {
    reportPath: browserReportPath,
    reportSha256: hashFile(browserReportPath),
    browserPluginStatus: browserReport.browserPluginStatus,
    integratedBrowserControlStatus: browserReport.integratedBrowserControlStatus,
    browserSessionStatus: browserReport.browserSessionStatus,
    targetPageStatus: browserReport.targetPageStatus,
  },
  artifacts: artifactInventory.filter((item) => item.candidateId === 'RT001-RES-CH-VIGNETTE-2026'),
  priorInvalidArtifact: {
    preservedInPriorHistoricalPackage: true,
    reused: false,
    reason: 'Official-domain 404 artifact was not reused in this recapture.',
  },
};

const changeset = {
  schemaVersion: 'agm-routing-toll-001-final-consolidated-changeset.v1',
  generatedAt,
  status: 'FINAL_PRE_APPLY_INFORMATIONAL_NOT_AUTHORIZED_NOT_EXECUTED',
  operations: { add: additions.length, modify: 0, delete: 0 },
  classifications: {
    authoritativeWithScope: additions.filter((source) => source.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length,
    contextual: additions.filter((source) => source.authority.authorityType === 'CONTEXTUAL').length,
  },
  additions,
  routingTollMembershipAdditions: memberships,
  artifactInventory,
  collisionChecks,
  projected: {
    registryCount: projectedRegistry.sourceCount,
    registrySha256: sha(projectedRegistryText),
    routingTollViewCount: projectedView.sourceCount,
    routingTollViewUniqueContentHashes: projectedView.uniqueContentHashes,
    routingTollViewSha256: sha(projectedViewText),
    uniqueContentHashDelta: projectedView.uniqueContentHashes - view.uniqueContentHashes,
  },
  atomicApplyAuthorized: false,
  executed: false,
};

const impact = {
  schemaVersion: 'agm-routing-toll-001-final-consolidated-impact.v1',
  generatedAt,
  baseline: {
    registry: { count: registry.sourceCount, sha256: hashFile(registryPath) },
    routingTollView: { count: view.sourceCount, uniqueContentHashes: view.uniqueContentHashes, sha256: hashFile(viewPath) },
  },
  operations: changeset.operations,
  projected: changeset.projected,
  existingRegistrySourcesModified: 0,
  existingViewMembershipsModified: 0,
  protectedExistingRecords: { registrySourcesPreserved: registry.sourceCount, viewMembershipsPreserved: view.sourceCount },
};

const finalPackage = {
  schemaVersion: 'agm-routing-toll-001-final-consolidated-pre-apply.v1',
  generatedAt,
  status: 'PASS_READY_FOR_PRODUCT_OWNER_APPLY_REVIEW_NOT_AUTHORIZED_NOT_EXECUTED',
  authorityReview: {
    reference: decisionsPath,
    decisionRegisterSha256: hashFile(decisionsPath),
    decisions: 10,
    approved: 10,
    authoritativeWithScope: 9,
    contextual: 1,
    rejected: 0,
    deferred: 0,
    pending: 0,
  },
  sourceFreshnessPolicy: {
    reference: freshnessPolicyPath,
    sha256: hashFile(freshnessPolicyPath),
    nlTemporalRestriction: '2026-07-01 through 2026-08-31; after window EXPIRED_REVIEW_REQUIRED / UNKNOWN_HUMAN_VERIFICATION',
    dkFreshnessTrigger: 'Q3 2026; no automatic extension',
  },
  chVignetteRecapture: recaptureManifest,
  blueprints,
  changeset,
  impact,
  emailRuntimeGate: {
    recipientConfiguration: 'PASS_2_RECIPIENTS_LOCAL_SECRET_CONFIG',
    senderConfiguration: 'PASS_LOCAL_SECRET_CONFIG',
    deliveryTest: 'NOT_EXECUTED_AUTHENTICATION_NOT_CONFIGURED',
    status: 'BLOCKED_CONFIGURATION_REQUIRED',
    missing: ['GMAIL_ACCESS_TOKEN or GMAIL_OAUTH_CLIENT_ID + GMAIL_OAUTH_CLIENT_SECRET + GMAIL_OAUTH_REFRESH_TOKEN'],
    scope: 'EMAIL_DELIVERY_ONLY',
  },
  guardrails: {
    registryMutation: 'NONE',
    routingTollViewMutation: 'NONE',
    authorityPromotion: 'NONE',
    runtimeProduction: 'NO_CHANGE',
    atomicApply: 'NOT_EXECUTED',
    commitPush: 'NOT_EXECUTED',
    atomicApplyAuthorized: false,
    atomicApplyRequiresSeparateProductOwnerMandate: true,
  },
};

mkdirSync(path.join(root, outputRoot), { recursive: true });
writeJson('CH_VIGNETTE_RECAPTURE_MANIFEST.json', recaptureManifest);
writeJson('FINAL_ATOMIC_CHANGESET.json', changeset);
writeJson('EXACT_ATOMIC_APPLY_IMPACT.json', impact);
writeJson('FINAL_PRE_APPLY_PACKAGE.json', finalPackage);
writeFileSync(path.join(root, outputRoot, 'FINAL_PRE_APPLY_REPORT.md'), `# ROUTING-TOLL-001 — Final consolidated pre-apply package\n\n` +
`Status: \`PASS / READY FOR PRODUCT OWNER APPLY REVIEW / NOT AUTHORIZED / NOT EXECUTED\`\n\n` +
`- Product Owner decisions: \`10/10 APPROVE\`; classifications \`9 AUTHORITATIVE_WITH_SCOPE + 1 CONTEXTUAL\`.\n` +
`- Swiss vignette recapture: \`PASS / APPLY_CONDITION SATISFIED\`.\n` +
`- Atomic impact: \`ADD 10 / MODIFY 0 / DELETE 0\`; Registry \`${registry.sourceCount} -> ${projectedRegistry.sourceCount}\`; Routing/Toll view \`${view.sourceCount} -> ${projectedView.sourceCount}\`.\n` +
`- Projected Registry SHA-256: \`${changeset.projected.registrySha256}\`.\n` +
`- Projected Routing/Toll view SHA-256: \`${changeset.projected.routingTollViewSha256}\`.\n` +
`- Email delivery only: \`BLOCKED_CONFIGURATION_REQUIRED\` because Gmail authentication is not configured; recipients and sender are configured locally.\n` +
`- Registry/view mutation, authority promotion, production runtime, atomic apply and commit/push: \`NONE / NOT EXECUTED\`.\n`, 'utf8');

console.log(JSON.stringify({
  status: finalPackage.status,
  decisions: '10/10 APPROVE',
  classifications: '9/1',
  operations: changeset.operations,
  projected: changeset.projected,
  recapture: `${recaptureManifest.blockerState}/${recaptureManifest.applyCondition}`,
  emailDeliveryGate: finalPackage.emailRuntimeGate.status,
  executed: false,
}, null, 2));

function metadataRecord(sourceDate, effectiveFrom, effectiveUntil, version, jurisdictions, nextFreshnessCheck, currentStatus) {
  return { sourceDate, effectiveFrom, effectiveUntil, version, jurisdictions, nextFreshnessCheck, currentStatus };
}

function makeSourceObject(candidate, decision, artifact, meta, isVignette) {
  if (!meta) throw new Error(`MISSING_METADATA:${decision.candidateId}`);
  const limitationValues = collectLimitations(decision);
  return {
    sourceId: decision.proposedSourceId,
    canonicalPath: artifact.canonicalPath,
    canonicalUri: artifact.officialUrl,
    mediaType: artifact.mediaType,
    sizeBytes: artifact.sizeBytes,
    sha256: artifact.sha256,
    sourceDate: meta.sourceDate,
    effectiveDate: meta.effectiveFrom,
    version: meta.version,
    status: 'EVIDENCE',
    owner: 'Mobility & Routing Steward',
    authority: {
      issuingBody: isVignette ? 'Swiss Confederation / Federal Office for Customs and Border Security (BAZG/FOCBS)' : candidate.authority,
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
    freshness: {
      policyVersion: 'agm-source-freshness.v1',
      effectiveFrom: meta.effectiveFrom,
      effectiveUntil: meta.effectiveUntil,
      capturedAt: '2026-08-30T00:00:00.000Z',
      lastFreshnessCheck: '2026-08-30T00:00:00.000Z',
      nextFreshnessCheck: meta.nextFreshnessCheck,
      currentStatus: meta.currentStatus,
      reviewRequired: meta.currentStatus !== 'CURRENT',
      usageFallback: decision.usageFallback ?? 'UNKNOWN_HUMAN_VERIFICATION_WHEN_CURRENTNESS_CANNOT_BE_DEMONSTRATED',
      limitations: limitationValues,
    },
    evidenceRefs: [
      decisionsPath,
      reviewPath,
      priorManifestPath,
      artifact.officialUrl,
      ...(isVignette ? [browserReportPath, chArtifacts.viaProduct.canonicalPath, chArtifacts.viaProduct.officialUrl] : []),
    ],
    supersedes: [],
    supersededBy: [],
  };
}

function collectLimitations(decision) {
  const values = [];
  for (const key of ['authorityExclusions', 'freshnessLimitation', 'mandatoryMetadata', 'usageFallbackCondition', 'postWindowRequirements', 'usageDependencies', 'periodIntegrityRule', 'tariffSeparationRule', 'freshnessRequirement']) {
    const value = decision[key];
    if (Array.isArray(value)) values.push(...value);
    else if (typeof value === 'string') values.push(value);
  }
  return values;
}
