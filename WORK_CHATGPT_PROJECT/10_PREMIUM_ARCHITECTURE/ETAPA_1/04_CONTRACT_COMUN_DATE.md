# Livrabil 4 — Contractul comun de date

Modelul normativ complet este în secțiunea 7 a Contractului Arhitectural.

## Anvelopă comună

```ts
type EntityEnvelope<T> = {
  schemaVersion: string;
  entityId: string;
  entityVersion: number;
  tripId: string;
  data: T;
  createdAt: string;
  updatedAt: string;
  createdBy: ActorRef;
  updatedBy: ActorRef;
  sync: SyncMetadata;
};
```

## Agregate oficiale

`Trip`, `Driver`, `Vehicle`, `Trailer`, `Cargo`, `Document`, `Check`,
`Confirmation`, `Warning`, `Incident`, `Media`, `OcrResult`, `TimeEvent`,
`LocationEvent`, `SyncRecord`, `AuditEvent`.

## Reguli obligatorii

- UUID pentru identitate; UTC ISO 8601 pentru timp.
- O singură sursă canonică per informație.
- Hash pentru fișiere și rapoarte.
- Originalul este păstrat separat de OCR, traducere și corecții.
- Datele derivate păstrează sursa și versiunea.
- Câmpurile critice nu folosesc `last write wins`.
- Fiecare entitate declară clasificarea datelor și politica de retenție.
- Resetarea UI nu șterge agregate, outbox sau audit.

## Proprietatea datelor

`Trip` deține referințele și starea fluxului. Modulele dețin numai rezultatele
specifice și le publică prin contract. Proiecțiile pentru UI sunt reconstruibile
din datele canonice și jurnal.
