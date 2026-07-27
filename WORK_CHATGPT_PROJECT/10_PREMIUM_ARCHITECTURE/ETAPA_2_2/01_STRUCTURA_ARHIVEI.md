# Livrabil 1 — Structura Arhivei Operaționale

## Model logic

```text
OperationalArchive
├── EventStore (append-only, sursa canonică)
├── EvidenceIndex (metadate + hash; fișiere în storage autorizat)
├── ProjectionStore
│   ├── TripTimeline
│   ├── ConfirmationLedger
│   ├── IncidentTimeline
│   ├── SyncTimeline
│   └── ModuleViews
├── ExportRegistry
├── IntegrityRegistry
└── RetentionRegistry
```

## Anvelopa canonică

```ts
type OperationalEventV1 = {
  schemaVersion: 'operational-event.v1';
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  recordedAt: string;
  tripId?: string;
  transportJobId?: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  lifecycleState?: string;
  operationalFlags: string[];
  moduleId: string;
  actor: ActorReference;
  device: DeviceReference;
  operationId: string;
  correlationId: string;
  causationId?: string;
  payload: Record<string, unknown>;
  evidenceRefs: string[];
  classification: DataClassification;
  retentionPolicyId: string;
  sync: EventSyncMetadata;
  integrity: EventIntegrityMetadata;
};
```

## Reguli structurale

- EventStore este append-only; corecția produce eveniment nou.
- Fișierele nu sunt inserate în eveniment; se păstrează referința și hashul.
- Proiecțiile pot fi șterse și reconstruite din EventStore.
- Exporturile sunt artefacte versionate și înregistrate prin eveniment.
- Datele Basic nu sunt mutate automat în arhiva Premium.
- `AuditEvent` existent este baza de compatibilitate, nu contractul complet.

## Niveluri de stocare

- **Local device archive:** evenimente create offline, outbox, integrity chain local.
- **Canonical server archive:** evenimente acceptate, secvențiate și corelate.
- **Cold archive:** pachete sigilate, verificabile, read-only.
- **Projection cache:** read model fără autoritate canonică.
