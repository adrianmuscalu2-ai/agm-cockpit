# AGM – Revizie finală de conformitate a Contractului Organizațional v1

Data: 2026-07-28  
Obiect verificat: `AGM_ORGANIZATIONAL_CONTRACT_V1.md`  
Versiune verificată SHA-256:
`E94763F2D1FEB9A2B1C0A4625B6D694EF02D77A46CD5296EF69C9EBEB9252504`  
Tip verificare: documentară, read-only  
Contract modificat în cadrul reviziei: nu

## 1. Scop și metodă

Revizia a comparat contractul cu:

- auditul organizațional din 2026-07-28;
- Turn Architecture V1;
- organigrama Turn;
- modelul celor 12 departamente;
- registrul celor 29 de agenți;
- AI Governance;
- rolurile Gate 6B;
- separarea atribuțiilor pentru deployment și rollback;
- arhitectura Crisis Coordination Cell;
- mandatul permanent Secret & Credentials Guardian;
- regulile STOP, NO-GO, single-writer și trasabilitate.

Clasificarea constatărilor:

- `CONFORM` – poate fi adoptat fără intervenție pe subiect;
- `CORECȚIE MINORĂ` – clarificare necesară înaintea activării, fără schimbarea
  modelului organizațional;
- `NECONFORMITATE MATERIALĂ` – contradicție de autoritate sau structură care ar
  necesita reproiectare.

Nu au fost identificate neconformități materiale.

## 2. Rezultatul verificărilor obligatorii

| Nr. | Criteriu | Rezultat | Concluzie |
|---:|---|---|---|
| 1 | Coerența cu Auditul Organizațional | CONFORM CU CORECȚII MINORE | Contractul implementează registrul canonic, separarea tipurilor, service catalogul și continuitatea; sunt necesare anexele de mapare |
| 2 | Coerența cu documentele arhitecturale | CONFORM | Turn rămâne autoritatea, Atlas și Inspector rămân separați, CCC rămâne condiționată |
| 3 | Coerența cu registrele agenților | CORECȚIE MINORĂ | Schema este compatibilă, dar lipsește maparea nominală a tuturor celor 29 de înregistrări |
| 4 | Coerența cu organigrama oficială | CONFORM CU TRANZIȚIE | nivelurile superioare sunt păstrate; cele 12 departamente trebuie mapate în cele șapte canonice |
| 5 | Coerența cu regulile operaționale | CONFORM | mandat, STOP, HOLD, NO-GO, rollback și validare independentă sunt păstrate |
| 6 | Absența conflictelor de autoritate | CONFORM | autorizarea, execuția și validarea sunt separate |
| 7 | Absența responsabilităților duplicate | CORECȚIE MINORĂ | două formulări trebuie aduse la regula „un singur accountable” |
| 8 | Absența activităților fără responsabil | CONFORM CU CONDIȚIE | toate serviciile active au owner; telemetria rămâne neactivabilă până la nominalizarea custodelui |
| 9 | Aplicabilitatea practică a procedurilor | CONFORM | procedurile au intrări, roluri, STOP conditions și ieșiri verificabile |
| 10 | Impactul asupra documentației existente | CONTROLABIL | impactul este mare ca volum, dar poate fi gestionat prin aliniere etapizată |

## 3. Coerența cu Auditul Organizațional

### Elemente închise corect

Contractul tratează explicit constatările principale ale auditului:

- separă persoana, autoritatea, departamentul, agentul, rolul temporar și sistemul;
- definește un singur accountable per serviciu;
- separă Turn Command Center UI de Turn Commander;
- separă agenții MON read-only de executorii remedierilor;
- delimitează Secret Guardian de Security Governance;
- delimitează Data Accountable de custodele tehnic;
- păstrează CCC inactivă până la mandat;
- introduce niveluri de aprobare A0–A5;
- introduce catalogul celor 20 de servicii;
- definește HOLD în lipsa titularului sau substitutului.

### Observație rămasă

Auditul a solicitat un registru canonic cu maparea entităților existente.
Contractul definește schema și regulile, dar nu conține încă anexa completă:

- 29 înregistrări vechi → rol/capabilitate/agent canonic;
- 10 agenți generici → rol/capabilitate canonică;
- 12 departamente vechi → șapte departamente canonice.

Aceasta este o lipsă de tranziție, nu o contradicție a modelului.

## 4. Coerența arhitecturală și cu organigrama

### Nivelurile superioare

Contractul păstrează:

- Mentor ca advisor fără autoritate executivă;
- Adrian ca Turn Commander;
- Atlas/Codex ca executor tehnic;
- AGM Inspector ca validator independent;
- raportarea directă la Turn a Inspectorului;
- separarea Secret Guardian;
- Architecture Guardian ca autoritate de consistență, nu de deployment.

Prin urmare, principiul Atlas–Inspector de nivel egal față de Turn nu este
invalidat.

### Tranziția departamentelor

Organigrama veche și aplicația enumeră 12 departamente. Contractul definește șapte.
Aceasta este o consolidare intenționată, compatibilă cu auditul, dar trebuie
formalizată înaintea activării:

| Departament existent | Destinație canonică |
|---|---|
| monitoring | Monitoring |
| maintenance-quality-evolution | împărțit pe Engineering, Assurance și Knowledge conform rolului |
| turn-command | Turn Command Authority |
| product-roadmap | Product & Portfolio |
| architecture-platform | Engineering |
| frontend-experience | Engineering |
| backend-infrastructure | Engineering |
| ai-agents | Engineering |
| qa-validation | Independent Assurance |
| security-legal | Security, Secrets & Compliance |
| release-operations | Operations & Reliability |
| documentation-knowledge | Knowledge & Documentation |

Departamentul `maintenance-quality-evolution` nu poate fi mutat ca bloc unic,
deoarece membrii săi au funcții care trebuie separate pentru independență.

## 5. Coerența cu registrele agenților

### Compatibilitate

Contractul oferă o destinație logică pentru fiecare clasă:

- agenții MON → Monitoring;
- Version Guardian și Chronicler → Knowledge & Documentation;
- Architecture Guardian și Atlas/Codex → Engineering;
- Inspector → Independent Assurance;
- Release & Operations → Operations & Reliability;
- Legal și Secret Guardian → Security, Secrets & Compliance;
- agenții lingvistici → Engineering / AI & Localization;
- Mentor → Product & Portfolio;
- Turn Operations → Turn Command/Knowledge după funcție.

### Corecție necesară

Înainte de activare trebuie adăugată o anexă nominală cu:

- ID-ul vechi;
- ID-ul canonic;
- tipul canonic;
- departamentul;
- starea;
- ownerul;
- autoritatea;
- statutul `mapped`, `superseded` sau `retired`.

Fără această anexă, contractul este clar conceptual, dar registrele tehnice nu pot
fi reconciliate determinist.

## 6. Verificarea autorității

### Turn Commander

Turn:

- aprobă și mandatează;
- nu execută aceeași operațiune;
- nu validează independent propria execuție;
- soluționează conflictele;
- nu divulgă secrete.

Conform.

### Atlas/Codex

Atlas:

- analizează și execută;
- nu autorizează;
- nu validează independent;
- nu extinde mandatul;
- nu gestionează secrete fără Guardian.

Conform.

### Inspector

Inspector:

- definește și execută validarea read-only;
- emite PASS/FAIL;
- poate cere STOP;
- nu execută schimbarea.

Conform.

### Secret Guardian

Sunt păstrate:

- autoritatea exclusivă asupra secretelor;
- activarea duală;
- neintervenția din proprie inițiativă;
- raportarea redactată;
- interdicția de deployment.

Conform.

### Release & Operations

Release & Operations este accountable operațional pentru release și fallback, dar:

- mandatul rămâne la Turn;
- validarea rămâne la Inspector;
- execuția poate fi delegată;
- rollback-ul necesită rol temporar.

Conform.

## 7. Corecții minore obligatorii

### MC-01 – Chief Monitoring Inspector

Textul actual:

> Chief Monitoring Inspector este o funcție a Chief Inspectorului sau un delegat
> distinct nominalizat.

Problema: formularea `sau` nu stabilește titularul inițial fără ambiguitate.

Corecția necesară:

- titular inițial: AGM Inspector;
- delegarea către altă identitate este permisă numai în scris;
- delegatul nu dobândește rolul Independent Validator pentru propria activitate
  de monitorizare.

### MC-02 – Accountable pentru migrațiile Prisma

Catalogul atribuie `SVC-006 Migrații Prisma` Backend & Data Custodianului, în timp
ce Articolul 10 atribuie aprobarea transformării datelor Data Accountable.

Corecția necesară:

- `Accountable Owner`: Data Accountable;
- `Custode/Executor`: Backend & Data Custodian / Atlas sub mandat;
- `Validator`: Inspector.

Aceasta aliniază migrațiile cu PostgreSQL și cu Gate 6D.

### MC-03 – Două roluri în coloana „Decide”

Matricea executivă folosește:

> Date/migrare – Data Accountable + Turn

Problema: poate fi interpretată ca doi accountable.

Corecția necesară:

- Data Accountable răspunde de decizia asupra datelor;
- Turn Commander autorizează execuția;
- formularea trebuie separată în `Accountable` și `Autorizează`.

### MC-04 – Ownerii celor șapte departamente

Contractul definește rolurile, dar nu include un tabel unic al Department Owners.

Corecția necesară:

| Departament | Owner inițial |
|---|---|
| Product & Portfolio | Product Owner AGM / Turn Commander interimar |
| Engineering | Architecture Guardian pentru coerență; Atlas/Codex pentru execuție, fără dublu accountable pe servicii |
| Independent Assurance | Chief Inspector |
| Operations & Reliability | Release & Operations |
| Security, Secrets & Compliance | Security Governance Owner / Turn Commander interimar |
| Knowledge & Documentation | Documentation Owner |
| Monitoring | Chief Monitoring Inspector |

Pentru Engineering, contractul trebuie să precizeze că Department Owner nu
înlocuiește ownerii serviciilor din catalog.

### MC-05 – Telemetria planificată

`SVC-020` are owner, dar custodele este neatribuit.

Corecția necesară:

- starea serviciului: `planned/inactive`;
- activarea este interzisă până la nominalizarea custodelui, runbook-ului,
  retenției și validatorului;
- lipsa custodelui nu este incident cât timp serviciul nu este declarat activ.

### MC-06 – Anexele de tranziție

Se adaugă înainte de activare:

1. maparea celor 12 departamente;
2. maparea celor 29 de înregistrări;
3. maparea celor 10 agenți generici;
4. lista documentelor care devin `superseded` sau `historical`.

Aceste anexe nu schimbă autoritatea contractului; fac activarea verificabilă.

## 8. Activități fără responsabil

Pentru serviciile active nu a fost identificată nicio activitate fără owner:

- website, Browser și Android → Frontend Owner;
- API → Backend;
- PostgreSQL și date → Data Accountable + custode;
- AI → Backend/AI Localization;
- Cloudflare, Docker, backup și fallback → Release & Operations;
- secrete → Secret Guardian;
- validare → Inspector;
- documentare → Documentation/Chronicler/Version Guardian;
- incidente → Turn Operations;
- monitorizare → Chief Inspector.

Excepția este telemetria, care este planificată și neactivabilă. Corecția MC-05
face această limită explicită.

## 9. Aplicabilitatea practică

### Proceduri aplicabile direct

- clasificarea A0–A5;
- mandatul explicit;
- separarea autorizare–execuție–validare;
- change-window roles;
- escaladarea S0–S4;
- STOP/HOLD/NO-GO;
- lifecycle-ul incidentului;
- închiderea etapelor;
- controlul secretelor;
- catalogul serviciilor;
- conflict resolution;
- document lifecycle.

### Condiții prealabile aplicării complete

- nominalizarea substituților rolurilor critice;
- completarea change-window record înainte de execuție;
- maparea registrelor;
- definirea documentelor superseded;
- activarea telemetriei numai după completarea controlului aferent.

Aceste condiții nu împiedică adoptarea contractului, dar trebuie să facă parte din
mandatul ulterior de aliniere.

## 10. Impactul asupra documentației existente

### Documente care rămân active ca proceduri specializate

- `deploy/production/OPERATIONAL_ROLES.md`;
- runbook-urile de rollback, backup și deployment;
- procedurile Gate 1–6;
- documentele de Secret Guardian;
- Crisis Coordination Cell, ca mecanism condiționat;
- AI Governance, în măsura în care nu contrazice contractul.

### Documente care devin istorice sau superseded organizațional

- organigrama Turn V1, după migrarea completă;
- rapoartele de creare a departamentelor;
- listele paralele de agenți generici;
- matricile organizaționale vechi.

### Documente și registre care necesită aliniere controlată

- `apps/web/src/turn-command-center.ts`;
- `apps/web/src/agent-governance.registry.ts`;
- `apps/web/src/monitoring-department.ts`;
- `apps/web/src/maintenance-department.ts`;
- Turn Command Center UI;
- registrele Architecture Guardian și Version Guardian;
- AI Governance;
- documentele Gate 6B;
- catalogul serviciilor și document index.

Alinierea este o etapă separată. Activarea contractului nu autorizează automat
modificarea acestor artefacte.

## 11. Condiții pentru decizia de activare

Înaintea deciziei `APROBAT / ACTIVE` trebuie:

1. integrate MC-01–MC-06;
2. recalculat checksum-ul contractului;
3. confirmată absența altor modificări;
4. emisă decizia explicită Turn Command Center;
5. deschis mandatul separat de aliniere;
6. păstrată structura tehnică actuală până la PASS-ul alinierii.

Corecțiile nu schimbă:

- numărul departamentelor canonice;
- poziția Turn Commanderului;
- independența Inspectorului;
- rolul Atlas/Codex;
- autoritatea Secret Guardian;
- catalogul de servicii, cu excepția accountable-ului SVC-006;
- regulile STOP/NO-GO;
- separarea atribuțiilor.

## 12. Verdict final

**APPROVED WITH MINOR CORRECTIONS**

