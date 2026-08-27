# AGM publication audit — 2026-08-27

## Verdict

**NO-GO for publication in the current repository state.**

The application builds, the CI-equivalent API test suite passes, the controlled Browser fallback passes, the public `/basic` route renders correctly, and the dependency/secret checks found no known release blocker. Publication is still blocked by release traceability, a broken lint gate, incomplete Wave 1 Browser coverage, and incomplete release governance/documentation.

Audit revision: `6bdb27835ffcad4168b7ce44fa3bd5d12652397d`  
Branch: `agm-canonical-20260820`

## PASS evidence

| Gate | Result | Evidence |
|---|---|---|
| Copilot control-plane build | PASS | `pnpm --filter @agm/copilot-control-plane build` |
| API build | PASS | `pnpm --filter @agm/api build` |
| Web production build | PASS | `pnpm --filter @agm/web build`; Vite built 266 modules |
| API tests in CI-equivalent environment | PASS | 49/49 suites; 273/273 tests |
| Diff whitespace check | PASS | `git diff --check`; line-ending warnings only |
| Dependency audit | PASS | `pnpm audit --prod --audit-level high`: no known vulnerabilities |
| High-confidence secret scan | PASS | No OpenAI/GitHub token or private-key pattern found in tracked/worktree source scope |
| Root `.env` tracking | PASS | `.env` is not tracked; tracked production env exposes only `VITE_AGM_API_BASE_URL` and `VITE_DASHBOARD_WARNING_VISION_ENABLED` keys |
| Version alignment | PASS | root package, Web package, Android `versionName`, and public APK link are `1.3.0`; Android `versionCode` is 21 |
| Controlled local Browser fallback | PASS | `evidence/turn-state-reconciliation/browser/2026-08-27T06-28-16-647Z/report.json` |
| Public canonical Browser probe | PASS | HTTP 200, Browser session PASS, target PASS, 699.646 ms; `.tmp/public-release-audit/2026-08-27T06-29-08Z/browser-public-after.json` |
| Public AGM Basic route | PASS | HTTP 200, title `A.G.M. Cockpit`, `#app=1`, three quick languages, no page errors, no horizontal overflow; `.tmp/public-release-audit/2026-08-27T06-29-08Z/browser-public-basic.png` |

## Browser gate

```text
Browser Plugin Status: PASS
Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE
Browser Session Status: PASS
Target Page Status: PASS
Probe: dynamic local /turn navigation + reload + capture; public /basic navigation + capture
```

The first official Wave 1 runner attempt and one changed-condition retry both failed before the Wave 1 scenarios because `page.goto(..., waitUntil: "networkidle")` exceeded 30 seconds. Host detection, HTTP target discovery, and isolated Chromium bootstrap passed in both runs. The approved controlled fallback using `domcontentloaded`, explicit DOM conditions, interaction, reload, and capture passed.

Recovery journal:

1. PowerShell blocked `pnpm.ps1`; classified `DEFECT DE CONFIGURARE`; recovered with `pnpm.cmd`.
2. IAB exact selection attempted once; backend absent; classified optional platform limitation, with no install/retry.
3. Wave 1 controlled runner failed at initial `networkidle` navigation.
4. Same runner retried once with network permission; identical failure, so the path was not repeated again.
5. Existing controlled fallback `validate-turn-state-reconciliation-browser.mjs` passed all 11 checks and produced a screenshot/report.

## Blocking findings

### P0 — release snapshot is not traceable

- Working tree contains 85 tracked changes and 439 untracked entries.
- The release checklist requires a clean working tree.
- The untracked `NUL` entry breaks normal recursive audit tooling on Windows and must be removed or renamed safely before the final scan.

Required closure: define the exact publication scope, remove generated/transient files from release scope, commit the approved source, and rerun the gates against the immutable commit.

### P0 — lint gate is broken and CI does not enforce it

- `pnpm --filter @agm/api lint` fails because ESLint 9 cannot find `eslint.config.js|mjs|cjs`.
- The Production workflow runs API tests/build and Web build but does not run lint.

Required closure: add/migrate the flat ESLint configuration (or pin a compatible supported configuration path), make lint pass, and add lint to the Production `verify` job.

### P0 — Wave 1 release scenarios remain PENDING

- `pnpm audit:wave1-browser` failed twice before its language, Translator, Email, OCR, and responsive scenarios executed.
- The controlled fallback proves Browser control and the Turn surface, but it does not convert unexecuted Wave 1 scenarios to PASS.

Required closure: repair the Wave 1 runner's readiness strategy (for example, `domcontentloaded` plus explicit stable-DOM assertions), then run the Wave 1 command once and preserve its report/screenshots.

### P0 — mandatory Production governance is not completed

- `deploy/production/PRE_CHANGE_CHECKLIST.md` still pins an older image digest and OCI revision `9956eb188fdd988bf0d7af93241c3c43962d9b39`, not this audit revision.
- The same checklist states that any unchecked mandatory item is an automatic NO-GO.
- No Change ID/window, separate deployment mandate, independent validator, rollback responsibility, or updated immutable identities were evidenced in this audit.

Required closure: create an approved release record for the final immutable commit/image and complete the pre-change checklist. This audit does not authorize deployment.

### P1 — release documentation is not updated for the current change set

- `CHANGELOG.md` and `TECHNICAL_CHANGE_REPORT.md` are not modified in the current worktree despite 85 tracked source/config changes.
- The release checklist requires both documents to be updated.

Required closure: document the final scope, behavior/security changes, migration impact, rollback, and known limitations.

### P1 — public root route needs an explicit product decision

- `https://app.agmcockpit.com/` returns HTTP 200 but the stabilized screenshot contains only `POC 02` (`bodyTextLength=6`).
- `https://app.agmcockpit.com/basic` renders the complete AGM Basic surface and passes the controlled visual probe.

Required closure: confirm whether the public root intentionally remains the POC 02 landing state. If AGM Basic is the publication entrypoint, route/redirect the root accordingly or document `/basic` as the canonical published URL.

## Publication closure sequence

1. Freeze and commit the approved release scope; clean the worktree, including `NUL` and transient outputs.
2. Repair lint and enforce it in Production CI.
3. Repair and pass the official Wave 1 Browser matrix.
4. Update CHANGELOG and technical release documentation.
5. Generate and approve the immutable image/revision plus Production pre-change record.
6. Rerun this audit on the final commit; only then issue GO/READY.

