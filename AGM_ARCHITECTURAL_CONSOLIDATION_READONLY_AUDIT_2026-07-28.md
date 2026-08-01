# AGM — Audit read-only pentru consolidare arhitecturală

Data: 2026-07-28  
Regim: read-only asupra surselor; fără ștergeri, mutări sau refactorizări  
Commit baseline: `9956eb188fdd988bf0d7af93241c3c43962d9b39`  
Scop: pregătirea consolidării înaintea implementării Hub-urilor Premium

## 1. Verdict executiv

Fundația funcțională este stabilă, iar testele de caracterizare disponibile sunt
PASS. Arhitectura reală conține deja componente Premium valoroase: Pre-Departure,
Context Operațional, AI Governance, Load Safety și After-Departure POC.

Sistemul necesită însă consolidare înaintea extinderii:

- entrypoint-ul web principal este un hotspot monolitic;
- stilurile globale sunt supradimensionate;
- configurația de build este duplicată și deja divergentă;
- Pre-Departure și After-Departure au niveluri diferite de integrare;
- contractele comune nu sunt centralizate în pachetul shared;
- backend-ul concentrează lifecycle, audit și verificări într-un singur serviciu;
- există elemente de compatibilitate și POC active care nu pot fi șterse, dar
  trebuie clasificate și migrate;
- documentația și artefactele operaționale necesită un registru separat de
  sursele aplicației.

Verdict:

**CONSOLIDATION REQUIRED — BASELINE STABLE — NO LEGACY REMOVAL AUTHORIZED**

## 2. Baseline și conservare

### 2.1 Stare repository

Working tree-ul conține modificări locale și fișiere neversionate preexistente.
Acestea aparțin baseline-ului de lucru și nu au fost modificate sau eliminate în
cadrul auditului.

### 2.2 Teste executate

| Test | Rezultat |
| --- | --- |
| Premium foundation | PASS |
| Premium Operational Context canonical | PASS |
| API Jest | 7 suite PASS |
| API assertions | 28/28 PASS |

Prima invocare prin `pnpm.ps1` a fost blocată de Windows Execution Policy.
Reluarea prin `pnpm.cmd` a executat testele cu PASS. Acesta este un aspect al
shell-ului local, nu o neconformitate AGM.

### 2.3 Zone excluse din audit

- conținutul fișierelor `.env`;
- secrete și credențiale;
- baze de date;
- Production;
- infrastructură remote;
- artefacte binare;
- conținutul directoarelor generate `dist`, `build`, `node_modules`.

## 3. Harta implementării reale

```text
Repository AGM
├── apps/api                  NestJS + Prisma
│   ├── auth/users
│   ├── transports/lifecycle
│   ├── audit/evidence/incidents
│   ├── translation
│   ├── premium-load-safety
│   ├── pre-departure contract/sync
│   └── turn-admin/validation
├── apps/web                  Vite + TypeScript + Capacitor
│   ├── Basic cockpit/main.ts
│   ├── mail/contact/translator/OCR/voice
│   ├── Turn/monitoring/incident
│   ├── Premium shell/modules
│   ├── Pre-Departure
│   ├── Operational Context
│   ├── Load Safety
│   ├── AI governance/copilot/context/language
│   └── After-Departure POC
├── apps/web/android          Capacitor + plugin-uri native
├── packages/shared          schelet minimal
├── prisma                   modele și 5 migrări
├── deploy/cloud             validation/backup
├── deploy/production        compose/systemd/runbook-uri
└── documentație             arhitectură, audit, operațiuni, dovezi
```

## 4. Hotspot-uri și responsabilități amestecate

### 4.1 `apps/web/src/main.ts`

Dimensiune observată: aproximativ 4.135 linii.

Responsabilități prezente:

- store global și inițializare;
- router/view selection;
- randare UI;
- tutoriale;
- traducător și health;
- Email Assistant;
- contacte;
- profil;
- legal/privacy;
- OCR și istoric;
- voce Browser/Android;
- admin;
- incident journal;
- clipboard;
- service worker;
- Turn Command Center;
- legături Premium.

Clasificare: **ACTIVE · CANONICAL ENTRYPOINT · CRITICAL HOTSPOT**.

Nu este candidat pentru rescriere completă. Este candidat pentru extracții
incrementale protejate de teste de caracterizare.

### 4.2 `apps/web/src/styles.css`

Dimensiune observată: aproximativ 3.823 linii.

Clasificare: **ACTIVE · SHARED · CRITICAL HOTSPOT**.

Riscuri:

- selecții globale;
- coliziuni între ecrane;
- regresii Android;
- ownership neclar;
- dificultate în eliminarea stilurilor neutilizate.

### 4.3 `apps/web/src/i18n/app-i18n.dictionary.ts`

Dimensiune observată: aproximativ 2.548 linii.

Clasificare: **ACTIVE · SHARED · LARGE REGISTRY**.

Necesită separare pe domenii și validare automată a cheilor, fără schimbarea
contractului public `t(...)`.

### 4.4 `apps/api/src/transports/transports.service.ts`

Dimensiune observată: aproximativ 488 linii.

Concentrează:

- CRUD și ownership;
- lifecycle;
- tranzacții;
- audit;
- checks;
- finance/payment;
- close/archive;
- snapshots și numerotare.

Clasificare: **ACTIVE · CANONICAL DOMAIN SERVICE · HIGH-RISK HOTSPOT**.

Necesită separare internă graduală în use cases, policy/check services și event
emission, păstrând API-ul extern.

## 5. Componente Premium existente

| Componentă | Stare reală | Clasificare | Decizie recomandată |
| --- | --- | --- | --- |
| Premium shell/routes/foundation | integrată și testată | Canonical/Active | Păstrare și aliniere |
| Pre-Departure UI/machine/controller | activă, modularizată | Canonical/Active | Păstrare |
| Pre-Departure sync API | server-side, revision/conflict | Canonical/Active | Păstrare și generalizare |
| Premium Operational Context | conectat la Pre-Departure, testat | Canonical/Active | Promovare la nucleu comun |
| AI Governance | structură modulară existentă | Active/Shared | Reconciliere cu Decision Envelope |
| Load Safety | module UI/API distincte | Active/Specialized | Păstrare, integrare prin Broker |
| Context Analysis/Copilot/Linguistic | module Premium separate | Active/Planned integration | Evaluare pe contract |
| Proactive Recommendations | modul separat | Active/Planned integration | Păstrare condiționată de policy |
| After-Departure POC | entrypoint build activ, teste dedicate | Active POC | Migrare controlată |
| `packages/shared` | o singură constantă, fără consumatori găsiți | Orphan candidate | Reproiectare, nu ștergere imediată |

## 6. Fractura Pre-Departure / After-Departure

### 6.1 Pre-Departure

Pre-Departure:

- are machine și tipuri proprii;
- este integrat cu Operational Context;
- transformă issue-urile în open items;
- setează flags;
- produce comenzi și evenimente locale;
- are outbox;
- sincronizează cu API;
- folosește revision conflict.

### 6.2 After-Departure POC

After-Departure:

- este inclus explicit în build;
- are entrypoint și UI proprii;
- are evaluator și state machine locală;
- salvează local numai limba POC;
- gestionează starea în memorie;
- nu consumă `TripContext`;
- nu produce evenimente canonice;
- nu are outbox/server sync;
- nu face handoff din Pre-Departure.

Clasificare: **ACTIVE POC · ARCHITECTURALLY UNALIGNED · MIGRATION CANDIDATE**.

Interdicție: nu se șterge și nu se redenumește înaintea existenței unui Journey
Operations replacement validat.

## 7. Dublări și divergențe

### 7.1 Configurația de build web

`vite.config.mjs` și `scripts/build-web.mjs` repetă:

- plugin-ul POC;
- injectarea navigării;
- lista entrypoint-urilor.

Textul injectat este deja diferit și prezintă encoding divergent.

Clasificare: **DUPLICATE ACTIVE CONFIGURATION · HIGH PRIORITY**.

Recomandare: o singură fabrică de configurație consumată de dev și build.

### 7.2 Stări și persistence

Există mai multe modele:

- state global Basic în `main.ts`;
- Pre-Departure session;
- TripContext local;
- Pre-Departure server session;
- TransportJob lifecycle;
- After-Departure assessment local.

Acestea au scopuri diferite, dar mapping-ul și ownership-ul nu sunt complet
formalizate.

Clasificare: **VALID SPECIALIZATION WITH INTEGRATION RISK**.

### 7.3 Outbox specializat

Outbox-ul Pre-Departure este funcțional, dar specific modulului. Contractul
Premium cere continuitate comună.

Recomandare: caracterizare și generalizare incrementală; nu înlocuire directă.

### 7.4 Local fallback și compatibilitate

Există fallback-uri intenționate pentru:

- traducere;
- clipboard;
- profile language;
- contacte legacy;
- SHA-256;
- voce.

Clasificare: **COMPATIBILITY PATHS — NOT AUTOMATIC LEGACY**.

Fiecare necesită owner, motiv, platformă, test și criteriu de retragere.

## 8. Elemente istorice și generate

### 8.1 Generate/ignored

`node_modules`, `dist`, Android `build`, `.tmp` și `.env` sunt ignorate conform
regulilor repository-ului. Nu au fost identificate fișiere generate sau APK-uri
urmărite în Git la commitul baseline.

### 8.2 Documentație

Repository-ul conține un volum mare de rapoarte, runbook-uri și dovezi.
Acestea sunt valoroase, dar rădăcina repository-ului nu exprimă taxonomia:

- canonical;
- active procedure;
- decision;
- evidence;
- historical;
- superseded.

Recomandare: registru documentar înaintea oricărei mutări. Linkurile și
checksum-urile existente interzic reorganizarea mecanică fără plan.

## 9. Ownership și limite propuse

| Zonă | Owner recomandat | Boundary |
| --- | --- | --- |
| Basic Application Shell | Frontend & Website Owner | bootstrap și navigare |
| Translator/Voice/OCR Basic | service owner dedicat | adaptoare publice |
| Mail/Contacts | Frontend + Communication owner | CommunicationDraft viitor |
| Premium Experience Shell | Frontend & Website Owner | proiecție, fără domain state |
| TripContext/Domain | Backend & Data Custodian | lifecycle canonic |
| Operational Context | Architecture + Backend/Data | proiecții și ports |
| Memory/Eventing/Outbox | Data Accountable | o singură continuitate |
| Knowledge | Documentation + domain owner | lifecycle editorial |
| AI Governance | AI & Localization Owner | permit/policy/provenance |
| Native Android | Frontend & Website Owner | adaptoare native |
| API/Prisma | Backend & Data Custodian | server truth |
| Build/Release | Release & Operations | build config și artefact |

## 10. Clasificarea consolidată

### Canonical

- `ROADMAP.md` și contractele aprobate;
- API NestJS/Prisma;
- schema și migrările;
- Basic Browser/Android;
- Premium Operational Context;
- Pre-Departure contracts și sync.

### Active

- `main.ts`, `styles.css`, i18n;
- Mail/Contacts/Translator/OCR/Voice;
- Turn/Monitoring/Incident;
- Premium shell și module;
- Load Safety;
- After-Departure POC.

### Shared

- i18n;
- native adapters;
- request context/IDs/response;
- Prisma service;
- audit/evidence;
- Operational Context ports;
- serviciile Basic reutilizabile prin adaptoare.

### Legacy explicit

- contactele marcate `legacy`;
- profile language compatibility;
- hidden Pre-Departure legacy state projection.

Acestea sunt consumate și nu sunt candidate de eliminare fără teste.

### Duplicate

- configurația Vite/build;
- unele responsabilități state/persistence care necesită mapping înainte de
  declararea duplicării funcționale.

### Orphan candidate

- `@agm/shared` în forma actuală.

Trebuie verificat și transformat în locație reală pentru contractele comune sau
retras prin mandat separat.

### Candidate for migration

- After-Departure POC către Journey Operations;
- outbox-ul specific către infrastructură comună;
- stările locale către proiecții canonice;
- funcțiile din `main.ts` către module bounded.

### Candidate for removal

**Niciun element nu este aprobat pentru eliminare în această etapă.**

## 11. Planul de modularizare propus

### MC-0 — Baseline și registru

- manifest al fișierelor modificate;
- teste de caracterizare;
- harta entrypoint-urilor;
- registrul storage keys;
- registrul contractelor;
- ownership.

### MC-1 — Configurația de build

- eliminarea dublării prin fabrică unică;
- test dev/build parity;
- corectarea encoding-ului;
- fără schimbarea output-ului.

### MC-2 — Extracții din `main.ts`

Ordine cu risc redus:

1. service worker/bootstrap;
2. clipboard și utilitare;
3. health;
4. OCR history;
5. voice orchestration;
6. translator controller;
7. mail controller;
8. contact controller;
9. incident controller;
10. router/store/app shell.

Fiecare extracție este un increment separat.

### MC-3 — CSS pe domenii

- tokens/base;
- shell/navigation;
- translator;
- mail/contact;
- legal/profile;
- admin/turn;
- Premium shared;
- responsive/Android.

Nu se șterg selectori înaintea coverage-ului și a validării vizuale.

### MC-4 — Shared contracts

- definirea rolului `@agm/shared`;
- mutarea numai a contractelor fără dependențe de platformă;
- Trip IDs/events/errors/DTOs;
- interdicția importului UI sau Prisma în shared.

### MC-5 — Backend transport

- transition use cases;
- checks/policies;
- audit/event port;
- numbering;
- finance;
- repository boundary.

API-ul și tranzacțiile rămân compatibile.

### MC-6 — Continuitate Premium

- caracterizarea outbox-ului Pre-Departure;
- contract comun operation/event/outbox;
- adaptor Pre-Departure;
- replay/conflict/recovery;
- fără dual-write permanent.

### MC-7 — Journey Operations migration

- maparea stărilor POC la lifecycle canonic;
- `TripContext`;
- OperationalCase;
- events/outbox;
- handoff Pre-Departure;
- înlocuirea entrypoint-ului numai după parity PASS.

### MC-8 — Documentație și cleanup

- registru canonic;
- marcarea superseded;
- verificarea linkurilor/checksum-urilor;
- eliminare numai după zero consumers și rollback.

## 12. Gate-uri pentru orice cleanup

1. target exact și owner;
2. consumatori inventariați static și runtime;
3. teste de caracterizare PASS;
4. replacement și mapping demonstrate;
5. Browser/Android PASS;
6. API/regresie PASS;
7. offline/recovery PASS, dacă este aplicabil;
8. diff auditat;
9. rollback disponibil;
10. mandat explicit de eliminare.

## 13. Riscuri organizaționale și tehnice

| Risc | Control |
| --- | --- |
| Refactorizare mare a `main.ts` | strangler/extracții mici |
| Regresie vizuală | screenshot baseline Browser/Android |
| CSS aparent neutilizat | coverage și verificare runtime |
| Ștergere POC activ | migrare și parity înainte de retragere |
| Contract shared cu dependențe greșite | shared pur TypeScript |
| Dual-write context/sesiune | mapping, owner și plan de tranziție |
| Divergență build dev/prod | configurație unică |
| Documente rupte prin mutare | registry și link audit |
| Confundarea fallback-ului cu legacy | criteriu de retragere per fallback |
| Refactor API cu schimbare semantică | contract/e2e și tranzacții |
| Working tree local pierdut | conservare și manifest înainte de schimbări |

## 14. Priorități

| Prioritate | Acțiune | Impact | Efort |
| --- | --- | --- | --- |
| P0 | Baseline/manifest/characterization | foarte mare | mic |
| P0 | Unificarea configului build | mare | mic |
| P0 | Maparea Pre/After/TripContext | foarte mare | mediu |
| P1 | Extracții controlate `main.ts` | foarte mare | mare incremental |
| P1 | Generalizarea continuității | foarte mare | mare |
| P1 | Journey Operations migration plan | foarte mare | mediu |
| P2 | CSS pe domenii | mediu | mare |
| P2 | Shared contracts | mare | mediu |
| P2 | Backend transport decomposition | mare | mediu |
| P3 | Registry documentar și cleanup | mediu | mediu |

## 15. Următorul mandat recomandat

Nu se recomandă începerea directă a refactorizării.

Următorul mandat trebuie să fie:

**MC-0 — BASELINE, REGISTRU DE CONTRACTE ȘI TESTE DE CARACTERIZARE**

Livrabile:

- manifestul exact al baseline-ului;
- harta entrypoint-urilor;
- harta importurilor și storage keys;
- catalogul contractelor;
- matricea ownership;
- matricea de teste;
- lista de screenshot-uri Browser/Android;
- propunerea limitată pentru MC-1.

## 16. Concluzie

Arhitectura existentă nu trebuie demolată. Ea conține fundații corecte, dar
dezvoltarea incrementală a produs un nucleu Basic monolitic, configurații
duplicate și integrare Premium neuniformă.

Strategia corectă este:

```text
characterize
→ classify
→ assign ownership
→ extract behind contracts
→ migrate consumers
→ prove parity
→ remove only with mandate
```

Verdict final:

# READ-ONLY AUDIT PASS — CONSOLIDATION PLAN REQUIRED

Nicio eliminare, refactorizare sau schimbare Production nu este autorizată prin
acest raport.

