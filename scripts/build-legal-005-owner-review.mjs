import {
  BASELINE,
  PREPARED_AT,
  evidenceRecord,
  freshness,
  guardrails,
  verifyProtectedBaseline,
  writeJson,
  writeText,
} from './legal-gap-owner-review-common.mjs';

const OUT = 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW';
const actualBaseline = verifyProtectedBaseline();

const specs = [
  { evidenceId: 'L005-EV-DE-STVO', sourceId: 'CS-DE-STVO', path: 'AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-DE-STVO.official.de.pdf', mediaType: 'application/pdf', officialUrl: 'https://www.gesetze-im-internet.de/stvo_2013/StVO.pdf', authority: 'German Federal Ministry of Justice / Federal Office of Justice', status: 'EXISTING_CANONICAL_REUSE_NO_COPY' },
  { evidenceId: 'L005-EV-EU-561', sourceId: 'CS-EU-REG-561-2006', path: 'AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-EU-REG-561-2006.official.en.html', mediaType: 'text/html', officialUrl: 'https://eur-lex.europa.eu/eli/reg/2006/561/oj?locale=en', authority: 'European Parliament and Council of the European Union', status: 'EXISTING_CANONICAL_REUSE_NO_COPY' },
  { evidenceId: 'L005-EV-DE-FERREISEV', sourceId: 'CS-DE-FERREISEV-2026', path: `${OUT}/EVIDENCE/LEGAL005-DE-FERREISEV-current.official.pdf`, mediaType: 'application/pdf', officialUrl: 'https://www.gesetze-im-internet.de/ferreisev_1985/FerReiseV_1985.pdf', authority: 'German Federal Ministry of Justice / Federal Office of Justice', status: 'OFFICIAL_CAPTURED' },
  { evidenceId: 'L005-EV-AT-STVO-42', sourceId: 'CS-AT-STVO-42-20260830', path: `${OUT}/EVIDENCE/LEGAL005-AT-STVO-42-20260830.official.html`, mediaType: 'text/html', officialUrl: 'https://ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Anlage=&Artikel=&FassungVom=2026-08-30&Gesetzesnummer=10011336&Paragraf=42&ShowPrintPreview=True&Uebergangsrecht=', authority: 'Republic of Austria / RIS', status: 'OFFICIAL_CAPTURED_DATE_PINNED' },
  { evidenceId: 'L005-EV-AT-CALENDAR-77', sourceId: 'CS-AT-HGV-BAN-CALENDAR-2026', path: `${OUT}/EVIDENCE/LEGAL005-AT-FAHRVERBOTSKALENDER-2026.official.pdf`, mediaType: 'application/pdf', officialUrl: 'https://www.ris.bka.gv.at/Dokumente/BgblAuth/BGBLA_2026_II_77/BGBLA_2026_II_77.pdf', authority: 'Republic of Austria / RIS', status: 'OFFICIAL_CAPTURED' },
  { evidenceId: 'L005-EV-AT-A10-190', sourceId: 'CS-AT-A10-SUMMER-HGV-BAN-2026', path: `${OUT}/EVIDENCE/LEGAL005-AT-A10-SUMMER-BAN-2026.official.html`, mediaType: 'text/html', officialUrl: 'https://www.ris.bka.gv.at/eli/bgbl/ii/2026/190/P1/NOR40279329', authority: 'Republic of Austria / RIS', status: 'OFFICIAL_CAPTURED' },
  { evidenceId: 'L005-EV-AT-LUEG', sourceId: 'CS-AT-LUEGBRUECKE-HGV-BAN-2026', path: `${OUT}/EVIDENCE/LEGAL005-AT-LUEGBRUECKE-BAN-2026.official.pdf`, mediaType: 'application/pdf', officialUrl: 'https://www.ris.bka.gv.at/Dokumente/Bundesnormen/NOR40274972/NOR40274972.pdf', authority: 'Republic of Austria / RIS', status: 'OFFICIAL_CAPTURED_CONSOLIDATED' },
  { evidenceId: 'L005-EV-CH-ELI-LANDING', sourceId: 'CS-CH-VRV-CURRENT-PENDING', path: `${OUT}/EVIDENCE/LEGAL005-CH-VRV-ELI-LANDING.official.html`, mediaType: 'text/html', officialUrl: 'https://www.fedlex.admin.ch/eli/cc/1962/1364_1409_1420/de', authority: 'Swiss Confederation / Fedlex', status: 'OFFICIAL_LANDING_ONLY_NO_CURRENT_NORMATIVE_CONTENT' },
  { evidenceId: 'L005-EV-CH-VRV-STALE', sourceId: 'CS-CH-VRV-20220401', path: `${OUT}/EVIDENCE/LEGAL005-CH-VRV-20220401.official.stale.pdf`, mediaType: 'application/pdf', officialUrl: 'https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1962/1364_1409_1420/20220401/de/pdf-a/fedlex-data-admin-ch-eli-cc-1962-1364_1409_1420-20220401-de-pdf-a.pdf', authority: 'Swiss Confederation / Fedlex', status: 'OFFICIAL_STALE_EVIDENCE_ONLY' },
  { evidenceId: 'L005-EV-FR-BASE', sourceId: 'CS-FR-TRUCK-BAN-BASE-2021', path: null, mediaType: 'application/pdf', officialUrl: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043416004', authority: 'French Republic / Légifrance', status: 'OWNER_MANUAL_CAPTURE_REQUIRED_CLOUDFLARE' },
  { evidenceId: 'L005-EV-FR-2026', sourceId: 'CS-FR-TRUCK-BAN-2026', path: null, mediaType: 'application/pdf', officialUrl: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053324056', authority: 'French Republic / Légifrance', status: 'OWNER_MANUAL_CAPTURE_REQUIRED_CLOUDFLARE' },
  { evidenceId: 'L005-EV-FR-FIRE', sourceId: 'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026', path: null, mediaType: 'application/pdf', officialUrl: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000054633358', authority: 'French Republic / Légifrance', status: 'OWNER_MANUAL_CAPTURE_REQUIRED_CLOUDFLARE' },
  { evidenceId: 'L005-EV-BE-TACHO-2026', sourceId: 'CS-BE-FOD-TACHOGRAPH-20260701', path: `${OUT}/EVIDENCE/LEGAL005-BE-TACHOGRAPH-20260701.official.html`, mediaType: 'text/html', officialUrl: 'https://mobilit.belgium.be/fr/news/tachygraphe-digital-nouvelle-reglementation-dapplication-au-1er-juillet-2026', authority: 'Belgian Federal Public Service Mobility and Transport', status: 'OFFICIAL_CAPTURED_CONTEXTUAL' },
  { evidenceId: 'L005-EV-BE-TRAFFIC-CONTEXT', sourceId: null, path: `${OUT}/EVIDENCE/LEGAL005-BE-TRAFFIC-RULES-CONTEXT.official.html`, mediaType: 'text/html', officialUrl: 'https://mobilit.belgium.be/nl/weg/rijden/wegcode-verkeersregels-en-sancties/verkeersregels', authority: 'Belgian Federal Public Service Mobility and Transport', status: 'OFFICIAL_CONTEXT_ONLY_DOES_NOT_PROVE_NATIONAL_HGV_BAN_OR_ABSENCE' },
  { evidenceId: 'L005-EV-NL-DRIVING-REST', sourceId: 'CS-NL-GOV-DRIVING-REST-CURRENT', path: `${OUT}/EVIDENCE/LEGAL005-NL-DRIVING-REST-CURRENT.official.html`, mediaType: 'text/html', officialUrl: 'https://www.rijksoverheid.nl/vraag-en-antwoord/werktijden/rijtijden-en-rusttijden-wegvervoer', authority: 'Government of the Netherlands', status: 'OFFICIAL_CAPTURED_CONTEXTUAL' },
  { evidenceId: 'L005-EV-NL-TRUCK-CONTEXT', sourceId: null, path: `${OUT}/EVIDENCE/LEGAL005-NL-TRUCK-SAFETY-CONTEXT.official.html`, mediaType: 'text/html', officialUrl: 'https://www.rijksoverheid.nl/themas/verkeer-en-vervoer/verkeersveiligheid/veilig-rijden-in-de-vrachtwagen', authority: 'Government of the Netherlands', status: 'OFFICIAL_CONTEXT_ONLY_DOES_NOT_PROVE_NATIONAL_HGV_BAN_OR_ABSENCE' },
  { evidenceId: 'L005-EV-LU-HGV', sourceId: 'CS-LU-TRANSPORTS-HGV-RESTRICTIONS-CURRENT', path: `${OUT}/EVIDENCE/LEGAL005-LU-HGV-RESTRICTIONS-CURRENT.official.html`, mediaType: 'text/html', officialUrl: 'https://transports.public.lu/fr/transporter/transports-routiers/circulation-interdite-poids-lourds-au-dessus-de-7500kg.html', authority: 'Grand Duchy of Luxembourg / Ministry of Mobility and Public Works', status: 'OFFICIAL_CAPTURED' },
  { evidenceId: 'L005-EV-PL-GITD', sourceId: 'CS-PL-HGV-RESTRICTIONS-CURRENT', path: `${OUT}/EVIDENCE/LEGAL005-PL-GITD-RESTRICTIONS-CURRENT.official.html`, mediaType: 'text/html', officialUrl: 'https://www.gov.pl/web/gitd/zakazy-ruchu', authority: 'Polish General Inspectorate of Road Transport', status: 'OFFICIAL_OPERATIONAL_SUPPORT' },
  { evidenceId: 'L005-EV-PL-ELI-HTML', sourceId: 'CS-PL-HGV-RESTRICTIONS-CURRENT', path: `${OUT}/EVIDENCE/LEGAL005-PL-RESTRICTIONS-REGULATION-2023.official.html`, mediaType: 'text/html', officialUrl: 'https://eli.gov.pl/eli/DU/2023/2423/ogl', authority: 'Polish Ministry of Infrastructure / ELI', status: 'OFFICIAL_ELI_METADATA_STATUS_IN_FORCE' },
  { evidenceId: 'L005-EV-PL-ELI-PDF', sourceId: 'CS-PL-HGV-RESTRICTIONS-CURRENT', path: `${OUT}/EVIDENCE/LEGAL005-PL-RESTRICTIONS-REGULATION-2023.official.pdf`, mediaType: 'application/pdf', officialUrl: 'https://api.sejm.gov.pl/eli/acts/DU/2023/2423/text.pdf', authority: 'Polish Ministry of Infrastructure / Sejm ELI API', status: 'OFFICIAL_PRIMARY_CAPTURED' },
  { evidenceId: 'L005-EV-CZ-MD', sourceId: 'CS-CZ-MD-HGV-RESTRICTIONS-CURRENT', path: `${OUT}/EVIDENCE/LEGAL005-CZ-MD-TRUCK-BAN-CURRENT.official.html`, mediaType: 'text/html', officialUrl: 'https://md.gov.cz/Dokumenty/Silnicni-doprava/Vyjimky-ze-zakazu-jizdy-(povoleni)', authority: 'Czech Ministry of Transport', status: 'OFFICIAL_CAPTURED_WITH_SCOPE' },
  { evidenceId: 'L005-EV-DK-AMENDMENT', sourceId: 'CS-DK-DRIVING-REST-20260701', path: `${OUT}/EVIDENCE/LEGAL005-DK-DRIVING-REST-AMENDMENT-2026.official.pdf`, mediaType: 'application/pdf', officialUrl: 'https://www.retsinformation.dk/eli/lta/2026/256/dan/pdf', authority: 'Danish Road Traffic Authority / Retsinformation', status: 'OFFICIAL_PRIMARY_CAPTURED' },
  { evidenceId: 'L005-EV-DK-FSTYR', sourceId: 'CS-DK-DRIVING-REST-20260701', path: `${OUT}/EVIDENCE/LEGAL005-DK-FSTYR-20260701.official.html`, mediaType: 'text/html', officialUrl: 'https://www.fstyr.dk/nyheder/2026/feb/aendring-af-bekendtgoerelsen-om-koere-og-hviletidsbestemmelserne-i-vejtransport-og-kontrol-med-arbejdstid-pr-1-juli-2026', authority: 'Danish Road Traffic Authority', status: 'OFFICIAL_OPERATIONAL_SUPPORT' },
];
const evidence = specs.map(evidenceRecord);
const byId = Object.fromEntries(evidence.map((item) => [item.evidenceId, item]));

const assessment = {
  schemaVersion: 'agm-legal-gap-as-is.v1',
  gapId: 'LEGAL-005',
  preparedAt: PREPARED_AT,
  verdict: 'PARTIALLY_READY_BLOCKED',
  exactScope: 'Country matrix for DE, AT, CH, FR, BE, NL, LU, PL, CZ and DK covering (a) nationally published general/periodic HGV road restrictions and (b) core professional-driver driving/rest obligations. Dynamic incident controls, local signage and municipality-only restrictions remain outside this closure package.',
  measurementModel: '20 requirement units = 10 jurisdictions × 2 dimensions (road restrictions + professional-driver obligations).',
  currentBaseline: { expected: BASELINE, observed: actualBaseline },
  coverage: { demonstrated: 15, required: 20, ratio: '15/20' },
  officialEvidence: { locallyValidatedOrExistingCanonical: 14, required: 20, ratio: '14/20', note: 'France restriction coverage is remotely demonstrated on official Légifrance but canonical local capture is blocked by Cloudflare and is therefore excluded from the local-evidence numerator.' },
  alreadyCovered: ['CS-DE-STVO is canonical and already in legislation-safety.', 'CS-EU-REG-561-2006 is canonical and can be proposed as the EU professional-driver obligations backbone; it is not currently a legislation-safety membership.', 'The 2022 CH VRV PDF is preserved only as stale historical evidence.'],
  stale: ['CS-AT-STVO-42-20260213 is superseded at candidate level by the date-pinned 2026-08-30 capture.', 'CS-CH-VRV-20220401 is not current evidence for 2026.', 'The French fire derogation expires after 2026-08-31 and is in EXPIRY_WARNING.'],
  duplicates: ['CS-DE-STVO and CS-EU-REG-561-2006 must be reused, not copied.', 'PL ELI HTML, primary PDF and GITD page are representations/support for one proposed SourceId.', 'DK Retsinformation PDF and Færdselsstyrelsen explanation support one proposed SourceId.', 'Sources shared with other gaps retain one canonical artifact; scope decisions remain gap-specific.'],
  authorityGaps: ['Product Owner decisions are pending for every candidate.', 'No current canonical Swiss VRV/national professional-driver source set is captured.', 'No official national source has been identified that proves either a blanket HGV periodic restriction or its absence for BE, NL or DK.', 'Légifrance artifacts need owner manual canonical capture and SHA-256 before apply eligibility.'],
  blockers: ['LEGAL005-BLK-001_CH_CURRENT_PRIMARY_SET_MISSING', 'LEGAL005-BLK-002_BE_ROAD_RESTRICTION_BASELINE_UNKNOWN', 'LEGAL005-BLK-003_NL_ROAD_RESTRICTION_BASELINE_UNKNOWN', 'LEGAL005-BLK-004_DK_ROAD_RESTRICTION_BASELINE_UNKNOWN', 'LEGAL005-BLK-005_FR_OWNER_MANUAL_CAPTURE_REQUIRED_CLOUDFLARE', 'LEGAL005-BLK-006_PRODUCT_OWNER_AUTHORITY_DECISIONS_PENDING'],
  guardrails: guardrails(),
};

const rows = [
  ['DE','ROAD_RESTRICTIONS','DEMONSTRATED_LOCAL','CS-DE-STVO + CS-DE-FERREISEV-2026','PO decisions'], ['DE','PROFESSIONAL_DRIVER_OBLIGATIONS','DEMONSTRATED_EXISTING_CANONICAL','CS-EU-REG-561-2006','PO scope/membership decision'],
  ['AT','ROAD_RESTRICTIONS','DEMONSTRATED_LOCAL','CS-AT-STVO-42-20260830 + three 2026 federal scheduled acts','PO decisions'], ['AT','PROFESSIONAL_DRIVER_OBLIGATIONS','DEMONSTRATED_EXISTING_CANONICAL','CS-EU-REG-561-2006','PO scope/membership decision'],
  ['CH','ROAD_RESTRICTIONS','GAP_CURRENTNESS','No current candidate; 2022 VRV evidence only','Current Fedlex consolidated VRV manual capture'], ['CH','PROFESSIONAL_DRIVER_OBLIGATIONS','GAP_AUTHORITY','No current candidate','Current official national/AETR applicability evidence'],
  ['FR','ROAD_RESTRICTIONS','DEMONSTRATED_REMOTE_LOCAL_CAPTURE_BLOCKED','Three existing FR candidates','Owner manual capture + hash + PO decisions'], ['FR','PROFESSIONAL_DRIVER_OBLIGATIONS','DEMONSTRATED_EXISTING_CANONICAL','CS-EU-REG-561-2006','PO scope/membership decision'],
  ['BE','ROAD_RESTRICTIONS','GAP_NEGATIVE_OR_POSITIVE_BASELINE','None','Official national authority source; silence is not evidence'], ['BE','PROFESSIONAL_DRIVER_OBLIGATIONS','DEMONSTRATED','CS-EU-REG-561-2006 + CS-BE-FOD-TACHOGRAPH-20260701','PO decisions'],
  ['NL','ROAD_RESTRICTIONS','GAP_NEGATIVE_OR_POSITIVE_BASELINE','None','Official national authority source; silence is not evidence'], ['NL','PROFESSIONAL_DRIVER_OBLIGATIONS','DEMONSTRATED','CS-EU-REG-561-2006 + CS-NL-GOV-DRIVING-REST-CURRENT','PO decisions'],
  ['LU','ROAD_RESTRICTIONS','DEMONSTRATED_LOCAL','CS-LU-TRANSPORTS-HGV-RESTRICTIONS-CURRENT','PO decision'], ['LU','PROFESSIONAL_DRIVER_OBLIGATIONS','DEMONSTRATED_EXISTING_CANONICAL','CS-EU-REG-561-2006','PO scope/membership decision'],
  ['PL','ROAD_RESTRICTIONS','DEMONSTRATED_LOCAL','CS-PL-HGV-RESTRICTIONS-CURRENT','PO decision'], ['PL','PROFESSIONAL_DRIVER_OBLIGATIONS','DEMONSTRATED_EXISTING_CANONICAL','CS-EU-REG-561-2006','PO scope/membership decision'],
  ['CZ','ROAD_RESTRICTIONS','DEMONSTRATED_LOCAL_WITH_SCOPE','CS-CZ-MD-HGV-RESTRICTIONS-CURRENT','PO decision; legal-text limitation retained'], ['CZ','PROFESSIONAL_DRIVER_OBLIGATIONS','DEMONSTRATED_EXISTING_CANONICAL','CS-EU-REG-561-2006','PO scope/membership decision'],
  ['DK','ROAD_RESTRICTIONS','GAP_NEGATIVE_OR_POSITIVE_BASELINE','None','Official national authority source; silence is not evidence'], ['DK','PROFESSIONAL_DRIVER_OBLIGATIONS','DEMONSTRATED_LOCAL','CS-EU-REG-561-2006 + CS-DK-DRIVING-REST-20260701','PO decisions'],
].map(([jurisdiction, requirement, evidenceStatus, proposedCandidate, requiredProductOwnerDecision], index) => ({ requirementId: `LEGAL005-R${String(index + 1).padStart(2,'0')}`, jurisdiction, requirement, officialAuthority: jurisdiction === 'EU' ? 'EU' : 'Country-specific authority plus EU where applicable', evidenceStatus, currentness: /GAP/.test(evidenceStatus) ? 'FRESHNESS_UNKNOWN' : 'CURRENT_WITH_DOCUMENTED_LIMITATIONS', gap: /GAP|BLOCKED/.test(evidenceStatus) ? requiredProductOwnerDecision : null, proposedCandidate, requiredProductOwnerDecision }));

function makeCandidate({ candidateId, sourceId, country, authority, evidenceId, support = [], scope, classification = 'AUTHORITATIVE_WITH_SCOPE', reason, limitations = [], version, effectiveFrom = null, effectiveUntil = null, status = 'CURRENT', reviewRequired = false, action = 'ADD_SOURCE_AND_MEMBERSHIP', blocked = false }) {
  const artifact = byId[evidenceId];
  const reused = action.startsWith('REUSE');
  const viewAdd = action === 'REUSE_EXISTING_ADD_LEGISLATION_MEMBERSHIP' ? 1 : action === 'REUSE_EXISTING_SCOPE_DECISION_ONLY' ? 0 : blocked ? 0 : 1;
  return {
    candidateId, sourceId, country, domain: 'LEGISLATION_SAFETY', authority,
    documentEvidence: { canonicalArtifact: artifact?.path ?? null, officialUrl: artifact?.officialUrl ?? null, sha256: artifact?.sha256 ?? null, supportEvidenceIds: support },
    exactScope: scope, proposedClassification: classification, reason, limitations,
    freshness: freshness({ effectiveFrom, effectiveUntil, version, nextFreshnessCheck: status === 'EXPIRY_WARNING' ? '2026-08-31' : effectiveUntil ? '2026-12-01' : '2026-09-30', currentStatus: status, reviewRequired, limitations }),
    decisionStatus: 'PENDING_PRODUCT_OWNER', applyEligibility: blocked ? 'BLOCKED_BY_OWNER_MANUAL_CAPTURE' : 'DECISION_REQUIRED', proposedAction: action,
    ifApprove: { registryAdd: reused || blocked ? 0 : 1, legislationSafetyViewAdd: viewAdd, effect: blocked ? 'Authority decision may be recorded, but no apply eligibility until canonical capture, SHA-256 and reconciliation pass.' : action === 'REUSE_EXISTING_SCOPE_DECISION_ONLY' ? 'Record gap-specific scope only; no source or membership duplication.' : action === 'REUSE_EXISTING_ADD_LEGISLATION_MEMBERSHIP' ? 'Eligible for one later legislation-safety membership; registry source is reused.' : 'Eligible for one later source and one legislation-safety membership.' },
    ifReject: { registryAdd: 0, legislationSafetyViewAdd: 0, effect: 'No authority or view inclusion for this candidate; retained artifacts remain evidence only.' },
  };
}

const candidateList = [
  makeCandidate({ candidateId:'LEGAL005-CAND-DE-STVO-30',sourceId:'CS-DE-STVO',country:'DE',authority:'BMJ / BfJ',evidenceId:'L005-EV-DE-STVO',scope:'StVO section 30 general Sunday/holiday HGV prohibition and demonstrated exceptions only.',reason:'Official consolidated national legislation.',version:'Last amended 2026-01-30, BGBl. 2026 I Nr. 32',action:'REUSE_EXISTING_SCOPE_DECISION_ONLY' }),
  makeCandidate({ candidateId:'LEGAL005-CAND-EU-561',sourceId:'CS-EU-REG-561-2006',country:'EU/EEA',authority:'European Parliament and Council of the European Union',evidenceId:'L005-EV-EU-561',scope:'Core driving time, break and rest obligations for in-scope professional road transport in EU/EEA jurisdictions; national derogations require separate evidence.',reason:'Authentic EU primary legislation already canonical.',version:'OJ L 102, 11.4.2006',action:'REUSE_EXISTING_ADD_LEGISLATION_MEMBERSHIP',limitations:['Does not establish national road bans or every national derogation.'] }),
  makeCandidate({ candidateId:'LEGAL005-CAND-DE-FERREISEV-2026',sourceId:'CS-DE-FERREISEV-2026',country:'DE',authority:'BMJ / BfJ',evidenceId:'L005-EV-DE-FERREISEV',scope:'German summer holiday-travel HGV restrictions on the roads, dates, hours, vehicle classes and exceptions in the captured consolidated act.',reason:'Official consolidated national regulation.',version:'Last amended 2026-06-17, BGBl. 2026 I Nr. 180' }),
  makeCandidate({ candidateId:'LEGAL005-CAND-AT-STVO-42-20260830',sourceId:'CS-AT-STVO-42-20260830',country:'AT',authority:'Republic of Austria / RIS',evidenceId:'L005-EV-AT-STVO-42',scope:'Austria StVO section 42 general weekend/holiday HGV restrictions as valid on 2026-08-30.',reason:'Official date-pinned consolidated national legislation.',version:'RIS StVO 1960 §42, FassungVom 2026-08-30',action:'ADD_SOURCE_AND_MEMBERSHIP',limitations:['Supersedes the stale candidate CS-AT-STVO-42-20260213 at candidate level only.'] }),
  makeCandidate({ candidateId:'LEGAL005-CAND-AT-CALENDAR-77-2026',sourceId:'CS-AT-HGV-BAN-CALENDAR-2026',country:'AT',authority:'Republic of Austria / RIS',evidenceId:'L005-EV-AT-CALENDAR-77',scope:'Scheduled 2026 HGV restrictions in BGBl. II Nr. 77/2026, exact routes/directions/dates/vehicle thresholds.',reason:'Authenticated federal regulation.',version:'BGBl. II Nr. 77/2026',effectiveFrom:'2026-04-01',effectiveUntil:'2026-12-31' }),
  makeCandidate({ candidateId:'LEGAL005-CAND-AT-A10-190-2026',sourceId:'CS-AT-A10-SUMMER-HGV-BAN-2026',country:'AT',authority:'Republic of Austria / RIS',evidenceId:'L005-EV-AT-A10-190',scope:'A10 Tauern Autobahn 2026 summer HGV restrictions, dates, directions and >7.5 t scope in the act.',reason:'Official consolidated federal regulation.',version:'BGBl. II Nr. 190/2026 / NOR40279329',effectiveFrom:'2026-07-11',effectiveUntil:'2026-12-31' }),
  makeCandidate({ candidateId:'LEGAL005-CAND-AT-LUEG-2026',sourceId:'CS-AT-LUEGBRUECKE-HGV-BAN-2026',country:'AT',authority:'Republic of Austria / RIS',evidenceId:'L005-EV-AT-LUEG',scope:'2026 Luegbrücke reconstruction-related HGV restrictions on A12/A13/A14, including the consolidated amendment state.',reason:'Official consolidated federal regulation.',version:'BGBl. II Nr. 338/2025 as amended by BGBl. II Nr. 70/2026',effectiveFrom:'2025-12-31',effectiveUntil:'2026-12-31' }),
  makeCandidate({ candidateId:'LEGAL005-CAND-FR-BASE-2021',sourceId:'CS-FR-TRUCK-BAN-BASE-2021',country:'FR',authority:'French Republic / Légifrance',evidenceId:'L005-EV-FR-BASE',scope:'General French >7.5 t goods-vehicle circulation prohibition and demonstrated exceptions under the 16 April 2021 order.',reason:'Official national order remotely verified.',version:'JORFTEXT000043416004',effectiveFrom:'2021-05-01',blocked:true,reviewRequired:true,limitations:['Direct canonical acquisition hit Cloudflare; no SHA-256 exists yet.'] }),
  makeCandidate({ candidateId:'LEGAL005-CAND-FR-2026',sourceId:'CS-FR-TRUCK-BAN-2026',country:'FR',authority:'French Republic / Légifrance',evidenceId:'L005-EV-FR-2026',scope:'Complementary winter/summer >7.5 t goods-vehicle restrictions for 2026, exact listed dates/routes.',reason:'Official annual national order remotely verified.',version:'JORFTEXT000053324056',effectiveFrom:'2026-01-09',effectiveUntil:'2026-12-31',blocked:true,reviewRequired:true,limitations:['Direct canonical acquisition hit Cloudflare; no SHA-256 exists yet.'] }),
  makeCandidate({ candidateId:'LEGAL005-CAND-FR-FIRE-2026',sourceId:'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026',country:'FR',authority:'French Republic / Légifrance',evidenceId:'L005-EV-FR-FIRE',scope:'Temporary lifting only for >7.5 t transports necessary for firefighting and documented empty return, through 2026-08-31.',reason:'Official temporary national order remotely verified.',version:'JORFTEXT000054633358 / NOR TRAT2621637A',effectiveFrom:'2026-08-08',effectiveUntil:'2026-08-31',status:'EXPIRY_WARNING',blocked:true,reviewRequired:true,limitations:['Expires after 2026-08-31; EXPIRED is never ZERO.', 'Direct canonical acquisition hit Cloudflare; no SHA-256 exists yet.'] }),
  makeCandidate({ candidateId:'LEGAL005-CAND-BE-TACHO-20260701',sourceId:'CS-BE-FOD-TACHOGRAPH-20260701',country:'BE',authority:'Belgian Federal Public Service Mobility and Transport',evidenceId:'L005-EV-BE-TACHO-2026',scope:'Official operational explanation of the 2026-07-01 smart-tachograph scope change for international goods vehicles 2.5–3.5 t and stated exemption.',classification:'CONTEXTUAL',reason:'Official authority guidance; EU legal act remains the authority.',version:'FOD Mobility publication 2026-05-28',effectiveFrom:'2026-07-01',limitations:['No authority for national HGV road restrictions.'] }),
  makeCandidate({ candidateId:'LEGAL005-CAND-NL-DRIVING-REST',sourceId:'CS-NL-GOV-DRIVING-REST-CURRENT',country:'NL',authority:'Government of the Netherlands',evidenceId:'L005-EV-NL-DRIVING-REST',scope:'Government guidance on driving/rest times, breaks, weekly return, suitable accommodation and national exemptions.',classification:'CONTEXTUAL',reason:'Official operational guidance; EU law and national instruments remain legal authority.',version:'Live government guidance captured 2026-08-30',limitations:['No authority for national HGV road restrictions.'] }),
  makeCandidate({ candidateId:'LEGAL005-CAND-LU-HGV',sourceId:'CS-LU-TRANSPORTS-HGV-RESTRICTIONS-CURRENT',country:'LU',authority:'Luxembourg Ministry of Mobility and Public Works',evidenceId:'L005-EV-LU-HGV',scope:'Luxembourg >7.5 t Sunday/holiday circulation restrictions, directions and hours as published by the competent authority.',reason:'Official competent-authority operational publication.',version:'Live page; last modified 2025-07-16',limitations:['No tariff/toll authority; dynamic/local traffic controls remain separate.'] }),
  makeCandidate({ candidateId:'LEGAL005-CAND-PL-HGV',sourceId:'CS-PL-HGV-RESTRICTIONS-CURRENT',country:'PL',authority:'Polish Ministry of Infrastructure / ELI and GITD',evidenceId:'L005-EV-PL-ELI-PDF',support:['L005-EV-PL-ELI-HTML','L005-EV-PL-GITD'],scope:'Polish nationwide periodic restrictions for vehicles/combinations >12 t, dates/hours and documented exceptions.',reason:'Official consolidated regulation marked in force by ELI, supported by current GITD operational guidance.',version:'Dz.U. 2023 poz. 2423; ELI status in force at 2026-08-30' }),
  makeCandidate({ candidateId:'LEGAL005-CAND-CZ-HGV',sourceId:'CS-CZ-MD-HGV-RESTRICTIONS-CURRENT',country:'CZ',authority:'Czech Ministry of Transport',evidenceId:'L005-EV-CZ-MD',scope:'Ministry-published schedule and exemption process for section 43 HGV driving restrictions, including Sunday/holiday and summer periods.',reason:'Official competent-authority guidance tied to the cited national law.',version:'Ministry page updated 2025-12-09',limitations:['The captured page is official guidance, not an authenticated full consolidated statute; classification is strictly scoped.'] }),
  makeCandidate({ candidateId:'LEGAL005-CAND-DK-DRIVING-REST-20260701',sourceId:'CS-DK-DRIVING-REST-20260701',country:'DK',authority:'Danish Road Traffic Authority / Retsinformation',evidenceId:'L005-EV-DK-AMENDMENT',support:['L005-EV-DK-FSTYR'],scope:'National 2026 amendment applying work-time controls to transports under national driving/rest derogations, effective 2026-07-01.',reason:'Official national amending regulation with competent-authority explanation.',version:'BEK nr. 256 af 06/02/2026',effectiveFrom:'2026-07-01',limitations:['No authority for a national HGV periodic road-ban conclusion.'] }),
];

const packageData = {
  schemaVersion: 'agm-legal-gap-candidate-authority-package.v1', gapId: 'LEGAL-005', preparedAt: PREPARED_AT, candidateCount: candidateList.length, candidates: candidateList,
  projectedImpact: {
    currentlyApplyEligibleIfApproved: { registryAdd: 11, legislationSafetyViewAdd: 12, registryModify: 0, delete: 0, projectedRegistryCount: 852, projectedLegislationSafetyViewCount: 56 },
    conditionalFranceAfterManualCaptureAndApproval: { additionalRegistryAdd: 3, additionalLegislationSafetyViewAdd: 3 },
    allCandidatesAfterAllConditions: { registryAdd: 14, legislationSafetyViewAdd: 15, projectedRegistryCount: 855, projectedLegislationSafetyViewCount: 59 },
    note: 'No apply is authorized. CH and the BE/NL/DK road-restriction gaps are not represented as promotable candidates and are excluded.',
  }, guardrails: guardrails(),
};

writeJson(`${OUT}/AS_IS_ASSESSMENT.json`, assessment);
writeJson(`${OUT}/RESIDUAL_CLOSURE_MATRIX.json`, { schemaVersion:'agm-legal-gap-residual-matrix.v1', gapId:'LEGAL-005', preparedAt:PREPARED_AT, coverageUnits:rows, summary:{ demonstrated:'15/20', locallyValidatedOfficialEvidence:'14/20', unresolvedCoverageUnits:rows.filter((row)=>/^GAP/.test(row.evidenceStatus)).map((row)=>row.requirementId) } });
writeJson(`${OUT}/EVIDENCE_MANIFEST.json`, { schemaVersion:'agm-legal-gap-evidence-manifest.v1', gapId:'LEGAL-005', preparedAt:PREPARED_AT, artifacts:evidence, officialCapturedOrExisting:evidence.filter((item)=>item.localValidation==='PASS').length, manualCaptureRequired:evidence.filter((item)=>item.status.startsWith('OWNER_MANUAL_CAPTURE_REQUIRED')).map((item)=>item.evidenceId), guardrails:guardrails() });
writeJson(`${OUT}/CANDIDATE_AUTHORITY_PACKAGE.json`, packageData);
writeText(`${OUT}/OWNER_MANUAL_CAPTURE_CHECKLIST.md`, `# LEGAL-005 — owner/manual capture and unresolved-source checklist

## France — OWNER_MANUAL_CAPTURE_REQUIRED_CLOUDFLARE

For each exact official identifier below, use a normal user-controlled browser session and download the authenticated official PDF or save the complete official page. Do not save a Cloudflare challenge page.

- CS-FR-TRUCK-BAN-BASE-2021 — JORFTEXT000043416004
- CS-FR-TRUCK-BAN-2026 — JORFTEXT000053324056
- CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026 — JORFTEXT000054633358 / NOR TRAT2621637A

For every file: verify official Légifrance identity, title, all pages/sections, openability, absence of challenge/cut pages, effective dates, exact scope, and calculate SHA-256. Reconcile the fire exception with its 2026-08-31 end date. Until then, all three candidates are APPLY ELIGIBILITY = BLOCKED_BY_OWNER_MANUAL_CAPTURE.

## Switzerland — CURRENT PRIMARY SET REQUIRED

Open the canonical Fedlex ELI for SR 741.11, select the current version applicable on 2026-08-30, and capture the complete consolidated VRV artifact containing Articles 91 onward. Do not reuse the 2022 snapshot as current. Separately capture official current evidence for the professional-driver/AETR applicability required by this matrix. Record version/effective metadata and SHA-256.

## Belgium / Netherlands / Denmark — ROAD-RESTRICTION BASELINE REQUIRED

Identify a competent national authority or primary legal source that explicitly establishes the nationally applicable periodic HGV road restrictions, or explicitly supports the absence of a blanket national restriction. Search silence, commercial calendars and association summaries are not authority. Keep local/dynamic restrictions outside the national-baseline claim and document them as limitations.
`);
writeText(`${OUT}/REPORT.md`, `# LEGAL-005 — Product Owner review preparation

- Status: PARTIALLY_READY / BLOCKED
- Coverage: 15/20 requirement units
- Locally validated official evidence: 14/20 requirement units
- Candidates: 16 PENDING (14 AUTHORITATIVE_WITH_SCOPE; 2 CONTEXTUAL)
- Exact blockers: CH current primary set; BE/NL/DK road-restriction baselines; France manual canonical capture; Product Owner decisions.
- Registry/view/runtime: unchanged; no authority promotion; no apply; no commit/push.

See \`AS_IS_ASSESSMENT.json\`, \`RESIDUAL_CLOSURE_MATRIX.json\`, \`EVIDENCE_MANIFEST.json\`, \`CANDIDATE_AUTHORITY_PACKAGE.json\` and \`OWNER_MANUAL_CAPTURE_CHECKLIST.md\`.
`);

await import('./resolve-legal-005-final-blockers.mjs');
