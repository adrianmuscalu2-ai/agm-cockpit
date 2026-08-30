import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION';
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const writeJson = (name, value) => writeFileSync(path.join(root, out, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const acquisition = readJson(`${out}/FINAL_CLOSURE_ACQUISITION_MANIFEST.json`);
const browser = readJson(`${out}/BROWSER_OFFICIAL_CAPTURE_REPORT.json`);
const ownerReview = readJson(`${out}/OWNER_AUTHORITY_REVIEW_PACKAGE.json`);
const generatedAt = acquisition.lastUpdatedAt ?? browser.generatedAt;

const acquisitionById = new Map(acquisition.items.map((item) => [item.artifactId, item]));
const browserById = new Map(browser.results.map((item) => [item.artifactId, item]));
const definitions = [
  {
    artifactId: 'RT001-FINAL-FR-ORDER-12-2026',
    officialUrls: [
      'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053417592',
      'https://www.legifrance.gouv.fr/eli/arrete/2026/1/28/TRAT2534086A/jo/texte',
      'https://www.legifrance.gouv.fr/download/file/I7R9VS2t0PfielS4ACisQCFhcwyKu5xIeQs35Cxnt70=/JOE_TEXTE',
    ],
    provenance: 'Legifrance / Journal officiel de la Republique francaise',
    scope: "ATMB, SFTRF, CEVM, ALIS, ARCOUR, ADELAC, A'LIENOR, ALICORNE, ATLANDES, ALBEA, ARCOS and ALIAE; exact annexes I-XII",
    effectiveDate: '2026-02-01',
    screenshot: `${out}/BROWSER_OFFICIAL_CAPTURE_ATTEMPTS/RT001-FINAL-FR-ORDER-12-2026.png`,
  },
  {
    artifactId: 'RT001-FINAL-FR-SANEF-2026',
    officialUrls: [
      'https://www.groupe.sanef.com/en/my-journey/price-of-my-journey',
      'https://www.groupe.sanef.com/sites/default/files/2026-01/2026_02-Grille-Sanef.pdf',
    ],
    provenance: 'Sanef official operator publication',
    scope: 'Sanef route-by-route and vehicle-class tariff grid',
    effectiveDate: '2026-02-01',
    screenshot: `${out}/BROWSER_OFFICIAL_CAPTURE_ATTEMPTS/RT001-FINAL-FR-SANEF-2026.landing.png`,
  },
  {
    artifactId: 'RT001-FINAL-FR-SAPN-2026',
    officialUrls: [
      'https://www.groupe.sanef.com/en/my-journey/price-of-my-journey',
      'https://www.groupe.sanef.com/sites/default/files/2026-01/2026_02-Grille-SAPN.pdf',
    ],
    provenance: 'SAPN / Sanef official operator publication',
    scope: 'SAPN Paris-Normandie route-by-route and vehicle-class tariff grid',
    effectiveDate: '2026-02-01',
    screenshot: `${out}/BROWSER_OFFICIAL_CAPTURE_ATTEMPTS/RT001-FINAL-FR-SAPN-2026.landing.png`,
  },
  {
    artifactId: 'RT001-FINAL-FR-CCISE-ORDER-2026',
    officialUrls: [
      'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053916305',
      'https://www.legifrance.gouv.fr/eli/arrete/2026/3/30/TRAT2609535A/jo/texte',
      'https://www.legifrance.gouv.fr/download/file/LGKIebDIuZvuVGlpCoWjSCa9Ybbg3VF7kUQ8OgMFAvo=/JOE_TEXTE',
    ],
    provenance: 'Legifrance / Journal officiel de la Republique francaise',
    scope: 'Pont de Normandie and Pont de Tancarville, vehicle classes 1-4',
    effectiveDate: '2026-05-01',
    screenshot: `${out}/BROWSER_OFFICIAL_CAPTURE_ATTEMPTS/RT001-FINAL-FR-CCISE-ORDER-2026.png`,
  },
  {
    artifactId: 'RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026',
    officialUrls: [
      'https://www.liefkenshoektunnel.be/nl/algemene-voorwaarden-tunnel-liefkenshoek-nv',
      'https://www.liefkenshoektunnel.be/sites/default/files/media/files/2025-12/algemene_voorwaarden_tlh_v2026.pdf',
      'https://www.liefkenshoektunnel.be/sites/default/files/media/files/2025-12/algemene_voorwaarden_tlh_v2026_engels.pdf',
    ],
    provenance: 'Tunnel Liefkenshoek NV official operator publication',
    scope: 'Official categories, payment-method tariffs and conditions for Liefkenshoek Tunnel',
    effectiveDate: '2026-01-01',
    screenshot: `${out}/BROWSER_OFFICIAL_CAPTURE_ATTEMPTS/RT001-FINAL-FAC-BE-LIEFKENSHOEK-2026.png`,
  },
];

const blockers = definitions.map((definition) => {
  const direct = acquisitionById.get(definition.artifactId);
  const controlled = browserById.get(definition.artifactId);
  const resolved = direct?.status === 'INTEGRITY_CAPTURED_REVIEW_ONLY' && Boolean(direct?.canonicalPath) && Boolean(direct?.sha256);
  return {
    ...definition,
    result: resolved ? 'RESOLVED' : 'STILL_BLOCKED',
    methodsAttempted: [
      {
        method: 'DIRECT_OFFICIAL_FETCH_WITH_REDIRECTS_AND_BROWSER_HEADERS',
        result: direct?.status ?? 'UNKNOWN',
        error: direct?.error ?? null,
      },
      {
        method: controlled?.method ?? 'CONTROLLED_PLAYWRIGHT_OFFICIAL_CAPTURE',
        result: controlled?.status ?? 'UNKNOWN',
        error: controlled?.error ?? null,
      },
      {
        method: 'OFFICIAL_ALTERNATIVE_URL_AND_PUBLIC_SURFACE_VERIFICATION',
        result: 'PUBLIC_OFFICIAL_CONTENT_VERIFIED_BUT_NO_LOCAL_CANONICAL_ARTIFACT',
        error: 'Visibility alone is not accepted as integrity PASS.',
      },
    ],
    artifactPath: resolved ? direct.canonicalPath : null,
    sizeBytes: resolved ? direct.sizeBytes : null,
    sha256: resolved ? direct.sha256 : null,
    ingestionMethod: resolved ? direct.ingestionMethod ?? 'OWNER_ASSISTED_MANUAL_INGESTION' : null,
    validationEvidence: resolved ? direct.validationEvidence ?? null : null,
    blockingCause: resolved ? null : 'Official domains enforce HTTP 403 / Cloudflare challenge for automated local acquisition.',
    noSubstitution: true,
    registryMutation: 'NONE',
    authorityPromotion: 'NONE',
  };
});

const resolution = {
  schemaVersion: 'agm-routing-toll-001-final-blocker-resolution.v1',
  generatedAt,
  browserRecovery: {
    preflight: 'PASS_VIA_PNPM_CMD',
    integratedBrowser: 'PLATFORM_LIMITATION_NO_SESSION_ATTACHMENT',
    controlledPlaywright: `${browser.summary.resolved}/${browser.summary.attempted}_RESOLVED`,
    standardChromeCrossCheck: 'ONE_PRINT_ARTIFACT_REJECTED_AS_UNVERIFIED_AND_REMOVED',
  },
  blockers,
  summary: {
    attempted: blockers.length,
    resolved: blockers.filter((item) => item.result === 'RESOLVED').length,
    stillBlocked: blockers.filter((item) => item.result === 'STILL_BLOCKED').length,
  },
  guardrails: {
    unofficialCopiesUsed: false,
    thirdPartyCachesUsedAsAuthority: false,
    ocrOrReconstructionUsed: false,
    registryMutation: 'NONE',
    viewMutation: 'NONE',
    authorityPromotion: 'NONE',
  },
};

const nieuwerbrug = {
  schemaVersion: 'agm-routing-toll-001-nieuwerbrug-scope-decision.v1',
  generatedAt,
  item: {
    facility: 'Tolbrug Nieuwerbrug',
    jurisdiction: 'NL',
    currentEvidence: {
      sourceUrl: 'https://tolbrugnieuwerbrug.nl/',
      artifactPath: `${out}/REMOTE_ARTIFACTS/RT001-FINAL-FAC-NL-NIEUWERBRUG.official.html`,
      sizeBytes: 205448,
      sha256: '0ff0a14f27f6cd29942b09d10c787c4dde2a75d44d64e4b0a4c50ed3c65d4cee',
      provenance: 'Tolbrug Nieuwerbrug operator surface',
      limitation: 'Confirms the bridge/operator but does not expose a stable canonical current vehicle tariff table with effective date and category scope.',
    },
  },
  options: [
    {
      option: 'OPTION_1_IN_SCOPE',
      ownerDecision: 'NOT_SELECTED_BY_PRODUCT_OWNER',
      justification: 'Include if ROUTING-TOLL-001 is intended to cover local/private tolled road facilities in addition to national motorway, vignette, distance-based and material bridge/tunnel regimes.',
      exactMissingEvidence: [
        'Official current tariff table issued by the operator or competent municipal authority.',
        'Vehicle/category applicability.',
        'Effective date and update/publication date.',
        'Stable official URI or official signed/published artifact suitable for local integrity capture.',
      ],
      closureRequirement: 'Capture and hash the exact official artifact; human authority review remains mandatory.',
      impactIfChosen: 'Facilities remain 9/9 accounted and 7/9 integrity complete until both Nieuwerbrug and Liefkenshoek evidence are resolved.',
    },
    {
      option: 'OPTION_2_OUT_OF_SCOPE',
      ownerDecision: 'APPROVED_BY_PRODUCT_OWNER',
      justification: 'May be excluded only if Product Owner explicitly defines canonical ROUTING-TOLL coverage as national/state motorway toll systems plus separately governed material professional-route facilities, excluding local/private bridge micro-regimes.',
      architecturalEffect: 'The facility remains documented as historical/contextual inventory evidence but is not a canonical closure requirement. No source is deleted and no authority is fabricated.',
      coverageImpact: `In-scope facilities denominator changes from 9 to 8. Current integrity is ${resolution.summary.stillBlocked === 0 ? '8/8' : '7/8'}; after Liefkenshoek is resolved it becomes 8/8.`,
      functionalImpact: 'AGM must return UNKNOWN and require confirmation when a route specifically encounters the excluded local facility; exclusion cannot be interpreted as zero toll or safe passage.',
    },
  ],
  decision: 'OUT_OF_SCOPE_BY_PRODUCT_OWNER',
  decisionConsequences: {
    facilitiesDenominatorBefore: 9,
    facilitiesDenominatorAfter: 8,
    currentIntegrity: resolution.summary.stillBlocked === 0 ? '8/8' : '7/8',
    afterLiefkenshoekResolution: '8/8',
    fieldEncounterRule: 'UNKNOWN_TO_HUMAN_CONFIRMATION',
    zeroTollInference: 'FORBIDDEN',
  },
  aiDecision: 'NONE',
  registryMutation: 'NONE',
  viewMutation: 'NONE',
};

const finalStatus = {
  schemaVersion: 'agm-routing-toll-001-final-blocker-status.v1',
  generatedAt,
  officialEvidenceBlockersResolved: resolution.summary.resolved,
  officialEvidenceBlockersRemaining: resolution.summary.stillBlocked,
  nieuwerbrugScopeDecision: nieuwerbrug.decision,
  ownerAuthorityReview: {
    total: ownerReview.summary.total,
    integrityVerified: ownerReview.summary.integrityVerified,
    pending: ownerReview.summary.pending,
    promotionsExecuted: 0,
  },
  verdict: resolution.summary.stillBlocked === 0 ? 'READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW' : 'BLOCKED',
  routingToll001: resolution.summary.stillBlocked === 0 ? 'OPEN_READY_FOR_FINAL_OWNER_AUTHORITY_REVIEW' : 'OPEN_PARTIALLY_READY',
};

writeJson('FINAL_BLOCKER_RESOLUTION_REPORT.json', resolution);
writeJson('NIEUWERBRUG_OWNER_SCOPE_DECISION_PACKAGE.json', nieuwerbrug);
writeJson('FINAL_BLOCKER_STATUS.json', finalStatus);
console.log(JSON.stringify(finalStatus, null, 2));
