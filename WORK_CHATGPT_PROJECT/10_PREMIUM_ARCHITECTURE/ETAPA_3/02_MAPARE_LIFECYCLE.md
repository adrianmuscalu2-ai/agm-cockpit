# Livrabil 2 — Maparea Premium Lifecycle – TransportJob

Versiune: `premium-transportjob-map.v1`
Implementare: `lifecycle-map.ts`

| Premium | TransportJob acceptat | Preferat | Relație |
|---|---|---|---|
| DRAFT | imported, accepted | imported | compatible |
| PRE_DEPARTURE_IN_PROGRESS | accepted, at_pickup | at_pickup | compatible |
| READY_WITH_WARNINGS | at_pickup | at_pickup | requires-business-action |
| READY_CONFIRMED | at_pickup | at_pickup | requires-business-action |
| TRIP_ACTIVE | pickup_completed, in_transport | in_transport | compatible |
| ARRIVAL_RECORDED | at_delivery | at_delivery | compatible |
| POST_TRIP_IN_PROGRESS | delivery_completed, documents_submitted | documents_submitted | compatible |
| COMPLETED | closed | closed | requires-business-action |
| ARCHIVED | archived | archived | exact |

Maparea nu execută automat acțiuni TransportJob. Relațiile
`requires-business-action` cer adaptor backend și autorizare. Normalizarea acceptă
cod, display name camelCase, spațiu sau cratimă, dar compară cu codurile reale din
seed.
