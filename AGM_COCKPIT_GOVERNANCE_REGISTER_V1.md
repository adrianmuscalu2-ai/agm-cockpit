# AGM Cockpit Governance Register v1

**Statut:** APPROVED / ACTIVE  
**Versiune:** 1.0  
**Data:** 1 august 2026  
**Data intrării în vigoare:** 1 august 2026, Europe/Berlin  
**Autoritate de aprobare:** Turn Commander — Adrian  
**Domeniu:** aplicația AGM Cockpit — Browser, Android, API, date, Premium și servicii operaționale  
**Autoritate:** Mandatul Operațional „Etapa următoare AGM Cockpit” și Contractul Organizațional AGM v1  
**Efect:** document de guvernanță; nu autorizează implementări, deployment sau schimbări în Production

## 1. Scop

Prezentul registru este sursa oficială pentru identitatea, proprietatea, responsabilitățile, ciclul de viață, interfețele, validarea și arhivarea modulelor AGM Cockpit.

Niciun modul nou și nicio extindere materială a unui modul existent nu intră în implementare înainte de existența unui Plan de Modul aprobat și legat de un ID din acest registru.

## 2. Surse canonice și ordine de precedență

1. Mandatul explicit al Product Ownerului / Turn Commanderului.
2. Contractul Organizațional AGM v1.
3. Prezentul Governance Register.
4. Planul aprobat al modulului.
5. Contractele, registrele și testele din cod.
6. Rapoartele de validare și arhivele istorice.

În caz de contradicție se aplică sursa superioară, iar contradicția este deschisă ca decizie de guvernanță. Documentele istorice nu pot suprascrie contractele actuale.

## 3. Unitatea de guvernanță

Un **modul** este o capabilitate cu responsabilitate proprie, limite explicite, interfețe controlate și lifecycle verificabil. Un director, un ecran sau un serviciu tehnic nu este automat modul separat; este înregistrat separat numai dacă are owner, contract și risc operațional distinct.

Fiecare înregistrare trebuie să dețină obligatoriu:

- obiectiv și limite;
- Module Owner unic;
- echipă de implementare;
- monitor desemnat;
- responsabil de mentenanță;
- QA independent de implementator;
- Inspector independent;
- responsabil de documentație;
- interfețe și date schimbate;
- criterii PASS și condiții NO-GO;
- plan de incidente și schimbări;
- dosar oficial de arhivă.

## 4. Roluri canonice

| Rol | ID canonic | Responsabilitate | Limită de autoritate |
|---|---|---|---|
| Turn Commander / Product Owner | `turn-commander-adrian` | prioritate, mandat, aprobare și închidere | nu înlocuiește QA sau Inspectorul |
| Architecture Guardian | `architecture-guardian` | limite, contracte, dependențe și coerență | nu validează propria implementare |
| Module Owner Frontend | `frontend-experience` | Browser, Android și experiență UI | nu autorizează singur publicarea |
| Module Owner Backend | `backend-infrastructure` | API, integrare și custodie tehnică | nu schimbă date/secrete fără owner specializat |
| AI & Localization Owner | `i18n-localization` | limbi, traducere și agenți lingvistici | publicarea lingvistică necesită validare umană |
| Release & Operations | `release-operations` | build, deployment, rollback și stare medii | nu emite verdict QA |
| Technical Lead / Maintenance | `agent-codex` | proiectare tehnică, implementare și mentenanță controlată | nu validează independent propria schimbare |
| QA Validator | `agent-qa` — **PROPUS** | teste funcționale, regresie, Browser și Android | trebuie să fie diferit de implementator; activarea cere aprobarea prezentului registru și înscriere în registrul agenților |
| Chief Inspector | `agent-inspector` | verificare independentă, arhitectură și verdict | nu execută remedierea verificată |
| Infrastructure Reuse Coordinator | `infrastructure-reuse-coordinator` | verifică fundația TURN și emite Infrastructure Reuse Report înainte de proiectare | nu implementează, nu aprobă și nu modifică arhitectura sau registrele |
| Documentation Owner | `documentation` | documentație curentă și legături către dovezi | nu modifică verdictul tehnic |
| AGM Chronicler | `agent-agm-chronicler` | cronologie, decizii și arhivă oficială | nu rescrie istoricul validat |
| Version Guardian | `version-guardian` | commit, tag, artefact, checksum și baseline | nu aprobă conținutul funcțional |

### Decizie necesară QA

Contractul existent descrie `QA & Validation` ca o capabilitate, nu ca agent autonom. Noul mandat cere un agent QA nominal. Prezentul v1 propune `agent-qa`, sub Independent Assurance și separat de `agent-inspector`. Până la aprobarea și înregistrarea acestui rol, niciun plan nou de modul nu poate trece de poarta **Aprobare pentru implementare**.

## 5. Profiluri obligatorii de responsabilitate

Un profil extinde integral fiecare rând din catalog; nu reprezintă o scurtătură sau o responsabilitate implicită.

| Profil | Owner | Implementare | Monitor | Mentenanță | QA | Inspector | Documentație | Arhivă |
|---|---|---|---|---|---|---|---|---|
| `GOV-FE` | Frontend & Website Owner | Frontend Experience + `agent-codex` sub mandat | MON-004 Browser; MON-005 Android; MON-009 UI LIVE | `agent-codex` + owner | `agent-qa` | `agent-inspector` | Documentation Owner | Chronicler + Version Guardian |
| `GOV-BE` | Backend & Data Custodian | Backend/Engineering + `agent-codex` sub mandat | MON-003 API; MON-010 Incidente | `agent-codex` + owner | `agent-qa` | `agent-inspector` | Documentation Owner | Chronicler + Version Guardian |
| `GOV-AI` | ownerul AI indicat în catalog | Engineering AI + agenți lingvistici unde este cazul | MON-006 AI; MON-009 UI LIVE | `agent-codex` + owner | `agent-qa` + validare umană lingvistică unde este cazul | `agent-inspector` | Documentation + Linguistic Librarian | Chronicler + Version Guardian |
| `GOV-DATA` | Data Accountable | Backend & Data Custodian | MON-007 Database; MON-010 Incidente | Backend custodian + `agent-codex` | `agent-qa` | `agent-inspector` | Documentation / Chronicler | Chronicler + Version Guardian |
| `GOV-OPS` | Release & Operations sau Turn Operations, conform rândului | executorul operațional desemnat prin mandat | monitorul MON specific serviciului | Release Operations + custode | `agent-qa` unde există UI/flux; altfel validator tehnic desemnat | `agent-inspector` | Documentation Owner | Chronicler + Version Guardian |
| `GOV-SEC` | Security Governance / Secret Guardian | executor specializat, acces minim | MON-012 Security | ownerul specializat | `agent-qa` numai pe suprafața ne-secretă | `agent-inspector` read-only | raport redactat | Chronicler/Version fără secrete |

## 6. Stări și porți de lifecycle

### 6.1 Regula de continuitate pentru modulele existente

Modulele implementate și validate tehnic înainte de activarea prezentului registru nu reiau automat ciclul de dezvoltare de la început. Istoricul tehnic, testele, rapoartele și validările existente rămân valabile dacă sunt identificabile, verificabile și aplicabile versiunii curente.

Pentru fiecare modul existent, G0 începe cu o **Evaluare de Continuitate** care:

1. identifică versiunea și starea tehnică actuală;
2. inventariază dovezile istorice și gate-urile pe care acestea le acoperă;
3. confirmă că dovezile aparțin codului și artefactului curent;
4. consemnează gate-urile recunoscute, fără repetarea muncii validate;
5. identifică exclusiv golurile de guvernanță, riscurile și dezvoltările noi;
6. stabilește punctul real de intrare în lifecycle și planul incremental;
7. obține confirmarea Module Ownerului, QA și Inspectorului pentru reutilizarea dovezilor.

Un gate istoric poate fi recunoscut ca `SATISFĂCUT PRIN DOVADĂ ISTORICĂ` numai dacă există trasabilitate către cerință, versiune, test, verdict și artefact. Dovezile incomplete, neverificabile, depășite de schimbări materiale sau incompatibile cu arhitectura actuală nu sunt reutilizate.

Această regulă nu acordă automat PASS de guvernanță. Modulul evoluează din starea sa reală, completează controalele lipsă și primește PASS numai după ce dosarul curent demonstrează acoperirea tuturor condițiilor aplicabile.

Pentru un modul complet nou se aplică integral G0–G11. Pentru o extindere materială, ciclul pornește de la cel mai timpuriu gate afectat, iar componentele neafectate își păstrează dovezile validate.

### 6.1 Stări permise

`INVENTARIAT` → `PLAN ÎN LUCRU` → `PLAN APROBAT` → `ÎN IMPLEMENTARE` → `ÎN TESTARE` → `QA PASS` → `INSPECTOR PASS` → `DOCUMENTAT` → `ARHIVAT` → `MONITORIZAT` → `ÎMBUNĂTĂȚIRE`

Stări terminale sau de control: `BLOCKED`, `NO-GO`, `SUPERSEDED`, `RETIRED`.

### 6.2 Flux obligatoriu

Proiectare → Revizuire arhitecturală → Aprobare → Implementare → Testare → Validare QA → Verificare Inspector → Documentare → Arhivare → Monitorizare → Îmbunătățire continuă.

Nicio stare nu poate fi sărită. O remediere urgentă poate utiliza flux accelerat numai dacă este documentată, testată, inspectată și arhivată înainte de închidere.

## 7. Catalogul modulelor aplicației

**Legendă stare istorică:** valorile din ultima coloană consemnează starea la
adoptarea inițială a registrului. `BASELINE` înseamnă că existau implementare și
dovezi anterioare; `INVENTARIAT` înseamnă că modulul fusese identificat. Aceste
valori nu trebuie interpretate ca stare curentă după constituirea dosarelor v1.0.

**Reconciliere la 2 august 2026:** starea curentă este cea din
`ARCHITECTURE_STATUS.md` și din dosarul individual
`evidence/governance/modules/<ID>/v1.0/`. APP-001–APP-015, API-001–API-008,
PRE-001–PRE-008, DATA-001 și OPS-001–OPS-004 sunt `PASS / CLOSED`. OPS-005 rămâne
`PLANNED / INACTIVE; NO-GO`. Mențiunile `BASELINE; PLAN PENDING` de mai jos sunt
checkpoint-uri istorice, nu restanțe active.

| ID | Modul / responsabilitate | Limite și interfețe principale | Profil | Owner | Monitor specific | Stare la adoptarea registrului |
|---|---|---|---|---|---|---|
| APP-001 | App Shell & Navigation — bootstrap, rutare, lifecycle vizual | view registry, state, i18n, toate modulele UI | GOV-FE | Frontend & Website Owner | MON-004/005/009 | BASELINE; PLAN PENDING |
| APP-002 | Traducător contextual — traducere și compunere controlată | UI ↔ Translation Adapter ↔ API-003; outbox | GOV-AI | AI & Localization Owner | MON-006/004/005 | BASELINE; PLAN PENDING |
| APP-003 | Email Assistant — compunere, corectare și handoff e-mail | Mail controller ↔ translator ↔ platform mail/outbox | GOV-FE | Frontend & Website Owner | MON-004/005/009 | PASS / CLOSED — v1.0, 2026-08-01 |
| APP-004 | OCR Documente — captură, extracție și reutilizare text | OCR controller ↔ platform/capabilities ↔ translator | GOV-FE | Frontend & Website Owner | MON-004/005/009 | PASS / CLOSED — v1.0, 2026-08-01 |
| APP-005 | Contact Manager — contacte și selecție destinatar | contact controller ↔ storage ↔ mail/phone platform | GOV-FE | Frontend & Website Owner | MON-004/005 | BASELINE; PLAN PENDING |
| APP-006 | Corector text — corectare și formatare controlată | text-corrector ↔ translator/mail ↔ i18n | GOV-AI | AI & Localization Owner | MON-006/009 | BASELINE; PLAN PENDING |
| APP-007 | Profil șofer — date locale de profil și preferințe | app state ↔ storage; fără date sensibile neaprobate | GOV-FE | Frontend & Website Owner | MON-004/005/012 | BASELINE; PLAN PENDING |
| APP-008 | I18n, voce și cataloage RO/DE/EN | dictionare ↔ speech locale ↔ toate UI-urile | GOV-AI | AI & Localization Owner | MON-006/009 | BASELINE; PLAN PENDING |
| APP-009 | Storage & Offline — persistență locală și repositories | browser/Android storage ↔ module; fără bypass de owner | GOV-FE | Frontend & Website Owner | MON-004/005/012 | BASELINE; PLAN PENDING |
| APP-010 | Incident Journal Client — captură, stare și reconciliere incidente | UI ↔ API-006 ↔ Turn; fără autovalidare | GOV-OPS | Turn Operations | MON-010/009 | BASELINE; PLAN PENDING |
| APP-011 | Turn Command Center UI — operare read-only și coordonare | monitoring, incidents, governance, API-007 | GOV-OPS | Turn Operations | MON-009/010/012 | BASELINE; PLAN PENDING |
| APP-012 | Înainte de plecare — pregătirea controlată a cursei | facade ↔ API-005 ↔ transports/outbox | GOV-FE | Frontend & Website Owner | MON-004/005/003 | BASELINE; PLAN PENDING |
| APP-013 | După plecare — journey operațional după pornire | journey adapter ↔ transports/outbox/context | GOV-FE | Frontend & Website Owner | MON-004/005/003 | BASELINE; PLAN PENDING |
| APP-014 | Outbox comun — evenimente și handoff între contexte | pre-departure/operational ↔ repositories/API | GOV-BE | Backend & Data Custodian | MON-003/010 | BASELINE; PLAN PENDING |
| APP-015 | Platform Capabilities — browser/Android adapters și diagnostice | UI ↔ platform APIs; acces minim | GOV-FE | Frontend & Website Owner | MON-004/005/012 | PASS / CLOSED — v1.0, 2026-08-01 |
| PRE-001 | Premium Shell & Command Center | module Premium ↔ app shell; fără logică de domeniu duplicată | GOV-FE | Frontend & Website Owner | MON-004/005/009 | BASELINE; PLAN PENDING |
| PRE-002 | AI Governance — politici, permise, risc și kill switch | toate modulele AI ↔ Inspector/Security | GOV-SEC | Architecture Guardian | MON-006/012 | BASELINE; PLAN PENDING |
| PRE-003 | AI Copilot — asistență conversațională Premium | context ↔ AI governance ↔ recomandări | GOV-AI | Architecture Guardian | MON-006/009/012 | BASELINE; PLAN PENDING |
| PRE-004 | Analiză contextuală avansată | operational context ↔ transports ↔ AI governance | GOV-AI | Architecture Guardian | MON-006/003/012 | BASELINE; PLAN PENDING |
| PRE-005 | Agenți lingvistici profesionali | i18n ↔ AI provider ↔ librarian; validare umană | GOV-AI | AI & Localization Owner | MON-006/009 | BASELINE; PLAN PENDING |
| PRE-006 | Recomandări proactive | context ↔ inspector policy ↔ copilot | GOV-AI | Architecture Guardian | MON-006/010/012 | BASELINE; PLAN PENDING |
| PRE-007 | Asistent Încărcare Auto / Load Safety | UI ↔ API-008 ↔ evidence; decizie umană | GOV-BE | Backend & Data Custodian | MON-003/004/005/012 | BASELINE; PLAN PENDING |
| PRE-008 | Context operațional Premium | pre/after departure ↔ transports ↔ lifecycle map | GOV-BE | Backend & Data Custodian | MON-003/010 | BASELINE; PLAN PENDING |
| API-001 | API Core & Health — bootstrap, readiness, throttling | toate modulele API ↔ infrastructură | GOV-BE | Backend & Data Custodian | MON-003/012 | BASELINE; PLAN PENDING |
| API-002 | Auth & Users — identitate, sesiuni și autorizare | clients ↔ JWT/users ↔ DB; date protejate | GOV-SEC | Security Governance Owner | MON-003/007/012 | BASELINE; PLAN PENDING |
| API-003 | Translation Service & Provider | APP-002/006 ↔ AI provider | GOV-AI | Backend & Infrastructure | MON-003/006/012 | BASELINE; PLAN PENDING |
| API-004 | Transports Lifecycle — creare, tranziții, plăți, numerotare, arhivare | clients ↔ repositories ↔ DB/audit | GOV-DATA | Data Accountable | MON-003/007/010 | BASELINE; PLAN PENDING |
| API-005 | Pre-departure Contract & Sync | APP-012 ↔ transports/DB | GOV-BE | Backend & Data Custodian | MON-003/007 | BASELINE; PLAN PENDING |
| API-006 | Incidents, Evidence & Validation Reports | APP-010/011 ↔ storage/audit | GOV-OPS | Turn Operations | MON-003/010/012 | BASELINE; PLAN PENDING |
| API-007 | Turn Admin — acces administrativ și limitarea tentativelor | Turn UI ↔ auth/security/audit | GOV-SEC | Security Governance Owner | MON-003/010/012 | BASELINE; PLAN PENDING |
| API-008 | Premium Load Safety Service | PRE-007 ↔ providers/evidence | GOV-BE | Backend & Data Custodian | MON-003/010/012 | BASELINE; PLAN PENDING |
| DATA-001 | Prisma & PostgreSQL Persistence | toate API ↔ PostgreSQL; migrații separate | GOV-DATA | Data Accountable | MON-007/012 | BASELINE; PLAN PENDING |
| OPS-001 | Browser Runtime | build web ↔ API/public routes | GOV-OPS | Frontend & Website Owner | MON-004/009 | BASELINE; PLAN PENDING |
| OPS-002 | Android/APK Runtime | Capacitor/Android ↔ API/device capabilities | GOV-OPS | Frontend & Website Owner | MON-005/009/012 | PASS / CLOSED — v1.0, 2026-08-01 |
| OPS-003 | Monitoring & Operations Health | MON-001…012 ↔ incidents/Turn | GOV-OPS | Chief Monitoring Inspector | Chief Inspector/Turn review | PASS / CLOSED — v1.0; OPS-005 separat, 2026-08-01 |
| OPS-004 | Release, Deployment & Rollback | artefact ↔ Docker/systemd/Cloudflare/fallback | GOV-OPS | Release & Operations | MON-001/002/008/012 | PASS / CLOSED / OPERATIONAL PROCEDURE — v1.0; deploymenturile cer mandat distinct, 2026-08-01 |
| OPS-005 | Telemetrie continuă | colector ↔ retenție ↔ monitoring | GOV-OPS | Release & Operations | MON-011 | PLANNED/INACTIVE; NO-GO |

## 8. Contractul de comunicare între module

Orice Plan de Modul trebuie să declare pentru fiecare interfață:

| Câmp obligatoriu | Conținut |
|---|---|
| Provider / Consumer | ID-urile modulelor implicate |
| Contract | tip, schemă, endpoint, eveniment sau port |
| Direcție | request/response, event, read-only sau command |
| Owner date | un singur owner pentru fiecare categorie de date |
| Autorizare | identitatea și permisiunea minimă necesară |
| Erori | coduri, retry, timeout, fallback și idempotency |
| Observabilitate | health, audit, metrică sau motiv explicit pentru absență |
| Versionare | compatibilitate, migrare și deprecation |
| Date sensibile | clasificare, retenție, redactare și interdicții |

Sunt interzise: importurile circulare, accesul direct la storage-ul altui modul, duplicarea regulilor de domeniu, contractele neverisonate și comunicațiile care ocolesc auditul sau autorizarea.

## 9. Criterii globale PASS

Un modul primește PASS numai când există dovezi pentru toate punctele:

1. obiectivul, limitele și interfețele sunt aprobate;
2. ownerul și toate rolurile sunt nominalizate;
3. implementarea planificată este completă și trasabilă la mandat;
4. build, teste unitare, integrare și regresie sunt PASS;
5. Browser și Android sunt validate când modulul are suprafață UI;
6. securitatea, confidențialitatea și datele sunt validate proporțional riscului;
7. monitorizarea are sursă reală, prag, frecvență și escaladare;
8. mentenanța are runbook, fallback și regulă de schimbare;
9. QA emite verdict independent;
10. Inspectorul confirmă arhitectura și dovezile;
11. documentația este completă și fără contradicții;
12. artefactul, commitul, testele și decizia sunt arhivate;
13. Turn Commanderul închide oficial etapa.

PASS tehnic, PASS QA, PASS Inspector și PASS operațional sunt verdicturi distincte; PASS final le cere pe toate.

## 10. Condiții globale NO-GO

Oricare dintre următoarele blochează aprobarea sau publicarea:

- owner, QA, Inspector, monitor, mentenanță sau documentație neatribuite;
- Infrastructure Reuse Report absent pentru un modul nou sau o extindere materială;
- Plan de Modul lipsă ori neaprobat;
- contracte de interfață neclare sau contradictorii;
- teste obligatorii absente/eșuate ori regresii neexplicate;
- afirmații de disponibilitate fără dovezi;
- acces la date/secrete fără owner și autorizare;
- migrare fără backup, restore testat și rollback;
- monitorizare simulată prezentată ca reală;
- incident critic activ fără decizie explicită;
- implementatorul validează independent propria schimbare;
- documentația nu corespunde codului;
- artefactul final nu este identificabil și reproductibil;
- modificarea materialelor protejate fără mandat;
- activarea OPS-005 înaintea custodelui, retenției, runbook-ului și validării.

## 11. Monitorizare, mentenanță, incidente și schimbări

### Monitorizare

Planul definește: monitorul, sursa reală, frecvența, starea sănătoasă, pragurile, datele interzise, canalul de escaladare și legătura cu Incident Journal. Monitorii sunt read-only și nu remediază.

### Mentenanță

Module Ownerul păstrează backlog-ul și compatibilitatea. `agent-codex` execută numai sub mandat. Orice schimbare materială reia lifecycle-ul de la Proiectare; corecțiile minore păstrează obligatoriu testarea, documentarea și arhivarea.

### Incidente

Detectare → înregistrare → clasificare → owner → containment → remediere mandatată → test → QA → Inspector → documentare → arhivare → lecție învățată. Incidentul nu se închide pe baza dispariției simptomului.

### Îmbunătățire continuă

Datele din incidente, monitorizare, feedback și audit generează propuneri separate. Nicio recomandare nu devine automat implementare.

## 12. Dosarul oficial de arhivă

Pentru fiecare versiune validată se păstrează:

- ID modul și versiune;
- mandat și Plan de Modul aprobate;
- decizie arhitecturală;
- commit/tag și lista fișierelor;
- rezultate build/test și capturi relevante;
- verdict QA și verdict Inspector;
- documentație utilizator și runbook;
- matricea interfețelor și migrațiilor;
- incidente/excepții cunoscute;
- checksum/locație artefact;
- decizia Turn Commanderului;
- data următoarei revizuiri.

Custodie: Documentation Owner pentru documentația curentă, AGM Chronicler pentru istoric și Version Guardian pentru cod și artefacte.

## 13. Șablon obligatoriu — Plan de Modul

```text
ID și denumire:
Versiune plan:
Mandat:
Stare curentă:
Infrastructure Reuse Report (ID, concluzie și referințe canonice):

1. Obiectiv și rol
2. În afara domeniului
3. Arhitectură și interfețe
4. Plan de implementare pe etape
5. Module Owner
6. Implementatori și responsabilități
7. Monitor și procedură
8. Responsabil mentenanță și procedură
9. Agent QA și matrice de teste
10. Inspector și criterii arhitecturale
11. Responsabil documentație
12. PASS și NO-GO specifice
13. Incidente, schimbări și rollback
14. Dosar și locație de arhivă
15. Aprobări: Owner / Architecture / QA / Inspector / Turn
```

### Poarta obligatorie pre-design

Înainte de proiectarea unei funcții noi sau a unei extinderi materiale,
`infrastructure-reuse-coordinator` interoghează TURN și emite raportul conform
`TURN_INFRASTRUCTURE_REUSE_REPORT_CONTRACT_V1.md`. Architecture nu începe
proiectarea până când raportul nu are una dintre concluziile:

- `FOUNDATION FOUND` — fundația se reutilizează;
- `FOUNDATION PARTIAL` — fundația se extinde fără structură paralelă;
- `FOUNDATION NOT FOUND` — lipsa este demonstrată și poate intra în proiectare.

Incidentele, remedierile minore și mentenanța aflate în limitele unui serviciu
existent pot referi un raport încă valabil; analiza nu se repetă fără schimbare de
scope, contract sau risc.

## 14. Controlul modificărilor registrului

Orice modificare include versiune, dată, motiv, autorul propunerii, module afectate și aprobări. ID-urile nu se reutilizează. Modulele înlocuite devin `SUPERSEDED`; nu sunt șterse. Eliminarea devine `RETIRED` numai după migrare, verificarea dependențelor și arhivare.

Principiul de continuitate este obligatoriu: se dezvoltă înainte, fără reconstruirea nejustificată a implementărilor validate. Repetarea unei activități istorice este permisă numai când Evaluarea de Continuitate constată lipsa dovezii, expirarea relevanței, schimbare materială, regresie, risc nou sau neconformitate.

## 15. Condiții active și următoarea etapă

1. Rolul independent `agent-qa` trebuie nominalizat și acceptat în dosarul fiecărui modul înainte de validarea QA.
2. Cele 37 de înregistrări reprezintă granularitatea oficială a versiunii 1; împărțirea sau consolidarea ulterioară necesită controlul modificărilor și o versiune succesoare.
3. Ownerii indicați pentru PRE-002, PRE-003, PRE-004 și PRE-006 sunt acceptați ca baseline; acceptarea nominală se consemnează în dosarul modulului înainte de G3.
4. Locația canonică pentru dosarele de modul este `evidence/governance/modules/<MODULE-ID>/<VERSION>/`.
5. Următoarea etapă este G0 — deschiderea dosarului `APP-003 — Email Assistant`, primul modul din ordinea oficială validată.

## 16. Statut final al documentului

Prezentul document este **AGM Cockpit Governance Register v1 — APPROVED / ACTIVE**.

Începând cu data intrării în vigoare:

- registrul este documentul oficial de referință pentru dezvoltarea AGM Cockpit;
- niciun modul nu intră în implementare fără Planul de Modul aprobat;
- toate modulele parcurg integral G0–G11 înainte de PASS;
- validările tehnice istorice rămân consemnate, fără a acorda automat PASS de guvernanță;
- registrul rămâne obligatoriu până la aprobarea unei versiuni succesoare;
- aprobarea registrului nu autorizează singură modificări de cod, deployment sau Production.

### Înregistrarea aprobării

| Câmp | Valoare oficială |
|---|---|
| Decizie | APPROVED / ACTIVE — AGM COCKPIT GOVERNANCE REGISTER v1 |
| Autoritate | Turn Commander — Adrian |
| Data efectivă | 1 august 2026, Europe/Berlin |
| Domeniu acceptat | Cele 37 de module din catalogul v1 |
| Următorul gate | G0 — `APP-003 — Email Assistant` |
| Arhivă | `archives/governance/AGM-GOV-REG-001/v1.0/2026-08-01/` |

### Directivă de continuitate

Directiva operațională privind continuitatea dezvoltării este activă ca interpretare obligatorie a lifecycle-ului. Ea păstrează istoricul tehnic, permite recunoașterea gate-urilor deja dovedite și limitează dosarul inițial la guvernanța lipsă, riscurile actuale și dezvoltarea nouă sau extinderea aprobată.

### Ordinea oficială de dezvoltare

Ordinea celor 37 de module a fost validată și este consemnată în `MODULE_DEVELOPMENT_ORDER.md` din arhiva registrului. Ordinea controlează deschiderea dosarelor și prioritizarea dezvoltărilor noi; nu obligă la repetarea activităților istorice validate și nu reprezintă, singură, mandat de implementare.
