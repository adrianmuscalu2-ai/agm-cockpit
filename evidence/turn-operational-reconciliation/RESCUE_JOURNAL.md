# TURN operational truth — rescue and continuation journal

Status: `TECHNICAL PIPELINE PASS / TURN FUNCTIONAL COMPLETENESS FAIL / PRODUCT OWNER ACCEPTANCE NOT GRANTED`

Source revision: `b769c38c979d5218545550fa98e348ef4866de83`

## Mandate

Replace registry-derived and static-green TURN status with a traceable runtime
projection backed by the complete chain:

`MACHINE IDENTITY → CREDENTIAL → TOKEN → AUTHENTICATED ACP READ → TELEMETRY → EVENTSTORE → API → TURN → UI`

The UI may display `ACTIVE`, `DEGRADED`, `FAILED`, or `UNKNOWN` only with a
current observation, source, timestamp, and evidence reference. Registry
metadata alone is rendered as `REGISTRY ONLY` or `WAITING FOR LIVE PROBE`.

## Preserved evidence

- M2M Production PASS remains frozen at `b2a342f` and GitHub Actions run
  `33811781066`.
- The existing Browser, Android, Translator, and canonical-library verdicts
  were not reopened.
- The main workspace and its unrelated dirty changes were not modified; all
  mandate work was isolated in `.tmp/release-m2m-20260903`.

## Recovery journal

1. `pnpm` initially resolved to the PowerShell wrapper and was rejected by the
   host ExecutionPolicy. Classified `DEFECT DE CONFIGURARE`; `pnpm.cmd` was the
   installed equivalent and all requested tests executed successfully. No
   installation or policy mutation was performed.
2. The first controlled local Browser attempt used the already-built
   Production bundle. Its embedded public API calls were denied by the sandbox,
   while the local fixture endpoint itself returned HTTP 200. Classified local
   probe configuration; the next attempt used Vite with an explicit local API
   base. Evidence: `browser/local-2026-09-04T05-36-24/report.json`.
3. The next attempt reached `data-turn-agent-live="pass"`, but the mandatory
   legal first-run overlay intercepted the refresh click. The runner was
   corrected to accept the legal notice through the real product control.
   Evidence: `browser/local-2026-09-04T05-38-40/report.json`.
4. The tutorial overlay then intercepted the same click. The runner was
   corrected to dismiss the tutorial through the real product control.
   Evidence: `browser/local-2026-09-04T05-40-06/report.json`.
5. The first unobstructed audit found a real product defect: TOKEN, API, TURN,
   and UI could be marked successful without a displayed evidence reference.
   The projection now binds TOKEN to scope/contract, API to the response
   digest, TURN to the persisted event id, and UI to contract version plus
   generation timestamp. The PASS predicate now checks all nine steps.
   Evidence: `browser/local-2026-09-04T05-41-29/report.json`.
6. Minimal retest after the fix: focused API tests PASS, Web operational-truth
   contract PASS, Web build PASS, and controlled Chromium audit PASS.
7. Final regression on source revision `b769c38`: 60 API suites / 351 tests
   PASS; API lint PASS; API build PASS; Copilot control-plane build PASS; Web
   build PASS; TURN live-state contract PASS; canonical public route PASS.

## Browser gate

- Browser Plugin Status: `PASS`
- Integrated Browser Control Status:
  `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE`
  (`SESSION_ATTACHMENT_MISSING`; no serving `codex-computer-use` process)
- Browser Session Status: `PASS — CONTROLLED PLAYWRIGHT/CHROMIUM`
- Target Page Status: `PASS — LOCAL DYNAMIC TARGET`
- Visual signature: `DCD4257D0C90F3207F4A9FE39FA9E5594E0C3F1B06E493D7E973620CE00E0C1E`
- Decisive local evidence:
  `browser/local-2026-09-04T05-45-49/report.json`

The decisive report is explicitly marked
`LOCAL_CONTROLLED_UI_PROOF_ONLY`; `productionPass` is `false`. It proves UI
rendering and interaction against a deterministic contract fixture. It does
not replace the required Production deployment, live API projection, or
Production Browser audit.

## Superseded candidate handoff

- Recovered capability: local controlled Browser validation and complete
  nine-step evidence rendering.
- Local release-candidate verdict: `PASS`.
- Remote mutation: none. `origin/agm-canonical-20260820` remains at `b2a342f`.
- Authority gate: the push of the candidate to the canonical branch was denied
  because it automatically triggers a consequential Production deployment.
- One bounded next action: after explicit Product Owner approval, push the
  validated candidate fast-forward to `agm-canonical-20260820`, monitor the
  Production workflow through deploy and TURN/M2M smoke, run the dedicated
  Production controlled Browser audit, and record the final verdict.

The candidate handoff above was closed after the Product Owner granted explicit
approval for the push, the Production deployment, and the bounded deploy-job
rerun used to refresh the live observation.

## Production completion and recovery continuation

8. Commits `b769c38` and `b639ec3` were pushed fast-forward to
   `agm-canonical-20260820`. GitHub Actions run `33888999046` completed with
   `verify`, `publish`, `publish-web`, and `deploy` all PASS.
9. The initial Production deploy emitted both decisive markers:
   `TURN_OPERATIONAL_TRUTH=PASS` and `M2M_PRODUCTION_LIFECYCLE=PASS`.
10. The first Production browser invocation was denied network access by the
    local sandbox (`fetch failed`). Classified `DEFECT DE RUNTIME/SESIUNE`; the
    unchanged audit was rerun once with approved network access.
11. The network-enabled audit reached the live API at HTTP 200 / PASS but found
    the legitimate Turn administrative PIN boundary before the monitored UI
    was mounted. No PIN guess, reset, read, or mutation was attempted. The
    controlled runner was updated to stub only the administrative session
    validation endpoint, while the Production page bundle and operational-truth
    API remained canonical and live.
12. Because the authenticated M2M observation expired during the authorization
    pause, Product Owner explicitly approved a minimal rerun of only the
    `deploy` job for the same SHA and immutable image digests. Attempt 2, job
    `101138092756`, completed PASS in 1m43s and emitted:
    `TURN_OPERATIONAL_TRUTH=PASS` at `2026-09-04T18:54:35Z` and
    `M2M_PRODUCTION_LIFECYCLE=PASS` at `2026-09-04T18:54:36Z`.
13. The next controlled browser attempt proved the live UI state but exposed a
    runner timing race: the legal overlay mounted after asynchronous admin
    session restoration and intercepted the refresh click. The runner now
    accepts/dismisses legal and tutorial overlays again after UI mount.
14. The affected minimal retest completed PASS against the canonical Production
    URLs. The live observation was 117 seconds old, all nine evidence steps were
    present, eight UI API responses were HTTP 200, `falseGreen=0`,
    `unexplainedDegraded=0`, unjustified displayed statuses were zero, static
    green count was zero, and page errors were zero.

## Final Browser gate

- Browser Plugin Status: `PASS`
- Integrated Browser Control Status:
  `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE`
  (`SESSION_ATTACHMENT_MISSING`)
- Browser Session Status: `PASS — CONTROLLED AGM PLAYWRIGHT/CHROMIUM`
- Target Page Status: `PASS — PRODUCTION CANONICAL TARGET`
- Evidence scope: `PRODUCTION_LIVE`
- Production pass: `true`
- Decisive report:
  `browser/2026-09-04T18-56-32-785Z/report.json`
- Controlled access boundary: session validation stub only; Production PIN was
  not read or modified.

## Final handoff to Atlas

- Source revision: `b769c38c979d5218545550fa98e348ef4866de83`
- Deployed evidence revision: `b639ec3fbbc9843cfc456766f69c8d3fc9a92590`
- Production workflow: `33888999046`, attempts 1 and 2 PASS.
- Technical verdict: `RELEASE_PIPELINE = PASS`,
  `M2M / OPERATIONAL TRUTH INFRASTRUCTURE = PASS`,
  `FALSE_GREEN_PREVENTION = PASS`.
- Product verdict: `TURN FUNCTIONAL COMPLETENESS = FAIL`,
  `PRODUCT OWNER ACCEPTANCE = NOT GRANTED`,
  `FINAL_PRODUCTION_PASS = RETRACTED`.
- Residual limitation: integrated interactive Browser evidence was unavailable;
  the official controlled Playwright/Chromium runner PASS is sufficient under
  the permanent Browser validation runbook.

## Product Owner verdict correction

The Product Owner accepted the demonstrated technical results but explicitly
rejected `FINAL_PRODUCTION_PASS` as a product verdict. The Browser and runtime
evidence proves truthful infrastructure and false-green prevention; it does not
prove that TURN provides a complete, useful, actionable operational picture.
The next mandate is restricted to the remaining Basic/Premium functional value,
real data sources, Product Owner actions, resolvable UNKNOWN states, and
legitimate UNKNOWN boundaries.
