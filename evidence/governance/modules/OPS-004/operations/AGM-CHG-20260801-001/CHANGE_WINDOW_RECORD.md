# AGM-CHG-20260801-001 — Registrul ferestrei de schimbare

**Status:** COMPLETED FOR PREFLIGHT / HOLD BEFORE MUTATION

- Fereastră preflight UTC: `2026-08-01T06:25Z–07:25Z`;
- țintă exactă: redeployment controlat al imaginii API aprobate pe Hetzner `167.233.237.253`, cu validare Browser/Android și rollback pregătit către PC fallback;
- artefact candidat: `agm-api@sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`, OCI `9956eb188fdd988bf0d7af93241c3c43962d9b39`;
- Command Lead: Adrian / Turn Commander — confirmat prin mandatul de continuare;
- Independent Validator: Banach / sesiune distinctă `app003_inspector_review` — rol acceptat;
- Fallback Responsible: Plato / sesiune distinctă `app003_qa_review` — rol acceptat read-only;
- Rollback Responsible: Lorentz / sesiune distinctă `app003_owner_review` — rol acceptat;
- executor tehnic: Codex `/root`;
- canal STOP: această sesiune operațională; comenzile `STOP`, `OPRIȚI`, `HOLD` sau `NO-GO` întrerup imediat fluxul;
- sursă de date/single-writer: Hetzner `agm-postgres` este writable (`default_transaction_read_only=off`); PC fallback `agm-postgres` este read-only (`on`); dual-write absent;
- migrații Hetzner: 5 complete / 0 incomplete;
- backup Hetzner: `agm-postgres-backup.timer` enabled/active; script `/usr/local/sbin/agm-postgres-backup`;
- verdict pre-change: HOLD.

## Abatere care activează STOP

Conectorul Hetzner Production este activ prin unitatea tranzitorie `/run/systemd/transient/agm-production-cloudflared.service`; nu există unitate persistentă `/etc/systemd/system/agm-production-cloudflared.service`. Această limitare este confirmată și în raportul istoric de cutover. Un reboot ar întrerupe ruta Production.

Conform mandatului, abaterea oprește execuția înaintea deploymentului efectiv. Remedierea unității persistente nu este presupusă ca autorizată de mandatul de validare.
