# AGM Production deployment and rollback roles

Status: approved role model for Gate 6B. This document grants no deployment or
infrastructure-change authority by itself.

## Role assignments

### Command Lead — Turn Command Center

Accountable authority for the change window.

Responsibilities:

- issues the explicit deployment, routing and rollback mandates;
- opens, pauses and closes the change window;
- declares GO, HOLD or NO-GO based on evidence;
- authorizes rollback activation when a trigger is met;
- records the final operational decision.

Restrictions:

- does not execute infrastructure commands;
- does not act as Independent Validator;
- cannot waive a failed mandatory gate without a separately documented governance
  decision.

### Independent Validator — AGM Inspector

Read-only assurance authority, organizationally separate from the executor.

Responsibilities:

- verifies artefact identity, pre-change evidence and gate results;
- observes the deployment and rollback rehearsal;
- validates timestamps, checksums, health, ready, migration and routing evidence;
- issues PASS or FAIL for the validation scope;
- may require HOLD/STOP when evidence is missing or inconsistent.

Restrictions:

- does not execute deployment, routing, database or rollback changes;
- does not approve its own evidence;
- must be represented by a different operator/session from the Rollback Responsible.

### Fallback Responsible — Release & Operations / PC Fallback Custodian

Custodian of the approved fallback service, route information and source-data state.

Responsibilities:

- confirms fallback API, database and tunnel readiness;
- preserves the pre-change route export, checksum and fallback health evidence;
- applies the Gate 6D approved write-freeze/single-writer controls on the fallback;
- confirms whether fallback writes may be reopened after rollback;
- preserves fallback logs and database evidence.

Restrictions:

- does not authorize deployment or rollback;
- does not change Cloudflare routing;
- does not validate its own fallback evidence.

### Rollback Responsible — Atlas/Codex Technical Executor

Technical executor for the approved rollback procedure.

Responsibilities:

- prepares exact commands and verifies their targets before execution;
- executes only the rollback actions explicitly authorized by Command Lead;
- stops immediately on scope mismatch or an unexpected target;
- preserves logs, timestamps and command results;
- reports completion to Command Lead and Independent Validator.

Restrictions:

- does not authorize its own actions;
- does not issue the independent PASS/FAIL verdict;
- does not access or modify secrets without the separately required Secret &
  Credentials Guardian workflow and Turn Command Center authorization;
- does not expand a rollback mandate into deployment, migration or data
  reconciliation.

## Supporting roles

- Secret & Credentials Guardian remains the sole Production-secret custodian and is
  activated only under its existing dual authorization rules.
- Architecture Guardian provides architecture-consistency advice but does not replace
  Command Lead, Independent Validator, Fallback Responsible or Rollback Responsible.

## Separation-of-duties matrix

| Decision or action | Command Lead | Independent Validator | Fallback Responsible | Rollback Responsible |
|---|---|---|---|---|
| Open/close change window | Accountable | Observe | Informed | Informed |
| Issue deployment/rollback mandate | Accountable | Consulted | Consulted | Informed |
| Validate evidence | Receives verdict | Accountable | Supplies fallback evidence | Supplies execution evidence |
| Maintain fallback readiness | Informed | Verifies | Accountable | No action |
| Execute rollback commands | Authorizes | Observes | Supports fallback | Accountable |
| Declare final operational verdict | Accountable | Mandatory independent verdict | Consulted | Informed |

No role may approve and independently validate the same action. Command Lead,
Independent Validator and Rollback Responsible must be represented by distinct
operator identities/sessions during an execution window.

## Change-window identity record

Before Gate 6C rehearsal or any deployment window, Turn Command Center must record:

- change identifier and UTC window;
- named/on-duty identity for each of the four roles;
- Independent Validator session distinct from the executor session;
- acknowledgement from every role;
- approved communication and STOP channel.

Failure to populate that execution record is an automatic NO-GO. The record assigns
operators to the approved roles; it does not change the role model.

## Authority boundary

This document defines responsibilities only. It does not authorize deployment,
service startup, migration, DNS/Cloudflare modification, database access or
Production infrastructure changes.
