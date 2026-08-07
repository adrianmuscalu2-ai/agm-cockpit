# Dashboard Warning Analysis — Raport consolidat de review v0.1

**Data:** 2026-08-03  
**Document analizat:** `DASHBOARD_WARNING_ANALYSIS_FUNCTIONAL_CONTRACT_V0_1_DRAFT.md`  
**Mandat:** Owner Decision — Architecture, Domain, Privacy & Security, UX și QA Review  
**Limită:** review documentar; implementarea rămâne `NO-GO`

## 1. Verdict consolidat

| Review | Verdict | Condiție principală |
|---|---|---|
| Architecture | `PASS — OWNER APPROVED` | invarianta normativă Photo First este regulă arhitecturală permanentă |
| Domain | `PASS DESCRIPTIVE / HOLD SAFETY-CRITICAL` | validare suplimentară numai pentru rezultate care influențează siguranța, conformitatea sau decizia critică |
| Privacy & Security | `HOLD — CONTROLS/EVIDENCE REQUIRED` | consimțământ, provider, retenție și threat model |
| UX | `PASS WITH CONDITIONS` | fotografia este singurul entry point principal |
| QA | `PASS PLAN / HOLD SAFETY-CRITICAL ASSETS` | calibrare și ground truth țintite pe ramurile cu risc ridicat |

**Verdict general:** `CONTRACT DRAFT — REVIEW OPEN / IMPLEMENTATION NO-GO`

**Calibrare oficială:** Owner Decision — Knowledge Validation Calibration,
2026-08-03. Validarea este proporțională cu riscul; această regulă guvernează
interpretarea verdicturilor Domain și QA din prezentul raport.

## 2. Architecture Review

### 2.1 Invariantă obligatorie Photo First

Ordinea oficială a fluxului este:

```text
PHOTO_CAPTURED
→ VISION_OBSERVATIONS_READY
→ OCR_OBSERVATIONS_READY | OCR_NOT_APPLICABLE
→ KNOWLEDGE_CORRELATED
→ SEVERITY_CLASSIFIED
→ EXPLANATION_READY
→ SAFE_ACTION_READY
→ KNOWLEDGE_REFERENCE_AVAILABLE
```

Forma utilizatorului:

```text
📷 Fotografie
→ 👁️ Vision
→ 📝 OCR (dacă există text)
→ 🧠 Corelare Knowledge
→ ⚠️ Clasificare severitate
→ 💬 Explicație
→ ✅ Acțiune recomandată
→ 📚 Referință Knowledge
```

Această ordine este invariantă semantică, nu doar formulare UI.

### 2.2 Reguli rezultate

1. Ruta principală a modulului afișează captura, nu biblioteca.
2. Nicio analiză nu pornește fără imagine selectată explicit.
3. Vision produce exclusiv observații vizuale înaintea corelării Knowledge.
4. OCR rulează numai când există text candidat și își păstrează proveniența.
5. Knowledge nu poate produce retrospectiv o „observație” Vision sau OCR.
6. Severitatea se clasifică numai după corelare și verificarea contradicțiilor.
7. Explicația și acțiunea sigură se construiesc din rezultatul validat, nu din
   simpla deschidere a unui articol Knowledge.
8. Referința Knowledge este ultima treaptă vizibilă și secundară.
9. Fallback-ul offline poate oferi biblioteca numai ca „Referință fără analiză”,
   fără să mimeze fluxul foto și fără verdict de severitate.
10. Deep-link-ul către un articol Knowledge nu este ruta principală a modulului.

### 2.3 Separarea etapelor și provenienței

| Etapă | Primește | Produce | Nu poate produce |
|---|---|---|---|
| Photo | acțiunea utilizatorului | imagine validată tehnic | identificare/severitate |
| Vision | imagine | simbol, culoare, elemente vizibile | regulă juridică sau diagnostic |
| OCR | imagine/text candidat | text + confidence | observație vizuală |
| Knowledge Mapping | observații + context | candidați trasabili | observații noi |
| Severity Policy | candidați + contradicții | nivel + basis | diagnostic certificat |
| Explanation | rezultat validat | explicație prudentă | certitudine peste confidence |
| Safe Action | severitate + Knowledge | pași siguri/escaladare | mutație automată |
| Reference | item ID publicat | surse/limite | schimbarea rezultatului |

### 2.4 Alte constatări arhitecturale

- `tripContextRef` primit de la client nu trebuie tratat ca autoritate. Backendul
  trebuie să verifice ownership-ul și versiunea prin serviciul existent.
- Reutilizarea API-008 trebuie făcută la nivel de transport și controale comune,
  nu prin importarea schemelor sau prompturilor Load Safety.
- Mapperul Knowledge și Severity Policy trebuie să fie componente deterministe,
  testabile separat de provider.
- Rezultatul brut al providerului nu ajunge direct în UI.
- Orice cache viitor necesită contract separat; v0.1 rămâne fără retenție server-side.

### 2.5 Verdict Architecture

`PASS — OWNER APPROVED / PERMANENT RULE`.

Contractul include acum invarianta normativă, ordinea completă, separarea
provenienței și interdicția folosirii Knowledge drept punct de pornire al analizei.
Architecture Amendment este închis; acest PASS nu ridică `IMPLEMENTATION NO-GO`.

## 3. Domain Review

### 3.1 Elemente corecte

- culoarea nu stabilește singură severitatea;
- marca/modelul/anul pot modifica sensul martorului;
- manualul exact și mesajul complet au prioritate;
- rezultatele incerte cer recaptură sau context suplimentar;
- biblioteca existentă este suport, nu classifier complet;
- `stop-safely` este recomandare prudentă, nu diagnostic.

### 3.2 Principiul validării proporționale cu riscul

Explicațiile descriptive, trasabile la surse oficiale și care nu formulează o
decizie critică urmează fluxul normal Knowledge Operations și Publication Gate.
Ele nu necesită validare externă individuală.

Validarea suplimentară se aplică exclusiv regulilor care pot influența direct:

1. identificarea unui caz cu impact asupra siguranței;
2. clasificarea `urgent` sau `stop-safely`;
3. recomandarea de oprire ori continuare a deplasării;
4. verificări ale vehiculului care pot deveni periculoase;
5. escaladarea către service, dispecerat, asistență sau urgență;
6. obligații legale ori de conformitate aplicabile situației.

Pentru aceste ramuri se cer sursa exactă, diferențierea relevantă pe
marcă/model/generație și, unde regula nu poate fi confirmată direct din manualul
oficial, validarea unui specialist nominal.

### 3.3 Verdict Domain

`PASS DESCRIPTIVE / HOLD SAFETY-CRITICAL`.

Conținutul descriptiv oficial nu blochează dezvoltarea. HOLD rămâne limitat la
ramurile de identificare, severitate și acțiune cu impact critic, până la validarea
lor proporțională cu riscul.

## 4. Privacy & Security Review

### 4.1 Controale adecvate în draft

- consimțământ explicit per analiză;
- eliminarea metadata nenecesare;
- secret server-side și endpoint autentificat;
- MIME, semnătură și limită de 8 MB;
- fără imagine/OCR în loguri și răspunsuri;
- salvare locală separată și explicită;
- rezultat fail-closed la provider/schema invalidă;
- retenție server-side declarată zero.

### 4.2 Condiții deschise

1. textul exact al consimțământului și identitatea operatorului/procesatorului;
2. dovada tehnică a eliminării EXIF înainte de transfer;
3. confirmarea contractuală a retenției providerului și configurației aplicabile;
4. inventarul regiunilor și subprocessatorilor;
5. threat model pentru imagini malițioase, decompression bombs și polyglot files;
6. verificarea magic bytes și decodarea sigură înainte de provider;
7. rate limiting per utilizator/companie și protecție cost abuse;
8. anulare/timeout și eliminarea bufferelor/referințelor temporare;
9. teste negative pentru loguri, traces, APM și incident payload;
10. politica pentru numere VIN, plăcuțe, locații și persoane surprinse în imagine.

### 4.3 Verdict Privacy & Security

`HOLD — CONTROLS/EVIDENCE REQUIRED`.

Retenția zero este o cerință, nu încă o dovadă. Aprobarea necesită threat model,
data-flow și confirmarea configurației reale a providerului.

Baseline-ul detaliat, threat modelul minim și pachetul de dovezi sunt consemnate în
`DASHBOARD_WARNING_PRIVACY_SECURITY_REVIEW_2026-08-03.md`. Contractul tehnic și
matricea de acceptanță sunt definite în
`DASHBOARD_WARNING_IMAGE_SECURITY_CONTROL_CONTRACT_V0_1.md`. Verdictul rămâne HOLD.

## 5. UX Review

### 5.1 Experiența principală aprobată conceptual

Primul ecran conține:

- „Fotografiază martorul sau mesajul”;
- buton principal „Deschide camera”;
- alternativă „Alege fotografie”;
- instrucțiune scurtă pentru cadru clar;
- context marcă/model opțional;
- consimțământ scurt și inteligibil înainte de transfer.

Nu conține la intrare:

- lista bibliotecii;
- articole juridice;
- căutare manuală ca acțiune principală;
- severitate sau recomandare înaintea analizei.

### 5.2 Ordinea rezultatului

1. „Identificat” sau „Nu pot identifica sigur”;
2. severitate și oprire;
3. „Ce faci acum”;
4. escaladare;
5. variante posibile;
6. confidence și limite;
7. surse și articol Knowledge.

### 5.3 Condiții UX măsurabile

- camera este acțiunea dominantă și vizibilă fără scroll;
- utilizatorul nu parcurge biblioteca înainte de analiză;
- starea incertă este mai vizibilă decât orice candidat;
- acțiunea sigură se poate citi prin scanare rapidă;
- recaptura se execută într-un singur pas;
- controlul „Înapoi” nu pierde imaginea fără avertizare;
- UI funcționează cu o mână și fără scroll orizontal;
- biblioteca este accesibilă secundar și etichetată „Referință”.

### 5.4 Verdict UX

`PASS WITH CONDITIONS`.

Conceptul Photo First este potrivit. PASS final cere prototip și validare practică
Owner/șofer pe Android și Browser.

## 6. QA Review

### 6.1 Structura matricei

Matricea propusă acoperă mărcile, generațiile, display-urile, limbile, calitatea
imaginii, contextul contradictoriu, providerul indisponibil, consimțământul și
platformele. Structura este adecvată.

### 6.2 Dovezi încă inexistente pentru ramurile safety-critical

- corpus țintit, versionat și licențiat pentru cazurile critice;
- ground truth pentru identificările și recomandările care influențează siguranța;
- distribuția cazurilor critice și neidentificabile;
- praguri confidence calibrate pentru clasificările și acțiunile critice;
- teste de regresie pentru Knowledge items care alimentează o decizie critică;
- provider real configurat într-un mediu de test autorizat;
- teste Browser și Android pe imagini reprezentative;
- benchmark de latență și limite pe rețea slabă;
- test de utilizabilitate cu șoferi;
- dovada retenției zero și a absenței payloadului privat din loguri.

### 6.3 Criterii suplimentare necesare

- fiecare test păstrează separat ground truth Vision, OCR și Knowledge;
- false-negative și false-positive sunt raportate pe severitate;
- orice fals `stop-safely=false` într-un caz critic deschide NO-GO;
- orice identificare singulară în cazul incert deschide NO-GO;
- testele verifică ordinea Photo → Vision → OCR → Knowledge, nu doar rezultatul;
- accesarea bibliotecii fără fotografie nu este considerată analiză PASS.

### 6.4 Verdict QA

`PASS PLAN / HOLD SAFETY-CRITICAL ASSETS`.

Planul QA este adecvat. Nu se cere ground truth extern pentru fiecare explicație
descriptivă. HOLD privește numai activele, calibrarea și execuția necesare ramurilor
cu impact asupra siguranței, conformității sau deciziei critice.

## 7. Starea amendamentelor contractuale

1. ~~Introducerea invariabilei normative Photo First din secțiunea 2.~~ `CLOSED`.
2. ~~Declararea Knowledge ca etapă de corelare și referință finală, niciodată entry point.~~ `CLOSED`.
3. ~~Separarea provenienței Vision, OCR, Knowledge și Policy.~~ `CLOSED`.
4. ~~Interzicerea identificării și severității în fallback-ul fără Vision.~~ `CLOSED`.
5. Controalele asupra imaginilor, inclusiv data-flow și threat model. `HOLD — PRIVACY & SECURITY`.
6. Nominalizarea validatorului și constituirea corpusului țintit pentru ramurile safety-critical. `HOLD — DOMAIN SAFETY-CRITICAL`.
7. Aprobarea și execuția matricei QA pe activele safety-critical. `HOLD — QA SAFETY-CRITICAL ASSETS`.

## 8. Condiția pentru ridicarea NO-GO

Conform Owner Decision — Dashboard Warning Architecture Amendment, Architecture
Review este `PASS`, iar implementarea rămâne `NO-GO` până la închiderea cumulativă
a următoarelor trei HOLD-uri:

- Privacy & Security — validarea controalelor asupra imaginilor;
- QA Safety-Critical Assets — validarea activelor utilizate în scenariile critice;
- Domain Safety-Critical — validarea regulilor de siguranță aplicabile.

Numai închiderea explicită a tuturor celor trei HOLD-uri permite ridicarea `NO-GO`
și autorizarea implementării. Condițiile UX rămân criterii de acceptanță ale
implementării, dar nu constituie un al patrulea HOLD de arhitectură.

Până atunci:

`DASHBOARD WARNING ANALYSIS — ARCHITECTURE PASS / 3 HOLDS OPEN / IMPLEMENTATION NO-GO`.
