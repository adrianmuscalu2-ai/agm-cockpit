# Governance V2 / TURN — independent-validator handoff

Date: 2026-10-31  
Mandate: existing TURN journal activation and Risk & Knowledge application  
Status: `READY_FOR_INDEPENDENT_VALIDATOR` / `NO_VERDICT_ISSUED`

## Role routing

| Responsibility | Authorized role | Current handoff |
|---|---|---|
| Version Journal | Version Guardian | historical projection is connected; current canonical Production source is still missing |
| Operational Memory | AGM Chronicler | historical projection is connected; current canonical runtime source is still missing |
| Incident Journal | Turn Operations / Incident writer | implementation exists; current validator receipt is missing |
| Evidence Ledger | Version Guardian + Independent Validator | evidence references are connected; current Production ledger read-back is missing |
| Risk & Knowledge | Risk & Knowledge Orchestrator / Governance V2 persistence | controlled-local implementation exists; activation and independent validation are missing |
| Final independent verdict | `independent-validator-automated-20261025` | read-only validation only; no execution authority |
| Activation / closure approval | Owner | required after validator evidence; not delegated to software |

## Evidence already accepted and not repeated

- Safe-shutdown manifest and report from 2026-10-26 are preserved;
- Governance V2 source, hardening tests, controlled-local persistence/recovery,
  schema and actor-separation evidence are already recorded in the validation
  package and activation preparation;
- Production release `41227720680` passed deploy, health, soak, Browser and
  restart checks for revision `e2b3a1e`;
- the web projection patch is committed and pushed as `e2b3a1e`; its release
  result was recorded in commit `aafc9fd`.

## Validator read-only checklist

The validator must inspect and record a result for every item below. The
executor must not change the result or issue the verdict.

1. Candidate/ref and file SHA-256 values match the validation package.
2. Governance V2 runtime is registered in the API module.
3. The controlled-local database is PostgreSQL 16, schema `agm_governance`,
   isolated from Production and AGM operational databases.
4. Required tables, constraints, triggers and append-only ledger controls match
   the schema manifest.
5. Executor and validator identities are separate and active; validator has no
   execute authority.
6. Existing backup/restore and ledger read-back evidence is sufficient for the
   target, or the validator records the exact missing recovery evidence.
7. The historical journal projections are not mistaken for current canonical
   Production records.
8. Risk & Knowledge evidence is read back through the authorized Governance V2
   boundary and is not promoted to Production without activation.
9. The final verdict is emitted by the validator actor with evidence
   references and a concrete reason for every `NU`.

## Known missing gates at handoff

- no validator receipt for this final candidate/ref;
- no current canonical Production record/read-back for Version Journal,
  Operational Memory, Evidence Ledger or Risk & Knowledge;
- official Governance V2 environment identity, official backup/restore,
  secret-rotation metadata and rollback rehearsal are not evidenced;
- Owner activation/closure approval cannot be inferred from an implementation
  deploy.

These are gate conditions, not technical failures of the already deployed web
projection. Until the validator and Owner gates are satisfied, lifecycle state
remains separate: `IMPLEMENTED`, `VERIFIED`, `COMMITTED`, and `ACTIVE_IN_PRODUCTION`
are not interchangeable.

## Prohibited shortcut

This handoff is not an independent PASS. The executor cannot validate its own
evidence, cannot impersonate the validator actor, and cannot turn a historical
projection into a canonical Production journal.
