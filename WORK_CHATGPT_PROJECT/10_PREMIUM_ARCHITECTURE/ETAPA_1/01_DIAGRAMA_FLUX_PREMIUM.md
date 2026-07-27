# Livrabil 1 — Diagrama completă a fluxului Premium

```mermaid
flowchart TD
    A[DRAFT] --> B[Înainte de plecare]
    B --> C[Vehicul și documente]
    C --> D[Ladungssicherung]
    D --> E[Tahograf, timpi și legislație]
    E --> F{Poarta de pregătire}
    F -->|fără blocaje| G[READY_CONFIRMED]
    F -->|avertismente acceptate| H[READY_WITH_WARNINGS]
    F -->|problemă critică| X[BLOCKED]
    X --> B
    G --> I[TRIP_ACTIVE]
    H --> I
    I --> J[Traducere și comunicare]
    I --> K[OCR și documente]
    I --> L[Asistență pe traseu]
    J --> M[Evenimente și verificări]
    K --> M
    L --> M
    M -->|incident deschis| N[INCIDENT_OPEN]
    N --> M
    M --> O[ARRIVAL_RECORDED]
    O --> P[POST_TRIP_IN_PROGRESS]
    P --> Q[După cursă]
    Q --> R[Raport final]
    R -->|obligații închise| S[COMPLETED]
    R -->|problemă transferată| Q
    S -->|sync confirmat| T[ARCHIVED]
```

`OFFLINE`, `SYNC_PENDING` și `RECOVERY_REQUIRED` sunt stări operaționale
ortogonale și pot apărea peste orice etapă permisă. `RECOVERY_REQUIRED` blochează
tranzițiile ireversibile.

## Regula de continuitate

Fiecare poartă produce o listă de predare: date confirmate, avertismente,
incidente, sarcini deschise și dovezi. Schimbarea ecranului nu modifică starea și
nu închide elemente.
