# Livrabil 9 — Plan etapizat de implementare

| Etapă | Scop | Ieșire | Poartă |
|---|---|---|---|
| 1 | contract și validare arhitecturală | prezentul checkpoint | G0 |
| 2 | model canonic și mapare TransportJob | schemă, ADR-006 închis, migrare propusă | G1 |
| 3 | nucleu de domeniu | state machine și teste exhaustive | G2 |
| 4 | persistență locală și sync | outbox, conflict, recovery demonstrat | G3 |
| 5 | orchestrator și shell operațional | TripContext și navigare fără funcții izolate | G4 |
| 6 | pre-departure: modulele 1–4 | poarta READY demonstrată | G4–G6 |
| 7 | active trip: modulele 5–7 | evenimente și transfer demonstrat | G4–G6 |
| 8 | post-trip: modulele 8–10 | completed/archive demonstrat | G4–G6 |
| 9 | integrare Browser/Android | paritate, offline/resume, accesibilitate | G5–G6 |
| 10 | staging și lansare controlată | rollback, migrare, aprobări | G7 |

## Reguli de execuție

- O singură etapă structurală este activă.
- Fiecare etapă are scop, fișiere, teste și checkpoint separat.
- Închiderea unei etape cere audit și decizie explicită.
- Nicio etapă nu modifică publicul doar pentru că buildul local trece.
- Implementarea începe numai după acceptarea condițiilor raportului Etapei 1.

## Checkpoint propus

- ID: `PREMIUM-ARCH-V1-2026-07-27`
- commit propus: `docs(premium): approve architectural contract v1`
- conținut: exclusiv contractul și livrabilele Etapei 1
- fără merge, deployment, APK sau publicare
