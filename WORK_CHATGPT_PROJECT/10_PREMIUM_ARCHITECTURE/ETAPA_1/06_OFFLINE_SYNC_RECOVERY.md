# Livrabil 6 — Online, offline, sincronizare și recuperare

## Detectare

Conectivitatea se verifică prin probe reale fără cache. `navigator.onLine` este
doar indiciu, nu dovadă. Stările sunt:

- verde: probă funcțională confirmată;
- galben: probă în curs sau lentă;
- roșu: timeout, răspuns invalid sau indisponibilitate.

## Salvare locală

Operația locală este scrisă atomic împreună cu intrarea outbox. Rezultatul UI
devine „salvat local”, nu „sincronizat”. Datele sensibile sunt criptate folosind
stocarea sigură a platformei.

## Sincronizare

1. citește outbox-ul în ordine;
2. trimite `operationId` și `expectedVersion`;
3. serverul deduplică;
4. confirmarea actualizează versiunea locală;
5. intrarea este eliminată numai după confirmare;
6. `SYNC_PENDING` dispare când nu mai există operații relevante.

## Conflict și recuperare

Conflictele de câmpuri necritice pot avea merge determinist. Conflictele de
stare, identitate, confirmare, document sau incident activează
`RECOVERY_REQUIRED`. Utilizatorul vede diferențele și rezoluția este auditată.

La pornire, resume, reconectare și upgrade se verifică schema, jurnalul, outbox-ul,
hashurile și ultima versiune server. Recuperarea nu șterge și nu finalizează
automat cursa.

## Resetare

`resetView` curăță numai controalele tranzitorii. `abandonDraft`,
`cancelActiveTrip` și `deleteLocalReplica` sunt comenzi separate, autorizate și
confirmate. Ultima este interzisă când există date nesincronizate.
