# AGM – Audit organizațional complet

Data auditului: 2026-07-28  
Tip: audit documentar și organizațional, fără implementare  
Autoritate: mandat oficial de audit organizațional AGM  
Stare infrastructură/cod/roluri: nemodificate de audit

## 1. Sinteză executivă

AGM dispune de o structură de control remarcabil de bine dezvoltată pentru un
proiect aflat încă într-o etapă de consolidare: există autoritate umană explicită,
separarea dintre autorizare, execuție și validare, proceduri STOP/NO-GO,
trasabilitate, registru de incidente, control al secretelor și mecanisme de
continuitate.

Structura nu este însă încă administrată printr-o singură sursă organizațională de
adevăr. Auditul a identificat patru modele paralele:

1. organigrama oficială Turn Architecture V1;
2. modelul de 12 departamente și 10 agenți generici din aplicație;
3. registrul de guvernanță cu 29 de înregistrări;
4. rolurile temporare pentru deployment, rollback și criză.

Fiecare model este util în scopul său, dar termenii `agent`, `rol`,
`departament`, `coordonator`, `responsabil` și `validator` nu sunt folosiți
uniform. Unele entități sunt concomitent persoane, agenți AI, echipe, funcții,
departamente sau autorități. Aceasta produce suprapuneri, neclarități privind
ownership-ul și riscul ca un control corect documentat într-un registru să nu fie
vizibil în altul.

### Verdict

**Maturitate organizațională: NIVEL 3 DIN 5 – DEFINITĂ, DAR FRAGMENTATĂ.**

AGM este suficient de matur pentru operare controlată în forma actuală, dar nu
este încă optimizat pentru creșterea numărului de module, agenți și operatori.
Recomandarea oficială este o etapă separată de **consolidare a guvernanței
organizaționale**, fără schimbarea imediată a autorităților existente.

Prioritatea maximă este instituirea unui registru organizațional canonic care să
separe clar:

- persoane și autorități umane;
- agenți permanenți;
- capabilități/departamente;
- roluri temporare de change window;
- roluri activate numai la incident;
- stări `active`, `monitoring`, `planned`, `inactive` și `proposal`.

## 2. Mandat, limitări și metodă

### 2.1 Operațiuni executate

- inventarierea documentelor de guvernanță;
- compararea organigramei declarate cu registrele din cod;
- compararea rolurilor permanente cu rolurile Gate 6 și Crisis Coordination Cell;
- analiza responsabilităților, autorităților și restricțiilor;
- construirea unei matrice RACI la nivel de proces;
- identificarea suprapunerilor, golurilor și dependențelor;
- formularea unei propuneri și a unui plan de implementare viitor.

### 2.2 Operațiuni neexecutate

- nu s-a modificat organigrama;
- nu s-au creat, activat, dezactivat sau eliminat agenți;
- nu s-au schimbat responsabilități;
- nu s-a modificat codul aplicației;
- nu s-a modificat infrastructura Production;
- nu s-a efectuat deployment;
- nu s-au modificat documentele aprobate anterior.

### 2.3 Surse principale

| Sursă | Rol în audit | SHA-256 |
|---|---|---|
| `TURN_ARCHITECTURE_V1_BASELINE.md` | organigramă oficială | `9D7D2C4A368FA5B4AE76BBE10CED4213E4D79919AA80E355897D8344671B5F3E` |
| `TURN_ORGANIZATION_CHART_REPORT.md` | reguli de încadrare și raportare | `C659443CB2AC9FED5BDAA006D8169E5B5B04C088D6A101F2F237F16125613D05` |
| `TURN_MONITORING_DEPARTMENT_REPORT.md` | cei 12 agenți de monitorizare | `58A2D7FC8C19C3E979F547768DB2785B24ABAFA438B0E8B0C6A9D8F1AD6F7432` |
| `AI_GOVERNANCE.md` | fluxul recomandare–aprobare–execuție | `C80C3FC14EAB4E777F72551A70128540857543D3B1260B73F2B0EA799248E37F` |
| `deploy/production/OPERATIONAL_ROLES.md` | separarea atribuțiilor în change window | `8F793C781CCBF7BFCB473BD1C4638BDAFB2718C7FE29F6892173FE309C9EB508` |
| `AGM_GATE6B_OPERATIONAL_ROLES_REPORT.md` | validarea rolurilor operaționale | `F0DFEFC6944555A4E05CA0201EDD468CF54FA6287B8479A3F3B9EF24B93A62E9` |
| `AGM_CRISIS_COORDINATION_CELL_ARCHITECTURE.md` | model de criză propus | `E35CC59ACA96CC8B032DEC41D0354174061C8148451E73AE4240E5834A0E4907` |
| `apps/web/src/turn-command-center.ts` | modelul curent de departamente/agenți | `EB43B568013A0AD10795818A372E71C7E1316892D5D5C4F331D948B0E97C2F4B` |
| `apps/web/src/agent-governance.registry.ts` | registrul curent de guvernanță | `0D4E9E2A9D41F81C543E82983B1A6D9554CAD92E212E7DCFE78F9D9EA6359949` |
| `apps/web/src/monitoring-department.ts` | sursele și intervențiile monitorizării | `F51B96B15801483E2A1445F2A4AD12C5FDA2A402B1AA837F962D305F411FCAE4` |
| `apps/web/src/maintenance-department.ts` | conducerea mentenanței și memoriei | `4CB053429388DCC1A8DE1AE28630C0C943B901E980FCBA44508EBFCBC9A297BB` |

## 3. Constatări factuale

### 3.1 Organigrama oficială declarată

```text
MENTOR
└── ADRIAN – TURN COMMANDER
    ├── ATLAS – Coordonare Operațională
    │   ├── Inspecție Basic
    │   ├── Inspecție Premium
    │   ├── Website
    │   ├── Browser
    │   ├── Android
    │   ├── AI
    │   ├── API
    │   ├── Baze de date
    │   ├── i18n
    │   ├── UX/UI
    │   └── Release & Operations
    └── INSPECTOR ȘEF MONITORIZARE
        ├── MON-001 Server Principal
        ├── MON-002 Server Backup
        ├── MON-003 API
        ├── MON-004 Browser
        ├── MON-005 Android
        ├── MON-006 AI
        ├── MON-007 Bază de date
        ├── MON-008 Cloudflare / rute publice
        ├── MON-009 UI LIVE
        ├── MON-010 Incidente
        ├── MON-011 Telemetrie
        └── MON-012 Securitate
```

Atlas și Inspectorul Șef sunt coordonatori de nivel egal și raportează direct
Turn Commanderului. Modelul este clar la primele două niveluri, dar ramura Atlas
amestecă departamente, platforme, activități și roluri de control.

### 3.2 Departamente existente în modelul aplicației

Modelul actual conține **12 departamente**, nu 11:

| ID | Departament | Stare declarată | Observație factuală |
|---|---|---:|---|
| `monitoring` | Monitorizare | active | are 12 agenți dedicați |
| `maintenance-quality-evolution` | Mentenanță, Calitate și Evoluție | active | are cinci membri/directori |
| `turn-command` | Turn Command | active | autoritate și coordonare |
| `product-roadmap` | Product & Roadmap | planned | Mentor este totuși `active` în registru |
| `architecture-platform` | Architecture & Platform | active | Architecture Guardian |
| `frontend-experience` | Frontend Experience | active | Browser și Android |
| `backend-infrastructure` | Backend & Infrastructure | stable | API și infrastructură |
| `ai-agents` | AI & Agents | watch | include i18n și agenți lingvistici |
| `qa-validation` | QA & Validation | active | rolurile detaliate nu sunt canonice |
| `security-legal` | Security & Legal | active | securitate și legal agregate |
| `release-operations` | Release & Operations | planned | agentul omonim este `active` |
| `documentation-knowledge` | Documentation & Knowledge | active | documentație și memorie operațională |

Există două discrepanțe directe de stare:

- `release-operations` este departament `planned`, dar agentul
  `Release & Operations` este `active`;
- `product-roadmap` este departament `planned`, dar `Mentor` este `active`.

### 3.3 Lista agenților din registrul de guvernanță

Registrul curent are **29 înregistrări**:

- 12 cu starea `active`;
- 13 cu starea `monitoring`;
- 4 cu starea `planned`.

#### Agenți activi – 12

| Agent | Departament | Responsabilitate principală |
|---|---|---|
| Version Guardian | Release & Operations | baseline-uri, commituri, checkpointuri, deploymenturi |
| Architecture Guardian | Architecture & Platform | hartă canonică și coerență arhitecturală |
| Release & Operations | Release & Operations | dovezi release, health, rollback |
| Frontend Experience | Frontend Experience | Browser, Android și responsive |
| Backend & Infrastructure | Backend & Infrastructure | API, configurație și dependențe |
| Documentation | Documentation & Knowledge | rapoarte și referințe operaționale |
| Codex / Atlas | Maintenance, Quality & Evolution | analiză, soluție, implementare controlată |
| Inspector | Maintenance, Quality & Evolution | validare independentă și regresie |
| Mentor | Product & Roadmap | direcție strategică și produs |
| Linguistic Librarian | Maintenance, Quality & Evolution | terminologie și conținut reutilizabil |
| Director Turn Operations | Maintenance, Quality & Evolution | ciclu operațional și incidente |
| AGM Chronicler | Maintenance, Quality & Evolution | cronologie, lecții și memorie operațională |

#### Agenți în monitorizare – 13

| Agent | Domeniu |
|---|---|
| MON-001 | server principal |
| MON-002 | server backup |
| MON-003 | API |
| MON-004 | Browser |
| MON-005 | Android |
| MON-006 | AI |
| MON-007 | PostgreSQL |
| MON-008 | Cloudflare/rute |
| MON-009 | UI LIVE |
| MON-010 | incidente |
| MON-012 | securitate |
| I18n / Localization | acoperire lingvistică |
| Legal | conformitate juridică |

#### Agenți planificați – 4

| Agent | Domeniu |
|---|---|
| MON-011 | telemetrie continuă |
| Agent lingvistic RO–DE | limbaj |
| Agent lingvistic RO–EN | limbaj |
| Agent lingvistic DE–EN | limbaj |

### 3.4 Agenți generici paraleli

`turn-command-center.ts` mai definește separat 10 agenți generici:

- Architecture;
- QA & Testing;
- UI/UX;
- I18n;
- Security;
- Legal;
- Integration;
- Documentation;
- AI Governance;
- Release.

Aceștia nu au o mapare unu-la-unu formală cu cele 29 de înregistrări. De exemplu:

- `Architecture` și `Architecture Guardian` par aceeași capabilitate;
- `Documentation` există în ambele modele;
- `I18n` și `I18n / Localization` sunt paralele;
- `Release` este `planned`, în timp ce `Release & Operations` este `active`;
- `Security` coexistă cu MON-012 și Secret & Credentials Guardian.

### 3.5 Roluri permanente suplimentare

Documentele operaționale confirmă următoarele roluri, dar nu toate există în
registrul de guvernanță:

| Rol | Stare documentată | Observație |
|---|---|---|
| Turn Commander / Adrian | activ, autoritate finală | nu este în registrul celor 29 |
| Secret & Credentials Guardian | permanent, activare duală | nu este în registrul celor 29 |
| Chief Monitoring Inspector | activ în organigramă | poate fi confundat cu Inspector |
| PC Fallback Custodian | rol operațional | nu este agent permanent separat |
| Command Lead | rol de change window | atribuit Turn Command Center |
| Independent Validator | rol de change window | atribuit AGM Inspector |
| Rollback Responsible | rol de change window | atribuit Atlas/Codex |
| Architecture Advisor | rol suport | atribuit Architecture Guardian |

### 3.6 Roluri de criză

Crisis Coordination Cell este documentată ca **propunere arhitecturală,
neactivată permanent**. Rolurile sale sunt:

- Incident Lead;
- Independent Validator;
- Technical Recovery Executor;
- Fallback Custodian;
- Secret Incident Lead;
- Architecture Advisor;
- Communications Recorder.

Acestea sunt roluri de incident, nu agenți permanenți noi. Documentul păstrează
separarea autorizare–execuție–validare.

## 4. Responsabilități și lanț decizional

### 4.1 Fluxul standard documentat

```text
Detectare/observație
  → Inspector: clasificare și recomandare
  → Turn Command Center: prioritate și aprobare
  → Atlas/Codex: soluție și execuție în mandat
  → Inspector: validare independentă
  → Turn: verdict și închidere
  → Documentation/Chronicler: arhivare și lecții
```

Pentru Production se adaugă:

```text
Secret Guardian pentru orice secret
Release & Operations pentru fallback/evidence
Command Lead pentru fereastra de schimbare
Independent Validator pentru verdict
Rollback Responsible pentru execuția rollbackului
```

### 4.2 Puncte forte factuale

- autorizarea, execuția și validarea sunt separate explicit;
- Inspectorul poate opri publicarea;
- executorul nu își poate autoriza sau valida propria acțiune;
- Secret Guardian are un domeniu exclusiv și autorizare duală;
- există STOP points și criterii NO-GO;
- gate-urile închise nu sunt reluate fără dovezi noi;
- există verificare finală de consistență;
- deciziile și incidentele au istoric;
- fallback-ul și single-writer sunt tratate explicit;
- rolurile de criză nu dobândesc automat autoritate de deployment sau secret.

## 5. Matrice RACI actuală

Legendă: **A** = accountable/autoritate finală; **R** = execută; **C** =
consultat; **I** = informat; **V** = validator independent.

| Proces | Turn Commander / TCC | Atlas/Codex | Inspector | Release & Ops | Architecture Guardian | Secret Guardian | Documentation / Chronicler | Mentor |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Prioritizare produs | A | C | C | I | C | I | I | C |
| Aprobare misiune | A | I | C | C | C | C | I | C |
| Analiză tehnică | C | R | C | C | C | C | I | I |
| Schimbare cod | A | R | V | I | C | I | I | I |
| Schimbare arhitectură | A | R | V | C | C | C | I | C |
| Release/deployment | A | R | V | R | C | C | I | I |
| Administrare fallback | I | C | V | A/R | I | I | I | I |
| Rollback | A | R | V | C/R suport | C | C | I | I |
| Secrete Production | A autorizare | C la nevoie | V read-only | I | I | R/A domeniu | I redactat | I |
| Incident standard | A | R | V | C | C | C | R evidență | I |
| Incident critic/CCC | A | R tehnic | V | R fallback | C | R domeniu secret | R jurnal | I |
| Documentare tehnică | A acceptare | R conținut | V dovezi | C | C | C redactat | R | I |
| Închidere etapă | A | I | V obligatoriu | C | C | C | R arhivare | I |

### Observație RACI

Matricea este funcțională pentru operațiuni critice, însă prezintă mai multe
procese cu doi executori `R` și fără un owner tehnic unic explicit. Acest lucru
este gestionabil în ferestre controlate, dar nu este ideal pentru activitatea
zilnică.

## 6. Suprapuneri identificate

### OVL-01 – Atlas/Codex

Atlas/Codex apare ca:

- coordonator operațional;
- director tehnic;
- arhitect;
- implementator;
- responsabil de rollback;
- technical recovery executor;
- uneori autoritate de aprobare tehnică.

Impact: dependență critică de un singur agent și risc de amestec între decizia
tehnică și execuție. Inspectorul limitează riscul de autovalidare, dar nu elimină
dependența de execuție.

### OVL-02 – Inspector

Inspector, Inspector Șef Monitorizare, Director Controlul Calității și Independent
Validator sunt denumiri apropiate. Documentele sugerează uneori aceeași entitate,
alteori niveluri diferite.

Impact: nu este clar dacă Inspectorul care coordonează monitorizarea este identic
cu validatorul independent al unei schimbări.

### OVL-03 – Turn Command Center

Turn este simultan:

- sistem/aplicație;
- departament;
- autoritate de comandă;
- Command Lead;
- director operațional;
- registru și arhivă de decizii.

Impact: instrumentul și autoritatea umană pot fi confundate. O interfață nu poate
fi juridic sau operațional accountable fără un operator nominalizat.

### OVL-04 – Release, Backend și Atlas

Release & Operations, Backend & Infrastructure și Atlas/Codex includ toate
configurație, infrastructură, deployment și rollback.

Impact: ownership-ul pentru systemd, Docker, Cloudflare și PostgreSQL se stabilește
ad-hoc prin mandat, nu printr-un catalog permanent al serviciilor.

### OVL-05 – Security

Securitatea este împărțită între:

- MON-012 Agent de Securitate;
- departamentul Security & Legal;
- agentul generic Security;
- Secret & Credentials Guardian;
- Inspector;
- Release & Operations.

Impact: detectarea este bine acoperită, dar răspunsul, ownership-ul politicilor și
acceptarea riscului nu au un singur model canonic.

### OVL-06 – Documentație și memorie

Documentation, AGM Chronicler, Turn Command Center și Version Guardian păstrează
toate dovezi, istoric sau trasabilitate.

Impact: documentarea este puternică, dar există risc de duplicare, checksum-uri
divergente și rapoarte cu stare depășită.

### OVL-07 – I18n și agenți lingvistici

I18n generic, I18n / Localization, Linguistic Librarian și cei trei agenți
lingvistici planificați au frontiere apropiate.

Impact: nu este separată clar responsabilitatea pentru cod/dicționare, calitate
lingvistică, terminologie și aprobarea umană.

### OVL-08 – Monitorizare versus ownership

Agenții MON au proceduri de intervenție formulate la imperativ, deși
Departamentul de Monitorizare este definit ca read-only.

Exemple:

- MON-004: „Repornește frontend-ul”;
- MON-012: „rotește credentialele expuse”.

Impact: textul poate fi interpretat ca autoritate de execuție, contrar separării
dintre detectare și remediere.

## 7. Zone fără responsabil clar

### GAP-01 – Owner pentru website-ul de prezentare

Website-ul separat `agmcockpit-website` există, dar organigrama nu identifică un
owner permanent distinct pentru publicare, domeniu, conținut și lifecycle.

### GAP-02 – Product Owner operațional

Mentor oferă direcție strategică, iar Turn aprobă. Nu există un Product Owner
explicit responsabil pentru backlog, criterii de acceptare, prioritizare zilnică
și măsurarea valorii.

### GAP-03 – Service ownership

Nu există un catalog canonic care să desemneze pentru fiecare serviciu:

- owner tehnic;
- owner operațional;
- validator;
- fallback;
- SLO;
- runbook;
- escaladare.

### GAP-04 – Telemetrie

MON-011 este planificat, colectorul nu este implementat și politica de retenție nu
este atribuită.

### GAP-05 – Continuitate personală

Nu există substitut nominal pentru Turn Commander, Atlas/Codex, Inspector sau
Secret Guardian. Rolurile de fallback se referă mai ales la sisteme, nu la oameni.

### GAP-06 – Data governance

Gate 6D definește migrarea și single-writer, dar nu există un Data Owner permanent
pentru clasificare, retenție, calitate, reconciliere și aprobarea accesului.

### GAP-07 – Security governance

Secret Guardian gestionează secrete, iar MON-012 detectează probleme. Nu este
nominalizat explicit un Security Accountable pentru politici, threat model,
incident response și acceptarea riscului rezidual.

### GAP-08 – Starea documentelor

Nu există o taxonomie obligatorie unică pentru `draft`, `proposal`, `approved`,
`active`, `superseded`, `archived`. Unele documente vechi rămân factual accesibile
deși starea curentă s-a schimbat.

### GAP-09 – Managementul capacității și costului

Există audituri de cost AI, dar nu este definit un owner permanent pentru bugete,
capacitate, praguri și optimizarea consumului operațional.

## 8. Riscuri organizaționale

| ID | Risc | Probabilitate | Impact | Nivel |
|---|---|---:|---:|---:|
| R-01 | Atlas/Codex este punct unic pentru coordonare, arhitectură și execuție | mare | critic | critic |
| R-02 | Turn Commander este singura autoritate explicită de mandat | medie | critic | mare |
| R-03 | Inspectorul nu are substitut independent nominalizat | medie | mare | mare |
| R-04 | registrele organizaționale diverg | mare | mare | mare |
| R-05 | rolurile de monitorizare pot părea autorizate să remedieze | medie | mare | mare |
| R-06 | departamente `planned` conțin agenți `active` | mare | mediu | mare |
| R-07 | documentația duplicată poate rămâne în urmă | mare | mediu | mare |
| R-08 | lipsa ownerului website/Data/Security produce activitate ad-hoc | medie | mare | mare |
| R-09 | rolurile de criză propuse pot fi confundate cu roluri active | medie | mediu | mediu |
| R-10 | lipsa telemetriei continue întârzie detectarea | mare | mediu | mare |

## 9. Dependențe între departamente

```text
Product & Roadmap
        │ cerințe/priorități
        ▼
Turn Command ───────► Architecture & Platform
        │ mandat                  │ reguli
        ▼                         ▼
Frontend ───────► Backend & Infrastructure ───────► Release & Operations
   │                        │                              │
   └──────────► QA & Validation ◄─────────────────────────┘
                            │ verdict
                            ▼
                    Turn Command / Inspector

Monitoring ── alerte ──► Turn Command
Security & Legal ── controale ──► toate fluxurile
Documentation & Knowledge ◄── dovezi ── toate departamentele
Secret Guardian ── autorizare duală ──► operațiuni cu secrete
```

### Blocaje observate

1. aproape toate fluxurile ajung la Turn Commander;
2. aproape toate implementările ajung la Atlas/Codex;
3. toate închiderile critice depind de Inspector;
4. toate operațiunile cu secrete depind de un singur Guardian;
5. documentarea este ultimul pas și poate acumula întârzieri;
6. lipsa unui service catalog obligă fiecare mandat să redefinească ownership-ul.

## 10. Procese care pot fi simplificate

### 10.1 Unificarea registrelor

Cele patru modele organizaționale trebuie proiectate ca vederi ale aceluiași
registru, nu ca liste independente.

### 10.2 Separarea entităților

Modelul trebuie să distingă:

- `person`: Adrian/operator uman;
- `authority`: Turn Command;
- `agent`: Codex, Inspector, Guardians;
- `department`: Frontend, Backend etc.;
- `capability`: i18n, security, QA;
- `window-role`: Command Lead, Rollback Responsible;
- `incident-role`: Incident Lead;
- `system`: Turn Command Center UI.

### 10.3 RACI pe servicii

În locul redefinirii rolurilor în fiecare raport, fiecare serviciu trebuie să aibă
un RACI permanent și o extensie temporară pentru change window.

### 10.4 Document lifecycle

Fiecare document trebuie să declare:

- status;
- owner;
- data ultimei validări;
- document înlocuit;
- document succesor;
- scope;
- checksum.

### 10.5 Monitorizare fără autoritate implicită

Procedurile MON trebuie formulate:

`detectează → colectează dovada → deschide incident → escaladează`,
nu ca instrucțiuni directe de restart/rotație.

## 11. Propunere de structură revizuită

Aceasta este o recomandare; nu modifică structura actuală.

```text
MENTOR / STRATEGIC ADVISOR
└── TURN COMMAND AUTHORITY – Adrian
    ├── Product & Portfolio
    │   └── Product Owner AGM
    ├── Engineering
    │   ├── Architecture Guardian
    │   ├── Frontend & Website
    │   ├── Backend & Data
    │   ├── AI & Localization
    │   └── Atlas/Codex – Technical Executor
    ├── Assurance (independent)
    │   ├── Chief Inspector
    │   ├── QA & Validation
    │   ├── Security Assurance
    │   └── Legal & Compliance
    ├── Operations & Reliability
    │   ├── Release & Operations
    │   ├── Service/Fallback Custodians
    │   └── Monitoring Department (MON-001…MON-012)
    ├── Knowledge & Governance
    │   ├── Documentation Owner
    │   ├── AGM Chronicler
    │   ├── Version Guardian
    │   └── Linguistic Librarian
    └── Controlled specialist authorities
        ├── Secret & Credentials Guardian
        ├── Data Owner
        └── Crisis Coordination Cell (inactive until declared)
```

### Principii ale structurii propuse

- Turn rămâne singura autoritate de mandat;
- Inspectorul rămâne independent de Engineering și Operations;
- Atlas/Codex nu mai este descris simultan ca owner al tuturor serviciilor;
- Secret Guardian rămâne exclusiv pe ciclul secretelor;
- CCC rămâne inactiv până la declarație;
- fiecare rol critic primește substitut și condiții de delegare;
- sistemul Turn UI este separat semantic de autoritatea Turn.

## 12. Recomandări prioritizate

| Prioritate | Recomandare | Impact | Efort |
|---|---|---:|---:|
| P0 | Registru organizațional canonic și ID unic pentru fiecare entitate | foarte mare | mediu |
| P0 | Separarea persoană/agent/departament/rol temporar/sistem | foarte mare | mediu |
| P0 | Nominalizarea substituților pentru Turn, Atlas, Inspector și Secret Guardian | foarte mare | mic |
| P0 | Catalog de servicii cu owner, validator, fallback, SLO și runbook | foarte mare | mediu |
| P1 | Reconcilierea stărilor departament–agent | mare | mic |
| P1 | Clarificarea Inspector versus Chief Monitoring Inspector | mare | mic |
| P1 | Owner permanent pentru Website, Data și Security Governance | mare | mic |
| P1 | Politică unică de lifecycle pentru documente | mare | mediu |
| P1 | Reformularea procedurilor MON ca detectare/escaladare | mare | mic |
| P2 | Product Owner și proces unic de backlog/acceptance | mediu-mare | mediu |
| P2 | Activarea telemetriei cu owner și retenție aprobate | mare | mare |
| P2 | Dashboard de capacitate, cost și health organizațional | mediu | mediu |
| P3 | Automatizarea verificării contradicțiilor între registre | mediu | mare |

## 13. Plan etapizat de implementare recomandat

Planul nu este autorizare de implementare.

### Etapa 0 – Înghețarea referinței

- se aprobă raportul de audit;
- se desemnează documentele canonice temporare;
- se interzice adăugarea de noi roluri fără clasificare.

### Etapa 1 – Modelul organizațional

- se definește schema entităților;
- se atribuie ID-uri;
- se clasifică cele 29 de înregistrări;
- se mapează cei 10 agenți generici;
- se separă rolurile Gate/CCC.

### Etapa 2 – Ownership și continuitate

- se publică service catalogul;
- se nominalizează ownerii Website, Data și Security;
- se nominalizează substituții și delegarea;
- se validează separarea atribuțiilor.

### Etapa 3 – RACI și fluxuri

- se aprobă RACI pe serviciu;
- se simplifică fluxurile de aprobare cu praguri de risc;
- se păstrează aprobarea explicită pentru Production, secrete și date;
- se aliniază monitorizarea la escaladare read-only.

### Etapa 4 – Documentație și instrumentare

- se implementează lifecycle-ul documentelor;
- Turn UI devine vedere a registrului canonic;
- se introduc verificări de consistență;
- se arhivează explicit documentele superseded.

### Etapa 5 – Validare organizațională

- tabletop pentru incident, deployment și indisponibilitate de rol;
- test de delegare;
- test de independență a validatorului;
- audit final de consistență;
- verdict READY pentru noul model.

## 14. Criterii recomandate pentru etapa următoare

Etapa de consolidare organizațională poate fi închisă numai dacă:

- toate entitățile au tip și ID unic;
- există un singur registru canonic;
- nicio stare departament–agent nu se contrazice;
- fiecare serviciu are owner și fallback;
- fiecare rol critic are substitut;
- Inspectorul este independent de executor;
- rolurile temporare nu apar drept agenți permanenți activi;
- CCC este marcat explicit activ/inactiv;
- documentele superseded sunt identificabile;
- verificarea finală de coerență este PASS.

## 15. Verdict final

**Verdict audit: PASS DOCUMENTAR / REORGANIZARE CONTROLATĂ RECOMANDATĂ.**

Structura AGM este funcțională și sigură pentru operarea actuală datorită
disciplinei de mandat, separării validării și culturii STOP/NO-GO. Nu există
dovezi că structura actuală ar fi necontrolată.

Totuși, extinderea fără consolidare ar amplifica:

- dependența de câteva roluri unice;
- contradicțiile dintre registre;
- suprapunerile de ownership;
- costul documentării;
- timpul necesar fiecărei aprobări.

Recomandarea oficială pentru etapa următoare este:

**INIȚIEREA UNUI PROGRAM LIMITAT DE CONSOLIDARE A GUVERNANȚEI
ORGANIZAȚIONALE**, începând cu registrul canonic și continuitatea rolurilor
critice. Implementarea trebuie realizată numai prin mandat separat, cu păstrarea
autorităților și controalelor existente până la validarea completă a noului model.

