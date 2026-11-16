# AGM 1.9.1 functional closure candidate — 16 November 2026

This is an evidence-backed local correction, not Production acceptance or a new release procedure.
Use the existing Production roles, gates, workflow and Luna handoff instructions.

## Baseline and preservation

Production Web/API: `14da4cc394c1340936299d362e97e66cc22e1e63` (PR35).
Its Git tree equals existing worktree HEAD `89335750a41360abe48dbe98de88145436c32568`.
The historical root remains on `8286f0e8981c2b8c4a26b97f8f0ca30839789db3`, with its pre-existing changes preserved.
No new branch/worktree/version/database was created. No Production mutation was performed.

Baseline report and all raw evidence:
`D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence/AGM-1.9.1-PRODUCTION-FUNCTIONAL-AUDIT.html`.
Current evidence directory: `D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence/functional-closure-20261116`.

## Correction

The periodic duty runner wrote runtime receipts directly, bypassing ACPM. New duty invocations now emit
STARTED and terminal observations with the actual registry kind, the existing module/department grouping,
the mandate and the persisted output reference/hash. CMI observations wrap actual queries, not historical replay.
Registry kinds CONTROL_PLANE, GUARDIAN, SERVICE and GATEWAY are represented explicitly in ACPM.
No model, capacity, historical lifecycle or transfer is inferred. Legacy rows remain untouched and visibly incomplete.
The new observations are separate measurements linked to existing receipts; legacy receipt counts are not unique invocation counts.

An unavailable ACPM sink cannot prevent Guardian checks or monitoring duties from running, change their verdicts,
or grant authority. Observer failure counters and incomplete observations expose the instrumentation failure.
Guardian, secret custody, RK, Governance authorization and TURN authentication code are unchanged.

Authenticated `GET /agmatcc-copilot/control-status` reports configuration readiness for the current TURN family.
It never grants activation, verifies spending capacity, reserves money or calls a provider. The existing reservation
path remains authoritative for target, immutable handoff and cumulative budget. The UI checks this status before
requesting a response and explains unavailable controls. ACPM 401/403 messages distinguish OWNER from TURN access.

## Verification and limits

- Real existing rehearsal PostgreSQL: STARTED/terminal pairs from CMI and an ACP failure; hashes, journal references,
  kinds and departments independently reread using a second client. Failure stays FAILED. Fixtures retained and labelled.
- Real existing rehearsal accounts: normal OWNER login and TURN unlock; OWNER ACPM 200, TURN-to-ACPM 401,
  OWNER-to-Commander 403, TURN control-status and historical search 200. No guard overrides or account provisioning.
- Controlled Chromium: real login, unlock, ACPM render and disabled-Luna diagnostic; zero provider requests.
- Targeted regression, accounting, budget and binding tests; explicit Guardian noninterference tests.
- Full API suite, API/Web builds, source lint and secret scan results are in the consolidated HTML/JSON evidence.

Production remains PARTIAL: zero new ACPM observations, disabled Luna, no imported handoff and no current-commit
Version/PCR record at the read-only observation. The 139 Governance event digests/links and 21 stream versions
are consistent. External RK payloads, Production human sessions, current microphone/STT/TTS and all producer paths
are not recertified. The 10,000-observation read cap remains explicit; incomplete history cannot certify comparisons.

## Bounded continuation through existing gates

1. Obtain the independent validator's acceptance of the exact candidate; no self-approval or synthetic actor binding.
2. Turn Commander authorizes the change window/promotion under `deploy/production/OPERATIONAL_ROLES.md`.
   Use the canonical workflow and existing PCR path; do not redeploy the old release merely to repeat its launch.
3. Refresh pre-change backup/artifact evidence in that window. This patch adds no migration, version bump or destructive rollback.
4. Reconcile the existing deployed release record append-only with PR35/build43766447801 evidence; no backdated approvals.
5. For Luna, follow `LUNA_ACPM_LOCAL_INTEGRATION.md`: retain the frozen source budget; verify and import the existing
   handoff receipt, bind a legitimately authenticated Commander family, then explicitly enable the existing provider.
   Receipt hash: `bb0cd21c21b23fa5278c82da512c2ba9d94802d4510af4506be3caf5d46a245e`;
   carried debit: 1,375,650 nanodollars (USD0.00137565); original ceiling USD5, never reset.
6. Perform only affected post-promotion tests: fresh ACPM lifecycle/receipt reads, legitimate OWNER/TURN reads,
   and a bounded Luna E2E after authorization. Retain failed attempts, existing journals and all historic evidence.

## Recovery journal

- PowerShell blocked pnpm.ps1; existing pnpm.cmd succeeded. No policy change or installation.
- Browser host absent; native Chrome AX unavailable and capture timed out. Fresh window selection/minimal capture
  also timed out. Optional human-session observation unavailable; controlled Chromium remains the approved route.
- First read-only probe had string escaping/schema-column errors; corrected from repository schema. Transactions read-only.
- HTTP fixture initially expected login200; real contract returns201. Corrected assertion, no auth change.
- First controlled browser lacked its dynamically allocated CORS origin. Bound the exact local origin before bootstrap;
  second run passed. Failed capture/report retained.
- Initial noninterference fixture had Jest mock tuple typing errors; corrected fixture, affected tests passed.
- Older ACPM harness depends on an absent worktree-relative baseline snapshot. No speculative installation or historical
  journal recovery; current core regression and real PostgreSQL/HTTP tests provide explicitly scoped evidence instead.

RESCUE RECOVERED for local runtime/test configuration; HANDOFF TO ATLAS with Production approval and legitimate-session
gates outstanding. No product HOLD is attributed to absent IAB.

## Credential lifecycle V3 continuation (same PR36)

The subsequent TURN Commander mandate explicitly authorizes implementation of preventive
credential renewal and ACP monitoring. It does not waive the Production environment,
Guardian custody or formal candidate acceptance gates. The original 764-test evidence
and frozen manifest remain valid for their original source; the incremental tests below
cover this additional change. No Guardian/RK source, identity, scope or role is changed.

Root cause: the one-day V2 credentials were successfully rotated, published and used on
14 November, then expired on 15 November. The six-hour continuity workflow renews mandates,
not credentials. Existing ACP monitoring did not query credential expiry. Both the validator
and recovery executor are affected; their exact identities remain intact.

The existing Production Release workflow now has a six-hour maintenance trigger and a
`credential_maintenance_only` dispatch input. Maintenance skips verification/build/deploy
jobs and retains the existing Production environment gate, SHA-bound OIDC provisioning
role, SSH transport and root-only Guardian store. The continuity role still cannot rotate.
The canonical release OIDC contract admits `schedule` for that exact workflow only;
repository, environment, ref, signature, tenant and deployed SHA checks remain mandatory.
Scheduled initiation is not a promise of unattended renewal while approvals are pending.

`production-credential-maintenance.py` only renews the two existing inspector/executor IDs
when at most 12 hours remain. It requires their latest principal bindings, exact approved
mandate keys/modes/scopes with at least one day remaining, unchanged scopes, a fixed running
container and the deployed revision/database. It uses the normal canonical rotation API,
not administrative SQL writes. A process lock spans observation, rotation, custody and
authentication. Existing custody bytes remain intact; versioned additions use O_NOFOLLOW,
0600 ownership checks, inode/content checks, a lock and fsync. New secrets stay on the host.
An ambiguous HTTP result stops without retry. Failed publication revokes the new credential
through the existing API; the already revoked old version is never called a rollback.
Latest-credential custody mismatch stops for reconciliation instead of rotating blindly.

ACP's existing control-plane duty now observes the latest credential metadata without
reading secret hashes. It emits deduplicated append-only warning, escalation and recovery
receipts in the existing AuthorityAuditJournal. Recovery requires actual usage of the new
credential; issuance alone is not authentication. A 12-hour warning fails readiness until
renewal, so operational PASS no longer masks a pending credential expiry. Noncanonical
tenants without these identities are explicitly outside this production capability scope.

Incremental evidence is under `D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence/rotation-v3-20261116`:
real rehearsal PostgreSQL rotation, expired/old credential denials, new JWT/access validation,
warning/escalation/recovery persistence and concurrent deduplication; Linux isolated custody
fixtures; real PostgreSQL latest-binding regression; OIDC, ACP and Guardian noninterference
regressions; API build and typecheck; existing release/SSH contract checks.
Fixtures and failed attempts are retained. No new paid Luna call is required.

Bootstrap remains a distinct operational gate: current Production14da does not contain this
new maintenance job. Before formal validator adoption, obtain a genuine existing authorized
provisioning/owner authentication route and Guardian custody authorization for initial V3.
Do not run the old a70/V1-pinned administrative adapter unchanged, remove its guards, fabricate
OIDC, or deploy an unapproved candidate just to acquire maintenance authority. Once approved
and deployed, use the maintenance-only action and verify actual V3 custody/authentication,
ACP receipts and public build identity before declaring Production PASS.
