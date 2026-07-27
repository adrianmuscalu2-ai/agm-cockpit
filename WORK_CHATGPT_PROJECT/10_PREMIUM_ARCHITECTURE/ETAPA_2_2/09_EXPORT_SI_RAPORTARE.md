# Livrabil 9 — Regulile de export și raportare

## Tipuri de export

| Export | Conținut | Format recomandat |
|---|---|---|
| Trip Summary | stare, timeline, warnings, incidente, confirmări | PDF + JSON manifest |
| Full Audit | toate evenimentele autorizate și integrity metadata | NDJSON/JSON + manifest |
| Evidence Manifest | metadate, hashuri și referințe | JSON/CSV |
| Incident Package | timeline și dovezi aferente | ZIP sigilat + manifest |
| Sync Recovery Package | outbox, ack, conflict, hashuri | JSON criptat |
| Legal/DSAR scoped | numai câmpurile autorizate | format aprobat de Legal |

## Reguli

- exportul nu este sursă canonică;
- fiecare export are `exportId`, versiune, filtru, actor, scop și timp;
- se aplică autorizarea și minimizarea înainte de generare;
- se includ schema, timezone, locale și explicația câmpurilor;
- manifestul conține SHA-256 pentru fiecare artefact;
- exporturile sensibile sunt criptate și au expirare controlată;
- generarea, descărcarea și revocarea sunt evenimente L9;
- fișierele lipsă sunt declarate explicit, nu omise silențios;
- traducerile sunt etichetate; originalul rămâne disponibil conform accesului.

## Raportul final al cursei

Raportul final include:

- identitatea și versiunea cursei;
- lifecycle și timeline;
- lista confirmărilor critice;
- checks/warnings/incidente și dispoziții;
- dovezi și hashuri;
- indicatorul de sincronizare și integritate;
- versiunea regulilor/AI folosite;
- semnătura/confirmarea de închidere.

Orice regenerare produce versiune și eveniment nou; raportul anterior nu este
suprascris.
