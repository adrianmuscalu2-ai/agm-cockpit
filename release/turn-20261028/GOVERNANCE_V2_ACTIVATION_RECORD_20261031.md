# Governance V2 — designation and activation record

Date: 2026-10-31
Environment ID: `agm-governance-v2-local`
Environment class: `CONTROLLED_LOCAL`
Database/schema: `agm_governance`

## Owner designation

The Product Owner designated the existing isolated controlled-local environment
`agm-governance-v2-local` for Governance V2. This designation does not promote
the environment to Production and does not authorize connectivity to the AGM
operational database.

## Observed boundary

- PostgreSQL image/version: `postgres:16.14` (major version 16);
- dedicated Docker network: `agm-governance-v2-local-network`;
- dedicated volume: `agm-governance-v2-local-data`;
- network inspection: only `agm-governance-v2-local` is attached;
- database: `agm_governance`;
- schema tables observed: 14;
- Production and operational AGM connectivity: not configured by the declared
  environment boundary.

## Existing activation evidence reused

The controlled-local preparation record already documents the exact migration,
schema controls, encrypted-backup requirement, disposable restore, ledger
read-back and actor-separation rehearsal:

- `release/turn-20261028/GOVERNANCE_V2_LOCAL_EVIDENCE_20261029.md`;
- `release/turn-20261028/GOVERNANCE_V2_ACTIVATION_PREPARATION_20261029.md`;
- `C:\Users\adria\Documents\AGM-TURN-INTEGRATION-20261029\release\turn-20261028\GOVERNANCE_V2_ACTIVATION_PREPARATION_20261029.md`.

The existing runtime actors are separate and active:

- `codex-implementer-machine-operational-truth-remediation` — `EXECUTOR`;
- `independent-validator-automated-20261025` — `VALIDATOR`.

## Current lifecycle states

| State | Result | Evidence |
|---|---|---|
| Implemented | PASS | `apps/api/src/governance-v2/`, API module registration |
| Verified | PASS — controlled-local | Governance V2 hardening and persistence/recovery evidence |
| Committed | PASS | journal projection patch committed as `e2b3a1e` and pushed on `phase3-rc-preparation` |
| Active in Production | NO for Governance V2 | the controlled-local environment is isolated; the web projection release is deployed, but no Production Governance V2 activation is claimed |

## Journal consequence

The designation enables the Governance V2 read boundary for this controlled-local
environment. It does not convert historical Turn projections into current
Production truth. Version Journal, Operational Memory, Evidence Ledger and Risk
& Knowledge remain `IMPLEMENTED_NOT_VALIDATED` / `NOT_VERIFIED` for Production
until their current canonical records and independent validator receipt are
present. The web UI now connects the first three to explicit read-only
`HISTORICAL_PROJECTION` sources; this removes `NOT CONNECTED` as a routing
error but does not promote their lifecycle state.

## Remaining gate

The Independent Validator must perform the read-only schema/ledger check and
record a PASS or a concrete failure. The executor cannot issue that independent
verdict. No role, check or Production state is invented by this record.

## Production access evidence received

The Owner-provided Production Access Preflight capture records:

- runtime verification: `2026-10-31 19:02:20`;
- candidate SHA: `b1636e344be3`;
- `ssh-identity`: `PASS`;
- `ssh-agent`: direct deployment key supplied, no interactive dependency.

This proves authenticated Production access for the candidate session only. It
does not prove Production journal connectivity, current Evidence Ledger data,
Governance V2 activation, or an independent validator verdict. The screenshot
itself shows those fields as `UNKNOWN / NOT REPORTED` and remains separate from
the controlled-local activation record.

## Release and Operations result

Production workflow `41227720680` completed successfully for revision
`e2b3a1e3437e9561753f38d3bd913522bb38a431`:

- static, API, web and journal contract checks: PASS;
- deployment and public health: PASS;
- post-deploy operational truth, soak and certification: PASS;
- Production Browser preflight, live TURN snapshot, responsive matrix and
  canonical branding: PASS;
- restart test: PASS — the release job restarted `agm-production-api.service`
  and `agm-production-web.service`, then verified readiness, live health and
  public routing;
- Car Mover entitlement provisioning was skipped by the workflow dispatch flag;
  it is unrelated to the journal projection patch.

This is the final release verdict for the implemented web projection. It is not
a DA for Governance V2 Production activation or for independent journal
validation.
