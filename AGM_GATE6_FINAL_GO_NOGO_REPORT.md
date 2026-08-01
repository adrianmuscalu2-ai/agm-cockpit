# AGM Gate 6 final GO / NO-GO report

Date: 2026-07-28
Mode: read-only technical and documentary re-audit
Verdict: **GO / READY**

## Scope and conservation

The final re-audit reviewed Gates 1–5, remediation sub-gates 6A–6D, the combined
consistency report, artefact identity, Production procedures and document integrity.

No API container or systemd unit was started or enabled. No deployment, image build,
image transfer, backup/restore, migration, DNS/Cloudflare change, PostgreSQL access
or Production infrastructure modification was performed.

## Gate status

| Gate | Final accepted result |
|---|---|
| Gate 1 | PASS / REMEDIATED |
| Gate 2 | PASS / REMEDIATED |
| Gate 3 | PASS / REMEDIATED |
| Gate 4 | PASS / REMEDIATED |
| Gate 5 | PASS / REMEDIATED |
| Gate 6A | PASS / REMEDIATED |
| Gate 6B | PASS / REMEDIATED |
| Gate 6C | PASS / REMEDIATED |
| Gate 6D | PASS / REMEDIATED |
| Gate 6 final consistency | PASS |

Historical FAIL/NOT READY reports remain audit history and are superseded by their
explicit remediation-completion reports.

## Initial Gate 6 blockers and closure

### Obsolete rollback identities

Closed by Gate 6A. The principal runbook now uses:

- API `agm-production-api`;
- Hetzner PostgreSQL `agm-postgres`;
- Hetzner volume `app_agm_postgres_data`;
- network `app_default`.

### Unassigned operational authority

Closed by Gate 6B:

- Command Lead: Turn Command Center;
- Independent Validator: AGM Inspector;
- Fallback Responsible: Release & Operations / PC Fallback Custodian;
- Rollback Responsible: Atlas/Codex Technical Executor.

Authorization, execution and independent validation are separated.

### Incomplete pre-change and routing rollback

Closed by Gate 6C. The approved procedure:

- uses one stable Production tunnel and hostname;
- transitions connector/origin ownership without a DNS change;
- prohibits simultaneous Windows and Hetzner Production connectors;
- defines mandatory evidence capture, SP0–SP5 and abort triggers;
- restores the Windows connector as fallback;
- requires live evidence capture in the authorized execution window.

### Unresolved data and migration readiness

Closed by Gate 6D:

- PC `agm-postgres` / `agm_agm_postgres_data` remains the pre-cutover operational
  source;
- Hetzner `agm-postgres` / `app_agm_postgres_data` is the empty target;
- the controlled sequence is dump, transfer, restore, migration 4→5, reconciliation,
  connector transition and single-writer declaration;
- dual-write, automatic reverse synchronization and ad-hoc repair are prohibited;
- rollback rules distinguish whether Hetzner has accepted a Production write.

## Artefact traceability

Read-only Docker inspection confirms:

- tag: `agm-api:staging-9956eb1`;
- Image ID:
  `sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`;
- RepoDigest:
  `agm-api@sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`;
- OCI revision:
  `9956eb188fdd988bf0d7af93241c3c43962d9b39`;
- runtime user: `node`;
- startup command runs `prisma migrate deploy` before the API;
- image size: 160,512,083 bytes.

The approved artefact remains unchanged.

## Document integrity

| Evidence | SHA-256 |
|---|---|
| Gate 1 completion | `64f3d65b341e24942fbbf273b553e937bf16afe4a251aeb6ee751fbc25a4c076` |
| Gate 2 completion | `904f300699d7d47480faca8d31882047582ae8372ace157296fd8e699ba8a4b2` |
| Gate 3 completion | `a4380565afcbf83840dfc9cb6889ee70be311e64a26dde93d2c4480dd89b03aa` |
| Gate 4 completion | `c2e5f9356c221a0b12f2355dfb0a6e0943679ffe1ea06a009bd75da0724c9a8f` |
| Gate 5 completion | `d5cd1e49483b87d4aa6479aa872ed14ad0cac41692ef2467d28a2df23ba48780` |
| Gate 6A report | `aacc56a129dbde321f79d7ffdc2f5777c635e68f043565b6af83fe014d0a5178` |
| Gate 6B report | `f0dfefc6944555a4e05ca0201edd468cf54fa6287b8479a3f3b9ef24b93a62e9` |
| Gate 6C report | `3ceb6a15a19326345667844f8b3c1c790860669729ec8aeb4835a29484a9c187` |
| Gate 6D report | `d70d29c097297ff80624d09fcfb2b27b901b347d0b15e22dd6b75a90b2ba7d69` |
| Final consistency | `513cab1385ab5a4be9bddd2db572b82cce881268320a7d0f6ac791814da02402` |
| Rollback runbook | `45e279a010abc6fc74280dc9d2108bd56ef1ce0ceb06c3aac1612bbdbd074cd5` |
| Operational roles | `8f793c781ccbf7bfcb473bd1c4638bdafb2718c7fe29f6892173fe309c9eb508` |
| Connector rollback plan | `626aa8c9c6c7624b697a535d0e7ae7a7fa8d4a1db3007cf1037e81573ad26756` |
| Pre-change checklist | `c8d8f20f863bf5e7a73f366cbb9148ab5633dc96933660eae75560c302ec061a` |
| Data/migration plan | `07e2b8851268e0187a1355f0efd37aac6168421e167aac1207cb4ff0f9f3c0ac` |
| Production Compose | `d846006a6b24711976d3b5503d400323de125f073b0a42e1f604a15e410d4448` |
| API systemd unit | `52873bfe099b8e1cdeb2a243956b43b47eb08223c3bc4ac2a780c53660500c94` |
| Post-deployment checklist | `df0742abf8110d8cc60306b617c0f90a52061896dbb6a06588f5783bcd473ce3` |

The observed hashes match the approved Gate 6A–6D values. `git diff --check` passed
for the audited set.

## Final system-coherence assessment

- one official Hetzner API, PostgreSQL container and volume are defined;
- PC and Hetzner database identities are host-qualified and not conflated;
- secrets remain under Secret & Credentials Guardian authority;
- data readiness precedes routing transition;
- single-writer and single-active-connector controls agree;
- rollback is safe both before and after the first Hetzner write;
- Validation remains separate from Production;
- no DNS change or tunnel migration is required;
- every missing or failed execution-window check produces STOP/NO-GO.

No unresolved contradiction, overlapping authority, configuration conflict or
uncontrolled emergent interaction was identified.

## Conditions preserved for the deployment window

GO / READY does not waive live pre-change controls. Before any state change:

- on-duty identities and distinct sessions must be recorded;
- the complete pre-change checklist must pass;
- the approved image must be loaded and independently reverified on the target;
- the restored-Production-copy rehearsal must pass;
- source/target backups and checksums must pass;
- write freeze and single-writer controls must pass;
- every migration and reconciliation check must pass.

Any unchecked item or mismatch is an automatic NO-GO for the execution window.

## Official final verdict

Gate 6 is closed **GO / READY**.

The system is prepared to enter a separately authorized controlled deployment
workflow. This verdict does not authorize image transfer, deployment, service
activation, data freeze, backup/restore, migration, connector transition,
DNS/Cloudflare change or any Production infrastructure modification.
