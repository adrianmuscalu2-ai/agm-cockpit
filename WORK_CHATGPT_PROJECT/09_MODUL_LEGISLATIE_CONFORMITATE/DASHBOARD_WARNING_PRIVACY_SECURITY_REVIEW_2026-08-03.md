# Dashboard Warning Analysis — Privacy & Security Review

**Data:** 2026-08-03  
**Scope:** primul HOLD rămas după Architecture Amendment  
**Metodă:** audit documentar și static, fără apel provider, fără imagine reală și fără modificare Production  
**Verdict:** `HOLD — CONTROLS/EVIDENCE REQUIRED`

## 1. Rezumat executiv

Infrastructura API-008 oferă un punct de plecare reutilizabil, dar nu demonstrează
încă un flux autorizabil pentru Dashboard Warning Analysis. Uploadul este limitat,
throttled și procesat în memorie, iar apelul providerului are timeout și răspuns
fail-closed. Aceste controale nu acoperă integral validarea fișierului, minimizarea
metadatelor, consimțământul specific, retenția providerului și dovada absenței
imaginii din toate canalele de observabilitate.

HOLD-ul Privacy & Security rămâne deschis. Prezentul review nu autorizează
implementarea Dashboard Warning Analysis și nu schimbă verdictul general `NO-GO`.

## 2. Data-flow constatat

```text
Utilizator
→ selecție explicită File/Camera în client
→ validare client pe MIME declarat și dimensiune
→ preview local prin object URL
→ multipart/form-data către backendul AGM
→ Multer memory storage implicit
→ validare backend pe MIME declarat și limită 8 MB
→ conversie Buffer în data URL base64
→ OpenAI Responses API
→ JSON Schema + post-validare locală
→ răspuns structural către client
```

Nu a fost identificată persistență intenționată a imaginii în fluxul API-008.
Afirmația `storesImages: false` este însă o declarație de contract, nu o dovadă
completă privind proxy-uri, APM, traces, crash dumps, retenția providerului sau
copiile temporare din memorie.

## 3. Controale existente reutilizabile

| Control | Dovadă statică | Stare pentru Dashboard Warning |
|---|---|---|
| Selecție explicită a imaginii | input File/Camera și acțiune manuală Analyze | `PARTIAL PASS` |
| Tipuri acceptate | JPEG, PNG, WEBP în client și controller | `PARTIAL` — numai MIME declarat |
| Dimensiune maximă | 8 MB în client și Multer | `PASS BASELINE` |
| Număr de fișiere | 1 pentru analiză | `PASS BASELINE` |
| Throttling | 10 cereri/minut, blocare 60 secunde | `PASS BASELINE` |
| Timeout provider | 10–90 secunde, implicit 45 secunde | `PASS BASELINE` |
| Secret server-side | `OPENAI_API_KEY` citit numai în backend | `PASS BASELINE` |
| Fail-closed provider indisponibil | răspuns 503/fără rezultat simulat | `PASS BASELINE` |
| Validare răspuns | JSON Schema strict + post-validare | `PASS BASELINE` |
| Persistență aplicație | nu există repository de imagine în API-008 | `PARTIAL — EVIDENCE REQUIRED` |
| Logare eroare provider | status și tip/mesaj scurt de eroare | `PARTIAL — TEST REQUIRED` |

## 4. Gap-uri care mențin HOLD-ul

1. MIME este preluat din upload; nu există verificare magic bytes/signature.
2. Nu există decodare și re-encodare sigură înainte de transferul către provider.
3. Nu există eliminare demonstrată a EXIF, GPS, thumbnail sau altor metadate.
4. Nu există protecție demonstrată contra decompression bombs și fișierelor polyglot.
5. Nu există consimțământ specific și versionat înaintea transferului imaginii către
   backendul AGM și providerul Vision.
6. Nu sunt consemnate identitatea operatorului/procesatorului, regiunile și
   subprocessatorii aplicabili acestui flux.
7. Nu există dovada configurației și retenției providerului pentru mediul real.
8. Nu există teste negative pentru reverse proxy, request logs, APM, traces, crash
   reporting, incident payloads și body capture.
9. Bufferul și referințele temporare nu sunt gestionate printr-un lifecycle explicit;
   nu există dovadă privind eliberarea după succes, timeout sau anulare.
10. Lipsesc reguli aplicabile imaginilor care includ VIN, numere de înmatriculare,
    locații, persoane sau alte date personale surprinse accidental.
11. Throttling-ul existent nu este demonstrat per utilizator și companie și nu există
    o dovadă separată pentru protecția cost-abuse.
12. Clientul loghează obiectul erorii; trebuie demonstrat că niciun strat nu atașează
    requestul, fișierul sau FormData la eroare.

## 5. Threat model minim

| Amenințare | Impact | Control cerut înainte de PASS |
|---|---|---|
| MIME spoofing / polyglot | parser abuse, conținut neașteptat | magic bytes, decoder allowlist, re-encode |
| Decompression bomb | epuizare memorie/CPU | limite pe pixeli și dimensiuni decodate |
| EXIF/GPS/VIN/plăcuță/persoană | divulgare date personale | strip metadata, avertizare și minimizare |
| Interceptare/endpoint greșit | exfiltrare imagine | HTTPS obligatoriu, origin/endpoint controlat |
| Log/APM/body capture | retenție neautorizată | body redaction și teste negative end-to-end |
| Retenție provider | păstrare dincolo de scop | configurație și dovadă contractuală |
| Cost abuse / request flood | indisponibilitate și cost | auth, limite per actor, rate/cost monitoring |
| Timeout/anulare incompletă | buffer/referință rămasă | lifecycle explicit și teste de cleanup |
| Prompt injection vizual | rezultat manipulat | output strict, policy separată, fail-closed |
| Imagine critică ambiguă | recomandare nesigură | fără identificare/severitate fără Vision valid |

## 6. Pachetul minim de dovezi pentru închiderea HOLD-ului

- diagramă data-flow aprobată cu operator, procesator, regiuni și subprocessatori;
- text de consimțământ specific, versionat și testat înainte de transfer;
- validare reală a formatului, limite de pixeli, decodare sigură și re-encoding;
- dovadă automată că EXIF/GPS și metadatele nu părăsesc dispozitivul/backendul;
- configurație provider și document de retenție aplicabil mediului autorizat;
- teste negative care demonstrează absența imaginii/base64 din loguri, APM și traces;
- teste pentru polyglot, fișier trunchiat, decompression bomb și MIME spoofing;
- teste de timeout/anulare și cleanup al referințelor temporare;
- reguli și mesaje pentru VIN, plăcuțe, persoane și locație;
- dovadă de throttling și cost-abuse per actor relevant.

## 7. Decizie

`PRIVACY & SECURITY — HOLD`.

Baseline-ul este suficient pentru proiectarea remedierii, nu pentru autorizarea
implementării. Următorul pas permis este definirea contractului de control și a
testelor de acceptanță Privacy & Security. Activarea funcției rămâne interzisă până
la închiderea tuturor celor trei HOLD-uri stabilite de Owner.

Contractul și matricea au fost definite ulterior în
`DASHBOARD_WARNING_IMAGE_SECURITY_CONTROL_CONTRACT_V0_1.md`. Definirea lor nu
închide HOLD-ul; sunt necesare implementarea controlată și dovezile de execuție.

Primul increment izolat de sanitizare și rezultatele sale sunt consemnate în
`DASHBOARD_WARNING_PRIVACY_SECURITY_REMEDIATION_PROGRESS_2026-08-03.md`. Incrementul
este PASS în scope, însă HOLD-ul general rămâne deschis.
