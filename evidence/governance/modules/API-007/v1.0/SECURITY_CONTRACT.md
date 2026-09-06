# API-007 — Contract de securitate v2

- Contract: `turn-admin.v2`;
- scope JWT obligatoriu: `turn-admin`;
- access token: JWT cu durată fixă de 900 secunde în Production;
- refresh session: token opac aleatoriu, valabil maximum 30 zile, stocat în server numai ca SHA-256;
- refresh token transportat exclusiv în cookie host-only `agm_turn_refresh`, `Secure`, `HttpOnly`, `SameSite=None`, path `/api/v1/turn-admin`;
- clientul trimite cookie-ul numai cu `credentials: include`; access tokenul rămâne numai în `sessionStorage` și nu este persistent în `localStorage`;
- fiecare refresh reușit rotește tokenul, invalidează imediat tokenul de refresh și access tokenul anterior și păstrează aceeași familie de sesiune;
- un refresh concurent al tokenului anterior în fereastra de grație de 5 secunde primește conflict retriabil și nu revocă familia;
- reutilizarea reală în afara ferestrei de grație revocă întreaga familie și este auditată ca `refresh-reuse`;
- toleranță maximă pentru clock skew negativ: 30 secunde; expirarea nu este extinsă prin skew;
- logout explicit și schimbarea PIN-ului revocă sesiunea/familiile aplicabile;
- refresh expirat, revocat sau reutilizat nu poate emite un access token nou;
- Web coordonează refresh-ul concurent în același context și între contexte, apoi reîncearcă o singură dată cererea protejată;
- reload/redeschidere restaurează sesiunea prin cookie, fără PIN/login manual cât timp refresh session este validă;
- prag tentative eșuate: 5;
- blocare: 15 minute;
- throttling unlock/PIN: 5 cereri / 60 secunde, blocare 60 secunde;
- throttling refresh: 30 cereri / 60 secunde, blocare 10 secunde;
- PIN stocat exclusiv ca hash bcrypt;
- schimbarea PIN-ului necesită sesiune validă și PIN curent valid;
- audit: `unlock | refresh | logout | validate | change-pin` × `allowed | denied | locked`;
- interzis în audit: PIN, token, hash, secret JWT, authorization header.

## Eșec de autentificare

- un eșec terminal de refresh este raportat explicit ca `AUTH/SESSION FAILURE`;
- un eșec tranzitoriu de rețea, 5xx sau 429 păstrează ultima stare operațională și este reîncercat automat;
- expirarea sau eșecul sesiunii Product Owner nu poate produce ori deduce `DEGRADED/FAIL` pentru agenți sau servicii;
- formularul de PIN poate reapărea numai după logout explicit, refresh expirat/revocat, schimbare de credentiale sau eveniment real de securitate.

## NO-GO

- scope lipsă sau incorect;
- acces cu access token expirat sau invalidat prin rotație;
- refresh fără rotație, fără invalidarea tokenului anterior sau fără reuse detection;
- buclă de PIN/login cât timp refresh session este validă;
- `DATA UNAVAILABLE` ori degradare operațională dedusă din expirarea sesiunii Product Owner;
- depășirea pragului fără blocare;
- orice secret sau credential în log;
- schimbarea PIN-ului fără verificarea sesiunii și a PIN-ului curent;
- modificarea Production fără mandat separat.

