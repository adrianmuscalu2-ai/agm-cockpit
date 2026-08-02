# Plan de implementare

## Etapa A — Contracte fără activare

- contract comun pentru entitlement și capability;
- validare strictă și reguli fail-closed;
- teste unitare API/Web;
- fără DB și fără schimbarea rutelor active.

## Etapa B — Access Gateway Web

- rută `/access` distinctă;
- ecran cu starea contului și acțiuni explicite;
- butoane separate `AGM Basic` și `AGM Premium`;
- Premium rămâne controlat prin feature flag local dezactivat.

## Etapa C — API read-only

- endpoint autentificat pentru snapshot;
- derivare inițială din configurație/roluri aprobate, fără plăți;
- audit al deciziei fără date sensibile;
- rate limiting și monitorizare.

## Etapa D — Enforcement

- gate pe fiecare rută Premium;
- verificare capability per modul;
- expirare/revalidare și recovery;
- regresie Browser și Android.

## Etapa E — Comercial, separat și ulterior

- model de abonament, billing și administrare;
- migrare DB și integrarea unui furnizor de plată;
- mandat, analiză de securitate și deployment distincte.

## Ordinea testării

1. contract și validare;
2. matrice tier/status/capability;
3. acces direct prin URL;
4. API indisponibil și token expirat;
5. Basic neafectat;
6. Browser și Android;
7. Inspector și validare utilizator.
