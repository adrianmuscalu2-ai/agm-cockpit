# AGM Official Roadmap

## Purpose

Acest document este roadmap-ul oficial AGM validat în AG-019.

Scopul lui este să ofere tuturor agenților, dezvoltatorilor și decidenților o imagine clară asupra:

- funcțiilor care aparțin AGM Basic;
- funcțiilor care aparțin AGM Premium;
- ideilor validate care rămân în backlog;
- priorităților de implementare;
- etapelor de validare.

Roadmap-ul nu înlocuiește arhitectura AGM. El organizează dezvoltarea pe baza deciziilor deja validate de Turn, Mentor, Inspector și Codex.

## Roadmap Principles

- AGM Basic include funcțiile esențiale pentru utilizatorul operațional.
- AGM Premium include funcții comerciale, inteligente și avansate.
- Future Backlog păstrează ideile validate care nu au prioritate imediată.
- Fiecare funcție trebuie să aibă o categorie clară: Basic, Premium sau Backlog.
- Fiecare funcție trebuie să treacă prin analiză, implementare, testare și validare.
- Inspectorul identifică riscuri și recomandări.
- Codex transformă recomandările validate în misiuni tehnice.
- Turn validează prioritățile și închiderea etapelor.

## Status Legend

| Status | Meaning |
| --- | --- |
| Validated | Decizie aprobată de Turn/Mentor. |
| Implemented | Funcția există în aplicație. |
| In Progress | Funcția este în dezvoltare sau ajustare. |
| Planned | Funcția este aprobată, dar nu este încă implementată. |
| Backlog | Funcția este validată ca idee, dar fără prioritate imediată. |
| Blocked | Funcția așteaptă decizie, audit sau dependență externă. |

## 1. AGM Basic Roadmap

AGM Basic oferă instrumentele esențiale pentru comunicare profesională, traducere, corectare, documentare locală și utilizare practică pe Android.

### 1.1 Translator Core

| Feature | Status | Priority | Validation Stage |
| --- | --- | --- | --- |
| Traducere RO / DE / EN | Implemented | Critical | Validated |
| Profil utilizator local | Implemented | Critical | Validated |
| Limbă activă din Profil | Implemented | Critical | Validated |
| Microfon / dictare vocală | Implemented | High | Validated |
| Redare vocală rezultat | Implemented | High | Validated |
| Text Corrector integrat în fluxul Text -> Corectează -> Tradu | Implemented | High | Validated |
| OCR Camera: fotografiere -> OCR -> traducere -> redare -> copiere -> istoric | Implemented | High | Validated AG-018 |
| Istoric local OCR | Implemented | Medium | Validated AG-018 |
| Optimizare performanță OCR pe Android | Planned | Medium | Needs device testing |
| Împachetare locală date limbă OCR, dacă este necesar | Planned | Medium | Technical review |

### 1.2 Email Assistant / MailMaster Basic

Email Assistant aparține AGM Basic.

| Feature | Status | Priority | Validation Stage |
| --- | --- | --- | --- |
| Redactare asistată e-mail | Implemented | High | Validated |
| Traducere e-mail | Implemented | High | Validated |
| Corector text pentru e-mail | Implemented | High | Validated |
| Șabloane e-mail | Implemented | Medium | Validated |
| Contacte locale / Address Book | Implemented | Medium | Validated |
| Semnătură text / profil | Implemented | Medium | Validated |
| Semnătură desenată | Implemented | Medium | Validated |
| Atașare documente | Planned | High | Required for Basic stable |
| Trimitere e-mail | Planned | High | Required for Basic stable |
| Distribuire către WhatsApp prin Share către aplicația instalată | Planned | Medium | Basic only, no automation |

### 1.3 Legal, Privacy and Google Play Readiness

| Feature | Status | Priority | Validation Stage |
| --- | --- | --- | --- |
| Privacy Policy structure | Implemented | Critical | Validated AG-012 |
| Terms and Conditions structure | Implemented | Critical | Validated AG-012 |
| First-run acceptance screen | Implemented | Critical | Validated AG-012 |
| AI Transparency | Implemented | Critical | Validated AG-012 |
| Microphone disclosure | Implemented | Critical | Validated AG-012 |
| Data management / local reset | Implemented | Critical | Validated AG-012 |
| Open Source Licenses / Third Party Notices | Implemented | Critical | Validated AG-012 |
| Camera/OCR legal update | Planned | Critical | Required before public release |
| Public Privacy Policy URL | Planned | Critical | Required for Google Play |
| Official support contact details | Planned | Critical | Required for Google Play |
| Impressum final data | Planned | High | Required before public release |

### 1.4 Android / PWA

| Feature | Status | Priority | Validation Stage |
| --- | --- | --- | --- |
| PWA foundation | Implemented | High | Validated |
| Capacitor Android project | Implemented | High | Validated |
| Internal debug APK | Implemented | High | Validated |
| Responsive Android UI | Implemented | High | Validated |
| Camera permission | Implemented | High | Validated AG-018 |
| APK release build process | Planned | High | Required before Google Play |
| Google Play internal testing setup | Planned | High | Required before public testing |

### 1.5 Turn Command Center Basic

| Feature | Status | Priority | Validation Stage |
| --- | --- | --- | --- |
| Turn Command Center MVP read-only | Implemented | High | Validated AG-017 |
| Inspector Agent | Implemented | High | Validated AG-018 |
| Department status indicators | Implemented | High | Validated AG-018 |
| Agent status indicators | Implemented | High | In validation |
| General Inspector alert report | Implemented | High | In validation |
| Alert history display | Implemented | Medium | In validation |
| Predictive Inspector philosophy | Implemented | High | In validation |
| Persistent audit storage | Planned | Medium | Future backend support |

## 2. AGM Premium Roadmap

AGM Premium oferă funcții comerciale avansate, automatizări inteligente și asistență AI extinsă.

### 2.1 AI Copilot Advanced

| Feature | Status | Priority | Validation Stage |
| --- | --- | --- | --- |
| AI Copilot operațional avansat | Planned | High | Premium architecture |
| Agenți lingvistici profesioniști | Planned | High | Premium architecture |
| Analiză contextuală avansată | Planned | Medium | Premium architecture |
| Recomandări proactive | Planned | Medium | Requires Inspector integration |
| Guvernanță AI operațională | Planned | High | Requires audit design |

### 2.2 WhatsApp Premium

WhatsApp inteligent aparține AGM Premium.

| Feature | Status | Priority | Validation Stage |
| --- | --- | --- | --- |
| Integrare inteligentă WhatsApp | Planned | High | Premium only |
| Traducerea conversațiilor | Planned | High | Premium only |
| Răspunsuri asistate AI | Planned | High | Premium only |
| Analiză conversații | Planned | Medium | Premium only |
| Gestionare documente din conversații | Planned | Medium | Premium only |
| Automatizări conversaționale | Planned | Medium | Requires legal review |

### 2.3 Document Assistant

| Feature | Status | Priority | Validation Stage |
| --- | --- | --- | --- |
| Document Assistant MVP | Planned | High | Premium/Professional analysis |
| Analiză documente transport | Planned | High | Requires OCR foundation |
| Extracție date din documente | Planned | High | Requires data model |
| Verificare documente | Planned | Medium | Requires compliance rules |
| Rezumate documente | Planned | Medium | Requires AI governance |

### 2.4 Business and Transport Platform Expansion

| Feature | Status | Priority | Validation Stage |
| --- | --- | --- | --- |
| Integrare job lifecycle AGM complet | Planned | High | Based on Architecture Specification |
| Management transporturi | Planned | High | Requires backend extension |
| Evidence storage | Planned | High | Requires storage architecture |
| Finance operational management | Planned | Medium | Requires ledger extension |
| Customer Portal | Planned | Medium | Future platform phase |
| Multi-user / roles | Planned | Medium | Future platform phase |
| Multi-company support | Planned | Low | Future SaaS phase |

## 3. AGM Future Backlog

Future Backlog conține idei validate sau recomandări mature care nu au prioritate imediată.

### 3.1 Inspector Recommendations

| Idea | Source | Status | Notes |
| --- | --- | --- | --- |
| Backlog oficial separat pentru Basic și Premium | Inspector Product & Roadmap | Implemented | AG-019 Roadmap. |
| Modularizare graduală frontend | Inspector Architecture / Frontend | Backlog | Necesită etapă dedicată, fără schimbare UX. |
| App Shell și Module Registry | Inspector Architecture | Backlog | Recomandat înainte de extindere majoră. |
| Teste automate end-to-end | Inspector QA | Backlog | Prioritate înainte de release public. |
| Checklist release Google Play | Inspector Release | Backlog | Necesită etapă Release Operations. |
| Registru ADR pentru decizii arhitecturale | Inspector Documentation | Backlog | Recomandat pentru scalare. |
| Endpoint-uri read-only de health în Turn | Inspector Backend | Backlog | Necesită backend support. |

### 3.2 Product Opportunities

| Idea | Status | Notes |
| --- | --- | --- |
| Favorite templates | Backlog | Pentru MailMaster / Email Assistant. |
| Voice assistant Premium | Backlog | Necesită audit privacy și UX dedicat. |
| Offline document pack | Backlog | Pentru utilizare pe drum. |
| Multi-language UI expansion beyond RO/DE/EN | Backlog | Doar după stabilizarea limbilor curente. |
| AI quality scoring | Backlog | Necesită metodologie QA AI. |
| Export local data report | Backlog | Util pentru GDPR și suport. |

## 4. Recommended Development Order

1. Finalize AG-019 Roadmap validation.
2. Stabilize Turn Command Center alert system.
3. Complete Basic release blockers:
   - Camera/OCR legal update;
   - APK release build;
   - Google Play internal testing setup;
   - official support and Privacy Policy URL.
4. Implement Email Assistant Basic blockers:
   - document attachment;
   - e-mail sending;
   - WhatsApp Share only.
5. Add release checklist and QA automation.
6. Start AGM Premium architecture only after Basic release path is stable.

## 5. Governance Rule

Nicio funcție nouă nu intră direct în implementare fără clasificare prealabilă:

- AGM Basic;
- AGM Premium;
- AGM Future Backlog.

Această regulă previne amestecarea funcțiilor esențiale cu funcțiile comerciale avansate și păstrează platforma scalabilă.

## 6. Related Governance Documents

- [AI_GOVERNANCE.md](./AI_GOVERNANCE.md)
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
