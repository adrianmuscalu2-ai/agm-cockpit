# AGM TURN — Minimal Telemetry and Real Agent Runtime — Production Verification

Date: 2026-08-23

Final revision: `6b44607` (`fix(turn): keep live polling within api budget`)

Canonical Web route: `https://app.agmcockpit.com/turn`

Android route: `https://localhost/turn`

Android device: Samsung SM-S931B (`RFCY70WDHXK`)

Android package: `com.agm.cockpit` version `1.3.0` (`versionCode=21`)

## Final verdict

`PASS`

The validated P3 → EventStore/API → Turn execution path remains operational. The minimal component telemetry layer is live in Production and distinguishes verified health from unavailable evidence without inventing positive states.

## Release identity

- Web bundle served by both Android and the canonical Production domain: `/assets/main-49_jW9Y9.js`.
- Pages deployment containing this bundle: `https://6fa9d033.agm-cockpit.pages.dev`.
- Canonical custom domain probe: HTTP 200 at `https://app.agmcockpit.com/turn`; rendered AGM application and the Turn PIN gate.
- Android APK: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`.
- APK size: `66,478,569` bytes.
- APK SHA-256: `F0929FFD6E5345FA8877BF2B44C310AD5EB0C3E4BA0217DBED9F7D4F4F861990`.
- Installation: `adb install -r` PASS; package update time `2026-08-23 14:58:03` local time.

## Minimal telemetry — runtime result

| Component | Operational state | Target | Freshness | Incident | Runtime evidence |
|---|---|---|---|---|---|
| Android | `ONLINE` / agent `ACTIVE` | `HEALTHY` | `LIVE`, heartbeat age 0–3s | `NONE` | Persistent tenant-bound foreground heartbeat, 30s cadence, stale after 90s; observed response 134–199ms |
| Secret & Credentials Guardian | `READY` / agent `ACTIVE` | `HEALTHY` | `LIVE`, age 0s | `NONE` | Authenticated metadata-only health; `session-signing`, `database-connection`, `translation-provider`, and `turn-administration` all `CONFIGURED` |
| Telemetry | `READY` / agent `ACTIVE` | `HEALTHY` | `LIVE`, age 0s | `NONE` | Minimal operational layer: health + heartbeat + freshness; no analytics |
| Server Backup | `PLANNED · LOCAL BACKUP DEFINED · LIVE HEARTBEAT NOT CONNECTED` | `UNKNOWN / NO TELEMETRY` | `UNKNOWN` | `NONE` | Local PostgreSQL backup architecture is defined; release/timer and restore gate are not runtime-verified; off-site target is not configured |

Server Backup is therefore not classified as a confirmed failure or as a configured live service. Its Turn state is explicit and non-ambiguous: planned capability, no live heartbeat, no incident.

The Guardian card retains the historical last failure `2026-08-23 14:49:20 · RATE_LIMITED`, while its current state is `READY / HEALTHY / LIVE` and its current successful checks are newer. This is intentional last-failure history, not an active incident.

## Real agent acceptance — Production Android

The existing Turn control `Rulează verificarea reală` invoked the real `agent-inspector` executor. No lifecycle state was inserted manually.

Successful mandate:

- mandate: `turn-production-completed-mt5tqj4i-6328b5e9`
- `STARTED` at `2026-08-23T13:09:35.666Z`
- `WORKING` at `2026-08-23T13:09:36.019Z`
- `COMPLETED` at `2026-08-23T13:09:36.376Z`
- input evidence: `apps/api/runtime-evidence/agent-inspector-acceptance.json`
- result: `Inspection completed with verdict PASS.`

Controlled negative mandate:

- mandate: `turn-production-failed-mt5tqj6o-e79c789a`
- `STARTED` at `2026-08-23T13:09:36.730Z`
- `WORKING` at `2026-08-23T13:09:37.082Z`
- `FAILED` at `2026-08-23T13:09:37.436Z`
- input evidence: `apps/api/runtime-evidence/agent-inspector-missing.json`
- failure: expected `ENOENT` for the intentionally missing evidence file.

The Turn current-state element changed without navigation or manual refresh. After an explicit page refresh, both mandate IDs and their lifecycle events remained visible, proving persistence through EventStore/API. The refreshed Android state remained:

- Android: `ONLINE / HEALTHY / LIVE`, heartbeat age 0s;
- Guardian: `READY / HEALTHY / LIVE`;
- bundle: `/assets/main-49_jW9Y9.js`.

## API health

- `GET https://api.agmcockpit.com/api/v1/health/live` → HTTP 200, `status=ok`, service `agm-api`.
- `GET https://api.agmcockpit.com/api/v1/health/ready` → HTTP 200, `status=ready`.
- Ready dependencies: database `available`; translation provider `configured`.

## Static and regression gates

- Web TypeScript: PASS (`tsc --noEmit`).
- Minimal component telemetry contract: PASS.
- Turn `LIVE / STALE / UNKNOWN / OFFLINE` reconciliation contract: PASS.
- P3 registry/runtime: PASS, 15/15; lifecycle events 14, Turn reflections 7, cleanup attestations 7.
- Android Gradle clean build: PASS.
- Production real-agent lifecycle and persistence after refresh: PASS.
- Incident semantics remained unchanged: neutral `PLANNED`, `UNKNOWN`, and telemetry history did not create false incidents; current verified healthy states remained incident-free.

## Browser validation fields

- Browser Plugin Status: `PASS`.
- Integrated Browser Control Status: `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE` (`SESSION_ATTACHMENT_MISSING`).
- Browser Session Status: `PASS` — controlled AGM Playwright/Chromium route.
- Target Page Status: `PASS` — HTTP 200, canonical URL rendered, bundle `/assets/main-49_jW9Y9.js` confirmed.
- Browser preflight visual signature: `C0D4D181839D64C935207B00576ACC47F74A04601B4816625F0D118555EE48DE`.

## Rescue journal

1. Production browser probe initially returned `ERR_NETWORK_ACCESS_DENIED` inside the restricted session. Classification: session/network restriction, not product. The same read-only controlled probe was rerun through the approved network route and passed with HTTP 200 and the correct bundle.
2. API health probes initially could not connect inside the restricted session. The approved read-only route returned HTTP 200 for both live and ready.
3. A supplementary local Browser E2E runner stopped before agent execution because its generated Prisma client expected a `prisma://` datasource while the repository `.env` correctly uses PostgreSQL. Regeneration was blocked by the two active AGM API replicas holding the Prisma engine DLL. No service was stopped and no product code was changed for this supplementary runner. The decisive Production Android E2E was then executed directly and passed end-to-end, including persistence after refresh.

## Evidence captures

- `2026-08-23-final/production-turn-final.png`
- `2026-08-23-final/android-turn-final-full.png`
- `2026-08-23-final/server-backup-final.png`
- `2026-08-23-final/android-final.png`
- `2026-08-23-final/telemetry-final.png`
- `2026-08-23-final/security-final.png`
- `2026-08-23-final/p3-turn-live-final.png`
- `2026-08-23-final/p3-turn-after-refresh-final.png`

## Closure

## Final user-tab synchronization

At `2026-08-23T15:27:35+02:00`, the user's actual Chrome tab was inspected at `https://app.agmcockpit.com/turn?telemetry=3076a52`. It was serving the current bundle `/assets/main-49_jW9Y9.js`, but its in-memory view was still showing the initial `CONNECTING` state and a persisted stale `Android OFFLINE` value. The existing `Actualizează` action followed by a real page refresh reconciled the same tab with the live sources.

The final visible state in the user tab is:

- P3 live connection: `LIVE · PERSISTENT`;
- Android: `ONLINE`;
- Secret & Credentials Guardian: `READY`;
- Telemetry: `READY`;
- Server Backup: `PLANNED · LOCAL BACKUP DEFINED · LIVE HEARTBEAT NOT CONNECTED`;
- persisted real `STARTED / WORKING / COMPLETED / FAILED` events visible in Turn.

No architecture, runtime, telemetry, registry, Incident Engine, or Production release implementation was reopened. This was a final view-state reconciliation on the already validated build.

`SERVER BACKUP — PLANNED / NOT ACTIVE / NO LIVE HEARTBEAT`

`AGM TURN MINIMAL TELEMETRY — PRODUCTION PASS`

`FIRST REAL TURN AGENT E2E — PRODUCTION PASS`

`AGM TURN — RUNTIME VERIFIED / PASS`
