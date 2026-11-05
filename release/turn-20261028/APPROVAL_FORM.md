# Turn release approval form — complete before release execution

This form is intentionally incomplete. Completion must be based on real approvals and evidence, not inference.

## To be completed by Command Lead

Governance role mapping found in the authorized sources: Command Lead
`turn-commander-adrian`; Independent Validator `agent-inspector`; Fallback
Responsible `release-operations / PC Fallback Custodian`; Rollback Responsible
`Atlas/Codex Technical Executor`; Release Executor `release-operations`.
These mappings do not substitute for current-window acknowledgement, validator
session or GO verdict.

- Change ID: `________________________________`
- UTC execution window: `________________________________`
- Approved release ref: `________________________________`
- Reviewed candidate commit: `________________________________`
- Deployment/routing mandate reference: `________________________________`
- Scope approved: `Turn spatial models + back-to-top + listed release files only`
- Production/data/API/authentication scope expansion: `NO / YES — explain: ________________________________`
- Command Lead identity: `________________________________`
- Acknowledgement and timestamp: `________________________________`
- STOP channel tested: `YES / NO` — evidence: `________________________________`
- Gate 6 current verdict for this window: `GO / READY / HOLD / NO-GO`
- Command Lead signature/approval: `________________________________`

## To be completed by Independent Validator

- Validator identity/session: `________________________________`
- Executor identity/session: `________________________________`
- Separation of duties confirmed: `YES / NO`
- Exact commit and source digests independently checked: `YES / NO`
- API/Web OCI digests independently checked: `YES / NO`
- Pre-change checklist reviewed: `YES / NO`
- Browser evidence reviewed: `YES / NO`
- Rollback plan and fallback readiness reviewed: `YES / NO`
- Any unresolved discrepancy: `________________________________`
- Independent verdict: `PASS / FAIL / HOLD`
- Validator evidence reference: `________________________________`
- Validator signature/approval and timestamp: `________________________________`

## Secret & Credentials Guardian — separate control record

- Guardian identity: `________________________________`
- Guardian dual-authorization reference: `________________________________`
- Production-secret custody boundary acknowledged: `YES / NO`
- Secret values exposed to release evidence: `NO / YES — STOP and record incident: ____________________`
- Metadata-only telemetry reference: `________________________________`
- Secret statuses reviewed (`CONFIGURED/MISSING/INVALID/ROTATION REQUIRED`): `________________________________`
- Guardian acknowledgement and timestamp: `________________________________`
- Current protected metadata snapshot reference: `________________________________`
- Public/Hetzner telemetry status independently confirmed: `YES / NO`
- Custody/rotation history current for this release: `YES / NO`

## Machine Auth — separate control record

- Machine identity safe reference: `________________________________`
- Credential safe reference (no secret/token): `________________________________`
- Contract: `m2m-client-credentials.v1`
- Scope confirmed exactly `acp:read`: `YES / NO`
- Company-bound read-only route evidence: `________________________________`
- Credential expiry/revocation evidence: `________________________________`
- Request/correlation/audit event evidence: `________________________________`
- Raw secret/token material recorded: `NO / YES — STOP`
- Machine control acknowledgement: `________________________________`
- Current connected-Turn Machine evidence reference: `________________________________`
- Historical evidence accepted only as context, not current proof: `YES / NO`

These sections do not approve deployment. They provide evidence and control boundaries for Guardian and Machine, separately from Command Lead authorization, Independent Validator verdict and release-executor completion.

## Release executor completion

- Workflow run ID: `________________________________`
- API image digest: `________________________________`
- Web image digest: `________________________________`
- Deploy result: `PENDING`
- Post-deploy checklist: `PENDING`
- Connected Turn Browser evidence: `PENDING`
- Final Command Lead verdict: `PENDING`
