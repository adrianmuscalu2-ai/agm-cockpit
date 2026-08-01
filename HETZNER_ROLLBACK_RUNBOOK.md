# AGM Hetzner — Rollback Runbook

Date: 2026-07-27  
Status: proposed; must be rehearsed before cutover

## 1. Rollback triggers

Immediate rollback is required for:

- public `/live` or `/ready` failure;
- authentication failure;
- database integrity mismatch;
- translation unavailable beyond the agreed retry window;
- Turn Admin, incident/audit or Pre-departure sync failure;
- mixed traffic between PC and Hetzner;
- unbounded error/latency increase;
- backup/restore gate invalidated;
- suspected secret or data exposure.

## 2. Preconditions

Before cutover:

- save the exact current Cloudflare production route/tunnel configuration;
- confirm the Windows API, PostgreSQL and production connector are healthy;
- retain the final pre-cutover PC dump and SHA-256;
- retain the final Hetzner pre-import backup and SHA-256;
- define one rollback commander;
- ensure no independent writes can continue on both databases.

## 3. Immediate rollback procedure

1. Declare `NO-GO` and stop additional migration actions.
2. Put the Hetzner API write path into maintenance/read-only mode if available.
3. Record the last successful Hetzner request/correlation ID and timestamp.
4. Restore `api.agmcockpit.com` to the saved Windows production tunnel/origin.
5. Verify a unique request appears only in the Windows API log.
6. Run `/live`, `/ready`, authentication and one real translation.
7. Reopen PC writes only after the public route is confirmed on PC.
8. Preserve Hetzner containers, logs and database without further mutation.
9. Reconcile any writes accepted on Hetzner after the final PC dump before a future
   cutover; do not silently discard them.

## 4. Database rollback rule

If no Hetzner production writes were accepted, the PC database remains authoritative
and rollback is direct.

If Hetzner accepted writes:

- do not overwrite the PC database automatically;
- export the affected Hetzner records/audit range;
- reconcile by correlation ID and business entity;
- obtain Product Owner/Data Custodian approval;
- only then apply an audited forward reconciliation.

Restoring the old PC dump over a database containing newer confirmed business writes
is prohibited.

## 5. Target recovery time

- Route restoration: 5–10 min.
- Health and functional verification: 5–10 min.
- Target total rollback: **10–20 min**.
- Hard escalation threshold: **20 min**.

The estimate is valid only if the Windows API, database and tunnel remain online
throughout the initial cutover/soak window.

## 6. Rollback validation

PASS requires:

- public hostname reaches Windows only;
- `/live` and `/ready` pass;
- database is available;
- authentication and translation pass;
- Turn Admin and Pre-departure read paths pass;
- no new writes arrive on Hetzner;
- incident timeline and evidence are preserved.

## 7. Post-rollback

- keep the incident open;
- do not retry cutover in the same window without a new authorization;
- determine root cause;
- produce a data-divergence statement;
- repair and repeat staging, restore and Android/Browser validation;
- create a new checkpoint and rollback rehearsal before rescheduling.
