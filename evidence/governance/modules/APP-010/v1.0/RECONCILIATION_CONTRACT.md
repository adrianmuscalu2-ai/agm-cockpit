# APP-010 — Contract de reconciliere v1

- Contract: `incident-journal-reconciliation.v1`;
- autoritate remote: API-006;
- cheia identității: `incident.id`;
- conflict temporal: câștigă `updatedAt` cel mai nou;
- istoricul local și remote este reunit și ordonat;
- incidentele noi remote sunt importate;
- validarea sau arhivarea remote fără aprobare locală este convertită în `ready-test`;
- fiecare conversie produce eveniment `reconciliation-held` în istoric;
- persistența este executată numai când există importuri sau actualizări;
- reconcilierea nu șterge incidente locale.

## NO-GO

- trecere remote automată la `validated` sau `archived`;
- suprascrierea unei versiuni locale mai noi;
- pierderea istoricului;
- incident fără identitate;
- contactarea Production sau schimbarea API-006 fără mandat separat.

