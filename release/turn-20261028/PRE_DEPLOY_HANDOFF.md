# Turn release — pre-deploy handoff

Status: `NO-GO / NOT DEPLOYED`
Prepared from candidate worktree: `C:\Users\adria\Documents\AGM-CANONICAL-CANDIDATE-20261022`
Branch: `phase3-rc-preparation`
HEAD: `SOURCE_COMMIT_PENDING_MANIFEST_FINALIZATION`
Deploy executed: `NO`
Candidate commit: `SOURCE_COMMIT_PENDING_MANIFEST_FINALIZATION`; push: `NOT EXECUTED`

## Deployment target and procedure

The documented target is the `Production` environment through
`.github/workflows/production-release.yml`. The workflow is triggered only
from `main` or `agm-canonical-20260820`, or by an authorized
`workflow_dispatch`. This candidate branch is not an eligible release ref in
the current state. No change ID, release commit, workflow run, UTC window,
identities, or acknowledgements were invented.

The exact deploy target, approved ref, change ID, UTC window, and release
executor must be supplied or confirmed through the project procedure before
execution.

## Intended included change set

The current mandate changes are the Turn spatial presentation and the
validated `Înapoi sus` interaction. The relevant changed/untracked paths are
listed in `RELEASE_SUMMARY.md` and hashed in `RELEASE_MANIFEST.json`.

The worktree also contains pre-existing or historical local material, including
safe-shutdown files, browser evidence, and other uncommitted application
changes. Because there is no candidate release commit or staging boundary, an
exact deployable inclusion set cannot yet be certified without risking
accidental inclusion. No files were removed, reset, cleaned, checked out, or
overwritten.

## Verification evidence

Passed locally:

- `pnpm.cmd --filter @agm/web exec tsc --noEmit` — exit 0.
- `pnpm.cmd --filter @agm/web exec tsx scripts/test-agent-accountability.ts` — PASS.
- `pnpm.cmd --filter @agm/web exec tsx scripts/test-turn-module-navigation.ts` — PASS.
- `node scripts/validate-pwa-release-contract.mjs` — PASS.
- `node scripts/validate-turn-operational-ui.mjs` — PASS.
- `pnpm.cmd exec tsx scripts/test-speech-semantics.ts` — 12/12 PASS.
- Controlled preview evidence on `http://127.0.0.1:5175`: spatial models visible,
  selection works, back-to-top works after scrolling, mobile width has no
  horizontal overflow, no JavaScript errors, and zero external requests.

Browser evidence is preview-only and DEMO / NON-AUTHORITATIVE. It is not
evidence of Production runtime behavior, Guardian controls, Machine lifecycle,
or post-deploy correctness.

Blocked:

- `pnpm.cmd --filter @agm/web build` compiled shared and library packages, then
  stopped in `validate-production-api.mjs` because
  `apps/web/.env.production` is absent. No production configuration or secret
  was created or copied.
- `git diff --check` reported no whitespace errors; the only output was the
  repository's LF/CRLF conversion warning for existing tracked files.

## Release gates still open

`RELEASE_MANIFEST.json`, `PRE_CHANGE_CHECKLIST.md`, and `APPROVAL_FORM.md`
remain authoritative for the gate state. Current mandatory items still
`MISSING`/`PENDING` include:

- reviewed candidate release commit and eligible release ref;
- immutable build/image digests and workflow run;
- deployment mandate/change ID/UTC window and named executor;
- current Guardian protected-metadata snapshot, Production telemetry,
  custody/rotation evidence, and dual-authorization acknowledgement;
- current Machine identity/reference and connected-Turn Production lifecycle
  evidence for provision/issue/use/rotate/revoke/rejection, expiry/revocation,
  and audit correlation;
- independent validator confirmation;
- post-deploy health, auth, Turn, Browser, rollback-package, and final
  certification evidence.

Evidence is not absent. `evidence/governance/modules/OPS-004/operations/AGM-INC-20260805-PRODUCTION-RECOVERY/PRODUCTION_RECOVERY_STATUS_20260806.md` records Guardian `CONFIGURED`, metadata-only telemetry and Production Preflight `READY`, 8/8 PASS, while also explicitly recording `INCIDENT OPEN / AUTHORIZATION BLOCKED / NO PASS / NO CLOSED`. `evidence/turn-reality/minimal-telemetry/PRODUCTION_VERIFICATION_2026-08-23.md` records Guardian `READY / HEALTHY / LIVE`. For Machine/Turn, `evidence/turn-reality/p0-agent-runtime-live/PRODUCTION_E2E_2026-08-23.md` records historical authenticated lifecycle PASS; `evidence/rescue/deterministic-release-certification-2026-09-20/RESCUE_JOURNAL.md` records M2M/release sequencing with certification explicitly PENDING; and `evidence/agent-accountability/browser/2026-09-27T09-48-49-979Z/report.json` records failover transfer PROVEN but overall operational truth FAIL with related `NO_TELEMETRY`. These are present historical or limitation evidence, not current-release proof. The current-release items remain to be refreshed and independently confirmed.

## Risks

- The worktree is dirty and contains both current Turn work and pre-existing
  local material; no release boundary exists yet.
- Production API configuration is intentionally unavailable locally, so the
  full web release build and production validation cannot be certified here.
- Guardian and Machine current-release evidence is not yet refreshed/independently confirmed; historical and limitation evidence is present as listed above.
- Historical Production execution evidence records a stopped/rolled-back
  attempt; it is not a current PASS.
- The preview is isolated and intentionally disconnected from real API/data;
  its DEMO / NON-AUTHORITATIVE labels must remain intact.

## Rollback

Use the documented rollback in `ROLLBACK_PLAN.md` and the workflow's
revision-bound rollback package. Release & Operations must preserve the prior
immutable release/configuration and database backup before any change. On any
health, readiness, auth, Guardian, Machine, Turn, or Browser failure, stop the
release and execute rollback under the documented Rollback Responsible role.
Do not improvise secret access: Guardian remains the secret custodian and
Machine evidence must remain metadata-only.

## Exact action required before deploy

The user/Command Lead must provide or confirm, in the project approval form:

1. the approved candidate commit/ref and exact inclusion boundary;
2. change ID, UTC deployment window, target environment, and named release
   executor;
3. the current non-secret Guardian and Machine evidence listed as `MISSING`,
   or explicitly route each item to its named provider for completion;
4. Command Lead authorization and rollback acknowledgement; and
5. independent-validator read-only confirmation of the completed checklist.

The release executor may then run the normal workflow only after all gates are
recorded. Deploy and post-deploy verification remain intentionally unexecuted;
therefore no PASS is declared.
