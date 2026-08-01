# APP-014 — Contract Common Outbox v1

**Contract:** `common-outbox.v1`

## Stări

`pending → syncing → acknowledged` pentru succes; failure revine controlat la `pending`, iar conflictul trece în `conflict` și necesită rezoluție explicită.

Rezoluții conflict:

- `retry-local` → pending;
- `accept-remote` → acknowledged cu receipt;
- `manual` → rămâne conflict până la decizie.

## Invariante

- cheia idempotentă nu se schimbă la retry;
- același idempotency key nu poate desemna owner, operație, record, stream, sequence sau payload diferit;
- ordinea este deterministă: queuePosition, sequence, queuedAt, recordId;
- receipt-ul trebuie să corespundă exact `operationId`;
- acknowledged nu poate fi retried sau mutat ulterior în conflict;
- conflict nu folosește retry generic, ci numai procedura de rezoluție;
- adaptorul pre-departure păstrează idempotency key-ul API-005;
- adaptorul operational păstrează stream-ul trip și device sequence.

## Failure și recovery

Offline sau eroare tranzitorie păstrează operația local și incrementează attempts. Conflictul nu este suprascris automat. Recovery reia numai operațiile eligibile și păstrează identitatea și ordinea.

## NO-GO

- pierderea sau schimbarea identității la retry;
- deduplicare a payload-urilor incompatibile;
- acknowledgement pentru alt operationId;
- reactivarea unei operații acknowledged;
- eliminarea automată a conflictului fără strategie explicită;
- transmitere Production sau telemetrie nouă fără mandat.

