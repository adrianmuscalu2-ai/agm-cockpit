# AGM Basic — Raport de validare integrală

**Versiune:** 1.3.0  
**Data:** 2026-08-02  
**Verdict general:** `PASS FINAL`

## Sincronizarea stărilor

| Modul | Stare canonică | Stare UI după remediere | Verdict |
|---|---|---|---|
| OCR Documente / Arhivă | published / activ | Validat · Deschide | PASS automatizat |
| Legislație | 5 pachete publicate | Validat · Deschide | PASS |
| Martori de bord v0.1.3 | published | Validat · Deschide | PASS |
| Tahograf v0.1.1 | published | Validat · Deschide | PASS |
| Ancorarea mărfii v0.1.1 | published | Validat · Deschide | PASS |

Neconformitatea prin care Legislație, Martori și Tahograf apăreau `Planificat` a fost închisă. Ancorarea mărfii a fost adăugată hub-ului Basic. Toate deschid centrul Knowledge publicat; funcția Premium Load Safety rămâne separată.

## Fluxuri

| Flux | Verdict | Dovadă |
|---|---|---|
| Browser practic — Basic | PASS | Capturi Owner: OCR, Legislație, Martori în bord, Tahograf și Ancorarea mărfii afișează `Validat · Deschide`. |
| Android practic — navigare și conținut | PASS | SM-S931B autorizat prin ADB; APK 1.3.0 actualizat; `/basic`, `/ocr`, `/translator`, `/email`, `/legal` și editarea Traducătorului validate în WebView real. |
| Android practic — OCR complet | PASS | cameră 87%; text editabil; salvare explicită; reload; redeschidere; transfer Traducător; ștergere individuală și persistentă. |
| Android practic — Email share extern | PASS OWNER | fluxul a fost verificat și confirmat de Owner; fără trimitere neautorizată. |
| Android static/baseline | PASS | MC-3A Android static baseline; product-surface sync. |
| OCR și Arhivă OCR | PASS automatizat | E2E logic, restart, offline, ștergere, migrare, repository și privacy. |
| Traducător | PASS automatizat | SR-07A și SR-08A. |
| Email Assistant | PASS automatizat | SR-07B, SR-08B și outbox SR-10. |
| Knowledge | PASS | Publication Gate; toate cele 5 pachete publicabile. |
| Navigare și regresii | PASS automatizat | MC-3A, SR-03, boundaries, import cycles și suitele SR. |
| Premium Load Safety | PASS automatizat | PRE-007, API-008, safety tests și `recommendedCount = null`. |
| Build Web/API | PASS | AGM Web 1.3.0 și Nest API build. |
| Performanță build | PASS cu observație | build stabil; chunk principal 619.91 kB peste pragul informativ de 500 kB, urmărit separat. |
| `git diff --check` | PASS | fără erori whitespace; numai avertismente LF/CRLF. |

## Fișiere modificate în această validare

- `apps/web/src/main.ts` — stările și accesul modulelor Basic sincronizate;
- `apps/web/scripts/test-legal-knowledge-publication-gate.ts` — contract pentru stările hub-ului;
- `evidence/governance/AGM_BASIC_INTEGRAL_VALIDATION_REPORT_2026-08-02.md` — prezentul raport.

Modificările anterioare Knowledge, OCR, Android și Load Safety rămân în workspace și nu au fost anulate.

## Închidere

- Browser Basic și sincronizarea stărilor: PASS Owner;
- Android real, navigare și OCR integral: PASS;
- Email extern: PASS Owner;
- persistență/restart/offline OCR: PASS practic și automatizat;
- regresii și build-uri finale: PASS;
- avertismentul de dimensiune chunk rămâne acțiune separată, fără impact asupra verdictului.

## Dovezi Android suplimentare

- dispozitiv: Samsung SM-S931B, autorizat;
- pachet activ: `com.agm.cockpit`, `versionName 1.3.0`, `versionCode 16`;
- APK curent: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`;
- instalare `adb install -r`: PASS, datele păstrate;
- verificare DOM real prin WebView debugging: toate rutele și titlurile cerute PASS;
- sincronizarea stărilor Basic după instalare: PASS.
- OCR real: captură 87%, editare, salvare, restart logic/reload, redeschidere, transfer și ștergere persistentă PASS;
- documentul temporar de test a fost șters complet după validare.
