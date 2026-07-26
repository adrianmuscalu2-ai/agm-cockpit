# Etapa 3 — Persistență și sincronizare offline/online

Data: 2026-07-26
Branch: `feature/pre-departure-stage-3-offline-sync`
Checkpoint propus: `pre-departure-stage-3-offline-sync`

## Rezultat

A fost implementată infrastructura locală pentru persistența și sincronizarea
sesiunilor „Înainte de plecare”, fără deployment și fără aplicarea migrării pe
PostgreSQL.

## Backend

- modele Prisma `PreDepartureSession` și `PreDepartureAnswer`;
- artefact SQL de migrare, neaplicat;
- ownership obligatoriu prin compania și utilizatorul autentificat;
- creare idempotentă prin `clientSessionId` și `idempotencyKey`;
- citire limitată la tenantul autentificat;
- actualizare protejată prin `expectedServerRevision`;
- răspuns `PRE_DEPARTURE_REVISION_CONFLICT` pentru revizii depășite;
- înlocuirea atomică a răspunsurilor într-o tranzacție;
- validarea contractului înaintea persistenței;
- modul NestJS local pentru create/get/update.

Confirmarea și închiderea nu sunt activate în această etapă.

## Browser și offline

- fiecare salvare locală alimentează outbox-ul versionat;
- identitatea sesiunii și cheia de idempotency sunt stabile;
- revizia clientului crește la fiecare salvare;
- retry-ul păstrează o singură intrare per sesiune;
- lipsa conexiunii sau autentificării păstrează datele local;
- revenirea online declanșează automat încercarea de sincronizare;
- confirmarea serverului este memorată local, iar salvările ulterioare trec
  automat de la creare `POST` la actualizare `PUT`;
- HTTP 409 marchează intrarea drept conflict, fără suprascriere;
- erorile temporare cresc contorul și păstrează intrarea pentru retry;
- niciun token nu este scris în loguri sau în outbox.

## Validare

| Verificare | Rezultat |
| --- | --- |
| Prisma schema validate | PASS |
| Contract și sync API | 11/11 PASS |
| Create idempotent | PASS |
| Revision conflict | PASS |
| Offline outbox | PASS |
| Retry/deduplicare | PASS |
| Tranziție POST → PUT după confirmarea serverului | PASS |
| Conflict 409 păstrat local | PASS |
| Build API | PASS |
| Regresie Etapa 1 | PASS |
| Build Web | PASS |
| Migrare aplicată în DB | NU — intenționat |

## Limitări

- migrarea există numai ca artefact și necesită aprobare separată înainte de
  aplicare;
- sincronizarea reală necesită autentificarea utilizatorului;
- rezolvarea manuală a conflictelor aparține unei etape ulterioare;
- fotografiile și gestionarea problemelor aparțin Etapei 4;
- raportul și confirmarea server-side aparțin Etapei 5;
- nu s-a modificat deploymentul public.

## Verdict

**PASS TEHNIC — READY FOR PRODUCT OWNER STAGE 3 REVIEW**
