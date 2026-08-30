import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const evidenceRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CLOSURE';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const expectedRegistrySha256 = 'af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31';
const generatedAt = '2026-08-30T00:00:00.000Z';
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));
const hashFile = (relative) => createHash('sha256').update(readFileSync(path.join(root, relative))).digest('hex');
const writeJson = (name, value) => writeFileSync(path.join(root, evidenceRoot, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const registry = readJson(registryPath);
const view = readJson(viewPath);
const candidates = readJson('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_ASSESSMENT/PROPOSED_OFFICIAL_SOURCE_CANDIDATES.json');
const acquisition = readJson(`${evidenceRoot}/REMOTE_ACQUISITION_MANIFEST.json`);
const registryIds = new Set(registry.sources.map((source) => source.sourceId));
const acquisitionById = new Map(acquisition.records.map((record) => [record.proposalId, record]));

const dispositions = {
  'CS-DE-TOLL-COLLECT-RATES': ['CS-DE-TOLL-COLLECT-RATES', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'DE_HEAVY_OPERATIONAL_RATES', 'Dynamic operator tariff page; pair with BFStrMG and enforce freshness.'],
  'CS-DE-BFSTRMG': ['CS-DE-BFSTRMG', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'DE_HEAVY_LEGAL_BASIS', 'Primary national legislation; human legal applicability review required.'],
  'CS-AT-ASFINAG-GO-TOLL': ['CS-AT-ASFINAG-GO-TOLL', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'AT_GO_OVER_3_5T', 'Official 2026 tariff PDF for vehicles over 3.5 t.'],
  'RT001-PROP-AT-VIGNETTE-SECTION-2026': ['CS-AT-ASFINAG-VIGNETTE-SECTION-2026', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'AT_VIGNETTE_AND_SECTION_UP_TO_3_5T', 'Official 2026 vignette and section-toll PDF; keep separate from GO.'],
  'CS-CH-BAZG-ROAD-LEVIES': ['CS-CH-BAZG-ROAD-LEVIES', 'KEEP_CANDIDATE_REFINEMENT_REQUIRED', 'CH_PORTAL_ONLY', 'Official portal captured, but exact current LSVA and vignette tariff artifacts/effective dates are not bundled.'],
  'CS-BE-VIAPASS': ['CS-BE-VIAPASS', 'PROPOSE_ADD_CONTEXTUAL', 'BE_AUTHORITY_AND_SCOPE_PORTAL', 'Official authority portal; does not replace the dated tariff table or separately governed facilities.'],
  'RT001-PROP-BE-VIAPASS-RATES-2026': ['CS-BE-VIAPASS-RATES-2026', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'BE_HEAVY_REGIONAL_RATES', 'Official dated regional/vehicle/emissions tariff table.'],
  'CS-PL-ETOLL-RATES': ['CS-PL-ETOLL-RATES', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'PL_HEAVY_ETOLL', 'Official e-TOLL heavy/bus rates; passenger concession motorways remain outside scope.'],
  'CS-CZ-MYTO-RATES-2026': ['CS-CZ-MYTO-RATES-2026', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'CZ_MYTO_OVER_3_5T', 'Official 2026 heavy toll rates.'],
  'RT001-PROP-CZ-EDALNICE-LIGHT': ['CS-CZ-EDALNICE-VIGNETTE-2026', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'CZ_EDALNICE_UP_TO_3_5T', 'Official light-vehicle vignette portal; keep separate from myto.'],
  'CS-DK-KMTOLL-EETS': ['CS-DK-KMTOLL-EETS', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'DK_KMTOLL_NETWORK_12T_PLUS', 'Official tolled-network scope; exact rate artifact still needed for complete tariff coverage.'],
  'RT001-PROP-DK-STOREBAELT-2026': ['CS-DK-STOREBAELT-RATES-2026', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'DK_STOREBAELT_FIXED_TOLL', 'Official 2026 bridge prices; separate from KmToll.'],
  'RT001-PROP-DK-ORESUND-2026': ['CS-DK-SE-ORESUND-RATES-2026', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'DK_SE_ORESUND_FIXED_TOLL', 'Official 2026 bridge prices by vehicle; cross-border scope must be explicit.'],
  'CS-NL-TRUCK-TOLL': ['CS-NL-TRUCK-TOLL', 'PROPOSE_ADD_CONTEXTUAL', 'NL_TRUCK_AUTHORITY_PORTAL', 'Official truck-charge portal; exact dated tariff artifact is still needed.'],
  'RT001-PROP-NL-A24-ETOL-2026': ['CS-NL-A24-ETOL-2026', 'PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE', 'NL_A24_FIXED_TOLL', 'Official government rates and non-stacking rule; separate from truck charging.'],
  'CS-FR-MOTORWAY-TOLLS': ['CS-FR-MOTORWAY-TOLLS', 'PROPOSE_ADD_CONTEXTUAL', 'FR_CONCESSION_FRAMEWORK', 'Official government framework only; not the exact route/class tariff grids.'],
  'RT001-PROP-FR-ART-TARIFF-GOVERNANCE': ['CS-FR-ART-TARIFF-GOVERNANCE', 'PROPOSE_ADD_CONTEXTUAL', 'FR_TARIFF_GOVERNANCE', 'Official regulator context; concessionaire-specific current grids remain missing.'],
  'CS-LU-EVIGNETTE-2019': ['CS-LU-EVIGNETTE-2019', 'KEEP_HISTORICAL_DO_NOT_PROMOTE', 'LU_STALE_HISTORICAL_GUIDANCE', 'Preserve as evidence of the prior source; not current authority.'],
  'RT001-PROP-LU-CUSTOMS-EUROVIGNETTE': ['CS-LU-CUSTOMS-EUROVIGNETTE', 'KEEP_CANDIDATE_CURRENTNESS_REVIEW_REQUIRED', 'LU_HEAVY_SCOPE_PORTAL', 'Official Customs source, but multi-country wording may lag 2026 changes.'],
  'RT001-PROP-LU-EUROVIGNETTE-TARIFF-20250325': ['CS-LU-EUROVIGNETTE-TARIFF-20250325', 'KEEP_CANDIDATE_CURRENTNESS_REVIEW_REQUIRED', 'LU_HEAVY_TARIFF_2025', 'Official tariff artifact with a 2025 effective date; continued 2026 applicability is not demonstrated.'],
};

const reviewedCandidates = candidates.candidates.map((candidate) => {
  const disposition = dispositions[candidate.proposalId];
  const acquired = acquisitionById.get(candidate.proposalId);
  if (!disposition || !acquired) throw new Error(`Missing review data for ${candidate.proposalId}`);
  const localHash = acquired.localEvidencePath ? hashFile(acquired.localEvidencePath) : null;
  return {
    inputProposalId: candidate.proposalId,
    proposedSourceId: disposition[0],
    jurisdiction: candidate.jurisdiction,
    authority: candidate.authority,
    officialUrl: candidate.officialUrl,
    regimeScope: disposition[2],
    effectiveOrVersionDate: candidate.effectiveOrVersionDate,
    acquisition: {
      status: acquired.acquisitionStatus,
      httpStatus: acquired.httpStatus,
      finalUrl: acquired.finalUrl,
      mediaType: acquired.mediaType,
      byteSize: acquired.byteSize,
      sha256: acquired.sha256,
      localEvidencePath: acquired.localEvidencePath,
      hashMatch: localHash === acquired.sha256,
    },
    disposition: disposition[1],
    rationale: disposition[3],
    humanReviewRequired: true,
    automaticallyPromoted: false,
  };
});

const coverageRows = [
  ['DE', 'DISTANCE_TOLL', '>3.5 t goods vehicles', ['CS-DE-BFSTRMG', 'CS-DE-TOLL-COLLECT-RATES'], 'COVERED_FOR_OWNER_REVIEW', 'Annual/dynamic tariff refresh remains required'],
  ['DE', 'PASSENGER_AND_SPECIAL_INFRASTRUCTURE', 'Passenger car / van / trailer', ['CS-DE-BFSTRMG'], 'PARTIAL', 'Explicit negative national applicability plus separately governed tunnels/facilities not captured'],
  ['AT', 'VIGNETTE', '<=3.5 t', ['CS-AT-ASFINAG-VIGNETTE-SECTION-2026'], 'COVERED_FOR_OWNER_REVIEW', 'Annual replacement required'],
  ['AT', 'SECTION_TOLL', '<=3.5 t', ['CS-AT-ASFINAG-VIGNETTE-SECTION-2026'], 'COVERED_FOR_OWNER_REVIEW', 'Route-specific rates must remain separate from vignette'],
  ['AT', 'GO_DISTANCE_TOLL', '>3.5 t', ['CS-AT-ASFINAG-GO-TOLL'], 'COVERED_FOR_OWNER_REVIEW', 'Annual tariff and emissions-class refresh required'],
  ['CH', 'VIGNETTE', '<=3.5 t', ['CS-CH-BAZG-ROAD-LEVIES'], 'PARTIAL', 'Exact current vignette artifact and effective period not captured'],
  ['CH', 'HEAVY_VEHICLE_CHARGE', '>3.5 t', ['CS-CH-BAZG-ROAD-LEVIES'], 'PARTIAL', 'Exact current LSVA tariff and calculation artifacts not captured'],
  ['BE', 'KILOMETRE_CHARGE', '>3.5 t goods / N1-BC', ['CS-BE-VIAPASS', 'CS-BE-VIAPASS-RATES-2026'], 'COVERED_FOR_OWNER_REVIEW', 'Regional maps and annual tariff refresh required'],
  ['BE', 'SEPARATE_INFRASTRUCTURE', 'All applicable classes', [], 'MISSING', 'Liefkenshoek and any separately governed facility scope not captured'],
  ['PL', 'ETOLL_DISTANCE_CHARGE', '>3.5 t and buses', ['CS-PL-ETOLL-RATES'], 'COVERED_FOR_OWNER_REVIEW', 'Network and rate changes require effective-date refresh'],
  ['PL', 'CONCESSION_MOTORWAYS', 'Passenger/light and other applicable classes', [], 'MISSING', 'Official operator tariffs for concession motorways not captured'],
  ['CZ', 'EDALNICE_VIGNETTE', '<=3.5 t four-wheel vehicles', ['CS-CZ-EDALNICE-VIGNETTE-2026'], 'COVERED_FOR_OWNER_REVIEW', 'Current price/effective artifact should be isolated from dynamic portal'],
  ['CZ', 'MYTO_DISTANCE_TOLL', '>3.5 t', ['CS-CZ-MYTO-RATES-2026'], 'COVERED_FOR_OWNER_REVIEW', 'Network and annual rate refresh required'],
  ['DK', 'KMTOLL_DISTANCE_CHARGE', '>=12 t freight currently', ['CS-DK-KMTOLL-EETS'], 'PARTIAL', 'Exact current rate artifact missing; future >3.5 t expansion must not apply early'],
  ['DK', 'STOREBAELT_BRIDGE', 'Passenger, van, trailer, truck classes', ['CS-DK-STOREBAELT-RATES-2026'], 'COVERED_FOR_OWNER_REVIEW', 'Annual price refresh required'],
  ['DK', 'ORESUND_BRIDGE', 'Passenger, van, trailer, truck classes', ['CS-DK-SE-ORESUND-RATES-2026'], 'COVERED_FOR_OWNER_REVIEW', 'Cross-border authority and date-specific price refresh required'],
  ['NL', 'TRUCK_CHARGING', 'N2/N3 >3.5 t', ['CS-NL-TRUCK-TOLL'], 'PARTIAL', 'Exact current tariff artifact missing'],
  ['NL', 'A24_ETOL', '<=3.5 t and >3.5 t bands', ['CS-NL-A24-ETOL-2026'], 'COVERED_FOR_OWNER_REVIEW', 'Annual rates and non-stacking rule must remain explicit'],
  ['NL', 'SEPARATE_INFRASTRUCTURE', 'All applicable classes', [], 'MISSING', 'Other separately governed tunnel/facility regimes not assessed'],
  ['FR', 'CONCESSION_FRAMEWORK', 'All motorway vehicle classes', ['CS-FR-MOTORWAY-TOLLS', 'CS-FR-ART-TARIFF-GOVERNANCE'], 'CONTEXT_ONLY', 'Framework does not provide exact current route/class tariffs'],
  ['FR', 'CONCESSION_TARIFFS', 'Route and vehicle class specific', [], 'MISSING', 'Complete concessionaire-specific tariff grids and route mapping not captured'],
  ['LU', 'EUROVIGNETTE', '>=12 t goods vehicles', ['CS-LU-CUSTOMS-EUROVIGNETTE', 'CS-LU-EUROVIGNETTE-TARIFF-20250325'], 'PARTIAL', '2026 currentness and multi-country wording require human verification'],
  ['LU', 'PASSENGER_NEGATIVE_APPLICABILITY', 'Passenger/light vehicles', [], 'MISSING', 'Official evidence for zero/general non-applicability not captured'],
  ['ALL', 'UPDATE_MECHANISM', 'All regimes and classes', [], 'MISSING', 'No approved per-source cadence, invalidation and stale-data runbook'],
].map(([country, regime, vehicleScope, proposedSourceIds, status, residualGap]) => ({ country, regime, vehicleScope, proposedSourceIds, status, residualGap }));

const proposedAdds = reviewedCandidates.filter((item) => item.disposition.startsWith('PROPOSE_ADD_'));
const proposedChangeset = {
  schemaVersion: 'agm-routing-toll-001-proposed-registry-review-changeset.v1',
  generatedAt,
  status: 'PROPOSAL_ONLY_PRODUCT_OWNER_APPROVAL_REQUIRED',
  atomic: true,
  baseline: { sourceCount: 815, sha256: expectedRegistrySha256, routingTollViewCount: 263 },
  expectedAfterApproval: {
    registrySourceCount: 815 + proposedAdds.length,
    routingTollViewSourceCount: 263 + proposedAdds.length,
    additions: proposedAdds.length,
    modifications: 0,
    deletions: 0,
    authoritativeWithScope: proposedAdds.filter((item) => item.disposition.endsWith('AUTHORITATIVE_WITH_SCOPE')).length,
    contextual: proposedAdds.filter((item) => item.disposition.endsWith('CONTEXTUAL')).length,
  },
  additions: proposedAdds.map((item) => ({
    sourceId: item.proposedSourceId,
    proposedClassification: item.disposition.replace('PROPOSE_ADD_', ''),
    jurisdiction: item.jurisdiction,
    authority: item.authority,
    canonicalUri: item.acquisition.finalUrl,
    canonicalArtifact: item.acquisition.localEvidencePath,
    mediaType: item.acquisition.mediaType,
    byteSize: item.acquisition.byteSize,
    sha256: item.acquisition.sha256,
    effectiveOrVersionDate: item.effectiveOrVersionDate,
    domainMemberships: ['routing-toll'],
    gapIds: ['ROUTING-TOLL-001'],
    closesGap: false,
    humanReviewRequired: true,
  })),
  excludedPendingFurtherReview: reviewedCandidates
    .filter((item) => !item.disposition.startsWith('PROPOSE_ADD_'))
    .map((item) => ({ sourceId: item.proposedSourceId, disposition: item.disposition, rationale: item.rationale })),
  registryMutationExecuted: false,
};

const remainingGaps = {
  schemaVersion: 'agm-routing-toll-001-residual-gaps.v1',
  generatedAt,
  gapId: 'ROUTING-TOLL-001',
  gapState: 'OPEN',
  items: [
    { id: 'RT001-RES-001', jurisdiction: 'FR', requirement: 'Complete current concessionaire route/class tariff grids', status: 'OPEN' },
    { id: 'RT001-RES-002', jurisdiction: 'PL', requirement: 'Official passenger/light concession motorway tariffs', status: 'OPEN' },
    { id: 'RT001-RES-003', jurisdiction: 'CH', requirement: 'Exact current LSVA and vignette tariff/effective artifacts', status: 'OPEN' },
    { id: 'RT001-RES-004', jurisdiction: 'LU', requirement: 'Human-verified 2026 applicability and current tariff status', status: 'OPEN' },
    { id: 'RT001-RES-005', jurisdiction: 'BE/NL/DE', requirement: 'Separately governed tunnel/facility coverage or explicit human exclusion', status: 'OPEN' },
    { id: 'RT001-RES-006', jurisdiction: 'DK/NL', requirement: 'Exact current distance-charge tariff artifacts', status: 'OPEN' },
    { id: 'RT001-RES-007', jurisdiction: 'ALL', requirement: 'Per-source freshness, invalidation and stale-data runbook', status: 'OPEN' },
    { id: 'RT001-RES-008', jurisdiction: 'ALL', requirement: 'Human authority/applicability decisions for every proposed source', status: 'OPEN' },
  ],
  recommendation: 'REMAINS_PARTIALLY_READY',
};

const coverage = {
  schemaVersion: 'agm-routing-toll-001-official-authority-coverage.v1',
  generatedAt,
  rows: coverageRows,
  summary: Object.fromEntries(['COVERED_FOR_OWNER_REVIEW', 'PARTIAL', 'CONTEXT_ONLY', 'MISSING'].map((status) => [status, coverageRows.filter((row) => row.status === status).length])),
  gapClosed: false,
};
const dispositionMatrix = {
  schemaVersion: 'agm-routing-toll-001-candidate-disposition.v1',
  generatedAt,
  candidateCount: reviewedCandidates.length,
  capturedArtifacts: reviewedCandidates.filter((item) => item.acquisition.status === 'CAPTURED').length,
  hashMatches: reviewedCandidates.filter((item) => item.acquisition.hashMatch).length,
  dispositions: reviewedCandidates,
};

mkdirSync(path.join(root, evidenceRoot), { recursive: true });
writeJson('OFFICIAL_AUTHORITY_COVERAGE_MATRIX.json', coverage);
writeJson('CANDIDATE_DISPOSITION_MATRIX.json', dispositionMatrix);
writeJson('REMAINING_COUNTRY_REGIME_GAPS.json', remainingGaps);
writeJson('PROPOSED_REGISTRY_REVIEW_CHANGESET.json', proposedChangeset);
writeJson('EXPECTED_ROUTING_TOLL_VIEW_IMPACT.json', {
  schemaVersion: 'agm-routing-toll-001-expected-view-impact.v1',
  generatedAt,
  baseline: { sourceCount: view.sourceCount, sha256: hashFile(viewPath) },
  proposedAfterOwnerApproval: proposedChangeset.expectedAfterApproval.routingTollViewSourceCount,
  addedMemberships: proposedAdds.length,
  canonicalCopiesCreated: 0,
  model: 'ONE_SOURCE_ID_ONE_CANONICAL_AUTHORITY_ONE_VERIFIED_ARTIFACT_MULTIPLE_CONTROLLED_DOMAIN_VIEWS',
  executed: false,
});

const report = `# ROUTING-TOLL-001 — controlled closure review package

Generated: \`${generatedAt}\`
Recommendation: \`REMAINS_PARTIALLY_READY\`
Gap state: \`OPEN\`

## Outcome

- review candidates: \`${reviewedCandidates.length}/20\`;
- official artifacts captured: \`${dispositionMatrix.capturedArtifacts}/20\`;
- captured artifact hashes verified: \`${dispositionMatrix.hashMatches}/20\`;
- proposed Registry additions after separate approval: \`${proposedAdds.length}\`;
- proposed classifications: \`${proposedChangeset.expectedAfterApproval.authoritativeWithScope} AUTHORITATIVE_WITH_SCOPE + ${proposedChangeset.expectedAfterApproval.contextual} CONTEXTUAL\`;
- current Registry/view mutation: \`NONE\`;
- automatic promotion: \`NONE\`.

## Candidate dispositions

| Input candidate | Proposed sourceId | Jurisdiction | Disposition | Scope |
|---|---|---|---|---|
${reviewedCandidates.map((item) => `| ${item.inputProposalId} | ${item.proposedSourceId} | ${item.jurisdiction} | ${item.disposition} | ${item.regimeScope} |`).join('\n')}

## Coverage summary

| Status | Regime rows |
|---|---:|
${Object.entries(coverage.summary).map(([status, count]) => `| ${status} | ${count} |`).join('\n')}

The package preserves Austria vignette/section/GO, Czech eDalnice/myto, Denmark KmToll/bridges, Netherlands A24/truck charging and France framework/concession tariff separation. No source is allowed to cover a sibling regime by inference.

## Why closure is not yet ready

${remainingGaps.items.map((item) => `- \`${item.id}\` — ${item.jurisdiction}: ${item.requirement}.`).join('\n')}

## Proposed Registry review impact

If, and only if, the Product Owner later approves the atomic proposal:

- Central Registry: \`815 → ${proposedChangeset.expectedAfterApproval.registrySourceCount}\`;
- Routing/Toll view: \`263 → ${proposedChangeset.expectedAfterApproval.routingTollViewSourceCount}\`;
- ADD/MODIFY/DELETE: \`${proposedAdds.length}/0/0\`;
- the gap remains OPEN until the residual matrix is resolved and a separate closure decision is issued.

## Protections

- Central Registry SHA-256: \`${hashFile(registryPath)}\`;
- Registry source count: \`${registry.sources.length}\`;
- Routing/Toll view count: \`${view.sourceCount}\`;
- Basic Librarian, LEGAL-003, LEGAL-005, runtime, Production, TURN, application and API: \`NO CHANGE\`;
- commit/push: \`NOT EXECUTED\`.
`;
writeFileSync(path.join(root, evidenceRoot, 'ROUTING_TOLL_001_CLOSURE_REVIEW_REPORT.md'), report, 'utf8');

console.log(JSON.stringify({
  recommendation: remainingGaps.recommendation,
  reviewed: reviewedCandidates.length,
  captured: dispositionMatrix.capturedArtifacts,
  hashMatches: dispositionMatrix.hashMatches,
  coverage: coverage.summary,
  proposedAdds: proposedAdds.length,
  expectedRegistry: proposedChangeset.expectedAfterApproval.registrySourceCount,
  expectedView: proposedChangeset.expectedAfterApproval.routingTollViewSourceCount,
}, null, 2));
