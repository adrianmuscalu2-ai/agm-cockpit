import {
  BASELINE,
  PREPARED_AT,
  evidenceRecord,
  freshness,
  guardrails,
  readJson,
  verifyProtectedBaseline,
  writeJson,
  writeText,
} from './legal-gap-owner-review-common.mjs';
import { validateFranceOwnerIngest } from './legal-005-fr-owner-ingest-common.mjs';

const OUT = 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW';
const EVIDENCE = `${OUT}/EVIDENCE`;
const baseline = verifyProtectedBaseline();

const assessment = readJson(`${OUT}/AS_IS_ASSESSMENT.json`);
const matrix = readJson(`${OUT}/RESIDUAL_CLOSURE_MATRIX.json`);
const manifest = readJson(`${OUT}/EVIDENCE_MANIFEST.json`);
const packageData = readJson(`${OUT}/CANDIDATE_AUTHORITY_PACKAGE.json`);

const additions = [
  evidenceRecord({
    evidenceId: 'L005-EV-CH-VRV-20260701',
    sourceId: 'CS-CH-VRV-20260701',
    path: `${EVIDENCE}/LEGAL005-CH-VRV-20260701.official.pdf`,
    mediaType: 'application/pdf',
    officialUrl: 'https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1962/1364_1409_1420/20260701/de/pdf-a/fedlex-data-admin-ch-eli-cc-1962-1364_1409_1420-20260701-de-pdf-a.pdf',
    authority: 'Swiss Confederation / Fedlex',
    status: 'OFFICIAL_PRIMARY_CAPTURED_CURRENT_AT_2026-08-30',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-CH-ARV1-20250501',
    sourceId: 'CS-CH-ARV1-20250501',
    path: `${EVIDENCE}/LEGAL005-CH-ARV1-20250501.official.pdf`,
    mediaType: 'application/pdf',
    officialUrl: 'https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1995/4031_4031_4031/20250501/de/pdf-a/fedlex-data-admin-ch-eli-cc-1995-4031_4031_4031-20250501-de-pdf-a.pdf',
    authority: 'Swiss Confederation / Fedlex',
    status: 'OFFICIAL_PRIMARY_CAPTURED_CURRENT_AT_2026-08-30',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-CH-ASTRA-SONNTAG-NACHT',
    sourceId: 'CS-CH-VRV-20260701',
    path: `${EVIDENCE}/LEGAL005-CH-ASTRA-SONNTAG-NACHT-CURRENT.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://www.astra.admin.ch/de/sonntags-und-nachtfahrten',
    authority: 'Swiss Federal Roads Office ASTRA',
    status: 'OFFICIAL_OPERATIONAL_SUPPORT_CAPTURED',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-CH-ASTRA-VRV-CHANGE-20260701',
    sourceId: 'CS-CH-VRV-20260701',
    path: `${EVIDENCE}/LEGAL005-CH-ASTRA-VRV-CHANGES-20260701.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://www.astra.admin.ch/de/anpassungen-zu-fahrverboten-und-rundstreckenrennen',
    authority: 'Swiss Federal Roads Office ASTRA',
    status: 'OFFICIAL_CHANGE_METADATA_CAPTURED',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-CH-ASTRA-ARV1-CHANGE-20261001',
    sourceId: 'CS-CH-ARV1-20250501',
    path: `${EVIDENCE}/LEGAL005-CH-ASTRA-ARV1-CHANGE-20261001.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://www.astra.admin.ch/de/newnsb/Ip4Q5rCJ2Uz4y6Xsa5J_0',
    authority: 'Swiss Federal Roads Office ASTRA / Swiss Federal Council',
    status: 'OFFICIAL_KNOWN_FUTURE_CHANGE_CAPTURED',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-BE-FED-REGIONAL-COMPETENCE',
    sourceId: null,
    path: `${EVIDENCE}/LEGAL005-BE-FED-REGIONAL-COMPETENCE.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://www.health.belgium.be/fr/themes/environnement/politique-environnementale-belgique/politique-environnementale-belgique',
    authority: 'Belgian Federal Public Service Health / Environment',
    status: 'OFFICIAL_COMPETENCE_STRUCTURE_EVIDENCE',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-BE-FLANDERS-LEZ',
    sourceId: 'CS-BE-VLAANDEREN-LEZ-CURRENT',
    path: `${EVIDENCE}/LEGAL005-BE-FLANDERS-LEZ-CURRENT.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://www.vlaanderen.be/mobiliteit-en-openbare-werken/duurzame-mobiliteit/lage-emissiezones-lez',
    authority: 'Government of Flanders',
    status: 'OFFICIAL_REGIONAL_CURRENT_GUIDANCE_CAPTURED',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-BE-BRUSSELS-LEZ',
    sourceId: 'CS-BE-BRUSSELS-LEZ-CURRENT',
    path: `${EVIDENCE}/LEGAL005-BE-BRUSSELS-LEZ-CURRENT.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://lez.brussels/mytax/fr/practical?tab=Controls',
    authority: 'Brussels-Capital Region',
    status: 'OFFICIAL_REGIONAL_CURRENT_GUIDANCE_CAPTURED',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-BE-WALLONIA-LEZ',
    sourceId: 'CS-BE-WALLONIA-LEZ-FRAMEWORK',
    path: `${EVIDENCE}/LEGAL005-BE-WALLONIA-LEZ-FRAMEWORK.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://wallex.wallonie.be/eli/loi-decret/2019/01/17/2019200758/2024/01/01',
    authority: 'Walloon Region / WALLEX',
    status: 'OFFICIAL_REGIONAL_PRIMARY_LAW_CAPTURED',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-NL-RVV-20260701',
    sourceId: 'CS-NL-RVV-HGV-ACCESS-20260701',
    path: `${EVIDENCE}/LEGAL005-NL-RVV-20260701.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://wetten.overheid.nl/BWBR0004825/2026-07-01',
    authority: 'Government of the Netherlands / Overheid.nl',
    status: 'OFFICIAL_PRIMARY_DATE_PINNED_CAPTURED',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-NL-RVO-ZEZ',
    sourceId: 'CS-NL-RVV-HGV-ACCESS-20260701',
    path: `${EVIDENCE}/LEGAL005-NL-RVO-ENV-ZEZ-CURRENT.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://business.gov.nl/sustainable-business/sustainable-business-operations/zero-emission-zones-in-the-netherlands/',
    authority: 'Netherlands Enterprise Agency RVO',
    status: 'OFFICIAL_OPERATIONAL_SUPPORT_CAPTURED',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-DK-ENV-REG-588',
    sourceId: 'CS-DK-ENV-ZONE-REG-2026-588',
    path: `${EVIDENCE}/LEGAL005-DK-ENV-ZONE-REG-2026-588.official.pdf`,
    mediaType: 'application/pdf',
    officialUrl: 'https://www.retsinformation.dk/eli/lta/2026/588/dan/pdf',
    authority: 'Danish Ministry of Environment / Retsinformation',
    status: 'OFFICIAL_PRIMARY_CAPTURED',
  }),
  evidenceRecord({
    evidenceId: 'L005-EV-DK-ENV-ZONES-PORTAL',
    sourceId: 'CS-DK-ENV-ZONE-REG-2026-588',
    path: `${EVIDENCE}/LEGAL005-DK-ENV-ZONES-CURRENT.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://miljoezoner.dk/en/',
    authority: 'Danish Environmental Protection Agency',
    status: 'OFFICIAL_OPERATIONAL_SUPPORT_CAPTURED',
  }),
];

const existingIds = new Set(manifest.artifacts.map((item) => item.evidenceId));
manifest.artifacts.push(...additions.filter((item) => !existingIds.has(item.evidenceId)));
manifest.officialCapturedOrExisting = manifest.artifacts.filter((item) => item.localValidation === 'PASS').length;
manifest.manualCaptureRequired = ['L005-EV-FR-BASE', 'L005-EV-FR-2026', 'L005-EV-FR-FIRE'];
manifest.scopeResolution = {
  CH: 'Federal primary set: Fedlex VRV SR 741.11 plus ARV 1 SR 822.221; ASTRA pages are support only. Cantonal permit competence is not generalized into a separate nationwide rule.',
  BE: 'Federal road-law context and environmental competence are separated from Flanders, Brussels-Capital and Walloon regional access regimes. No blanket national-ban or national-no-ban conclusion is inferred.',
  NL: 'National statutory access framework in RVV 1990 is separated from municipality-designated environmental/zero-emission zones and local exemptions.',
  DK: 'National environmental-zone regulation is separated from municipality-established zones, temporary traffic controls and bridge-specific operating restrictions. KmToll evidence is not reused.',
};

const byEvidence = Object.fromEntries(manifest.artifacts.map((item) => [item.evidenceId, item]));

function candidate({ candidateId, sourceId, country, authority, evidenceId, supportEvidenceIds = [], scope, reason, limitations, version, effectiveFrom = null, effectiveUntil = null, currentStatus = 'CURRENT', reviewRequired = false, nextFreshnessCheck = '2026-09-30' }) {
  const artifact = byEvidence[evidenceId];
  return {
    candidateId,
    sourceId,
    country,
    domain: 'LEGISLATION_SAFETY',
    authority,
    documentEvidence: {
      canonicalArtifact: artifact.path,
      officialUrl: artifact.officialUrl,
      sha256: artifact.sha256,
      supportEvidenceIds,
    },
    exactScope: scope,
    proposedClassification: 'AUTHORITATIVE_WITH_SCOPE',
    reason,
    limitations,
    freshness: freshness({ effectiveFrom, effectiveUntil, version, nextFreshnessCheck, currentStatus, reviewRequired, limitations }),
    decisionStatus: 'PENDING_PRODUCT_OWNER',
    applyEligibility: 'DECISION_REQUIRED',
    proposedAction: 'ADD_SOURCE_AND_MEMBERSHIP',
    ifApprove: { registryAdd: 1, legislationSafetyViewAdd: 1, effect: 'Eligible for one later scoped source and one legislation-safety membership; no runtime change until a separate apply mandate.' },
    ifReject: { registryAdd: 0, legislationSafetyViewAdd: 0, effect: 'No authority or view inclusion; captured artifact remains evidence only.' },
  };
}

const newCandidates = [
  candidate({
    candidateId: 'LEGAL005-CAND-CH-VRV-20260701', sourceId: 'CS-CH-VRV-20260701', country: 'CH', authority: 'Swiss Confederation / Fedlex', evidenceId: 'L005-EV-CH-VRV-20260701', supportEvidenceIds: ['L005-EV-CH-ASTRA-SONNTAG-NACHT', 'L005-EV-CH-ASTRA-VRV-CHANGE-20260701'],
    scope: 'Swiss Sunday and night driving prohibition, covered vehicle thresholds, statutory exceptions and permit framework in VRV Articles 91–93 as consolidated on 2026-07-01.',
    reason: 'Current official federal consolidated primary legislation, supported by the competent federal road authority.',
    limitations: ['Cantonal permit decisions and cantonal holiday applicability remain jurisdiction-specific.', 'No inference from one canton to nationwide applicability.', 'Dynamic, exceptional-transport and tunnel controls remain separate.'],
    version: 'SR 741.11, Stand am 1. Juli 2026', effectiveFrom: '2026-07-01', nextFreshnessCheck: '2026-09-30',
  }),
  candidate({
    candidateId: 'LEGAL005-CAND-CH-ARV1-20250501', sourceId: 'CS-CH-ARV1-20250501', country: 'CH', authority: 'Swiss Confederation / Fedlex', evidenceId: 'L005-EV-CH-ARV1-20250501', supportEvidenceIds: ['L005-EV-CH-ASTRA-ARV1-CHANGE-20261001'],
    scope: 'Swiss federal working, driving and rest-time obligations, controls and employer duties for professional drivers within ARV 1 scope, as consolidated on 2025-05-01.',
    reason: 'Official federal consolidated primary regulation governing professional drivers.',
    limitations: ['Vehicle and transport applicability must be checked against ARV 1 Article 3 and exclusions.', 'An official change affecting electric delivery vehicles up to 4.25 t is announced for 2026-10-01; no automatic continuation or promotion is permitted.'],
    version: 'SR 822.221, Stand am 1. Mai 2025', effectiveFrom: '2025-05-01', effectiveUntil: '2026-09-30', currentStatus: 'NEW_VERSION_DETECTED', reviewRequired: true, nextFreshnessCheck: '2026-09-01',
  }),
  candidate({
    candidateId: 'LEGAL005-CAND-BE-VLAANDEREN-LEZ', sourceId: 'CS-BE-VLAANDEREN-LEZ-CURRENT', country: 'BE-FLANDERS', authority: 'Government of Flanders', evidenceId: 'L005-EV-BE-FLANDERS-LEZ', supportEvidenceIds: ['L005-EV-BE-FED-REGIONAL-COMPETENCE'],
    scope: 'Flemish LEZ framework and current regional access criteria for vehicle categories M, N and T, including N2/N3 trucks, plus the explicit boundary between regional criteria and local permits.',
    reason: 'Competent regional authority publication defines current operational access scope.',
    limitations: ['Not federal/nationwide authority.', 'Antwerp and Ghent local permits and fees remain local and require their own current evidence.', 'No conclusion for Brussels or Wallonia.'],
    version: 'Live Flemish authority page captured 2026-08-30; 2025-11-28 decision reflected', nextFreshnessCheck: '2026-11-30',
  }),
  candidate({
    candidateId: 'LEGAL005-CAND-BE-BRUSSELS-LEZ', sourceId: 'CS-BE-BRUSSELS-LEZ-CURRENT', country: 'BE-BRUSSELS', authority: 'Brussels-Capital Region', evidenceId: 'L005-EV-BE-BRUSSELS-LEZ', supportEvidenceIds: ['L005-EV-BE-FED-REGIONAL-COMPETENCE'],
    scope: 'Brussels-Capital LEZ access/enforcement status in 2026 for the officially listed vehicle categories, including N2/N3 heavy goods vehicles.',
    reason: 'Official Brussels-Capital operational authority publication.',
    limitations: ['Not federal/nationwide authority.', 'Does not govern Flanders or Wallonia.', 'Vehicle-specific conformity and derogations require the official regional checker and current evidence.'],
    version: 'Live Brussels-Capital LEZ page captured 2026-08-30', nextFreshnessCheck: '2026-09-30',
  }),
  candidate({
    candidateId: 'LEGAL005-CAND-BE-WALLONIA-LEZ', sourceId: 'CS-BE-WALLONIA-LEZ-FRAMEWORK', country: 'BE-WALLONIA', authority: 'Walloon Region / WALLEX', evidenceId: 'L005-EV-BE-WALLONIA-LEZ', supportEvidenceIds: ['L005-EV-BE-FED-REGIONAL-COMPETENCE'],
    scope: 'Walloon statutory framework for vehicle-related air-pollution restrictions and creation/publication of low-emission zones, version pinned to 2024-01-01.',
    reason: 'Official regional primary legislation.',
    limitations: ['Framework authority does not prove that every municipality has an active zone.', 'Municipal perimeters and activation remain local.', 'Not federal/nationwide authority and no conclusion for Flanders or Brussels.'],
    version: 'Walloon decree of 17 January 2019, WALLEX version 2024-01-01', effectiveFrom: '2024-01-01', nextFreshnessCheck: '2026-09-30',
  }),
  candidate({
    candidateId: 'LEGAL005-CAND-NL-RVV-HGV-ACCESS-20260701', sourceId: 'CS-NL-RVV-HGV-ACCESS-20260701', country: 'NL', authority: 'Government of the Netherlands / Overheid.nl', evidenceId: 'L005-EV-NL-RVV-20260701', supportEvidenceIds: ['L005-EV-NL-RVO-ZEZ'],
    scope: 'National statutory RVV 1990 framework for signed environmental and zero-emission access restrictions, including Article 86e rules for vans and trucks, version pinned to 2026-07-01.',
    reason: 'Official national consolidated primary regulation with official RVO operational support.',
    limitations: ['Municipalities designate zone perimeters; this source is not a municipal zone database.', 'Local exemptions and waivers require current municipality/RDW evidence.', 'No blanket national periodic HGV-ban or no-ban conclusion is inferred.'],
    version: 'RVV 1990 BWBR0004825, version 2026-07-01', effectiveFrom: '2026-07-01', nextFreshnessCheck: '2026-09-30',
  }),
  candidate({
    candidateId: 'LEGAL005-CAND-DK-ENV-ZONE-REG-2026-588', sourceId: 'CS-DK-ENV-ZONE-REG-2026-588', country: 'DK', authority: 'Danish Ministry of Environment / Retsinformation', evidenceId: 'L005-EV-DK-ENV-REG-588', supportEvidenceIds: ['L005-EV-DK-ENV-ZONES-PORTAL'],
    scope: 'Danish national technical requirements, documentation, exemptions and enforcement framework for diesel N2/N3 trucks and other covered vehicles in municipality-established environmental zones under BEK nr 588 of 19 June 2026.',
    reason: 'Official national primary regulation with competent environmental-authority operational support.',
    limitations: ['The municipalities establish the geographic zones.', 'Temporary traffic controls and bridge-specific wind/access restrictions remain separate.', 'KmToll authority is not reused and no blanket national periodic HGV-ban or no-ban conclusion is inferred.'],
    version: 'BEK nr 588 af 19/06/2026, published 27/06/2026', nextFreshnessCheck: '2026-09-30',
  }),
];

const candidateIds = new Set(packageData.candidates.map((item) => item.candidateId));
packageData.candidates.push(...newCandidates.filter((item) => !candidateIds.has(item.candidateId)));
packageData.candidateCount = packageData.candidates.length;
packageData.classificationSummary = {
  AUTHORITATIVE_WITH_SCOPE: packageData.candidates.filter((item) => item.proposedClassification === 'AUTHORITATIVE_WITH_SCOPE').length,
  CONTEXTUAL: packageData.candidates.filter((item) => item.proposedClassification === 'CONTEXTUAL').length,
};
packageData.projectedImpact = {
  currentlyApplyEligibleIfApproved: { registryAdd: 18, legislationSafetyViewAdd: 19, registryModify: 0, delete: 0, projectedRegistryCount: 859, projectedLegislationSafetyViewCount: 63 },
  conditionalFranceAfterManualIngestAndApproval: { additionalRegistryAdd: 3, additionalLegislationSafetyViewAdd: 3 },
  allCandidatesAfterAllConditions: { registryAdd: 21, legislationSafetyViewAdd: 22, registryModify: 0, delete: 0, projectedRegistryCount: 862, projectedLegislationSafetyViewCount: 66 },
  note: 'No apply is authorized. Two existing sources are reused; the three France candidates remain blocked until owner manual ingest, validation and SHA-256 reconciliation pass.',
};
packageData.guardrails = guardrails();

for (const row of matrix.coverageUnits) {
  if (row.requirementId === 'LEGAL005-R05') Object.assign(row, { officialAuthority: 'Swiss Confederation / Fedlex and ASTRA', evidenceStatus: 'DEMONSTRATED_LOCAL_CURRENT', currentness: 'CURRENT_2026-07-01_WITH_FRESHNESS_CHECK', gap: null, proposedCandidate: 'CS-CH-VRV-20260701', requiredProductOwnerDecision: 'APPROVE / REJECT / DEFER AUTHORITATIVE_WITH_SCOPE' });
  if (row.requirementId === 'LEGAL005-R06') Object.assign(row, { officialAuthority: 'Swiss Confederation / Fedlex', evidenceStatus: 'DEMONSTRATED_LOCAL_CURRENT_KNOWN_FUTURE_CHANGE', currentness: 'NEW_VERSION_DETECTED_FOR_2026-10-01', gap: null, proposedCandidate: 'CS-CH-ARV1-20250501', requiredProductOwnerDecision: 'APPROVE / REJECT / DEFER AUTHORITATIVE_WITH_SCOPE; preserve 2026-09-30 artifact end' });
  if (row.requirementId === 'LEGAL005-R09') Object.assign(row, { officialAuthority: 'Belgian federal competence evidence plus Flanders, Brussels-Capital and Walloon competent authorities', evidenceStatus: 'DEMONSTRATED_JURISDICTION_STRUCTURE', currentness: 'CURRENT_WITH_REGIONAL_FRESHNESS', gap: null, proposedCandidate: 'Three jurisdiction-scoped BE candidates; no nationwide claim', requiredProductOwnerDecision: 'Three separate APPROVE / REJECT / DEFER decisions' });
  if (row.requirementId === 'LEGAL005-R11') Object.assign(row, { officialAuthority: 'Government of the Netherlands / Overheid.nl and RVO', evidenceStatus: 'DEMONSTRATED_NATIONAL_FRAMEWORK_LOCAL_APPLICATION', currentness: 'CURRENT_VERSION_PINNED_2026-07-01', gap: null, proposedCandidate: 'CS-NL-RVV-HGV-ACCESS-20260701', requiredProductOwnerDecision: 'APPROVE / REJECT / DEFER AUTHORITATIVE_WITH_SCOPE' });
  if (row.requirementId === 'LEGAL005-R19') Object.assign(row, { officialAuthority: 'Danish Ministry of Environment / Retsinformation and Environmental Protection Agency', evidenceStatus: 'DEMONSTRATED_NATIONAL_FRAMEWORK_LOCAL_APPLICATION', currentness: 'CURRENT_BEK_588_2026_WITH_FRESHNESS_CHECK', gap: null, proposedCandidate: 'CS-DK-ENV-ZONE-REG-2026-588', requiredProductOwnerDecision: 'APPROVE / REJECT / DEFER AUTHORITATIVE_WITH_SCOPE' });
}
matrix.summary = { demonstrated: '20/20', locallyValidatedOfficialEvidence: '19/20', unresolvedCoverageUnits: [], preApplyEvidenceBlockers: ['FR_OWNER_MANUAL_INGEST_REQUIRED'] };

Object.assign(assessment, {
  verdict: 'PARTIALLY_READY_BLOCKED',
  currentBaseline: { expected: BASELINE, observed: baseline },
  coverage: { demonstrated: 20, required: 20, ratio: '20/20' },
  officialEvidence: { locallyValidatedOrExistingCanonical: 19, required: 20, ratio: '19/20', note: 'All scope units are resolved. The France road-restriction unit remains excluded from the local-evidence numerator until the three authenticated Légifrance extracts are manually ingested and validated.' },
  missing: ['Three authenticated Légifrance PDF extracts in OWNER_MANUAL_INGEST with validation and SHA-256.'],
  authorityGaps: ['Product Owner decisions are intentionally pending for all candidates.', 'France candidates are reviewable but not apply-eligible until owner manual ingest passes.'],
  blockers: ['FR_OWNER_MANUAL_INGEST_REQUIRED'],
  resolvedScopeBlockers: ['CH_CURRENT_PRIMARY_SET_RESOLVED', 'BE_JURISDICTION_STRUCTURE_RESOLVED', 'NL_NATIONAL_VS_LOCAL_SCOPE_RESOLVED', 'DK_NATIONAL_VS_TEMPORARY_LOCAL_BRIDGE_SCOPE_RESOLVED'],
  candidatePackage: { candidateCount: packageData.candidateCount, classificationSummary: packageData.classificationSummary },
  guardrails: guardrails(),
});

const manualManifest = {
  schemaVersion: 'agm-legal005-fr-owner-manual-ingest.v1',
  gapId: 'LEGAL-005',
  preparedAt: PREPARED_AT,
  status: 'FR_OWNER_MANUAL_INGEST_REQUIRED',
  ingestDirectory: `${OUT}/OWNER_MANUAL_INGEST`,
  artifacts: [
    {
      candidateId: 'LEGAL005-CAND-FR-BASE-2021', sourceId: 'CS-FR-TRUCK-BAN-BASE-2021', filename: 'LEGAL005-FR-BASE-2021.owner-official.pdf', status: 'PENDING_OWNER_MANUAL_INGEST',
      officialPageUrl: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043416004',
      officialDirectPdfUrl: 'https://www.legifrance.gouv.fr/download/file/mTQmrT_h8XoTCnPyUniP4cwJ0r_iDxNUqTQ-vf-OMW0%3D/JOE_TEXTE',
      title: "Arrêté du 16 avril 2021 relatif à l'interdiction de circulation des véhicules de transport de marchandises à certaines périodes", nor: 'TRAT2031119A', jorf: 'JORF n°0097 du 24 avril 2021, texte n°37', textId: 'JORFTEXT000043416004', effectiveFrom: '2021-05-01', effectiveUntil: null,
      expectedPages: 7, requiredContent: ['Articles 1–12', 'Annexes I–III', '>7.5 t scope', 'general, annual-complement and Île-de-France rules', 'exceptions, derogations and evidence requirements'],
    },
    {
      candidateId: 'LEGAL005-CAND-FR-2026', sourceId: 'CS-FR-TRUCK-BAN-2026', filename: 'LEGAL005-FR-ANNUAL-2026.owner-official.pdf', status: 'PENDING_OWNER_MANUAL_INGEST',
      officialPageUrl: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053324056',
      officialDirectPdfUrl: 'https://www.legifrance.gouv.fr/download/file/6ejXbGtsYRG8fw1VAWB5ZOTCvxX3FYcI_q8c2uAQ9wo%3D/JOE_TEXTE',
      title: "Arrêté du 26 décembre 2025 relatif aux interdictions complémentaires de circulation des véhicules de transport de marchandises pour l'année 2026", nor: 'TRAT2529272A', jorf: 'JORF n°0006 du 8 janvier 2026, texte n°28', textId: 'JORFTEXT000053324056', effectiveFrom: '2026-01-09', effectiveUntil: '2026-12-31',
      expectedPages: 2, requiredContent: ['Articles 1–4', 'single complete Auvergne-Rhône-Alpes routes annex', '>7.5 t scope', 'all 2026 winter and summer dates/hours'],
    },
    {
      candidateId: 'LEGAL005-CAND-FR-FIRE-2026', sourceId: 'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026', filename: 'LEGAL005-FR-FIRE-DEROGATION-2026.owner-official.pdf', status: 'PENDING_OWNER_MANUAL_INGEST_EXPIRY_WARNING',
      officialPageUrl: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054633358',
      officialDirectPdfUrl: null,
      title: "Arrêté du 6 août 2026 portant levée d'interdiction de circulation des véhicules réalisant des transports de marchandises nécessaires à la lutte contre les incendies", nor: 'TRAT2621637A', jorf: 'JORF n°0183 du 7 août 2026, texte n°47', textId: 'JORFTEXT000054633358', effectiveFrom: '2026-08-08', effectiveUntil: '2026-08-31',
      expectedPages: 2, requiredContent: ['Articles 1–3', '>7.5 t fire-response scope', 'empty-return permission', 'proof-on-control obligation', 'end date 2026-08-31 inclusive', 'second-page Interior Ministry signature block'],
      freshnessStatus: 'EXPIRY_WARNING', expiryTransition: 'At 2026-08-31 and thereafter: EXPIRED_REVIEW_REQUIRED; never CURRENT and never ZERO.',
    },
  ],
  validationRequired: ['PDF openable', 'official Légifrance/JORF identity', 'complete expected page count and content', 'no Cloudflare/challenge/blank/clipped pages', 'effective period reconciled', 'SHA-256 calculated', 'candidate package reconciled without authority promotion'],
  guardrails: guardrails(),
};

const ingestResults = validateFranceOwnerIngest(manualManifest, OUT);
const ingestBySource = new Map(ingestResults.map((item) => [item.sourceId, item]));
for (const artifact of manualManifest.artifacts) {
  const validation = ingestBySource.get(artifact.sourceId);
  if (validation.result === 'PASS') {
    Object.assign(artifact, {
      status: 'RESOLVED_VALIDATED',
      canonicalPath: validation.relativePath,
      sizeBytes: validation.sizeBytes,
      sha256: validation.sha256,
      validatedPages: validation.pages,
      validationChecks: validation.checks,
      resolvedAt: PREPARED_AT,
    });
  } else if (validation.result === 'FAIL') {
    Object.assign(artifact, { status: 'OWNER_MANUAL_INGEST_VALIDATION_FAILED', validationChecks: validation.checks });
  }
}

const resolvedIngest = ingestResults.filter((item) => item.result === 'PASS');
const unresolvedIngest = ingestResults.filter((item) => item.result !== 'PASS');
const allFranceIngestResolved = unresolvedIngest.length === 0;
manualManifest.status = allFranceIngestResolved ? 'READY_FOR_PRODUCT_OWNER_AUTHORITY_REVIEW' : 'FR_OWNER_MANUAL_INGEST_REQUIRED';
manualManifest.resolved = resolvedIngest.map((item) => item.sourceId);
manualManifest.remaining = unresolvedIngest.map((item) => ({ sourceId: item.sourceId, filename: item.filename, status: item.result }));

const franceEvidenceIds = {
  'CS-FR-TRUCK-BAN-BASE-2021': 'L005-EV-FR-BASE',
  'CS-FR-TRUCK-BAN-2026': 'L005-EV-FR-2026',
  'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026': 'L005-EV-FR-FIRE',
};
for (const validation of resolvedIngest) {
  const evidence = manifest.artifacts.find((item) => item.evidenceId === franceEvidenceIds[validation.sourceId]);
  Object.assign(evidence, {
    path: validation.relativePath,
    status: 'OWNER_MANUAL_INGEST_VALIDATED',
    sizeBytes: validation.sizeBytes,
    sha256: validation.sha256,
    localValidation: 'PASS',
  });

  const candidate = packageData.candidates.find((item) => item.sourceId === validation.sourceId);
  candidate.documentEvidence.canonicalArtifact = validation.relativePath;
  candidate.documentEvidence.sha256 = validation.sha256;
  candidate.limitations = candidate.limitations.filter((item) => !/Cloudflare|canonical acquisition|SHA-256 exists yet/i.test(item));
  candidate.freshness.limitations = candidate.freshness.limitations.filter((item) => !/Cloudflare|canonical acquisition|SHA-256 exists yet/i.test(item));
  candidate.applyEligibility = 'ELIGIBLE_AFTER_PRODUCT_OWNER_APPROVAL';
  candidate.ifApprove = {
    registryAdd: 1,
    legislationSafetyViewAdd: 1,
    effect: 'If separately approved and later included in an authorized apply, add this scope-bound source and its Legislation/Safety membership.',
  };
}

packageData.projectedImpact.currentlyApplyEligibleIfApproved = {
  registryAdd: 18 + resolvedIngest.length,
  legislationSafetyViewAdd: 19 + resolvedIngest.length,
  registryModify: 0,
  delete: 0,
  projectedRegistryCount: 859 + resolvedIngest.length,
  projectedLegislationSafetyViewCount: 63 + resolvedIngest.length,
};

manifest.manualCaptureRequired = unresolvedIngest.map((item) => franceEvidenceIds[item.sourceId]);
manifest.officialCapturedOrExisting = manifest.artifacts.filter((item) => item.localValidation === 'PASS').length;

const franceRoadRow = matrix.coverageUnits.find((row) => row.requirementId === 'LEGAL005-R07');
if (franceRoadRow) {
  Object.assign(franceRoadRow, allFranceIngestResolved ? {
    evidenceStatus: 'DEMONSTRATED_LOCAL_COMPLETE',
    currentness: 'CURRENT_WITH_FIRE_DEROGATION_EXPIRY_CONTROL',
    gap: null,
    requiredProductOwnerDecision: 'Three separate APPROVE / REJECT / DEFER decisions',
  } : {
    evidenceStatus: `DEMONSTRATED_PARTIAL_LOCAL_${resolvedIngest.length}_OF_3`,
    currentness: 'PARTIAL_EVIDENCE_SET_REVIEW_REQUIRED',
    gap: `${unresolvedIngest.length} authenticated Légifrance extract(s) remain unvalidated`,
    requiredProductOwnerDecision: 'Complete remaining owner manual ingest, then three separate APPROVE / REJECT / DEFER decisions',
  });
}

const officialEvidenceCount = allFranceIngestResolved ? 20 : 19;
matrix.summary = {
  demonstrated: '20/20',
  locallyValidatedOfficialEvidence: `${officialEvidenceCount}/20`,
  unresolvedCoverageUnits: [],
  preApplyEvidenceBlockers: allFranceIngestResolved ? [] : ['FR_OWNER_MANUAL_INGEST_REQUIRED'],
};
Object.assign(assessment, {
  verdict: allFranceIngestResolved ? 'READY_FOR_PRODUCT_OWNER_AUTHORITY_REVIEW' : 'PARTIALLY_READY_BLOCKED',
  officialEvidence: {
    locallyValidatedOrExistingCanonical: officialEvidenceCount,
    required: 20,
    ratio: `${officialEvidenceCount}/20`,
    note: allFranceIngestResolved
      ? 'All three authenticated Légifrance extracts passed canonical local validation.'
      : `${resolvedIngest.length}/3 authenticated Légifrance extracts passed; the France requirement unit remains outside the completed local-evidence numerator until the set is complete.`,
  },
  missing: unresolvedIngest.map((item) => item.filename),
  authorityGaps: allFranceIngestResolved
    ? ['Product Owner decisions are intentionally pending for all candidates.']
    : ['Product Owner decisions are intentionally pending for all candidates.', 'Remaining France candidates are not apply-eligible until owner manual ingest passes.'],
  blockers: allFranceIngestResolved ? [] : ['FR_OWNER_MANUAL_INGEST_REQUIRED'],
});

writeJson(`${OUT}/AS_IS_ASSESSMENT.json`, assessment);
writeJson(`${OUT}/RESIDUAL_CLOSURE_MATRIX.json`, matrix);
writeJson(`${OUT}/EVIDENCE_MANIFEST.json`, manifest);
writeJson(`${OUT}/CANDIDATE_AUTHORITY_PACKAGE.json`, packageData);
writeJson(`${OUT}/OWNER_MANUAL_INGEST_MANIFEST.json`, manualManifest);

for (const [index, item] of manualManifest.artifacts.entries()) {
  writeText(`${OUT}/OWNER_MANUAL_INGEST/${String(index + 1).padStart(2, '0')}_${item.sourceId}_CHECKLIST.md`, `# ${item.sourceId} — OWNER MANUAL INGEST

Status: **${item.status}**

## Official source

- Official page: ${item.officialPageUrl}
- Preferred action: click **Extrait du Journal officiel électronique authentifié** and download the PDF.
${item.officialDirectPdfUrl ? `- Official direct PDF: ${item.officialDirectPdfUrl}` : '- Direct PDF URL is intentionally not invented; use the authenticated-extract control on the official page.'}
- Identity: ${item.jorf}; NOR ${item.nor}; ${item.textId}

## Canonical filename

Save exactly as \`${item.filename}\` inside this \`OWNER_MANUAL_INGEST\` directory.

## Expected completeness

- Expected authenticated-extract pages: ${item.expectedPages}. If Légifrance reports a different count, stop and reconcile instead of truncating or forcing the expected count.
- Required content: ${item.requiredContent.join('; ')}.
- Effective period: ${item.effectiveFrom} → ${item.effectiveUntil ?? 'no explicit end; do not invent one'}.
- Required validation: opens as PDF; official identity; every page present; no Cloudflare/challenge, blank or clipped page; content/effective period reconciled; SHA-256 calculated.
${item.expiryTransition ? `- Freshness rule: ${item.expiryTransition}` : ''}

Do not mutate Registry/view, promote authority, change runtime/Production, apply, commit or push during ingestion.
`);
}

const reviewMarkdown = packageData.candidates.map((item, index) => {
  const evidence = item.documentEvidence;
  return `## ${index + 1}. ${item.candidateId}

- SourceId: ${item.sourceId}
- Country/domain: ${item.country} / ${item.domain}
- Issuing authority: ${item.authority}
- Evidence: ${typeof evidence === 'string' ? evidence : `${evidence.canonicalArtifact ?? 'OWNER_MANUAL_INGEST_PENDING'}; ${evidence.officialUrl ?? 'official URL in manifest'}; SHA-256 ${evidence.sha256 ?? 'PENDING'}`}
- Exact scope: ${item.exactScope}
- Effective/freshness: ${item.freshness.effectiveFrom ?? 'not explicitly stated'} → ${item.freshness.effectiveUntil ?? 'no explicit end'}; ${item.freshness.currentStatus}; next check ${item.freshness.nextFreshnessCheck}
- Proposed classification: ${item.proposedClassification}
- Reason: ${item.reason}
- Limitations/caveats: ${(item.limitations ?? []).join(' | ') || 'None beyond approved scope and freshness policy.'}
- If APPROVE: ${item.ifApprove.effect} Impact registry/view: +${item.ifApprove.registryAdd}/+${item.ifApprove.legislationSafetyViewAdd}.
- If REJECT: ${item.ifReject.effect} Impact registry/view: +0/+0.
- Decision requested: **APPROVE / REJECT / DEFER**
`;
}).join('\n');

writeText(`${OUT}/PRODUCT_OWNER_AUTHORITY_REVIEW_PACKAGE.md`, `# LEGAL-005 — candidate authority review package

All ${packageData.candidateCount} decisions are PENDING. No approval is assumed. ${allFranceIngestResolved ? 'France owner manual ingest is 3/3 validated; no evidence blocker remains.' : `France owner manual ingest is ${resolvedIngest.length}/3 validated; unresolved France candidates remain apply-ineligible.`}

${reviewMarkdown}`);

writeText(`${OUT}/OWNER_MANUAL_CAPTURE_CHECKLIST.md`, `# LEGAL-005 — residual manual acquisition

## France — ${allFranceIngestResolved ? 'OWNER MANUAL INGEST COMPLETE' : 'FR_OWNER_MANUAL_INGEST_REQUIRED'}

Resolved: ${resolvedIngest.length}/3. Remaining exact files: ${unresolvedIngest.length ? unresolvedIngest.map((item) => `\`${item.filename}\``).join(', ') : 'none'}.

The exact three-file package is in \`OWNER_MANUAL_INGEST_MANIFEST.json\` and the \`OWNER_MANUAL_INGEST\` directory. Use only Légifrance's **Extrait du Journal officiel électronique authentifié**. Do not retry Cloudflare bypasses and do not use third-party copies as authority.

The CH, BE, NL and DK evidence/scope blockers are resolved in the evidence manifest and residual closure matrix. No blanket national-ban or no-ban conclusion was inferred for BE, NL or DK.
`);

writeText(`${OUT}/REPORT.md`, `# LEGAL-005 — final blocker resolution before authority review

- Status: ${allFranceIngestResolved ? 'READY FOR PRODUCT OWNER AUTHORITY REVIEW' : 'PARTIALLY_READY / BLOCKED'}
- Coverage: 20/20 requirement units
- Locally validated official evidence: ${officialEvidenceCount}/20 requirement units
- Candidates: ${packageData.candidateCount} PENDING (${packageData.classificationSummary.AUTHORITATIVE_WITH_SCOPE} AUTHORITATIVE_WITH_SCOPE; ${packageData.classificationSummary.CONTEXTUAL} CONTEXTUAL)
- Resolved: CH primary federal set; BE federal/regional/jurisdiction structure; NL national/statutory versus municipal access scope; DK national versus municipal/temporary/bridge-specific scope.
- France owner manual ingest: ${resolvedIngest.length}/3 validated; remaining ${unresolvedIngest.length}.
- Exact blocker: ${allFranceIngestResolved ? 'NONE' : `FR_OWNER_MANUAL_INGEST_REQUIRED for ${unresolvedIngest.length} authenticated Légifrance extract(s): ${unresolvedIngest.map((item) => item.filename).join(', ')}.`}
- Registry/view/runtime: unchanged; no authority promotion; no apply; no commit/push.
`);

console.log(JSON.stringify({ gapId: 'LEGAL-005', status: assessment.verdict, coverage: assessment.coverage.ratio, officialEvidence: assessment.officialEvidence.ratio, evidenceRepresentations: manifest.artifacts.length, locallyValidated: manifest.artifacts.filter((item) => item.localValidation === 'PASS').length, candidates: packageData.candidateCount, exactBlockers: assessment.blockers, protectedBaseline: baseline }, null, 2));
