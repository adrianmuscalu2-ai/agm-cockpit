# AGM — SR-08D OCR Composed State

Data: 2026-07-29  
Domeniu: exclusiv starea OCR  
Verdict: **CLOSED / PASS**

## Rezultat

Cele cinci câmpuri deținute de OCR au acum un singur proprietar runtime
canonic în `OcrState`:

- `ocrImageDataUrl`;
- `ocrExtractedText`;
- `ocrConfidence`;
- `ocrHistory`;
- `isOcrProcessing`.

`LegacyAppStateFacade` păstrează compatibilitatea prin proprietăți
getter/setter enumerabile conectate direct la starea canonică. Nu există
copiere de stare, proprietăți `value` pe fațadă sau dual-write.

Controllerul OCR primește explicit `OcrState`. Dependențele cross-domain
(`profile`, `translatorTargetLanguage`, `translatorText` și `status`) rămân
în domeniile lor existente și sunt accesate prin fațada compatibilă. Ordinea
procesării, ramurile de eroare, actualizarea Translator, limita istoricului de
opt elemente și persistența sunt neschimbate.

## Module și fișiere afectate

- `apps/web/src/app-shell/ocr-state.store.ts`;
- `apps/web/src/ocr/ocr.controller.ts`;
- `apps/web/src/main.ts`;
- `apps/web/scripts/test-sr08d-ocr-composed-state.ts`;
- `apps/web/scripts/test-mc3a-main-characterization.ts`;
- `apps/web/scripts/test-sr03-app-shell-contracts.ts`;
- `apps/web/package.json`;
- prezentul raport.

Nu au fost modificate Incident, Diagnostics, Android, API, DTO-uri, Prisma,
producția, infrastructura sau materialele concursului.

## Validări

| Gate | Rezultat |
|---|---|
| Proprietar canonic unic pentru cele 5 câmpuri OCR | PASS |
| Paritate bidirecțională stare canonică ↔ fațadă legacy | PASS |
| Absența dual-write și a proprietăților `value` | PASS |
| Controller OCR conectat explicit la starea canonică | PASS |
| Transfer OCR → Translator și persistență istoric | PASS |
| Compatibilitate SR-07D | PASS |
| Suprafață legacy: 65 câmpuri, proprietate unică | PASS |
| Scut SR-08A–D | PASS — 4/4 |
| MC-3A complet | PASS — 18 verificări |
| Cicluri Web | PASS — 158 fișiere, 0 cicluri |
| Cicluri API | PASS — 81 fișiere, 0 cicluri |
| Regresie API completă | PASS — 19 suite, 99 teste |
| TypeScript/API Build | PASS |
| Web Build | PASS — 176 module |
| Browser E6.3 | PASS |
| Browser E6.4–E6.6 | PASS |
| Android `testDebugUnitTest` | BUILD SUCCESSFUL — 53 task-uri |

Build-ul Web continuă să emită avertismentul Vite istoric pentru depășirea
pragului implicit de 500 kB. Pragul și configurația nu au fost modificate și
nu s-a aplicat nicio optimizare în SR-08D. Dimensiunea observată a chunk-ului
este 525,82 kB necomprimat.

## Inventar APK și protecții

Inventarul celor cinci APK-uri este identic înainte și după testele unitare:

- patru copii de 7.604.172 bytes, SHA-256
  `C270161B6639ACA61534DF5C86F03ED0038F02B86EB9C08926C96B31A8D943F5`,
  timestamp UTC `2026-07-26T23:29:26.4199988Z`;
- un `app-debug.apk` de 22.277.627 bytes, SHA-256
  `38629C244D223673F8E512A96877529053690E8713F3DDC6D0AA54B691AD4ABF`,
  timestamp UTC `2026-07-29T09:24:37.4221765Z`.

Confirmări:

- `assembleDebug` nu a fost executat;
- nu a fost generat, instalat sau livrat niciun APK;
- telefonul nu a fost accesat sau modificat;
- versiunea Android existentă a rămas instalată;
- API-ul public, DTO-urile și schema Prisma sunt nemodificate;
- Diagnostics este nemodificat; pluginul păstrează SHA-256
  `258B4A0458D93A4737A448650A8F42388FDC3E677A62D83B113994215CCB9D7B`;
- registrul materialelor concursului păstrează SHA-256
  `F19A40918D3146687F4B7DD6B722626D568224D244525EF960D8056FBEBD5E1D`;
- producția și infrastructura nu au fost accesate sau modificate;
- Diagnostics rămâne obligatoriu în viitorul Final SR-06 Validation Candidate;
- SR-06 rămâne ON HOLD — Pending Final Device Validation.

## Rollback

Rollback-ul este local și nu necesită migrare de date:

1. se restaurează cele cinci inițializări OCR în obiectul legacy din `main.ts`;
2. se elimină atașarea fațadei OCR și parametrul `ocrState` transmis
   controllerului;
3. controllerul revine la starea legacy prin fallback-ul caracterizat;
4. se elimină store-ul și scutul SR-08D.

Cheile și conținutul storage nu necesită rollback. Nu este necesară nicio
operație Android sau pe dispozitiv.

## Verdict și stare

**SR-08D — CLOSED / PASS.**

Stare operațională:

- SR-08A–D — CLOSED / PASS;
- SR-09 — CLOSED / PASS;
- SR-06 — ON HOLD / Pending Final Device Validation;
- programul structural general — OPEN.

Incident nu a fost început. Orice increment ulterior și orice etapă SR-10–14
necesită mandat operațional separat.
