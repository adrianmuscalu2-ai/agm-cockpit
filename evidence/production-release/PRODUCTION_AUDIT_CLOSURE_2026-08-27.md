# AGM Production audit — consolidated closure report — 2026-08-27

## Final verdict

**NO-GO**

```text
BROWSER RECOVERY = PASS
PRODUCTION AUDIT = CLOSED WITH BLOCKERS
WAVE 1 = PASS
GENERAL RELEASE = NO-GO
```

The technical defects in lint, Wave 1, documentation, the `NUL` artifact, and the candidate's canonical route are closed with local evidence. General release is not authorized because the working tree is not a clean reviewed commit and the candidate route has not been deployed: the current public root still serves the older POC entry.

## Blocker evidence matrix

| # | Area | Root cause | Change/evidence | Result |
|---|---|---|---|---|
| 1 | Working tree | Accumulated mixed source, evidence, build artefacts, and scratch state had no single release boundary. | Classified by root, size, and release risk in `WORKING_TREE_CLASSIFICATION_2026-08-27.md`; preserved all unknown material; no tracked deletes/renames. | **FAIL / release blocker** — classified, not clean. |
| 2 | Lint | ESLint 9 had no flat config; after configuration it exposed 37 actual TypeScript safety/unused findings. | Added `apps/api/eslint.config.mjs`, corrected explicit types and unused code, and added lint to Production CI. | **PASS** |
| 3 | Wave 1 Browser | `networkidle` was incompatible with persistent runtime traffic; hard page navigation also cleared intentionally ephemeral `sessionStorage`; Vite wrapper cleanup orphaned child servers; initial UI readiness raced the legal overlay. | Replaced with `domcontentloaded` + AGM UI readiness/stable DOM, SPA navigation, controlled transient UI dismissal, cross-platform direct Vite lifecycle, and final controlled run. | **PASS** — 31/31 checks. |
| 4 | Documentation | Changelog/report were stale; checklists pinned an old digest/revision and assumed five migrations while 20 migration directories exist now. | Updated changelog, technical report, release checklist, pre/post checklists, cutover plan, rollback runbook, restore rehearsal, workflow identities, and dynamic OCI revision. | **PASS** |
| 5 | `NUL` | Three PowerShell curl calls used `--output NUL`; in this context curl created a normal root file containing the diagnostic JSON response. | Preserved 50,010 bytes as real-timeout evidence, verified SHA-256 unchanged, replaced all three outputs with controlled temporary files. | **PASS** |
| 6 | Canonical public route | Production server served `/index.html` at `/`, and the web build injected a global `POC 02` link. | Candidate server now returns 308 `/` -> `/basic`; Home moved to `/home`; build injection removed; real local HTTP test passes. | **PASS in candidate / FAIL deployed** — public `/` still returns 200 with POC HTML. |

## Changes performed

- Restored a rule-enforcing ESLint 9 flat configuration and corrected the flagged API types.
- Added lint, canonical route, Browser preflight, and Wave 1 validation to the Production workflow.
- Repaired and hardened the Wave 1 runner without treating recovery-only evidence as scenario PASS.
- Made `/basic` canonical, `/home` the explicit Home route, and `/` an HTTP 308 redirect in the candidate server.
- Removed the `POC 02` build-time shell injection.
- Added `pnpm audit:canonical-route` with a real static-server probe.
- Replaced stale release identities/counts with workflow/manifest-bound values.
- Preserved and remediated the accidental Windows `NUL` artifact.
- Updated all requested release documents and recorded evidence manifests.

## Commands and results

| Command/check | Result |
|---|---|
| `pnpm --filter @agm/api lint` | PASS |
| `pnpm --filter @agm/api build` | PASS |
| `pnpm --filter @agm/api test -- --runInBand` with non-production dummy env | PASS — 49/49 suites, 273/273 tests |
| `pnpm --filter @agm/web build` | PASS — 266 modules |
| APP-001 navigation contract | PASS |
| SR-01 single web build definition | PASS |
| `pnpm audit:canonical-route` | PASS — local `/` 308 to `/basic`; `/basic` 200 |
| `pnpm rescue:browser-preflight` immediately before final Wave 1 | PASS gate; IAB session attachment recorded as optional platform limitation, controlled runner required |
| `pnpm audit:wave1-browser` | PASS — exit 0, 31 checks, nine languages, persistence, Translator, Email, OCR, 1440/1024 no-overflow |
| `pnpm audit --prod --audit-level high` | PASS — no known vulnerabilities |
| High-confidence secret scan | PASS — zero private-key/OpenAI/GitHub token patterns in source scope; root `.env` not tracked |
| `git diff --check` | PASS — line-ending warnings only |
| Public HTTP probe at 2026-08-27 08:55 UTC | FAIL for candidate parity — `/` 200, `/basic` 200, root HTML still contains `data-poc02-entry` / `POC 02` |

## Browser evidence

```text
Browser Plugin Status: PASS (accepted recovery evidence)
Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE
Browser Session Status: PASS (controlled Chromium)
Target Page Status: PASS
Wave 1 scenarios: PASS
```

Final evidence is under `wave1-browser-2026-08-27T08-49-58-777Z/`. The report and 14 captures were copied from the temporary runner output without deleting the source; `MANIFEST.md` records representative hashes.

## `NUL` evidence

- Preserved file: `evidence/governance/copilot-v1.2/p9/real-timeout-investigation/recovered-orphan-20260814T043043Z-batch-001.json`
- SHA-256: `A91AAD97F957D6349DB4A1E2B61BA4F0461486D3DDED70EAED0BFFDF8A76E6BE`
- Root special-name file after relocation: absent
- Custody report: `RECOVERED_NUL_ARTIFACT_2026-08-27.md`

## Final working tree

- Branch: `agm-canonical-20260820`
- HEAD: `6bdb27835ffcad4168b7ce44fa3bd5d12652397d`
- Tracked changed: 110
- Untracked files: 4,891
- Compact status entries: 550
- Tracked deletions: 0
- Tracked renames: 0
- Status: **not clean**

No release commit was created because that would assert review and ownership over the large pre-existing mixed change set. No unknown evidence/scratch material was deleted or broadly ignored.

## Final route

- Candidate canonical route: `https://app.agmcockpit.com/basic`
- Candidate root behavior: HTTP 308 `Location: /basic`
- Candidate Home route: `/home`
- Currently deployed root: HTTP 200 with the old `POC 02` injection

## Conditions required to change NO-GO to GO

1. Review and commit the classified release-source scope; execute an approved retention decision for preserved scratch/evidence so the audited HEAD is clean.
2. Run the Production workflow for that immutable commit and record API/Web digests and exact migration manifest.
3. Complete the approved pre-change roles/window and deployment mandate.
4. Deploy, then prove public `/` = 308 `/basic`, `/basic` = 200, image/revisions/migrations/health are exact, and rerun controlled Browser validation against the deployed route.

Until all four conditions pass, **GENERAL RELEASE = NO-GO**.
