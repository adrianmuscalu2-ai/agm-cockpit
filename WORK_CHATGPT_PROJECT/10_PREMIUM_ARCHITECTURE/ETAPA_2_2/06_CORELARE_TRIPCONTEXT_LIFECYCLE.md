# Livrabil 6 — Corelarea cu TripContext și lifecycle

## Câmpuri obligatorii

Orice eveniment de cursă conține:

- `tripId`;
- `aggregateId` și `aggregateVersion`;
- `lifecycleState` observată înainte/după, unde se aplică;
- `operationalFlags`;
- actor, device, operation și correlation;
- `transportJobId` numai prin maparea aprobată.

## Evenimente lifecycle

| Stare / tranziție | Eveniment minim |
|---|---|
| DRAFT creat | `trip.lifecycle.draft-created.v1` |
| PRE_DEPARTURE început | `trip.lifecycle.pre-departure-started.v1` |
| READY_WITH_WARNINGS | eveniment + lista ID-urilor warning acceptate |
| READY_CONFIRMED | confirmare critică separată + tranziție |
| TRIP_ACTIVE | confirmare start, timp și versiune |
| ARRIVAL_RECORDED | sosire, sursa timpului/locației |
| POST_TRIP | tranziție și lista de predare |
| COMPLETED | raport final, open-items disposition |
| ARCHIVED | manifest hash, retenție și integrity result |

## Flaguri

Activarea și închiderea `BLOCKED`, `INCIDENT_OPEN`, `SYNC_PENDING`, `OFFLINE` și
`RECOVERY_REQUIRED` emit evenimente distincte. Flagurile nu se deduc exclusiv din
UI.

## Maparea TransportJob

`transportJobId` este referință externă opțională până la închiderea ADR-006.
Evenimentele Premium nu folosesc codurile lifecycle TransportJob ca înlocuitor
pentru `lifecycleState`. Un adaptor versionat publică evenimente de mapare și
respinge ambiguitățile.
