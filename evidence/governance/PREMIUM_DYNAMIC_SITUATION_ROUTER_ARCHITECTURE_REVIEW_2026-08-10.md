# AGM Premium — Dynamic Situation Router Architecture Review

Data: 2026-08-10  
Statut: **PROPOSAL / PRODUCT OWNER APPROVAL REQUIRED**  
Regim: analiză arhitecturală; fără implementarea routerului sau a situațiilor

## 1. Autoritate și limite

Inventarul folosește `ROADMAP.md` ca sursă canonică de scop și ordine, iar
contractul Premium, viziunea Hub și registrele PRM drept surse normative pentru
structură. Nu introduce funcții din Future Backlog și nu transformă serviciile
comune în situații separate. Cele două intrări vizibile rămân exclusiv:

1. **Înainte de Plecare**;
2. **După Plecare** (workspace-ul Journey Operations, inclusiv Active Trip și
   Post-Trip ca faze interne).

HUB-00–HUB-07 și PRM-01–PRM-10 sunt identificatori interni, niciodată etichete UI.

## 2. Inventarul situațiilor din roadmap

### Înainte de Plecare

1. Identitate cursă, șofer, vehicul și remorcă incomplete;
2. stare tehnică și siguranță vehicul/remorcă;
3. documente obligatorii lipsă, ilizibile, neconfirmate sau aproape expirate;
4. încărcătură, poziționare, fixare, chingi, ancoraje și Ladungssicherung;
5. tahograf, timp disponibil, pauze și obligații aplicabile;
6. ADR și reguli speciale aplicabile cursei;
7. rută, restricții și compatibilitatea planului;
8. condiții de noapte sau vreme dificilă;
9. aptitudinea și starea șoferului;
10. warnings/open items rezultate din verificări și gate-ul READY.

### După Plecare

1. interacțiune nesigură în timpul conducerii;
2. pericol imediat sau persoane rănite;
3. control rutier / solicitare a autorității;
4. incident sau accident;
5. avarie / defecțiune tehnică;
6. oboseală;
7. problemă la marfă, fixare, încărcătură sau sigiliu;
8. rută blocată, restricție sau abatere;
9. vreme sau condiții de drum;
10. barieră de limbă și comunicare contextuală;
11. document primit/solicitat care necesită Camera, OCR, review sau analiză;
12. comunicare operațională prin Email/WhatsApp, cu confirmare și receipt;
13. sosire, documente finale și open items;
14. raport final, sincronizare, arhivare sau urmărire.

Camera, OCR, traducerea, Email și WhatsApp sunt capabilități invocate de o
situție; nu devin categorii concurente sau pagini principale.

## 3. Matrice situație → hub → modul → flux → acțiune

| Situație | Hub vizibil | Module interne | Intrare / întrebări și ramuri | Verificări și dovezi | Acțiuni permise / închidere / escaladare / reluare |
|---|---|---|---|---|---|
| Context cursă incomplet | Înainte | PRM-01, PRM-02 | Cursă selectată? șofer/vehicul/remorcă identificate? lipsă critică vs necritică | TripContext, identificatori, sursa datelor | completează sau marchează necunoscut; critic → BLOCKED; închidere când datele obligatorii sunt confirmate; resume din ultimul câmp valid |
| Vehicul/remorcă | Înainte | PRM-02, PRM-07 | defect observat? afectează siguranța? poate fi verificat în siguranță? | checklist, foto, notă, confirmare umană | confirmă/remediază/deschide incident; defect critic → Safety; închidere după reverificare; resume cu issue deschis |
| Documente obligatorii | Înainte | PRM-02, PRM-06 | document prezent? lizibil? valabil? date concordante? | original, hash, OCR propus, corecții și review | capturează/importă/review; lipsă critică → BLOCKED; expirare apropiată → warning acceptabil; resume de la review |
| Încărcătură și fixare | Înainte | PRM-03, PRM-06 | tip/masă? perspective suficiente? chingi/ancoraje? abatere critică? | fotografii, OCR etichetă, valori declarate, raport orientativ | refă foto, corectează, remediază, confirmă; risc critic → BLOCKED; închidere prin reverificare umană; resume cu media și proveniență |
| Tahograf/timpi | Înainte | PRM-04 | timp disponibil? pauză necesară? plan compatibil? | valori sursă, regulă/versionare, calcul | ajustează planul; incompatibilitate legală → BLOCKED/escaladare operator; închidere când planul este compatibil; resume din calcul versionat |
| ADR/reguli speciale | Înainte | PRM-02, PRM-04, PRM-07 | ADR aplicabil? documente/echipament/semnalizare prezente? | documente, checklist, regulă și jurisdicție | completează/remediază; lipsă critică → BLOCKED/compliance; resume cu regula și dovezile |
| Rută/restricții planificate | Înainte | PRM-04, PRM-07 | restricții cunoscute? vehicul/rută compatibile? alternativă confirmată? | plan rută, restricții și sursa lor | schimbă planul sau acceptă warning permis; incompatibil → BLOCKED; resume cu planul curent |
| Noapte/vreme | Înainte | PRM-02, PRM-04, PRM-07 | condiții adverse? vizibilitate/echipare/plan adecvate? | observații, sursă meteo, verificări vehicul | adaptează/amână/escaladează; închidere după condiții acceptabile; resume cu timestamp/freshness |
| Starea șoferului | Înainte | PRM-01, PRM-04 | apt pentru plecare? oboseală/limitare? | declarație minimizată și timp, fără diagnostic AI | pauză/oprire/escaladare operator; neapt → BLOCKED; resume fără expunere medicală inutilă |
| READY gate | Înainte | PRM-01, PRM-07, PRM-10 | verificări complete? probleme deschise? warnings acceptabile? | rezumat, open items, confirmări și event versions | READY_CONFIRMED sau READY_WITH_WARNINGS numai cu confirmare; altfel BLOCKED; resume exact înaintea confirmării |
| Interacțiune nesigură | După | PRM-07 | vehiculul este oprit sigur? | răspuns și timestamp | numai instrucțiune de oprire sigură; fără formulare; închidere când interacțiunea devine sigură; resume la safety gate |
| Pericol/răniți | După | PRM-07, PRM-10 | pericol imediat? răniți? locație aproximativă? | fapte confirmate, eventual foto numai când sigur | prioritate servicii de urgență; fără întârziere pentru formular; urmărire până la transfer; resume în EMERGENCY |
| Control rutier | După | PRM-07, PRM-02, PRM-05, PRM-06 | ce solicită autoritatea? ce document/limbă? | solicitare, document original, OCR/review, comunicare | prezintă doar date confirmate; traducere/draft; escaladare operator; închidere după eliberare sau follow-up |
| Incident/accident | După | PRM-07, PRM-06, PRM-10 | persoane/risc/locație? autorități? dovezi sigure? | eveniment, foto, documente, comunicări, receipts | protecție persoane, urgență, raport; nu închide automat; close numai cu dispoziție sau follow-up |
| Avarie | După | PRM-07, PRM-02 | simptom observat? oprire sigură? continuarea este sigură? | observație, foto, diagnostic extern dacă există | oprire, asistență rutieră, operator; fără diagnostic AI final; close după remediere/transfer |
| Oboseală | După | PRM-07, PRM-04 | se conduce? loc sigur de oprire? | timp și declarație minimă | oprește, pauză, notifică operatorul; fără confirmare sub presiune; resume după oprire |
| Marfă/fixare/sigiliu | După | PRM-03, PRM-06, PRM-07 | ce s-a observat? scurgere? poziție sigură? | foto, sigiliu, document, raport | nu manipula risc necunoscut; oprește/escaladează; close după reverificare sau transfer |
| Rută blocată/restricție | După | PRM-04, PRM-07 | semnalizare/restricție? locație? alternativă autorizată? | foto/locație/sursă rută | nu ignora semnele; cere rută compatibilă; close după confirmarea alternativei |
| Vreme/drum | După | PRM-04, PRM-07 | condiție observată? oprire sigură? warning oficial? | observație și sursă cu freshness | reduce expunerea/oprește/informează; fără viteză universală; follow-up cât timp condiția persistă |
| Barieră de limbă | După | PRM-05 | text sursă? limbă țintă? scop/destinatar? | original, traducere derivată, provider și review | traduce/citește/pregătește mesaj; omul verifică; close după înțelegere sau handoff |
| Document pe traseu | După | PRM-06, PRM-05 | tip document? consimțământ? calitate? necesită acțiune? | original imuabil, OCR, corecții, analiză | capturează/review/traduce/atașează; corupt sau fără consimțământ → blocaj local; resume la pasul incomplet |
| Comunicare operațională | După | PRM-05, PRM-10 | canal? destinatar? scop? atașamente? confirmare? | CommunicationDraft, original, traducere, handoff, receipt | pregătește; trimiterea cere confirmare; retry numai fără receipt; close la delivered/failed/follow-up |
| Sosire/post-cursă | După | PRM-08 | sosire confirmată? documente finale? open items? | arrival event, documente, disposition | completează/transferă open items; lipsă critică → POST_TRIP_IN_PROGRESS; resume din open item |
| Raport/arhivare | După | PRM-09, PRM-10 | proiecție completă? sync/conflict? autorizare? | timeline, manifest, hash, sync receipt | generează/exportă/arhivează; SYNC_PENDING/RECOVERY_REQUIRED blochează; ARCHIVED este terminal/read-only |

## 4. Categorii propuse pentru selector

Categoriile sunt derivate numai după inventar și sunt etichete de navigare, nu
module noi:

- **Înainte:** Cursă și persoane; Vehicul și remorcă; Documente; Încărcătură;
  Timp, reguli și rută; Condiții de drum; Pregătire finală.
- **După:** Siguranță imediată; Control și autorități; Incident sau avarie;
  Șofer și condiții; Marfă; Rută; Documente; Comunicare; Sosire și închidere.

Routerul poate recomanda situații din TripContext, dar utilizatorul confirmă
situația activă. Safety gates preced întotdeauna selectorul După Plecare.

## 5. Registry unic

```ts
type SituationDefinition = {
  id: SituationId;
  hub: 'BEFORE_DEPARTURE' | 'AFTER_DEPARTURE';
  categoryId: CategoryId;
  moduleIds: readonly InternalModuleId[];
  entryPolicy: EntryPolicy;
  steps: readonly StepDefinition[];
  evidencePolicy: EvidencePolicy;
  allowedActions: readonly ActionDefinition[];
  closePolicy: ClosePolicy;
  escalationPolicy: EscalationPolicy;
  resumePolicy: ResumePolicy;
  i18nKeyPrefix: string;
  version: number;
};
```

Registry-ul conține definiții, nu stare. `OperationalCase` conține starea unei
instanțe și referă `situationId + definitionVersion`. Toate cele 9 limbi rezolvă
aceleași chei; niciun locale nu poate modifica pașii sau tranzițiile.

## 6. Mașina de stări

Mașina cursei rămâne canonică:

`DRAFT → PRE_DEPARTURE_IN_PROGRESS → READY_WITH_WARNINGS | READY_CONFIRMED → TRIP_ACTIVE → ARRIVAL_RECORDED → POST_TRIP_IN_PROGRESS → COMPLETED → ARCHIVED`

Fiecare `OperationalCase` folosește sub-mașina comună:

`CREATED → SAFETY_GATE → QUALIFYING → ACTIVE_STEP → REVIEW_REQUIRED → ACTION_READY → AWAITING_CONFIRMATION → RESOLVED | FOLLOW_UP_REQUIRED | ESCALATED`

Stări de control ortogonale: `SYNC_PENDING`, `RECOVERY_REQUIRED`, `BLOCKED`.
Tranzițiile poartă `operationId`, `expectedVersion`, actor, timestamp și
definitionVersion. `RESOLVED` nu implică închiderea automată a incidentului;
`ARCHIVED` rămâne singura stare terminală a cursei.

Invariante:

- maximum un case foreground; alte cazuri pot exista numai ca open items;
- numai pasul activ este randat;
- efectele externe folosesc PREPARE → CONFIRM → RECEIPT;
- schimbarea limbii re-randează proiecția, fără eveniment de domeniu;
- AI poate recomanda ramura, nu o poate confirma;
- revenirea folosește ultimul event confirmat plus outbox, nu snapshot UI arbitrar.

## 7. Wireframe — Înainte de Plecare

```text
┌ AGM Premium ─ Înainte de Plecare ───── [RO ▾] [⋯ Recuperare] ┐
│ Cursa activă / progres 3 din 7                              │
├──────────────────────────────────────────────────────────────┤
│ SITUAȚIA ACTIVĂ: Documente obligatorii                      │
│ CMR-ul este disponibil și lizibil?                          │
│                                                              │
│ [ Fotografiază ] [ Importă ]                                │
│ Dovadă: CMR_original.jpg · nesincronizat                    │
│                                                              │
│ [ Nu îl am ]                         [ Continuă verificarea ]│
├──────────────────────────────────────────────────────────────┤
│ Problemă deschisă: 1          Verdict provizoriu: BLOCAT     │
└──────────────────────────────────────────────────────────────┘
```

## 8. Wireframe — După Plecare

```text
┌ AGM Premium ─ După Plecare ──────────── [RO ▾] [⋯ Recuperare] ┐
│ Poți interacționa în siguranță?   [Da] [Nu]                  │
├───────────────────────────────────────────────────────────────┤
│ SITUAȚIA ACTIVĂ: Control rutier                               │
│ Ce document sau informație a fost solicitată?                 │
│ [ Document ] [ Mesaj ] [ Altă solicitare ]                    │
│                                                               │
│ Pasul 2/4 · Captură și verificare                              │
│ [ Cameră/OCR ]  Textul OCR trebuie confirmat de utilizator     │
│                                                               │
│ [ Înapoi ]                                  [ Confirmă textul ]│
├───────────────────────────────────────────────────────────────┤
│ Următor: traducere → draft Email/WhatsApp → confirmare         │
└───────────────────────────────────────────────────────────────┘
```

Pe Android: o singură coloană, o acțiune primară sticky, ținte ≥44 px,
rezumat compact, fără grid tehnic și fără formulare inactive în DOM-ul vizibil.

## 9. Recuperare și diagnostic

`Salvare local`, `Restaurare local` și `Descărcare stare` se mută în meniul
secundar **Recuperare și diagnostic**. Salvarea normală devine automată după
fiecare tranziție validă. Meniul nu poate șterge/abandona cursa și afișează
separat `salvat local`, `sync pending`, `confirmat server` și `conflict`.

## 10. Migrarea stării actuale

1. Se păstrează cheile și payloadurile curente read-only pe durata migrării.
2. Un adaptor versionat transformă sesiunea Pre-Departure actuală într-un
   `OperationalCase` și păstrează answers, issues, confirmation și limbă.
3. Evaluarea After-Departure devine un case cu `situationId` derivat din
   scenario, păstrând facts, assessment, priority și transitions.
4. Evenimentul `legacy.case.imported.v1` include hash-ul payloadului sursă;
   importul este idempotent și nu șterge sursa.
5. Dacă maparea nu este sigură, starea intră în `RECOVERY_REQUIRED`, cu acces
   read-only la datele vechi; nu se resetează automat.
6. După o reluare și salvare confirmată în noul format, vechiul payload este
   marcat migrated, nu șters. Ștergerea necesită mandat separat de retenție.
7. Testele de migrare trebuie să acopere toate stările existente, offline,
   outbox, refresh, schimbare limbă și conflict de versiune.

Riscuri controlate: pierderea răspunsurilor, dublarea incidentelor, schimbarea
semanticii READY, reluarea într-un pas greșit, retry dublu al comunicării și
divergența Browser/Android.

## 11. Decizie solicitată

Se solicită aprobarea Product Ownerului pentru:

1. cele două liste de categorii;
2. modelul `SituationDefinition + OperationalCase`;
3. sub-mașina comună și safety gate-ul obligatoriu;
4. migrarea idempotentă, fără ștergerea stării vechi;
5. primul vertical slice propus: **Document obligatoriu înainte de plecare** și
   **Control rutier după plecare**.

Până la aprobare nu se implementează registry-ul, routerul sau situațiile.

## 12. Surse

- `ROADMAP.md`, secțiunile 2.1–2.12;
- `AGM_PREMIUM_ARCHITECTURAL_CONTRACT_V1.md`;
- `AGM_PREMIUM_HUB_ARCHITECTURE_VISION_2026-07-28.md`;
- `AGM_PREMIUM_HUB_ARCHITECTURE_WORKSHOP_REPORT_2026-07-28.md`;
- `WORK_CHATGPT_PROJECT/10_PREMIUM_ARCHITECTURE/ETAPA_1/02_REGISTRU_MODULE_SI_RESPONSABILITATI.md`;
- `WORK_CHATGPT_PROJECT/10_PREMIUM_ARCHITECTURE/ETAPA_1/03_MASINA_STARI_CURSA.md`;
- `WORK_CHATGPT_PROJECT/10_PREMIUM_ARCHITECTURE/ETAPA_1/05_CONTRACTE_MODULE.md`;
- implementarea existentă `pre-departure` și `poc02-after-departure`, verificată
  numai pentru analiza migrării.

## 13. Verdict

- CURRENT STATIC PAGE SCALABILITY — FAIL
- ROADMAP SITUATION INVENTORY — COMPLETE / REVIEW REQUIRED
- DYNAMIC SITUATION ROUTER ARCHITECTURE — PROPOSED
- STATE MACHINE DESIGN — PROPOSED
- PRODUCT OWNER ARCHITECTURE APPROVAL — REQUIRED
- PRODUCT IMPLEMENTATION — NOT STARTED
