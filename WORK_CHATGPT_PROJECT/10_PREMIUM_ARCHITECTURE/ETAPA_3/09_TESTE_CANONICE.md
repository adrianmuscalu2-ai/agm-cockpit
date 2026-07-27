# Livrabil 9 — Testele canonice

Suită: `scripts/test-premium-operational-context.ts`

## Acoperire

- creare DRAFT și unicitatea cursei active;
- start PRE_DEPARTURE;
- flag BLOCKED și blocarea startului;
- eliminarea blocajului;
- confirmare READY_CONFIRMED;
- OFFLINE și SYNC_PENDING;
- EventStore și outbox pending;
- lanț de evenimente valid;
- detectarea lanțului alterat;
- maparea codurilor și display names TransportJob;
- integrarea Pre-departure;
- conservarea TripContext la reset UI.

## Rezultate

```text
Premium operational context canonical tests: PASS
TypeScript noEmit: PASS
Vite production build: PASS
E6.4–E6.6 validation: PASS
Pre-departure offline outbox: PASS
Pre-departure issue management: PASS
```

Buildul semnalează numai avertismentul preexistent privind chunkul principal peste
500 kB; nu este regresie funcțională.
