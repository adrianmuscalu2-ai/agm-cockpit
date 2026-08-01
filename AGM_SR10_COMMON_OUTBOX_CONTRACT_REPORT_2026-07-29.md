# AGM — SR-10 Common Outbox Contract

Data: 2026-07-29  
Domeniu: contract comun Outbox și adaptoare nemigrante  
Verdict: **SR-10 — CLOSED / PASS**

## Rezultat

A fost introdus contractul intern `common-outbox.v1`, care definește semantic:

- identitatea înregistrării, a operației, cheia de idempotency și stream-ul;
- secvența și poziția deterministă în coadă;
- stările `pending`, `syncing`, `conflict` și `acknowledged`;
- numărul încercărilor și momentul ultimei încercări;
- acknowledgement legat obligatoriu de identitatea operației;
- conflictul și strategiile explicite `retry-local`, `accept-remote` și
  `manual`;
- detecția conflictelor de integritate pentru aceeași cheie de idempotency.

Cele două Outbox-uri existente sunt proiectate în contractul comun prin
adaptoare pure, fără modificarea modelelor persistate:

| Outbox | Record identity | Operation identity | Idempotency | Ordering |
|---|---|---|---|---|
| Pre-Departure | `clientSessionId` | `clientSessionId` | `clientSessionId` | poziția existentă + `serverRevision` |
| Operational Context | `eventId` | `operationId` | `eventId` | poziția existentă + `deviceSequence` |

Statusul existent Operational Context `confirmed` este mapat explicit și doar
în proiecție la termenul comun `acknowledged`. Valoarea stocată nu este
modificată.

## Controlul migrării și comportamentului

- cheile `agm.pre-departure.outbox.v1`,
  `agm.pre-departure.sync-ack.v1` și
  `agm.premium.operational-outbox.v1` sunt nemodificate;
- formatele JSON existente sunt nemodificate;
- cozile nu au fost comasate;
- nu există dual-write;
- niciun producător sau consumator runtime nu a fost comutat;
- nu a fost ștearsă sau transformată nicio înregistrare;
- adaptoarele oferă o repetiție controlată, read-only, a mapării semantice;
- retry păstrează identity, idempotency key, payload și `queuedAt`;
- ordering-ul este determinist prin poziție, secvență, timestamp și record ID;
- acknowledgement-ul cu identitate diferită este respins;
- aceeași cheie de idempotency cu alt `operationId` este respinsă ca
  `OUTBOX_IDEMPOTENCY_CONFLICT`;
- conflict resolution este explicit și nu elimină automat datele locale.

Comportamentul funcțional al celor două Outbox-uri specializate rămâne
autoritar și neschimbat.

## Module și fișiere afectate

- `apps/web/src/outbox/common-outbox.contract.ts`;
- `apps/web/src/outbox/pre-departure-outbox.adapter.ts`;
- `apps/web/src/outbox/operational-outbox.adapter.ts`;
- `apps/web/src/outbox/index.ts`;
- `apps/web/scripts/test-sr10-common-outbox-contract.ts`;
- `apps/web/package.json`;
- prezentul raport.

Nu au fost modificate implementările runtime:

- `apps/web/src/pre-departure/pre-departure.outbox.ts`;
- `apps/web/src/premium-operational-context/local-adapters.ts`;
- `apps/web/src/premium-operational-context/ports.ts`.

## Validări

| Gate | Rezultat |
|---|---|
| Identity și idempotency comune | PASS |
| Duplicate compatibil / conflict de idempotency | PASS |
| Ordering determinist | PASS |
| Retry cu identity stabilă | PASS |
| Conflict și cele 3 strategii de rezolvare | PASS |
| Acknowledgement și identity mismatch | PASS |
| Mapare `confirmed` → `acknowledged` | PASS |
| Pre-Departure Outbox existent | PASS |
| Operational Context Outbox existent | PASS |
| MC-3A complet | PASS — 20 verificări |
| Cicluri Web | PASS — 163 fișiere, 0 cicluri |
| Cicluri API | PASS — 81 fișiere, 0 cicluri |
| Regresie API completă | PASS — 19 suite, 99 teste |
| TypeScript/API Build | PASS |
| Web Build | PASS — 177 module |
| Browser E6.3 | PASS |
| Browser E6.4–E6.6 | PASS |
| Android `testDebugUnitTest` | BUILD SUCCESSFUL — 53 task-uri |

Prima execuție TypeScript a identificat că statusul specializat
`confirmed` nu era încă mapat la statusul comun `acknowledged`. Adaptorul a
fost corectat prin mapare pură, a fost adăugată caracterizarea explicită, iar
întregul set Web/MC-3A/Operational Context/Build/Browser a fost repetat cu
rezultat PASS.

Build-ul Web rămâne la 177 module și chunk-ul istoric de 526,07 kB, deoarece
contractele nu sunt încărcate în runtime. Pragul Vite și configurația nu au
fost modificate.

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

Rollback-ul nu implică date sau runtime:

1. se elimină directorul intern `apps/web/src/outbox`;
2. se elimină scutul SR-10 din comanda MC-3A;
3. se elimină testul SR-10.

Outbox-urile specializate continuă să funcționeze independent înainte, în
timpul și după rollback. Nu este necesară migrare inversă, restaurare storage,
intervenție Android sau acces la telefon.

## Verdict oficial

**SR-10 — CLOSED / PASS.**

Stare operațională:

- SR-08 — CLOSED / PASS;
- SR-09 — CLOSED / PASS;
- SR-10 — CLOSED / PASS;
- SR-06 — ON HOLD / Pending Final Device Validation;
- programul structural general — OPEN.

SR-11–SR-14 nu au fost începute și rămân neautorizate. Adaptarea runtime,
comasarea cozilor sau orice migrare viitoare necesită mandat operațional
separat.
