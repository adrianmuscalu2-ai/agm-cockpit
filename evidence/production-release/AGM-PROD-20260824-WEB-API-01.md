# AGM Production Change Record — AGM-PROD-20260824-WEB-API-01

## Mandate

- Authorized by: AGM Command Lead (user), 2026-08-24
- Scope: coordinated Web + API Production release, including Android/Turn telemetry verification
- STOP/rollback channel: current Codex conversation
- Scope exclusions: no provider-secret disclosure, no architecture redesign, no database restore unless rollback is required

## Preflight and validation

- Production preflight: READY
- API tests: PASS — 267/267
- API build: PASS
- Web build: PASS
- Persistence migration contract: PASS
- Secret-pattern scan of staged release: PASS — no matches
- Release worktree: isolated from the user's dirty working tree

## Before-state / rollback anchor

- API image: `ghcr.io/adrianmuscalu2-ai/agm-cockpit-api@sha256:3ef344840ba2365fd1e2a1eedc20f034d468fdc35f595463f8188d5abec8e761`
- Web image configuration: `agm-web:turn-status-taxonomy-20260822`
- Services before release: API ACTIVE, Web ACTIVE, PostgreSQL HEALTHY
- Workflow rollback captures the active service units, release environment, compose file, exact images and a verified PostgreSQL custom-format dump before restart.
- Automatic rollback trigger: any API/Web restart, readiness, route, image-identity or public-bundle validation failure.

## Required minimal post-release evidence

- API readiness/live HTTP PASS
- Authority Control Plane route present (authenticated boundary; unauthenticated `401`, not `404`)
- Public Web serves the new release image and new Car Mover route bundle
- `/car-mover/menu` exposes the six operational modules
- Android Premium does not expose Authority Control Plane; protected Turn receives it only after administrative unlock
- Android component heartbeat is persisted, tenant-bound and reflected in Turn telemetry
- No secret value is displayed or logged

## Roles

- Command Lead: user
- Technical release executor / rollback responsible: Codex in the authorized release session
- Independent evidence: automated API gate, Production preflight, controlled Browser runner and Android runtime probe
- Operational fallback: `agmops` release path with the captured pre-release images and service units

## Status

`INITIAL RELEASE OWNER-REJECTED / CORRECTIVE RELEASE PASS / ROLLBACK READY / ROLLBACK NOT INVOKED`

## Production execution

- Release branch: `agm-canonical-20260820`
- Minimal release commit: `d3f8c0644077dedc2ba83b09e2354092f47a74c3`
- Web image correction: `11cd7501561b8287515181b09abf1406a46191c6`
- GitHub Actions run: `32775531288`
- Verify: `PASS`
- API image publication: `PASS`
- Web image publication: `PASS`
- Production approval and deployment: `PASS`
- Production deploy job: `97586224924` — `success`
- API image active: `ghcr.io/adrianmuscalu2-ai/agm-cockpit-api@sha256:a41a5d2d104d63028fbe33674643d126733326a3ded134fb9cd503a2e558ba8d`
- Web image active: `ghcr.io/adrianmuscalu2-ai/agm-cockpit-web@sha256:d99fbdd6f28a7e68c2eef52c12933a13b02b40503a84432c4a16c6e08db17b91`
- Rollback database dump: `/opt/agm/production/rollback/32775531288/database.dump`
- Public Web: HTTP `200`, active bundle `/assets/main-CXk0u6WR.js`
- API readiness: HTTP `200`
- Authority boundary: HTTP `401` without authentication, proving the route is deployed and protected rather than absent (`404`)

## Minimal post-release retest

- Controlled Browser navigation: `PASS`, 15 checkpoints.
- `/premium -> /car-mover`: `PASS`.
- `/car-mover/menu`: exactly six operational module paths, `PASS`.
- All six pages, Menu/HERO returns, OCR and Voice access, Premium Copilot and Premium microphone reuse: `PASS` desktop/mobile.
- Browser Plugin Status: `PASS`.
- Integrated Browser Control Status: `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE`.
- Browser Session Status: `PASS` through the controlled AGM Playwright/Chromium runner.
- Target Page Status: `PASS`.
- Browser evidence: `evidence/car-mover/navigation-path/2026-08-24T21-05-10-929Z/report.json`.

## Android Premium and Turn telemetry

- Physical Android device: Samsung `SM_S931B`, package `com.agm.cockpit`.
- Android Premium dashboard with Authority Control Plane: `FAIL` by Product Owner — the administrative panel was incorrectly exposed in the Premium user surface.
- `GET /api/v1/authority-control-plane/dashboard`: HTTP `200`.
- Authority payload: `25` canonical records, Control Plane `PASS`.
- Historical observation before correction: Android Premium rendered `24` orbit nodes plus the separate Control Plane center. This placement is explicitly rejected and must not be treated as accepted UI evidence.
- Persistent Android heartbeat: `ONLINE`.
- Observed freshness: `LIVE`, age `18s` at the final persistent-store probe.
- Turn source mapping: Android uses `Component heartbeat v1 · persistent și tenant-bound` and the `90s` freshness contract.
- The earlier red Turn card was based on a stale/offline snapshot (`4m53s` in the supplied capture), not the current Android runtime.
- Current visual Turn session reached the legitimate PIN-protected boundary. No PIN, token, local storage, cookie or secret was read or bypassed. Therefore the Android runtime and telemetry path are `PASS`; visual confirmation of the unlocked card is recorded as `PROTECTED SESSION / REFRESH REQUIRED`, not fabricated as a visual PASS.

## Security and rollback closure

- Guardian/provider secrets were not modified.
- Secret values were not displayed, logged or written into evidence.
- Gmail/provider architecture and Opportunity Intelligence Core were not changed.
- The rollback anchor is present and verified; no rollback criterion was triggered.
- Initial release verdict: `FAIL — AUTHORITY CONTROL PLANE EXPOSED IN PREMIUM`.
- Corrective release verdict: `WEB PRODUCTION AUTHORITY VISIBILITY = PASS`.
- Android corrected APK: `BUILT / INSTALLED`; direct unlocked-screen visual retest remains separate because the device was locked and the WebView inspection channel timed out.
- Final verdict: `ANDROID TELEMETRY = PASS`.

## Owner correction and corrective Production release

- Owner correction: Authority Control Plane is an administrative operational panel and belongs only in protected Turn.
- Corrective commit: `8b954ddef8bdf015153df74634bf52c73b773d0a`.
- Corrective GitHub Actions run: `32783789449` — verify, API publication, Web publication and Production deploy `PASS`.
- `/premium`: `Centru Premium`, four user workspaces, zero Authority dashboards, zero technical network details, zero legacy network links.
- `/premium/network`: no administrative dashboard is rendered.
- `/turn`: PIN protection is present and Authority content is not rendered before administrative unlock.
- Controlled unlocked Turn validation: Authority Control Plane `PASS`, 24 peripheral nodes plus one control-plane center, 25 drill-down registry records, responsive desktop/tablet/mobile.
- Production Browser evidence: `evidence/authority-control-plane/production-visibility/2026-08-24T22-27-18-659Z/report.json`.
- Controlled Turn evidence: `evidence/authority-control-plane/browser/2026-08-24T21-53-38-706Z/report.json`.

## Final administrative API boundary hardening

- Final corrective commit: `6ed8fdf560bc5268538fb61440b671baaf86f197`.
- GitHub Actions run: `32786941640` — `success`.
- Verify, full API tests, API build and Web build: `PASS`.
- API and Web image publication: `PASS`.
- Production deploy job `97621125482`: `PASS`.
- Post-deploy API readiness: HTTP `200`; Authority dashboard without authentication: HTTP `401`.
- Production CORS preflight: HTTP `204`; the app origin and both required authorization headers are allowed.
- `GET /authority-control-plane/dashboard` and `GET /authority-control-plane/network-registry` now require both the normal user JWT and `X-AGM-Turn-Authorization` with the dedicated Turn administrative scope.
- A normal user-scoped token is rejected by the operational-scope test; no administrative token is emitted to the Premium surface.
- Final Production visibility evidence: `evidence/authority-control-plane/production-visibility/2026-08-24T23-05-21-711Z/report.json`.
- Final controlled unlocked Turn evidence: `evidence/authority-control-plane/browser/2026-08-24T22-47-01-467Z/report.json`.
- Final Android APK synchronized, built and installed: `PASS`; SHA-256 `05075788175B623F00721BD20AF8A22443ED0A7BE8696BB8219F5B186C498291`.
- Android direct unlocked-screen visual remains `PENDING DEVICE UNLOCK`; no device security boundary was bypassed.
- Device state after final install: lock screen active; AGM process safely started as PID `8808`; a single fresh WebView heartbeat probe timed out with zero observed responses.
- Current Android Turn card must therefore remain `STALE/OFFLINE` until a fresh persistent heartbeat is observed after legitimate unlock; it is not reported as LIVE from build/install evidence alone.

### Android unlocked follow-up — 2026-08-25

- Phone unlocked and AGM foreground runtime confirmed.
- Real Android heartbeat reached Production and returned HTTP `201`; API live and ready probes returned HTTP `200`.
- Android Premium/Turn direct WebView boundary test: `PASS`.
- Premium contains four user workspaces and no Authority/Agent Network administrative content.
- Turn remains PIN protected and exposes no Authority content before administrative unlock.
- The prior stale/offline condition is closed at the backend heartbeat boundary. Visual confirmation of the Android card color still requires a legitimate Turn PIN unlock and refresh; it was not fabricated or bypassed.
- Evidence: `evidence/authority-control-plane/android-unlocked-verification-2026-08-25.json`.
