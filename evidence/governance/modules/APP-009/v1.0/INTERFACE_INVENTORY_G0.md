# APP-009 — Inventar interfețe

| Familie | Module proprietare | Contract APP-009 |
|---|---|---|
| Profil și contacte | APP-007, APP-005 | local, personal, disponibil offline |
| OCR și ghidare | APP-004 / OCR, guidance | repository local, recovery și reset controlat |
| Mesaje și incidente | APP-003, OPS-003 | preferințe și jurnal local |
| Pre-Departure | APP-001 | sesiune, sync meta, outbox și acknowledgement |
| Premium operational | PREMIUM | device, trip context, events și outbox |
| Limbă și legal | APP-008, APP-014 | preferințe și acceptare versionată |
| Sesiuni/credenciale | APP-013, API-003 | non-offline; proprietate explicită |

APP-009 inventariază frontierele și interzice bypass-ul proprietarului. Nu comunică direct cu API, PostgreSQL sau Production.

