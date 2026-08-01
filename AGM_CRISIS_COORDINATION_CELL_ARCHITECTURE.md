# AGM Crisis Coordination Cell architecture proposal

Date: 2026-07-28
Status: architecture proposal; not operationally activated

## Purpose

The Crisis Coordination Cell (CCC) coordinates critical incidents while preserving
essential AGM functions and preventing a local nonconformity from causing
uncontrolled system-wide action.

It supplements existing gates and roles. It does not bypass Turn Command Center,
Secret & Credentials Guardian or independent validation.

## Activation

Activation requires an explicit Turn Command Center incident declaration containing:

- incident ID, UTC start time and severity;
- affected service/data boundary;
- essential functions to preserve;
- appointed Incident Lead and Independent Validator;
- authorized actions and prohibited actions;
- initial STOP conditions.

Automatic technical alerts may recommend activation but cannot activate the CCC.

## Operating modes

### Local containment

Used when one bounded component fails and fallback remains healthy.

- freeze only the affected change path;
- preserve unaffected gates and services;
- run a limited audit against the changed boundary;
- maintain public service on the approved fallback;
- prohibit unrelated remediation.

### Degraded continuity

Used when essential functions can continue safely in reduced form.

- define the allowed read/write surface;
- disable nonessential or high-risk operations;
- preserve audit, authentication and data-integrity controls;
- publish the degradation and exit criteria.

### General crisis

Used for cross-component, security, data-integrity or multi-origin incidents.

- stop all nonessential changes;
- freeze conflicting writers/routes;
- preserve evidence;
- trigger a general audit only when system-wide coherence is genuinely in doubt.

## Permanent roles

- Incident Lead: Turn Command Center.
- Independent Validator: AGM Inspector.
- Technical Recovery Executor: Atlas/Codex or another explicitly designated agent.
- Fallback Custodian: Release & Operations.
- Secret Incident Lead: Secret & Credentials Guardian, only for authorized
  secret-domain actions.
- Architecture Advisor: Architecture Guardian.
- Communications Recorder: Turn Command Center incident history.

Authorization, execution and independent validation remain separated.

## Essential functions

The incident declaration selects the minimum safe set from:

- public API health/readiness;
- authentication and authorization;
- Production database integrity and single-writer control;
- Turn Admin access;
- Pre-Departure synchronization;
- translation;
- audit/evidence recording;
- backup and restore readiness;
- public routing and fallback.

No function is preserved by allowing dual-write, mixed-origin routing or secret
disclosure.

## Audit selection

A local audit is used when:

- the affected boundary is known;
- checksums and identities outside it are unchanged;
- fallback is healthy;
- no evidence suggests data/security propagation.

A general audit is triggered when:

- the affected boundary cannot be proven;
- multiple identities/routes/writers conflict;
- secret compromise may cross environments;
- data reconciliation cannot isolate divergence;
- an approved artefact or architecture invariant changed.

The Independent Validator records why the selected audit scope is sufficient.

## Incident lifecycle

1. Detect and classify.
2. Declare incident and scope.
3. Freeze affected actions.
4. Preserve evidence and timestamps.
5. Activate fallback/degraded continuity.
6. Diagnose locally.
7. Remediate under an explicit bounded mandate.
8. Revalidate only the changed boundary plus system coherence.
9. Restore normal operation.
10. Record cause, remediation, validation and lessons learned.

## Safeguards

- CCC activation grants no implicit deployment, migration, DNS or secret authority.
- Every mutation still requires an explicit mandate.
- Gates already closed remain closed unless new evidence affects them.
- A local PASS cannot waive final system-coherence verification.
- Any dual-writer or mixed-origin condition produces immediate STOP.
