# AGM Gate 6C pre-change and routing rollback validation report

Date: 2026-07-28
Exercise type: documentation-only controlled tabletop
Verdict: **PASS / REMEDIATED**

## Scope

The exercise reviewed the pre-change, connector transition, abort and fallback
sequence without changing DNS, Cloudflare, connectors, services, databases or
Production infrastructure.

## Topology correction

Prior wording treated the fallback and Hetzner target as different Production
tunnels/routes. Evidence instead establishes one Production tunnel,
`agm-api-production`, with the PC fallback currently using a Windows connector and
the Hetzner target prepared to use a connector for the same tunnel.

The approved procedure now:

- preserves the public hostname and tunnel identity;
- transitions connector/origin ownership;
- prohibits concurrent Windows and Hetzner Production connectors;
- leaves the Validation tunnel unchanged;
- requires no DNS change or Cloudflare migration.

## Tabletop scenarios

| Scenario | Expected control | Result |
|---|---|---|
| Gate 6 or deployment mandate missing | SP0 STOP | PASS |
| Pre-change evidence or role identity missing | SP1 STOP | PASS |
| Gate 6D/write freeze incomplete | SP2 STOP; no connector change | PASS |
| Windows connector cannot be proven stopped | restart/retain fallback; abort | PASS |
| Both Production connectors active | immediate abort and rollback | PASS |
| No connector after transition interval | restart Windows fallback; abort | PASS |
| Unique request reaches wrong/multiple origins | immediate rollback | PASS |
| Health, migration or functional check fails | SP5 rollback | PASS |
| Secret/data exposure suspected | STOP, preserve evidence, incident escalation | PASS |
| Rollback exceeds 20 minutes | incident escalation | PASS |

## Role validation

- Command Lead authorizes and declares GO/HOLD/NO-GO.
- Independent Validator observes, verifies connector count and issues the independent
  verdict.
- Fallback Responsible preserves and operates the Windows fallback.
- Rollback Responsible executes only the authorized Hetzner rollback actions.

No role authorizes and independently validates its own action.

## Consistency verification

- Gate 1: secret authority and protected environment rules are unchanged.
- Gate 2: official Hetzner PostgreSQL identities remain `agm-postgres` and
  `app_agm_postgres_data`.
- Gate 3: backup/restore procedure is unchanged.
- Gate 4: API lifecycle remains `agm-production-api.service`; no service was started.
- Gate 5: tunnel identities and hostname associations remain unchanged.
- Gate 6A: rollback runbook identities and its dependency on Gates 6B–6D are
  respected.
- Gate 6B: all procedure steps use the approved separation of duties.
- Gate 6D: no data-source, migration or reconciliation decision was made; SP2 blocks
  transition until Gate 6D PASS.

No contradictory route, duplicate Production tunnel, overlapping authority or
uncontrolled dual-connector state remains in the documented procedure.

Consistency verdict: **PASS**.

## Conservation

- no DNS or Cloudflare modification;
- no connector, API or database service action;
- no deployment, migration or Production infrastructure change;
- documentation only.

## Final decision

Gate 6C is closed **PASS / REMEDIATED**.

This tabletop validates the procedure and stop controls. It does not authorize or
replace the live pre-change evidence capture required in an approved deployment
window. It does not close Gate 6 or authorize Gate 6D.
