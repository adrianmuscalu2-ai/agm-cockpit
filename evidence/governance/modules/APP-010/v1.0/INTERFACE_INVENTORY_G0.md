# APP-010 — Inventar interfețe G0

| Interfață | Direcție | Responsabilitate |
|---|---|---|
| API-006 | client ↔ API | sursă remote pentru incidente și trasabilitate |
| APP-011 | client → Turn | afișare, coordonare și acces la jurnal |
| OPS-003 | monitorizare → client | failure/recovery corelate prin incidentId |
| Browser Storage | client ↔ local | persistență `agm.turn.incident-journal.v1` |
| Export audit | client → fișier | raport JSON cu istoricul complet |

Reconcilierea este deterministă și pură. Transportul HTTP către API-006 rămâne o integrare separată și nu a fost activat prin acest mandat.

