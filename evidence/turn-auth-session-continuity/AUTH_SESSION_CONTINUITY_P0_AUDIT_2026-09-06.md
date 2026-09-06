# P0 — TURN Auth Session Continuity audit

Data: 2026-09-06

Revision de bază investigată: `69f0d7097e92976d3cccf0260318ae62cdef2e26`

Stare: remediere locală verificată; Production și matricea fizică Android/rețea sunt încă nevalidate.

## Verdict executiv

Ruptura raportată este confirmată. Implementarea Production investigată folosea un JWT TURN fix de 900 secunde, fără endpoint de refresh, cookie de refresh, session store, rotation, revocation sau reuse detection. Consumatorii operaționali introduși în schimbarea `a65bbec` foloseau direct `fetch` cu acel bearer; după expirare, răspunsul 401 era convertit de UI în `DATA UNAVAILABLE`.

Candidate-ul local implementează fluxul obligatoriu:

`LOGIN → ACCESS TOKEN LIMITAT → SILENT REFRESH → ACCESS TOKEN NOU → REFRESH TOKEN ROTIT → SESIUNE CONTINUĂ`

Testul Browser controlat final a trecut 30,439 minute cu expirarea access tokenului forțată la fiecare 2 secunde: 97 cicluri, 10 reload-uri, 4 redeschideri, 143 refresh-uri HTTP 201, zero failures, zero reuse fals și zero 429. Acesta este PASS local pe candidate, nu PASS Production.

## Ruptura exactă

1. API-007 `turn-admin.v1` emitea numai access JWT cu TTL 900 secunde. După expirare nu exista nicio cale de reînnoire transparentă.
2. Schimbarea `a65bbec` din 2026-09-05 a mutat dashboard-ul operațional la bearer-ul TURN și la apeluri directe, în afara clientului canonic cu reînnoire.
3. Tratarea generică a 401 a mascat cauza de autentificare sub `DATA UNAVAILABLE` și permitea interpretări operaționale false.
4. În API-002 exista separat o cursă latentă introdusă odată cu rotația din `1bdbfd9`: două refresh-uri concurente puteau face ca al doilea consumator al tokenului vechi să revoce greșit întreaga familie.
5. Prima probă controlată a candidate-ului a expus și o limitare de configurație: refresh-ul moștenea throttle-ul PIN de 5/minut și producea 429 în utilizare legitimă. Refresh-ul are acum propria limită de 30/minut și coordonare client-side.

## Remediere implementată

- refresh token opac de 48 bytes, persistat numai ca SHA-256, familie și generație în session store;
- rotație atomică, invalidarea imediată a access/refresh anterior, revocare de familie și reuse detection;
- conflict concurent în fereastra de 5 secunde este retriabil și nu declanșează reuse fals;
- access JWT legat de `sessionId`, familie și generație; tokenul anterior este respins imediat după rotație;
- cookie host-only `agm_turn_refresh`: `Secure`, `HttpOnly`, `SameSite=None`, path `/api/v1/turn-admin`, maximum 30 zile; fără `Domain` explicit;
- toate apelurile refresh folosesc `credentials: include`;
- access token numai în `sessionStorage`; vechiul bearer persistent din `localStorage` este eliminat;
- coalescing pentru refresh concurent, Web Locks și BroadcastChannel între contexte, plus retry pentru conflict 409;
- restore silențios după reload/redeschidere;
- eșecul terminal devine explicit `AUTH/SESSION FAILURE`; 5xx/429/network păstrează starea și pornesc retry automat;
- expirarea auth nu schimbă starea agenților/serviciilor și nu produce `DATA UNAVAILABLE` în Premium Drill-down;
- logout și schimbarea PIN-ului revocă sesiunile conform contractului.

## Verificare

| Criteriu | Candidate local | Dovadă |
|---|---:|---|
| TOKEN ROTATION | PASS | 97 cicluri; 143 refresh 201 |
| SILENT REFRESH | PASS | expirare forțată la 2 secunde, fără intervenție |
| SESSION CONTINUITY | PASS | 30,439 minute, zero failures |
| RELOAD CONTINUITY | PASS | 10/10 |
| REOPEN CONTINUITY | PASS | 4/4 |
| PREMIUM DRILL-DOWN AFTER TOKEN EXPIRY | PASS | verificat în fiecare ciclu |
| NO MANUAL PIN/LOGIN LOOP | PASS | 0 cicluri manuale după unlock |
| NO FALSE AGENT DEGRADATION | PASS | snapshotul operațional nu este rescris de auth |
| PREVIOUS ACCESS INVALIDATION | PASS | vechiul bearer primește 401 după rotație |
| REFRESH COOKIE CONTRACT | PASS | Secure/HttpOnly/SameSite/host-only/path verificate |
| REUSE DETECTION / REVOCATION | PASS | teste API unitare/integrare |

Raport final: `browser/2026-09-06T07-15-03-452Z/report.json`

SHA-256: `E90EEACFC258EBFC2CF5D3025F666362F875FED767C30F297C35B0C4D8AF9C88`

Rezumat Browser obligatoriu:

- Browser Plugin Status: `PASS`;
- Integrated Browser Control Status: `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE`;
- Browser Session Status: `PASS` prin runnerul controlat AGM Playwright/Chromium;
- Target Page Status: `PASS`.

Suite locale: Web build PASS; API build PASS; testul comportamental Web de continuitate PASS; testele TURN operational truth și functional overview PASS; 4 suite API / 35 teste PASS. Două suite largi au eșecuri de baseline fără legătură cu această modificare: textul vechi HOLD versus starea curentă STANDBY/CONTEXT_MISMATCH și eticheta veche `Pre-Departure`.

## Limite și verdict de release

- Production web: `PENDING` — nu s-a efectuat deploy și nu s-au folosit credentiale Production fără mandat separat.
- Android/PWA fizic: `PENDING` — contractul static WebView acceptă/persistă cookies și folosește HTTPS, dar sesiunea ADB nu a fost disponibilă pentru probă fizică.
- Wi-Fi și date mobile: `PENDING` — necesită dispozitiv/conectivitate reală și validare după deploy.

Prin urmare:

- `TOKEN ROTATION = CANDIDATE PASS / PRODUCTION PENDING`
- `AUTH SESSION CONTINUITY = FAIL` în verdictul de Production până la deploy și validarea matricei cerute
- `PRODUCT OWNER ACCEPTANCE = NOT GRANTED`
- `FINAL PASS = NOT GRANTED`
