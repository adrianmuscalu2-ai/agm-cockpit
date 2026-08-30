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

const OUT = 'AGM_LIBRARY/PHASE3/LEGAL_003_OWNER_REVIEW';
const actualBaseline = verifyProtectedBaseline();

const evidence = [
  evidenceRecord({
    evidenceId: 'LEGAL003-EV-STVO-EXISTING',
    sourceId: 'CS-DE-STVO',
    path: 'AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-DE-STVO.official.de.pdf',
    mediaType: 'application/pdf',
    officialUrl: 'https://www.gesetze-im-internet.de/stvo_2013/StVO.pdf',
    authority: 'German Federal Ministry of Justice / Federal Office of Justice',
    status: 'EXISTING_CANONICAL_REUSE_NO_COPY',
  }),
  evidenceRecord({
    evidenceId: 'LEGAL003-EV-HGB-412',
    sourceId: 'CS-DE-HGB-412',
    path: `${OUT}/EVIDENCE/LEGAL003-DE-HGB-current.official.pdf`,
    mediaType: 'application/pdf',
    officialUrl: 'https://www.gesetze-im-internet.de/hgb/HGB.pdf',
    authority: 'German Federal Ministry of Justice / Federal Office of Justice',
    status: 'OFFICIAL_CAPTURED',
  }),
  evidenceRecord({
    evidenceId: 'LEGAL003-EV-VDI-HANDBOOK-METADATA',
    sourceId: 'CS-VDI-2700-HANDBOOK',
    path: `${OUT}/EVIDENCE/LEGAL003-VDI-2700-handbook-metadata.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://www.vdi.de/mitgliedschaft/vdi-richtlinien/details/vdi-handbuch-ladungssicherung',
    authority: 'VDI e.V.',
    status: 'OFFICIAL_STANDARDS_OWNER_METADATA_ONLY',
  }),
  evidenceRecord({
    evidenceId: 'LEGAL003-EV-VDI-2700-8-1-METADATA',
    sourceId: 'CS-VDI-2700-HANDBOOK',
    path: `${OUT}/EVIDENCE/LEGAL003-VDI-2700-8-1-metadata.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://www.vdi.de/mitgliedschaft/vdi-richtlinien/details/vdi-2700-blatt-81-ladungssicherung-auf-strassenfahrzeugen-sicherung-von-pkw-und-leichten-nutzfahrzeugen-auf-fahrzeugtransportern',
    authority: 'VDI e.V.',
    status: 'OFFICIAL_STANDARDS_OWNER_METADATA_ONLY',
  }),
  evidenceRecord({
    evidenceId: 'LEGAL003-EV-VDI-2700-8-1-CORRIGENDUM-METADATA',
    sourceId: 'CS-VDI-2700-HANDBOOK',
    path: `${OUT}/EVIDENCE/LEGAL003-VDI-2700-8-1-corrigendum-metadata.official.html`,
    mediaType: 'text/html',
    officialUrl: 'https://www.vdi.de/mitgliedschaft/vdi-richtlinien/details/vdi-2700-blatt-81-berichtigung-ladungssicherung-auf-strassenfahrzeugen-sicherung-von-pkw-und-leichten-nutzfahrzeugen-auf-fahrzeugtransportern-berichtigung-zur-richtlinie-vdi-2700-blatt-812024-09',
    authority: 'VDI e.V.',
    status: 'OFFICIAL_STANDARDS_OWNER_METADATA_ONLY',
  }),
];

const assessment = {
  schemaVersion: 'agm-legal-gap-as-is.v1',
  gapId: 'LEGAL-003',
  preparedAt: PREPARED_AT,
  verdict: 'PARTIALLY_READY_BLOCKED',
  exactScope: 'Germany / EU-facing operation: primary German legal duties for cargo loading and securing plus recognized technical rules for securing passenger cars and light commercial vehicles on vehicle transporters; licensing constraints are part of the scope.',
  currentBaseline: { expected: BASELINE, observed: actualBaseline },
  coverage: { demonstrated: 3, required: 4, ratio: '3/4' },
  officialEvidence: { demonstrated: 3, required: 4, ratio: '3/4' },
  alreadyCovered: [
    'CS-DE-STVO is already canonical and in the legislation-safety view; its prior authority does not itself approve LEGAL-003 scope.',
    'StVO section 22 supplies the public-law cargo securing duty and requires observance of recognized technical rules.',
  ],
  existingRegistrySources: ['CS-DE-STVO'],
  candidateEvidence: ['CS-DE-HGB-412', 'CS-VDI-2700-HANDBOOK'],
  missing: ['Licensed, controlled normative text for the applicable current VDI 2700 vehicle-transporter sheets, including the current corrigendum relationship.'],
  stale: [],
  duplicates: ['CS-DE-STVO must be reused; a second source or copied artifact is prohibited.', 'Three VDI metadata captures are representations/supporting evidence for one proposed SourceId, not three sources.'],
  authorityGaps: ['Product Owner decisions are intentionally pending for the three review-ready candidates.', 'VDI catalogue metadata cannot acquire normative authority or substitute for licensed content.'],
  blockers: ['OWNER_LICENSED_ACQUISITION_REQUIRED'],
  reviewReadiness: {
    readyCandidateIds: ['LEGAL003-CAND-DE-STVO-22', 'LEGAL003-CAND-DE-HGB-412', 'LEGAL003-CAND-VDI-2700-METADATA'],
    blockedNormativeCandidate: 'VDI 2700 Blatt 8.1:2024-09 plus Berichtigung:2025-10',
    note: 'The licensed acquisition blocker does not block Product Owner review of the other three candidates.',
  },
  guardrails: guardrails(),
};

const residualMatrix = {
  schemaVersion: 'agm-legal-gap-residual-matrix.v1',
  gapId: 'LEGAL-003',
  preparedAt: PREPARED_AT,
  items: [
    { requirementId: 'LEGAL003-R1', requirement: 'Public-law cargo securing duty and recognized-technical-rules hook', jurisdiction: 'DE', officialAuthority: 'BMJ / BfJ', evidenceStatus: 'PASS_EXISTING_CANONICAL', currentness: 'CURRENT_AS_CAPTURED', gap: 'Authority scope decision only', proposedCandidate: 'CS-DE-STVO', requiredProductOwnerDecision: 'APPROVE / REJECT / DEFER AUTHORITATIVE_WITH_SCOPE for LEGAL-003 only' },
    { requirementId: 'LEGAL003-R2', requirement: 'Commercial allocation of loading, stowage and securing duties under HGB section 412', jurisdiction: 'DE', officialAuthority: 'BMJ / BfJ', evidenceStatus: 'PASS_OFFICIAL_CAPTURED', currentness: 'CURRENT_AS_CAPTURED_2026-08-30', gap: 'Authority decision', proposedCandidate: 'CS-DE-HGB-412', requiredProductOwnerDecision: 'APPROVE / REJECT / DEFER AUTHORITATIVE_WITH_SCOPE' },
    { requirementId: 'LEGAL003-R3', requirement: 'Official standards-owner identity, family, edition and corrigendum metadata', jurisdiction: 'DE', officialAuthority: 'VDI e.V.', evidenceStatus: 'PASS_METADATA_ONLY', currentness: 'LIVE_CATALOG_CAPTURE_2026-08-30', gap: 'Metadata cannot support normative instructions', proposedCandidate: 'CS-VDI-2700-HANDBOOK', requiredProductOwnerDecision: 'APPROVE / REJECT / DEFER CONTEXTUAL metadata only' },
    { requirementId: 'LEGAL003-R4', requirement: 'Licensed controlled normative technical rules applicable to vehicle transporters', jurisdiction: 'DE / operational EU routes', officialAuthority: 'VDI e.V.', evidenceStatus: 'MISSING_LICENSED_CONTENT', currentness: 'FRESHNESS_UNKNOWN_UNTIL_CONTROLLED_ACQUISITION', gap: 'Exact licensed sheets and their current correction state are absent', proposedCandidate: null, requiredProductOwnerDecision: 'DEFER; owner-controlled licensed acquisition required before any normative authority decision' },
  ],
};

const candidates = {
  schemaVersion: 'agm-legal-gap-candidate-authority-package.v1',
  gapId: 'LEGAL-003',
  preparedAt: PREPARED_AT,
  candidates: [
    {
      candidateId: 'LEGAL003-CAND-DE-STVO-22', sourceId: 'CS-DE-STVO', country: 'DE', domain: 'LEGISLATION_SAFETY', authority: 'German Federal Ministry of Justice / Federal Office of Justice', documentEvidence: 'Existing canonical StVO PDF, section 22', exactScope: 'Cargo and securing devices; safe securing against emergency braking and evasive movement; recognized technical rules.', proposedClassification: 'AUTHORITATIVE_WITH_SCOPE', reason: 'Official consolidated national legislation.', limitations: ['LEGAL-003 only; no new authority for unrelated StVO provisions.', 'Existing source and membership must be reused.'], freshness: freshness({ version: 'Last amended 2026-01-30, BGBl. 2026 I Nr. 32' }), decisionStatus: 'PENDING_PRODUCT_OWNER', applyEligibility: 'DECISION_REQUIRED', ifApprove: { registryAdd: 0, legislationSafetyViewAdd: 0, effect: 'Record LEGAL-003 scope decision against existing canonical source; no duplicate source or membership.' }, ifReject: { registryAdd: 0, legislationSafetyViewAdd: 0, effect: 'No LEGAL-003 reliance on StVO section 22; existing LEGAL-001 authority remains unchanged.' },
    },
    {
      candidateId: 'LEGAL003-CAND-DE-HGB-412', sourceId: 'CS-DE-HGB-412', country: 'DE', domain: 'LEGISLATION_SAFETY', authority: 'German Federal Ministry of Justice / Federal Office of Justice', documentEvidence: 'Official HGB PDF, section 412', exactScope: 'Allocation between sender and carrier of loading/unloading, transport-safe loading/stowage/securing and operationally safe loading.', proposedClassification: 'AUTHORITATIVE_WITH_SCOPE', reason: 'Official national legislation directly states the duties.', limitations: ['Does not replace StVO public-law duties.', 'No conclusion outside HGB section 412 and demonstrated transport scope.'], freshness: freshness({ version: 'Current official HGB consolidated PDF captured 2026-08-30' }), decisionStatus: 'PENDING_PRODUCT_OWNER', applyEligibility: 'DECISION_REQUIRED', ifApprove: { registryAdd: 1, legislationSafetyViewAdd: 1, effect: 'Eligible for later atomic addition as one scoped source.' }, ifReject: { registryAdd: 0, legislationSafetyViewAdd: 0, effect: 'Artifact remains evidence only; commercial duty allocation remains uncovered.' },
    },
    {
      candidateId: 'LEGAL003-CAND-VDI-2700-METADATA', sourceId: 'CS-VDI-2700-HANDBOOK', country: 'DE', domain: 'LEGISLATION_SAFETY', authority: 'VDI e.V.', documentEvidence: 'Official handbook, VDI 2700 sheet 8.1 (2024-09) and corrigendum (2025-10) catalogue pages', exactScope: 'Standards-owner metadata: family identity, titles, editions, scope summaries and correction relationship only.', proposedClassification: 'CONTEXTUAL', reason: 'VDI is the standards owner, but captured pages are catalogue metadata rather than licensed normative text.', limitations: ['No normative instructions, values or compliance conclusions may be derived.', 'No authority promotion to AUTHORITATIVE or AUTHORITATIVE_WITH_SCOPE without controlled licensed content and review.'], freshness: freshness({ version: 'Live catalogue; VDI 2700 Blatt 8.1:2024-09; corrigendum:2025-10' }), decisionStatus: 'PENDING_PRODUCT_OWNER', applyEligibility: 'DECISION_REQUIRED_CONTEXTUAL_ONLY', ifApprove: { registryAdd: 1, legislationSafetyViewAdd: 1, effect: 'Eligible for later atomic addition as contextual metadata only.' }, ifReject: { registryAdd: 0, legislationSafetyViewAdd: 0, effect: 'Metadata remains retained evidence and cannot be used by the view.' },
    },
  ],
  projectedEligibleImpactIfAllThreeApproved: { registryAdd: 2, legislationSafetyViewAdd: 2, registryModify: 0, delete: 0, note: 'No apply is authorized; licensed normative VDI remains ineligible and is not counted.' },
  guardrails: guardrails(),
};

writeJson(`${OUT}/AS_IS_ASSESSMENT.json`, assessment);
writeJson(`${OUT}/RESIDUAL_CLOSURE_MATRIX.json`, residualMatrix);
writeJson(`${OUT}/EVIDENCE_MANIFEST.json`, { schemaVersion: 'agm-legal-gap-evidence-manifest.v1', gapId: 'LEGAL-003', preparedAt: PREPARED_AT, artifacts: evidence, guardrails: guardrails() });
writeJson(`${OUT}/LICENSED_CONTENT_INVENTORY.json`, {
  schemaVersion: 'agm-legal003-licensed-content-inventory.v1',
  gapId: 'LEGAL-003',
  checkedAt: PREPARED_AT,
  authorizedRootsChecked: ['C:/Users/adria/Documents', 'C:/Users/adria/Downloads', 'C:/Users/adria/Desktop', 'C:/Users/adria/.codex/attachments'],
  relevantFilesFound: [
    `${OUT}/EVIDENCE/LEGAL003-VDI-2700-handbook-metadata.official.html`,
    `${OUT}/EVIDENCE/LEGAL003-VDI-2700-8-1-metadata.official.html`,
    `${OUT}/EVIDENCE/LEGAL003-VDI-2700-8-1-corrigendum-metadata.official.html`,
  ],
  licensedNormativeFilesFound: 0,
  result: 'OWNER_LICENSED_ACQUISITION_REQUIRED',
  note: 'No licensed normative PDF/document was found. Filename-only matches unrelated to VDI 2700 were excluded. No license bypass, unofficial reconstruction or content extraction was attempted.',
});
writeJson(`${OUT}/CANDIDATE_AUTHORITY_PACKAGE.json`, candidates);
const ownerReviewMarkdown = candidates.candidates.map((item, index) => `## ${index + 1}. ${item.candidateId}

- SourceId: ${item.sourceId}
- Country/domain: ${item.country} / ${item.domain}
- Issuing authority: ${item.authority}
- Document/evidence: ${item.documentEvidence}
- Exact scope: ${item.exactScope}
- Effective/freshness: ${item.freshness.effectiveFrom ?? 'not explicitly stated'} → ${item.freshness.effectiveUntil ?? 'no explicit end'}; ${item.freshness.currentStatus}; next check ${item.freshness.nextFreshnessCheck}
- Proposed classification: ${item.proposedClassification}
- Reason: ${item.reason}
- Limitations/caveats: ${item.limitations.join(' | ')}
- If APPROVE: ${item.ifApprove.effect} Impact registry/view: +${item.ifApprove.registryAdd}/+${item.ifApprove.legislationSafetyViewAdd}.
- If REJECT: ${item.ifReject.effect} Impact registry/view: +0/+0.
- Decision requested: **APPROVE / REJECT / DEFER**
`).join('\n');
writeText(`${OUT}/PRODUCT_OWNER_AUTHORITY_REVIEW_PACKAGE.md`, `# LEGAL-003 — candidate authority review package

All three decisions are PENDING. The licensed normative VDI candidate is not included and remains blocked by OWNER_LICENSED_ACQUISITION_REQUIRED.

${ownerReviewMarkdown}`);
writeText(`${OUT}/OWNER_LICENSED_ACQUISITION_CHECKLIST.md`, `# LEGAL-003 — owner-controlled VDI acquisition checklist

Status: **OWNER_LICENSED_ACQUISITION_REQUIRED**

## Exact minimum acquisition

1. **Document:** VDI 2700 Blatt 8.1, “Ladungssicherung auf Straßenfahrzeugen — Sicherung von Pkw und leichten Nutzfahrzeugen auf Fahrzeugtransportern”.
2. **Required edition:** 2024-09.
3. **Required correction:** VDI 2700 Blatt 8.1 Berichtigung, 2025-10, explicitly reconciled to the 2024-09 edition.
4. **Official source:** VDI e.V. through an authorized licensed account/channel; verify identity against the two official VDI catalogue URLs already captured in the evidence manifest.
5. **License evidence:** purchaser/license holder, authorized access channel, order/subscription identifier where available, permitted readers, redistribution restrictions and controlled storage location. Do not copy licensed content into a public/open library path when the license forbids it.
6. **Closure evidence:** exact title, edition, corrigendum relationship, language, page count, openability, completeness, version/currentness, and SHA-256 where the license and controlled environment permit hashing. If hashing is prohibited, record that explicit license restriction rather than inventing a digest.
7. Record capturedAt, lastFreshnessCheck and nextFreshnessCheck. Do not invent effectiveUntil.
8. Prepare a separate normative Product Owner candidate after Security & Legal scope review against StVO section 22 and HGB section 412. Metadata alone must never be treated as normative content.

No other VDI sheet is part of this minimum acquisition unless a later scoped legal review demonstrates that it is independently required.
`);
writeText(`${OUT}/REPORT.md`, `# LEGAL-003 — Product Owner review preparation

- Status: PARTIALLY_READY / BLOCKED
- Coverage: 3/4
- Official evidence: 3/4
- Candidate decisions: 3 PENDING (two AUTHORITATIVE_WITH_SCOPE, one CONTEXTUAL)
- Exact blocker: OWNER_LICENSED_ACQUISITION_REQUIRED for VDI 2700 Blatt 8.1:2024-09 plus Berichtigung:2025-10.
- The three existing candidates remain ready for Product Owner review and are not blocked by the licensed acquisition gate.
- Registry/view/runtime: unchanged; no authority promotion; no apply; no commit/push.

See \`AS_IS_ASSESSMENT.json\`, \`RESIDUAL_CLOSURE_MATRIX.json\`, \`EVIDENCE_MANIFEST.json\` and \`CANDIDATE_AUTHORITY_PACKAGE.json\`.
`);

console.log(JSON.stringify({ gapId: 'LEGAL-003', status: assessment.verdict, coverage: assessment.coverage.ratio, officialEvidence: assessment.officialEvidence.ratio, evidenceArtifacts: evidence.length, candidates: candidates.candidates.length, protectedBaseline: actualBaseline }, null, 2));
