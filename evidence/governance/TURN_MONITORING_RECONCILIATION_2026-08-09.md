# Turn monitoring / historical incident reconciliation

Date: 2026-08-09
Scope: registry and `/turn` presentation only. No infrastructure or product runtime mutation.

## Source and freshness reconciliation

| Card | Source of truth | Classification after reconciliation |
| --- | --- | --- |
| API | Public `health/ready` endpoint | LIVE source; existing ACTIVE / HEALTHY state preserved |
| Browser | Current AGM origin | LIVE source; existing ACTIVE / HEALTHY state preserved |
| AI | `dependencies.translationProvider` from API readiness | LIVE source; existing ACTIVE / HEALTHY state preserved |
| Security | Secret Guardian safe telemetry endpoint | LIVE source; existing ACTIVE / HEALTHY state preserved |
| Telemetry | Monitoring registry | `DEGRADED · MONITORING PENDING`; continuous collector is not implemented, therefore target/freshness are UNKNOWN rather than falsely LIVE |
| Android | Accepted ADB/UI validation evidence | Operational client preserved; continuous telemetry is not configured, therefore agent is DEGRADED and target/freshness are UNKNOWN |
| Server Backup | Infrastructure registry | `BACKUP ENDPOINT NOT CONFIGURED · TARGET UNKNOWN`; no endpoint or target is asserted |

LIVE snapshots expire under the existing freshness contract. A health snapshot older than the configured 90-second window becomes STALE and cannot keep a target HEALTHY. Static unimplemented sources remain UNKNOWN and are not promoted to LIVE.

## Historical Cloudflared incident

Incident `AGM-FU-20260728-CLOUDFLARED-PERSISTENCE` is closed as `validated` on later, stronger evidence:

- `evidence/governance/modules/OPS-004/operations/AGM-CHG-20260801-001/REMEDIATION_REPORT.md` records the persistent unit `/etc/systemd/system/agm-production-cloudflared.service`;
- controlled host reboot occurred at `2026-08-01 06:43:26 UTC`;
- the connector became active automatically at `2026-08-01 06:43:44 UTC`, with `NRestarts=0`;
- API live/ready and the public Browser route returned HTTP 200 after reboot;
- `evidence/governance/modules/OPS-004/v1.0/OPERATIONAL_CLOSURE_DECISION.md` records persistent-unit and automatic-recovery PASS.

The journal keeps the original incident history and appends the validated closure. Its newer official timestamp supersedes a stale locally persisted remediation record without deleting history.

## Verification

- `pnpm.cmd --filter @agm/web test:turn-live-state` — PASS
- `pnpm.cmd --filter @agm/web build` — PASS (TypeScript and production web build)
- `git diff --check` — PASS

No Cloudflare, DNS, Hetzner, Production, Android, database, or backup infrastructure operation was executed.

## Verdicts

- LIVE DATA SOURCES — RECONCILED
- HISTORICAL INCIDENTS — RECONCILED
- CLOUDFLARED PERSISTENCE INCIDENT — CLOSED
- API / BROWSER / AI / SECURITY — PRESERVED
- TELEMETRY — DEGRADED / HONEST
- ANDROID TELEMETRY — DEGRADED / OPERATIONAL CLIENT PRESERVED
- BACKUP ENDPOINT — NOT CONFIGURED / NO FALSE PASS
- NO INFRASTRUCTURE CHANGE

## Controlled Web deployment

- Production preflight: `READY`, 8/8 checks PASS at `2026-08-09T06:16:37Z`.
- Previous Production revision: `turn-reconcile-20260807`.
- Previous image / rollback point: `sha256:e51dc53347c813f7d0db29340cc4a217a9de06c7d85231f6aa939cc107fdbf19`.
- Final Production revision: `turn-reconcile-20260809b`.
- Final image: `sha256:a509678a6ddf0f3b44012facd1294cd09d173def8c87720853491766a5da6646`.
- Public asset: `assets/main-ZnGrUWCE.js`.
- Public/local bundle SHA-256: `BD71BC3C1C5E29ADBE9BD2D5AF56DA045EA3C13E4E8F9551C16EFFA95442C148` (exact match).
- Runtime after activation: running, restart count `0`; public `/turn` HTTP 200.
- API, public Browser and Secret Guardian returned HTTP 200 after deployment; the API readiness payload continued to expose the translation-provider dependency.
- The official `2026-08-09T06:16:37Z` registry-reconciliation event supersedes stale Production browser copies last updated before reconciliation, while preserving the evidence date and complete incident history.
- Public bundle contains the validated Cloudflared closure, honest Telemetry/Android degraded states and unconfigured Backup state; the obsolete Cloudflared `PENDING` text is absent.
- Browser preflight detected the visual-signature change and routed the minimal visual probe to Codex Desktop `iab`, as required by the permanent Rescue route. No product retest was started.

Deployment changed only the pinned Web image/revision required to activate the approved bundle. DNS, Cloudflare routing, API, database, Android and infrastructure topology were not changed.
