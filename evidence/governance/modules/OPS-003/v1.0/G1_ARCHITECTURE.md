# OPS-003 — Arhitectura G1

## Contract

`agm-monitoring-event.v1` definește pentru fiecare eveniment: identitate, incident corelat, tip failure/recovery, moment, monitor MON, check/componentă, mediu, clasificare, severitate, rezultat observat și acțiune recomandată.

## Flux

Health check → prag de failure → eveniment + alertă deduplicată → Incident Journal → recovery corelat → ready-test → validare umană → închidere.

## Criterii PASS

- MON-001…012 sunt complete și au surse declarate unde există;
- primul eșec nu produce incident prematur;
- atingerea pragului produce o singură alertă și un incidentId;
- eșecurile repetate sunt deduplicate;
- recovery reutilizează incidentId și nu închide automat incidentul;
- evenimentul răspunde la ce/când/componentă/acțiune;
- nu sunt stocate secrete, corpuri HTTP sau date personale;
- nicio acțiune de remediere nu este executată automat;
- OPS-005 rămâne neimplementat și separat.

## NO-GO

Incident fără corelare, recovery care închide automat, alert storm, monitor atribuit greșit, colectare sensibilă, restart automat sau introducerea telemetriei continue.
