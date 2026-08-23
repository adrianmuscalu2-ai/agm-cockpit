# TURN P0 — First Real Agent Production E2E

Checked at: 2026-08-23 12:31 Europe/Berlin  
Production URL: `https://app.agmcockpit.com/turn`  
Result: `PASS`

## Release identity

- Web session restoration commit: `dcc368a4716beaf0db61a1b96d684ee7a430c678`
- P3 portable evidence-root fix: `c5a5f9ce3c90d331ae06f49ee44f9016874dbac1`
- Production workflow: `32633708661` — `success`
- Web bundle: `assets/main-Cwh110LA.js`
- Clean-build and Production SHA-256: `678A1A6B0CA5E9C59A8BBA6134664C6FF5DD091AE5C8D35833EC3C1072B67FFB`

## Production runtime proof

The authenticated Turn control activated the real `agent-inspector` executor through the existing P3 path. Lifecycle events were persisted through the API/EventStore-backed `AgentRuntimeEvent` source and polled by the live Turn panel.

### Successful real inspection

- Mandate: `turn-production-completed-mt5o0pvc-9f1c247a`
- Agent: `agent-inspector`
- Input evidence: `apps/api/runtime-evidence/agent-inspector-acceptance.json`
- Observed lifecycle in Turn: `STARTED → WORKING → COMPLETED`
- Terminal detail: `Inspection completed with verdict PASS.`

### Real failure path

- Mandate: `turn-production-failed-mt5o0q3l-cce1c9bd`
- Agent: `agent-inspector`
- Input evidence: `apps/api/runtime-evidence/agent-inspector-missing.json`
- Observed lifecycle in Turn: `STARTED → WORKING → FAILED`
- Terminal detail: expected filesystem `ENOENT` for the deliberately absent evidence reference.

### Persistence and live state

- Connection label after execution: `LIVE · PERSISTENT`
- Both mandate identifiers remained visible after a full page reload.
- `COMPLETED` remained present after reload: `PASS`
- `FAILED` remained present after reload: `PASS`
- No lifecycle state was inserted manually or derived from the declarative registry.

## Root-cause repair exercised by Production

The first Production attempt emitted `EVIDENCE_REF_OUTSIDE_ROOT` because the evidence containment check used the Windows-only `\\` separator inside the Linux Production container. The check now uses `node:path.relative()`, `node:path.sep`, and `node:path.isAbsolute()`; the same Production evidence then completed with verdict `PASS`.

## Gates

- P3 TypeScript build: `PASS`
- API test suites: `41/41 PASS`
- API tests: `209/209 PASS`
- API build: `PASS`
- GitHub Actions verify/publish/deploy: `PASS`
- Production `/health/live`: `ok` twice
- Production `/health/ready`: `ready` twice
- Database dependency: `available`
- Runtime event contract: `agent-runtime-events.v1.3`

## Final chain

`REAL EXECUTOR → P3 → PERSISTENT API/EVENT SOURCE → TURN LIVE PANEL → RELOAD PERSISTENCE = PASS`

