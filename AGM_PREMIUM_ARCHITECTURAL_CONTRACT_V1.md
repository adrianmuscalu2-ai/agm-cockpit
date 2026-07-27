# AGM Cockpit — Contract Arhitectural Premium v1

**Etapă:** Premium — Etapa 1  
**Versiune contract:** 1.0.0  
**Data:** 2026-07-27  
**Stare:** APPROVED WITH CONDITIONS  
**Implementare Premium nouă:** NEAUTORIZATĂ până la aprobarea explicită a acestui contract  
**Publicare / distribuție:** NEAUTORIZATĂ  

## 1. Scop și caracter obligatoriu

Prezentul document este contractul arhitectural unic pentru modulele AGM Cockpit
Premium. După aprobare, orice modul, flux, API, model de date, persistență locală,
sincronizare sau interfață Premium trebuie să respecte acest contract.

Un modul care nu participă la fluxul comun al cursei, dublează date canonice sau
introduce tranziții proprii în afara mașinii de stări este neconform și nu poate
trece poarta de implementare.

Contractul:

- extinde baseline-ul Premium Foundation fără să îl invalideze;
- nu schimbă funcțiile, contractele sau datele AGM Basic;
- nu autorizează implementarea, migrarea, publicarea ori distribuirea;
- poate fi modificat numai printr-o versiune nouă, auditată și aprobată.

## 2. Principiul central

Premium este un singur flux operațional al șoferului, nu o colecție de pagini:

`Înainte de plecare → Confirmarea pregătirii → Cursa activă → Evenimente și verificări pe traseu → Sosire → După cursă → Închiderea cursei → Arhivare`

Toate modulele operează asupra aceleiași entități canonice `Trip` și asupra
aceluiași jurnal imuabil de audit. UI-ul afișează starea; numai nucleul de domeniu
o poate modifica.

## 3. Limite arhitecturale

Arhitectura Premium este împărțită obligatoriu în:

1. **Nucleu de domeniu** — entități, reguli, stări, tranziții și validări; fără DOM,
   Capacitor sau acces direct la rețea.
2. **Servicii de aplicație** — coordonează cazurile de utilizare și autorizarea.
3. **Porturi și adaptoare** — API, stocare locală, OCR, fișiere, localizare,
   conectivitate și sincronizare.
4. **Prezentare** — ecrane și comenzi; nu duplică reguli de domeniu.
5. **Jurnal și observabilitate** — evenimente de audit, erori, sincronizare și
   recuperare.

Dependențele merg spre nucleul de domeniu. Nucleul nu importă prezentarea,
stocarea, rețeaua sau codul nativ.

## 4. Contextul canonic al cursei

Fiecare operație Premium primește explicit:

```text
TripContext
  tripId
  tripVersion
  lifecycleState
  operationalFlags[]
  actor
  deviceId
  permissions[]
  locale
  connectivity
  syncState
  lastKnownServerVersion
```

Nu este permisă o „cursă implicită” dedusă doar din ecranul curent. Dacă nu există
o cursă activă selectată, modulele care produc date operaționale rămân read-only
sau solicită crearea/selectarea controlată a unei curse.

## 5. Stările canonice ale ciclului de viață

### 5.1 Stări principale

```text
DRAFT
  → PRE_DEPARTURE_IN_PROGRESS
  → READY_WITH_WARNINGS | READY_CONFIRMED
  → TRIP_ACTIVE
  → ARRIVAL_RECORDED
  → POST_TRIP_IN_PROGRESS
  → COMPLETED
  → ARCHIVED
```

### 5.2 Stări operaționale ortogonale

`BLOCKED`, `INCIDENT_OPEN`, `SYNC_PENDING`, `OFFLINE` și `RECOVERY_REQUIRED` sunt
flaguri operaționale, nu înlocuitori ai stării principale. Pot coexista cu o stare
principală, dacă regulile de mai jos permit.

Exemplu: o cursă poate fi `TRIP_ACTIVE + OFFLINE + SYNC_PENDING`, dar nu poate fi
simultan `TRIP_ACTIVE` și `COMPLETED`.

### 5.3 Reguli de tranziție

| Din | Către | Condiții minime | Blochează tranziția |
|---|---|---|---|
| DRAFT | PRE_DEPARTURE_IN_PROGRESS | șofer, vehicul și cursă identificate | identitate invalidă sau date corupte |
| PRE_DEPARTURE_IN_PROGRESS | READY_CONFIRMED | toate verificările obligatorii trecute și confirmate | verificare critică eșuată, document obligatoriu lipsă |
| PRE_DEPARTURE_IN_PROGRESS | READY_WITH_WARNINGS | fără blocaje critice; avertismente acceptate explicit | avertisment neacceptat sau incident critic |
| READY_* | TRIP_ACTIVE | confirmare șofer, oră de start și condiții de plecare satisfăcute | `BLOCKED` sau `RECOVERY_REQUIRED` |
| TRIP_ACTIVE | ARRIVAL_RECORDED | sosire, timp și locație înregistrate | identitate cursă inconsistentă |
| ARRIVAL_RECORDED | POST_TRIP_IN_PROGRESS | deschiderea controlată a verificărilor post-cursă | date de sosire incomplete |
| POST_TRIP_IN_PROGRESS | COMPLETED | sarcini obligatorii închise; incidente transferate sau rezolvate; raport generat | problemă critică fără dispoziție |
| COMPLETED | ARCHIVED | sincronizare confirmată, integritate validată și politică de retenție aplicată | `SYNC_PENDING` sau `RECOVERY_REQUIRED` |

Orice tranziție:

- este comandată printr-un caz de utilizare nominal;
- verifică versiunea cursei pentru control concurent;
- produce un eveniment de audit;
- este idempotentă sau are o cheie de idempotentă;
- nu poate fi executată direct de UI sau prin modificarea stocării locale.

## 6. Semantica flagurilor operaționale

| Flag | Se activează când | Efect minim | Se închide când |
|---|---|---|---|
| BLOCKED | o regulă critică împiedică progresul | blochează tranzițiile nominale indicate de regulă | cauza este rezolvată și reevaluată |
| INCIDENT_OPEN | există un incident neînchis | incidentul rămâne vizibil în toate etapele relevante | incident rezolvat sau transferat explicit |
| SYNC_PENDING | există mutații locale neconfirmate de server | interzice arhivarea și afișează starea | serverul confirmă toate mutațiile |
| OFFLINE | proba reală de conectivitate eșuează | folosește capabilitățile locale permise | conectivitatea este reverificată |
| RECOVERY_REQUIRED | integritatea sau reconcilierea automată nu poate fi garantată | blochează operațiile distructive și închiderea | recuperare validată și auditabilă |

## 7. Contractul comun de date

Toate înregistrările folosesc identificatori UUID, timp UTC ISO 8601, versiune de
schemă, versiune de entitate și metadate de audit.

| Agregat / entitate | Câmpuri canonice minime |
|---|---|
| Trip | `tripId`, `externalReference?`, `state`, `flags[]`, `driverId`, `vehicleId`, `trailerId?`, `cargoId?`, `plannedStart`, `actualStart?`, `arrivalAt?`, `completedAt?`, `version` |
| Driver | `driverId`, identitate operațională, calificări relevante, preferințe permise |
| Vehicle / Trailer | identificator, număr de înmatriculare, tip, stare, referințe documente |
| Cargo | identificator, descriere, masă, unități, caracteristici de risc, cerințe de fixare |
| Document | `documentId`, tip, emitent, valabilitate, hash fișier, sursă, stare verificare |
| Check | `checkId`, tip, etapă, rezultat, severitate, reguli aplicate, actor, timp |
| Confirmation | `confirmationId`, obiect confirmat, actor, rol, timp, metodă, versiune obiect |
| Warning | `warningId`, cod, severitate, sursă, stare, acceptare/dispoziție |
| Incident | `incidentId`, categorie, severitate, descriere, stare, responsabil, legături și dispoziție |
| Media / OCR | `mediaId`, hash, tip MIME, captură, consimțământ, `ocrResultId?`, text, limbă, încredere, corecții |
| Time / Location | tip eveniment, timp dispozitiv, timp server, coordonate/precizie dacă sunt autorizate, sursă |
| SyncRecord | `operationId`, entitate, operație, versiune bază, stare, încercări, eroare sigură |
| AuditEvent | `eventId`, tip, agregat, actor, dispozitiv, înainte/după sau diferență, timp, corelație |

### 7.1 Proprietate și reutilizare

- Fiecare informație are o singură sursă canonică.
- Modulele consumă referințe sau proiecții, nu copii independente.
- Datele derivate includ sursa și versiunea din care au fost calculate.
- Corectarea unei date canonice produce o versiune nouă și reevaluarea
  dependentelor.
- Ștergerea logică este preferată pentru datele auditabile; ștergerea fizică
  respectă retenția și autorizarea.

### 7.2 Clasificare și acces

Fiecare câmp este clasificat: `PUBLIC_OPERATIONAL`, `INTERNAL`, `PERSONAL`,
`SENSITIVE` sau `LEGAL_RECORD`. Accesul este acordat pe rol, scop și cursă.
Exporturile, OCR-ul, fotografiile și localizarea aplică minimizarea datelor și
consimțământul/politica juridică relevantă.

## 8. Contractul dintre module

| Modul | Primește | Produce | Intrare | Ieșire / transfer |
|---|---|---|---|---|
| 1. Înainte de plecare | Trip, șofer, vehicul, plan | sesiune pre-plecare, sarcini, avertismente | DRAFT sau PRE_DEPARTURE_IN_PROGRESS | toate sarcinile evaluate; problemele merg la verificări/incidente |
| 2. Vehicul și documente | vehicul, remorcă, documente, reguli | verificări, expirări, blocaje | cursă identificată | rezultat critic rezolvat sau `BLOCKED`; avertismente transferate |
| 3. Ladungssicherung | încărcătură, vehicul, echipamente, dovezi | evaluare fixare, confirmări, fotografii | date minime complete | rezultat acceptat; neconformități devin warning/incident |
| 4. Tahograf, timpi și legislație | șofer, timp, traseu, reguli aplicabile | limite, alerte, confirmări | context juridic și temporal disponibil | obligațiile active sunt transferate către cursa activă |
| 5. Traducere și comunicare | context autorizat, limbă, text/document | traduceri, mesaje, proveniență | consimțământ și serviciu disponibil sau fallback permis | rezultatul este legat de sursă; fără suprascrierea originalului |
| 6. OCR și documente | media, tip document, limbă | text OCR, încredere, corecții, document indexat | captură autorizată și stocare disponibilă | rezultat verificat sau marcat pentru revizuire |
| 7. Asistență pe traseu | TRIP_ACTIVE, locație/timp autorizate, warnings/incidente | evenimente, recomandări, escaladări | cursă activă | toate elementele deschise merg la sosire/post-cursă |
| 8. După cursă | sosire, sarcini deschise, documente și incidente | verificări finale, dispoziții, completări | ARRIVAL_RECORDED | obligațiile închise sau transferate explicit |
| 9. Raport final și arhivare | proiecția completă și jurnalul | raport versionat, hash, stare finală | POST_TRIP_IN_PROGRESS fără blocaje critice | COMPLETED; apoi ARCHIVED numai după sync |
| 10. Istoric, incidente și trasabilitate | toate evenimentele autorizate | proiecții, căutare, audit și export | permanent, conform rolului | nu modifică retroactiv evenimentele; corecțiile sunt evenimente noi |

Niciun modul nu poate marca singur cursa `READY_CONFIRMED`, `COMPLETED` sau
`ARCHIVED`. Aceste decizii aparțin orchestratorului fluxului.

## 9. Transferul problemelor între etape

Orice warning, incident sau sarcină deschisă are:

- proprietar;
- severitate;
- termen sau condiție de reevaluare;
- etapă sursă și etapă destinație;
- dispoziție: `RESOLVED`, `ACCEPTED_RISK`, `TRANSFERRED`, `BLOCKING`;
- referință la dovadă și confirmare, dacă este necesar.

La tranziție, orchestratorul generează o listă de predare. Elementele nu dispar
prin schimbarea ecranului sau etapei. Un element critic fără dispoziție activează
`BLOCKED`.

## 10. Persistență locală, offline și sincronizare

### 10.1 Local-first controlat

- Datele necesare continuării sigure sunt salvate local, tranzacțional și
  versionat.
- Datele sensibile sunt criptate folosind capabilitățile platformei.
- Fiecare mutație locală primește `operationId`, timp, versiune bază și stare.
- UI-ul diferențiază clar „salvat local” de „sincronizat cu serverul”.
- O operație care necesită confirmare online nu este prezentată ca finalizată
  offline.

### 10.2 Outbox și idempotentă

Mutațiile offline intră într-un outbox ordonat. Retrimiterea folosește aceeași
cheie de idempotentă. Confirmarea serverului elimină `SYNC_PENDING` numai după ce
toate operațiile anterioare relevante au fost confirmate.

### 10.3 Conflicte

- Actualizările folosesc control optimist prin `tripVersion`.
- Câmpurile critice nu folosesc automat „last write wins”.
- Conflictele sigure pot fi reunite determinist.
- Conflictele de identitate, stare, confirmare, incident sau document activează
  `RECOVERY_REQUIRED` și cer rezoluție auditabilă.

### 10.4 Recuperare

Pornirea, revenirea din background, reconectarea și actualizarea aplicației
verifică schema, jurnalul, outbox-ul și ultima versiune confirmată. Recuperarea nu
șterge date și nu execută automat tranziții ireversibile.

## 11. Contract API și evenimente

- API-ul Premium este versionat explicit.
- Cererile de mutație includ `tripId`, `expectedVersion`, `operationId` și context
  de autorizare.
- Răspunsurile includ versiunea rezultată, starea sincronizării și erori
  structurate, fără secrete.
- Evenimentele folosesc nume și versiuni stabile, de exemplu
  `trip.pre_departure.started.v1`.
- Consumatorii trebuie să fie idempotenti.
- Schimbările incompatibile necesită versiune nouă și plan de migrare.

## 12. Separarea Basic / Premium

- Basic și Premium au rute, registre, servicii și namespace-uri de stocare
  distincte.
- Premium poate consuma funcții Basic numai prin adaptoare publice documentate.
- Premium nu importă starea internă a ecranelor Basic și nu modifică modelele
  persistate Basic.
- Nicio migrare Premium nu rulează asupra datelor Basic.
- Buildul poate dezactiva Premium fără să afecteze Basic.
- Modificarea unui fișier comun necesită analiză de impact și regresie Basic.
- Baseline-ul public, endpointurile, permisiunile Android și distribuția nu se
  schimbă fără aprobare explicită separată.

## 13. Securitate, juridic și audit

- Autorizarea se verifică în serviciul de aplicație și pe server, nu doar în UI.
- Confirmările importante includ actorul, rolul, timpul, obiectul și versiunea.
- Jurnalul de audit este append-only; corecțiile nu rescriu istoricul.
- Secretele, tokenurile și cheile nu intră în jurnal, OCR, rapoarte sau erori.
- Fotografiile, OCR-ul și localizarea au scop, retenție și control de acces
  explicite.
- Deciziile juridice și de siguranță afișează sursa și versiunea regulii.

## 14. Observabilitate și stări operaționale

Starea serviciilor se bazează pe probe reale, fără răspunsuri health din cache:

- verde — probă funcțională confirmată;
- galben — verificare în curs sau răspuns lent;
- roșu — indisponibilitate, timeout sau răspuns invalid.

Logurile folosesc identificatori de corelație și nu conțin date sensibile.
Metricile minime acoperă erori, latență, outbox, conflicte, recuperări și tranziții
respinse.

## 15. Guvernanța implementării

Pentru fiecare increment sunt obligatorii:

1. scop și fișiere autorizate;
2. cerințe și criterii de acceptare;
3. matricea tranzițiilor afectate;
4. impact Basic/Premium/API/Android/date;
5. teste unitare, contract, integrare, offline și regresie;
6. dovezi Browser și Android când există UI;
7. audit al diff-ului și decizie explicită;
8. checkpoint dedicat înaintea incrementului următor.

Un singur increment arhitectural poate fi activ. Nu sunt permise implementări
paralele care schimbă același agregat sau aceeași tranziție fără un contract de
integrare aprobat.

## 16. Porți obligatorii

| Poartă | Cerință |
|---|---|
| G0 — Contract | prezentul document aprobat explicit |
| G1 — Model | schema canonică, clasificarea datelor și migrarea aprobate |
| G2 — Stări | matrice completă de comenzi, tranziții și erori aprobată |
| G3 — Sync | protocol offline/outbox/conflict/recovery demonstrat |
| G4 — Modul | contract intrare/ieșire și integrare cu fluxul demonstrat |
| G5 — Regresie | Basic și baseline-urile Premium existente PASS |
| G6 — Securitate | autorizare, minimizare, audit și retenție PASS |
| G7 — Lansare | staging, rollback, migrare și aprobare de publicare |

Eșecul unei porți oprește incrementul. Aprobarea contractului nu echivalează cu
aprobarea porților ulterioare.

## 17. Criterii de acceptare pentru Etapa 1

- fluxul unic și limitele arhitecturale sunt acceptate;
- stările principale și flagurile ortogonale sunt acceptate;
- proprietatea datelor și interdicția duplicării sunt acceptate;
- contractele celor zece module sunt complete;
- transferul problemelor este definit;
- offline, sync, conflict și recovery sunt definite;
- separarea Basic/Premium și protecția producției sunt explicite;
- guvernanța, porțile și autoritățile de schimbare sunt acceptate;
- nu a fost realizată nicio implementare sau publicare în această etapă.

## 18. Decizie și semnături

Contractul intră în vigoare numai după consemnarea următoarelor aprobări:

| Rol | Decizie | Nume / referință | Dată |
|---|---|---|---|
| Product Owner | PENDING — condiție înainte de Etapa 2 |  |  |
| Arhitectură / Engineering | APPROVED_WITH_CONDITIONS | `PREMIUM-ARCH-V1-2026-07-27` | 2026-07-27 |
| QA & Validation | APPROVED_WITH_CONDITIONS | Raport validare Etapa 1 | 2026-07-27 |
| Security / Legal, unde este aplicabil | PENDING |  |  |

Decizii posibile: `APPROVED`, `APPROVED_WITH_CONDITIONS`, `REJECTED`.

Contractul are statutul **APPROVED WITH CONDITIONS**. Implementarea Etapei 2
rămâne blocată până la acceptarea Product Owner și închiderea condițiilor
aplicabile din raportul final de validare.

## 19. Referințe baseline

- `AGM_PREMIUM_FOUNDATION_STAGE1_REPORT.md`
- `AGM_PREMIUM_ROUTES_REGISTRY_REPORT.md`
- `AGM_PREMIUM_SHELL_REPORT.md`
- `AGM_PREMIUM_I18N_REPORT.md`
- `AGM_PREMIUM_TEAM_STAGE2_REPORT.md`
- `WORK_CHATGPT_PROJECT/09_MODUL_LEGISLATIE_CONFORMITATE/ETAPA_6/ETAPA_6_ARHITECTURA_SI_PLAN_INCREMENTAL.md`
