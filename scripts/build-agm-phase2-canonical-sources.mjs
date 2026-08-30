import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const phase2 = path.join(root, 'AGM_LIBRARY', 'PHASE2');
const retrievalDate = '2026-08-29';
const externalIntegrity = { sha256: null, status: 'NOT_CAPTURED_DYNAMIC_OR_REMOTE_OFFICIAL_SOURCE' };

const candidates = [
  ext('CS-EU-REG-561-2006', 'Regulation (EC) No 561/2006 — authentic legal act', 'European Parliament and Council of the European Union', 'OFFICIAL_PRIMARY_LEGISLATION', ['EU', 'EEA'], 'https://eur-lex.europa.eu/eli/reg/2006/561/oj', '2006-03-15', '2007-04-11', 'OJ L 102, 11.4.2006', ['tacho'], ['TACHO-001', 'TACHO-005'], 'Transport Compliance Owner (designation required)', 'PRIMARY_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED', {
    notes: 'The Official Journal act is the legal authority. Applicability and amendment history require human review.',
  }),
  ext('CS-EU-REG-561-2006-CONS-20241231', 'Regulation (EC) No 561/2006 — consolidated text at 2024-12-31', 'Publications Office of the European Union / EUR-Lex', 'OFFICIAL_CONSOLIDATED_REFERENCE', ['EU', 'EEA'], 'https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:02006R0561-20241231', null, '2024-12-31', 'CELEX 02006R0561-20241231', ['tacho'], ['TACHO-001', 'TACHO-005'], 'Transport Compliance Owner (designation required)', 'DOCUMENTATION_AID_NOT_AUTHENTIC_LEGAL_ACT', {
    notes: 'EUR-Lex states consolidated texts are documentation tools without legal effect; retain the OJ act as authority.',
  }),
  ext('CS-EU-REG-165-2014', 'Regulation (EU) No 165/2014 on tachographs — authentic legal act', 'European Parliament and Council of the European Union', 'OFFICIAL_PRIMARY_LEGISLATION', ['EU', 'EEA'], 'https://eur-lex.europa.eu/eli/reg/2014/165/oj', '2014-02-04', '2014-03-01', 'OJ L 60, 28.2.2014', ['tacho'], ['TACHO-002', 'TACHO-005'], 'Transport Compliance Owner (designation required)', 'PRIMARY_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED'),
  ext('CS-EU-REG-165-2014-CONS-20241231', 'Regulation (EU) No 165/2014 — consolidated text at 2024-12-31', 'Publications Office of the European Union / EUR-Lex', 'OFFICIAL_CONSOLIDATED_REFERENCE', ['EU', 'EEA'], 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02014R0165-20241231', null, '2024-12-31', 'CELEX 02014R0165-20241231', ['tacho'], ['TACHO-002', 'TACHO-005'], 'Transport Compliance Owner (designation required)', 'DOCUMENTATION_AID_NOT_AUTHENTIC_LEGAL_ACT'),
  ext('CS-EU-IMPL-REG-2016-799', 'Commission Implementing Regulation (EU) 2016/799 — authentic legal act', 'European Commission', 'OFFICIAL_PRIMARY_IMPLEMENTING_LEGISLATION', ['EU', 'EEA'], 'https://eur-lex.europa.eu/eli/reg_impl/2016/799/oj', '2016-03-18', '2016-06-16', 'OJ L 139, 26.5.2016', ['tacho'], ['TACHO-003', 'TACHO-005'], 'Transport Compliance Owner (designation required)', 'PRIMARY_CANDIDATE_HUMAN_TECHNICAL_LEGAL_REVIEW_REQUIRED'),
  ext('CS-EU-IMPL-REG-2016-799-CONS-20230821', 'Commission Implementing Regulation (EU) 2016/799 — consolidated text at 2023-08-21', 'Publications Office of the European Union / EUR-Lex', 'OFFICIAL_CONSOLIDATED_REFERENCE', ['EU', 'EEA'], 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02016R0799-20230821', null, '2023-08-21', 'CELEX 02016R0799-20230821', ['tacho'], ['TACHO-003', 'TACHO-005'], 'Transport Compliance Owner (designation required)', 'DOCUMENTATION_AID_NOT_AUTHENTIC_LEGAL_ACT'),
  ext('CS-DE-FPERSG', 'Fahrpersonalgesetz (FPersG)', 'German Federal Ministry of Justice / Federal Office of Justice', 'OFFICIAL_NATIONAL_LEGISLATION', ['DE'], 'https://www.gesetze-im-internet.de/fahrpersstg/BJNR002770971.html', '1971-03-30', null, 'Last amended 2023-03-02, BGBl. 2023 I Nr. 56', ['tacho'], ['TACHO-004', 'TACHO-005'], 'Transport Compliance Owner (designation required)', 'PRIMARY_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED'),
  ext('CS-DE-FPERSV', 'Fahrpersonalverordnung (FPersV)', 'German Federal Ministry of Justice / Federal Office of Justice', 'OFFICIAL_NATIONAL_LEGISLATION', ['DE'], 'https://www.gesetze-im-internet.de/fpersv/BJNR188210005.html', '2005-06-27', null, 'Last amended 2024-07-15, BGBl. 2024 I Nr. 236', ['tacho'], ['TACHO-004', 'TACHO-005'], 'Transport Compliance Owner (designation required)', 'PRIMARY_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED'),

  ext('CS-DE-STVO', 'Straßenverkehrs-Ordnung (StVO)', 'German Federal Ministry of Justice / Federal Office of Justice', 'OFFICIAL_NATIONAL_LEGISLATION', ['DE'], 'https://www.gesetze-im-internet.de/stvo_2013/BJNR036710013.html', '2013-03-06', null, 'Last amended 2026-01-30, BGBl. 2026 I Nr. 32', ['legislation-safety'], ['LEGAL-001', 'LEGAL-003', 'LEGAL-005'], 'Security & Legal / Human Reviewer', 'PRIMARY_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED'),
  ext('CS-DE-STVZO', 'Straßenverkehrs-Zulassungs-Ordnung (StVZO)', 'German Federal Ministry of Justice / Federal Office of Justice', 'OFFICIAL_NATIONAL_LEGISLATION', ['DE'], 'https://www.gesetze-im-internet.de/stvzo_2012/StVZO.pdf', '2012-04-26', null, 'Last amended 2024-06-10, BGBl. 2024 I Nr. 191', ['legislation-safety'], ['LEGAL-002'], 'Security & Legal / Human Reviewer', 'PRIMARY_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED'),
  ext('CS-DE-HGB-412', 'Handelsgesetzbuch § 412 — Verladen und Entladen', 'German Federal Ministry of Justice / Federal Office of Justice', 'OFFICIAL_NATIONAL_LEGISLATION', ['DE'], 'https://www.gesetze-im-internet.de/hgb/__412.html', null, null, 'Currentness to be confirmed at human review', ['legislation-safety'], ['LEGAL-003'], 'Security & Legal / Human Reviewer', 'PRIMARY_CANDIDATE_CURRENTNESS_NOT_YET_DETERMINED'),
  ext('CS-VDI-2700-HANDBOOK', 'VDI 2700 load securing handbook and standard family metadata', 'VDI e.V.', 'OFFICIAL_STANDARDS_OWNER_METADATA_LICENSED_TECHNICAL_STANDARD', ['DE'], 'https://www.vdi.de/mitgliedschaft/vdi-richtlinien/details/vdi-handbuch-ladungssicherung', null, null, 'Live VDI catalogue; individual sheet versions vary', ['legislation-safety'], ['LEGAL-003'], 'Security & Legal / Human Reviewer', 'CONTEXTUAL_LICENSED_STANDARD_CONTENT_NOT_ACQUIRED', {
    notes: 'Private technical standard family, not legislation. Catalogue metadata is official; normative text remains licensed and requires controlled acquisition.',
  }),
  ext('CS-UNECE-ADR-2025', 'ADR 2025 — Agreement concerning the International Carriage of Dangerous Goods by Road', 'United Nations Economic Commission for Europe', 'OFFICIAL_PRIMARY_INTERNATIONAL_LEGAL_PUBLICATION', ['ADR_CONTRACTING_PARTIES'], 'https://unece.org/info/Transport/pub/395786', '2024-10-01', '2025-01-01', 'ECE/TRANS/352, ADR 2025', ['legislation-safety'], ['LEGAL-004'], 'Security & Legal / Human Reviewer', 'PRIMARY_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED'),
  ext('CS-DE-GGVSEB', 'Gefahrgutverordnung Straße, Eisenbahn und Binnenschifffahrt (GGVSEB)', 'German Federal Ministry of Justice / Federal Office of Justice', 'OFFICIAL_NATIONAL_LEGISLATION', ['DE'], 'https://www.gesetze-im-internet.de/ggvseb/GGVSEB.pdf', '2023-08-18', null, 'Last amended 2025-06-19, BGBl. 2025 I Nr. 147', ['legislation-safety'], ['LEGAL-004'], 'Security & Legal / Human Reviewer', 'PRIMARY_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED'),
  ext('CS-AT-STVO-42-20260213', 'Austria StVO 1960 § 42 — Fahrverbot für Lastkraftfahrzeuge (date-pinned official text)', 'Republic of Austria / RIS', 'OFFICIAL_NATIONAL_LEGISLATION_DATE_PINNED', ['AT'], 'https://ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Anlage=&Artikel=&FassungVom=2026-02-13&Gesetzesnummer=10011336&Paragraf=42&ShowPrintPreview=True&Uebergangsrecht=', null, '2026-02-13', 'Date-pinned RIS rendering', ['legislation-safety'], ['LEGAL-005'], 'Security & Legal / Human Reviewer', 'OFFICIAL_BUT_NOT_CURRENT_AT_RETRIEVAL_REACQUISITION_REQUIRED'),
  ext('CS-CH-VRV-20220401', 'Switzerland Verkehrsregelnverordnung (VRV) — official 2022 PDF candidate', 'Swiss Confederation / Fedlex', 'OFFICIAL_NATIONAL_LEGISLATION_STALE_SNAPSHOT', ['CH'], 'https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1962/1364_1409_1420/20220401/de/pdf-a/fedlex-data-admin-ch-eli-cc-1962-1364_1409_1420-20220401-de-pdf-a.pdf', null, '2022-04-01', 'Official historical snapshot', ['legislation-safety'], ['LEGAL-005'], 'Security & Legal / Human Reviewer', 'STALE_OFFICIAL_CANDIDATE_REACQUISITION_REQUIRED'),
  ext('CS-FR-TRUCK-BAN-BASE-2021', 'France — arrêté du 16 avril 2021 relatif à l’interdiction de circulation des véhicules de transport de marchandises', 'French Republic / Légifrance', 'OFFICIAL_NATIONAL_LEGISLATION', ['FR'], 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043416004', '2021-04-16', null, 'JORFTEXT000043416004', ['legislation-safety'], ['LEGAL-005'], 'Security & Legal / Human Reviewer', 'PRIMARY_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED'),
  ext('CS-FR-TRUCK-BAN-2026', 'France — supplemental truck circulation restrictions for 2026', 'French Republic / Légifrance', 'OFFICIAL_NATIONAL_LEGISLATION', ['FR'], 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053324056', null, null, 'JORFTEXT000053324056', ['legislation-safety'], ['LEGAL-005'], 'Security & Legal / Human Reviewer', 'PRIMARY_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED'),
  ext('CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026', 'France — temporary fire-related derogation from truck restrictions', 'French Republic / Légifrance', 'OFFICIAL_TEMPORARY_NATIONAL_LEGISLATION', ['FR'], 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000054633358', null, null, 'Temporary measure observed valid through 2026-08-31; human verification required', ['legislation-safety'], ['LEGAL-005'], 'Security & Legal / Human Reviewer', 'TEMPORARY_PRIMARY_CANDIDATE_HUMAN_REVIEW_REQUIRED'),

  ext('CS-DE-TOLL-COLLECT-RATES', 'Germany truck toll tariffs and official operator guidance', 'Toll Collect GmbH / Federal toll system', 'OFFICIAL_TOLL_AUTHORITY_GUIDANCE', ['DE'], 'https://www.toll-collect.de/en/toll_collect/bezahlen/maut_tarife/p1745_mauttarife_07_2024.html', null, '2024-07-01', 'Live official tariff page', ['routing-toll'], ['ROUTING-TOLL-001'], 'Mobility & Routing Steward', 'OFFICIAL_CANDIDATE_OPERATIONAL_REVIEW_REQUIRED'),
  ext('CS-DE-BFSTRMG', 'Bundesfernstraßenmautgesetz (BFStrMG)', 'German Federal Ministry of Justice / Federal Office of Justice', 'OFFICIAL_NATIONAL_LEGISLATION', ['DE'], 'https://www.gesetze-im-internet.de/bfstrmg/BJNR137810011.html', null, null, 'Last amended 2026-05-15', ['routing-toll', 'legislation-safety'], ['ROUTING-TOLL-001'], 'Mobility & Routing Steward', 'PRIMARY_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED'),
  ext('CS-AT-ASFINAG-GO-TOLL', 'Austria GO toll official guidance', 'ASFINAG', 'OFFICIAL_TOLL_AUTHORITY_GUIDANCE', ['AT'], 'https://bmp.asfinag.at/en/go-toll/?lng=en', null, null, 'Live official guidance', ['routing-toll'], ['ROUTING-TOLL-001'], 'Mobility & Routing Steward', 'OFFICIAL_CANDIDATE_OPERATIONAL_REVIEW_REQUIRED'),
  ext('CS-CH-BAZG-ROAD-LEVIES', 'Switzerland transport levies and road traffic law', 'Swiss Federal Office for Customs and Border Security (FOCBS/BAZG)', 'OFFICIAL_TOLL_AUTHORITY_GUIDANCE', ['CH'], 'https://www.bazg.admin.ch/en/transport-levies-and-road-traffic-law', null, null, 'Live official guidance', ['routing-toll'], ['ROUTING-TOLL-001'], 'Mobility & Routing Steward', 'OFFICIAL_CANDIDATE_OPERATIONAL_REVIEW_REQUIRED'),
  ext('CS-BE-VIAPASS', 'Belgium kilometre charge official authority portal', 'Viapass', 'OFFICIAL_TOLL_AUTHORITY_GUIDANCE', ['BE'], 'https://www.viapass.be/en/', null, null, 'Live official guidance', ['routing-toll'], ['ROUTING-TOLL-001'], 'Mobility & Routing Steward', 'OFFICIAL_CANDIDATE_OPERATIONAL_REVIEW_REQUIRED'),
  ext('CS-PL-ETOLL-RATES', 'Poland e-TOLL rates and payments', 'Polish Ministry of Finance / National Revenue Administration', 'OFFICIAL_TOLL_AUTHORITY_GUIDANCE', ['PL'], 'https://etoll.gov.pl/en/e-toll-system/rates-and-payments/', null, '2026-02-01', 'Rates effective 2026-02-01', ['routing-toll'], ['ROUTING-TOLL-001'], 'Mobility & Routing Steward', 'OFFICIAL_CANDIDATE_OPERATIONAL_REVIEW_REQUIRED'),
  ext('CS-CZ-MYTO-RATES-2026', 'Czech electronic toll rates 2026', 'Czech electronic toll system / Ministry of Transport', 'OFFICIAL_TOLL_AUTHORITY_GUIDANCE', ['CZ'], 'https://myto.gov.cz/cs/emytne/sazby-mytneho-2026', null, '2026-01-01', '2026 rates', ['routing-toll'], ['ROUTING-TOLL-001'], 'Mobility & Routing Steward', 'OFFICIAL_CANDIDATE_OPERATIONAL_REVIEW_REQUIRED'),
  ext('CS-DK-KMTOLL-EETS', 'Denmark kilometre toll and EETS official information', 'Danish Road Toll authority', 'OFFICIAL_TOLL_AUTHORITY_GUIDANCE', ['DK'], 'https://vejafgifter.dk/european-electronic-toll-service-eets/', null, null, 'Live official guidance', ['routing-toll'], ['ROUTING-TOLL-001'], 'Mobility & Routing Steward', 'OFFICIAL_CANDIDATE_OPERATIONAL_REVIEW_REQUIRED'),
  ext('CS-NL-TRUCK-TOLL', 'Netherlands truck toll official portal', 'Government of the Netherlands', 'OFFICIAL_TOLL_AUTHORITY_GUIDANCE', ['NL'], 'https://www.vrachtwagenheffing.nl/en', null, '2026-07-01', 'Truck toll effective 2026-07-01', ['routing-toll'], ['ROUTING-TOLL-001'], 'Mobility & Routing Steward', 'OFFICIAL_CANDIDATE_OPERATIONAL_REVIEW_REQUIRED'),
  ext('CS-FR-MOTORWAY-TOLLS', 'France motorway toll system official overview', 'French Ministry for Ecological Transition', 'OFFICIAL_GOVERNMENT_GUIDANCE', ['FR'], 'https://www.ecologie.gouv.fr/politiques-publiques/peages-autoroutes-france', null, null, 'Live official overview; concession-specific tariffs remain distributed', ['routing-toll'], ['ROUTING-TOLL-001'], 'Mobility & Routing Steward', 'OFFICIAL_PARTIAL_SOURCE_CONCESSION_TARIFF_SET_REQUIRED'),
  ext('CS-LU-EVIGNETTE-2019', 'Luxembourg heavy-goods e-vignette guidance — stale official page', 'Grand Duchy of Luxembourg / Guichet.lu', 'OFFICIAL_GOVERNMENT_GUIDANCE_STALE', ['LU'], 'https://guichet.public.lu/fr/entreprises/import-export/transit/transit-ue/e-vignette-poids-lourds.html', null, null, 'Page last modified 2019', ['routing-toll'], ['ROUTING-TOLL-001'], 'Mobility & Routing Steward', 'STALE_OFFICIAL_CANDIDATE_REACQUISITION_REQUIRED'),

  internal('CS-AGM-TACHO-CHANGE-MAP-V1', 'Tacho primary-source change map', 'AGM Transport Compliance', ['EU', 'DE'], 'AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/TACHO_CHANGE_MAP.v1.md', ['tacho'], ['TACHO-005'], 'Transport Compliance Owner (designation required)', 'INTERNAL_INDEX_CANDIDATE_HUMAN_LEGAL_REVIEW_REQUIRED'),
  internal('CS-AGM-CM-ARCH-V1', 'Car Mover canonical architecture specification', 'AGM Product Owner / Architecture Inspector', ['AGM_INTERNAL'], 'AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_ARCHITECTURE_SPEC.v1.md', ['car-mover', 'routing-toll'], ['CAR-MOVER-001'], 'AGM Product Owner / Car Mover Steward', 'INTERNAL_CANONICAL_CANDIDATE_OWNER_REVIEW_REQUIRED'),
  internal('CS-AGM-CM-JOB-V1', 'Car Mover Job File specification', 'AGM Product Owner / Car Mover Steward', ['AGM_INTERNAL'], 'AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_JOB_FILE_SPEC.v1.md', ['car-mover', 'documents-ocr-evidence'], ['CAR-MOVER-002'], 'AGM Product Owner / Car Mover Steward', 'INTERNAL_CANONICAL_CANDIDATE_OWNER_REVIEW_REQUIRED'),
  internal('CS-AGM-CM-FIELD-RUNBOOK-V1', 'Controlled field tester client runbook', 'AGM Field Validation Owner', ['AGM_INTERNAL'], 'AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/FIELD_TESTER_CLIENT_RUNBOOK.v1.md', ['routing-toll', 'car-mover'], ['FIELD-001'], 'Mobility & Routing Steward', 'INTERNAL_CANONICAL_CANDIDATE_OWNER_REVIEW_REQUIRED'),
  internal('CS-AGM-CM-OCR-EVIDENCE-V1', 'Car Mover OCR, document and evidence contract', 'AGM Product Owner / Inspector / Evidence Custody', ['AGM_INTERNAL'], 'AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_OCR_EVIDENCE_CONTRACT.v1.md', ['documents-ocr-evidence', 'car-mover'], ['DOCS-001'], 'Inspector / Evidence Custody', 'INTERNAL_CANONICAL_CANDIDATE_MULTI_OWNER_REVIEW_REQUIRED'),
];

const gapDecisions = [
  gap('TACHO-001', 'ACQUIRED_REVIEW_REQUIRED', ids('TACHO-001'), []),
  gap('TACHO-002', 'ACQUIRED_REVIEW_REQUIRED', ids('TACHO-002'), []),
  gap('TACHO-003', 'ACQUIRED_REVIEW_REQUIRED', ids('TACHO-003'), []),
  gap('TACHO-004', 'ACQUIRED_REVIEW_REQUIRED', ids('TACHO-004'), []),
  gap('TACHO-005', 'CONSOLIDATED_INTERNAL_CANDIDATE_REVIEW_REQUIRED', ids('TACHO-005'), ['Human amendment/applicability review and owner designation remain open.']),
  gap('LEGAL-001', 'ACQUIRED_REVIEW_REQUIRED', ids('LEGAL-001'), []),
  gap('LEGAL-002', 'ACQUIRED_REVIEW_REQUIRED', ids('LEGAL-002'), []),
  gap('LEGAL-003', 'PARTIAL_UNRESOLVED', ids('LEGAL-003'), ['Licensed normative VDI text was not acquired; official catalogue metadata cannot replace technical content.']),
  gap('LEGAL-004', 'ACQUIRED_REVIEW_REQUIRED', ids('LEGAL-004'), []),
  gap('LEGAL-005', 'OPEN_UNRESOLVED', ids('LEGAL-005'), ['No complete current official source set was demonstrated for BE, NL, LU, PL, CZ and DK professional-driver restrictions.', 'AT and CH candidates require current reacquisition.', 'Temporary and base French measures require human applicability review.']),
  gap('ROUTING-TOLL-001', 'PARTIAL_UNRESOLVED', ids('ROUTING-TOLL-001'), ['France tariff data is concession-specific and not captured as a complete official set.', 'Luxembourg candidate is stale and must be replaced by a current official source.']),
  gap('FIELD-001', 'CONSOLIDATED_INTERNAL_CANDIDATE_REVIEW_REQUIRED', ids('FIELD-001'), ['Owner approval remains required; measured field evidence remains separate and non-conclusive.']),
  gap('CAR-MOVER-001', 'CONSOLIDATED_INTERNAL_CANDIDATE_REVIEW_REQUIRED', ids('CAR-MOVER-001'), ['Product Owner and Architecture Inspector review remains required.']),
  gap('CAR-MOVER-002', 'CONSOLIDATED_INTERNAL_CANDIDATE_REVIEW_REQUIRED', ids('CAR-MOVER-002'), ['Product Owner and Car Mover Steward review remains required.']),
  gap('DOCS-001', 'CONSOLIDATED_INTERNAL_CANDIDATE_REVIEW_REQUIRED', ids('DOCS-001'), ['Evidence Custody, Product Owner and privacy/legal retention review remain required.']),
];

const domainVerdicts = [
  { domain: 'TACHO', verdict: 'PARTIALLY READY', reason: 'Primary official candidates acquired; human legal/currentness review and owner designation remain mandatory.' },
  { domain: 'LEGISLATION / SAFETY', verdict: 'NOT READY', reason: 'Licensed cargo-securing content and the complete current multi-jurisdiction restriction set remain unresolved.' },
  { domain: 'ROUTING / TOLL / FIELD', verdict: 'PARTIALLY READY', reason: 'Eight national toll authority paths are usable candidates; France is fragmented, Luxembourg is stale, and field evidence is not an official external specification.' },
  { domain: 'CAR MOVER CANONICAL SPECIFICATIONS', verdict: 'PARTIALLY READY', reason: 'Internal specifications were consolidated as review candidates only; Owner/Inspector approval is pending.' },
  { domain: 'DOCUMENTS / OCR / EVIDENCE', verdict: 'PARTIALLY READY', reason: 'A provenance/retention candidate exists; legal retention applicability and multi-owner approval remain open.' },
];

const candidateRegistry = {
  schemaVersion: 'agm-phase2-canonical-source-candidates.v1',
  phase: 'PHASE_2_CANONICAL_SOURCES_ACQUISITION_AND_CONSOLIDATION',
  generatedAt: `${retrievalDate}T00:00:00+02:00`,
  authority: 'CANDIDATE_REGISTRY_ONLY',
  centralRegistryMutated: false,
  automaticAuthorityPromotion: false,
  candidateCount: candidates.length,
  candidates,
};

const decisionMatrix = {
  schemaVersion: 'agm-phase2-candidate-authority-decisions.v1',
  rules: { unknownCannotBecomeCurrent: true, contextualCannotBecomeAuthoritative: true, humanReviewRequired: true },
  decisions: candidates.map((source) => ({
    sourceId: source.sourceId,
    gapIds: source.gapIds,
    authorityLevel: source.authorityLevel,
    candidateStatus: source.documentStatus,
    reviewStatus: source.reviewStatus,
    decision: authorityDecision(source),
    authoritative: false,
    current: false,
    reviewOwner: source.reviewOwner,
  })),
};

const provenanceMatrix = {
  schemaVersion: 'agm-phase2-provenance-matrix.v1',
  sources: candidates.map((source) => ({
    sourceId: source.sourceId,
    provenance: source.provenance,
    canonicalLocation: source.canonicalLocation,
    officialUri: source.officialUri,
    retrievalDate: source.retrievalDate,
    integrity: source.integrity,
    evidenceReferences: source.evidenceReferences,
    originalPreserved: true,
    physicalLibraryCopyCreated: false,
  })),
};

const authorityJurisdictionMatrix = {
  schemaVersion: 'agm-phase2-authority-jurisdiction-matrix.v1',
  sources: candidates.map((source) => ({
    sourceId: source.sourceId,
    issuingAuthority: source.issuingAuthority,
    authorityLevel: source.authorityLevel,
    jurisdictions: source.jurisdictions,
    humanReviewRequired: true,
    reviewOwner: source.reviewOwner,
  })),
};

const currentAssessment = {
  schemaVersion: 'agm-phase2-current-superseded-unknown.v1',
  rule: 'No candidate is promoted automatically. Unknown or unreviewed currentness remains UNKNOWN.',
  assessments: candidates.map((source) => ({
    sourceId: source.sourceId,
    assessment: source.reviewStatus.includes('STALE') || source.reviewStatus.includes('NOT_CURRENT') ? 'SUPERSEDED_OR_STALE_CANDIDATE' : 'UNKNOWN_PENDING_HUMAN_REVIEW',
    current: false,
    superseded: false,
    evidence: source.version ?? null,
  })),
};

const unresolvedGaps = {
  schemaVersion: 'agm-phase2-unresolved-gaps.v1',
  gaps: gapDecisions.filter((item) => item.unresolved.length > 0),
};

const proposedRegistryUpdates = {
  schemaVersion: 'agm-phase2-proposed-registry-updates.v1',
  status: 'PROPOSAL_ONLY_NOT_APPLIED',
  centralRegistry: 'AGM_LIBRARY/REGISTRY/canonical-sources.json',
  centralRegistryMutated: false,
  additionsAfterHumanApprovalOnly: candidates.map((source) => ({ sourceId: source.sourceId, proposedAction: 'ADD_AFTER_REQUIRED_HUMAN_REVIEW', reviewOwner: source.reviewOwner })),
  domainMembershipsAfterRegistryAcceptanceOnly: candidates.flatMap((source) => source.domains.map((domainId) => ({ sourceId: source.sourceId, domainId, role: 'CANDIDATE' }))),
};

const reviewQueue = {
  schemaVersion: 'agm-phase2-human-review-queue.v1',
  automaticPromotionForbidden: true,
  items: gapDecisions.map((item) => ({
    reviewId: `REVIEW-${item.gapId}`,
    gapId: item.gapId,
    sourceIds: item.candidateSourceIds,
    requiredDecision: item.status === 'OPEN_UNRESOLVED' ? 'ACQUIRE_MISSING_PRIMARY_SOURCES_AND_REVIEW' : 'VERIFY_AUTHORITY_CURRENTNESS_APPLICABILITY_AND_SCOPE',
    owner: ownerForGap(item.gapId),
    blockingIssues: item.unresolved,
    state: 'OPEN',
    allowedOutcome: ['APPROVE_AS_CANDIDATE_FOR_REGISTRY', 'REJECT', 'REQUEST_MORE_EVIDENCE', 'KEEP_UNRESOLVED'],
    forbiddenOutcome: ['AUTO_CURRENT', 'AUTO_AUTHORITATIVE', 'AUTO_PASS'],
  })),
};

const updatedGapRegister = {
  schemaVersion: 'agm-phase2-gap-register.v2',
  phase: 'PHASE_2_CANONICAL_SOURCES_ACQUISITION_AND_CONSOLIDATION',
  status: 'ACQUISITION_COMPLETE_HUMAN_REVIEW_OPEN',
  gapCount: gapDecisions.length,
  decisions: gapDecisions,
  domainVerdicts,
};

writeJson('CANDIDATES/canonical-source-candidates.json', candidateRegistry);
writeJson('REGISTRY/canonical-source-gaps.updated.json', updatedGapRegister);
writeJson('MATRICES/candidate-authoritative-decision-matrix.json', decisionMatrix);
writeJson('MATRICES/provenance-matrix.json', provenanceMatrix);
writeJson('MATRICES/authority-jurisdiction-matrix.json', authorityJurisdictionMatrix);
writeJson('MATRICES/current-superseded-unknown-assessment.json', currentAssessment);
writeJson('UNRESOLVED_GAPS.json', unresolvedGaps);
writeJson('PROPOSED_REGISTRY_UPDATES.json', proposedRegistryUpdates);
writeJson('HUMAN_REVIEW_QUEUE.json', reviewQueue);

const report = `# PHASE 2 — Canonical source acquisition report

Generated: \`${retrievalDate}\`
Status: \`ACQUISITION COMPLETE / HUMAN REVIEW OPEN\`
Automatic authority promotion: \`FORBIDDEN\`

## Outcome

- original PHASE 1 canonical sources: 798 (unchanged);
- Phase 2 source candidates: ${candidates.length};
- Phase 2 gaps assessed: ${gapDecisions.length};
- gaps with unresolved work: ${unresolvedGaps.gaps.length};
- candidates promoted to CURRENT: 0;
- candidates promoted to AUTHORITATIVE: 0;
- runtime, TURN and Production changes: 0.

The candidate registry is separate from the AGM Central Registry. Proposed
updates are inert until the named human owner reviews authority, currentness,
applicability, licensing and scope.

## Domain verdicts

| Domain | Verdict | Basis |
|---|---|---|
${domainVerdicts.map((item) => `| ${item.domain} | ${item.verdict} | ${item.reason} |`).join('\n')}

## Gap decisions

| Gap | Acquisition decision | Candidates | Unresolved |
|---|---|---:|---|
${gapDecisions.map((item) => `| ${item.gapId} | ${item.status} | ${item.candidateSourceIds.length} | ${item.unresolved.length ? item.unresolved.join(' ') : 'None at acquisition stage; human review still required.'} |`).join('\n')}

## Authority model

1. Authentic Official Journal and official national legal publications are the
   primary legal candidates.
2. EUR-Lex consolidated texts are working references, not authentic legal acts.
3. Government/operator guidance is authoritative for its published operational
   scope, but does not replace legislation or concession-specific tariffs.
4. VDI metadata proves the standard family and version catalogue; it does not
   grant access to licensed normative content and is not legislation.
5. AGM specifications are controlled internal drafts until the designated Owner
   and Inspector approve them.
6. Field evidence remains measured evidence. It cannot become provider
   documentation, official toll truth or a conclusive result before thresholds.

## Important unresolved work

- \`LEGAL-003\`: licensed VDI normative material requires controlled acquisition
  and legal/technical review.
- \`LEGAL-005\`: a complete, current primary-source set for all ten operating
  jurisdictions was not demonstrated. AT/CH need current reacquisition and
  several countries remain missing.
- \`ROUTING-TOLL-001\`: France remains concession-fragmented and Luxembourg's
  located official page is stale.
- Tacho and all legal sources require human determination of applicability,
  amendment state and current/superseded status.
- Internal Car Mover, Field and OCR specifications require their named Owner
  reviews and are not runtime contracts merely because they were consolidated.

## Boundary confirmation

Car Mover is a distinct functional component within AGM Premium, not a separate
product or project. Basic Librarian is unchanged. Historical evidence is not
rewritten or deleted.

## Verdict

\`PHASE 2 ACQUISITION = PASS\` means the controlled acquisition and honest gap
assessment completed. It does **not** mean that the authority view is approved.
The authoritative-view verdicts remain those listed above until the human-review
queue is closed.
`;

writeText('REPORTS/CANONICAL_SOURCE_ACQUISITION_REPORT.md', report);
const authorityRegister = `# Official source and validation authority register

Generated: \`${retrievalDate}\`
Rule: a located candidate is not automatically current or authoritative.

This register answers the control question: “Which official/current source
supports each important AGM rule, and who may declare it valid?” Where the
current official set is incomplete, the answer remains explicitly UNKNOWN.

| Gap | Candidate sourceId(s) | Current/authority assessment | Human authority required |
|---|---|---|---|
${gapDecisions.map((item) => {
  const assessment = item.status === 'OPEN_UNRESOLVED'
    ? 'UNKNOWN — complete current official source set not demonstrated'
    : item.status === 'PARTIAL_UNRESOLVED'
      ? 'PARTIAL — official candidates exist but the canonical set is incomplete'
      : 'UNKNOWN pending human verification of currentness, applicability and scope';
  return `| ${item.gapId} | ${item.candidateSourceIds.join('<br>')} | ${assessment} | ${ownerForGap(item.gapId)} |`;
}).join('\n')}

## Decision boundary

- The issuing body publishes the external source.
- The named AGM human owner reviews applicability and may propose registry
  acceptance.
- Only the AGM governance decision authorized by the Owner/Inspector may mark a
  reviewed candidate \`CURRENT\` or \`AUTHORITATIVE\`.
- The Central Librarian and domain views may index that decision; they cannot
  create it.
`;
writeText('REPORTS/OFFICIAL_SOURCE_AND_AUTHORITY_REGISTER.md', authorityRegister);
writeText('README.md', `# AGM Multi-Library — Phase 2\n\nThis directory contains acquisition candidates and review material only.\nIt does not modify the PHASE 1 Central Registry, runtime, TURN or Production.\n\n- candidates: \`CANDIDATES/canonical-source-candidates.json\`;\n- updated 15-gap assessment: \`REGISTRY/canonical-source-gaps.updated.json\`;\n- human decisions: \`HUMAN_REVIEW_QUEUE.json\`;\n- proposed central updates: \`PROPOSED_REGISTRY_UPDATES.json\`;\n- report: \`REPORTS/CANONICAL_SOURCE_ACQUISITION_REPORT.md\`.\n`);

console.log(`PHASE2_CANDIDATES=${candidates.length}`);
console.log(`PHASE2_GAPS=${gapDecisions.length}`);
console.log(`PHASE2_UNRESOLVED=${unresolvedGaps.gaps.length}`);
console.log('CENTRAL_REGISTRY_MUTATED=NO');
console.log('AUTOMATIC_AUTHORITY_PROMOTION=NO');

function ext(sourceId, title, issuingAuthority, authorityLevel, jurisdictions, officialUri, publicationDate, effectiveDate, version, domains, gapIds, reviewOwner, reviewStatus, options = {}) {
  return {
    sourceId, title, issuingAuthority, authorityLevel, jurisdictions,
    officialUri, canonicalLocation: officialUri, publicationDate, effectiveDate,
    version, revision: null, supersedes: [], supersededBy: [],
    documentStatus: 'REVIEW_CANDIDATE', domains,
    provenance: { type: 'REMOTE_OFFICIAL_SOURCE', acquiredFrom: officialUri, originalPreserved: true, physicalLibraryCopyCreated: false },
    retrievalDate, integrity: externalIntegrity,
    retentionClass: 'PRESERVE_CANDIDATE_AND_ALL_REVIEW_DECISIONS',
    evidenceReferences: [officialUri], reviewOwner, reviewStatus, gapIds,
    notes: options.notes ?? null,
  };
}

function internal(sourceId, title, issuingAuthority, jurisdictions, relativePath, domains, gapIds, reviewOwner, reviewStatus) {
  const content = readFileSync(path.join(root, relativePath));
  return {
    sourceId, title, issuingAuthority,
    authorityLevel: 'AGM_INTERNAL_CONTROLLED_DRAFT', jurisdictions,
    officialUri: null, canonicalLocation: relativePath,
    publicationDate: retrievalDate, effectiveDate: null,
    version: '1.0.0-review-candidate', revision: null,
    supersedes: [], supersededBy: [], documentStatus: 'DRAFT', domains,
    provenance: { type: 'INTERNAL_CONSOLIDATION', acquiredFrom: 'PRESERVED_IMPLEMENTATION_AND_EVIDENCE_REFERENCES', originalPreserved: true, physicalLibraryCopyCreated: false },
    retrievalDate,
    integrity: { sha256: createHash('sha256').update(content).digest('hex'), status: 'CAPTURED_LOCAL_CANDIDATE' },
    retentionClass: 'PERMANENT_VERSION_AND_REVIEW_HISTORY',
    evidenceReferences: extractEvidenceRefs(content.toString('utf8')),
    reviewOwner, reviewStatus, gapIds, notes: null,
  };
}

function extractEvidenceRefs(content) {
  return [...content.matchAll(/`([^`]+\/(?:[^`]+))`/g)].map((match) => match[1]).filter((value) => !value.includes(' → '));
}

function ids(gapId) {
  return candidates.filter((source) => source.gapIds.includes(gapId)).map((source) => source.sourceId);
}

function gap(gapId, status, candidateSourceIds, unresolved) {
  return { gapId, status, candidateSourceIds, unresolved, promotedToCurrent: false, promotedToAuthoritative: false };
}

function ownerForGap(gapId) {
  if (gapId.startsWith('TACHO')) return 'Transport Compliance Owner (designation required)';
  if (gapId.startsWith('LEGAL')) return 'Security & Legal / Human Reviewer';
  if (gapId === 'DOCS-001') return 'Inspector / Evidence Custody';
  if (gapId.startsWith('CAR-MOVER')) return 'AGM Product Owner / Car Mover Steward';
  return 'Mobility & Routing Steward';
}

function authorityDecision(source) {
  if (source.reviewStatus.includes('CONTEXTUAL')) return 'CONTEXTUAL_ONLY_PENDING_LICENSED_CONTENT';
  if (source.reviewStatus.includes('STALE') || source.reviewStatus.includes('NOT_CURRENT')) return 'REACQUIRE_CURRENT_OFFICIAL_SOURCE';
  if (source.reviewStatus.includes('DOCUMENTATION_AID')) return 'SUPPORTING_OFFICIAL_REFERENCE_ONLY';
  return 'CANDIDATE_PENDING_REQUIRED_HUMAN_REVIEW';
}

function writeJson(relativePath, value) {
  writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(relativePath, value) {
  const absolute = path.join(phase2, relativePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, value, 'utf8');
}
