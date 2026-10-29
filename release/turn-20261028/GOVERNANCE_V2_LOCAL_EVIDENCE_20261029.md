# Governance V2 controlled-local evidence

Date: 2026-10-29
Environment: `CONTROLLED_LOCAL`
Container: `agm-development-postgres` (`postgres:16-alpine`)
Database: `agm_governance`
Network exposure: local development port `127.0.0.1:55432`

No Production container, database, credential value, JWT or token was read or
modified.

## Schema metadata

- migration: `prisma/migrations/20261029120000_add_governance_v2/migration.sql`
- schema: `agm_governance`
- tables observed: 14
- triggers observed: 43
- governance events after controlled test: 10

## Runtime/persistence test

Source: `AGM-phase1-5-boundary/apps/api/scripts/test-governance-recovery-evidence-controlled.ts`

Observed results:

- valid recovery evidence create: PASS;
- backup/restore PASS record: PASS;
- PARTIAL recovery record: PASS;
- missing ID, digest mismatch, unknown candidate: rejected;
- missing backup SHA and incomplete destroy/restore/startup flags: rejected;
- executor/validator collision: rejected;
- direct SQL insert/delete: rejected;
- read-back: PASS;
- semantic recovery search: PASS;
- historical recovery reconciliation: PASS;
- missing historical provenance: rejected.

The controlled run reported `recoveryCount=4`, `recoveryEventCount=5` and a
ledger digest. The digest is evidence for this disposable local run only; it is
not a Production or official Governance activation verdict.

## Boundary

The local environment proves the runtime, persistence constraints and ledger
controls. It does not designate an official Production Governance environment,
does not create official actors, and does not authorize Production activation.
