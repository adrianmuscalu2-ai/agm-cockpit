# Livrabil 8 — Registrul riscurilor și deciziilor

## Riscuri

| ID | Risc | Prob. | Impact | Control | Stare |
|---|---|---:|---:|---|---|
| R-01 | două mașini de stări divergente Premium/backend | mare | critic | mapare versionată înainte de integrare | OPEN |
| R-02 | module Premium existente rămân izolate | mare | mare | adaptare obligatorie la TripContext | OPEN |
| R-03 | duplicarea șofer/vehicul/document | medie | mare | proprietate canonică și referințe | CONTROLLED |
| R-04 | pierdere date offline | medie | critic | tranzacție locală + outbox + recovery | CONTROLLED |
| R-05 | confirmare critică automată/AI | medie | critic | confirmare umană explicită | CONTROLLED |
| R-06 | cache health afișează stare falsă | medie | mare | probe unice, fără cache | CONTROLLED |
| R-07 | Premium afectează Basic | medie | critic | limite, feature gate, regresie | CONTROLLED |
| R-08 | conflict local/server ascuns | medie | mare | optimistic locking + recovery | CONTROLLED |
| R-09 | OCR/traducere tratate ca adevăr | medie | mare | proveniență și verificare | CONTROLLED |
| R-10 | publicare înainte de validare | mică | critic | G7 și aprobare explicită | CONTROLLED |

## Decizii arhitecturale

| ADR | Decizie | Motiv | Statut |
|---|---|---|---|
| ADR-001 | un singur agregat Trip | elimină funcțiile insulare | ACCEPTED |
| ADR-002 | stări principale + flaguri ortogonale | evită explozia de stări | ACCEPTED |
| ADR-003 | UI fără autoritate de tranziție | reguli unice și testabile | ACCEPTED |
| ADR-004 | local-first controlat cu outbox | continuitate fără succes simulat | ACCEPTED |
| ADR-005 | audit append-only | trasabilitate | ACCEPTED |
| ADR-006 | mapare, nu reutilizare, pentru TransportJob | semantică diferită | CONDITION |
| ADR-007 | Basic/Premium separate prin porturi | protecția baseline-ului | ACCEPTED |
| ADR-008 | probe operaționale reale fără cache | adevăr operațional | ACCEPTED |

Condiția ADR-006 trebuie închisă înaintea integrării backend.
