# AGM Official Roadmap

Versiune document: 2.0  
Data alinierii Premium: 2026-07-28  
Owner funcțional: Product & Portfolio  
Autoritate de aprobare: Turn Command Center  
Statut: **CANONIC – ALINIAT PENTRU EXECUȚIE CONTROLATĂ**

Acest document este sursa canonică unică pentru planificarea AGM Basic,
AGM Premium și Future Backlog. Contractele arhitecturale stabilesc **cum** se
construiește sistemul, planurile tehnice detaliază execuția, iar rapoartele de
etapă constituie dovezi. Niciun document subordonat nu modifică implicit
prioritățile sau etapele acestui Roadmap.

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
| Dictare vocala in corpul e-mailului | Implemented | High | Validated Android 2026-07-14 |
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
| Microfon nativ si redare vocala Android | Implemented | Critical | Validated AG-018 |
| Conexiune APK catre API LAN | Implemented | Critical | Validated AG-020 |
| Ergonomie cockpit pentru ecrane inguste | Implemented | High | Validated preliminar AG-019 |
| APK release build process | Planned | High | Required before Google Play |
| Google Play internal testing setup | Planned | High | Required before public testing |

### 1.5 Turn Command Center Basic

| Feature | Status | Priority | Validation Stage |
| --- | --- | --- | --- |
| Turn Command Center MVP read-only | Implemented | High | Validated AG-017 |
| Acces administrativ prin PIN local AGM | Implemented | Critical | Stable baseline 2026-07-14 |
| Inspector Agent | Implemented | High | Validated AG-018 |
| Department status indicators | Implemented | High | Validated AG-018 |
| Agent status indicators | Implemented | High | In validation |
| General Inspector alert report | Implemented | High | In validation |
| Alert history display | Implemented | Medium | In validation |
| Predictive Inspector philosophy | Implemented | High | In validation |
| Persistent audit storage | Planned | Medium | Future backend support |

## 2. AGM Premium Roadmap

AGM Premium oferă funcții comerciale avansate, automatizări inteligente și asistență AI extinsă.

Secțiunile 2.1–2.4 păstrează clasificarea funcțională validată anterior și
istoricul checkpoint-urilor existente. Începând cu secțiunea 2.5, execuția
Premium este organizată canonic ca ecosistem integrat de Hub-uri Operaționale,
nu ca dezvoltare a unor module izolate.

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

### 2.5 Modelul canonic AGM Premium

AGM Premium este o platformă operațională centrată pe o singură cursă activă,
reprezentată de `TripContext`. Funcțiile existente și viitoare sunt accesate
prin Hub-uri Operaționale și folosesc aceleași Servicii Comune, același Context
Operațional Comun și aceeași Arhivă Operațională Canonică.

Principii obligatorii:

- o cursă activă are un singur `TripContext`;
- Hub-urile nu creează copii concurente ale datelor canonice;
- originalele sunt păstrate, iar rezultatele procesării sunt derivate;
- AI recomandă, iar utilizatorul confirmă acțiunile cu impact;
- offline/outbox/recovery reprezintă un mod normal de funcționare;
- transferurile între Hub-uri sunt explicite și trasabile;
- evenimentele operaționale sunt append-only;
- extinderea se face prin contracte și proiecții autorizate, nu prin cuplare
  directă între module.

### 2.6 Hub-urile Operaționale

| ID | Hub | Responsabilitate principală |
| --- | --- | --- |
| HUB-00 | AGM Premium Cockpit | Punct unic de intrare, cursa activă, lifecycle, open items, flags, navigare și timeline. |
| HUB-01 | Pre-Departure | Pregătirea cursei, verificarea vehiculului, documentelor, încărcăturii și READY gate. |
| HUB-02 | Active Trip | Execuția cursei, evenimente de traseu, incidente, instrumente pentru șofer și comunicare contextuală. |
| HUB-03 | Post-Trip | Închiderea cursei, rezolvarea open items, raportul final și transferul către arhivare. |
| HUB-04 | Documents & Evidence | Captură/import, OCR, verificare umană, documente originale și derivate, analiză și dovezi. |
| HUB-05 | Communication & Language | Traducere, corectare, microfon, citire, Email Assistant, WhatsApp Assistant și handoff controlat. |
| HUB-06 | Safety & Compliance | Siguranță, conformitate, reguli, alerte și dovezi asociate. |
| HUB-07 | Operational Archive | Memoria canonică a evenimentelor, documentelor, dovezilor, manifestelor și rapoartelor. |

Hub-urile pentru companie, flotă, dispecerat, parteneri și analiză sunt extensii
ulterioare. Ele consumă evenimente și proiecții autorizate și nu creează o a
doua arhivă canonică.

### 2.7 TripContext și Contextul Operațional Comun

`TripContext` este modelul unic al cursei și păstrează identitatea, lifecycle-ul,
stările operaționale, referințele canonice și legăturile către evenimente,
documente și acțiuni.

Contextul Operațional Comun distribuie către Hub-uri numai proiecțiile necesare
și autorizate. El asigură continuitatea dintre Pre-Departure, Active Trip,
Post-Trip, Documents & Evidence, Communication & Language și Safety &
Compliance. Un Hub nu poate redefini identitatea cursei și nu poate deveni o
sursă paralelă de adevăr.

### 2.8 Arhiva Operațională Canonică

Arhiva Operațională AGM este nucleul de memorie și cunoaștere al Premium.
Aceasta păstrează:

- evenimentele operaționale și audit trail-ul;
- documentele originale și versiunile derivate;
- dovezile și legăturile lor cu `TripContext`;
- confirmările umane și rezultatele procesărilor AI;
- rapoartele, manifestele, regulile de retenție și exporturile;
- lecțiile validate, terminologia și șabloanele reutilizabile.

Jurnalele locale ale Hub-urilor sunt proiecții sau mecanisme de lucru. Ele nu
înlocuiesc Arhiva Operațională Canonică.

### 2.9 Serviciile Comune

Serviciile Comune sunt capabilități reutilizabile, accesate prin contracte
stabile de către toate Hub-urile relevante:

- Camera și import;
- OCR și extragere structurată;
- verificare/review uman;
- analiză și clasificare documente;
- traducere și corectare;
- microfon/STT și citire/TTS;
- AI Copilot și guvernanță AI;
- Email Assistant și WhatsApp Assistant;
- Evidence Registry și Document Store;
- EventStore, timeline și proiecții;
- identitate, autorizare și politici de acces;
- offline, outbox, sincronizare și recovery;
- notificări, observabilitate și audit;
- căutare, export și retenție.

Un Serviciu Comun nu deține lifecycle-ul cursei și nu devine un Hub ascuns.

### 2.10 Fluxul vertical MVP

Primul increment Premium executabil trebuie să demonstreze integrarea completă:

**Camera → OCR → Verificare → Document → Analiză/Traducere → Comunicare →
Evenimente → Arhivă**

MVP-ul include:

1. HUB-00 Premium Cockpit;
2. `TripContext` și lifecycle;
3. HUB-04 Documents & Evidence;
4. captură Camera/import și OCR;
5. verificare umană și păstrarea originalului;
6. analiză, traducere și citire document;
7. un `CommunicationDraft` cu handoff către Email;
8. EventStore local/server și timeline minimal;
9. offline/outbox/recovery;
10. arhivare și raport minimal al cursei.

Criteriul MVP nu este numărul de funcții, ci traversarea controlată și
trasabilă a întregului flux, fără surse de adevăr paralele.

### 2.11 Etapele canonice de implementare Premium

Etapele finalizate și checkpoint-urile istorice rămân nemodificate. Tabelul de
mai jos stabilește ordinea pentru execuția viitoare și pentru reconcilierea
livrabilelor existente.

| Etapa | Obiectiv | Poartă principală |
| --- | --- | --- |
| 0 – Validarea direcției | Hub-uri, limite Hub/serviciu, registru de capabilități și criterii MVP | Aprobare documentară |
| 1 – Închiderea fundației comune | EventStore server, acces, proiecție UI, sync/recovery și versiunea evenimentelor | Replay, offline, conflict și recovery PASS |
| 2 – Premium Cockpit MVP | HUB-00, cursa activă, lifecycle, open items, flags și timeline minimal | Navigare și stare comună PASS |
| 3 – Documents & Evidence vertical slice | Camera/import, Evidence Registry, OCR, review, document, analiză și evenimente | Flux captură–arhivă PASS |
| 4 – Communication & Language | Traducere, corectare, STT/TTS, CommunicationDraft, Email și WhatsApp handoff | Handoff și stări de livrare PASS |
| 5 – Pre-Departure complet | Vehicul, remorcă, documente, încărcătură, reguli și READY gate | Handoff către Active Trip PASS |
| 6 – Active Trip și Driver Tools | Rută, incidente, comunicare contextuală, instrumente șofer, offline și notificări | Flux operațional activ PASS |
| 7 – Post-Trip și Arhivă | Sosire, open-item disposition, raport, manifest, retenție, sealing și export | Închidere și arhivare PASS |
| 8 – Operational Knowledge | Lecții validate, anonimizare, șabloane, terminologie, căutare și reutilizare | Guvernanță și reutilizare PASS |
| 9 – Premium productization | Entitlement, planuri, feature flags, cost controls, suport, observabilitate și onboarding | Readiness comercial PASS |
| 10 – Hub-uri companie și flotă | Fleet, Dispatch, Compliance organizațional, Customer/Partner și Analytics | Extensie fără arhivă paralelă PASS |

Fiecare etapă necesită mandat, owner, criterii de intrare, dovezi și verdict de
închidere. Un PASS de etapă nu autorizează automat Production sau etapa
următoare în lipsa aprobării cerute de guvernanță.

### 2.12 Dependențe și condiții deschise

Înaintea extinderii funcționale complete trebuie închise sau reconfirmate:

- adaptorul EventStore server-side;
- politicile reale de acces;
- proiecția UI comună;
- sincronizarea și recovery end-to-end;
- schema și versiunea evenimentelor;
- migrarea controlată a modulelor Premium rămase.

Aceste condiții nu redeschid etapele deja validate; ele controlează numai
execuția livrabilelor dependente.

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

### 4.1 Premium Execution Order After Architectural Alignment

Lista istorică de mai sus rămâne checkpoint-ul AG-019 și nu este rescrisă.
Pentru execuția Premium ulterioară alinierii din 2026-07-28, ordinea canonică
este:

1. reconfirmarea stării curente și a dovezilor deja închise;
2. închiderea condițiilor fundației comune;
3. Premium Cockpit și `TripContext`;
4. fluxul vertical Documents & Evidence;
5. Communication & Language;
6. Pre-Departure;
7. Active Trip și Driver Tools;
8. Post-Trip și Arhiva Operațională;
9. Operational Knowledge;
10. productizarea Premium;
11. extinderea către Hub-uri de companie și flotă.

Implementarea urmează secțiunea 2.11 și nu poate ocoli porțile de validare.

## 5. Governance Rule

Nicio funcție nouă nu intră direct în implementare fără clasificare prealabilă:

- AGM Basic;
- AGM Premium;
- AGM Future Backlog.

Această regulă previne amestecarea funcțiilor esențiale cu funcțiile comerciale avansate și păstrează platforma scalabilă.

## 6. Related Governance Documents

- [AI_GOVERNANCE.md](./AI_GOVERNANCE.md)
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
- [AGM Organizational Contract v1](./AGM_ORGANIZATIONAL_CONTRACT_V1.md) —
  referința organizațională; se aplică potrivit statutului său oficial curent.
- [AGM Premium Architectural Contract v1](./AGM_PREMIUM_ARCHITECTURAL_CONTRACT_V1.md)
- [AGM Premium Hub Architecture Vision](./AGM_PREMIUM_HUB_ARCHITECTURE_VISION_2026-07-28.md)
- [Premium Roadmap Verification Report](./AGM_PREMIUM_ROADMAP_VERIFICATION_REPORT_2026-07-28.md)
- [Premium implementation plan — Etapa 1](./WORK_CHATGPT_PROJECT/10_PREMIUM_ARCHITECTURE/ETAPA_1/09_PLAN_ETAPIZAT_IMPLEMENTARE.md)
- [Premium integration order — Etapa 2.0](./WORK_CHATGPT_PROJECT/10_PREMIUM_ARCHITECTURE/ETAPA_2_0/03_PLAN_ORDINE_INTEGRARE.md)
- [Premium module migration plan — Etapa 3](./WORK_CHATGPT_PROJECT/10_PREMIUM_ARCHITECTURE/ETAPA_3/08_PLAN_MIGRARE_MODULE.md)

## 7. Document Authority and Change Control

- `ROADMAP.md` este sursa canonică pentru planificare, prioritizare, faze și
  clasificarea Basic/Premium/Backlog.
- Contractele arhitecturale sunt normative pentru limitele și regulile tehnice.
- Contractul Organizațional guvernează autoritatea, rolurile și aprobările
  potrivit statutului său oficial.
- Planurile tehnice sunt subordonate Roadmap-ului.
- Rapoartele de etapă și deciziile de închidere sunt dovezi și nu se rescriu.
- Orice schimbare de direcție, etapă sau prioritate necesită actualizarea
  controlată a acestui document și aprobarea Turn Command Center.
- Nicio prevedere a Roadmap-ului nu autorizează singură modificarea codului,
  infrastructurii, Production, secretelor sau datelor.
