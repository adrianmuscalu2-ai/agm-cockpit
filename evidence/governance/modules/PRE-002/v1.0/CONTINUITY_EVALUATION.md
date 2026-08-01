# PRE-002 — Evaluare de continuitate

## Baseline protejat

- 4 module AI înregistrate și dezactivate;
- politici versionate, dezactivate și cu retenție `none`;
- kill switch inițial activ;
- niveluri low/moderate/sensitive/prohibited;
- Inspector și confirmare utilizator obligatorii;
- blocarea datelor personale și efectelor externe;
- permise single-use cu issued/consumed/expired/revoked;
- audit fără conținut personal.

## Evoluție incrementală

Permisele au TTL maxim 15 minute și sunt validate pentru aceeași operație, modul și capabilitate. Confirmările sunt acceptate maximum 5 minute pentru a limita replay-ul. Auditul diferențiază blocarea prin kill switch, Inspector și politică.

Nicio funcție AI nu a fost activată sau executată.

