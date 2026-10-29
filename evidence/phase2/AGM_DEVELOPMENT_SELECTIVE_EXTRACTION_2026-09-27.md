# Phase 2H — AGM-Development audit and selective extraction

## Source

- Archive commit: `04c35b015b545a31263cf25ea8b830a6d7886c13`.
- Archive tree: `b5581f281ca4872f7e840a120e2a86eb79dbf38b`.
- Original source: `development/post-contest` at `9c3b374d319c0de3026484c6400f27c662cd16a6`.
- Archived files: `DEVELOPMENT_ENVIRONMENT_POLICY.md`, `development.env.example`, and `docker-compose.development.yml`.

The archive was decoded and audited without applying it over the Phase 2 worktree.

## Audit result

| Area | Archived state | Current decision |
|---|---|---|
| API bind | `127.0.0.1:3100` | Adopted. |
| Web bind | `127.0.0.1:5174` | Rejected: 5174 is the strict canonical AGM Browser target. Reassigned to `127.0.0.1:5175`. |
| Fitness port | Not documented | Explicitly reserves 5173 and prohibits reuse. |
| PostgreSQL bind | `127.0.0.1:55432` | Adopted. |
| PostgreSQL credentials | Static development password in compose | Replaced by required local env interpolation; no committed credential. |
| Database isolation | Separate container/volume | Adopted with explicit private network and stable isolated names. |
| API/Web services in compose | Absent | Preserved: compose starts PostgreSQL only and cannot publish/deploy. |
| Secrets | Placeholder-only example | Preserved and expanded with separate machine JWT placeholder; `development.env` is Git-ignored. |
| Production endpoints | Prohibited by prose | Enforced by static validator for env and compose. |
| Scheduler | Not pinned | Disabled by default to avoid external actions from development. |
| Stale contest branches/workspaces | Hard-coded | Removed; policy now requires an explicitly recorded baseline and dedicated feature/integration branches. |

## Adopted files

- `.gitignore`: protects the local `development.env`.
- `DEVELOPMENT_ENVIRONMENT_POLICY.md`: current isolation and promotion policy.
- `development.env.example`: current API/M2M/Web/database template with placeholders only.
- `docker-compose.development.yml`: localhost-only PostgreSQL service, isolated network and volume.
- `scripts/validate-development-environment.mjs`: deterministic no-production/no-public-bind boundary.

No Production compose, deploy file, workflow, application source, package dependency, database, or runtime state was changed.

## Validation

- Static isolation validator: PASS.
- Docker Compose parse/config: PASS.
- Compose service inventory: exactly `postgres`.
- Published database bind: `127.0.0.1:55432 -> 5432`.
- API/Web documented binds: `127.0.0.1:3100` and `127.0.0.1:5175`.
- Production mutation paths: 0.
- Evidence secret scan: PASS, 0 findings.
- Diff check: PASS.

Docker emitted a local client warning because the sandbox could not read the user-level Docker config file. Compose parsing and normalized output still completed successfully; no daemon mutation command was run.

## Rejected archive content

- The archived port 5174 assignment, because it conflicts with the active Browser runbook.
- Static database credentials in compose.
- Stale competition workspace and branch names.
- Any interpretation of development compose as Production configuration.

## Verdict

**PHASE 2H PASS — safe development-isolation configuration selectively extracted; no Production capability or mutation path added.**
