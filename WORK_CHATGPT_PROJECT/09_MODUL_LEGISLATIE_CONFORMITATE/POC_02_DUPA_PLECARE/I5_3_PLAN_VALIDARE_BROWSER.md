# I5.3 – PLAN DE VALIDARE BROWSER

**Data:** 2026-07-20
**Baseline de intrare:** `493554d58001bc445a0854d74418d243562b3371`
**Statut:** RETRAS DIN EXECUȚIE – REMEDIERE DOCUMENTARĂ
**Livrabil planificat:** L5-04 – raport Browser

## 1. Obiectiv

Consolidarea unor dovezi Browser reproductibile pentru fluxul „După Plecare”,
fără modificări funcționale și fără reutilizarea implicită a PASS-ului istoric
din ETAPA 4.

## 1.1 Reaudit de eligibilitate

Product Owner confirmă că funcționalitățile „Înainte de Plecare” și „După
Plecare” nu sunt implementate și accesibile în versiunile Browser și Android
curente. Artefactul tehnic separat `/after-departure.html` nu demonstrează
livrarea funcționalității în platforma oficială.

Ca urmare, matricea B5.3-01–B5.3-12 de mai jos este păstrată numai ca istoric
de trasabilitate și este retrasă din execuție. Toate scenariile sunt
NEAPLICABIL / NEIMPLEMENTAT, conform
`I5_3_REAUDIT_TRASABILITATE.md`.

## 2. Criterii aplicabile

| Criteriu | Condiție de PASS în I5.3 |
|---|---|
| AC5-08 | mediul, URL-ul, versiunea/buildul, pașii și rezultatele Browser sunt documentate |
| AC5-10 | trecerea offline, comportamentul local și revenirea online sunt demonstrate |
| AC5-11 | 8/8 scenarii și 9/9 stări sunt acoperite prin matrice practică și dovezi automate I5.2 |
| AC5-12 | fluxurile RO/DE/EN sunt verificate practic pentru conținut și coerență |
| AC5-13 | nicio acțiune externă nu este executată în fluxurile testate |

Toate cele cinci criterii trebuie să aibă rezultat explicit PASS. Lipsa
dovezii produce NEVALIDAT, nu PASS implicit și nu defect presupus.

## 3. Matrice de execuție propusă

| ID | Test Browser | Dovadă minimă | Criterii |
|---|---|---|---|
| B5.3-01 | accesarea entry point-ului separat „După Plecare” la `/after-departure.html` | URL, captură și pagina țintă | AC5-08 |
| B5.3-02 | flux nominal cu date complete până la `ASSESSED` | pași, intrări, stare finală și captură | AC5-08, AC5-11 |
| B5.3-03 | poarta de siguranță `UNSAFE_TO_INTERACT` | intrări și stare observată | AC5-11 |
| B5.3-04 | prioritate critică `EMERGENCY` | intrări și stare observată | AC5-11 |
| B5.3-05 | date incomplete `NEEDS_FACTS` | lista datelor lipsă și lipsa presupunerilor | AC5-11 |
| B5.3-06 | confirmare fără efect extern | `AWAITING_CONFIRMATION`, schiță locală și dovada lipsei transmiterii | AC5-13 |
| B5.3-07 | tranziții `ESCALATED` → `SAFE_TO_CONTINUE` → `CLOSED` | succesiunea stărilor și blocarea tranziției invalide | AC5-11 |
| B5.3-08 | utilizare exclusiv cu tastatura | traseu Tab/Shift+Tab/Enter, focus vizibil și rezultat | AC5-08 |
| B5.3-09 | pointer, back, refresh și retry | rezultat stabil, fără dublarea efectelor | AC5-08, AC5-13 |
| B5.3-10 | consola Browser | jurnal/captură fără erori relevante neexplicate | AC5-08 |
| B5.3-11 | offline → evaluare locală → online | banner/stare offline, rezultat local și restabilire | AC5-10 |
| B5.3-12 | RO, DE și EN | capturi și verificarea aceluiași flux în fiecare limbă | AC5-12 |

Acoperirea exhaustivă 8 scenarii × 9 stări nu presupune 72 de parcursuri
manuale distincte. Matricea practică trebuie corelată cu aserțiunile automate
I5.2, iar fiecare scenariu și fiecare stare trebuie să apară cel puțin o dată
în dovada consolidată.

## 4. Formatul obligatoriu al dovezii

Pentru fiecare test:

1. identificator;
2. data și ora;
3. sistemul de operare și versiunea Browser;
4. commitul/buildul testat;
5. URL-ul;
6. starea inițială;
7. pașii și datele introduse;
8. rezultatul observat;
9. captură, jurnal sau înregistrare asociată;
10. PASS, FAIL sau NEVALIDAT.

Raportul trebuie să separe clar dovada observată în sesiunea I5.3 de
referințele istorice ETAPA 4 și de dovezile automate I5.2.

## 5. Riscuri și controale

| ID | Risc | Control |
|---|---|---|
| RB-01 | validare pe alt cod decât checkpoint-ul I5.2 | identificarea commitului și verificarea fișierelor runtime înaintea testului |
| RB-02 | modificările paralele influențează buildul | inventar worktree și declararea exactă a buildului testat |
| RB-03 | disponibilitatea Browserului este confundată cu validarea | PASS numai pe pași și rezultate observate |
| RB-04 | consola este verificată incomplet | jurnal de la încărcare până la finalul fluxului |
| RB-05 | simularea offline nu este demonstrată | înregistrarea tranziției online/offline/online |
| RB-06 | efect extern accidental | monitorizarea cererilor și confirmarea comportamentului exclusiv local |
| RB-07 | acoperire lingvistică superficială | același flux și aceleași câmpuri controlate în RO/DE/EN |
| RB-08 | defectul este remediat în timpul auditului | oprire, clasificare FAIL și increment de remediere separat |

## 6. Clasificarea rezultatelor

- **PASS:** comportamentul este demonstrat și corespunde criteriului;
- **FAIL:** defectul este reproductibil și susținut de dovadă;
- **NEVALIDAT:** testul sau dovada este incompletă;
- **MEDIU:** blocaj extern aplicației, documentat și repetat după remedierea
  mediului fără modificarea codului.

Un FAIL oprește I5.3. Orice remediere funcțională necesită autorizare separată.

## 7. Condiții pentru autorizarea execuției

- Product Owner aprobă prezentul plan;
- Browserul și URL-ul țintă sunt identificate;
- buildul/commitul testat este declarat;
- mecanismul de captură și jurnal de consolă este disponibil;
- modificările paralele sunt inventariate;
- se confirmă că nu sunt permise modificări funcționale în timpul auditului.

## 8. Condiții de închidere inițiale – retrase

- B5.3-01–B5.3-12 nu se mai execută în versiunea curentă;
- AC5-08 și AC5-10–AC5-13 nu pot primi PASS;
- închiderea necesită decizie Product Owner privind oprirea ca NEAPLICABIL sau
  planificarea separată a implementării.

## 9. Decizie solicitată

Se solicită exclusiv aprobarea documentară a planului și, separat, autorizarea
execuției I5.3. Prezentul document nu autorizează lansarea Browserului,
executarea testelor sau crearea checkpoint-ului.

## 10. Clarificare de trasabilitate B5.3-01

Observația Product Owner confirmă că suprafața curentă `/premium` nu conține
modulul „După Plecare”. Verificarea checkpoint-ului I5.2 arată că POC 02 este
livrat ca entry point Vite separat:

- URL țintă: `http://localhost:5173/after-departure.html`;
- fișier: `apps/web/after-departure.html`;
- sursă: `apps/web/src/poc02-after-departure/after-departure.entry.ts`;
- build input: cheia `afterDeparture` din `apps/web/vite.config.ts`;
- punctul de acces injectat de Vite aparține paginii principale, nu
  registrului de rute Premium.

Clarificarea tehnică a URL-ului nu rezolvă poarta de livrare. Accesul direct la
un entry point izolat nu este echivalent cu integrarea în versiunea Browser
oficială. B5.3-01 este, împreună cu B5.3-02–B5.3-12, NEAPLICABIL /
NEIMPLEMENTAT.
