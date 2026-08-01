# DATA-001 — Inventar interfețe G0

| Interfață | Direcție | Responsabilitate |
|---|---|---|
| Prisma Schema | cod → client | modele, relații, constrângeri și indici |
| Prisma Migrations | artefact → PostgreSQL | istoric append-only |
| PrismaService | API ↔ DB | conexiune globală și tranzacții |
| API-001…008 | servicii ↔ persistence | citiri și scrieri prin ownerii domeniilor |
| OPS-003 | DB → monitoring | readiness și incidente de persistență |
| OPS-004 | artefact → Production | migrare/restore numai prin mandat separat |
| Backup/Restore | PostgreSQL ↔ evidence | dump verificat și rehearsal controlat |

