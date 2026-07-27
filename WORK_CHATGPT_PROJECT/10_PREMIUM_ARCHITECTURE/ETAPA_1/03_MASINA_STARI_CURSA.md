# Livrabil 3 — Mașina de stări a cursei

## Stări principale

`DRAFT → PRE_DEPARTURE_IN_PROGRESS → READY_WITH_WARNINGS | READY_CONFIRMED → TRIP_ACTIVE → ARRIVAL_RECORDED → POST_TRIP_IN_PROGRESS → COMPLETED → ARCHIVED`

## Evenimente canonice

| Comandă | Din | Către | Confirmare umană |
|---|---|---|---|
| `startPreDeparture` | DRAFT | PRE_DEPARTURE_IN_PROGRESS | nu |
| `confirmReady` | PRE_DEPARTURE_IN_PROGRESS | READY_CONFIRMED | da |
| `acceptWarningsAndReady` | PRE_DEPARTURE_IN_PROGRESS | READY_WITH_WARNINGS | da, cu lista avertismentelor |
| `startTrip` | READY_* | TRIP_ACTIVE | da |
| `recordArrival` | TRIP_ACTIVE | ARRIVAL_RECORDED | da |
| `startPostTrip` | ARRIVAL_RECORDED | POST_TRIP_IN_PROGRESS | nu |
| `completeTrip` | POST_TRIP_IN_PROGRESS | COMPLETED | da |
| `archiveTrip` | COMPLETED | ARCHIVED | autorizare operațională |

## Invariante

- O cursă are exact o stare principală.
- `ARCHIVED` este terminală și read-only.
- O tranziție invalidă este respinsă și auditată.
- Confirmările critice nu sunt implicite, simulate sau generate de AI.
- Orice comandă folosește `expectedVersion` și `operationId`.
- `BLOCKED` și `RECOVERY_REQUIRED` opresc comenzile ireversibile.
- `SYNC_PENDING` oprește arhivarea.

## Mapare obligatorie cu backendul existent

Backendul folosește astăzi stările `Imported`, `Accepted`, `AtPickup`,
`PickupCompleted`, `InTransport`, `AtDelivery`, `DeliveryCompleted`,
`DocumentsSubmitted`, `Paid`, `Closed`, `Archived`.

Acestea nu sunt identice cu stările Premium. Implementarea va introduce o mapare
versionată și auditată; nu va redenumi sau reutiliza semantic stările backendului.
Până la aprobarea mapării, nu se conectează mașina Premium la `TransportJob`.
