# Dashboard Warning Analysis — Contract funcțional v0.1

**Statut:** `DRAFT AMENDED / AWAITING OWNER APPROVAL / IMPLEMENTATION NO-GO`  
**Data:** 2026-08-03  
**Autoritate de scope:** Owner Decision — Dashboard Warning Analysis  
**Architecture Amendment:** `PASS / OWNER APPROVED / PERMANENT RULE`  
**Obiectiv:** Fotografie → Vision → OCR → Knowledge → Severitate → Explicație → Acțiune sigură

## 1. Scop și limite

Modulul asistă șoferul în interpretarea rapidă a unui martor, mesaj sau display de
bord fotografiat explicit. Rezultatul este orientativ și trebuie să distingă între
observație vizuală, text OCR, context declarat, candidat Knowledge și inferență.

Modulul nu:

- certifică diagnosticul sau starea tehnică a vehiculului;
- înlocuiește manualul exact, service-ul, dispeceratul sau serviciile de urgență;
- pornește captură, upload, apel, incident sau mutație operațională automat;
- transformă OCR sau date declarative în observații vizuale;
- inventează un martor când confidence-ul este insuficient;
- modifică pachetele Knowledge validate;
- reutilizează semantic schema Premium Load Safety.

Principiul obligatoriu este **ASISTENȚĂ, NU DECIZIE**.

## 2. Infrastructură reutilizată obligatoriu

| Capabilitate | Sursă | Utilizare |
|---|---|---|
| Camera/import | APP-015 + APP-004 | selecție explicită JPEG/PNG/WEBP |
| OCR local | APP-004 | text candidat, separat de observația Vision |
| Arhivă locală | APP-009 / OCR Archive | salvare numai la cererea utilizatorului |
| Vision transport | controalele tehnice API-008 | multipart, 8 MB, timeout, secret server-side, JSON Schema, post-validare |
| Knowledge | `KB-VEHICLE-WARN-001` + registry | grounding și explicație secundară |
| Context Operațional | PRE-008 | context read-only și transfer explicit prin adaptor |

Este interzisă construirea unui uploader, repository, client Vision, registru
Knowledge sau context paralel.

## 3. Contract de intrare

```ts
type DashboardWarningAnalysisRequestV1 = {
  contractVersion: 'dashboard-warning-analysis.request.v1';
  image: {
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    byteSize: number; // 1..8_388_608
    captureSource: 'camera' | 'file';
  };
  consent: {
    purpose: 'dashboard-warning-analysis';
    accepted: true;
    acceptedAt: string; // ISO-8601
    policyVersion: string;
  };
  declaredContext?: {
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleYear?: number;
    dashboardMessageLanguage?: 'ro' | 'de' | 'en' | 'unknown';
  };
  tripContextRef?: {
    tripId: string;
    contextVersion: number;
    vehicleDisplayReference?: string;
  };
};
```

Reguli:

- imaginea este obligatorie; contextul este opțional;
- marca/modelul declarate sunt `declared`, nu `observed`;
- datele TripContext se citesc prin adaptor și nu se includ dacă nu sunt necesare;
- imaginea nu este trimisă fără consimțământ explicit pentru analiza curentă;
- EXIF și metadata nenecesare se elimină înainte de transfer;
- inputul este respins dacă tipul, dimensiunea sau semnătura fișierului nu corespund.

## 4. Schema canonică de rezultat

```ts
type DashboardWarningSeverity =
  | 'unknown'
  | 'information'
  | 'caution'
  | 'urgent'
  | 'stop-safely';

type EvidenceOrigin = 'vision' | 'ocr' | 'declared' | 'knowledge' | 'inference';

type DashboardWarningCandidateV1 = {
  knowledgeItemId?: string;
  label: string;
  confidence: number; // 0..1
  reason: string;
};

type DashboardWarningAnalysisV1 = {
  contractVersion: 'dashboard-warning-analysis.v1';
  analysisId: string;
  status: 'identified' | 'candidates' | 'uncertain' | 'image-insufficient' | 'unavailable';
  observations: {
    symbol?: { value: string; confidence: number; origin: 'vision' };
    text?: { value: string; confidence: number; origin: 'ocr' | 'vision' };
    color?: {
      value: 'red' | 'amber' | 'yellow' | 'green' | 'blue' | 'white' | 'unknown';
      confidence: number;
      origin: 'vision';
    };
    vehicle?: {
      make?: string;
      model?: string;
      year?: number;
      confidence: number;
      origin: 'vision' | 'declared';
    };
  };
  candidates: DashboardWarningCandidateV1[]; // 0..3
  interpretation?: {
    title: string;
    explanation: string;
    knowledgeItemId?: string;
  };
  severity: {
    level: DashboardWarningSeverity;
    confidence: number;
    basis: string[];
  };
  stopGuidance: {
    required: true | false | 'unknown';
    instruction: string;
  };
  safeChecks: string[]; // 0..5, fără operații periculoase
  escalation: Array<{
    target: 'emergency' | 'service' | 'dispatcher' | 'roadside-assistance' | 'vehicle-manual';
    when: string;
  }>;
  uncertainty: {
    present: boolean;
    reasons: string[];
    requestedActions: Array<'retake-photo' | 'capture-message' | 'provide-make-model' | 'check-manual'>;
  };
  sources: Array<{
    knowledgePackageId?: string;
    knowledgeItemId?: string;
    title: string;
    locator?: string;
  }>;
  limitations: string[];
  provider: 'openai' | 'unavailable';
};
```

## 5. Reguli de severitate

Severitatea este o recomandare de siguranță, nu un diagnostic.

| Nivel | Semnificație UI | Regulă minimă |
|---|---|---|
| `unknown` | Gri — neidentificat | date insuficiente sau contradicții |
| `information` | Albastru/verde — informare | fără indiciu de pericol imediat |
| `caution` | Galben — verifică | continuarea poate cere verificare și monitorizare |
| `urgent` | Portocaliu — contactează | service/dispecerat prompt; utilizatorul evită asumări |
| `stop-safely` | Roșu — oprește în siguranță | numai când sursele și politica permit recomandarea prudentă |

Culoarea observată nu stabilește singură severitatea. Mesajul textual, simbolul,
starea fix/intermitentă, contextul și Knowledge trebuie evaluate împreună.

## 6. Politica fail-closed

### 6.1 Praguri inițiale propuse

- `identified`: candidat unic ≥ 0,85, fără contradicții și cu grounding Knowledge;
- `candidates`: maximum trei candidați, fiecare ≥ 0,55, diferență insuficientă pentru identificare unică;
- `uncertain`: niciun candidat ≥ 0,55 sau conflict între simbol/text/culoare/context;
- `image-insufficient`: blur, reflexie, decupare, expunere sau rezoluție neutilizabilă;
- `unavailable`: provider, rețea, secret, timeout sau schemă indisponibilă.

Pragurile sunt candidate și necesită aprobarea Inspectorului pe baza matricei reale.

### 6.2 Comportament obligatoriu

- `uncertain` și `image-insufficient` nu afișează diagnostic singular;
- solicită fotografie mai clară, mesajul complet sau marca/modelul;
- variantele sunt etichetate explicit „posibile”, cu confidence vizibil;
- severitatea devine `unknown` când grounding-ul este insuficient;
- orice output care nu trece JSON Schema și post-validarea locală este respins;
- la indisponibilitate se oferă numai acces la manual/bibliotecă și contacte, fără rezultat simulat;
- `stop-safely` nu poate fi coborât automat pe baza unei inferențe contradictorii;
- niciun rezultat nu schimbă TripContext sau deschide incident fără confirmarea utilizatorului.

## 7. Invarianta arhitecturală Photo First

**Stare:** `OFFICIAL / ACTIVE / PERMANENT RULE`

Ordinea normativă, obligatorie pentru orchestrare, API și experiența utilizatorului,
este:

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

Reguli obligatorii:

1. fotografia selectată explicit de utilizator este singurul început al unei analize;
2. Vision produce observațiile vizuale înaintea oricărei corelări Knowledge;
3. OCR rulează numai dacă există text candidat și rămâne separat de Vision;
4. Knowledge corelează observații existente și nu poate inventa retrospectiv dovezi;
5. severitatea se clasifică numai după corelare și verificarea contradicțiilor;
6. explicația nu poate exprima o certitudine mai mare decât dovezile și confidence-ul;
7. acțiunea sigură este derivată după severitate și respectă politica fail-closed;
8. referința Knowledge este secundară și ultima etapă a rezultatului;
9. biblioteca sau un deep-link Knowledge nu constituie analiză și nu poate produce severitate;
10. fallback-ul fără Vision poate oferi numai referințe, fără identificare simulată.

Fiecare etapă păstrează proveniența distinctă `vision`, `ocr`, `context`,
`knowledge` sau `policy`. Rezultatul brut al providerului nu ajunge direct în UI.

## 8. Vision → Knowledge Mapping

1. Vision produce observații și candidați, fără text editorial inventat.
2. Mapperul caută numai în versiunea publicată a `KB-VEHICLE-WARN-001`.
3. Asocierea exactă cere `knowledgeItemId` existent și pachet publicabil.
4. Explicația și acțiunile validate provin din Knowledge; modelul nu le rescrie ca certitudini.
5. Dacă nu există candidat Knowledge suficient, rezultatul rămâne `uncertain`.
6. Sursele și locatorii sunt afișați în secțiunea secundară „Surse și limite”.
7. Biblioteca completă rămâne accesibilă secundar, nu ca flux principal.

## 9. UI Photo First

### 9.1 Stări

```text
READY_TO_CAPTURE
→ CONSENT_REQUIRED
→ IMAGE_SELECTED
→ ANALYZING
→ IDENTIFIED | CANDIDATES | UNCERTAIN | IMAGE_INSUFFICIENT | UNAVAILABLE
```

### 9.2 Primul ecran

- titlu scurt: „Fotografiază martorul”;
- buton principal: „Deschide camera”;
- alternativă: „Alege fotografie”;
- instrucțiune vizuală: include simbolul și mesajul complet, evită reflexia;
- câmpuri opționale marca/model;
- rezumat clar al transferului imaginii înainte de consimțământ.

### 9.3 Rezultat

Ordinea obligatorie:

1. identificare sau „Nu pot identifica sigur”;
2. severitate și recomandarea de oprire;
3. „Ce faci acum” — maximum cinci acțiuni sigure;
4. când contactezi service/dispecerat/asistență;
5. candidați alternativi, dacă există;
6. surse, confidence și limite;
7. biblioteca Knowledge secundară.

Acțiunile principale trebuie să fie utilizabile cu o mână, la viewport mobil, fără
scroll orizontal și fără text juridic înaintea rezultatului practic.

## 10. Transfer imagine, consimțământ și retenție

- consimțământ explicit per analiză; acceptarea juridică generală nu este suficientă;
- UI precizează că imaginea este transmisă backendului AGM și providerului Vision;
- imaginea nu se salvează server-side prin acest contract;
- logurile, erorile, monitoringul și incidentele nu conțin imagine, OCR sau identificatori;
- backendul nu returnează imaginea și nu include base64 în răspuns;
- timeoutul sau anularea opresc procesarea și elimină referințele temporare;
- salvarea locală în OCR Archive este separată și necesită acțiune explicită;
- resetarea/ștergerea locală reutilizează contractele APP-009;
- politica și versiunea consimțământului sunt auditate fără payload privat.

## 11. Context Operațional

- modulul funcționează și fără cursă activă;
- dacă există TripContext, vehiculul poate fi precompletat prin adaptor read-only;
- rezultatul poate fi oferit ca `TransferredResult` numai după confirmare explicită;
- un `openItem` sau incident necesită o comandă separată și autorizată;
- analiza nu schimbă lifecycle, readiness, flags sau starea vehiculului;
- în AGM Basic nu se creează un TripContext paralel.

## 12. Contract API propus

```text
POST /api/v1/dashboard-warning-analysis
Content-Type: multipart/form-data
Fields: image, request(JSON)
Success: responseEnvelope<DashboardWarningAnalysisV1>
```

Erori controlate:

- `DASHBOARD_WARNING_CONSENT_REQUIRED` — 400;
- `DASHBOARD_WARNING_IMAGE_INVALID` — 400;
- `DASHBOARD_WARNING_IMAGE_TOO_LARGE` — 413;
- `DASHBOARD_WARNING_RATE_LIMITED` — 429;
- `DASHBOARD_WARNING_PROVIDER_UNAVAILABLE` — 503;
- `DASHBOARD_WARNING_PROVIDER_TIMEOUT` — 504;
- `DASHBOARD_WARNING_OUTPUT_INVALID` — 502.

Endpointul cere autentificarea și izolarea existente. Rate limitingul, request ID,
timeoutul și sanitizarea erorilor reutilizează API Core/API-008.

## 13. Matrice minimă de validare

### 13.1 Vehicule și display-uri

| Dimensiune | Acoperire minimă |
|---|---|
| Mărci | minimum 5 mărci de vehicule comerciale folosite în UE |
| Modele/ani | minimum 2 generații per marcă unde display-ul diferă |
| Tip afișaj | analog, LCD monocrom, TFT color |
| Simbol | roșu, galben, verde/albastru; fix și intermitent unde poate fi capturat |
| Mesaj | RO, DE, EN și text absent |
| Imagine | clară, blur, reflexie, noapte, decupată, simbol multiplu |
| Context | fără vehicul, marcă numai, marcă+model, context contradictoriu |

Setul de test nu folosește imagini fără drept de utilizare și nu conține date
personale reale.

### 13.2 Cazuri obligatorii

- identificare corectă cu candidat unic;
- candidați multipli fără alegere forțată;
- fotografie neclară și solicitare de recaptură;
- mesaj OCR util, dar separat de observația Vision;
- culoare greșită din reflexie fără severitate falsă;
- marcă/model contradictorii;
- simbol necunoscut bibliotecii;
- provider indisponibil/timeout/output invalid;
- mod offline;
- imagine > 8 MB sau MIME fals;
- consimțământ absent/retras;
- zero payload privat în loguri;
- zero mutație automată TripContext;
- Browser desktop/mobil și Android real.

### 13.3 Criterii propuse pentru gate

- 100% cazuri critice fail-closed;
- 0 diagnostice singulare în seturile `uncertain`/`image-insufficient`;
- 100% outputuri conforme cu schema;
- 100% surse Knowledge valide pentru `identified`;
- 0 imagini/OCR în loguri;
- matrice Browser și Android PASS;
- acceptare Owner pentru utilitatea rezultatului în maximum câteva secunde de scanare.

Nu se fixează încă un procent general de acuratețe până la aprobarea și constituirea
setului reprezentativ de test.

## 14. PASS / HOLD / NO-GO

### PASS funcțional

- contractul și schema sunt aprobate;
- toate cazurile critice fail-closed trec;
- maparea Knowledge este trasabilă;
- UI Photo First este validat de Owner pe Browser și Android;
- consimțământul și retenția sunt validate Legal/Security;
- Inspectorul confirmă separarea observație/OCR/context/inferență;
- nu există regresii APP-004, APP-015, API-008, PRE-008 sau Basic.

### HOLD

- matrice incompletă, confidence necalibrat sau experiență insuficientă;
- pachet Knowledge insuficient pentru candidatul analizat;
- Browser/Android ori provider real nevalidate.

### NO-GO

- diagnostic prezentat ca certitudine;
- upload fără consimțământ;
- imagine ori OCR în loguri;
- fallback care inventează rezultat;
- severitate derivată doar din culoare;
- mutație automată de context/incident;
- implementare paralelă a infrastructurii reutilizabile.

## 15. Porți și aprobări necesare înainte de implementare

Architecture Amendment și actualizarea contractului sunt aprobate de Owner.
Architecture Review este `PASS`. Implementarea rămâne însă `NO-GO` până la
închiderea cumulativă a exact trei HOLD-uri:

1. Privacy & Security — controalele asupra imaginilor;
2. QA Safety-Critical Assets — activele utilizate în scenariile critice;
3. Domain Safety-Critical — regulile de siguranță aplicabile.

Numai după validarea și închiderea explicită a tuturor celor trei HOLD-uri se poate
ridica `NO-GO` și autoriza implementarea. Validările Product, UX, Knowledge
Operations și Inspector rămân criterii de execuție și acceptanță în rolurile lor,
fără a crea HOLD-uri arhitecturale suplimentare.

Până atunci, verdictul este:

`DASHBOARD WARNING ANALYSIS — ARCHITECTURE PASS / 3 HOLDS OPEN / IMPLEMENTATION NO-GO`.
