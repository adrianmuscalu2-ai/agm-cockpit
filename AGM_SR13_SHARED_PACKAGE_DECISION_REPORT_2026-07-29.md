# AGM — SR-13 Controlled Decision for `@agm/shared`

Data: 2026-07-29  
Domeniu: decizia arhitecturală privind pachetul workspace `@agm/shared`  
Verdict: **SR-13 — CLOSED / PASS**

## Decizie

**`@agm/shared` se păstrează neschimbat. Nu se mută niciun contract în pachet
în cadrul SR-13.**

Decizia aplică explicit criteriul roadmap-ului: un contract poate fi mutat în
`@agm/shared` numai dacă are ownership unic, politică de versiune și minimum
doi consumatori cross-package demonstrați.

Inventarul actual arată zero consumatori pentru `@agm/shared`. Pachetul este
privat și conține doar markerul existent:

```ts
export const AGM_ARCHITECTURE_VERSION = '1.0';
```

Nu au fost adăugate dependențe în Web sau API și nu a fost modificat package
graph-ul workspace.

## Evaluarea contractelor SR-09–SR-12

| Candidat | Owner actual | Consumatori demonstrați | Decizie |
|---|---|---:|---|
| SR-09 Transport use cases/repositories | API | 1 package (`@agm/api`) | rămâne în API |
| DTO-uri și contracte HTTP Transport | API public | API + clienți externi, dar protejate | nu se mută |
| SR-10 `common-outbox.v1` | Web continuity | 1 package (`@agm/web`) | rămâne în Web |
| SR-11 Pre-Departure Journey handoff | Web Pre-Departure/Journey | 1 package (`@agm/web`) | rămâne în Web |
| SR-12 After-Departure Journey handoff | Web After-Departure/Journey | 1 package (`@agm/web`) | rămâne în Web |
| TripContext/Operational Event | Web Operational Context | 1 package (`@agm/web`) | rămâne în Web |

Mai multe module din același package nu constituie reutilizare
cross-package. Extracția contractelor Web în `@agm/shared` ar muta ownership-ul
fără al doilea consumator real. Extracția DTO-urilor API ar încălca protecția
API-ului public și ar crea o schimbare de contract neautorizată.

## Justificare tehnică

Păstrarea structurii actuale:

- evită cuplarea speculativă dintre Web și API;
- păstrează dependency direction existentă;
- menține ownership-ul contractelor lângă runtime-ul lor autoritar;
- evită transformarea `@agm/shared` într-un pachet generic fără responsabil;
- nu introduce framework, browser, NestJS, Prisma sau infrastructură într-un
  package comun;
- păstrează posibilitatea unei extracții ulterioare când apare al doilea
  consumator real;
- nu impune migrare, compatibilitate duală sau versiuni paralele.

Un mandat viitor poate reevalua decizia numai după demonstrarea simultană a:

1. minimum doi consumatori din package-uri distincte;
2. unui owner unic;
3. unei politici explicite de versiune și compatibilitate;
4. independenței față de framework și infrastructură;
5. testelor de contract în fiecare consumator;
6. unui rollback fără schimbarea datelor persistate sau a API-ului public.

## Fișiere afectate

Nu există modificări de cod, configurare sau package metadata.

Singurul fișier nou este prezentul raport:

- `AGM_SR13_SHARED_PACKAGE_DECISION_REPORT_2026-07-29.md`.

Hash-urile `@agm/shared` au rămas identice:

- `packages/shared/package.json`:
  `F4E699F4BBFC70B7641224D8188A818BFE7FB957CDF818926C3D76A53460F047`;
- `packages/shared/src/index.ts`:
  `15A4A453408F115FA43D5E3134675D1E45FDB480B70264F447FA6BC5AA268198`.

## Validări

| Gate | Rezultat |
|---|---|
| Inventar `@agm/shared` | PASS — 0 consumatori |
| Contracte SR-09–SR-12 evaluate | PASS |
| Ownership și dependency direction | PASS |
| MC-3A complet | PASS — 22 verificări |
| Operational Context | PASS |
| After-Departure Stage 3/4 | PASS |
| Cicluri Web | PASS — 165 fișiere, 0 cicluri |
| Cicluri API | PASS — 81 fișiere, 0 cicluri |
| Regresie API completă | PASS — 19 suite, 99 teste |
| TypeScript/API Build | PASS |
| Web Build | PASS — 188 module |
| Browser E6.3 | PASS |
| Browser E6.4–E6.6 | PASS |
| Android `testDebugUnitTest` | BUILD SUCCESSFUL — 53 task-uri |

Web Build este identic cu SR-12: serviciul comun TripContext rămâne într-un
chunk de 5,40 kB, iar chunk-ul principal rămâne 526,07 kB. Pragul Vite și
configurația avertismentului nu au fost modificate.

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

Nu există modificări runtime de retras. Rollback-ul SR-13 constă exclusiv în
retragerea raportului de decizie. Pachetul și consumatorii rămân în aceeași
stare înainte, în timpul și după rollback.

## Verdict oficial

**SR-13 — CLOSED / PASS.**

Decizia PASS validează păstrarea controlată a structurii actuale; nu declară
implementarea unui package comun nou.

Stare operațională:

- SR-08–SR-13 — CLOSED / PASS;
- SR-06 — ON HOLD / Pending Final Device Validation;
- programul structural general — OPEN.

SR-14 nu a fost început și rămâne neautorizat.
