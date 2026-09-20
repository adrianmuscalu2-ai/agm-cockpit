# Deterministic release certification recovery journal

## Scope

- Production freeze remained active.
- No rerun, push, deploy, Production mutation, secret mutation, or environment mutation was executed.
- Base SHA: `558f5c067fb9d13a9b07a8a6e709369702daf2b2`.
- Work was isolated on local branch `fix/deterministic-release-certification`.

## Recovery route

`IAB PROBE ONCE -> OPTIONAL EVIDENCE OR PLATFORM LIMITATION -> CONTROLLED AGM PLAYWRIGHT/CHROMIUM -> EVIDENCE -> CLOSURE`

- Browser Plugin Status: PASS (controlled runner callable).
- Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE (`SESSION_ATTACHMENT_MISSING`).
- Browser Session Status: PASS (isolated Playwright/Chromium session).
- Target Page Status: PASS (production Web build served by Vite preview).

## Before-fix proof

The original simulation passed because stale user-session requests were rejected immediately. The strengthened tests keep those requests in flight while the Owner session is restored.

- Runtime test: FAIL, TURN admin requests `0/3` while stale user requests are unresolved.
- Production-build Browser reload test: FAIL with `LINGUISTIC_HEARTBEATS_INCOMPLETE_0_OF_3`.
- At the heartbeat deadline: document complete, visible, session stored, TURN command center present, no page errors.
- Exact ordering defect: `bindPremiumLinguisticAgentHeartbeats()` serializes the new TURN-authorized publish behind `currentPublish` from the stale user transport.

## Attempts excluded from accepted evidence

- The first Vite development-server attempt failed on a CommonJS named-export incompatibility. It was discarded because it did not represent the Production bundle topology.
- A production-preview run without a stalled stale transport passed 3/3. It proved the existing test did not exercise the race and was not accepted as reproduction evidence.

## Changes and validation

- Minimal runtime correction: an authority change replaces the in-flight stale publication, captures the TURN transport, and fences stale completion from clearing the replacement.
- Strengthened runtime test reproduces `0/3` before the correction and proves immediate `3/3` after it without releasing the stale user requests first.
- Production-build Browser test reproduces `LINGUISTIC_HEARTBEATS_INCOMPLETE_0_OF_3` before the correction and passes the same stalled-transport scenario after it.
- After-fix heartbeats: IT/ES/SV each HTTP `201`, `ONLINE`, shared contract valid, component sum valid, `errors=0`.
- Duties: 3/3 `COMPLETED`; independent validation `PASS`.
- Negative control: `DENIED`, duty `FAILED`, zero independent validations.
- Persistent projection simulation: 27 total, 27 active, zero red nodes, zero regressions across the preserved 24-node baseline.
- Workflow is split into `deploy`, `deployment-health`, `post-deploy-certification`, and `production-agent-runtime-browser`.
- Browser certification uses `always()` after successful deployment health, collects live evidence even when post-deploy certification fails, then fails closed in its final aggregate verdict.
- YAML parser: PASS. Structural phase test: PASS.
- API regression evidence: 544 tests passed in the initial run; one suite could not compile because the local Copilot Control Plane build artifact was absent. The dependency is built before tests in the canonical verify workflow. After building it locally, the affected suite passed 1/1. Aggregate: 545/545 PASS.
- Shared/API/Web builds: PASS.
- TURN operational truth UI, functional overview, and agent accountability contracts: PASS.
- Public deployment-health read-only probe: API live `200`, API ready `200`, Web basic `200`, Web TURN `200`; certification remained explicitly `PENDING` for that probe.

No Production rerun, push, deploy, restart, secret mutation, environment mutation, or workflow dispatch was executed.
