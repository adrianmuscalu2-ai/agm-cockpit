# AGM Cockpit — Architecture Status

**Data reconcilierii:** 2 august 2026

**Statut document:** sursa canonică pentru starea arhitecturii și a implementării

**Baseline oficial protejat:** AGM v1.2.9 Stable Baseline

**Schimbare succesoare în curs de integrare:** AGM-CHG-20260801-ACCESS-PREMIUM-001

## 1. Autoritate și reguli de interpretare

Acest document descrie starea curentă a produsului. Pentru strategie și ordinea
dezvoltării, autoritatea rămâne `ROADMAP.md`. Pentru dovada închiderii unui modul,
autoritatea rămâne dosarul său din `evidence/governance/modules/`.

Ordinea de prevalență este:

1. baseline-ul oficial și manifestul său;
2. deciziile de închidere și fișierele `MODULE_STATUS.md`;
3. change record-urile succesoare aprobate;
4. prezentul rezumat arhitectural;
5. rapoartele istorice.

Un modul `PASS / CLOSED` este implementat și protejat în limita contractului său.
Această stare nu înseamnă că toate extinderile viitoare ale produsului sunt deja
implementate. O schimbare validată devine parte din baseline numai după integrarea,
retestarea, constituirea și aprobarea unui baseline succesor.

## 2. Baseline oficial

`AGM v1.2.9 Stable Baseline` este referința oficială pentru dezvoltarea ulterioară.
Auditul general, programul structural MC-3B, SR-01–SR-14 și validarea finală pe
dispozitiv sunt `CLOSED / PASS`; nu există porți obligatorii de audit rămase deschise
pentru acest baseline.

Artefactul Android oficial al baseline-ului este:

- `AGM-Cockpit-1.2.9-sr06-final.apk`;
- `applicationId`: `com.agm.cockpit`;
- `versionCode`: `15`;
- `versionName`: `1.2.9-sr06-final`;
- validat pe Samsung Galaxy S25, Android 16 / SDK 36;
- SHA-256: `85C89D8B5C2C4287E2FCDFB806C8CCEA669E2945B5FF03ADE457E68422E7C55E`.

Aplicația Web oficială este `https://app.agmcockpit.com/`. API-ul de producție
utilizat de build-ul Web este `https://api.agmcockpit.com/api/v1`.

## 3. Arhitectura implementată

AGM Cockpit nu mai este doar un backend. Suprafața implementată cuprinde:

- aplicație Web/PWA construită cu Vite și TypeScript;
- aplicație Android bazată pe Capacitor, cu integrare nativă pentru capabilitățile
  validate pe dispozitiv;
- API NestJS cu prefixul `/api/v1`;
- PostgreSQL și Prisma pentru persistența server-side;
- autentificare JWT, autorizare, separare pe companie și audit;
- shell modular, navigație, stare compusă, i18n RO/DE/EN și storage local;
- fluxuri Translator, Mail, Contacts, OCR, incidente, Before Departure și After
  Departure;
- transport lifecycle, validation reports, evidence metadata și financial ledger;
- outbox, idempotency, ordine, retry, conflict și recovery;
- Turn Command Center și capabilități Premium guvernate.

Endpoint-ul de sănătate rămâne sub `/api/v1`; absența unei rute API la `/` nu este
un defect de readiness.

## 4. Module închise oficial

Toate modulele cu dosar de închidere v1.0 sunt `PASS / CLOSED`:

| Familie | Module | Stare |
| --- | --- | --- |
| APP | APP-001–APP-015 | PASS / CLOSED |
| API | API-001–API-008 | PASS / CLOSED |
| PRE | PRE-001–PRE-008 | PASS / CLOSED |
| DATA | DATA-001 | PASS / CLOSED |
| OPS | OPS-001–OPS-004 | PASS / CLOSED |

În total, 36 de module sunt închise oficial în limitele contractelor și dovezilor
lor. `OPS-005 — Telemetrie continuă` rămâne separat, `PLANNED / INACTIVE` și nu
este autorizat prin închiderile existente.

## 5. Capabilități validate în baseline

Baseline-ul oficial include și protejează, conform dosarelor aplicabile:

- pornirea și stabilitatea runtime-ului Web/Android;
- Translator și integrarea controlată API/AI;
- autentificarea utilizatorului și accesul administrativ Turn;
- transporturile și lifecycle-ul validat;
- Before Departure și continuitatea After Departure;
- OCR, cameră și capabilități native validate;
- Mail Assistant cu handoff extern controlat;
- Contacts, profil șofer, i18n și storage local;
- incident reporting, validation reports și audit;
- funcționarea offline, outbox și recovery;
- shell-ul Premium și modulele PRE în limitele contractelor lor;
- Diagnostics și `AdminIncidentReportV1` cu date mascate.

Stările lifecycle principale validate sunt:

```text
Imported
Accepted
AtPickup
PickupCompleted
InTransport
AtDelivery
DeliveryCompleted
DocumentsSubmitted
Paid
Closed
Archived
```

`MissionPaused`, `IncidentReported` și `Cancelled` există în model, dar nu fac parte
din happy path-ul principal validat al vechiului checkpoint lifecycle.

## 6. Schimbarea Access / Premium

`AGM-CHG-20260801-ACCESS-PREMIUM-001` are verdictul curent `PASS / VALIDATED`.
Contractele API/Web, gateway-ul `/access`, sesiunea, entitlement-ul și enforcement-ul
per rută sunt implementate și validate. Producția nu a fost modificată.

Schimbarea nu este încă declarată parte din baseline-ul oficial v1.2.9. Pentru
oficializare mai sunt necesare:

1. păstrarea scutului CSS SR-14 reconciliat la cascada Access/Premium și Android Wave 1;
2. commit controlat și identificarea exactă a sursei;
3. constituirea unui release candidate;
4. retest Browser și Android;
5. aprobarea și arhivarea baseline-ului succesor.

## 7. Starea validării curente a workspace-ului

La reconcilierea din 2 august 2026:

- API Jest: 27 suite, 136 teste — PASS;
- API build — PASS;
- Web production build — PASS;
- contract Access/Premium — PASS;
- regresia structurală Web până la SR-12 — PASS;
- SR-14 CSS parity — PASS după reconcilierea P0 din 9 august 2026; hash-ul
  protejat include cascada Access/Premium și ajustările Android Wave 1 validate.

Reconcilierea SR-14 nu modifică baseline-ul oficial v1.2.9 și nu redeschide
candidatul Basic înghețat; ea protejează cascada succesoare deja validată.

## 8. Condiții rămase pentru AGM Basic publicabil

Modulele Basic existente trebuie integrate într-un flux de produs și validate ca
release public. Restanțele aprobate sunt:

- atașamente în Mail Assistant;
- WhatsApp Share către aplicația instalată;
- optimizare și validare finală OCR Android;
- actualizarea documentației juridice pentru cameră/OCR;
- Privacy Policy publică;
- date oficiale de suport și Impressum;
- APK/AAB semnat pentru release;
- Google Play Internal Testing;
- QA final, inclusiv teste end-to-end și verificare pe dispozitiv.

Aceste condiții nu schimbă starea `PASS / CLOSED` a modulelor de bază; ele reprezintă
integrarea și porțile de publicare ale produsului AGM Basic.

## 9. Condiții Premium ulterioare

Dezvoltarea Premium completă urmează etapele canonice din `ROADMAP.md`. Condițiile
arhitecturale încă deschise includ EventStore server-side, versiunea evenimentelor,
proiecția comună UI, sincronizarea și recovery end-to-end și migrarea controlată a
modulelor Premium rămase.

## 10. Actualizare Premium — 11 august 2026

Vertical Slice A (`required-document`) este `PASS / CLOSED`, cu Product Owner
Acceptance acordat. Matricea Desktop A/B/H/K/L/O, Android Samsung SM-S931B,
Evidence Manifest și Browser release gate sunt complete și acceptate.

Controlled AGM Playwright/Chromium PASS este dovadă Browser oficială și
suficientă. Integrated Browser `iab` rămâne o limitare externă
`OPEN / NON-BLOCKING` și probă interactivă opțională.

Vertical Slice B (`road-control`) este de asemenea `PASS / CLOSED`, cu Product
Owner Acceptance acordat la 11 august 2026. Android pe Samsung SM-S931B,
safety gate, fluxul Control rutier, offline/SYNC_PENDING, outbox, reconnect,
deduplicare, restart/recovery, i18n 9/9, buildul Web și Evidence Manifest sunt
complete și acceptate.

Contractul extern rămâne obligatoriu:
`PREPARE → HUMAN CONFIRM`. Reconnect, outbox și recovery nu pot transforma o
pregătire într-o trimitere Email/WhatsApp automată.

Vertical Slice A și Vertical Slice B sunt `PASS / CLOSED`. Celelalte 22 de
situații sunt `NOT STARTED / NOT AUTHORIZED` și necesită mandate separate.

## 11. Regula de actualizare

Acest document se actualizează la fiecare închidere de modul, schimbare de baseline
sau modificare a stării unei porți de release. Rapoartele istorice nu se rescriu;
orice formulare conflictuală din ele este interpretată în contextul datei și al
baseline-ului pe care îl descriu.
