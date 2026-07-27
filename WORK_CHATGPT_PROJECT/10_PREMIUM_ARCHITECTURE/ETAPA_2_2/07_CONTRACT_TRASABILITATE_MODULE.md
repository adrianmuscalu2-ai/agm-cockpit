# Livrabil 7 — Contractul de trasabilitate între module

## Obligația fiecărui modul

Fiecare comandă de modul:

1. primește `TripContext`, actor și `operationId`;
2. validează permisiunea și versiunea agregatului;
3. produce zero sau mai multe evenimente canonice;
4. returnează noile versiuni și starea sync;
5. nu scrie într-un jurnal propriu;
6. publică ID-urile warnings/incidente/dovezi transferate;
7. nu confirmă automat acțiuni critice.

## Matrice

| Modul | Evenimente principale | Consumatori autorizați |
|---|---|---|
| Înainte de plecare | check, issue, readiness, confirmation | vehicul, load safety, orchestrator |
| Vehicul/documente | document/check/warning | readiness, OCR, raport |
| Ladungssicherung | evidence, assessment, warning, confirmation | readiness, traseu, raport |
| Tahograf/legislație | limit evaluated, warning | orchestrator, traseu, raport |
| Traducere/comunicare | translation prepared/reviewed/sent | document, incident, raport |
| OCR/documente | media attached, OCR proposed/reviewed | toate modulele autorizate |
| Asistență traseu | event, incident, escalation | post-trip, raport |
| După cursă | handoff received, item disposed | raport/arhivare |
| Raport/arhivare | report generated, archive sealed | istoric/audit |
| Istoric/incidente | projection rebuilt, export generated | read-only autorizat |

## Causalitate

- `correlationId` leagă un flux/caz de utilizare.
- `causationId` indică evenimentul direct anterior.
- `operationId` deduplică o comandă.
- `evidenceRefs` leagă documente/fotografii.
- `confirmationId`, `warningId` și `incidentId` sunt referințe, nu text duplicat.

Transferul între etape produce un eveniment `handoff.created` și un
`handoff.received`; lipsa celui de-al doilea păstrează elementul deschis.
