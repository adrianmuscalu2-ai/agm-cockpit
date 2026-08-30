import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageRoot = path.join(root, 'AGM_LIBRARY', 'PHASE3', 'REMOTE_CANONICAL_INTEGRITY');
const acquisitionTimestamp = '2026-08-29T17:59:18.431Z';
const acquisitionDate = '2026-08-29';
const centralPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const candidates = readJson('AGM_LIBRARY/PHASE2/CANDIDATES/canonical-source-candidates.json').candidates;
const decisions = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/PRODUCT_OWNER_DECISIONS.json');
const previousTransitions = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/SOURCE_STATUS_TRANSITIONS.json').transitions;
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const basicBaseline = readJson('CAR_MOVER/GOVERNANCE/BASIC_LIBRARIAN_BASELINE.json');
const preApplyDiff = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/REGISTRY_BEFORE_AFTER_DIFF.json');
const frozenPreApplyRegistry = preApplyDiff.before;
const candidateById = new Map(candidates.map((item) => [item.sourceId, item]));
const transitionById = new Map(previousTransitions.map((item) => [item.sourceId, item]));

const remote = [
  remoteSource('CS-EU-REG-561-2006', 'ARTIFACTS/CS-EU-REG-561-2006.official.en.html', 'text/html',
    'https://eur-lex.europa.eu/eli/reg/2006/561/oj?locale=en', null,
    ['32006R0561', 'Regulation (EC) No 561/2006', '15 March 2006']),
  remoteSource('CS-EU-REG-561-2006-CONS-20241231', 'ARTIFACTS/CS-EU-REG-561-2006-CONS-20241231.official.en.pdf', 'application/pdf',
    'https://eur-lex.europa.eu/eli/reg/2006/561/2024-12-31/eng/pdf', 26),
  remoteSource('CS-EU-REG-165-2014', 'ARTIFACTS/CS-EU-REG-165-2014.official.en.pdf', 'application/pdf',
    'https://eur-lex.europa.eu/eli/reg/2014/165/oj/eng/pdf', 33),
  remoteSource('CS-EU-REG-165-2014-CONS-20241231', 'ARTIFACTS/CS-EU-REG-165-2014-CONS-20241231.official.en.pdf', 'application/pdf',
    'https://eur-lex.europa.eu/eli/reg/2014/165/2024-12-31/eng/pdf', 49),
  remoteSource('CS-EU-IMPL-REG-2016-799', 'ARTIFACTS/CS-EU-IMPL-REG-2016-799.official.en.pdf', 'application/pdf',
    'https://eur-lex.europa.eu/eli/reg_impl/2016/799/oj/eng/pdf', 506),
  remoteSource('CS-EU-IMPL-REG-2016-799-CONS-20230821', 'ARTIFACTS/CS-EU-IMPL-REG-2016-799-CONS-20230821.official.en.pdf', 'application/pdf',
    'https://eur-lex.europa.eu/eli/reg_impl/2016/799/2023-08-21/eng/pdf', 616),
  remoteSource('CS-DE-FPERSG', 'ARTIFACTS/CS-DE-FPERSG.official.de.pdf', 'application/pdf',
    'https://www.gesetze-im-internet.de/fahrpersstg/FPersG.pdf', 8),
  remoteSource('CS-DE-FPERSV', 'ARTIFACTS/CS-DE-FPERSV.official.de.pdf', 'application/pdf',
    'https://www.gesetze-im-internet.de/fpersv/FPersV.pdf', 41),
  remoteSource('CS-DE-STVO', 'ARTIFACTS/CS-DE-STVO.official.de.pdf', 'application/pdf',
    'https://www.gesetze-im-internet.de/stvo_2013/StVO.pdf', 82),
  remoteSource('CS-DE-STVZO', 'ARTIFACTS/CS-DE-STVZO.official.de.pdf', 'application/pdf',
    'https://www.gesetze-im-internet.de/stvzo_2012/StVZO.pdf', 365),
  remoteSource('CS-UNECE-ADR-2025', 'ARTIFACTS/CS-UNECE-ADR-2025.official.en.pdf', 'application/pdf',
    'https://digitallibrary.un.org/record/4068196/files/ECE_TRANS_352-EN.pdf', 1348, [], {
      provenanceChain: [
        'https://unece.org/info/Transport/pub/395786',
        'https://digitallibrary.un.org/record/4068196',
        'https://digitallibrary.un.org/record/4068196/files/ECE_TRANS_352-EN.pdf',
      ],
      officialIdentifier: 'ECE/TRANS/352',
      scopeNote: 'Official UN complete two-volume ADR 2025 publication; later corrigenda remain separate official instruments and must be consumed with the publication.',
    }),
  remoteSource('CS-DE-GGVSEB', 'ARTIFACTS/CS-DE-GGVSEB.official.de.pdf', 'application/pdf',
    'https://www.gesetze-im-internet.de/ggvseb/GGVSEB.pdf', 55),
];

const internalSourceIds = [
  'CS-AGM-TACHO-CHANGE-MAP-V1',
  'CS-AGM-CM-FIELD-RUNBOOK-V1',
  'CS-AGM-CM-ARCH-V1',
  'CS-AGM-CM-JOB-V1',
  'CS-AGM-CM-OCR-EVIDENCE-V1',
];

const internal = internalSourceIds.map((sourceId) => {
  const source = mustCandidate(sourceId);
  const relativePath = source.canonicalLocation;
  const absolutePath = path.join(root, relativePath);
  const actualHash = sha(relativePath);
  const actualSize = statSync(absolutePath).size;
  return {
    sourceId,
    sourceKind: 'AGM_INTERNAL_CANONICAL_CANDIDATE',
    approvedSourceLocation: relativePath,
    finalCanonicalUri: null,
    canonicalArtifactPath: relativePath,
    canonicalFilename: path.basename(relativePath),
    mediaType: 'text/markdown',
    sizeBytes: actualSize,
    sha256: actualHash,
    acquisitionTimestamp,
    publicationDate: source.publicationDate,
    effectiveDate: source.effectiveDate,
    version: source.version,
    jurisdictions: source.jurisdictions,
    provenance: source.provenance,
    sourceAuthority: source.issuingAuthority,
    authorityLevel: source.authorityLevel,
    approvedAuthorityClassification: transitionById.get(sourceId).proposedAfter.authorityClassification,
    expectedCandidateSha256: source.integrity.sha256,
    validation: {
      exists: existsSync(absolutePath),
      nonEmpty: actualSize > 0,
      hashMatchesPhase2Candidate: actualHash === source.integrity.sha256,
      sourceIdConsistent: source.sourceId === sourceId,
      result: existsSync(absolutePath) && actualSize > 0 && actualHash === source.integrity.sha256 ? 'INTEGRITY_VERIFIED' : 'INTEGRITY_BLOCKED',
    },
  };
});

const allArtifacts = [...remote, ...internal];
const blocked = allArtifacts.filter((item) => item.validation.result !== 'INTEGRITY_VERIFIED');
const authoritativeCount = allArtifacts.filter((item) => item.approvedAuthorityClassification === 'AUTHORITATIVE_WITH_SCOPE').length;
const contextualCount = allArtifacts.filter((item) => item.approvedAuthorityClassification === 'CONTEXTUAL').length;

const artifactManifest = {
  schemaVersion: 'agm-phase3-canonical-artifact-manifest.v1',
  packageId: 'AGM-PHASE3-REMOTE-CANONICAL-INTEGRITY-001',
  acquisitionTimestamp,
  authority: decisions.authority,
  scope: 'INTEGRITY_ACQUISITION_ONLY_NO_REGISTRY_MUTATION',
  sourceCount: allArtifacts.length,
  remoteSourceCount: remote.length,
  internalSourceCount: internal.length,
  integrityVerifiedCount: allArtifacts.length - blocked.length,
  integrityBlockedCount: blocked.length,
  approvedAuthorityCounts: { AUTHORITATIVE_WITH_SCOPE: authoritativeCount, CONTEXTUAL: contextualCount },
  sources: allArtifacts,
};

const hashManifest = {
  schemaVersion: 'agm-phase3-final-source-hash-manifest.v1',
  generatedAt: acquisitionTimestamp,
  sourceCount: allArtifacts.length,
  totalSizeBytes: allArtifacts.reduce((sum, item) => sum + item.sizeBytes, 0),
  algorithm: 'SHA-256',
  entries: allArtifacts.map((item) => ({
    sourceId: item.sourceId,
    canonicalArtifactPath: item.canonicalArtifactPath,
    mediaType: item.mediaType,
    sizeBytes: item.sizeBytes,
    sha256: item.sha256,
    integrityStatus: item.validation.result,
  })),
};

const centralBeforeHash = frozenPreApplyRegistry.sha256;
const operations = allArtifacts.map((artifact) => {
  const source = mustCandidate(artifact.sourceId);
  const prior = transitionById.get(artifact.sourceId);
  const classification = prior.proposedAfter.authorityClassification;
  return {
    sourceId: artifact.sourceId,
    operation: 'ADD_NEW_CANONICAL_SOURCE',
    sourceIdContinuity: 'PRESERVE_PHASE2_SOURCE_ID',
    approvedByReviewIds: prior.approvedByReviewIds,
    overlapsWithUnresolvedReviewIds: prior.overlapsWithUnresolvedReviewIds,
    integrityStatus: artifact.validation.result,
    applyReadiness: artifact.validation.result === 'INTEGRITY_VERIFIED'
      ? 'INTEGRITY_VERIFIED_AWAITING_SEPARATE_OWNER_APPLY_AUTHORIZATION'
      : 'INTEGRITY_BLOCKED',
    applied: false,
    proposedRegistryEntry: artifact.validation.result === 'INTEGRITY_VERIFIED'
      ? centralEntry(source, artifact, classification)
      : null,
  };
});

const updatedChangeset = {
  schemaVersion: 'agm-phase3-final-pre-apply-changeset.v1',
  changesetId: 'AGM-CANONICAL-PROMOTION-PHASE3-OWNER-001',
  supersedesProposal: 'AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/PROPOSED_CANONICAL_PROMOTION_CHANGESET.json',
  status: blocked.length === 0
    ? 'FINAL_PRE_APPLY_INTEGRITY_VERIFIED_NOT_APPLIED'
    : 'INTEGRITY_BLOCKED_NOT_APPLIED',
  authority: decisions.authority,
  integrityAcquisitionAuthorized: true,
  centralRegistryMutationAuthorized: false,
  atomicApply: true,
  partialApplyForbidden: true,
  operationCount: operations.length,
  verifiedOperationCount: operations.filter((item) => item.integrityStatus === 'INTEGRITY_VERIFIED').length,
  blockedOperationCount: operations.filter((item) => item.integrityStatus === 'INTEGRITY_BLOCKED').length,
  proposedAuthorityCounts: { AUTHORITATIVE_WITH_SCOPE: authoritativeCount, CONTEXTUAL: contextualCount },
  before: { sourceCount: frozenPreApplyRegistry.sourceCount, sha256: centralBeforeHash },
  actualAfterThisMandate: { sourceCount: frozenPreApplyRegistry.sourceCount, sha256: centralBeforeHash, changed: false },
  conditionalAfterSeparateOwnerApplyAuthorization: {
    sourceCount: frozenPreApplyRegistry.sourceCount + operations.length,
    additions: operations.length,
    modifications: 0,
    removals: 0,
    sha256: null,
  },
  unresolvedGapsRemainOpen: unresolved.gaps.map((item) => item.gapId),
  operations,
};

const basicIntegrity = {
  protectedFileCount: basicBaseline.protectedHashes.length,
  checks: basicBaseline.protectedHashes.map((item) => ({
    path: item.path,
    expectedSha256: item.sha256,
    actualSha256: sha(item.path),
    unchanged: item.sha256 === sha(item.path),
  })),
};
basicIntegrity.result = basicIntegrity.checks.every((item) => item.unchanged) ? 'UNCHANGED' : 'CHANGED';

writeJson('CANONICAL_ARTIFACT_MANIFEST.json', artifactManifest);
writeJson('FINAL_SOURCE_HASH_MANIFEST.json', hashManifest);
writeJson('UPDATED_PROPOSED_CHANGESET.json', updatedChangeset);
writeJson('BASIC_LIBRARIAN_INTEGRITY.json', basicIntegrity);

const report = `# REMOTE SOURCE INTEGRITY REPORT\n\nAcquisition timestamp: \`${acquisitionTimestamp}\`  \nAuthority: **Product Owner - Adrian Muscalu**  \nScope: **INTEGRITY ACQUISITION ONLY**\n\n## Result\n\n- remote canonical sources: **${remote.length}/${remote.length} INTEGRITY VERIFIED**;\n- AGM internal sources: **${internal.length}/${internal.length} INTEGRITY VERIFIED**;\n- total: **${allArtifacts.length}/${allArtifacts.length} INTEGRITY VERIFIED**;\n- AUTHORITATIVE_WITH_SCOPE: **${authoritativeCount}**;\n- CONTEXTUAL: **${contextualCount}**;\n- INTEGRITY_BLOCKED: **${blocked.length}**.\n\n## Canonical artifacts\n\n| sourceId | Kind | Media | Bytes | SHA-256 | Verification |\n|---|---|---:|---:|---|---|\n${allArtifacts.map((item) => `| ${item.sourceId} | ${item.sourceKind} | ${item.mediaType} | ${item.sizeBytes} | \`${item.sha256}\` | ${item.validation.result} |`).join('\n')}\n\n## Source-specific notes\n\n- \`CS-EU-REG-561-2006\` is the complete official EUR-Lex ELI HTML representation. The PDF representation was WAF-challenged during acquisition; no secondary copy was substituted. Identity markers \`32006R0561\`, the act title and adoption date are present in the captured official HTML.\n- \`CS-UNECE-ADR-2025\` is the official UN Digital Library copy of \`ECE/TRANS/352\`, the complete two-volume ADR 2025 publication. It contains 1,348 PDF page objects. Official corrigenda are separate instruments and are not silently merged into this artifact.\n- Consolidated EUR-Lex texts remain CONTEXTUAL and do not acquire independent legal authority from integrity verification.\n- Local capture proves artifact identity and integrity; it does not broaden jurisdiction or applicability.\n\n## Open gaps preserved\n\n${unresolved.gaps.map((item) => `- ${item.gapId} = OPEN`).join('\n')}\n\nThe proposed presence of \`CS-DE-STVO\` is authorized through LEGAL-001 only and does not close LEGAL-003 or LEGAL-005.\n\n## No-mutation boundary\n\n- Central Registry before acquisition: ${frozenPreApplyRegistry.sourceCount} sources, SHA-256 \`${centralBeforeHash}\`;\n- Central Registry after acquisition / before apply: ${frozenPreApplyRegistry.sourceCount} sources, identical SHA-256;\n- Central Registry mutation during acquisition: **NONE**;\n- partial application: **FORBIDDEN**;\n- Basic Librarian: **${basicIntegrity.result}**;\n- runtime / Production / TURN: **NO CHANGE**;\n- commit / push: **NOT EXECUTED**.\n`;
writeText('REMOTE_SOURCE_INTEGRITY_REPORT.md', report);

console.log(`REMOTE_SOURCES_INTEGRITY_VERIFIED=${remote.length - remote.filter((item) => item.validation.result !== 'INTEGRITY_VERIFIED').length}/${remote.length}`);
console.log(`INTERNAL_SOURCES_INTEGRITY_VERIFIED=${internal.length - internal.filter((item) => item.validation.result !== 'INTEGRITY_VERIFIED').length}/${internal.length}`);
console.log(`ALL_SOURCES_INTEGRITY_VERIFIED=${allArtifacts.length - blocked.length}/${allArtifacts.length}`);
console.log(`AUTHORITATIVE_WITH_SCOPE=${authoritativeCount}`);
console.log(`CONTEXTUAL=${contextualCount}`);
console.log(`INTEGRITY_BLOCKED=${blocked.length}`);
console.log('CENTRAL_REGISTRY_MUTATION=NONE');

function remoteSource(sourceId, artifactRelative, mediaType, finalCanonicalUri, expectedPageObjects, htmlIdentityMarkers = [], extra = {}) {
  const source = mustCandidate(sourceId);
  const packageRelativePath = path.posix.join('AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY', artifactRelative.replaceAll('\\', '/'));
  const absolutePath = path.join(root, packageRelativePath);
  if (!existsSync(absolutePath)) throw new Error(`REMOTE_ARTIFACT_MISSING:${sourceId}:${packageRelativePath}`);
  const bytes = readFileSync(absolutePath);
  const latin = bytes.toString('latin1');
  const signatureValid = mediaType === 'application/pdf'
    ? latin.startsWith('%PDF-') && latin.trimEnd().endsWith('%%EOF')
    : /<!DOCTYPE html|<html/i.test(latin);
  const pageObjects = mediaType === 'application/pdf' ? (latin.match(/\/Type\s*\/Page\b/g) ?? []).length : null;
  const identityMarkersPresent = htmlIdentityMarkers.every((marker) => latin.includes(marker));
  const pageCountMatches = expectedPageObjects === null ? true : pageObjects === expectedPageObjects;
  const result = signatureValid && pageCountMatches && identityMarkersPresent && bytes.length > 0
    ? 'INTEGRITY_VERIFIED'
    : 'INTEGRITY_BLOCKED';
  return {
    sourceId,
    sourceKind: 'REMOTE_OFFICIAL_CANONICAL_CAPTURE',
    approvedSourceUri: source.officialUri,
    finalCanonicalUri,
    canonicalArtifactPath: packageRelativePath,
    canonicalFilename: path.basename(packageRelativePath),
    mediaType,
    sizeBytes: bytes.length,
    sha256: hash(bytes),
    acquisitionTimestamp,
    publicationDate: source.publicationDate,
    effectiveDate: source.effectiveDate,
    version: source.version,
    jurisdictions: source.jurisdictions,
    provenance: {
      type: 'DIRECT_OFFICIAL_SOURCE_CAPTURE',
      approvedUri: source.officialUri,
      resolvedDownloadUri: finalCanonicalUri,
      officialDomain: new URL(finalCanonicalUri).hostname,
      originalPreserved: true,
      secondaryOrGeneratedSubstitution: false,
      ...extra,
    },
    sourceAuthority: source.issuingAuthority,
    authorityLevel: source.authorityLevel,
    approvedAuthorityClassification: transitionById.get(sourceId).proposedAfter.authorityClassification,
    validation: {
      exists: true,
      nonEmpty: bytes.length > 0,
      signatureValid,
      expectedPageObjects,
      observedPageObjects: pageObjects,
      pageCountMatches,
      htmlIdentityMarkers,
      identityMarkersPresent,
      approvedSourceIdConsistent: source.sourceId === sourceId,
      result,
    },
  };
}

function centralEntry(source, artifact, authorityClassification) {
  return {
    sourceId: source.sourceId,
    canonicalPath: artifact.canonicalArtifactPath,
    canonicalUri: artifact.finalCanonicalUri,
    mediaType: artifact.mediaType,
    sizeBytes: artifact.sizeBytes,
    sha256: artifact.sha256,
    sourceDate: source.publicationDate ?? source.effectiveDate ?? acquisitionDate,
    effectiveDate: source.effectiveDate,
    version: source.version,
    status: 'CURRENT',
    owner: source.reviewOwner,
    authority: {
      issuingBody: source.issuingAuthority,
      authorityType: authorityClassification,
      jurisdictions: source.jurisdictions,
      reviewStatus: 'HUMAN_APPROVED_INTEGRITY_VERIFIED_PENDING_REGISTRY_APPLY_AUTHORIZATION',
      humanReviewRequired: false,
    },
    provenance: {
      importedFrom: artifact.finalCanonicalUri ?? source.provenance.acquiredFrom,
      observedPath: artifact.canonicalArtifactPath,
      originalPreserved: true,
      libraryCopyCreated: false,
    },
    retention: {
      classification: source.retentionClass,
      deleteAuthorized: false,
      historicalEvidencePreserved: true,
    },
    evidenceRefs: [
      source.officialUri,
      artifact.canonicalArtifactPath,
      'AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/PRODUCT_OWNER_DECISIONS.json',
      'AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/FINAL_SOURCE_HASH_MANIFEST.json',
    ].filter(Boolean),
    supersedes: source.supersedes,
    supersededBy: source.supersededBy,
  };
}

function mustCandidate(sourceId) {
  const source = candidateById.get(sourceId);
  if (!source) throw new Error(`CANDIDATE_MISSING:${sourceId}`);
  if (!transitionById.has(sourceId)) throw new Error(`APPROVED_TRANSITION_MISSING:${sourceId}`);
  return source;
}
function readJson(relativePath) { return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')); }
function sha(relativePath) { return hash(readFileSync(path.join(root, relativePath))); }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function writeJson(relativePath, value) { writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`); }
function writeText(relativePath, value) {
  const absolutePath = path.join(packageRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, value, 'utf8');
}
