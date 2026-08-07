# Contractul Organizațional AGM v1

Versiune: 1.0  
Data elaborării: 2026-07-28  
Statut: **FINAL CANDIDATE – ÎN AȘTEPTAREA APROBĂRII OFICIALE**  
Autoritate emitentă: Turn Command Center  
Bază: `AGM_ORGANIZATIONAL_AUDIT_2026-07-28.md`

## Preambul

Prezentul contract definește structura, autoritatea, responsabilitățile,
colaborarea și trasabilitatea organizațională a proiectului AGM.

După aprobarea explicită de către Turn Command Center, contractul devine singura
sursă oficială de adevăr pentru organizarea AGM. Organigramele, registrele,
runbook-urile și documentele anterioare rămân dovezi istorice, dar nu pot
contrazice contractul.

Nicio prevedere din acest contract nu autorizează prin ea însăși deployment,
acces la Production, utilizarea secretelor, modificarea datelor, migrarea,
schimbarea DNS/Cloudflare sau o acțiune ireversibilă. Aceste operațiuni necesită
mandate distincte.

## Articolul 1 – Principii obligatorii

1. **Autoritate umană:** deciziile cu impact material sunt aprobate de o
   autoritate umană nominalizată.
2. **Separarea atribuțiilor:** aceeași identitate nu autorizează, execută și
   validează independent aceeași schimbare.
3. **Un singur accountable:** fiecare serviciu și activitate are un singur rol
   `Accountable`.
4. **Mandat explicit:** nicio mutație materială nu se deduce dintr-o recomandare,
   analiză sau validare.
5. **Minimul necesar:** accesul și intervenția sunt limitate la domeniul, durata
   și ținta aprobate.
6. **Dovadă înainte de verdict:** PASS, READY, GO și REMEDIATED necesită dovezi
   verificabile.
7. **STOP implicit la neconformitate:** lipsa autorității, identitatea incertă,
   secretul expus, riscul de corupere sau dual-write produc STOP.
8. **Coerență sistemică:** validările individuale nu închid un proces fără
   verificarea interacțiunilor dintre componente.
9. **Istoric imuabil:** deciziile validate nu se rescriu; se completează,
   succedă sau arhivează.
10. **Continuitate controlată:** fallback-ul nu poate introduce dual-write,
    mixed-origin, acces neautorizat sau pierderea trasabilității.

## Articolul 2 – Taxonomia organizațională

Pentru eliminarea ambiguităților, AGM recunoaște numai următoarele tipuri:

| Tip | Definiție | Exemplu |
|---|---|---|
| Persoană | identitate umană care poate deține autoritate | Adrian |
| Autoritate | rol care emite decizii și mandate | Turn Commander |
| Departament | structură permanentă cu misiune și owner | Engineering |
| Rol permanent | funcție stabilă, independentă de o misiune | Chief Inspector |
| Agent permanent | executor sau validator cu identitate în registru | Atlas/Codex |
| Capabilitate | domeniu funcțional, fără autoritate proprie | i18n, UI/UX |
| Rol temporar | funcție atribuită pentru o fereastră controlată | Command Lead |
| Grup temporar | structură activată pentru un obiectiv limitat | CCC |
| Serviciu | componentă tehnică sau operațională cu lifecycle | AGM API |
| Sistem | instrument utilizat de organizație | Turn Command Center UI |

Un sistem nu este o persoană și nu poate fi singur `Accountable`. Când documentele
menționează „Turn Command Center decide”, decizia aparține Turn Commanderului sau
delegatului uman nominalizat și este înregistrată prin Turn Command Center.

## Articolul 3 – Nivelurile de autoritate

| Nivel | Denumire | Domeniu |
|---|---|---|
| L0 | Strategic Advisory | recomandări strategice fără autoritate executivă |
| L1 | Turn Command Authority | decizie finală, mandat, GO/HOLD/NO-GO |
| L2 | Department Accountability | ownership permanent de domeniu/serviciu |
| L3 | Technical/Operational Execution | execuție strict în mandat |
| L4 | Independent Assurance | verificare, STOP, PASS/FAIL independent |
| L5 | Monitoring and Evidence | detectare, colectare, raportare, fără mutații |

Niciun nivel inferior nu își extinde singur autoritatea. Un rol poate ocupa niveluri
diferite în procese diferite, dar separarea atribuțiilor trebuie păstrată în cadrul
aceleiași schimbări.

## Articolul 4 – Structura oficială

AGM are șapte departamente permanente și două autorități specializate.

```text
MENTOR – Strategic Advisor (L0)
└── TURN COMMAND AUTHORITY (L1)
    ├── 1. Product & Portfolio
    ├── 2. Engineering
    ├── 3. Independent Assurance
    ├── 4. Operations & Reliability
    ├── 5. Security, Secrets & Compliance
    ├── 6. Knowledge & Documentation
    └── 7. Monitoring

Autorități specializate, fără subordonare tehnică față de executor:
    ├── Secret & Credentials Guardian
    └── Chief Inspector / Independent Validator

Grup temporar:
    └── Crisis Coordination Cell – inactiv până la mandat
```

### 4.1 Relații de raportare

- Mentor raportează recomandări strategice Turn Commanderului.
- Toți Department Owners raportează decizii și riscuri Turn Commanderului.
- Engineering și Operations colaborează, dar nu validează independent propriile
  schimbări.
- Independent Assurance raportează direct Turn Commanderului.
- Monitoring raportează Chief Inspectorului și Turn Commanderului.
- Secret & Credentials Guardian raportează direct Turn Commanderului pentru
  domeniul secretelor.
- Knowledge & Documentation primește dovezi de la toate departamentele, fără a
  modifica verdictul tehnic.

### 4.2 Ownerii departamentelor

| Departament | Accountable Owner inițial | Limită |
|---|---|---|
| Product & Portfolio | Product Owner AGM / Turn Commander interimar | nu validează tehnic rezultatul |
| Engineering | Architecture Guardian | răspunde pentru coerența departamentului; nu înlocuiește ownerii serviciilor și nu autorizează deployment |
| Independent Assurance | Chief Inspector | nu execută schimbarea validată |
| Operations & Reliability | Release & Operations | nu emite mandatul și nu validează independent |
| Security, Secrets & Compliance | Security Governance Owner / Turn Commander interimar | Secret Guardian rămâne autonom în domeniul secretelor |
| Knowledge & Documentation | Documentation Owner | nu modifică sensul deciziilor aprobate |
| Monitoring | Chief Monitoring Inspector / AGM Inspector inițial | read-only; nu remediază |

Ownerul departamentului răspunde pentru funcționarea și frontierele departamentului.
Ownerul unui serviciu din Articolul 24 răspunde pentru serviciul respectiv. Dacă
rolurile diferă, service ownerul conduce activitatea tehnică, iar Department Owner
asigură resursele, politica și escaladarea; nu există doi accountable pentru
același rezultat.

## Articolul 5 – Autoritatea Turn Command

### 5.1 Turn Commander

Titular inițial: **Adrian**.

Responsabilități:

- aprobă obiectivele, prioritățile și misiunile;
- emite mandatele de analiză, implementare, Production și rollback;
- numește titularii rolurilor temporare;
- decide GO, HOLD, NO-GO și închiderea oficială;
- acceptă riscul rezidual documentat;
- aprobă contractul și amendamentele organizaționale;
- soluționează conflictele de autoritate.

Limitări:

- nu execută comenzi tehnice în aceeași operațiune pe care o autorizează;
- nu emite verdict independent pentru propria execuție;
- nu poate elimina retroactiv dovezi sau decizii validate;
- nu poate autoriza divulgarea secretelor.

### 5.2 Delegatul Turn Commander

Delegarea:

- este scrisă;
- are obiect, interval, limite și condiții de încetare;
- nu poate include simultan rolul de Independent Validator;
- se înregistrează înaintea primei decizii;
- încetează automat la expirarea intervalului sau la revocare.

În lipsa Turn Commanderului și a unui delegat valid, operațiunile materiale intră
în HOLD. Monitorizarea și conservarea sigură pot continua.

## Articolul 6 – Product & Portfolio

### Misiune

Transformă direcția strategică în backlog, rezultate măsurabile și criterii de
acceptare.

### Roluri

#### Mentor – Strategic Advisor

- recomandă direcții de produs și sustenabilitate;
- protejează separarea Basic/Premium;
- evaluează impactul pe termen lung;
- nu aprobă și nu execută schimbări.

#### Product Owner AGM

Titular interimar: **Turn Commander**, până la nominalizarea separată.

- deține backlog-ul și ordinea de prioritate;
- definește rezultatul și criteriile de acceptare;
- clasifică funcțiile Basic/Premium/Future;
- consultă Engineering, Assurance și Operations;
- nu prescrie unilateral soluția tehnică;
- nu declară singur validarea tehnică.

### Research & Technology Intelligence

Capabilitate permanentă în Product & Portfolio, nu departament separat.

- urmărește piața, concurența și tehnologiile relevante pentru AGM;
- consemnează sursa, data, relevanța, riscul și orizontul recomandărilor;
- transmite oportunitățile către Product Owner și Mentor;
- consultă Architecture Guardian pentru fezabilitate și impact tehnic;
- nu transformă cercetarea în backlog, mandat sau implementare fără decizia
  Product Ownerului și autorizarea Turn Commanderului.

## Articolul 7 – Engineering

### Misiune

Proiectează și implementează controlat codul și configurațiile aprobate.

### Roluri permanente

#### Architecture Guardian

Accountable pentru coerența arhitecturală.

- menține harta canonică a componentelor și interfețelor;
- verifică impactul asupra arhitecturii validate;
- emite aviz de consistență;
- nu autorizează deployment;
- nu substituie Independent Validator.

#### Atlas/Codex – Technical Lead and Executor

- analizează cerințele aprobate;
- propune soluția tehnică;
- implementează exclusiv mandatul;
- verifică țintele înainte de mutații;
- rulează testele tehnice;
- furnizează dovezi și raport;
- execută rollback numai sub mandat.

Limitări:

- nu autorizează propria execuție;
- nu emite verdictul independent final;
- nu extinde mandatul;
- nu schimbă secrete fără fluxul Secret Guardian;
- nu acceptă risc de date sau securitate.

#### Frontend & Website Owner

Titular inițial: **Frontend Experience**.

- deține AGM Browser, Android UI și website-ul de prezentare;
- răspunde de responsive, accesibilitate și distribuția frontend;
- păstrează separarea website/aplicație;
- coordonează validarea pe dispozitive reale;
- nu modifică API, DNS sau distribuția Production fără mandat.

#### Backend & Data Custodian

Titular inițial: **Backend & Infrastructure**.

- deține implementarea API și integrarea PostgreSQL;
- menține contractele API și migrațiile;
- protejează compatibilitatea și idempotenta;
- execută operațiuni de date numai sub plan aprobat;
- nu este Data Accountable pentru conținutul de business.

#### AI & Localization Owner

Titular inițial: **I18n / Localization** pentru limbaj; Backend & Infrastructure
pentru integrarea tehnică a providerului.

- menține dicționarele, localele și acoperirea lingvistică;
- coordonează agenții lingvistici și Linguistic Librarian;
- validează terminologia cu utilizatorul;
- nu accesează cheile providerului;
- nu declară disponibilitatea tehnică a providerului.

## Articolul 8 – Independent Assurance

### Misiune

Validează independent cerințele, dovezile, regresiile și coerența sistemului.

### Chief Inspector

Titular inițial: **AGM Inspector**.

- este independent de Engineering și Operations;
- definește planul de verificare;
- validează artefacte, teste, health, date și trasabilitate;
- emite PASS/FAIL pentru domeniul auditat;
- poate impune STOP/HOLD;
- verifică final coerența dintre validări;
- coordonează QA & Validation și Monitoring Assurance.

Limitări:

- nu execută schimbarea validată;
- nu aprobă propriile dovezi;
- nu administrează secrete;
- nu transformă recomandarea în mandat.

### QA & Validation

- pregătește testele automate și reale;
- verifică Browser, Android, API și regresiile;
- păstrează diferența dintre HTTP availability și validarea vizuală/funcțională;
- raportează Inspectorului.

### Infrastructure Reuse Coordinator

Agent permanent read-only sub coordonarea Chief Inspectorului.

- interoghează TURN înaintea proiectării unei funcții noi sau extinderi materiale;
- verifică departamentele, agenții, serviciile, contractele și registrele canonice;
- identifică fundația reutilizabilă, suprapunerile și responsabilitățile absente;
- emite `Infrastructure Reuse Report` către Product Owner, Architecture Guardian
  și Turn Commander;
- nu implementează, nu aprobă și nu modifică arhitectura sau registrele;
- nu substituie avizul Architecture Guardian ori verdictul Inspectorului.

### Legal & Compliance

Titular inițial: **Agent Legal** în stare `monitoring`.

- verifică obligațiile, disclaimer-ele și utilizarea responsabilă;
- emite observații și cerințe;
- nu substituie consultanța juridică externă unde este necesară;
- nu aprobă tehnic implementarea.

## Articolul 9 – Operations & Reliability

### Misiune

Administrează lifecycle-ul serviciilor, release-urile, fallback-ul, backup-ul și
continuitatea.

### Release & Operations

- este Accountable operațional pentru release, deployment și fallback;
- menține runbook-urile și checklist-urile;
- confirmă artefactul, mediul și rollback readiness;
- coordonează change window după mandat;
- păstrează sistemele validate și dovezile;
- nu emite mandatul și nu validează independent propria execuție.

### Service Custodian

Fiecare serviciu are un custode tehnic nominalizat în catalog. Custodele:

- menține configurația și runbook-ul;
- raportează health, incidente și schimbări;
- nu deține automat autoritate de Production;
- nu poate ignora STOP-ul Inspectorului.

### Fallback Custodian

Titular inițial: **Release & Operations / PC Fallback Custodian**.

- păstrează fallback-ul sănătos și separat;
- confirmă single-writer;
- conservă exporturile și dovezile;
- redeschide scrierile numai după mandat;
- nu schimbă rutarea și nu autorizează rollback.

## Articolul 10 – Security, Secrets & Compliance

### Security Governance Owner

Titular interimar: **Turn Commander**, cu validare independentă de către Chief
Inspector, până la nominalizarea unui titular separat.

- este Accountable pentru politica de securitate și riscul rezidual;
- aprobă standardele de acces, retenție și incident response;
- nu administrează direct secretele.

### Secret & Credentials Guardian

Rol permanent, autoritate exclusivă pentru ciclul secretelor.

Activare obligatorie:

1. solicitare explicită a agentului tehnic responsabil;
2. autorizare explicită Turn Command Center.

Responsabilități:

- generează, instalează, rotește, arhivează și revocă secrete;
- validează owner, mod, manifest, checksum și audit trail;
- confirmă existența secretelor fără afișarea valorilor;
- predă raport redactat;
- înregistrează incidentele de secret.

Limitări:

- nu divulgă secrete;
- nu efectuează deployment;
- nu modifică artefacte sau cod;
- nu intervine din proprie inițiativă;
- nu acceptă autorizare implicită.

### Data Accountable

Titular interimar: **Turn Commander**. Custode tehnic:
**Backend & Data Custodian**.

Data Accountable aprobă:

- sursa oficială;
- single-writer;
- write-freeze;
- reconcilierea;
- retenția și ștergerea;
- acceptarea rezultatului migrației.

Custodele execută numai planul aprobat. Independent Assurance validează.

## Articolul 11 – Knowledge & Documentation

### Documentation Owner

- menține contractele, runbook-urile, rapoartele și indexul documentelor;
- marchează statusul și succesiunea;
- verifică linkurile și referințele;
- nu schimbă sensul unei decizii aprobate.

### AGM Chronicler

- păstrează cronologia, incidentele și lecțiile;
- corelează decizii, implementări și rezultate;
- nu șterge sau rescrie istoricul validat.

### Version Guardian

- protejează baseline-urile și artefactele aprobate;
- înregistrează commit, tree, tag, digest și revision;
- semnalează divergențele;
- nu aprobă funcțional schimbarea.

### Linguistic Librarian

- menține terminologia și șabloanele reutilizabile;
- coordonează validarea umană a conținutului lingvistic;
- nu publică fără aprobare.

## Articolul 12 – Monitoring

### Misiune

Detectează, măsoară, corelează și escaladează. Monitoring este read-only prin
definiție.

### Coordonare

Titularul inițial al funcției Chief Monitoring Inspector este **AGM Inspector**.
Funcția poate fi delegată unei identități distincte numai printr-o decizie scrisă
care precizează domeniul, intervalul și limitele. Delegatul Chief Monitoring
Inspector nu dobândește automat rolul Independent Validator și nu poate valida
independent activitatea de monitorizare pe care a executat-o.

### Agenți permanenți

| Cod | Domeniu | Accountable pentru remediere |
|---|---|---|
| MON-001 | Server Principal | Release & Operations |
| MON-002 | Server Backup | Release & Operations |
| MON-003 | API | Backend & Infrastructure |
| MON-004 | Browser | Frontend Experience |
| MON-005 | Android | Frontend Experience |
| MON-006 | AI/provider | Backend & Infrastructure |
| MON-007 | PostgreSQL | Backend & Data Custodian |
| MON-008 | Cloudflare/rute | Release & Operations |
| MON-009 | UI LIVE | QA & Validation |
| MON-010 | Incidente | Turn Operations / Chronicler |
| MON-011 | Telemetrie | Release & Operations; rămâne planned |
| MON-012 | Securitate | Security Governance Owner |

MON poate:

- efectua verificări read-only aprobate;
- deschide incident;
- colecta dovezi fără secrete;
- recomanda STOP;
- solicita revalidare.

MON nu poate:

- reporni servicii;
- roti credențiale;
- modifica rute;
- remedia cod/configurație;
- închide independent incidentul.

## Articolul 13 – Agenți permanenți

Un agent permanent trebuie să aibă:

- ID unic;
- denumire;
- tip;
- departament;
- owner/coordonator;
- responsabilitate principală;
- autoritate;
- interdicții;
- stare;
- sursă de stare;
- substitut/delegare;
- ultima validare;
- istoric.

Stări permise:

- `active`;
- `monitoring`;
- `planned`;
- `inactive`;
- `suspended`;
- `retired`.

`planned` nu poate executa sau valida activități. `monitoring` poate observa și
raporta, dar nu dobândește autoritate de mutație.

## Articolul 14 – Roluri și grupuri temporare

### 14.1 Roluri de change window

- Command Lead;
- Independent Validator;
- Technical Executor;
- Fallback Responsible;
- Rollback Responsible;
- Evidence Recorder.

Fiecare change window consemnează:

- identificator și interval UTC;
- identitatea titularului;
- mandatul;
- canalul STOP;
- confirmarea rolurilor;
- restricțiile;
- încetarea rolului.

### 14.2 Crisis Coordination Cell

CCC este inactivă în mod normal. Activarea cere:

- incident ID și severitate;
- Incident Lead;
- Independent Validator;
- domeniu afectat;
- funcții esențiale;
- acțiuni permise/interzise;
- STOP conditions;
- momentul dezactivării.

CCC coordonează, dar nu înlocuiește Turn, Secret Guardian sau Inspector.

## Articolul 15 – Crearea, modificarea și retragerea rolurilor

### 15.1 Creare

Necesită:

1. problemă sau capabilitate justificată;
2. analiză de suprapunere;
3. tip organizațional;
4. RACI;
5. autoritate și limite;
6. owner și substitut;
7. impact asupra contractului;
8. aprobarea Turn Commander;
9. actualizarea contractului și registrului;
10. validare de consistență.

### 15.2 Modificare

Nicio responsabilitate sau autoritate nu se modifică numai într-un runbook.
Amendamentul contractului este obligatoriu înainte de intrarea în vigoare.

### 15.3 Suspendare/retragere

- incidentele de securitate pot produce suspendare imediată;
- retragerea păstrează istoricul și transferă serviciile;
- serviciul nu rămâne fără owner;
- se validează accesurile revocate și dovezile predate;
- ID-ul retras nu se reutilizează.

## Articolul 16 – Nivelurile de aprobare

| Clasă | Exemple | Aprobare minimă |
|---|---|---|
| A0 – read-only | inventar, analiză, health fără secrete | Department Owner |
| A1 – local reversibil | teste locale, document draft | Department Owner + dovadă |
| A2 – cod/config non-Production | implementare, build, test | Turn mandate + Inspector validation |
| A3 – Production reversibil | restart, deploy, rutare controlată | Turn mandate + change roles + rollback |
| A4 – date/secrete/securitate | migrare, restore, secret rotation | Turn + owner specializat + Inspector |
| A5 – ireversibil/strategic | ștergere, migrare ireversibilă, arhitectură majoră | Turn + impact + consistență + aprobare explicită separată |

Nivelul cel mai ridicat aplicabil guvernează întreaga operațiune.

## Articolul 17 – Lanțul decizional

```text
Cerință/incident
→ Owner de domeniu: clasificare și impact
→ Infrastructure Reuse Coordinator: raport de reutilizare pentru funcție nouă sau extindere materială
→ Architecture/Security/Data consultate după caz
→ Inspector: criterii de validare
→ Turn Commander: mandat sau respingere
→ Executor: implementare strictă
→ Inspector: verdict independent
→ Turn Commander: acceptare/închidere
→ Documentation/Chronicler: arhivare
```

Recomandarea nu este mandat. PASS tehnic nu este autorizare de deployment.
GO/READY nu este deployment. Un rol temporar încetează la închiderea ferestrei.

## Articolul 18 – Procedura de incident și escaladare

### 18.1 Severități

| Nivel | Definiție | Escaladare |
|---|---|---|
| S0 Informational | fără impact operațional | owner și jurnal |
| S1 Minor | impact limitat, fallback neafectat | owner + Monitoring |
| S2 Major | funcție importantă afectată | Turn + Inspector |
| S3 Critical | Production, date, securitate, single-writer | STOP + Turn + Inspector + owner specializat |
| S4 Crisis | impact transversal sau limită necunoscută | CCC prin declarație explicită |

### 18.2 Flux

1. detectare;
2. ID incident și timestamp;
3. conservare dovezi;
4. clasificare;
5. limitarea domeniului;
6. escaladare;
7. mandat de remediere;
8. revalidarea frontierei modificate;
9. verificarea coerenței;
10. închidere și lecții.

## Articolul 19 – STOP / HOLD / NO-GO

### STOP obligatoriu

- ținta nu este identificată fără ambiguitate;
- mandatul lipsește sau nu acoperă acțiunea;
- artefactul/checksum-ul diferă;
- o bază reală poate fi confundată cu una de test;
- apare dual-write sau mixed-origin;
- secretul este expus ori sursa lui nu este aprobată;
- migrarea sau restore-ul eșuează/parțial;
- validatorul nu este independent;
- rollback-ul nu este disponibil;
- dovezile sunt contradictorii;
- apare risc de corupere, pierdere sau acces neautorizat.

### HOLD

Se folosește când situația este sigură, dar lipsește o condiție operațională
remediabilă: operator, UAC, fereastră, acces read-only sau dovadă.

### NO-GO

Este verdictul Turn Commanderului pe baza constatării Inspectorului. Închide
tentativa curentă, conservă starea și cere mandat țintit pentru remediere.

Niciun rol nu poate „continua pe propria răspundere” peste un STOP obligatoriu.

## Articolul 20 – Validarea și închiderea etapelor

O etapă se închide numai dacă:

- obiectivul și scope-ul sunt satisfăcute;
- fiecare criteriu obligatoriu are dovadă;
- rezultatele negative sunt explicate;
- artefactele și configurațiile sunt identificate;
- Inspectorul emite verdict;
- verificarea de consistență este PASS;
- Turn Commander emite decizia;
- documentația și istoricul sunt actualizate.

Verdicte permise:

- `PASS / CLOSED`;
- `PASS / REMEDIATED`;
- `PARTIAL PASS / NOT READY`;
- `FAIL / NOT READY`;
- `NO-GO / SAFE STOP`;
- `GO / READY`.

Un PASS parțial nu este READY. Un sub-gate PASS nu închide gate-ul părinte.

## Articolul 21 – Documentare și trasabilitate

Fiecare document controlat conține:

- titlu și ID;
- versiune;
- status;
- owner;
- autoritate;
- dată/UTC;
- scope;
- surse;
- decizie;
- documente precedente/succesoare;
- checksum unde integritatea este relevantă;
- clasificare redactată pentru secrete.

Stări documentare:

- `draft`;
- `proposed`;
- `approved`;
- `active`;
- `superseded`;
- `archived`;
- `revoked`.

Documentația factuală se separă de recomandări. Secretele nu apar în rapoarte,
loguri, capturi sau conversații. Documentele superseded rămân accesibile ca istoric,
dar indică documentul activ.

## Articolul 22 – Colaborarea între departamente

1. Ownerul serviciului deschide colaborarea și definește rezultatul.
2. Fiecare departament oferă dovada din domeniul propriu.
3. Niciun departament nu modifică artefactele altuia fără owner și mandat.
4. Handoff-ul include stare, riscuri, dovezi, acțiuni și STOP conditions.
5. Neînțelegerile tehnice se escaladează Architecture Guardianului.
6. Neînțelegerile de validare se escaladează Chief Inspectorului.
7. Conflictele de autoritate se decid de Turn Commander.
8. Conflictele de secrete sunt oprite până la decizia Secret Guardian + Turn.
9. Conflictele de date sunt oprite până la decizia Data Accountable + Inspector.

## Articolul 23 – Regimul conflictelor

Ordinea de soluționare:

1. se oprește acțiunea conflictuală;
2. se identifică serviciul și accountable owner;
3. se compară contractul, mandatul și runbook-ul;
4. Architecture Guardian evaluează conflictul tehnic;
5. Inspector evaluează riscul și dovezile;
6. Turn Commander decide;
7. Documentation Owner consemnează;
8. contractul se amendează dacă problema este structurală.

Prevalență:

```text
Contract organizațional activ
→ mandat explicit curent
→ registru canonic
→ runbook aprobat
→ documente istorice
```

Un mandat poate autoriza temporar o acțiune, dar nu poate schimba permanent
structura fără amendarea contractului.

## Articolul 24 – Catalogul oficial al serviciilor

| ID | Serviciu | Accountable Owner | Custode/Executor | Validator | Documentare |
|---|---|---|---|---|---|
| SVC-001 | AGM Website prezentare | Frontend & Website Owner | Frontend Experience | QA/Inspector | Documentation |
| SVC-002 | AGM Cockpit Browser | Frontend & Website Owner | Frontend Experience | QA/Inspector | Documentation |
| SVC-003 | AGM Cockpit Android/APK | Frontend & Website Owner | Frontend Experience | QA/Inspector + utilizator | Version Guardian |
| SVC-004 | AGM Production API | Backend & Data Custodian | Backend/Atlas sub mandat | Inspector | Documentation |
| SVC-005 | PostgreSQL Production | Data Accountable | Backend & Data Custodian | Inspector | Chronicler |
| SVC-006 | Migrații Prisma | Data Accountable | Backend & Data Custodian / Atlas sub mandat | Inspector | Version Guardian |
| SVC-007 | AI/Translation Provider | Backend & Infrastructure | Backend | Inspector/MON-006 | Documentation |
| SVC-008 | Localizare RO/DE/EN | AI & Localization Owner | I18n + Linguistic agents | QA + utilizator | Linguistic Librarian |
| SVC-009 | Cloudflare/DNS/Tunnel | Release & Operations | Release Ops/Atlas sub mandat | Inspector/MON-008 | Documentation |
| SVC-010 | Docker/systemd Production | Release & Operations | Release Ops/Atlas sub mandat | Inspector | Version Guardian |
| SVC-011 | Backup/Restore | Release & Operations | Fallback Custodian | Inspector | Chronicler |
| SVC-012 | Fallback PC | Release & Operations | PC Fallback Custodian | Inspector | Chronicler |
| SVC-013 | Secrete și credențiale | Secret & Credentials Guardian | Secret Guardian | Inspector read-only | raport redactat |
| SVC-014 | Monitoring | Chief Inspector | MON-001…012 | Turn review | Monitoring report |
| SVC-015 | Incident Journal | Turn Operations | AGM Chronicler | Inspector | Chronicler |
| SVC-016 | Turn Command Center UI | Turn Operations | Frontend Experience | Inspector | Documentation |
| SVC-017 | Architecture Registry | Architecture Guardian | Architecture Guardian | Inspector consistency | Documentation |
| SVC-018 | Version/Artefact Registry | Version Guardian | Version Guardian | Inspector | Version Guardian |
| SVC-019 | Legal/Compliance | Security Governance Owner | Agent Legal | Inspector/Turn | Documentation |
| SVC-020 | Telemetrie (`planned/inactive`) | Release & Operations | neatribuit până la activare | Inspector | Documentation |
| SVC-021 | Infrastructure Reuse Control | Chief Inspector | Infrastructure Reuse Coordinator | Architecture Guardian pentru consistență / Turn review | Documentation |

### Regula catalogului

Orice serviciu nou trebuie adăugat în catalog înainte de Production. Un serviciu
fără owner, custode, validator sau runbook este `NOT READY`. SVC-020 nu poate fi
activat până la nominalizarea custodelui, aprobarea runbook-ului, a politicii de
retenție și a validatorului. Lipsa custodelui nu constituie incident cât timp
serviciul rămâne `planned/inactive`.

## Articolul 25 – Matricea executivă a responsabilității

Fiecare rând are un singur `Accountable`. `Autorizează` indică permisiunea de
execuție și nu creează un al doilea accountable.

| Activitate | Accountable | Autorizează | Execută | Validează | Documentează |
|---|---|---|---|---|---|
| Prioritate produs | Product Owner | Turn Commander pentru inițierea misiunii | departamentul desemnat | Inspector pe criteriile aprobate | Documentation |
| Arhitectură | Architecture Guardian | Turn Commander pentru schimbare | Architecture/Atlas | Inspector | Architecture Guardian |
| Cod | service ownerul afectat | Turn Commander prin mandat | Atlas/Codex/Engineering | QA + Inspector | Documentation/Version |
| Deployment | Release & Operations | Turn Commander | Release Ops/Atlas | Inspector independent | Chronicler/Version |
| Rollback | Release & Operations | Turn Commander | Rollback Responsible | Inspector | Chronicler |
| Date/migrare | Data Accountable | Turn Commander | Backend & Data Custodian/Atlas | Inspector | Chronicler |
| Secrete | Secret & Credentials Guardian | Turn Commander + activarea duală | Secret Guardian | Inspector read-only | Guardian, redactat |
| Rutare | Release & Operations | Turn Commander | Release Operations | Inspector | Documentation |
| Incident | service ownerul afectat | Turn Commander pentru remediere materială | owner/executor desemnat | Inspector | Chronicler |
| Monitorizare | Chief Monitoring Inspector | mandat permanent read-only | MON-001…MON-012 | Chief Inspector/Turn review | Monitoring |
| Website/Browser/Android | Frontend & Website Owner | Turn Commander pentru publicare | Frontend Experience | QA/Inspector/utilizator | Documentation |
| Închidere etapă | Turn Commander | — | — | Inspector obligatoriu | Documentation |

## Articolul 26 – Drepturile și obligațiile agenților

### Drepturi

- acces la informația necesară rolului;
- mandat clar și limitat;
- dreptul de a solicita clarificare;
- dreptul și obligația de STOP;
- protecție împotriva presiunii de a ignora controalele;
- acces la istoricul relevant redactat;
- recunoașterea limitelor tehnice și operaționale.

### Obligații

- respectarea mandatului;
- verificarea țintelor;
- protejarea secretelor și datelor;
- păstrarea dovezilor;
- raportarea incertitudinii;
- separarea faptelor de recomandări;
- predarea completă la handoff;
- încetarea autorității temporare la final;
- neexecutarea acțiunilor incompatibile cu rolul.

## Articolul 27 – Continuitatea rolurilor critice

Roluri critice:

- Turn Commander;
- Chief Inspector;
- Atlas/Codex Technical Executor;
- Secret & Credentials Guardian;
- Release & Operations;
- Data Accountable.

Pentru fiecare se menține:

- titular;
- substitut aprobat;
- condiții de activare;
- acces minim;
- handoff;
- limită temporală;
- revocare.

Până la nominalizarea substituților, indisponibilitatea titularului produce HOLD
pentru acțiunile care necesită rolul. Această prevedere este explicită și elimină
delegarea implicită.

## Articolul 28 – Adoptare, amendare și prevalență

### Adoptare

Contractul intră în vigoare numai prin decizie explicită:

`APROBAT / ACTIVE – AGM ORGANIZATIONAL CONTRACT v1`.

Până atunci are statut `proposed` și nu modifică structura existentă.

### Amendare

Orice amendament necesită:

- motiv;
- impact;
- analiză de suprapunere;
- versiune nouă;
- verificare de consistență;
- aprobarea Turn Commander;
- data intrării în vigoare;
- actualizarea registrelor dependente.

### Alinierea documentelor existente

După aprobare:

1. se inventariază documentele afectate;
2. se marchează `aligned`, `superseded` sau `historical`;
3. se actualizează registrele și Turn UI prin mandat separat;
4. se verifică toate mapările;
5. se emite raport de aliniere;
6. contractul nu este considerat complet implementat până la PASS-ul alinierii.

## Anexa A – Dicționar scurt

- **Accountable:** unicul rol care răspunde pentru rezultat.
- **Responsible:** rolul care execută activitatea.
- **Validator:** rol independent care emite verdict pe dovezi.
- **Custode:** rol care menține tehnic un serviciu, fără autoritate implicită.
- **Owner:** rol accountable pentru domeniu sau serviciu.
- **Mandat:** autorizare explicită, limitată și trasabilă.
- **STOP:** oprire imediată a acțiunii.
- **HOLD:** suspendare sigură până la îndeplinirea unei condiții.
- **NO-GO:** închiderea controlată a tentativei.
- **PASS:** criteriile domeniului validat sunt satisfăcute.
- **READY:** toate condițiile pentru etapa următoare sunt satisfăcute.
- **GO:** autorizare de pregătire/continuare conform mandatului; nu înlocuiește
  mandatul de execuție.

## Anexa B – Declarația de conformitate

La aprobarea contractului, fiecare departament și agent confirmă:

1. că își cunoaște ownerul și raportarea;
2. că își cunoaște autoritatea și interdicțiile;
3. că nu execută în afara mandatului;
4. că respectă STOP/NO-GO;
5. că predă dovezile și documentația;
6. că raportează conflictele;
7. că nu combină autorizarea, execuția și validarea independentă.

## Anexa C – Maparea departamentelor existente

Această anexă definește tranziția organizațională. Maparea nu modifică fișierele
tehnice până la mandatul separat de aliniere.

| ID existent | Destinație canonică | Regula de tranziție |
|---|---|---|
| `monitoring` | Monitoring | mapare directă |
| `maintenance-quality-evolution` | Engineering / Independent Assurance / Knowledge & Documentation | membrii se mapează individual; departamentul vechi devine `superseded` |
| `turn-command` | Turn Command Authority | devine autoritate, nu departament executiv |
| `product-roadmap` | Product & Portfolio | mapare directă |
| `architecture-platform` | Engineering | capabilitate Architecture |
| `frontend-experience` | Engineering | capabilitate Frontend & Website |
| `backend-infrastructure` | Engineering | capabilitate Backend & Data |
| `ai-agents` | Engineering | capabilitate AI & Localization |
| `qa-validation` | Independent Assurance | mapare directă |
| `security-legal` | Security, Secrets & Compliance | mapare directă, cu separarea Secret Guardian |
| `release-operations` | Operations & Reliability | mapare directă |
| `documentation-knowledge` | Knowledge & Documentation | mapare directă |

## Anexa D – Maparea agenților și capabilităților existente

### D.1 Registrul celor 29 de înregistrări

| ID existent | ID/rol canonic | Tip canonic | Departament | Stare la tranziție |
|---|---|---|---|---|
| `monitor-server-primary` | `monitor-server-primary` / MON-001 | agent permanent read-only | Monitoring | monitoring |
| `monitor-server-backup` | `monitor-server-backup` / MON-002 | agent permanent read-only | Monitoring | monitoring |
| `monitor-api` | `monitor-api` / MON-003 | agent permanent read-only | Monitoring | monitoring |
| `monitor-browser` | `monitor-browser` / MON-004 | agent permanent read-only | Monitoring | monitoring |
| `monitor-android` | `monitor-android` / MON-005 | agent permanent read-only | Monitoring | monitoring |
| `monitor-ai` | `monitor-ai` / MON-006 | agent permanent read-only | Monitoring | monitoring |
| `monitor-database` | `monitor-database` / MON-007 | agent permanent read-only | Monitoring | monitoring |
| `monitor-cloudflare` | `monitor-cloudflare` / MON-008 | agent permanent read-only | Monitoring | monitoring |
| `monitor-ui-live` | `monitor-ui-live` / MON-009 | agent permanent read-only | Monitoring | monitoring |
| `monitor-incidents` | `monitor-incidents` / MON-010 | agent permanent read-only | Monitoring | monitoring |
| `monitor-telemetry` | `monitor-telemetry` / MON-011 | agent planificat | Monitoring | planned/inactive |
| `monitor-security` | `monitor-security` / MON-012 | agent permanent read-only | Monitoring | monitoring |
| `version-guardian` | Version Guardian | rol permanent | Knowledge & Documentation | active |
| `architecture-guardian` | Architecture Guardian | rol permanent / Department Owner | Engineering | active |
| `release-operations` | Release & Operations | rol permanent / Department Owner | Operations & Reliability | active |
| `frontend-experience` | Frontend & Website Owner | rol permanent / service owner | Engineering | active |
| `backend-infrastructure` | Backend & Data Custodian | rol permanent / service custodian | Engineering | active |
| `i18n-localization` | AI & Localization Owner | rol permanent / capabilitate | Engineering | monitoring |
| `documentation` | Documentation Owner | rol permanent / Department Owner | Knowledge & Documentation | active |
| `agent-codex` | Atlas/Codex Technical Lead and Executor | agent permanent | Engineering | active |
| `agent-inspector` | Chief Inspector / Independent Validator | autoritate independentă | Independent Assurance | active |
| `infrastructure-reuse-coordinator` | Infrastructure Reuse Coordinator | agent permanent read-only | Independent Assurance | active |
| `agent-mentor` | Mentor / Strategic Advisor | rol permanent | Product & Portfolio | active |
| `agent-legal` | Legal & Compliance | rol permanent | Security, Secrets & Compliance | monitoring |
| `agent-linguistic-ro-de` | Agent lingvistic RO–DE | agent permanent planificat | Engineering | planned |
| `agent-linguistic-ro-en` | Agent lingvistic RO–EN | agent permanent planificat | Engineering | planned |
| `agent-linguistic-de-en` | Agent lingvistic DE–EN | agent permanent planificat | Engineering | planned |
| `agent-linguistic-librarian` | Linguistic Librarian | rol permanent | Knowledge & Documentation | active |
| `director-turn-operations` | Turn Operations | rol permanent | Turn Command / Knowledge & Documentation | active |
| `agent-agm-chronicler` | AGM Chronicler | rol permanent | Knowledge & Documentation | active |

`Turn Operations` administrează lifecycle-ul și instrumentul Turn, dar nu devine
Turn Commander și nu dobândește autoritatea L1.

### D.2 Cei 10 agenți generici din modelul Turn

| ID generic | Mapare canonică | Statutul ID-ului generic |
|---|---|---|
| `architecture` | Architecture Guardian / capabilitatea Architecture | superseded după aliniere |
| `qa-testing` | QA & Validation | capabilitate, nu agent autonom |
| `ui-ux` | Frontend & Website Owner / capabilitatea UI/UX | capabilitate |
| `i18n` | AI & Localization Owner | superseded după aliniere |
| `security` | Security Governance | capabilitate; nu înlocuiește Secret Guardian |
| `legal` | Legal & Compliance | superseded după aliniere |
| `integration` | Engineering / Integration capability | capabilitate sub service ownerul afectat |
| `documentation` | Documentation Owner | superseded după aliniere |
| `ai-governance` | AI Governance capability | planned; accountable Architecture Guardian, Security consultat |
| `release` | Release & Operations | superseded după aliniere |

### D.3 Roluri care trebuie adăugate registrului canonic

| Rol | Tip | Stare |
|---|---|---|
| Turn Commander / Adrian | persoană + autoritate L1 | active |
| Product Owner AGM | rol permanent; deținut interimar de Turn Commander | active/interim |
| Security Governance Owner | rol permanent; deținut interimar de Turn Commander | active/interim |
| Data Accountable | rol permanent; deținut interimar de Turn Commander | active/interim |
| Secret & Credentials Guardian | autoritate specializată permanentă | active/on-request |
| Chief Monitoring Inspector | rol permanent; deținut inițial de AGM Inspector | active |
| PC Fallback Custodian | rol operațional permanent | active |

Rolurile temporare Command Lead, Rollback Responsible, Incident Lead și celelalte
roluri CCC nu se adaugă drept agenți activi permanenți. Ele se înregistrează în
change-window/incident records.

## Anexa E – Impactul și tranziția documentelor

### E.1 Rămân active ca proceduri specializate

| Document/clasă | Statut după activare | Condiție |
|---|---|---|
| `deploy/production/OPERATIONAL_ROLES.md` | active/aligned | rolurile se interpretează prin contract |
| runbook-urile deployment/rollback/backup | active/aligned | nu pot extinde autoritatea |
| documentele Gate 1–6 | historical evidence + procedură unde este actuală | verdictul istoric se păstrează |
| Secret & Credentials Guardian acts | active/aligned | autoritatea exclusivă se păstrează |
| `AGM_CRISIS_COORDINATION_CELL_ARCHITECTURE.md` | active/conditional | CCC rămâne inactivă până la declarație |
| `AI_GOVERNANCE.md` | active/aligned | fluxul recomandare–mandat rămâne valabil |

### E.2 Devin superseded organizațional după PASS-ul alinierii

| Document/registru | Statut țintă |
|---|---|
| `TURN_ARCHITECTURE_V1_BASELINE.md` – secțiunile organizaționale | superseded; păstrat istoric |
| `TURN_ORGANIZATION_CHART_REPORT.md` | superseded; păstrat istoric |
| `TURN_MONITORING_DEPARTMENT_REPORT.md` – autoritate/intervenții | aligned; dovezile istorice rămân |
| `TURN_COMMAND_CENTER_V1_INVENTORY.md` – inventarul organizațional | historical |
| matricile Gate/Step cu stări depășite | historical/superseded conform succesorului |

### E.3 Necesită modificare prin mandatul de aliniere

| Artefact | Modificare necesară |
|---|---|
| `apps/web/src/turn-command-center.ts` | șapte departamente canonice și tipuri separate |
| `apps/web/src/agent-governance.registry.ts` | maparea nominală din Anexa D |
| `apps/web/src/monitoring-department.ts` | intervenții reformulate detectare–escaladare |
| `apps/web/src/maintenance-department.ts` | membrii mapați pe departamentele canonice |
| Turn Command Center UI | vedere a registrului canonic, fără liste paralele |
| Architecture/Version registries | referință la contract și statut documentar |
| indexul documentelor | status, owner, predecessor și successor |

### E.4 Gate-ul de aliniere

Contractul poate fi activat înaintea modificărilor tehnice, dar implementarea
organizațională este completă numai după:

1. mandat separat;
2. backup/checkpoint al registrelor;
3. aplicarea mapărilor;
4. build și teste;
5. verificare de consistență;
6. validare independentă;
7. raport PASS;
8. marcarea documentelor superseded.

---

**Stare după revizia finală:** FINAL CANDIDATE / NU ESTE ÎNCĂ ACTIV  
**Deployment sau modificări Production:** NEAUTORIZATE DE ACEST DOCUMENT  
**Următorul pas necesar:** revizuire și aprobare oficială Turn Command Center
