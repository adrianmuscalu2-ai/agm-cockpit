# API-007 — Contract de securitate v1

- Contract: `turn-admin.v1`;
- scope JWT obligatoriu: `turn-admin`;
- durată sesiune: 900 secunde;
- prag tentative eșuate: 5;
- blocare: 15 minute;
- throttling controller: 5 cereri / 60 secunde, blocare 60 secunde;
- PIN stocat exclusiv ca hash bcrypt;
- schimbarea PIN-ului necesită sesiune validă și PIN curent valid;
- audit: `unlock | validate | change-pin` × `allowed | denied | locked`;
- interzis în audit: PIN, token, hash, secret JWT, authorization header.

## NO-GO

- scope lipsă sau incorect;
- acces după expirarea sesiunii;
- depășirea pragului fără blocare;
- orice secret sau credential în log;
- schimbarea PIN-ului fără verificarea sesiunii și a PIN-ului curent;
- modificarea Production fără mandat separat.

