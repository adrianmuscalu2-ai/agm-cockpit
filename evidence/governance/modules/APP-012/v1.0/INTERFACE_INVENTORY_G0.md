# APP-012 — Inventar interfețe G0

## Intrări

- utilizator autentificat și limba RO/DE/EN;
- contexte: local, long-distance, ADR, night și adverse-weather;
- răspunsuri confirmed/problem/not-applicable;
- stare navigator online/offline și persistență locală.

## Ieșiri și consumatori

- API-005: payload pre-departure v1.0.0 și optimistic sync;
- APP-014: operații outbox idempotente;
- Operational Context: handoff versionat și evenimente de continuitate;
- raport final JSON cu digest SHA-256;
- APP-013 consumă continuitatea călătoriei după plecare.

## Comunicare

Offline păstrează sesiunea local fără transmitere. Revenirea online declanșează flush controlat. Conflictul nu este suprascris automat. Resetarea emite eveniment operațional și curăță numai sesiunea locală autorizată.

