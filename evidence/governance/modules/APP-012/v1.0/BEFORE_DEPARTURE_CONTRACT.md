# APP-012 — Contract Înainte de plecare v1

## Ciclul UI

`NOT_STARTED → CONTEXT_SELECTION → IN_PROGRESS ↔ NEEDS_ATTENTION/BLOCKED → READY_TO_CONFIRM → CONFIRMED → CLOSED`

## Invariante

- contextul determină lista verificărilor aplicabile;
- un răspuns problemă deschide o problemă urmărită;
- problemele critice pot bloca plecarea;
- confirmarea este interzisă cu verificări incomplete sau probleme deschise;
- confirmarea cere actor, timestamp și declarația `pre-departure-confirmation-v1`;
- răspunsurile sunt blocate după CONFIRMED;
- închiderea este permisă numai după CONFIRMED;
- raportul se generează numai pentru CONFIRMED/CLOSED fără probleme deschise;
- raportul conține digest SHA-256 verificabil;
- starea locală supraviețuiește reload/offline și sincronizarea păstrează idempotency.

## Failure și recovery

Datele locale invalide nu sunt restaurate ca sesiune validă. Failure de rețea păstrează operația pending. Conflictul rămâne explicit. Recovery online folosește APP-014 și contractul API-005.

## NO-GO

- confirmare incompletă sau cu problemă deschisă;
- închidere fără confirmare explicită;
- raport final neverificabil;
- pierdere de stare la offline/reload;
- suprascriere automată a unui conflict;
- modificarea datelor Production ori introducerea telemetriei fără mandat.

