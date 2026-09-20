# Release certification Owner-session rebind rescue journal

## Scope and frozen evidence

- Production was not modified during this recovery.
- Deployed Production SHA remained `010c0329e25a953f31bcad430fd15882e4197919`.
- Production Release run `35542569615` had deployment, deployment health, and browser operational truth PASS.
- Live Production runtime remained 27/27 GREEN; this PASS evidence was preserved and not retested by mutation.
- The failing certification step reported `LINGUISTIC_HEARTBEATS_INCOMPLETE_0_OF_3`.

## Root cause

`apps/web/src/main.ts` rendered and bound shared transports while
`adminAccessVerified` was still false, then restored the Owner session
asynchronously. Successful restoration updated the authority state but relied on a
conditional TURN-page render to replace the user-session heartbeat transport.
There was no direct, guaranteed Owner-session-to-transport handoff before release
certification observed heartbeat traffic.

The deployed Web asset was byte-identical to the local Production build for the
deployed SHA, excluding a stale or mismatched Web artifact.

## Before-fix reproduction

The new regression assertion was applied before the product correction and failed
with:

`Owner session restore must rebind the TURN heartbeat transport before its conditional render.`

Its source slice showed authority state assignment followed by conditional render,
without a direct heartbeat rebind. This matches Production run `35542569615`, where
Owner unlock and session acquisition succeeded but zero linguistic heartbeat
requests were observed.

## Minimal correction

- Extract the existing heartbeat binding into
  `bindPremiumLinguisticHeartbeatsForCurrentAuthority()`.
- Reuse that helper from the normal shared binding path.
- Invoke the same helper immediately after successful Owner-session restoration,
  before the conditional TURN-page render.
- Preserve all TURN authorization, session rotation, endpoint, contract, mandate,
  identity, Guardian, security, and workflow semantics.

## Local recovery evidence

Three fresh controlled-browser cycles passed at:

- `2026-09-20T23:18:33.502Z`
- `2026-09-20T23:19:25.677Z`
- `2026-09-20T23:19:59.117Z`

Each cycle passed the mandatory browser preflight route and then demonstrated:

- Owner session restored and stored;
- explicit TURN heartbeat transport binding;
- IT, ES, and SV heartbeat requests observed (3/3);
- HTTP 201 and ONLINE for all three;
- shared contract version/digest/components valid;
- `errors=0`;
- linguistic duties COMPLETED and independent validation PASS;
- persistent projection 27/27, red nodes 0, FINAL PASS;
- negative control DENIED;
- zero regressions in the preserved 24-agent baseline.

Per-run machine-readable evidence was retained outside the Git tree under
`C:\tmp\agm-certification-rebind-run-{1,2,3}` so generated timestamps do not widen
the immutable candidate.

## Minimal retests

- TURN operational truth UI contract: PASS
- linguistic authority rebind: PASS (`immediateAdmin=3`, `nextAdminCycle=3`, stale transport not reused)
- TURN auth continuity: PASS (five rotation cycles and reload continuity)
- Web Production build: PASS
- TURN functional overview contract: PASS
- agent accountability contract: PASS
- release phase separation: PASS (`deploymentTruthSeparated=true`, browser runs after certification failure)
- Production SSH transport validator: PASS (5/5 invocations secured)

## Handoff boundary

The safe recovery boundary is a locally committed immutable RC with a clean
worktree. No push, workflow rerun, deploy, secret change, Environment change, or
Production mutation is authorized by this journal.
