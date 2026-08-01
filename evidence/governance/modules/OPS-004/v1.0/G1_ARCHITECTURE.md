# OPS-004 — Arhitectura G1

## Increment

Se adaugă un test static unificat care detectează deriva dintre configurația production și runbookuri. Nu se rulează comenzi operaționale.

## Criterii PASS

- imaginea Compose este fixată prin SHA-256 și coincide cu runbookul;
- Compose nu conține `build` și nu definește PostgreSQL/volume noi;
- API este expus numai pe `127.0.0.1:3000`;
- rețeaua bazei este externă și are identitatea aprobată;
- env template conține numai placeholders pentru secrete;
- pre-change definește mandat, roluri distincte, STOP și NO-GO automat;
- rollback păstrează volumele/logurile și restaurează un singur origin;
- post-deployment verifică health, migrații, backup și restore;
- deploymentul efectiv rămâne blocat fără mandat separat.

## NO-GO

Digest inconsistent, `build` în production, port API public, bază expusă/duplicată, secret real în template, roluri neatribuite, lipsa fallback/rollback sau checklist incomplet.
