# Turn Command Center — Monitoring Department

Date: 2026-07-25
Status: **PASS — READY FOR CHECKPOINT**

## Scope

The Monitoring Department is a separate permanent Turn Command Center unit. It
uses the same source registry and polling engine as Operations Center and UI LIVE.
It does not modify AGM functional modules or the public deployment.

## Agents and sources

| Code | Agent | Responsibility | Status source |
|---|---|---|---|
| MON-001 | Agent Monitorizare Server Principal | Main server availability and latency | Public API `health/live` |
| MON-002 | Agent Monitorizare Server Backup | Backup endpoint presence | Infrastructure registry; endpoint not configured |
| MON-003 | Agent Monitorizare API | API readiness and dependencies | Public API `health/ready` |
| MON-004 | Agent Monitorizare Browser | AGM Browser client availability | Current AGM origin / UI LIVE |
| MON-005 | Agent Monitorizare Android | Android client evidence versus continuous telemetry | Android ADB/UI LIVE registry |
| MON-006 | Agent Monitorizare AI | Translation-provider configuration | `dependencies.translationProvider` |
| MON-007 | Agent Monitorizare Bază de date | PostgreSQL availability | `dependencies.database` |
| MON-008 | Agent Monitorizare Cloudflare / rute publice | Public route availability and latency | `app.agmcockpit.com` |
| MON-009 | Agent Monitorizare UI LIVE | Desktop/Mobile visual audit | `pnpm audit:ui-live` report |
| MON-010 | Agent Monitorizare Incidente | Active/closed/archived incident separation | Reconciled Incident Journal |
| MON-011 | Agent Monitorizare Telemetrie | Continuous telemetry availability | Monitoring registry; pending |
| MON-012 | Agent de Securitate | Access, PIN controls, CORS, routes, logs, captures and critical-file integrity | API ready, CORS, UI LIVE security policy and Git |

Every agent card shows its component, current status, last check, latency, source,
active incident, responsibility, intervention procedure, technical-journal link,
last state change, and recheck action when a real HTTP source exists.

## Security

The Security Agent:

- confirms that Turn is accessible only after PIN authentication;
- records that repeated attempts are controlled by Turn Admin;
- checks API readiness and CORS without reading the credential;
- never renders PINs, keys, tokens, hashes, headers, or response bodies;
- links critical-file integrity to Git and Version Guardian;
- uses the UI LIVE policy that sanitizes URLs and excludes sensitive payloads.

No secret value is included in the monitoring registry, cards, screenshots, or
reports.

## State semantics

- `ONLINE` and `READY` are backed by live HTTP checks.
- `BACKUP ENDPOINT NOT CONFIGURED` is informational and is not an incident.
- `CLIENT ONLINE · TELEMETRY NOT CONFIGURED` distinguishes the operational
  Android client from missing continuous monitoring.
- `MONITORING PENDING` is informational and is not an incident.
- Validated and archived incidents remain in the journal and are excluded from
  active-alert counts.

## Navigation

Turn includes a fixed `Înapoi sus` / Back to top action. It becomes visible below
600 px, returns smoothly to the document start, and uses a safe bottom margin on
Desktop and Mobile so it does not cover the final controls.

## Validation

- Monitoring agents: **12/12**
- Web build: **PASS**
- Browser Shell regression: **PASS**
- TypeScript: **PASS**
- UI LIVE local/public routes: **8/8 HTTP 200**
- Monitoring Desktop: **PASS**
- Monitoring Mobile: **PASS**
- Back to top Desktop: **PASS**
- Back to top Mobile: **PASS**
- Active incidents: **0**
- UI LIVE report:
  `.tmp/ui-live-audit/2026-07-25T18-38-03-307Z/report.md`

## Protection

- Contest baseline: `7670640a7a8cdcd49418bfc85079c33105094d78`
- Public deployment: unchanged
- User media and unrelated untracked files: excluded from the checkpoint
