# AGM Cockpit Governance Register v1.1

**Status:** APPROVED / ACTIVE
**Effective date:** 7 September 2026, Europe/Berlin
**Authority:** Product Owner Directive — Governance Continuity + Agent Role Enforcement
**Supersedes for current interpretation:** AGM Cockpit Governance Register v1
**Historical preservation:** `AGM_COCKPIT_GOVERNANCE_REGISTER_V1.md` remains unchanged.

## 1. Precedence

1. Explicit current Product Owner mandate or decision.
2. This approved and active register.
3. Approved module/change contract applicable to the current artifact.
4. Runtime contracts, registries and tests.
5. Validation reports and historical archives.

Inactive, proposed, candidate and `NOT IMPLEMENTED` documents do not create
gates, HOLD, mandatory roles, implementation authority or Owner approval
requirements. The AGM Organizational Contract v1 remains `FINAL CANDIDATE /
PROPOSED / NOT ACTIVE`.

## 2. Continuity and gate coverage

- `PASS / CLOSED` remains protected for the validated contract and artifact.
- The 36 closed modules are not reopened by this reconciliation.
- G0-G11 describes required coverage, not an automatic rerun.
- Valid, identifiable, traceable and applicable historical evidence is recorded
  as `SATISFIED BY HISTORICAL EVIDENCE`.
- A successor change reopens only gates affected by a material change,
  regression, new risk, contract change, relevant artifact change, or missing or
  invalid evidence.
- A recommendation, backlog item or historical observation is not a mandate.

## 3. Canonical identity reconciliation

| Canonical identity | Versioned aliases accepted at the v1.1 boundary | Rule |
| --- | --- | --- |
| `architecture-guardian` | `architecture-inspector` | The Guardian owns architecture boundaries, reuse and architecture PASS/NO-GO. Inspection remains read-only; it never implements or validates its own implementation. |
| `version-guardian` | `version-custodian` | One release-traceability authority. The alias does not create a second approver. |
| `agent-mentor` | `mentor` | One strategic Mentor identity. Neither identity creates technical execution authority. |
| `turn-commander-adrian` | `adrian-turn-commander` | One Product Owner/Turn Commander identity; aliases do not duplicate approvals. |

Aliases are compatibility inputs only. New evidence and duty receipts use the
canonical identity. No third identity may be introduced for these roles.

## 4. Canonical operational roles

The active roles from v1 remain in force: Product Owner, Architecture Guardian,
Frontend Experience, Backend & Infrastructure, I18n/Localization, Release &
Operations, Technical Lead, Chief Inspector, Infrastructure Reuse Coordinator,
Documentation Owner, AGM Chronicler and Version Guardian.

`agent-qa` is not a permanent operational agent. Until a later explicit decision,
QA is `INDEPENDENT QA ROLE PER MANDATE`; each mandate records the validator and
proves independence from the implementer.

Premium identities declared `CONTRACTED_NOT_IMPLEMENTED` remain in that state
until runtime registry, provider binding, lifecycle, duty receipt and validation
all exist. They may not appear `ACTIVE` merely because their contract exists.

## 5. Executable role contract

Every operational agent must have a versioned role contract containing:

`agentId`, `roleContractVersion`, `requiredDuties`, `forbiddenDuties`, `triggers`,
`expectedOutput`, `validator`, `escalationRules`, and `stopConditions`.

The runtime must reject an unknown agent, a missing contract, an invalid alias,
or an attempted duty that conflicts with the role contract.

## 6. Duty execution evidence

Registration is identity evidence only. A current duty state requires a receipt
containing:

`agentId`, `roleContractVersion`, `mandateId/changeId`, `trigger`, `startedAt`,
`completedAt`, `source`, `coverage`, `result`, `evidenceRef`, `freshness`,
`openResponsibility`, `escalation`, and validator/independence where applicable.

Without a valid current receipt the only permitted duty state is
`UNKNOWN / NO CURRENT EVIDENCE`. Health, HTTP 200 and code presence do not prove
duty completion.

## 7. Monitor boundary

MON-001 through MON-012 observe, verify, record and escalate. They do not restart
services, rotate credentials, modify DNS, remediate infrastructure, or execute
the operation they later report. Remediation is routed to the competent executor.

## 8. Incident truth

`NO ACTIVE INCIDENTS` is permitted only after a successful, fresh, complete check
of all applicable incident sources with `checkedAt`, `checkedBy`, `source`,
`coverage`, `result`, and `freshness`.

- no attempted check: `UNKNOWN / NOT CHECKED`;
- attempted check with source failure: `INCIDENT DATA UNAVAILABLE`;
- successful complete check with active records: `ACTIVE INCIDENT`;
- successful complete check with zero active records: `NO ACTIVE INCIDENTS`.

An empty array, empty storage or absent record is not a completed check.

## 9. Role drift

`ROLE DRIFT` is an operational defect. It includes an out-of-role action, missed
triggered duty, unnecessary Owner escalation, unauthorized verdict, stale role
contract, identity-as-execution, or inconsistent reconstruction of a role.
Role drift must be detected from the role contract and duty receipt and shown in
TURN.

## 10. Owner approval and recovery

One approved mandate authorizes root cause analysis, in-scope patching, build,
tests, QA, inspection, retry, restart, redeploy, recovery and authorized rollback
until the mandate closes. A new Owner decision is required only for material
scope/risk/architecture/data/secret/authority change, destructive action or an
explicit owner-only operation.

Recovery order is `NORMAL EXECUTION -> RECOVERY -> RESCUE -> AUTHORIZED FAILOVER
-> HOLD`. Technical failure does not directly create `OWNER ACTION REQUIRED`.
