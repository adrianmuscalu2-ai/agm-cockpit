# AGM — SR-11 Pre-Departure Facade and Journey Handoff

Data: 2026-07-29  
Domeniu: fațada Pre-Departure și handoff-ul către Journey/Operational Context  
Verdict: **SR-11 — CLOSED / PASS**

## Rezultat

A fost introdus handoff-ul intern versionat
`pre-departure-journey-handoff.v1`. Contractul conține:

- `handoffId` determinist;
- modulul sursă și starea Pre-Departure;
- lista normalizată și ordonată de open items;
- stările dorite pentru `BLOCKED`, `OFFLINE` și `SYNC_PENDING`;
- identificatorul și metadatele confirmării, când aceasta există.

`handoffId` este derivat determinist din snapshot-ul semantic. Același snapshot
produce aceeași identitate; schimbarea stării, conectivității, open items sau
confirmării produce o identitate nouă.

Controllerul Pre-Departure nu mai depinde direct de implementarea Operational
Context. El utilizează `PreDepartureJourneyFacade`, care păstrează integrarea
existentă drept binding implicit și permite rollback/comutare fără schimbarea
controllerului.

## Idempotency și recovery

Reconcilierea verifică starea canonică `TripContext` înaintea comenzilor:

- lifecycle-ul este pornit numai dacă se află încă în `DRAFT`;
- open items sunt înlocuite numai dacă snapshot-ul normalizat diferă;
- flag-urile sunt modificate numai dacă valoarea dorită diferă;
- confirmarea este aplicată numai din starea lifecycle permisă;
- `SYNC_PENDING` rămâne activ după handoff și reset;
- resetul UI păstrează cursa activă.

Reaplicarea aceluiași handoff:

- nu crește `contextVersion`;
- nu adaugă evenimente duplicate;
- nu adaugă înregistrări Outbox duplicate;
- rămâne idempotentă după recrearea fațadei și a porturilor din aceeași
  persistență;
- poate reconcilia ulterior un snapshot schimbat.

Metadatele `handoffContractVersion`, `handoffId` și `sourceState` sunt atașate
evenimentelor efectiv produse. Contractele de identity și ordering validate
prin SR-10 rămân active pentru Outbox-ul Operational Context.

## Comportament și persistență

- UI-ul și markup-ul Pre-Departure sunt nemodificate;
- cele 18 tranziții canonice sunt nemodificate;
- cheile și formatele storage sunt nemodificate;
- Outbox-urile nu sunt comasate;
- nu există dual-write nou;
- API-ul de sincronizare Pre-Departure este nemodificat;
- cursa și evenimentele existente rămân recuperabile;
- SR-12/After-Departure nu a fost accesat sau modificat.

## Module și fișiere afectate

- `apps/web/src/pre-departure/pre-departure.facade.ts`;
- `apps/web/src/pre-departure/pre-departure.controller.ts`;
- `apps/web/src/premium-operational-context/pre-departure.integration.ts`;
- `apps/web/scripts/test-sr11-pre-departure-journey-handoff.ts`;
- `apps/web/scripts/test-mc3a-boundaries.ts`;
- `apps/web/package.json`;
- prezentul raport.

## Validări

| Gate | Rezultat |
|---|---|
| Contract `pre-departure-journey-handoff.v1` | PASS |
| Identitate deterministă pentru același snapshot | PASS |
| Identitate nouă pentru snapshot schimbat | PASS |
| Replay idempotent | PASS |
| Replay după recrearea fațadei/porturilor | PASS |
| Fără evenimente sau Outbox records duplicate | PASS |
| Reconcilierea unui snapshot schimbat | PASS |
| Reset recuperabil cu păstrarea cursei | PASS |
| E6.2 Pre-Departure | PASS — 18/18 tranziții |
| Pre-Departure Outbox | PASS |
| Operational Context | PASS |
| SR-10 Common Outbox | PASS |
| MC-3A complet | PASS — 21 verificări |
| Cicluri Web | PASS — 164 fișiere, 0 cicluri |
| Cicluri API | PASS — 81 fișiere, 0 cicluri |
| Regresie API completă | PASS — 19 suite, 99 teste |
| TypeScript/API Build | PASS |
| Web Build | PASS — 178 module |
| Browser E6.3 | PASS |
| Browser E6.4–E6.6 | PASS |
| Android `testDebugUnitTest` | BUILD SUCCESSFUL — 53 task-uri |

Prima execuție TypeScript a identificat lărgirea tipului literal al
`OpenOperationalItem` în constructorul handoff. Tipul generic al mapării a
fost făcut explicit, apoi scutul SR-11, MC-3A, Operational Context, Web Build
și Browser au fost repetate integral cu rezultat PASS.

Build-ul principal păstrează chunk-ul istoric de 526,07 kB. Pragul Vite și
configurația avertismentului nu au fost modificate. Codul handoff este izolat
în bundle-ul Pre-Departure; Web Build a transformat 178 module.

## Inventar APK și protecții

Inventarul celor cinci APK-uri este identic înainte și după validare:

- patru copii de 7.604.172 bytes, SHA-256
  `C270161B6639ACA61534DF5C86F03ED0038F02B86EB9C08926C96B31A8D943F5`,
  timestamp UTC `2026-07-26T23:29:26.4199988Z`;
- un `app-debug.apk` de 22.277.627 bytes, SHA-256
  `38629C244D223673F8E512A96877529053690E8713F3DDC6D0AA54B691AD4ABF`,
  timestamp UTC `2026-07-29T09:24:37.4221765Z`.

Confirmări:

- `assembleDebug` nu a fost executat;
- nu a fost generat, instalat sau livrat niciun APK;
- telefonul nu a fost accesat sau modificat;
- versiunea Android existentă a rămas instalată;
- API-ul public, DTO-urile și schema Prisma sunt nemodificate;
- Diagnostics este nemodificat; pluginul păstrează SHA-256
  `258B4A0458D93A4737A448650A8F42388FDC3E677A62D83B113994215CCB9D7B`;
- registrul materialelor concursului păstrează SHA-256
  `F19A40918D3146687F4B7DD6B722626D568224D244525EF960D8056FBEBD5E1D`;
- producția, infrastructura și materialele concursului nu au fost accesate
  sau modificate;
- SR-06 rămâne ON HOLD — Pending Final Device Validation.

## Rollback

Rollback-ul este local și nu necesită migrare:

1. controllerul revine la importul direct al funcțiilor existente din
   `pre-departure.integration.ts`;
2. se elimină binding-ul `PreDepartureJourneyFacade`;
3. reconcilierea open items revine la comanda existentă necondiționată;
4. se elimină metadatele versionate din payload și scutul SR-11.

Nu se modifică și nu se șterge nicio cheie storage, coadă Outbox, sesiune sau
înregistrare Journey. Nu este necesară intervenție Android sau pe telefon.

## Verdict oficial

**SR-11 — CLOSED / PASS.**

Stare operațională:

- SR-08 — CLOSED / PASS;
- SR-09 — CLOSED / PASS;
- SR-10 — CLOSED / PASS;
- SR-11 — CLOSED / PASS;
- SR-06 — ON HOLD / Pending Final Device Validation;
- programul structural general — OPEN.

SR-12–SR-14 nu au fost începute și rămân neautorizate.
