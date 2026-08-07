# Infrastructure Reuse Report — Martori în bord / analiză foto

**Report ID:** IRR-SVC-019-20260803-004  
**Data și autor:** 2026-08-03 — Infrastructure Reuse Coordinator  
**Propunere / modul / serviciu:** AGM Basic „Martori în bord” — fotografie → recunoaștere → explicație → severitate → acțiune sigură  
**Concluzie:** `FOUNDATION PARTIAL`

## Scope verificat

- captură Camera și import imagine în Browser/Android;
- OCR local și arhiva OCR;
- analiză Vision server-side existentă;
- registrul și pachetul Knowledge pentru martori;
- confidence, grounding, fail-closed și limite de siguranță;
- integrarea opțională cu TripContext / Context Operațional Comun.

## Surse canonice consultate

- `AGM_ORGANIZATIONAL_CONTRACT_V1.md`;
- `AGM_COCKPIT_GOVERNANCE_REGISTER_V1.md`;
- `TURN_INFRASTRUCTURE_REUSE_REPORT_CONTRACT_V1.md`;
- `evidence/governance/modules/APP-004/v1.0/*`;
- `evidence/governance/modules/APP-015/v1.0/*`;
- `evidence/governance/modules/API-008/v1.0/*`;
- `evidence/governance/modules/PRE-008/v1.0/*`;
- `apps/web/src/capabilities/capability-registry.ts`;
- `apps/web/src/storage/ocr-archive.repository.ts`;
- `apps/web/src/legal-knowledge/*`;
- `apps/api/src/premium-load-safety/*`;
- `apps/web/src/premium-operational-context/*`.

## Departamente, agenți și roluri existente relevante

- Engineering / Architecture Guardian;
- Frontend & Website Owner și APP-015 Platform Capabilities;
- Backend & Data Custodian;
- Security, Secrets & Compliance / SVC-019;
- Knowledge & Documentation / Knowledge Operations;
- Chief Inspector și QA independent;
- Infrastructure Reuse Coordinator — numai read-only.

## Servicii și module reutilizabile

| Fundație | Stare | Reutilizare permisă |
|---|---|---|
| APP-015 Camera/File Capture | existentă | captură explicită JPEG/PNG/WEBP în Browser și Android |
| APP-004 OCR | `PASS / CLOSED` | text vizibil, confidence OCR, preprocesare și arhivă locală |
| APP-009 Storage & Offline | existentă | repository și lifecycle local; fără acces direct între module |
| KnowledgePackage + Publication Gate | `PASS / PUBLISHED` | grounding secundar și explicații validate |
| `KB-VEHICLE-WARN-001` | `PASS / PUBLISHED` | candidați, explicații și referințe; nu classifier complet |
| API-008 Vision transport/provider | `PASS / CLOSED` în scope Load Safety | multipart, limită 8 MB, OpenAI Responses cu imagine, timeout, JSON Schema, post-validare și fail-closed |
| PRE-008 TripContext | `PASS / CLOSED` | referință contextuală prin adaptor public; fără mutație directă din analiză |

## Contracte și registre aplicabile

- APP-004 permite captură explicită și OCR local, dar nu autorizează cloud OCR,
  upload automat sau folosirea rezultatului neconfirmat în decizii de siguranță;
- API-008 demonstrează un transport Vision reutilizabil, însă contractul său este
  limitat la Load Safety și nu poate fi reutilizat semantic ca diagnostic de bord;
- rezultatele Vision existente sunt orientative, validate strict și nu produc
  certificare, persistență ori tranziții operaționale;
- PRE-008 acceptă rezultate transferate și open items numai prin contractele sale,
  fără stare paralelă și fără schimbarea automată a lifecycle-ului;
- pachetul Knowledge rămâne sursă secundară; publicarea sa nu acordă PASS fluxului foto.

## Owner / custode / validator existenți

- Product Owner / Turn Commander: autoritate de scope și acceptare;
- Architecture Guardian: contractul nou și limitele reutilizării;
- Frontend & Website Owner: captură și experiență Browser/Android;
- Backend & Data Custodian: endpoint și provider Vision;
- Security Governance Owner / Agent Legal: consimțământ, transfer imagine și retenție;
- Knowledge Operations: maparea controlată la pachetul publicat;
- QA + Chief Inspector: validare independentă, inclusiv cazuri incerte și fail-closed.

## Suprapuneri sau duplicate detectate

- un nou uploader Camera ar duplica APP-015/APP-004;
- un nou client generic Vision ar duplica transportul și controalele API-008;
- un nou registru de martori ar dubla `KB-VEHICLE-WARN-001`;
- o stare separată pentru vehicul/cursă ar dubla PRE-008 TripContext;
- reutilizarea directă a schemelor Load Safety ar fi o suprapunere semantică greșită.

## Responsabilități demonstrabil absente

1. contract versionat dedicat `DashboardWarningAnalysis`;
2. endpoint dedicat și schemă strictă pentru simbol, text, culoare, vehicul,
   candidați, confidence, severitate, stop guidance și escaladare;
3. policy de praguri: identificat / variante / fotografie neclară / context lipsă;
4. mapare controlată între rezultatul Vision și `KB-VEHICLE-WARN-001`;
5. UI principal foto-first și stări capture/analyzing/result/uncertain/error;
6. mesaje de siguranță care nu echivalează culoarea cu diagnosticul;
7. contract juridic pentru transmiterea imaginii către provider și retenție zero;
8. test set reprezentativ pe vehicule/mărci/ecrane și validare independentă;
9. adaptor opțional către TripContext, fără mutație automată.

## Riscuri și contradicții

- APP-004 interzice uploadul cloud în scope-ul său actual; fluxul Vision necesită
  contract și acceptare distinctă, nu extindere implicită;
- culoarea și simbolul pot fi alterate de iluminare, reflexii și display;
- același simbol poate avea sens diferit după marcă/model/an;
- un model Vision poate formula un diagnostic plauzibil, dar greșit;
- severitatea greșită poate produce oprire inutilă sau continuare periculoasă;
- OCR nu este dovadă vizuală și nu poate fi etichetat `observed`;
- lipsa rețelei trebuie să producă fallback sigur către bibliotecă/manual, nu analiză simulată;
- imaginile pot conține date personale, localizare sau identificatori ai vehiculului.

## Instrucțiune către Architecture

Reutilizați Camera/File Capture, preprocesarea și OCR APP-004, transportul Vision și
controalele tehnice API-008, Knowledge Registry și adaptorul public TripContext.
Proiectați un contract semantic separat pentru martori, cu output strict,
confidence și fail-closed. Nu reutilizați schema Load Safety și nu modificați
pachetele editoriale. Implementarea rămâne `NO-GO` până la aprobarea contractului,
a regulilor de siguranță, a transferului de imagine și a matricei de validare.

**Destinatari:** Product Owner | Architecture Guardian | Turn Commander
