# PRE-008 — Contract TripContext v1.0

1. Există cel mult un TripContext activ în repository-ul local.
2. Orice schimbare aplicată incrementează `contextVersion` și produce un eveniment corelat.
3. Tranzițiile operaționale critice necesită confirmare umană explicită.
4. `BLOCKED` împiedică start, complete și archive; `RECOVERY_REQUIRED` împiedică tranzițiile lifecycle.
5. `SYNC_PENDING` împiedică arhivarea.
6. Salvarea folosește optimistic concurrency și respinge versiunea divergentă.
7. Outbox-ul este idempotent după `eventId`.
8. Recovery acceptă numai un lanț unic, consecutiv și concordant cu snapshot-ul.
9. Resetarea UI Pre-Departure nu șterge contextul operațional activ.
10. Maparea TransportJob este versionată și nu execută automat acțiuni de business.

**Criteriu PASS:** lifecycle, confirmări, event chain, repository, outbox, recovery și integrări fără regresii.

**HOLD/NO-GO:** event chain alterat, context divergent, tranziție fără confirmare, conflict de versiune ori mutație Production.

