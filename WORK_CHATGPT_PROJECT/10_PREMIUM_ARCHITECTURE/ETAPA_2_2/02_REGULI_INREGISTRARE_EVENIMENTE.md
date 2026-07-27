# Livrabil 2 — Regulile de înregistrare a evenimentelor

## Evenimente obligatorii

Se înregistrează:

- crearea/selectarea/abandonarea controlată a cursei;
- orice tranziție lifecycle acceptată sau respinsă;
- confirmările critice și revocările/corecțiile lor;
- răspunsurile la verificări și schimbările de severitate;
- warnings, incidente, transferuri și dispoziții;
- atașarea, verificarea și eliminarea autorizată a dovezilor;
- OCR, traducere și analiză AI cu proveniență, versiune și rezultat;
- emiterea/consumul/refuzul unui permit AI;
- salvarea locală, sincronizarea, conflictul și recuperarea;
- exportul, accesul privilegiat, retenția și distrugerea autorizată;
- erorile care afectează integritatea sau continuarea fluxului.

## Reguli

1. Evenimentul este creat în aceeași tranzacție logică cu mutația.
2. Operația fără eveniment obligatoriu eșuează; nu există „audit ulterior”.
3. Clientul offline generează `eventId` și `operationId` înainte de salvare.
4. Retrimiterea păstrează aceiași identificatori.
5. `occurredAt` este timpul acțiunii; `recordedAt` este timpul acceptării.
6. Serverul nu suprascrie timpul dispozitivului; marchează abaterea.
7. Payloadul conține diferența minimă necesară, nu secrete sau copii integrale
   nejustificate.
8. Respingerea unei comenzi produce eveniment sigur, fără date sensibile.
9. AI nu poate produce o confirmare umană.
10. Indicatorii operaționali provin din probe/evenimente reale, nu din constante.

## Convenția eventType

`<domeniu>.<agregat>.<acțiune>.v<versiune>`

Exemple:

- `trip.lifecycle.started.v1`
- `trip.lifecycle.transition-rejected.v1`
- `vehicle.check.confirmed.v1`
- `load-safety.warning.opened.v1`
- `document.ocr.reviewed.v1`
- `sync.operation.conflicted.v1`
- `archive.export.generated.v1`

## Corecții

Nu există UPDATE/DELETE asupra evenimentelor canonice. Se emit
`*.corrected.v1`, `*.revoked.v1` sau `*.redacted.v1`, cu `causationId` către
evenimentul afectat și motiv explicit.
