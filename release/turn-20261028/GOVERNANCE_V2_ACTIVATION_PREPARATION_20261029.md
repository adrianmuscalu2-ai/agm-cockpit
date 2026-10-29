# Governance V2 activation preparation

Date: 2026-10-29
Status: CONTROLLED-LOCAL READY / OFFICIAL ACTIVATION NOT EXECUTED
Worktree: `C:\Users\adria\Documents\AGM-TURN-INTEGRATION-20261029`
Branch: `turn-production-baseline-repair-20261029`

## Scope and decision

The Owner approval supplied in the current conversation is recorded as approval
to proceed with preparation. It does not by itself identify the official
Governance environment or create independent validator evidence. The only
migration and actor writes performed were inside the newly created controlled-
local container below; no official/Production database, secret manager,
commit, push, or deploy was touched.

The existing manifest evidence supports `IMPLEMENTATION_INTEGRATED /
ACTIVATION_NOT_EXECUTED`, not an activation PASS.

## Evidence carried forward from the saved manifest

Source: `C:\Users\adria\Documents\AGM-CANONICAL-CANDIDATE-20261022\AGM_SAFE_SHUTDOWN_20261026_MANIFEST.json`

| Item | Evidence | SHA-256 |
|---|---|---|
| Safe-shutdown report | `AGM_SAFE_SHUTDOWN_20261026.md` | `E1D3DFAF4EB68DE7B24D6DDE90D75FF8B1E95594D9B3BD449058087ABB794E1B` |
| Saved manifest | `AGM_SAFE_SHUTDOWN_20261026_MANIFEST.json` | `3CBAC6D8B12BAC7512373AFD04FFFDA18B3FC38DFBC600A5F7D25DFB577BB3D0` |
| Activation runbook | `governance/v2/preparation/governance-v2-activation-runbook.md` | `6066154D31806092B54C66BA6A24C478521021B6A91F4965FEB428DF69FCEF19` |
| Environment declaration | `governance/v2/preparation/governance-v2-environment.declarative.json` | `FFF6D3126F15CB6D8E41A214464F24B4E39DB63351E2AA51FC2EE595747E9D6F` |
| Access matrix | `governance/v2/preparation/governance-v2-access-matrix.json` | `9524F08AF24F1C699E2F245051E4C138A0AFC4573AE3711FA0C5BA90D8F9E33C` |
| Schema manifest | `governance/v2/preparation/governance-v2-schema-manifest.json` | `72704474F3A8ABD66AFFC8E094051FAD15ECA8C5785D71C531CB03BB913B307C` |
| Independent validator principal | `governance/v2/actors/independent-validator-automated-20261025.json` | `D2103FE10DEC7C312DAAE4D21425674CF7126DBB674B5A4282110814CBFC6F54` |

The manifest records the Governance preparation artefacts and the validator
principal as local evidence. It does not record an official environment,
applied schema, initialized official actors, or production activation.

## Controlled-local environment provisioned

Provisioned on 2026-10-30 from the declared preparation target, without
touching the existing `agm-postgres` or `agm-development-postgres` containers:

- container: `agm-governance-v2-local`;
- image: `postgres:16-alpine`;
- endpoint: `127.0.0.1:55433/agm_governance`;
- dedicated network: `agm-governance-v2-local-network`;
- dedicated volume: `agm-governance-v2-local-data`;
- schema verification: 14 tables and 43 triggers;
- direct SQL actor insert: rejected by `GOVERNANCE_STRUCTURAL_WRITE_BOUNDARY`;
- runtime registration: 2 actors and 2 append-only governance events.

Recovery evidence from the controlled-local rehearsal:

- backup: `C:\Users\adria\Documents\AGM\.tmp\governance-v2-local-20261030\agm_governance.dump` (local test dump, not an official encrypted backup);
- backup size: `51131` bytes;
- backup SHA-256: `022F0EFBC3BAD99A9582CB66DA1EA0AEF3C48E7BCB8462AC66557D902B8F4D79`;
- disposable restore: PASS, with source and restore counts both `14|43|2|2`;
- ledger read-back: PASS, source and restore digest both
  `f475b458c339928005e2a155f5b57da1`;
- schema manifest digest: PASS,
  `3775D230886604929A265ECC6491EBA0E621C514C100354AC04EABC39713B455`;
- disposable restore container, network and volume: destroyed after verification.

Actors initialized through `GovernanceV2RuntimeService` in this controlled-local
environment:

- `codex-implementer-machine-operational-truth-remediation` — `EXECUTOR`, `ACTIVE`;
- `independent-validator-automated-20261025` — `VALIDATOR`, `ACTIVE`.

No Owner, Proposer, or Approver identity was invented. The Owner remains a
human authority and the official actor assignments remain a separate gate.
This local environment is test evidence only; it is not the official
Production Governance environment.

## Prepared target

The declarative target is explicitly:

- environment: `agm-governance-v2-official-pending-owner-designation`;
- class: `CONTROLLED_LOCAL`;
- database/schema: `agm_governance` on PostgreSQL 16;
- Production and operational database connectivity: `false`;
- runtime access: `GovernanceV2Persistence only`;
- roles: separate runtime, migration, backup, Owner, Executor and Validator;
- schema state: `PREPARED_NOT_APPLIED`;
- official activation: `false`;
- recovery-evidence write boundary before activation: `false`.

These values are preparation declarations, not observed runtime facts.

## Gate checklist

| Gate | State | Source / required evidence |
|---|---|---|
| Owner approval to prepare | PROVIDED | current conversation; not an environment designation |
| Official environment ID | MISSING | Owner designation required by activation runbook |
| Isolation from Production and AGM operational DBs (controlled-local) | VERIFIED | dedicated Docker network and loopback endpoint; no existing AGM container touched |
| PostgreSQL 16 controlled-local target provisioned | VERIFIED | `agm-governance-v2-local`, `127.0.0.1:55433`, dedicated volume |
| Exact schema applied (controlled-local) | VERIFIED | 14 tables and 43 triggers; schema SHA matches manifest |
| Tables, triggers and append-only controls (controlled-local) | PENDING | independent validator inspection against schema manifest |
| Official environment isolated from Production | MISSING | DBA connectivity verification in the designated official environment |
| Official actors initialized | MISSING | actor initialization record; identities must be supplied by the approved environment |
| Secret storage and rotation check | MISSING | metadata-only secret-manager and rotation evidence; no values in repository |
| Backup SHA-256 (controlled-local) | VERIFIED | local dump SHA recorded above; secret values not exposed |
| Encrypted backup (controlled-local/official) | MISSING | encryption and backup-role evidence not produced |
| Disposable restore verification (controlled-local) | VERIFIED | counts and ledger digest matched; disposable target destroyed |
| Official backup and restore evidence | MISSING | backup-role record for the designated official environment |
| Executor/validator separation | PREPARED ONLY | access matrix and local validator principal; official assignment not confirmed |
| Rollback readiness | PREPARED ONLY | monitoring/rollback runbook; target-specific rehearsal absent |
| Independent validation | PENDING | validator must confirm the final target and evidence |

## Exact next sequence

1. Owner designates the official isolated Governance environment and records
   its environment ID.
2. DBA provisions or confirms the dedicated PostgreSQL 16 database and proves
   that Production and operational AGM connectivity are absent.
3. Migration role applies the exact schema manifest.
4. Validator reads back schema, tables, triggers, constraints and ledger
   controls.
5. Approved actors are initialized with separate Executor and Validator
   identities.
6. Backup role creates an encrypted backup; restore is tested in a disposable
   instance and evidence is recorded without secret values.
7. Independent Validator records PASS or the concrete failed gate.
8. Only after those gates pass may the approved activation workflow be run.
9. Post-activation runtime, ledger and rollback checks must be recorded before
   the UI may change from `NOT ACTIVATED · GATED`.

## Current verdict

`CONTROLLED-LOCAL READY / OFFICIAL ACTIVATION NOT EXECUTED`.

The package is ready for review and validator use. It is not an activation
record and must not be used to claim Governance V2 is active.
