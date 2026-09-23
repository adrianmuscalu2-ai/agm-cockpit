# Operational Linguistic Baseline V1 - Local Certification

Date: 2026-09-23

Base SHA: `452e7d0932b7231f1a7bcc9333de473e95357ec2`

Production revision at start: `940cd3c3fa8e0be5cfbdd252295dd4b17b38c57e`

## Verdict

Plan C local implementation and certification: PASS.

Production was not accessed or mutated during local certification.

## Architecture

Read-only TypeScript linguistic resources are audited deterministically by a GitHub Actions workflow. The workflow obtains a GitHub OIDC credential and registers a short-lived publisher. The API verifies repository, environment, workflow, branch, event, deployed SHA, run identity and role before it issues a registration and authority epoch. Evidence passes the strict V1 validator before a Serializable transaction can append evidence, advance typed current state and append a server-generated receipt. Fleet/accountability reads typed V1 state after activation. The Browser only performs an authenticated GET and observes state.

Initial activation is atomic for IT, ES and SV. Steady-state heartbeats are independently locked and validated per component. A failure in one component cannot prevent the other two from advancing.

Trust classification:

- server-issued: publisher registration, authority epoch, expiry, acceptance timestamp, receipt and state revision;
- server-verified: writer identity/version, build revision, workflow reference, run ID/attempt, authority role, tenant and active mandate;
- client-observed but strictly validated: observation timestamp, operational state, resource counts and immutable catalog digest.

API boundary:

- `POST /api/v1/operations/turn/operational-linguists/publishers`
- `POST /api/v1/operations/turn/operational-linguists/heartbeats`
- `POST /api/v1/operations/turn/operational-linguists/activation`
- `GET /api/v1/operations/turn/operational-linguists/state`

## Persistence and fencing

The migration creates typed, tenant-scoped `OperationalLinguistBaseline`, `OperationalLinguistPublisher`, `OperationalLinguistEvidence`, `OperationalLinguistState` and `OperationalLinguistReceipt` tables. Accepted evidence and receipts are append-only. Current state references accepted evidence and is protected by explicit sequence, epoch, idempotency/hash checks, PostgreSQL Serializable transactions and advisory locks.

After V1 becomes ACTIVE, both the application and a narrowly scoped database trigger reject legacy `ComponentHeartbeat` writes only for `premium-linguist-it`, `premium-linguist-es` and `premium-linguist-sv`. No legacy `lastDetail` is imported.

## Local results

- deterministic audit: IT/ES/SV 3/3 PASS;
- resources per language: app 1182, operational 308, Car Mover 37, Premium 199, total 1726;
- immutable catalog digests: PASS and repeatable;
- semantic fixtures: 12 required categories, accepted variants PASS, unapproved output REVIEW_REQUIRED;
- API: 84/84 suites, 594/594 tests PASS;
- Web production build: PASS;
- PostgreSQL clean reset and all migrations: PASS;
- real PostgreSQL V1 certification: atomic activation, append-only evidence, legacy fence, invalid-no-mutation, concurrency, idempotency, replay/epoch protection, restart recovery and fault isolation PASS;
- security/evidence sanitizer: PASS, zero findings;
- release phase separation and secured SSH transport static gates: PASS;
- functional regressions: Premium operational context, Hub, communications, conversation, assistant, grounding, hands-free, voice, contacts, device/Android, TURN, accountability and final-language suites PASS;
- original nine protected resources: no diff;
- TURN/auth/Permission Guardian tests: PASS in the complete API suite;
- Browser controlled runner: PASS.

Browser fields:

- Browser Plugin Status: PASS
- Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE
- Browser Session Status: PASS
- Target Page Status: PASS
- Probe: initial Owner/session restore -> authenticated V1 state GET -> close/reopen -> second authenticated V1 state GET -> Premium navigation -> screenshots
- Browser authority: NONE
- legacy Browser heartbeat attempts: 0

Browser evidence: `evidence/operational-linguist-v1/browser/2026-09-23T06-20-34-914Z/`

## Negative controls

Missing/wrong contract, missing/wrong contract digest, missing/wrong catalog digest, missing/wrong baseline digest, incompatible schema, legacy payload, unknown component, identity/language mismatch, wrong counts, inconsistent total, non-zero errors, stale/future timestamp, unknown property and client provenance impersonation are rejected before mutation. Incomplete/duplicate activation, stale epoch, stale sequence, sequence/hash conflict, unregistered/revoked/expired publisher, verified-actor provenance mismatch, unauthorized role and absent/wrong mandate are also rejected. State/evidence/receipts remain unchanged for rejected service payloads.

The HTTP boundary rejects missing or invalid OIDC bearer credentials and rejects a missing/wrong TURN Owner authority for state reads.

## Baseline limitations (not caused by Plan C)

- `test:premium` fails at the same assertion on the clean base SHA.
- `test:multilingual-wave1` reports the same pre-existing missing French contact keys on the clean base SHA. Protected language assets were not modified.
- `test:surface-sync` and `release:freeze-check` require the separate nested `agmcockpit-website` worktree, which is absent from both clean AGM clones. Their failure is dependency/worktree absence, not a Plan C product assertion.
- A live external translation-provider call was not fabricated locally because no provider credential exists in the clean environment. The immutable semantic acceptance gate is present; any output outside approved native-equivalent variants is REVIEW_REQUIRED.

## Git and Production

At report creation: no commit, no push, no deploy and no Production interaction had occurred. GitHub/Production identifiers are recorded only after the corresponding legitimate operations complete.
