import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outRoot = path.join(root, 'AGM_LIBRARY', 'PHASE3');
const reviewDate = '2026-08-29';
const reviewTimestamp = '2026-08-29T00:00:00+02:00';
const phase2Candidates = readJson('AGM_LIBRARY/PHASE2/CANDIDATES/canonical-source-candidates.json').candidates;
const phase2Queue = readJson('AGM_LIBRARY/PHASE2/HUMAN_REVIEW_QUEUE.json').items;
const centralRegistry = readJson('AGM_LIBRARY/REGISTRY/canonical-sources.json');
const byId = new Map(phase2Candidates.map((source) => [source.sourceId, source]));

const evidence = {
  eur561Oj: 'https://eur-lex.europa.eu/eli/reg/2006/561/oj',
  eur561Consolidated: 'https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:02006R0561-20241231',
  eur165Oj: 'https://eur-lex.europa.eu/eli/reg/2014/165/oj',
  eur165Consolidated: 'https://eur-lex.europa.eu/eli/reg/2014/165',
  eur799Oj: 'https://eur-lex.europa.eu/eli/reg_impl/2016/799/oj',
  eur799Consolidated: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02016R0799-20230821',
  fpersg: 'https://www.gesetze-im-internet.de/fahrpersstg/BJNR002770971.html',
  fpersv: 'https://www.gesetze-im-internet.de/fpersv/BJNR188210005.html',
  stvo: 'https://www.gesetze-im-internet.de/stvo_2013/BJNR036710013.html',
  stvo22: 'https://www.gesetze-im-internet.de/stvo_2013/__22.html',
  stvo30: 'https://www.gesetze-im-internet.de/stvo_2013/__30.html',
  stvzo: 'https://www.gesetze-im-internet.de/stvzo_2012/StVZO.pdf',
  hgb412: 'https://www.gesetze-im-internet.de/hgb/__412.html',
  vdi: 'https://www.vdi.de/mitgliedschaft/vdi-richtlinien/details/vdi-handbuch-ladungssicherung',
  vdi81: 'https://www.vdi.de/en/home/vdi-standards/details/vdi-2700-blatt-81-ladungssicherung-auf-strassenfahrzeugen-sicherung-von-pkw-und-leichten-nutzfahrzeugen-auf-fahrzeugtransportern',
  adr: 'https://unece.org/info/Transport/pub/395786',
  ggvseb: 'https://www.gesetze-im-internet.de/ggvseb/GGVSEB.pdf',
  tollCollect: 'https://www.toll-collect.de/en/toll_collect/rund_um_die_maut/3_5_tonnen_maut/p1745_3_5_tonnen_maut.html',
  tollRates: 'https://www.toll-collect.de/en/toll_collect/bezahlen/maut_tarife/p1745_mauttarife_07_2024.html',
  asfinag: 'https://bmp.asfinag.at/en/go-toll/?lng=en',
  bazg: 'https://www.bazg.admin.ch/en/hvc-lsva-overview',
  viapass: 'https://www.viapass.be/en/',
  etoll: 'https://etoll.gov.pl/en/e-toll-system/rates-and-payments/',
  cz: 'https://myto.gov.cz/cs/emytne/sazby-mytneho-2026',
  dk: 'https://vejafgifter.dk/en/customer-service/payment/who-has-to-pay-toll/',
  nl: 'https://www.vrachtwagenheffing.nl/en/you-will-pay-this-amount/find-out-how-much-you-have-to-pay-per-kilometre',
  fr: 'https://www.ecologie.gouv.fr/politiques-publiques/peages-autoroutes-france',
  lu: 'https://guichet.public.lu/fr/entreprises/import-export/transit/transit-ue/e-vignette-poids-lourds.html',
};

const reviews = {
  'TACHO-001': review('tacho', 'AUTHORITATIVE_WITH_SCOPE',
    'Driving times, breaks and rest periods for road carriage within Regulation 561/2006 scope. Goods vehicles generally exceed 3.5 t; from 2026-07-01 the scope also covers international transport/cabotage above 2.5 t. Passenger and AETR boundaries and exemptions remain operation-specific.',
    '2007-04-11; scope extension applicable 2026-07-01',
    'Base act OJ L 102, 11.4.2006; current consolidated reference observed CELEX 02006R0561-20241231',
    'The base act is authentic and in force as amended. The consolidated text is useful for current reading but EUR-Lex explicitly denies it independent legal effect.',
    ['Original OJ act must be read with amendments and corrigenda.', 'AETR applies to specified operations partly outside EU/EEA/Switzerland.', 'Named Transport Compliance Owner has not signed the applicability decision.'],
    [evidence.eur561Oj, evidence.eur561Consolidated]),
  'TACHO-002': review('tacho', 'AUTHORITATIVE_WITH_SCOPE',
    'Construction, installation, use, testing and control of tachographs for vehicles to which Regulation 561/2006 applies, subject to exemptions and transitional provisions.',
    'Generally applicable from 2016-03-02; Articles 24, 34 and 45 from 2015-03-02',
    'Base act OJ L 60, 28.2.2014; consolidated reference 02014R0165-20241231 (003.001)',
    'Regulation 165/2014 is in force, repeals Regulation 3821/85, and is amended by 2020/1054 and 2024/1230 in the current consolidated reference.',
    ['Consolidated text is contextual, not the authentic act.', 'Vehicle retrofit and national exemption applicability must be evaluated per operation.', 'Named Transport Compliance Owner has not signed.'],
    [evidence.eur165Oj, evidence.eur165Consolidated]),
  'TACHO-003': review('tacho', 'AUTHORITATIVE_WITH_SCOPE',
    'Technical requirements for construction, testing, installation, operation and repair of smart tachographs and components under Regulation 165/2014.',
    '2016-06-16; technical consolidation observed at 2023-08-21',
    'OJ L 139, 26.5.2016; consolidated reference CELEX 02016R0799-20230821',
    'Implementing Regulation 2016/799 supplies Annex IC technical rules used by Regulation 165/2014. It is not a substitute for the parent regulation.',
    ['Applicability depends on tachograph generation, vehicle and transition dates.', 'Technical annex size and amendments require specialist review.', 'Named Transport Compliance Owner has not signed.'],
    [evidence.eur799Oj, evidence.eur799Consolidated, evidence.eur165Consolidated]),
  'TACHO-004': review('tacho', 'AUTHORITATIVE_WITH_SCOPE',
    'German implementation, supervision, exemptions, card administration, records and offence rules supplementing EU 561/2006, EU 165/2014, 2016/799 and AETR.',
    null,
    'FPersG last amended 2023-03-02; FPersV last amended 2024-07-15 in the official federal publication',
    'FPersG authorises and structures German implementation/enforcement; FPersV contains operative national implementation and exemptions. Neither replaces directly applicable EU rules.',
    ['No universal effective date applies to the combined framework.', 'Specific national exemptions must be assessed against the exact vehicle/operation.', 'Named Transport Compliance Owner has not signed.'],
    [evidence.fpersg, evidence.fpersv]),
  'TACHO-005': review('tacho', 'CONTEXTUAL',
    'AGM internal change map linking reviewed primary acts, amendments, consolidated references and German implementation.',
    null,
    'AGM-TACHO-MAP-001 v1.0.0-review-candidate',
    'An internal index can improve traceability but cannot create legal authority. Its entries require source-by-source legal review and an assigned owner.',
    ['Transport Compliance Owner remains undesignated.', 'Amendments must be linked as amendments, not incorrectly modelled as supersession.', 'The map remains DRAFT.'],
    [evidence.eur561Oj, evidence.eur165Oj, evidence.eur799Oj, evidence.fpersg, evidence.fpersv, 'AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/TACHO_CHANGE_MAP.v1.md']),

  'ROUTING-TOLL-001': review('routing-toll', 'UNRESOLVED',
    'Country-specific official toll/vignette legislation and operational guidance for DE, AT, CH, FR, BE, NL, LU, PL, CZ and DK, including vehicle scope and effective tariffs.',
    null,
    'Dynamic country source set; multiple 2024–2026 effective dates',
    'Official authorities cover most jurisdictions and prove different vehicle thresholds and tariff factors. France remains concession-specific and the located Luxembourg page is stale.',
    ['No single cross-border source is authoritative for all jurisdictions.', 'Dynamic tariff pages require country-specific freshness checks before every operational use.', 'France tariff grids are distributed across concessionaires.', 'Luxembourg current source remains unresolved.', 'Mobility & Routing Steward has not signed.'],
    [evidence.tollCollect, evidence.tollRates, evidence.asfinag, evidence.bazg, evidence.viapass, evidence.etoll, evidence.cz, evidence.dk, evidence.nl, evidence.fr, evidence.lu]),
  'FIELD-001': review('routing-toll', 'AUTHORITATIVE_WITH_SCOPE',
    'AGM internal controlled field protocol, tester access boundary, telemetry contract and non-conclusive sample thresholds only.',
    null,
    'AGM-CM-FIELD-001 v1.0.0-review-candidate',
    'The runbook accurately consolidates current implementation and preserved evidence, but measured observations are evidence only and never official toll/provider policy.',
    ['Field thresholds do not constitute measured results.', 'The protocol does not authorize Production or external providers.', 'Mobility & Routing Steward has not signed.'],
    ['AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/FIELD_TESTER_CLIENT_RUNBOOK.v1.md', 'evidence/routing-architecture/2026-08-29/FIELD_MEASUREMENT_PROTOCOL.md', 'apps/api/src/car-mover/car-mover-routing-telemetry.service.ts']),
  'CAR-MOVER-001': review('car-mover', 'AUTHORITATIVE_WITH_SCOPE',
    'Internal product architecture and routing policy for the Car Mover component inside AGM Premium.',
    null,
    'AGM-CM-ARCH-001 v1.0.0-review-candidate',
    'The candidate matches the approved boundary and current implementation: Car Mover is a Premium component, PASSENGER_CAR is default, UNKNOWN requires confirmation, and paid providers are inactive.',
    ['It is not a separate product/project.', 'It does not itself change runtime.', 'Product Owner and Architecture Inspector signatures are absent.'],
    ['AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_ARCHITECTURE_SPEC.v1.md', 'AGM_LIBRARY/GOVERNANCE/CAR_MOVER_BOUNDARY_DECISION.md', 'apps/api/src/car-mover/car-mover-routing.policy.ts']),
  'CAR-MOVER-002': review('car-mover', 'AUTHORITATIVE_WITH_SCOPE',
    'Internal Job File aggregate, lifecycle, ownership and evidence-link relationships for Car Mover inside AGM Premium.',
    null,
    'AGM-CM-JOB-001 v1.0.0-review-candidate',
    'The candidate consolidates the implemented lifecycle and Job File read model without transferring authority from referenced evidence or subsidiary records.',
    ['Implementation remains the operative runtime contract until Owner approval.', 'No historical Job File evidence is replaced.', 'Product Owner and Car Mover Steward signatures are absent.'],
    ['AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_JOB_FILE_SPEC.v1.md', 'apps/api/src/car-mover/car-mover.contract.ts', 'apps/api/src/car-mover/car-mover.service.ts']),
  'DOCS-001': review('documents-ocr-evidence', 'AUTHORITATIVE_WITH_SCOPE',
    'Internal provenance and evidence-custody rules for Car Mover source documents, derived OCR output, extracted values and retention decisions.',
    null,
    'AGM-CM-OCR-001 v1.0.0-review-candidate',
    'The candidate correctly separates canonical source documents from implementation, derived OCR data and evidence. OCR output cannot become canonical truth without source-document verification.',
    ['Applicable legal retention periods are intentionally unresolved by document class and jurisdiction.', 'Runtime OCR is unchanged.', 'Evidence Custody, Product Owner and privacy/legal signatures are absent.'],
    ['AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_OCR_EVIDENCE_CONTRACT.v1.md', 'AGM_OCR_ARCHIVE_CONTRACT_V1.md', 'apps/web/src/ocr-translator.ts']),

  'LEGAL-001': review('legislation-safety', 'AUTHORITATIVE_WITH_SCOPE',
    'German road-traffic rules relevant to drivers and road operations; individual provisions must be selected for the concrete operation.',
    'Constitutive recast effective 2013-04-01; later amendments provision-specific',
    'StVO last amended 2026-01-30, BGBl. 2026 I Nr. 32',
    'The BMJ/BfJ official publication is primary national legislation and current at retrieval, but a broad StVO reference is not sufficient to validate every professional-driver rule.',
    ['Provision-level applicability and exceptions remain required.', 'Security & Legal reviewer has not signed.'],
    [evidence.stvo]),
  'LEGAL-002': review('legislation-safety', 'AUTHORITATIVE_WITH_SCOPE',
    'German vehicle construction, approval, inspection and operational-safety requirements within the cited StVZO provisions.',
    'Recast effective 2012-05-05; later amendments provision-specific',
    'StVZO last amended 2024-06-10, BGBl. 2024 I Nr. 191',
    'The official federal text is a primary national legal source. Exact vehicle-category and provision-level applicability still requires review.',
    ['EU type-approval law may also govern a concrete vehicle.', 'Security & Legal reviewer has not signed.'],
    [evidence.stvzo]),
  'LEGAL-003': review('legislation-safety', 'UNRESOLVED',
    'German legal duties for safe loading/securing plus applicable recognized technical rules, especially vehicle transporters.',
    null,
    'StVO last amended 2026-01-30; VDI 2700 family has sheet-specific versions, including 8.1:2024-09 and later corrigendum metadata',
    'StVO §22 and HGB §412 are legal sources. VDI metadata identifies relevant recognized technical standards, but licensed normative content has not been acquired and cannot be reconstructed from summaries.',
    ['VDI normative content is unavailable in the controlled corpus.', 'Metadata/reference may remain contextual only.', 'A secondary summary cannot replace the standard.', 'Security & Legal reviewer has not signed.'],
    [evidence.stvo22, evidence.hgb412, evidence.vdi, evidence.vdi81]),
  'LEGAL-004': review('legislation-safety', 'AUTHORITATIVE_WITH_SCOPE',
    'ADR dangerous-goods rules for contracting parties and German national implementation through GGVSEB.',
    'ADR 2025 amendments applicable 2025-01-01; German incorporation/amendments are provision-specific',
    'ADR 2025 ECE/TRANS/352; GGVSEB last amended 2025-06-19',
    'UNECE ADR 2025 is the official international publication; GGVSEB applies the ADR framework for German domestic and cross-border transport. Classification and exemptions remain consignment-specific.',
    ['Dangerous-goods applicability cannot be inferred from ordinary Car Mover data.', 'Security & Legal reviewer has not signed.'],
    [evidence.adr, evidence.ggvseb]),
  'LEGAL-005': review('legislation-safety', 'UNRESOLVED',
    'Current professional-driver road restrictions across DE, AT, CH, FR, BE, NL, LU, PL, CZ and DK.',
    null,
    'Mixed date-pinned, historical, temporary and missing national sources',
    'The assembled set is not complete or uniformly current. German and selected French rules are identifiable, but missing jurisdictions and stale AT/CH material prevent authoritative coverage.',
    ['BE, NL, LU, PL, CZ and DK restriction-source coverage remains incomplete.', 'AT/CH candidates require current reacquisition.', 'French temporary derogations require date-sensitive handling.', 'Security & Legal reviewer has not signed.'],
    [evidence.stvo30, 'https://ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10011336&Paragraf=42', 'https://www.fedlex.admin.ch/', 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043416004']),
};

const sourceRecommendations = {
  'CS-EU-REG-561-2006': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-EU-REG-561-2006-CONS-20241231': 'CONTEXTUAL',
  'CS-EU-REG-165-2014': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-EU-REG-165-2014-CONS-20241231': 'CONTEXTUAL',
  'CS-EU-IMPL-REG-2016-799': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-EU-IMPL-REG-2016-799-CONS-20230821': 'CONTEXTUAL',
  'CS-DE-FPERSG': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-DE-FPERSV': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-AGM-TACHO-CHANGE-MAP-V1': 'CONTEXTUAL',
  'CS-DE-STVO': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-DE-STVZO': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-DE-HGB-412': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-VDI-2700-HANDBOOK': 'CONTEXTUAL',
  'CS-UNECE-ADR-2025': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-DE-GGVSEB': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-AT-STVO-42-20260213': 'EVIDENCE_ONLY',
  'CS-CH-VRV-20220401': 'EVIDENCE_ONLY',
  'CS-FR-TRUCK-BAN-BASE-2021': 'CONTEXTUAL',
  'CS-FR-TRUCK-BAN-2026': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-DE-TOLL-COLLECT-RATES': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-DE-BFSTRMG': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-AT-ASFINAG-GO-TOLL': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-CH-BAZG-ROAD-LEVIES': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-BE-VIAPASS': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-PL-ETOLL-RATES': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-CZ-MYTO-RATES-2026': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-DK-KMTOLL-EETS': 'CONTEXTUAL',
  'CS-NL-TRUCK-TOLL': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-FR-MOTORWAY-TOLLS': 'CONTEXTUAL',
  'CS-LU-EVIGNETTE-2019': 'EVIDENCE_ONLY',
  'CS-AGM-CM-FIELD-RUNBOOK-V1': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-AGM-CM-ARCH-V1': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-AGM-CM-JOB-V1': 'AUTHORITATIVE_WITH_SCOPE',
  'CS-AGM-CM-OCR-EVIDENCE-V1': 'AUTHORITATIVE_WITH_SCOPE',
};

const legalRelationships = {
  'TACHO-001': [
    { relation: 'REPEALS', target: 'Council Regulation (EEC) No 3820/85' },
    { relation: 'AMENDS', target: 'Council Regulations (EEC) No 3821/85 and (EC) No 2135/98' },
    { relation: 'AMENDED_BY', target: 'Regulation (EU) 2020/1054 and other amendments listed in the official EUR-Lex history' },
  ],
  'TACHO-002': [
    { relation: 'REPEALS', target: 'Council Regulation (EEC) No 3821/85' },
    { relation: 'AMENDS', target: 'Regulation (EC) No 561/2006' },
    { relation: 'AMENDED_BY', target: 'Regulations (EU) 2020/1054 and 2024/1230' },
  ],
  'TACHO-003': [{ relation: 'IMPLEMENTS', target: 'Regulation (EU) No 165/2014' }],
  'TACHO-004': [{ relation: 'NATIONAL_IMPLEMENTATION_AND_ENFORCEMENT', target: 'Regulations (EC) 561/2006, (EU) 165/2014, Implementing Regulation 2016/799 and AETR within German competence' }],
};

const tollSourceAssessments = [
  toll('CS-DE-TOLL-COLLECT-RATES', 'DE', 'Toll Collect / German federal toll system', 'PROVIDER_DOCUMENTATION', 'Goods vehicles intended or used for road haulage with technically permissible maximum laden mass above 3.5 t; towing vehicle threshold governs combinations.', '2024-07-01', 'DYNAMIC_CHECK_BEFORE_EACH_OPERATIONAL_USE', [evidence.tollCollect, evidence.tollRates]),
  toll('CS-DE-BFSTRMG', 'DE', 'German federal legislature / official federal legal publication', 'OFFICIAL_AUTHORITY', 'Legal basis for German federal trunk-road toll; exact exemptions and vehicle classification require provision-level review.', null, 'LEGAL_CURRENTNESS_CHECK_AT_EACH_RELEASE', ['https://www.gesetze-im-internet.de/bfstrmg/BJNR137810011.html']),
  toll('CS-AT-ASFINAG-GO-TOLL', 'AT', 'ASFINAG', 'PROVIDER_DOCUMENTATION', 'Motor vehicles above 3.5 t technically permissible maximum laden mass; route, axle and emission parameters apply.', null, 'DYNAMIC_CHECK_BEFORE_EACH_OPERATIONAL_USE', [evidence.asfinag]),
  toll('CS-CH-BAZG-ROAD-LEVIES', 'CH', 'Swiss Federal Office for Customs and Border Security', 'OFFICIAL_AUTHORITY', 'Motor vehicles and trailers above 3.5 t maximum permissible laden weight used to transport goods; LSVA depends on weight, emissions and kilometres.', null, 'DYNAMIC_CHECK_BEFORE_EACH_OPERATIONAL_USE', [evidence.bazg]),
  toll('CS-BE-VIAPASS', 'BE', 'Viapass / Belgian regions', 'OFFICIAL_AUTHORITY', 'Goods vehicles above 3.5 t and defined N1/BC vehicles; regional tariffs and vehicle/emission classes apply.', '2026-07-01', 'DYNAMIC_CHECK_BEFORE_EACH_OPERATIONAL_USE', [evidence.viapass]),
  toll('CS-PL-ETOLL-RATES', 'PL', 'Polish Ministry of Finance / National Revenue Administration', 'OFFICIAL_AUTHORITY', 'Motor vehicles or combinations above 3.5 t and buses; road class, weight and emissions determine rate.', '2026-02-01', 'DYNAMIC_CHECK_BEFORE_EACH_OPERATIONAL_USE', [evidence.etoll]),
  toll('CS-CZ-MYTO-RATES-2026', 'CZ', 'Czech electronic toll system / Ministry of Transport', 'OFFICIAL_AUTHORITY', 'Vehicles with at least four wheels above 3.5 t and qualifying tractors; road, category, weight, axles, EURO and CO2 classes apply.', '2026-01-01', 'DYNAMIC_CHECK_BEFORE_EACH_OPERATIONAL_USE', [evidence.cz]),
  toll('CS-DK-KMTOLL-EETS', 'DK', 'Sund & Bælt / Danish Road Toll authority', 'PROVIDER_DOCUMENTATION', 'Current 2026 scope: freight trucks at least 12 t. Expansion above 3.5 t is stated as intended from 2027 and is not treated as current.', '2025-01-01', 'DYNAMIC_CHECK_BEFORE_EACH_OPERATIONAL_USE', [evidence.dk]),
  toll('CS-NL-TRUCK-TOLL', 'NL', 'Government of the Netherlands / RDW truck toll', 'OFFICIAL_AUTHORITY', 'N2 and N3 trucks above 3.5 t; mass, EURO and CO2 class determine kilometre rate.', '2026-07-01', 'DYNAMIC_CHECK_BEFORE_EACH_OPERATIONAL_USE; TEMPORARY_DISCOUNT_FROM_2026-09-01', [evidence.nl]),
  toll('CS-FR-MOTORWAY-TOLLS', 'FR', 'French Ministry for Ecological Transition and concession authorities', 'OFFICIAL_AUTHORITY', 'Concession-specific motorway tolls and vehicle classes; no complete national route-to-tariff dataset is captured.', null, 'CONCESSION_GRID_CHECK_REQUIRED_BEFORE_EACH_USE', [evidence.fr]),
  toll('CS-LU-EVIGNETTE-2019', 'LU', 'Grand Duchy of Luxembourg / Guichet.lu', 'OFFICIAL_AUTHORITY', 'UNKNOWN: located page is stale and cannot establish current vehicle or country scope.', null, 'STALE_REACQUISITION_REQUIRED', [evidence.lu]),
];

const decisions = phase2Queue.map((item) => {
  const details = reviews[item.gapId];
  if (!details) throw new Error(`REVIEW_DETAILS_MISSING:${item.gapId}`);
  const sources = item.sourceIds.map((sourceId) => mustSource(sourceId));
  return {
    reviewId: item.reviewId,
    gapId: item.gapId,
    candidateSourceIds: item.sourceIds,
    domain: details.domain,
    issuingAuthorities: [...new Set(sources.map((source) => source.issuingAuthority))],
    jurisdictions: [...new Set(sources.flatMap((source) => source.jurisdictions))],
    applicabilityScope: details.applicabilityScope,
    effectiveDate: details.effectiveDate,
    versionRevision: details.versionRevision,
    supersedes: [],
    supersededBy: [],
    legalRelationships: legalRelationships[item.gapId] ?? [],
    authorityRationale: details.authorityRationale,
    provenanceEvidence: details.evidenceReferences,
    reviewOwner: item.owner,
    reviewTimestamp,
    humanDecision: 'PENDING_NAMED_OWNER_SIGNATURE',
    verdict: 'UNRESOLVED',
    technicalRecommendation: details.technicalRecommendation,
    sourceAssessments: item.sourceIds.map((sourceId) => ({
      sourceId,
      recommendedClassification: sourceRecommendations[sourceId],
      humanApproved: false,
      currentStatus: 'UNKNOWN_PENDING_HUMAN_DECISION',
    })),
    conditionsLimitations: [...details.conditionsLimitations, ...item.blockingIssues],
    evidenceReferences: details.evidenceReferences,
  };
});

const humanAuthorityDecisions = {
  schemaVersion: 'agm-phase3-human-authority-decisions.v1',
  phase: 'PHASE_3_HUMAN_AUTHORITY_REVIEW_AND_CONTROLLED_CANONICAL_PROMOTION',
  generatedAt: reviewTimestamp,
  rule: 'Technical recommendation is not a human authority decision.',
  allowedVerdicts: ['AUTHORITATIVE_CURRENT', 'AUTHORITATIVE_WITH_SCOPE', 'CONTEXTUAL', 'EVIDENCE_ONLY', 'SUPERSEDED', 'REJECTED', 'UNRESOLVED'],
  decisionCount: decisions.length,
  completedHumanDecisions: 0,
  pendingHumanDecisions: decisions.length,
  decisions,
};

const currentSupersededMatrix = {
  schemaVersion: 'agm-phase3-current-superseded-matrix.v1',
  rule: 'No currentness or supersession status is applied without named human approval.',
  sources: phase2Candidates.map((source) => ({
    sourceId: source.sourceId,
    observedVersion: source.version,
    observedEffectiveDate: source.effectiveDate,
    proposedClassification: sourceRecommendations[source.sourceId],
    finalCurrentStatus: 'UNKNOWN_PENDING_HUMAN_DECISION',
    finalSupersededStatus: 'UNKNOWN_PENDING_HUMAN_DECISION',
    supersedes: [],
    supersededBy: [],
    automaticPromotion: false,
  })),
};

const jurisdictionApplicabilityMatrix = {
  schemaVersion: 'agm-phase3-jurisdiction-applicability-matrix.v1',
  authorityLayers: [
    { layer: 'OFFICIAL_AUTHORITY', rule: 'Law or competent public authority publication; scope limited to issuing jurisdiction.' },
    { layer: 'PROVIDER_DOCUMENTATION', rule: 'Operational/tariff documentation within provider or toll-charger scope; not a substitute for law.' },
    { layer: 'AGM_INTERNAL_POLICY', rule: 'Owner-controlled internal behavior; cannot create external legal truth.' },
    { layer: 'FIELD_EVIDENCE', rule: 'Measured observations only; cannot become official rules automatically.' },
    { layer: 'HUMAN_CONFIRMATION_RULE', rule: 'AGM safety gate for UNKNOWN; confirmation does not make unknown external data official.' },
  ],
  reviews: decisions.map((decision) => ({
    reviewId: decision.reviewId,
    gapId: decision.gapId,
    domain: decision.domain,
    jurisdictions: decision.jurisdictions,
    applicabilityScope: decision.applicabilityScope,
    effectiveDate: decision.effectiveDate,
    humanApplicabilityDecision: 'PENDING',
    verdict: decision.verdict,
  })),
  tollSources: tollSourceAssessments,
};

const updatedQueue = {
  schemaVersion: 'agm-phase3-human-review-queue.v2',
  automaticPromotionForbidden: true,
  queueCount: phase2Queue.length,
  technicalReviewComplete: phase2Queue.length,
  humanReviewComplete: 0,
  items: phase2Queue.map((item) => {
    const decision = decisions.find((row) => row.reviewId === item.reviewId);
    return {
      ...item,
      state: 'AWAITING_NAMED_OWNER_DECISION',
      technicalReviewComplete: true,
      humanDecisionComplete: false,
      phase3Verdict: 'UNRESOLVED',
      technicalRecommendation: decision.technicalRecommendation,
      decisionRef: `HUMAN_AUTHORITY_DECISIONS.json#${item.reviewId}`,
    };
  }),
};

const unresolvedAuthorityGaps = {
  schemaVersion: 'agm-phase3-unresolved-authority-gaps.v1',
  gapCount: decisions.length,
  commonBlocker: 'NAMED_HUMAN_REVIEW_OWNER_DECISION_NOT_RECORDED',
  gaps: decisions.map((decision) => ({
    reviewId: decision.reviewId,
    gapId: decision.gapId,
    domain: decision.domain,
    owner: decision.reviewOwner,
    verdict: decision.verdict,
    blockers: ['Named human decision/signature absent.', ...decision.conditionsLimitations],
  })),
};

const proposedOperations = phase2Candidates.map((source) => ({
  operationId: `ADD-${source.sourceId}`,
  action: 'ADD_CANONICAL_SOURCE_CONDITIONAL',
  sourceId: source.sourceId,
  sourceIdContinuity: 'PRESERVE_PHASE2_SOURCE_ID',
  canonicalLocation: source.canonicalLocation,
  proposedAuthorityClassification: sourceRecommendations[source.sourceId],
  proposedDocumentStatusIfApproved: statusFor(sourceRecommendations[source.sourceId]),
  preconditions: [
    'NAMED_HUMAN_OWNER_APPROVAL_RECORDED',
    'CURRENTNESS_AND_APPLICABILITY_CONFIRMED',
    'INTEGRITY_AND_METADATA_REVALIDATED_AT_APPLY_TIME',
    'CENTRAL_REGISTRY_ATOMIC_VALIDATOR_PASS',
  ],
  applied: false,
}));

const proposedChangeset = {
  schemaVersion: 'agm-phase3-proposed-canonical-promotion-changeset.v1',
  changesetId: 'AGM-CANONICAL-PROMOTION-PHASE3-001',
  status: 'PROPOSED_NOT_APPLIED',
  applyAuthority: 'NOT_GRANTED_BY_CURRENT_MANDATE',
  atomicApplyRequired: true,
  centralRegistryPath: 'AGM_LIBRARY/REGISTRY/canonical-sources.json',
  centralRegistryBeforeSha256: sha('AGM_LIBRARY/REGISTRY/canonical-sources.json'),
  sourceIdContinuityVerified: true,
  duplicateSourceIdCount: 0,
  operationCount: proposedOperations.length,
  operations: proposedOperations,
};

const beforeAfterDiff = {
  schemaVersion: 'agm-phase3-registry-before-after-diff.v1',
  changesetId: proposedChangeset.changesetId,
  status: 'SIMULATION_ONLY_NOT_APPLIED',
  before: {
    sourceCount: centralRegistry.sourceCount,
    sha256: proposedChangeset.centralRegistryBeforeSha256,
    authority: centralRegistry.authority,
    sourceOfTruth: centralRegistry.authorityMode,
  },
  afterApplied: {
    sourceCount: centralRegistry.sourceCount,
    sha256: proposedChangeset.centralRegistryBeforeSha256,
    changed: false,
  },
  conditionalAfterIfEveryOperationIsHumanApproved: {
    sourceCount: centralRegistry.sourceCount + proposedOperations.length,
    additions: proposedOperations.length,
    removals: 0,
    updates: 0,
    sha256: null,
    note: 'A real after hash can exist only after separately authorized atomic application.',
  },
  domainViews: {
    modeBefore: 'REFERENCE_ONLY',
    modeAfterApplied: 'REFERENCE_ONLY_UNCHANGED',
    proposedFutureRequirement: 'REFERENCE_ONLY',
  },
};

const domainReadiness = {
  schemaVersion: 'agm-phase3-domain-readiness.v1',
  assessmentDate: reviewDate,
  domains: [
    domain('TACHO', 'PARTIALLY READY', 'Primary sources and technical recommendations are strong, but Transport Compliance Owner is undesignated and no human applicability decisions are signed.'),
    domain('ROUTING / TOLL / FIELD', 'PARTIALLY READY', 'Official operational sources exist for most jurisdictions; France/Luxembourg remain incomplete and Mobility & Routing Steward approval is absent.'),
    domain('CAR MOVER CANONICAL SPECIFICATIONS', 'PARTIALLY READY', 'The internal candidates match implementation and approved Premium boundary, but Product Owner/Inspector signatures are absent.'),
    domain('DOCUMENTS / OCR / EVIDENCE', 'PARTIALLY READY', 'The canonical/derived/evidence separation is sound; retention applicability and named multi-owner approval remain open.'),
    domain('LEGISLATION / SAFETY', 'NOT READY', 'Multi-jurisdiction restrictions and licensed VDI normative content remain incomplete; no Security & Legal decisions are signed.'),
  ],
};

writeJson('HUMAN_AUTHORITY_DECISIONS.json', humanAuthorityDecisions);
writeJson('CURRENT_SUPERSEDED_MATRIX.json', currentSupersededMatrix);
writeJson('JURISDICTION_APPLICABILITY_MATRIX.json', jurisdictionApplicabilityMatrix);
writeJson('UNRESOLVED_AUTHORITY_GAPS.json', unresolvedAuthorityGaps);
writeJson('PROPOSED_CANONICAL_PROMOTION_CHANGESET.json', proposedChangeset);
writeJson('REGISTRY_BEFORE_AFTER_DIFF.json', beforeAfterDiff);
writeJson('UPDATED_HUMAN_REVIEW_QUEUE.json', updatedQueue);
writeJson('DOMAIN_READINESS_REASSESSMENT.json', domainReadiness);

const report = `# PHASE 3 — Human authority review report

Review date: \`${reviewDate}\`
Technical evidence review: **PASS**
Human authority closure: **FAIL / OPEN**
Final PHASE 3 verdict: **FAIL**

## Why the final verdict is FAIL

All 15 queue elements received an evidence-backed technical recommendation,
but none contains a recorded decision/signature from its named human owner.
Treating this document generation as a human legal or Product Owner decision
would violate the mandate. Consequently, all final queue verdicts remain
\`UNRESOLVED\` and no candidate is promoted.

## Results

- queue elements reviewed technically: ${decisions.length}/${decisions.length};
- named human decisions recorded: 0/${decisions.length};
- candidate sources assessed: ${phase2Candidates.length};
- Central Registry additions applied: 0;
- Central Registry source count: ${centralRegistry.sourceCount};
- proposed conditional additions: ${proposedOperations.length};
- runtime, TURN, Production and Basic Librarian changes: 0.

## Tacho relationship

- Regulation 561/2006 governs driving time, breaks and rest. Its current
  consolidated reference includes the 2026-07-01 international/cabotage scope
  extension above 2.5 t.
- Regulation 165/2014 governs tachograph construction, installation, use,
  testing and control for vehicles in the 561/2006 scope, with exemptions and
  transitions.
- Implementing Regulation 2016/799 supplies detailed smart-tachograph technical
  requirements under 165/2014.
- FPersG and FPersV provide German implementation, administration, exemptions,
  supervision and enforcement; they do not replace directly applicable EU law.
- Authentic Official Journal acts and official German texts are primary.
  Consolidated EUR-Lex texts are contextual documentation aids.

## Authority separation

- OFFICIAL AUTHORITY: legislation or competent public authority publications.
- PROVIDER DOCUMENTATION: operational instructions/tariffs within provider or
  toll-charger scope.
- AGM INTERNAL POLICY: Owner-controlled internal behavior only.
- FIELD EVIDENCE: measured observations, never an external official rule.
- HUMAN CONFIRMATION RULE: AGM safety policy for UNKNOWN, not a toll law.

## Car Mover and OCR

Car Mover remains a functional component inside AGM Premium, not a separate
product/project. Its internal specifications are accurate candidates but await
Owner/Inspector signatures.

The OCR review preserves four distinct layers: canonical source document, OCR
implementation, extracted/derived data, and evidence/retention record. OCR
output cannot become canonical truth without checking the source document.

## Domain readiness

${domainReadiness.domains.map((item) => `- ${item.domain} = ${item.verdict} — ${item.rationale}`).join('\n')}

## Registry boundary

The proposed changeset is conditional and unapplied. The actual before and
after registry hash is identical. A later apply requires a separate explicit
mandate after named human decisions, metadata refresh, atomic validation and a
reference-only domain-view check.

## Scope

- RUNTIME CHANGE = NONE
- PRODUCTION CHANGE = NONE
- TURN CHANGE = NONE
- BASIC LIBRARIAN = UNCHANGED
- AUTOMATIC PROMOTION = FORBIDDEN
- CENTRAL REGISTRY MUTATION = NONE
- COMMIT/PUSH = NOT EXECUTED
`;
writeText('AUTHORITY_REVIEW_REPORT.md', report);

const notes = `# Official-source review notes

Review date: \`${reviewDate}\`

This file records the official locations used in the technical review. It does
not reproduce licensed standards and does not constitute a human authority
signature.

## Tacho

- 561/2006 authentic act: ${evidence.eur561Oj}
- 561/2006 current consolidated reference observed: ${evidence.eur561Consolidated}
- 165/2014 authentic act: ${evidence.eur165Oj}
- 165/2014 current consolidated reference observed: ${evidence.eur165Consolidated}
- 2016/799 authentic act: ${evidence.eur799Oj}
- 2016/799 current consolidated reference observed: ${evidence.eur799Consolidated}
- German FPersG: ${evidence.fpersg}
- German FPersV: ${evidence.fpersv}

## Safety and legislation

- StVO: ${evidence.stvo}
- StVO §22: ${evidence.stvo22}
- StVO §30: ${evidence.stvo30}
- StVZO: ${evidence.stvzo}
- HGB §412: ${evidence.hgb412}
- VDI catalogue metadata only: ${evidence.vdi}
- VDI 2700 Blatt 8.1 metadata: ${evidence.vdi81}
- ADR 2025: ${evidence.adr}
- GGVSEB: ${evidence.ggvseb}

## Toll and routing

${[evidence.tollCollect,evidence.tollRates,evidence.asfinag,evidence.bazg,evidence.viapass,evidence.etoll,evidence.cz,evidence.dk,evidence.nl,evidence.fr,evidence.lu].map((uri) => `- ${uri}`).join('\n')}
`;
writeText('OFFICIAL_SOURCE_REVIEW_NOTES.md', notes);

console.log(`PHASE3_QUEUE=${decisions.length}`);
console.log('PHASE3_HUMAN_DECISIONS=0');
console.log(`PHASE3_PROPOSED_OPERATIONS=${proposedOperations.length}`);
console.log('CENTRAL_REGISTRY_MUTATED=NO');
console.log('PHASE3_FINAL_VERDICT=FAIL');

function review(domain, technicalRecommendation, applicabilityScope, effectiveDate, versionRevision, authorityRationale, conditionsLimitations, evidenceReferences) {
  return { domain, technicalRecommendation, applicabilityScope, effectiveDate, versionRevision, authorityRationale, conditionsLimitations, evidenceReferences };
}

function domain(domainName, verdict, rationale) { return { domain: domainName, verdict, rationale }; }
function toll(sourceId, jurisdiction, authorityProvider, authorityClass, vehicleScope, effectiveDate, freshnessPolicy, evidenceReferences) {
  return { sourceId, jurisdiction, authorityProvider, authorityClass, vehicleScope, effectiveDate, freshnessPolicy, evidenceReferences, humanApproved: false, finalStatus: 'UNRESOLVED' };
}

function mustSource(sourceId) {
  const source = byId.get(sourceId);
  if (!source) throw new Error(`SOURCE_NOT_FOUND:${sourceId}`);
  return source;
}

function statusFor(classification) {
  if (classification === 'AUTHORITATIVE_CURRENT' || classification === 'AUTHORITATIVE_WITH_SCOPE') return 'CURRENT';
  if (classification === 'SUPERSEDED') return 'SUPERSEDED';
  return 'EVIDENCE';
}

function readJson(relativePath) { return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')); }
function sha(relativePath) { return createHash('sha256').update(readFileSync(path.join(root, relativePath))).digest('hex'); }
function writeJson(relativePath, value) { writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`); }
function writeText(relativePath, value) { const absolute = path.join(outRoot, relativePath); mkdirSync(path.dirname(absolute), { recursive: true }); writeFileSync(absolute, value, 'utf8'); }
