# AGM accepted logo restoration — rescue and validation journal

## Scope and continuity

- Mandate: restore the Product Owner accepted artwork without reinterpretation.
- Accepted source: `C:\Users\adria\Desktop\AGM\04_Logo\logo1.png`.
- Repository asset: `apps/web/public/images/images/logo1.png`.
- SHA-256 (both files): `e237c15acc1f95da37cbd01401fc7ecd0fbd66fa0993883e3cf6992c795623e5`.
- Natural dimensions: `1536x1024`.
- Frozen prior mandate: commit `aa0c6107542c21b605147ae5d93a2d848fae6b3a`; prior Production PASS was not reopened.

## Root cause

Commit `59943fa5501b9f0b2044ab9131a31865436654f4` replaced the accepted
`/images/images/logo1.png` artwork with square launcher icons on visible Web
surfaces. The binary accepted artwork itself remained unchanged in the
repository.

## Rescue journal

| UTC time | Attempt | Classification | Evidence/result | Decision |
|---|---|---|---|---|
| 2026-09-10T02:38Z | Run Web tests through `pnpm` | Local configuration | PowerShell blocked `pnpm.ps1` by execution policy | Use installed `pnpm.cmd`; no installation |
| 2026-09-10T02:39Z | Run `pnpm.cmd --filter @agm/web test:app-icons` | Local configuration | Isolated worktree had no `node_modules`; canonical dependencies existed in the validated `aa0c610` worktree | Create local junctions to the already validated dependencies |
| 2026-09-10T02:40Z | Minimal dependency-path retest | Recovered | `test:app-icons = PASS` | Hand control back to release validation |
| 2026-09-10T02:40Z | Full Web build | Product validation | PWA logo/hash contract, TURN UI contract, TypeScript and Vite build all PASS | Continue to Browser gate |
| 2026-09-10T02:42Z | Browser audit extension — Home at `/` | Test procedure | Canonical router maps `/` to Basic and `/home` to Home | Correct test route only; no product change |
| 2026-09-10T02:46Z | Browser audit extension — unauthenticated Premium | Test procedure | Entitlement gate correctly routed to Access | Preserve gate; rely on source contract for protected Premium shell |
| 2026-09-10T02:48Z | Controlled AGM Playwright/Chromium audit | Recovered / PASS | 57 checks PASS across 6 TURN viewports plus Home and Pre-Departure; zero page errors | HANDOFF TO RELEASE VALIDATION |
| 2026-09-10T03:13Z | Production run `34431511568` branding matrix | Test runtime race | Deploy, M2M, runtime soak and TURN Production passed; Home and Pre-Departure reported `complete=false` while already exposing the correct `1536x1024` natural dimensions | Diagnose asset and wait semantics before retry |
| 2026-09-10T03:18Z | Direct Production asset and bundle probe | Product evidence / PASS | Asset HTTP 200, 2,276,375 bytes, approved SHA-256; active bundle references `/images/images/logo1.png` and not the replaced square artwork | Product artifact proven correct |
| 2026-09-10T03:22Z | Add deterministic image `load` + `decode()` synchronization and rerun the affected Production matrix | Recovered / PASS | 57/57 checks PASS on `https://app.agmcockpit.com/turn` with the same official Production snapshot | Promote the test synchronization fix and rerun the official workflow |

## Browser gate

- Browser Plugin Status: `PASS`
- Integrated Browser Control Status: `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE`
- Browser Session Status: `PASS`
- Target Page Status: `PASS`
- Controlled report: `evidence/turn-responsive-brand/browser/2026-09-10T02-48-07-053Z/report.json`
- Verdict: `LOCAL LOGO RESTORATION VALIDATION = PASS`

The first Production workflow correctly remained FAIL because the Browser
validator sampled the large image before decoding completed. The permanent
validator fix waits for image load and `decode()`; it does not relax the
accepted hash, dimensions, rendered-size, responsive, or page-error criteria.

## Preserved boundaries

- No agent-runtime classification, evidence, incidents or prior PASS verdicts were modified.
- No Production state was modified by local validation.
- PWA/launcher/favicon assets remain isolated technical icons; the accepted
  `logo1.png` artwork is restored on visible AGM identity surfaces.
