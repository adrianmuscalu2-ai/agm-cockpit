# AGM — SR-14 CSS și i18n Modularization

Data: 2026-07-29  
Verdict: **CLOSED / PASS**

## 1. Scop

SR-14 a modularizat controlat foaia CSS principală și a consolidat evidența
resurselor i18n, fără schimbarea comportamentului funcțional sau a contractelor
publice.

## 2. Modificări efectuate

### CSS

Foaia monolitică `apps/web/src/styles.css` a fost transformată într-un manifest
cu importuri ordonate, iar cascada existentă a fost distribuită în:

- `apps/web/src/styles/00-foundation.css`
- `apps/web/src/styles/10-shell.css`
- `apps/web/src/styles/20-domain-tools.css`
- `apps/web/src/styles/30-operations.css`
- `apps/web/src/styles/40-turn-responsive.css`
- `apps/web/src/styles/50-roadmap-responsive.css`

Ordinea regulilor nu a fost schimbată. Concatenarea binară a celor șase module
reproduce exact fișierul anterior SR-14:

- SHA-256 de referință:
  `2A676A4ED84022E5801150155B2F6E317892A15E45522F4CA3A972F4D8D39A4A`
- rezultat: **identic byte-cu-byte**

Această verificare oferă regresie vizuală deterministă pentru schimbarea SR-14:
aceeași cascadă, aceleași reguli, aceeași ordine și același conținut.

### i18n

A fost adăugat registrul:

- `apps/web/src/i18n/i18n-catalog.registry.ts`

Registrul declară explicit limbile suportate `ro`, `de`, `en` și proprietarii
celor patru cataloage existente:

- aplicația principală;
- Premium;
- Pre-Departure;
- After-Departure.

Dicționarele și textele funcționale nu au fost modificate.

### Scut SR-14

A fost adăugat:

- `apps/web/scripts/test-sr14-css-i18n-accessibility.ts`

și inclus în `test:mc3a` din `apps/web/package.json`.

Scutul verifică:

- ordinea manifestului CSS;
- reconstrucția exactă a cascadei anterioare;
- prezența RO/DE/EN în fiecare catalog;
- paritatea cheilor și a structurii recursive;
- valori nelipsă;
- paritatea placeholder-elor;
- reperele statice de accesibilitate pentru aplicația principală,
  Pre-Departure și After-Departure.

## 3. Completitudinea localizărilor

Verdict: **PASS**

- App: RO/DE/EN — chei complete, valori nelipsă, placeholder-e compatibile;
- Premium: RO/DE/EN — chei complete, valori nelipsă, placeholder-e compatibile;
- Pre-Departure: RO/DE/EN — topologie completă și valori nelipsă;
- After-Departure: RO/DE/EN — topologie completă și valori nelipsă.

## 4. Regresie vizuală și accesibilitate

- Echivalența vizuală a modificării CSS: **PASS**, demonstrată prin
  reconstrucția byte-cu-byte a cascadei originale.
- Browser E6.3: **PASS**.
- Browser E6.4–E6.6: **PASS**.
- Smoke static de accesibilitate: **PASS** pentru nume accesibile,
  regiuni live/status, dialog modal, stări apăsate și asocierea etichetelor.

Browserul interactiv al mediului de execuție nu a fost disponibil; nu a fost
folosit un substitut care ar fi extins scope-ul. Această limitare nu afectează
verdictul schimbării CSS, deoarece identitatea cascadei este verificată exact,
iar fluxurile Browser existente au trecut integral.

## 5. Validări

- Scut SR-14 țintit: **PASS**
- MC-3A complet: **PASS**
- Regresie API completă: **PASS — 19 suite, 99 teste**
- TypeScript/API Build: **PASS**
- Cicluri Web: **PASS — 166 fișiere, 0 cicluri**
- Cicluri API: **PASS — 81 fișiere, 0 cicluri**
- Web Build: **PASS — 188 module**
- Browser E6.3: **PASS**
- Browser E6.4–E6.6: **PASS**
- Android `testDebugUnitTest`: **BUILD SUCCESSFUL — 53 task-uri**

Build-ul Web păstrează avertismentul Vite existent pentru chunk-ul principal de
526,07 kB. Pragul și strategia de chunking nu au fost modificate în SR-14.

## 6. Zone protejate

Au rămas neatinse:

- API-ul public;
- DTO-urile;
- schema Prisma;
- Diagnostics;
- producția;
- infrastructura;
- materialele concursului și registrul lor de protecție;
- telefonul.

`assembleDebug` nu a fost executat. Nu a fost generat, instalat sau livrat
niciun APK. Inventarul celor cinci APK-uri Android a rămas identic ca
dimensiune, SHA-256 și timestamp.

## 7. Rollback

Rollback-ul este strict local și nu necesită migrare:

1. se restaurează conținutul CSS anterior din concatenarea ordonată a celor
   șase module;
2. se elimină manifestul modular, registrul i18n și scutul SR-14;
3. se elimină intrarea SR-14 din `test:mc3a`.

Nu există efecte asupra datelor, API-ului, dispozitivului sau infrastructurii.

## 8. Verdict

**SR-14 — CLOSED / PASS**

SR-08–SR-14 sunt închise tehnic cu PASS. Programul structural general nu este
închis prin acest raport; evaluarea și închiderea integrată necesită mandat
operațional separat. SR-06 rămâne **ON HOLD / Pending Final Device Validation**.
