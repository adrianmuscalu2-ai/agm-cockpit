# AGM Cockpit — Architecture Status

**Data reconcilierii curente:** 7 septembrie 2026

**Statut document:** sursa canonică pentru starea arhitecturii și a implementării

**Module Governance Baseline:** 36 module `PASS / CLOSED`, conform dosarelor v1.0

**Current Stable Release:** AGM Cockpit 1.3.0 / Android versionCode 21

**Current Source Line:** AGM Cockpit 1.4.0

**Current Release Candidate:** 1.4.0 / Android versionCode 22; statutul publicării se stabilește exclusiv din workflow și runtime

**Production snapshot la începutul reconcilierii:** revision `1fd434f2621b3b2225cc23ffab5ad2922a26bb5b`; workflow `34040489949`; Web bundle `assets/main-CJ9re3-m.js`

**Governance interpretation:** `AGM_COCKPIT_GOVERNANCE_REGISTER_V1_1.md`

## 1. Autoritate și reguli de interpretare

Acest document descrie starea curentă a produsului. Pentru strategie și ordinea
dezvoltării, autoritatea rămâne `ROADMAP.md`. Pentru dovada închiderii unui modul,
autoritatea rămâne dosarul său din `evidence/governance/modules/`.

Ordinea de prevalență este:

1. mandatul sau decizia explicită și curentă a Product Ownerului;
2. Governance Register v1.1, aprobat și activ;
3. deciziile de închidere și fișierele `MODULE_STATUS.md`;
4. change record-urile succesoare aprobate;
5. contractele și manifestele artefactului/release-ului curent;
6. prezentul rezumat arhitectural;
7. rapoartele istorice.

Documentele `PROPOSED`, `FINAL CANDIDATE`, `NOT ACTIVE` sau
`CONTRACTED_NOT_IMPLEMENTED` nu generează autoritate. În special, Contractul
Organizațional AGM v1 nu participă la precedența activă până la o decizie
explicită ulterioară.

Un modul `PASS / CLOSED` este implementat și protejat în limita contractului său.
Această stare nu înseamnă că toate extinderile viitoare ale produsului sunt deja
implementate. O schimbare validată devine parte din baseline numai după integrarea,
retestarea, constituirea și aprobarea unui baseline succesor.

## 2. Identitățile canonice separate

### 2.1 Module Governance Baseline

Cele 36 de module APP-001–APP-015, API-001–API-008, PRE-001–PRE-008,
DATA-001 și OPS-001–OPS-004 sunt `PASS / CLOSED`. Această stare este protejată
în limitele contractului și artefactului validat. G0–G11 reprezintă coverage,
nu rerun; schimbările succesoare redeschid numai gate-urile afectate.

### 2.2 Current Stable Release

Ultimul release stabil identificabil fără ambiguitate este AGM Cockpit 1.3.0,
cu Android `versionCode 21`, conform auditului de publicare și dovezii pe
dispozitiv real din 27 august 2026.

### 2.3 Current Source Line

Manifestele root și Web declară 1.4.0. Aceasta este linia de sursă curentă și nu
este promovată automat la stable release sau Production identity.

### 2.4 Current Release Candidate

Linia de sursă conține candidatul 1.4.0 / Android `versionCode 22`. Statutul său
de publicare nu este dedus din acest document; îl stabilesc numai workflow-ul de
release și validarea runtime a artifactului promovat.

### 2.5 Production snapshot la începutul reconcilierii

Identitatea Production verificată înaintea acestui candidat, la 7 septembrie 2026, este revizia
`1fd434f2621b3b2225cc23ffab5ad2922a26bb5b`, workflow GitHub Actions
`34040489949`, bundle Web `assets/main-CJ9re3-m.js`; workflow-ul este `success`,
iar rutele publice Web și API răspund HTTP 200. Verdictul acelei dovezi rămâne limitat
la scope-ul său și nu este extins retroactiv la întreg produsul.

## 3. Baseline istoric v1.2.9

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

## 4. Arhitectura implementată

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

## 5. Module închise oficial

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

## 6. Capabilități validate în baseline

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

## 7. Schimbarea Access / Premium

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

## 8. Snapshot istoric al validării workspace-ului

La snapshot-ul istoric din 2 august 2026:

- API Jest: 27 suite, 136 teste — PASS;
- API build — PASS;
- Web production build — PASS;
- contract Access/Premium — PASS;
- regresia structurală Web până la SR-12 — PASS;
- SR-14 CSS parity — PASS după reconcilierea P0 din 9 august 2026; hash-ul
  protejat include cascada Access/Premium și ajustările Android Wave 1 validate.

Reconcilierea SR-14 nu modifică baseline-ul oficial v1.2.9 și nu redeschide
candidatul Basic înghețat; ea protejează cascada succesoare deja validată.

## 9. Condiții istorice pentru AGM Basic publicabil

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

## 10. Condiții Premium ulterioare

Dezvoltarea Premium completă urmează etapele canonice din `ROADMAP.md`. Condițiile
arhitecturale încă deschise includ EventStore server-side, versiunea evenimentelor,
proiecția comună UI, sincronizarea și recovery end-to-end și migrarea controlată a
modulelor Premium rămase.

## 11. Snapshot Premium — 11 august 2026

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

## 12. Regula de actualizare

Acest document se actualizează la fiecare închidere de modul, schimbare de baseline
sau modificare a stării unei porți de release. Rapoartele istorice nu se rescriu;
orice formulare conflictuală din ele este interpretată în contextul datei și al
baseline-ului pe care îl descriu.
