# AGM — SR-12 After-Departure / TripContext / Journey Adapter

Data: 2026-07-29  
Domeniu: adaptorul After-Departure către TripContext/Journey  
Verdict: **SR-12 — CLOSED / PASS**

## Rezultat

A fost introdus adaptorul intern After-Departure către Journey și contractul
versionat `after-departure-journey-handoff.v1`.

Contractul conține:

- `handoffId` determinist, derivat din evaluarea semantică;
- versiunea contractului de handoff;
- versiunea `common-outbox.v1` validată prin SR-10;
- modulul sursă `after-departure`;
- evaluarea completă After-Departure;
- starea de conectivitate offline.

Evaluarea este proiectată în `TripContext` drept
`after-departure-assessment.v1`. Evenimentul operațional și înregistrarea
Outbox sunt produse exclusiv prin porturile canonice Operational Context și
contractele SR-10/SR-11.

## Continuitate, offline și recovery

- dacă nu există un context activ, adaptorul creează contextul canonic prin
  serviciul existent;
- același assessment produce același `handoffId`;
- schimbarea conectivității nu schimbă identitatea assessment-ului;
- un assessment nou produce o identitate nouă;
- rezultatul transferat este adăugat o singură dată;
- replay-ul nu adaugă evenimente sau elemente Outbox duplicate;
- replay-ul rămâne idempotent după recrearea adaptorului și a porturilor;
- `OFFLINE` reflectă conectivitatea curentă;
- `SYNC_PENDING` rămâne activ pentru continuitatea Outbox;
- revenirea online elimină `OFFLINE` fără duplicarea rezultatului;
- recovery-ul din `TripContext` și event history este valid;
- ordinea `deviceSequence` este păstrată și proiectabilă prin contractul
  comun Outbox.

## Paritate funcțională

- evaluarea safe/unsafe/emergency este nemodificată;
- cele nouă stări și tranzițiile After-Departure sunt nemodificate;
- prioritățile, acțiunile, limitările și confirmările sunt nemodificate;
- UI-ul, markup-ul și textele sunt nemodificate;
- modul offline rămâne disponibil local;
- nu este executat niciun efect extern;
- limba POC continuă să utilizeze cheia existentă;
- nu a fost introdusă nicio cheie storage nouă.

## Module și fișiere afectate

- `apps/web/src/poc02-after-departure/after-departure.journey-adapter.ts`;
- `apps/web/src/poc02-after-departure/after-departure.controller.ts`;
- `apps/web/src/outbox/common-outbox.contract.ts`;
- `apps/web/scripts/test-sr12-after-departure-journey-adapter.ts`;
- `apps/web/scripts/test-mc3a-boundaries.ts`;
- `apps/web/package.json`;
- prezentul raport.

## Validări

| Gate | Rezultat |
|---|---|
| Contract `after-departure-journey-handoff.v1` | PASS |
| Utilizare `common-outbox.v1` | PASS |
| Identitate deterministă | PASS |
| Continuitate TripContext | PASS |
| Offline și `SYNC_PENDING` | PASS |
| Revenire online fără rezultat duplicat | PASS |
| Replay idempotent | PASS |
| Replay după recrearea adaptorului/porturilor | PASS |
| Fără evenimente sau Outbox records duplicate | PASS |
| Recovery din context și event history | PASS |
| Ordering `deviceSequence` | PASS |
| After-Departure POC Stage 3 | PASS |
| After-Departure POC Stage 4 | PASS |
| Operational Context | PASS |
| SR-10 și SR-11 | PASS |
| MC-3A complet | PASS — 22 verificări |
| Cicluri Web | PASS — 165 fișiere, 0 cicluri |
| Cicluri API | PASS — 81 fișiere, 0 cicluri |
| Regresie API completă | PASS — 19 suite, 99 teste |
| TypeScript/API Build | PASS |
| Web Build | PASS — 188 module |
| Browser E6.3 | PASS |
| Browser E6.4–E6.6 | PASS |
| Android `testDebugUnitTest` | BUILD SUCCESSFUL — 53 task-uri |

Build-ul separă serviciul comun TripContext într-un chunk de 5,40 kB.
Chunk-ul principal și avertismentul Vite istoric rămân la 526,07 kB. Pragul
și configurația avertismentului nu au fost modificate.

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

Implementarea POC existentă rămâne disponibilă. Rollback-ul:

1. elimină binding-ul implicit al adaptorului din controller;
2. elimină apelurile `journeyAdapter.record`;
3. elimină adaptorul și scutul SR-12;
4. restaurează regula de boundary After-Departure fără importuri externe.

Nu este necesară ștergerea sau transformarea `TripContext`, event history,
Outbox ori a vreunei chei storage. Nu este necesară intervenție Android sau
pe telefon.

## Verdict oficial

**SR-12 — CLOSED / PASS.**

Stare operațională:

- SR-08 — CLOSED / PASS;
- SR-09 — CLOSED / PASS;
- SR-10 — CLOSED / PASS;
- SR-11 — CLOSED / PASS;
- SR-12 — CLOSED / PASS;
- SR-06 — ON HOLD / Pending Final Device Validation;
- programul structural general — OPEN.

SR-13 și SR-14 nu au fost începute și rămân neautorizate.
