# TURN operational truth — rescue and continuation journal

Status: `RECOVERED LOCALLY / HANDOFF TO ATLAS / PRODUCTION AUTHORITY PENDING`

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

## Handoff to Atlas

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
