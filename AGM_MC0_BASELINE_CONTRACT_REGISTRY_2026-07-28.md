# AGM — MC-0 Baseline, Contract Registry și Characterization Plan

Data: 2026-07-28  
Etapă: MC-0  
Regim: inventariere și documentare; fără refactorizare  
Commit de referință: `9956eb188fdd988bf0d7af93241c3c43962d9b39`  
Tree hash commit: `ecf09a5d8ad7ba2a21cd284ca4793dfed704ec5e`

## 1. Obiectiv

MC-0 fixează starea reală a sistemului înaintea primei schimbări de consolidare:

- entrypoint-uri;
- contracte;
- storage keys;
- ownership;
- teste;
- hotspot-uri;
- material protejat;
- condițiile primului increment.

MC-0 nu modifică aplicația și nu autorizează cleanup.

## 2. Protected scope

Materialul de concurs este exclus conform:

`AGM_COMPETITION_MATERIAL_PROTECTION_REGISTER_2026-07-28.md`

Referințe înghețate:

- `development/post-contest`:
  `9c3b374d319c0de3026484c6400f27c662cd16a6`;
- `baseline/agm-basic-v1`:
  `7670640a7a8cdcd49418bfc85079c33105094d78`;
- tag `agm-cockpit-basic-v1.0.0`.

Orice ambiguitate produce:

`STOP — PROTECTED SCOPE UNCLEAR`.

## 3. Working tree baseline

Working tree-ul nu este curat. Au fost identificate modificări și fișiere
neversionate preexistente în:

- traducere API;
- bootstrap și stiluri web;
- Android;
- service worker;
- incident journal;
- diagnostics/admin report;
- distribuția Android;
- configurația și runbook-urile Production;
- documentația operațională și strategică.

Regulă:

- nu se resetează;
- nu se suprascrie;
- nu se amestecă într-un increment de consolidare;
- fiecare viitor diff trebuie comparat cu acest baseline, nu numai cu `HEAD`.

## 4. Entrypoint registry

| Suprafață | Entrypoint | Rol | Stare |
| --- | --- | --- | --- |
| Browser principal | `apps/web/index.html` → `src/main.ts` | AGM Basic/Cockpit și acces Premium | Active |
| Pre-Departure | `before-departure.html` → `pre-departure.entry.ts` | flux E6 Pre-Departure | Active |
| After-Departure | `after-departure.html` → `poc02-after-departure/after-departure.entry.ts` | POC operațional după plecare | Active POC |
| API | `apps/api/src/main.ts` → `AppModule` | NestJS API | Active Production |
| Android | `MainActivity extends BridgeActivity` | Capacitor host | Active |
| Native Audio | `AgmAudioPlugin` | microfon/TTS native | Active |
| Native Email | `AgmEmailPlugin` | email handoff | Active |
| Native Diagnostics | `AgmDiagnosticsPlugin` | raport tehnic sigur | Active local change |

After-Departure este entrypoint de build. Nu este orphan și nu poate fi eliminat.

## 5. Build registry

Două surse definesc intrările web:

- `apps/web/vite.config.mjs`;
- `apps/web/scripts/build-web.mjs`.

Ambele definesc:

- `index.html`;
- `before-departure.html`;
- `after-departure.html`;
- injectarea linkului POC.

Există divergență de encoding între textele injectate.

Clasificare:

**ACTIVE DUPLICATION — MC-1 CANDIDATE**.

## 6. Storage key registry

| Key | Owner curent | Tip | Regim |
| --- | --- | --- | --- |
| `agm.profile.settings` | Profile | localStorage | Active |
| `agm.profile.preferredLanguage` | Profile compatibility | localStorage | Legacy compatibility |
| `agm.contact-manager.contacts` | Contact Manager | localStorage | Active |
| `agm.message-library.preferences.v1` | Message Library | localStorage | Active |
| `agm.ocr.history.v1` | OCR Basic | localStorage | Active |
| `agm.admin.session` | Admin | sessionStorage | Active |
| `agm.tutorial.completed.v1` | Tutorial | localStorage | Active |
| `agm.tutorial.email.completed.v1` | Email Tutorial | localStorage | Active |
| `agm.roadmap.invitation.v1` | Roadmap UI | localStorage | Active |
| `agm.turn.incident-journal.v1` | Turn Incident Journal | localStorage | Active |
| `agm.e6.pre-departure.session.v1` | Pre-Departure | localStorage | Active |
| `agm.pre-departure.sync-meta.v1` | Pre-Departure Sync | localStorage | Active |
| `agm.pre-departure.outbox.v1` | Pre-Departure Sync | localStorage | Active specialized |
| `agm.pre-departure.sync-ack.v1` | Pre-Departure Sync | localStorage | Active specialized |
| `agm.pre-departure.language` | Pre-Departure UI | localStorage | Active |
| `agm.auth.accessToken` | Auth bridge | local/session storage | Sensitive; review required |
| `agm.premium.trip-context.v1` | Operational Context | localStorage | Canonical local |
| `agm.premium.operational-events.v1` | Operational Context | localStorage | Canonical local |
| `agm.premium.operational-outbox.v1` | Operational Context | localStorage | Canonical local |
| `agm.premium.device-id.v1` | Operational Context | localStorage | Active |
| `agm.poc02.language` | After-Departure POC | localStorage | Active POC |

Constatare:

Există două outbox-uri:

- unul specializat Pre-Departure;
- unul în Operational Context.

Nu se declară duplicare eliminabilă înaintea mapării semantice și a migrării
controlate.

## 7. Contract registry

### 7.1 API public

- `pre-departure-v1.openapi.yaml`;
- `pre-departure-confirmation-v1.openapi.yaml`;
- `pre-departure-issues-v1.openapi.yaml`.

### 7.2 Pre-Departure domain/API

- persistence model;
- session types;
- validation;
- confirmation contract;
- issue contract;
- sync DTO/service.

### 7.3 Operational Context

- TripContext types;
- lifecycle map;
- state machine;
- service;
- ports;
- local adapters;
- OperationalEvent;
- recovery;
- Pre-Departure integration.

### 7.4 Shared package

`packages/shared/src/index.ts` exportă numai
`AGM_ARCHITECTURE_VERSION = '1.0'`.

Nu au fost găsiți consumatori `@agm/shared`.

Clasificare:

**ORPHAN CANDIDATE / FUTURE CONTRACT HOME**.

Decizia păstrare/reproiectare/eliminare necesită mandat separat.

### 7.5 Contracte structurale încă nedigitalizate

Definite documentar, dar fără un contract comun de cod confirmat:

- `IntentEnvelope`;
- `OperationalCase`;
- `TaskGraph`;
- `CaptureIntent`;
- `DecisionEnvelope`;
- `CommunicationDraft`;
- `KnowledgeEntry`;
- `Handoff`;
- capability request/result.

Acestea aparțin viitoarei implementări Premium, nu consolidării MC-0/MC-1.

## 8. Ownership matrix

| Componentă | Accountable | Executor/Custode | Validator |
| --- | --- | --- | --- |
| Browser/Android shell | Frontend & Website Owner | Frontend Experience | QA/Inspector |
| `main.ts` | Frontend & Website Owner | Frontend Experience | QA/Inspector |
| CSS global | Frontend & Website Owner | Frontend Experience | QA vizual |
| Vite/build config | Release & Operations | Frontend/Release | QA/Inspector |
| Pre-Departure UI | Frontend & Website Owner | Premium Frontend | QA/Inspector |
| TripContext/Operational Context | Architecture Guardian | Backend/Data + Frontend adapters | Inspector |
| Pre-Departure API/sync | Backend & Data Custodian | Backend | API QA/Inspector |
| Transport lifecycle | Backend & Data Custodian | Backend | Inspector |
| Prisma/schema | Data Accountable | Backend & Data Custodian | Inspector |
| AI governance | AI & Localization Owner | AI/Engineering | Inspector |
| Translation | AI & Localization Owner | API/Frontend adapters | QA/Inspector |
| Native plugins | Frontend & Website Owner | Android | QA + utilizator |
| Incident Journal | Turn Operations | Frontend/Chronicler | Inspector |
| Competition material | Turn Command Center | read-only custodians | Independent Validator |

Un increment nu poate avea doi accountable.

## 9. Characterization test matrix

### 9.1 Executate în audit

| Domeniu | Test | Rezultat |
| --- | --- | --- |
| Premium foundation | `test-premium-foundation.ts` | PASS |
| Operational Context | `test-premium-operational-context.ts` | PASS |
| API | Jest, 7 suite/28 teste | PASS |

### 9.2 Teste existente de inclus înaintea refactorizării

| Domeniu | Test existent |
| --- | --- |
| Pre-Departure core | `test-e6-2-pre-departure-core.ts` |
| Browser shell | `test-e6-3-browser-shell.ts` |
| Pre-Departure stages | `test-e6-4-to-e6-6.ts` |
| Issue management | `test-pre-departure-issue-management.ts` |
| Outbox | `test-pre-departure-outbox.ts` |
| UUID fallback | `test-pre-departure-uuid-fallback.ts` |
| Final report | `test-pre-departure-final-report.ts` |
| After-Departure | `test-poc02-after-departure.ts` |
| After-Departure stage 4 | `test-poc02-stage4.ts` |
| Mail translation/send guard | `test-mail-translation-send-guard.ts` |
| Admin report | `test-admin-report.ts` |

### 9.3 Coverage lipsă înainte de MC-2+

- bootstrap `main.ts`;
- router/view transitions;
- state restoration;
- storage migration/reset;
- service worker registration;
- voice Browser/native parity;
- visual regression pentru `styles.css`;
- build dev/prod parity;
- accessibility smoke;
- Android instrumentation reală;
- transport lifecycle unit decomposition;
- integration map între Pre-Departure session și TripContext;
- handoff către After/Journey.

## 10. Baseline hashes pentru hotspot-uri

| Fișier | SHA-256 |
| --- | --- |
| `apps/web/src/main.ts` | `B925A8055207631FA2F52A8ED78CF077ECE502A1A977E24F828C056B713B0146` |
| `apps/web/src/styles.css` | `2A676A4ED84022E5801150155B2F6E317892A15E45522F4CA3A972F4D8D39A4A` |
| `app-i18n.dictionary.ts` | `A4A77D4B6E95516DFC8DF4FBA40663B53628BBDA0BD5073B2ED0869F4FEE3E87` |
| `vite.config.mjs` | `AC3490A4591D6B7E6A3440AA88A9F15DC9DC60ED3B3FEC15488CAF3C07F1DBA2` |
| `scripts/build-web.mjs` | `B8483E95976237228CD46A0DC72823915FFAC034DCC17E4CDD6894E63ABEA85F` |
| `pre-departure.controller.ts` | `68458346496D5BEB050C3EC935B7E5DE1523F00279AC006177A9554B2C39980D` |
| `trip-context.service.ts` | `3C6EA866AE72B3256C57E9E4020483FE3366248395B698C2C791642E4409F91B` |
| `after-departure.controller.ts` | `F0B9D8B7B565272109F94E0BF9F50266B37465B462ED97B59CA3E890D0F2A519` |
| `apps/api/src/app.module.ts` | `7E37466DB3F32DE61B2574AB2B530F64DCAFB43D4AD9DCE2C782391077284CFB` |
| `transports.service.ts` | `68EC193A717EC0CA2A8A8918F24AB26741884F209029BAC16E16F026788DFEC4` |
| `pre-departure-sync.service.ts` | `B4B1FA77A0B700DB676DDC3DAFD2CD9108C04758AC2252B6BA97681CE0F02E33` |
| `prisma/schema.prisma` | `BB6C3991E9C8D12640D3DC2178842886E409B7F4A5F6305B12F9808AE71A4137` |

Hash-urile reprezintă working tree-ul observat, inclusiv modificările locale
preexistente.

## 11. Screenshot și device baseline necesar

Înainte de MC-2 și MC-3 trebuie arhivate controlat:

- Home Browser desktop;
- Translator;
- Email Assistant;
- Contact Manager;
- OCR;
- Profile/Legal;
- Turn Command Center;
- Premium landing;
- Pre-Departure: inițial, în progres, blocked, confirmed;
- After-Departure: safe/unsafe/emergency;
- Android: aceleași fluxuri critice;
- orientare portret și ecran îngust;
- voice permission și fallback;
- offline/sync banners.

Capturile nu se regenerează peste dovezi istorice sau materialul concursului.

## 12. Checkpoint MC-0

MC-0 poate fi închis dacă:

- baseline commit/tree sunt înregistrate;
- working tree-ul local este consemnat;
- materialul concursului este protejat;
- entrypoint-urile sunt inventariate;
- storage keys sunt inventariate;
- contractele și lipsurile sunt identificate;
- ownership-ul este atribuit;
- testele existente și lipsurile sunt listate;
- hash-urile hotspot-urilor sunt înregistrate;
- primul increment este limitat și reversibil.

Verdict:

**MC-0 DOCUMENTATION COMPLETE — READY FOR INDEPENDENT REVIEW**

## 13. Propunerea limitată MC-1

### Obiectiv unic

Unificarea definiției configurației de build web fără schimbarea output-ului.

### Scope propus

- `apps/web/vite.config.mjs`;
- `apps/web/scripts/build-web.mjs`;
- un fișier nou de fabrică/config comun;
- teste de build parity strict necesare.

### În afara scope-ului

- `main.ts`;
- CSS;
- Pre/After-Departure logic;
- API;
- Prisma;
- Android native;
- service worker;
- material de concurs;
- Production.

### Criterii

- aceleași trei entrypoint-uri;
- același proxy dev;
- aceeași navigare injectată;
- UTF-8 corect;
- build output parity;
- testele existente PASS;
- zero diferențe funcționale Browser/Android;
- checksum-urile materialului de concurs neschimbate.

MC-1 necesită mandat explicit separat.

## 14. Verdict

# MC-0 COMPLETE — CONSOLIDATION BASELINE REGISTERED

Nu s-au implementat funcții și nu s-au modificat sursele aplicației în MC-0.

