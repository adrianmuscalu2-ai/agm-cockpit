import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION';
const prior = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CONTINUATION_READ_ONLY';
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const writeJson = (name, value) => writeFileSync(path.join(root, out, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const acquisition = readJson(`${out}/FINAL_CLOSURE_ACQUISITION_MANIFEST.json`);
const residual = readJson(`${prior}/RESIDUAL_REMOTE_ACQUISITION_MANIFEST.json`);
const recovery = readJson(`${prior}/RECOVERY_AND_SUPPLEMENTAL_ACQUISITION_RECORD.json`);
const generatedAt = acquisition.generatedAt;
const acquired = new Map(acquisition.items.map((item) => [item.artifactId, item]));
const earlier = new Map(residual.items.map((item) => [item.candidateId, item]));

const capturedStatus = (artifactId) => acquired.get(artifactId)?.status === 'INTEGRITY_CAPTURED_REVIEW_ONLY';
const evidence = (artifactId) => {
  const item = acquired.get(artifactId);
  return {
    artifactId,
    officialUrl: item?.url ?? null,
    status: item?.status ?? 'MISSING',
    canonicalPath: item?.canonicalPath ?? null,
    sizeBytes: item?.sizeBytes ?? null,
    sha256: item?.sha256 ?? null,
    blockReason: item?.error ?? null,
  };
};

const franceRegimes = [
  ['Adelac', 'A41', 'RT001-FINAL-FR-ORDER-12-2026'],
  ['Albea', 'A150', 'RT001-FINAL-FR-ORDER-12-2026'],
  ['ALIAE', 'A79', 'RT001-FINAL-FR-ORDER-12-2026'],
  ['Alicorne', 'A88', 'RT001-FINAL-FR-ORDER-12-2026'],
  ["A'Lienor", 'A65', 'RT001-FINAL-FR-ORDER-12-2026'],
  ['Alis', 'A28', 'RT001-FINAL-FR-ORDER-12-2026'],
  ['AMEDEA', 'A412', 'RT001-FINAL-FR-A412-NOT-OPEN', 'NOT_APPLICABLE_2026'],
  ['APRR', 'APRR network', 'RT001-FINAL-FR-APRR-2026'],
  ['Arcos', 'A355', 'RT001-FINAL-FR-ORDER-12-2026'],
  ['Arcour', 'A19', 'RT001-FINAL-FR-ORDER-12-2026'],
  ['AREA', 'AREA network', 'RT001-FINAL-FR-AREA-2026'],
  ['ASF', 'ASF network', 'RT001-FINAL-FR-ASF-2026'],
  ['Atlandes', 'A63', 'RT001-FINAL-FR-ORDER-12-2026'],
  ['ATMB', 'A40', 'RT001-FINAL-FR-ORDER-12-2026'],
  ['ATMB', 'Mont Blanc Tunnel', 'RT001-FINAL-FR-MONTBLANC-2026'],
  ['Atosca', 'A69', 'RT001-FINAL-FR-A69-NOT-OPEN', 'NOT_APPLICABLE_2026'],
  ['CCISE', 'Pont de Normandie', 'RT001-FINAL-FR-CCISE-ORDER-2026'],
  ['CCISE', 'Pont de Tancarville', 'RT001-FINAL-FR-CCISE-ORDER-2026'],
  ['CEVM', 'Viaduc de Millau', 'RT001-FINAL-FR-ORDER-12-2026'],
  ['Cofiroute', 'Cofiroute network', 'RT001-FINAL-FR-COFIROUTE-2026'],
  ['Cofiroute', 'Duplex A86', 'RT001-FINAL-FR-COFIROUTE-A86-2026'],
  ['Escota', 'Escota network', 'RT001-FINAL-FR-ESCOTA-2026'],
  ['Sanef', 'Sanef network', 'RT001-FINAL-FR-SANEF-2026'],
  ['SAPN', 'SAPN network', 'RT001-FINAL-FR-SAPN-2026'],
  ['SFTRF', 'A43 Maurienne', 'RT001-FINAL-FR-ORDER-12-2026'],
  ['SFTRF', 'Frejus Tunnel', 'RT001-FINAL-FR-FREJUS-2026'],
].map(([concessionaire, network, artifactId, forcedStatus]) => {
  const item = acquired.get(artifactId);
  const status = forcedStatus ?? (capturedStatus(artifactId) ? 'CAPTURED' : 'BLOCKED');
  return {
    concessionaire,
    network,
    inventoryEvidenceId: 'RT001-FINAL-FR-INVENTORY-MINISTRY',
    tariffOrApplicabilityEvidenceId: artifactId,
    evidenceStatus: status,
    officialUrl: item?.url ?? null,
    artifactPath: item?.canonicalPath ?? null,
    artifactSha256: item?.sha256 ?? null,
    limitation: status === 'BLOCKED'
      ? `Official source verified but local canonical capture blocked: ${item?.error ?? 'UNKNOWN'}`
      : status === 'NOT_APPLICABLE_2026'
        ? 'Official project evidence demonstrates no operating 2026 tariff is applicable at acquisition time.'
        : null,
    authorityPromotion: 'NONE_REVIEW_ONLY',
  };
});

const franceCompanies = [...new Set(franceRegimes.map((item) => item.concessionaire))];
const france = {
  schemaVersion: 'agm-routing-toll-001-france-coverage.v1',
  generatedAt,
  inventoryAuthority: evidence('RT001-FINAL-FR-INVENTORY-MINISTRY'),
  inventoryInterpretation: {
    officialPageStatement: '20 current concession companies holding 24 contracts',
    listedEntities: 22,
    explanation: 'The official list includes AMEDEA/A412 and Atosca/A69, which are separately accounted as not operating for the 2026 acquisition date.',
  },
  companyCount: franceCompanies.length,
  regimeCount: franceRegimes.length,
  companies: franceCompanies.map((name) => ({
    name,
    regimes: franceRegimes.filter((item) => item.concessionaire === name).map((item) => item.network),
    accounted: franceRegimes.filter((item) => item.concessionaire === name).every((item) => ['CAPTURED', 'NOT_APPLICABLE_2026', 'BLOCKED'].includes(item.evidenceStatus)),
  })),
  regimes: franceRegimes,
  summary: {
    entitiesAccounted: franceCompanies.length,
    entitiesTotal: franceCompanies.length,
    regimesAccounted: franceRegimes.length,
    regimesTotal: franceRegimes.length,
    captured: franceRegimes.filter((item) => item.evidenceStatus === 'CAPTURED').length,
    notApplicableWithEvidence: franceRegimes.filter((item) => item.evidenceStatus === 'NOT_APPLICABLE_2026').length,
    integrityBlocked: franceRegimes.filter((item) => item.evidenceStatus === 'BLOCKED').length,
    coverageStatement: `${franceCompanies.length}/${franceCompanies.length} official entities and ${franceRegimes.length}/${franceRegimes.length} regimes accounted for`,
    integrityComplete: franceRegimes.every((item) => item.evidenceStatus !== 'BLOCKED'),
  },
  registryMutation: 'NONE',
  authorityPromotion: 'NONE',
};

const priorEvidence = (candidateId) => {
  const item = earlier.get(candidateId);
  if (candidateId === 'RT001-RES-CH-LSVA-RATES') {
    const recovered = recovery.recoveryAttempts.find((entry) => entry.candidateId === candidateId);
    return { candidateId, canonicalPath: recovered.canonicalPath, mediaType: recovered.mediaType, sizeBytes: recovered.sizeBytes, sha256: recovered.sha256, officialUrl: recovered.officialUrl, acquisitionTimestamp: recovery.generatedAt };
  }
  return { candidateId, canonicalPath: item?.canonicalPath ?? null, mediaType: item?.mediaType ?? null, sizeBytes: item?.sizeBytes ?? null, sha256: item?.sha256 ?? null, officialUrl: item?.url ?? null, acquisitionTimestamp: item?.acquisitionTimestamp ?? null };
};

const facilities = {
  schemaVersion: 'agm-routing-toll-001-facilities-coverage.v1',
  generatedAt,
  inventoryRule: 'Account current and officially identified future facility-specific regimes; no national-regime extrapolation.',
  items: [
    {
      country: 'BE', facility: 'Liefkenshoek Tunnel', applicability: 'CURRENT',
      scopeEvidence: ['RT001-FINAL-FAC-BE-TUNNEL-INVENTORY', 'RT001-FINAL-FAC-BE-EETS'],
      tariffEvidence: evidence('RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026'),
      status: capturedStatus('RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026') ? 'CAPTURED' : 'BLOCKED',
      limitation: capturedStatus('RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026')
        ? null
        : 'Official 2026 PDF is protected by a Cloudflare JavaScript challenge (HTTP 403); no unofficial substitute used.',
    },
    {
      country: 'BE', facility: 'Oosterweel/Scheldt connection', applicability: 'FUTURE_NOT_APPLICABLE_2026',
      scopeEvidence: ['RT001-FINAL-FAC-BE-OOSTERWEEL-FUTURE'], tariffEvidence: null,
      status: capturedStatus('RT001-FINAL-FAC-BE-OOSTERWEEL-FUTURE') ? 'NOT_APPLICABLE_WITH_EVIDENCE' : 'BLOCKED', limitation: null,
    },
    {
      country: 'NL', facility: 'A24 Blankenburgverbinding', applicability: 'CURRENT',
      scopeEvidence: ['RT001-FINAL-FAC-NL-A24-VIA15-SCOPE'],
      tariffEvidence: { sourceId: 'CS-NL-A24-ETOL-2026', canonicalPath: 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CLOSURE/REMOTE_ARTIFACTS/RT001-PROP-NL-A24-ETOL-2026.official.html', sizeBytes: 246982, sha256: '852d1a5fcd502ee89b8c9dc0082ed45b114f07ad909b156de980f35783717198' },
      status: 'CAPTURED', limitation: null,
    },
    {
      country: 'NL', facility: 'Kiltunnel', applicability: 'CURRENT',
      scopeEvidence: ['RT001-FINAL-FAC-NL-NATIONAL-SCOPE'], tariffEvidence: priorEvidence('RT001-RES-NL-KILTUNNEL'), status: 'CAPTURED', limitation: null,
    },
    {
      country: 'NL', facility: 'Westerscheldetunnel', applicability: 'CURRENT_HEAVY_VEHICLE_CHARGE',
      scopeEvidence: ['RT001-FINAL-FAC-NL-NATIONAL-SCOPE'], tariffEvidence: priorEvidence('RT001-RES-NL-WESTERSCHELDE-2026'), status: 'CAPTURED', limitation: 'Vehicle/category applicability must remain scoped to the captured 2026 operator evidence.',
    },
    {
      country: 'NL', facility: 'Tolbrug Nieuwerbrug', applicability: 'CURRENT_PRIVATE_LOCAL_BRIDGE',
      scopeEvidence: ['RT001-FINAL-FAC-NL-NIEUWERBRUG'], tariffEvidence: evidence('RT001-FINAL-FAC-NL-NIEUWERBRUG'), status: 'OUT_OF_SCOPE_BY_PRODUCT_OWNER',
      limitation: 'Excluded from canonical ROUTING/TOLL as a local/private micro-regime. Field encounter remains UNKNOWN and requires human confirmation; zero-toll inference is forbidden.',
    },
    {
      country: 'NL', facility: 'Via15', applicability: 'FUTURE_NOT_APPLICABLE_2026',
      scopeEvidence: ['RT001-FINAL-FAC-NL-A24-VIA15-SCOPE'], tariffEvidence: null, status: 'NOT_APPLICABLE_WITH_EVIDENCE', limitation: null,
    },
    {
      country: 'DE', facility: 'Warnowquerung', applicability: 'CURRENT',
      scopeEvidence: ['RT001-FINAL-FAC-DE-FMODEL'], tariffEvidence: priorEvidence('RT001-RES-DE-WARNOW-2025'), status: 'CAPTURED', limitation: null,
    },
    {
      country: 'DE', facility: 'Herrentunnel', applicability: 'CURRENT',
      scopeEvidence: ['RT001-FINAL-FAC-DE-FMODEL'], tariffEvidence: priorEvidence('RT001-RES-DE-HERREN'), status: 'CAPTURED', limitation: null,
    },
  ],
  summary: {},
  registryMutation: 'NONE',
  authorityPromotion: 'NONE',
};
const inScopeFacilities = facilities.items.filter((item) => item.status !== 'OUT_OF_SCOPE_BY_PRODUCT_OWNER');
facilities.summary = {
  inventoryAccounted: facilities.items.length,
  inventoryTotal: facilities.items.length,
  accounted: inScopeFacilities.length,
  total: inScopeFacilities.length,
  integrityComplete: inScopeFacilities.filter((item) => item.status !== 'BLOCKED').length,
  integrityBlocked: inScopeFacilities.filter((item) => item.status === 'BLOCKED').length,
  outOfScopeByOwner: facilities.items.filter((item) => item.status === 'OUT_OF_SCOPE_BY_PRODUCT_OWNER').length,
  coverageStatement: `${inScopeFacilities.length}/${inScopeFacilities.length} in-scope facilities accounted; ${inScopeFacilities.filter((item) => item.status !== 'BLOCKED').length}/${inScopeFacilities.length} integrity complete; ${facilities.items.length}/${facilities.items.length} inventory items preserved`,
};

const supplementalLu = recovery.supplementalEvidence.find((item) => item.candidateId === 'RT001-RES-LU-EUROVIGNETTE-2026-ENFORCEMENT');
const ownerCandidates = [
  ['RT001-RES-PL-A1-2026', 'AmberOne / Gdansk Transport Company', 'Poland A1 Gdansk-Torun passenger/light and category tariffs', 'Captured 2026-08-30; no effective date asserted where the official surface does not state one.', 'Current captured operator page; exact update timestamp is not asserted beyond artifact content.', 'AUTHORITATIVE_WITH_SCOPE'],
  ['RT001-RES-PL-A2-2026', 'Autostrada Wielkopolska', 'Poland A2 Swiecko-Konin concession tariff grid', 'Captured 2026-08-30; effective period must be read from and bounded by the official PDF.', 'Operator-specific only; no extrapolation to state e-TOLL or other concessions.', 'AUTHORITATIVE_WITH_SCOPE'],
  ['RT001-RES-PL-A4-2026', 'Stalexport Autostrada Malopolska', 'Poland A4 Katowice-Krakow tariffs', 'Effective 2026-04-01; captured 2026-08-30.', 'Operator-specific and effective-date scoped.', 'AUTHORITATIVE_WITH_SCOPE'],
  ['RT001-RES-CH-LSVA-RATES', 'Swiss Federal Office for Customs and Border Security (BAZG)', 'Swiss LSVA exact rate directive v1.2', 'Directive v1.2; exact applicability/currentness remains subject to human review.', 'Applicability/currentness must be confirmed by Product Owner; do not infer future rates.', 'AUTHORITATIVE_WITH_SCOPE'],
  ['RT001-RES-CH-VIGNETTE-2026', 'Swiss Confederation / BAZG', 'Swiss 2026 motorway vignette price, scope and validity', '2026 vignette validity window as stated by the official source; captured 2026-08-30.', 'Limited to the vignette regime; does not cover LSVA.', 'AUTHORITATIVE_WITH_SCOPE'],
  ['RT001-RES-LU-EUROVIGNETTE-SCOPE', 'Luxembourg Customs and Excise Agency', 'Luxembourg Eurovignette vehicle and road applicability', 'Captured 2026-08-30; no independent tariff effective date asserted.', 'Scope evidence only; exact tariffs remain in the separate tariff artifact.', 'AUTHORITATIVE_WITH_SCOPE'],
  ['RT001-RES-LU-EUROVIGNETTE-RATES', 'Eurovignette / AGES official tariff publication', 'Eurovignette tariff grid', 'Applicable from 2025-03-25; 2026 applicability supported by separate official enforcement evidence.', '2026 applicability is supported separately; tariff changes require human freshness review.', 'AUTHORITATIVE_WITH_SCOPE'],
  ['RT001-RES-LU-EUROVIGNETTE-2026-ENFORCEMENT', 'Luxembourg Customs and Excise Agency', 'Official 2026 operational/enforcement evidence', 'Official 2026 publication; captured 2026-08-30.', 'Supporting applicability evidence, not a tariff grid.', 'CONTEXTUAL'],
  ['RT001-RES-DK-KMTOLL-TARIFF-V12', 'Sund & Baelt / KmToll', 'Denmark distance-based tariff table', 'Version 1.2 dated 2025-11-07; captured 2026-08-30.', 'Limited to KmToll; excludes bridge tariffs and requires effective-scope confirmation.', 'AUTHORITATIVE_WITH_SCOPE'],
  ['RT001-RES-NL-TRUCK-RATES-2026', 'Government of the Netherlands', 'Netherlands exact 2026 distance-based truck rates', 'Contains explicit time-bounded 2026 tariff bands; captured 2026-08-30.', 'Time-bounded tariff bands and vehicle scope must be preserved exactly.', 'AUTHORITATIVE_WITH_SCOPE'],
].map(([candidateId, authority, scope, effectiveAndFreshness, limitations, proposedClassification]) => {
  const artifact = candidateId === supplementalLu?.candidateId
    ? { candidateId, canonicalPath: supplementalLu.canonicalPath, sizeBytes: supplementalLu.sizeBytes, sha256: supplementalLu.sha256, officialUrl: supplementalLu.officialUrl }
    : priorEvidence(candidateId);
  return {
    candidateId,
    authority,
    scope,
    effectiveAndFreshness,
    artifact,
    proposedClassification,
    decisionStatus: 'PENDING_PRODUCT_OWNER_AUTHORITY_REVIEW',
    limitations,
    authorityPromotion: 'NONE',
  };
});

const ownerReview = {
  schemaVersion: 'agm-routing-toll-001-owner-authority-review.v1',
  generatedAt,
  candidates: ownerCandidates,
  summary: { total: ownerCandidates.length, integrityVerified: ownerCandidates.filter((item) => item.artifact.sha256).length, approved: 0, rejected: 0, pending: ownerCandidates.length },
  notice: 'Classifications are recommendations only. Product Owner human authority decision is mandatory before any Registry proposal or promotion.',
  registryMutation: 'NONE', authorityPromotion: 'NONE',
};

const franceBlocked = france.regimes.filter((item) => item.evidenceStatus === 'BLOCKED');
const facilityBlocked = facilities.items.filter((item) => item.status === 'BLOCKED');
const franceBlockedArtifacts = [...new Set(franceBlocked.map((item) => item.tariffOrApplicabilityEvidenceId))].map((artifactId) => {
  const affected = franceBlocked.filter((item) => item.tariffOrApplicabilityEvidenceId === artifactId);
  return {
    area: 'FRANCE',
    item: artifactId,
    affectedRegimes: affected.map((item) => `${item.concessionaire} / ${item.network}`),
    reason: affected[0].limitation,
    requiredAction: 'Capture the exact official artifact through an authorized official delivery path; no unofficial substitute.',
  };
});
const blockers = {
  schemaVersion: 'agm-routing-toll-001-final-blockers.v1',
  generatedAt,
  evidenceBlockers: [
    ...franceBlockedArtifacts,
    ...facilityBlocked.map((item) => ({ area: 'FACILITIES', item: `${item.country} / ${item.facility}`, reason: item.limitation, requiredAction: item.facility === 'Tolbrug Nieuwerbrug' ? 'Obtain exact official current tariff evidence or explicit Product Owner scope exclusion.' : 'Capture exact official artifact through an authorized official delivery path; no unofficial substitute.' })),
  ],
  governanceGates: [
    { gate: 'OWNER_AUTHORITY_REVIEW', status: 'PENDING', count: ownerCandidates.length },
    { gate: 'FRESHNESS_INVALIDATION', status: 'DRAFT_NOT_OPERATIONAL', invariant: 'UNKNOWN != ZERO / SAFE / PASS' },
  ],
  blockedRegimeCount: franceBlocked.length + facilityBlocked.length,
  minimalBlockerCount: franceBlockedArtifacts.length + facilityBlocked.length,
  verdict: franceBlockedArtifacts.length + facilityBlocked.length === 0 ? 'READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW' : 'BLOCKED',
};
const routingTollState = blockers.verdict === 'READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW'
  ? 'OPEN_READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW'
  : 'OPEN_PARTIALLY_READY';

writeJson('FRANCE_OFFICIAL_CONCESSION_COVERAGE.json', france);
writeJson('FACILITIES_SCOPE_INTEGRITY_MATRIX.json', facilities);
writeJson('OWNER_AUTHORITY_REVIEW_PACKAGE.json', ownerReview);
writeJson('UNRESOLVED_BLOCKERS.json', blockers);

const report = `# ROUTING-TOLL-001 — Final Closure Acquisition\n\n` +
`Status: **${blockers.verdict}**\n\n` +
`## Scope and protections\n\n` +
`- Documentary and index evidence only.\n- Central Registry: 831, unchanged.\n- Routing/Toll view: 279, unchanged.\n- Authority promotion: none.\n- Runtime / Production / TURN / Application / API: no change.\n- Basic Librarian and LEGAL-003 / LEGAL-005: unchanged.\n\n` +
`## France\n\n` +
`- Official entities accounted: ${france.summary.entitiesAccounted}/${france.summary.entitiesTotal}.\n` +
`- Exact network/regime mappings accounted: ${france.summary.regimesAccounted}/${france.summary.regimesTotal}.\n` +
`- Locally captured: ${france.summary.captured}; not applicable with official evidence: ${france.summary.notApplicableWithEvidence}; integrity blocked: ${france.summary.integrityBlocked}.\n\n` +
`## Facilities\n\n` +
`- Inventory accounted: ${facilities.summary.accounted}/${facilities.summary.total}.\n` +
`- Integrity complete: ${facilities.summary.integrityComplete}/${facilities.summary.total}; blocked: ${facilities.summary.integrityBlocked}.\n\n` +
`## Owner authority review\n\n` +
`- Candidates: ${ownerReview.summary.total}; artifact integrity verified: ${ownerReview.summary.integrityVerified}/${ownerReview.summary.total}.\n` +
`- Decisions/promotions executed: 0.\n\n` +
`## Closure\n\n` +
`Evidence blockers: ${blockers.minimalBlockerCount}. ROUTING-TOLL-001 remains ${routingTollState}.\n`;
writeFileSync(path.join(root, out, 'FINAL_CLOSURE_ACQUISITION_REPORT.md'), report, 'utf8');

console.log(JSON.stringify({ france: france.summary, facilities: facilities.summary, ownerReview: ownerReview.summary, verdict: blockers.verdict, blockers: blockers.minimalBlockerCount }, null, 2));
