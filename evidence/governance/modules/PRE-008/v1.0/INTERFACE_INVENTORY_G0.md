# PRE-008 — Inventar interfețe

| Interfață | Direcție | Contract |
|---|---|---|
| APP-012 Pre-Departure | APP-012 → PRE-008 | start, readiness, flags și handoff idempotent |
| APP-013 After-Departure | APP-013 ↔ PRE-008 | lifecycle post-start, offline și recovery |
| API-004 TransportJob | PRE-008 ↔ lifecycle map | `premium-transportjob-map.v1`; fără mutație în acest mandat |
| APP-014 Outbox | PRE-008 → outbox | evenimente versionate, pending/confirmed/conflict |
| APP-009 Storage | PRE-008 ↔ repository local | context, event store și outbox |
| PRE-001 Shell | PRE-008 → shell | context read model; fără logică duplicată |
| OPS-003 Monitoring | PRE-008 → operations | flags și recovery state |

