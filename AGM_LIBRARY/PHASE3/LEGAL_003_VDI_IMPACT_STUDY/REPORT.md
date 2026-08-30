# LEGAL-003 — VDI 2700 Blatt 8.1 impact study

## Executive verdict

Lipsa textului integral VDI 2700 Blatt 8.1 nu afectează material modul actual **Car Mover — vehicul condus pe propriile roți**. Afectează material numai capabilitățile care ar trebui să ofere o soluție tehnică prescriptivă, o evaluare de conformitate sau o decizie de plecare pentru un autoturism ori vehicul comercial ușor transportat ca încărcătură pe platformă/autotransporter.

Recomandarea este **HYBRID SAFETY MODEL + LICENSED EXTERNAL STANDARD REFERENCE**. AGM poate continua să ofere reguli publice, observații vizuale, checklist-uri non-normative, avertismente, colectare de evidence și escaladare umană. Fără licență, AGM nu poate oferi o soluție Blatt 8.1, nu poate declara `VDI COMPLIANT` și nu poate autoriza plecarea pe baza unei fotografii ori a unui checklist.

Achiziția nu este justificată acum doar pentru a transforma artificial `3/4` în `4/4`. Devine justificată dacă Product Owner aprobă ca cerință de produs una dintre următoarele funcții: instrucțiuni tehnice Blatt 8.1 în produs, calcul/checklist normativ, decizie de conformitate sau audit de eliberare la transport bazat pe standard. În acel caz este necesară verificarea drepturilor enterprise/AI; simpla cumpărare a unui PDF nu dovedește dreptul de procesare AI ori distribuire internă.

Status recomandat: `READY_FOR_PRODUCT_OWNER_ARCHITECTURE_DECISION`.

## Boundary de analiză

- Document: VDI 2700 Blatt 8.1, ediția `2024-09`, corrigendum `2025-10`.
- Conținut licențiat accesat/ingerat: **NU**.
- Reconstrucție din surse secundare: **NU**.
- Au fost folosite numai metadata publică oficială, legislație publică și comportamentul existent al codului AGM.
- Metadata publică oficială identifică Blatt 8.1 drept standard pentru securizarea autoturismelor și vehiculelor comerciale ușoare pe transportere; catalogul oficial indică limita de până la 4,5 t masă reală și o configurație de transporter adecvată standardului. Această metadata nu conține metoda normativă.

## A. Functional impact matrix

| Funcție AGM | Dependență VDI | Ce rămâne sigur fără VDI | Ce este interzis | Fallback | Risc rezidual |
|---|---|---|---|---|---|
| Car Mover pe propriile roți | NONE | planificare și execuție ca vehicul condus, cu regulile obișnuite de vehicul/șofer/rută | aplicarea logicii de cargo securing | NOT_APPLICABLE | LOW |
| Car Mover pe platformă/remorcă | HIGH | obligații publice, evidence readiness, plan/calcul și aprobare umană | schemă exactă, număr normativ, `VDI COMPLIANT` | LICENSED_STANDARD_REFERENCE_REQUIRED + HUMAN_VERIFICATION_REQUIRED | MEDIUM dacă gate-ul este dur; HIGH fără el |
| Autotransporter în scope-ul public Blatt 8.1 | CRITICAL | identificarea datoriei, standardului, planului și verificatorului necesar | soluție normativă ori release decision | INSUFFICIENT_AUTHORITY | HIGH |
| Autotransporter în afara scope-ului public Blatt 8.1 | NONE pentru Blatt 8.1 | identificarea lipsei de aplicabilitate și rutarea către autoritatea corectă | extrapolarea Blatt 8.1 | UNKNOWN + HUMAN_VERIFICATION_REQUIRED | HIGH dacă este clasificat greșit |
| Load securing guidance general | MEDIUM | reguli publice, riscuri observabile, categorii generale și escaladare | substituirea calculului/standardului/planului | PUBLIC_LEGAL_GUIDANCE | LOW–MEDIUM |
| Pre-trip checklist | LOW | confirmarea poziției, chingilor, etichetelor, punctelor, planului, axelor și aprobării | `checklist complete = compliant` | BLOCKED/HUMAN_VERIFICATION_REQUIRED la lipsuri | LOW |
| Vehicle securing checklist | MEDIUM | colectare de evidence și atestarea verificării externe | criterii Blatt 8.1 reconstruite | LICENSED_STANDARD_REFERENCE_REQUIRED | MEDIUM |
| Incident guidance | LOW | oprire sigură, protecție, documentare, notificare, reevaluare | clearance VDI ori rețetă tehnică de re-fixare | HUMAN_VERIFICATION_REQUIRED | LOW pentru escaladare; HIGH pentru return-to-service |
| Driver Copilot | MEDIUM | explică public law, lipsuri și riscuri; trimite la specialist | regulă VDI inventată, număr normativ, auto-acceptare | state explicite și refuz tehnic | MEDIUM |
| Safety warnings | LOW | avertizări pentru deplasare, cădere, defecte, etichete/plan lipsă | verdict Blatt 8.1 pass/fail | avertizare prudentă + verificare | LOW |
| Legal guidance | MEDIUM | StVO/HGB/Directiva/ADR în scope exact | standard privat prezentat ca lege ori concluzie juridică definitivă | PUBLIC_LEGAL_GUIDANCE + review | MEDIUM |
| Training/help | MEDIUM | obligații publice, recunoaștere risc, evidence și escaladare | instruire VDI reprodusă/parafrazată ca substitut | REFER_TO_STANDARD | LOW general; HIGH pentru curs VDI pretins |
| Compliance decision support | CRITICAL | readiness/evidence/missing-authority support | `VDI COMPLIANT`, `SAFE TO DEPART`, `PASS` | INSUFFICIENT_AUTHORITY | CRITICAL dacă automatizat |
| Audit/evidence | MEDIUM | provenance, fotografii, fapte confirmate, edition/corrigendum și atestare umană | audit label care implică certificare VDI | external attestation, fără conținut licențiat | LOW traceability; HIGH compliance implication |
| Chingi, ancoraje, blocare, fixare | HIGH | stare vizibilă, etichete confirmate, categorii generale, plan/calcul obligatoriu | număr/pattern/unghi/capacitate/acceptance Blatt 8.1 | `recommendedCount = null` + human verification | MEDIUM cu guardrails; CRITICAL dacă prescriptiv |

Matricea completă, inclusiv alternativele de autoritate și formulările permise/interzise, este în `IMPACT_STUDY.json`.

## B. Separarea modurilor Car Mover

### 1. Vehicul condus pe propriile roți

În implementarea curentă, Car Mover este descris explicit ca „Move vehicles on their own wheels”. Vehiculul este subiectul condus, nu încărcătura unui transporter. Blatt 8.1 nu este material pentru această funcție. Riscul relevant este numai un defect de clasificare: un job pe platformă nu trebuie să poată intra pe calea own-wheels.

Control obligatoriu: `transportMode = OWN_WHEELS | PLATFORM_OR_TRANSPORTER` trebuie stabilit înainte de selectarea regulilor de siguranță; schimbarea modului trebuie să redeschidă verificarea.

### 2. Vehicul pe platformă/remorcă/autotransporter

Vehiculul devine încărcătură. StVO §22 și celelalte surse publice pot explica obligația și principiile generale, dar nu demonstrează singure soluția tehnică specifică unui transporter. Blatt 8.1 devine material dacă transportul se încadrează în scope-ul public al standardului și produsul dorește un rezultat normativ.

„Platformă” nu implică automat aplicabilitate Blatt 8.1. Trebuie confirmate cel puțin: categoria și masa reală a vehiculului transportat, configurația/echiparea transporterului, jurisdicția, standardul curent, planul/calculul, datele echipamentului și aprobarea unei persoane competente.

Pentru transporturi în afara scope-ului public Blatt 8.1, standardul nu trebuie extrapolat. Se selectează autoritatea separată aplicabilă; până atunci starea este `UNKNOWN`.

## C. Existing authority coverage

| Requirement | Existing authority | Coverage | Residual gap |
|---|---|---|---|
| Obligația germană de securizare și trimiterea la regulile tehnice recunoscute | StVO §22 / `CS-DE-STVO` | FULL pentru obligația publică | nu conține metoda tehnică a transporterului |
| Alocarea responsabilităților de încărcare/fixare | HGB §412 / candidat `CS-DE-HGB-412` | FULL pentru alocarea declarată | nu definește suficiența tehnică |
| Principii și control rutier UE | Directiva 2014/47/UE art. 13 și anexa III | PARTIAL, limitat la scope-ul directivei | nu înlocuiește dreptul național sau Blatt 8.1 |
| Bună practică intermodală | IMO/ILO/UNECE CTU Code | CONTEXTUAL; UNECE îl declară non-mandatory | nu este substitut Blatt 8.1 |
| Mărfuri periculoase | ADR 2025 / `CS-UNECE-ADR-2025` | FULL numai în scope ADR | nu acoperă soluția generală pentru autoturisme pe transporter |
| Identitate/ediție/corrigendum | metadata VDI e.V. / candidat `CS-VDI-2700-HANDBOOK` | FULL pentru metadata | zero autoritate pentru instrucțiuni normative |
| Soluție tehnică exactă și verdict Blatt 8.1 | nicio autoritate disponibilă AGM | NONE | standard licențiat + drepturi adecvate ori verificare externă competentă |

Observație juridică: StVO §22 cere respectarea regulilor tehnice recunoscute. VDI însuși explică public că ghidurile sale sunt reguli tehnice private, nu norme statale și nu au efect direct obligatoriu, dar pot concretiza indirect cerința legală. Această distincție exclude ambele extreme: `VDI = lege` este fals, dar și `absența VDI nu contează deloc` este nesigură pentru o evaluare tehnică specifică.

Directiva 2014/47/UE oferă principii publice utile și enumeră standarde aplicabile, însă cadrul ei este controlul tehnic în trafic al vehiculelor comerciale din scope; nu trebuie prezentată ca algoritm universal de securizare sau ca transpunere a Blatt 8.1.

## D. Parallel legal solutions

### Option A — LICENSED_EXTERNAL_STANDARD

AGM păstrează doar metadata, ediția, corrigendumul, URI-ul oficial, applicability/freshness și dovada că o persoană competentă a verificat standardul extern. Este o soluție cu risc juridic mic și fricțiune operațională medie. Permite closure arhitectural, nu `4/4 normative evidence`.

### Option B — PUBLIC-AUTHORITY-ONLY GUIDANCE

Suficient pentru own-wheels, explicații legale, avertizări și evidence readiness. Pentru o soluție de transporter returnează `REFER_TO_STANDARD / HUMAN_VERIFICATION`. Poate închide LEGAL-003 numai dacă Product Owner exclude explicit conformitatea normativă din scope.

### Option C — HYBRID SAFETY MODEL — recomandat

Păstrează regulile publice, checklist-urile originale non-normative, observațiile vizuale, stop-urile obligatorii și decizia umană. Se pot utiliza formulări precum „eticheta nu este confirmată”, „planul lipsește”, „nu porni până la verificare”, dar nu „soluția este conformă VDI”. Aceasta corespunde comportamentului actual al modulului Load Safety.

### Option D — LICENSED AI / ENTERPRISE RIGHTS

Ar putea permite Q&A grounded în standard, checklist-uri normative controlate, comparație ediții/corrigenda, suport tehnic citat și audit mai puternic. Este nevoie de drepturi scrise pentru procesarea AI, stocare, indexare, rezultate derivate, acces multi-user și audit. Document access și AI rights sunt decizii distincte. Nu s-a cumpărat nimic.

## E. Safety boundary fără textul VDI

State permise:

- `PUBLIC_LEGAL_GUIDANCE` — afirmația este susținută direct de autoritate publică, în scope.
- `LICENSED_STANDARD_REFERENCE_REQUIRED` — întrebarea cere standardul privat curent ori o evaluare externă autorizată.
- `HUMAN_VERIFICATION_REQUIRED` — faptele, planul, calculul, echipamentul sau aplicabilitatea trebuie confirmate competent.
- `INSUFFICIENT_AUTHORITY` — AGM nu are autoritatea necesară concluziei cerute.
- `UNKNOWN` — o condiție materială sau currentness nu poate fi demonstrată.

Interzis:

- inventarea sau reconstruirea VDI;
- `VDI COMPLIANT`, `SAFE TO DEPART`, `PASS` sau echivalent fără autoritate și inputuri validate;
- număr exact de chingi, loading pattern, unghiuri, capacități ori limite atribuite Blatt 8.1;
- recomandări secundare prezentate drept standard;
- conversia `UNKNOWN` în `ZERO`, `SAFE`, `PASS`, `NO RESTRICTION` ori `UNCHANGED`;
- transferul automat al regulilor own-wheels către platformă/transporter.

## Impact asupra implementării AGM existente

Codul curent are deja majoritatea limitelor necesare:

- Car Mover este own-wheels.
- providerul Load Safety interzice certificarea siguranței/conformității și inventarea faptelor nevizibile;
- recommendation provider impune `recommendedCount = null` și interzice calculul normativ;
- field test interzice inventarea numărului, LC/STF, masei, frecării, unghiurilor, capacităților și componentelor ascunse;
- UI cere separat calculul/load plan-ul și confirmarea masei, metodei, frecării, unghiurilor, axelor, capacității punctelor și etichetelor;
- Copilot nu oferă binding legal advice și cere confirmare umană.

Prin urmare, absența VDI nu rupe o funcție actuală; blochează activarea unei funcții normative viitoare. Riscul imediat este de wording/scope creep, nu o dependență tehnică runtime.

## Decizia recomandată Product Owner

1. Aprobă `C_HYBRID_SAFETY_MODEL_WITH_A_EXTERNAL_REFERENCE`.
2. Exclude din scope-ul curent: generarea soluției Blatt 8.1, verdict VDI și release decision automat.
3. Reîncadrează `OWNER_LICENSED_ACQUISITION_REQUIRED` ca `NOT_REQUIRED_FOR_APPROVED_SCOPE`.
4. Păstrează permanent `LICENSED_STANDARD_REFERENCE_REQUIRED` pentru transportul pe platformă/transporter care cere concluzie normativă.
5. Păstrează metricul istoric `3/4`; nu declara evidence `4/4`. În noua arhitectură se raportează separat `3 public/metadata requirements covered + 1 licensed capability intentionally excluded`.
6. Reia studiul de achiziție numai dacă roadmap-ul aprobă capabilități normative; atunci verifică înainte de cumpărare drepturile enterprise/AI.

Dacă aceste puncte nu sunt aprobate și AGM trebuie să ofere conformitate tehnică Blatt 8.1, blockerul `LEGAL003-BLK-001 = OWNER_LICENSED_ACQUISITION_REQUIRED` rămâne valid.

## Provenance publică folosită

- StVO §22: https://www.gesetze-im-internet.de/stvo_2013/__22.html
- HGB §412: https://www.gesetze-im-internet.de/hgb/__412.html
- Directiva 2014/47/UE: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02014L0047-20220927
- CTU Code: https://unece.org/transport/intermodal-transport/imoilounece-code-practice-packing-cargo-transport-units-ctu-code
- VDI 2700 family/status metadata: https://www.vdi.de/mitgliedschaft/vdi-richtlinien/unsere-richtlinien-highlights/vdi-2700-ladungssicherung-auf-strassenfahrzeugen
- VDI 2700 Blatt 8.1 public product metadata: https://www.dinmedia.de/de/technische-regel/vdi-2700-blatt-8-1/382522934
- Corrigendum metadata: https://www.vdi.de/mitgliedschaft/vdi-richtlinien/details/vdi-2700-blatt-81-berichtigung-ladungssicherung-auf-strassenfahrzeugen-sicherung-von-pkw-und-leichten-nutzfahrzeugen-auf-fahrzeugtransportern-berichtigung-zur-richtlinie-vdi-2700-blatt-812024-09

## No-mutation proof target

- Central Registry: `862`, SHA-256 `7d4901c4479129669e8036197cbdb116674f219ea21db34db7e1d20eefc48245`.
- Legislation/Safety view: `66`, SHA-256 `c6d45d7c4fcc86574790add0491e37727691909f287d461e356be05f69a1b0ab`.
- Routing/Toll view: `289`, SHA-256 `049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0`.
- Registry/view mutation: `NONE`.
- Authority promotion: `NONE`.
- Runtime/Production: `NO CHANGE`.
- Purchase/ingest/apply: `NOT EXECUTED`.
- Commit/push: `NOT EXECUTED`.
