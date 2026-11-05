# M4 Machine E2E Rescue Journal

- Date: 2026-10-30
- Scope: controlled local Machine end-to-end gate only
- Strategy: parallel with journals; separate M4 verdict, shared mandate/correlation lineage
- Production, 5174 and PID 18972: untouched

## Preserved PASS evidence

- API TypeScript: PASS.
- `test/machine-auth.e2e.spec.ts`: PASS, 8/8.
- `test/turn-operational-truth.service.spec.ts`: PASS, 5/5.
- `test/governance-v2-hardening.spec.ts`: PASS, 8/8.
- TURN journal view contract: PASS.

## Recovery attempts

1. Checked local runtime ports. PostgreSQL `agm-development-postgres` is healthy on `127.0.0.1:55432`; API `127.0.0.1:3100` is not listening.
2. Checked the documented development environment. `development.env.example` exists; `development.env` is absent.
3. Retried the affected Jest route directly with `--runTestsByPath`, `--runInBand`, `--forceExit`, and `--watchman=false`. The three affected suites completed PASS; the pnpm wrapper had delayed/no output and was not used as the verdict.
4. Did not fabricate credentials, connect Production, or write to an unidentified database.

## Current result

`M4 = PASS · CONTROLLED_LOCAL_E2E`.

After creating the isolated `agm_m4_e2e` database, applying the candidate migrations, seeding one development-only owner and using an in-memory-only local configuration, the endpoint E2E passed. The completed mandate lifecycle was `STARTED → WORKING → COMPLETED`; the controlled negative lifecycle was `STARTED → WORKING → FAILED`; both were persisted and read back from Turn. Evidence: `evidence/turn-reality/p0-agent-runtime-live/execution-endpoint-e2e.json`.

The E2E initially exposed and the candidate fixed a workspace-root resolution defect that produced `apps/api/apps/api/...` for the inspector evidence reference. The fix is in `apps/api/src/agent-runtime-events/agent-runtime-events.service.ts`.

## Bounded next action

No Production action is authorized by this journal. The local E2E closure is complete; Production lifecycle, expiry/revocation and post-deploy Turn linkage remain separate release gates.
