# API-005 — Contract Pre-departure & Sync v1

**Contract payload:** `1.0.0`

## Invariante payload

- limbile acceptate: ro, de, en;
- contexte și check-uri provin numai din registrele contractului;
- check-urile sunt unice și aplicabile contextelor selectate;
- `problem` necesită notă, iar `not-applicable` necesită motiv;
- READY_TO_CONFIRM, CONFIRMED și CLOSED cer verificări complete fără probleme;
- CONFIRMED/CLOSED cer `confirmedAt`; CLOSED cere `closedAt`.

## Sync

- create este idempotent numai când ambele chei identifică aceeași sesiune;
- coliziunile parțiale sunt respinse cu 409;
- `clientSessionId` și `idempotencyKey` sunt imuabile după creare;
- update acceptă numai revizia server așteptată;
- revendicarea reviziei este atomică și precede înlocuirea răspunsurilor;
- întregul update rulează într-o tranzacție;
- transportul asociat trebuie să aparțină tenantului autentificat.

## Recovery

La conflict, clientul recitește resursa, reconciliază schimbările și reîncearcă folosind noul `serverRevision`. Serverul nu suprascrie silențios o revizie mai nouă.

## NO-GO

- acceptarea payload-ului incompatibil cu versiunea sau starea;
- reutilizarea contradictorie a unei chei idempotente;
- lost update prin verificare neatomică a reviziei;
- acces sau asociere cross-tenant;
- ștergerea răspunsurilor în afara tranzacției;
- migrare/deployment Production fără mandat OPS-004.

