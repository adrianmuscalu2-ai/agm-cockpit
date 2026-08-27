import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type AuthorityDefinition = { id: string; eventPrefix: string; turnClass: 'CRITICAL' | 'LIFECYCLE' | 'INFORMATIONAL' };
export type AuthorityIdentity = { authorityId: string; workloadId: string; tenantId: string; keyId: string };
export type P2Event = {
  eventId: string; eventType: string; aggregateId: string; tenantId: string; sourceAuthority: string; workloadIdentity: string;
  aggregateRevision: number; sourceSequence: number; committedAt: string; schemaVersion: '2.0.0'; policyVersion: 'p2.1.0';
  sanitizedPayload: Record<string, string | number | boolean | null>; previousStateHash: string | null; currentStateHash: string;
  correlationId: string; idempotencyKey: string; signatureKeyId: string; signature: string; outboxCommitRef: string;
};
type Unsigned = Omit<P2Event, 'signature'>;

export class AuthorityKeyRegistry {
  readonly #keys = new Map<string, { authorityId: string; key: Buffer; revoked: boolean }>();
  register(authorityId: string, keyId: string, key: Buffer) { if (key.length < 32) throw new Error('KEY_TOO_SHORT'); this.#keys.set(keyId, { authorityId, key: Buffer.from(key), revoked: false }); }
  revoke(keyId: string) { const value = this.#keys.get(keyId); if (!value) return false; value.revoked = true; return true; }
  status(keyId: string) { const value = this.#keys.get(keyId); return value ? { authorityId: value.authorityId, revoked: value.revoked } : undefined; }
  sign(authorityId: string, keyId: string, event: Unsigned) { const value = this.#keys.get(keyId); if (!value || value.authorityId !== authorityId || value.revoked) throw new Error('SIGNING_KEY_UNAVAILABLE'); return createHmac('sha256', value.key).update(canonical(event)).digest('hex'); }
  verify(event: P2Event) { const value = this.#keys.get(event.signatureKeyId); if (!value) return { valid: false, reason: 'UNKNOWN_KEY' } as const; if (value.revoked) return { valid: false, reason: 'REVOKED_KEY' } as const; if (value.authorityId !== event.sourceAuthority) return { valid: false, reason: 'KEY_AUTHORITY_MISMATCH' } as const; const { signature, ...unsigned } = event; const expected = createHmac('sha256', value.key).update(canonical(unsigned)).digest('hex'); const a = Buffer.from(signature, 'hex'); const b = Buffer.from(expected, 'hex'); return a.length === b.length && timingSafeEqual(a, b) ? { valid: true, reason: 'SIGNATURE_VALID' } as const : { valid: false, reason: 'INVALID_SIGNATURE' } as const; }
}

export type AuthorityState = { authorityId: string; aggregateId: string; tenantId: string; revision: number; status: string; stateHash: string; committedAt: string };

export class FederatedCanonicalAuthority {
  readonly #states = new Map<string, AuthorityState>();
  readonly #outbox: P2Event[] = [];
  constructor(readonly definition: AuthorityDefinition, readonly identity: AuthorityIdentity, private readonly keys: AuthorityKeyRegistry) {
    if (definition.id !== identity.authorityId) throw new Error('AUTHORITY_IDENTITY_MISMATCH');
  }
  transition(input: { eventId: string; eventType: string; aggregateId: string; status: string; committedAt: string; correlationId: string }) {
    if (!input.eventType.startsWith(this.definition.eventPrefix)) throw new Error('EVENT_OWNERSHIP_DENIED');
    const previous = this.#states.get(input.aggregateId); const revision = (previous?.revision ?? 0) + 1;
    const raw = { authorityId: this.definition.id, aggregateId: input.aggregateId, tenantId: this.identity.tenantId, revision, status: input.status, committedAt: input.committedAt };
    const state = Object.freeze({ ...raw, stateHash: sha(canonical(raw)) }); this.#states.set(input.aggregateId, state);
    const unsigned: Unsigned = { eventId: input.eventId, eventType: input.eventType, aggregateId: input.aggregateId, tenantId: this.identity.tenantId, sourceAuthority: this.definition.id, workloadIdentity: this.identity.workloadId, aggregateRevision: revision, sourceSequence: revision, committedAt: input.committedAt, schemaVersion: '2.0.0', policyVersion: 'p2.1.0', sanitizedPayload: { status: input.status }, previousStateHash: previous?.stateHash ?? null, currentStateHash: state.stateHash, correlationId: input.correlationId, idempotencyKey: input.eventId, signatureKeyId: this.identity.keyId, outboxCommitRef: `outbox:${this.definition.id}:${input.aggregateId}:${revision}` };
    const event = Object.freeze({ ...unsigned, signature: this.keys.sign(this.definition.id, this.identity.keyId, unsigned) }); this.#outbox.push(event); return { state: { ...state }, event };
  }
  state(id: string) { const value = this.#states.get(id); return value ? { ...value } : undefined; }
  outbox() { return [...this.#outbox]; }
}

export type JournalSnapshot = { version: 'p2-journal.v1'; events: P2Event[]; checkpoint: number; chainHash: string };
export class DurableSignedJournal {
  readonly #events: P2Event[] = []; readonly #ids = new Set<string>(); readonly #quarantine: Array<{ eventId: string; reason: string }> = [];
  append(event: P2Event) { if (this.#ids.has(event.eventId)) return { accepted: false, reason: 'DUPLICATE_EVENT' } as const; this.#events.push(Object.freeze({ ...event, sanitizedPayload: Object.freeze({ ...event.sanitizedPayload }) })); this.#ids.add(event.eventId); return { accepted: true, checkpoint: this.#events.length } as const; }
  quarantine(event: P2Event, reason: string) { this.#quarantine.push({ eventId: event.eventId, reason }); }
  events(after = 0) { return this.#events.slice(after).map((event) => ({ ...event, sanitizedPayload: { ...event.sanitizedPayload } })); }
  quarantined() { return this.#quarantine.map((item) => ({ ...item })); }
  snapshot(): JournalSnapshot { const events = this.events(); return { version: 'p2-journal.v1', events, checkpoint: events.length, chainHash: sha(canonical(events)) }; }
  restore(snapshot: JournalSnapshot) { if (snapshot.version !== 'p2-journal.v1' || snapshot.chainHash !== sha(canonical(snapshot.events))) throw new Error('JOURNAL_SNAPSHOT_INTEGRITY_FAILURE'); this.#events.length = 0; this.#ids.clear(); for (const event of snapshot.events) { this.#events.push(Object.freeze({ ...event, sanitizedPayload: Object.freeze({ ...event.sanitizedPayload }) })); this.#ids.add(event.eventId); } return { restored: this.#events.length, checkpoint: snapshot.checkpoint }; }
}

export class P2ValidationGate {
  readonly #revisions = new Map<string, number>();
  constructor(private readonly catalog: readonly AuthorityDefinition[], private readonly keys: AuthorityKeyRegistry, private readonly tenantId: string) {}
  validate(event: P2Event, replay = false) {
    const definition = this.catalog.find((item) => item.id === event.sourceAuthority);
    if (!definition) return { valid: false, reason: 'AUTHORITY_NOT_REGISTERED' } as const;
    if (event.tenantId !== this.tenantId) return { valid: false, reason: 'TENANT_MISMATCH' } as const;
    if (!event.eventType.startsWith(definition.eventPrefix)) return { valid: false, reason: 'EVENT_OWNERSHIP_DENIED' } as const;
    if (event.schemaVersion !== '2.0.0') return { valid: false, reason: 'SCHEMA_DENIED' } as const;
    if (Object.keys(event.sanitizedPayload).some((key) => /secret|token|credential|password/i.test(key))) return { valid: false, reason: 'SECRET_FIELD_DENIED' } as const;
    const signature = this.keys.verify(event); if (!signature.valid) return signature;
    const key = `${event.sourceAuthority}:${event.aggregateId}`; const previous = this.#revisions.get(key) ?? 0;
    if ((!replay && event.aggregateRevision !== previous + 1) || (replay && event.aggregateRevision < previous)) return { valid: false, reason: 'REVISION_CONFLICT' } as const;
    this.#revisions.set(key, event.aggregateRevision); return { valid: true, reason: 'VALIDATED' } as const;
  }
  reset() { this.#revisions.clear(); }
}

export type P2TurnView = { projectionKey: string; authorityId: string; aggregateId: string; status: string; revision: number; stateHash: string; lastEventId: string; committedAt: string; projectedAt: string; lagMs: number; health: 'CURRENT' | 'STALE' | 'UNAVAILABLE'; integrity: 'VERIFIED' };
export class FederatedTurnProjection {
  readonly #views = new Map<string, P2TurnView>();
  apply(event: P2Event, projectedAt: string) { const projectionKey = `${event.sourceAuthority}:${event.aggregateId}`; const current = this.#views.get(projectionKey); if (current && event.aggregateRevision <= current.revision) return { applied: false, reason: 'IDEMPOTENT_SKIP' } as const; const view = Object.freeze({ projectionKey, authorityId: event.sourceAuthority, aggregateId: event.aggregateId, status: String(event.sanitizedPayload.status), revision: event.aggregateRevision, stateHash: event.currentStateHash, lastEventId: event.eventId, committedAt: event.committedAt, projectedAt, lagMs: Math.max(0, Date.parse(projectedAt) - Date.parse(event.committedAt)), health: 'CURRENT' as const, integrity: 'VERIFIED' as const }); this.#views.set(projectionKey, view); return { applied: true, view: { ...view } } as const; }
  markStale(key: string) { const current = this.#views.get(key); if (current) this.#views.set(key, Object.freeze({ ...current, health: 'STALE' })); }
  view(key: string) { const value = this.#views.get(key); return value ? { ...value } : undefined; }
  all() { return [...this.#views.values()].map((item) => ({ ...item })); }
  clear() { this.#views.clear(); }
}

export class P2TurnCustodian {
  constructor(private readonly projection: FederatedTurnProjection, private readonly gate: P2ValidationGate) {}
  stale(now: string, thresholds: Record<string, number>, catalog: readonly AuthorityDefinition[]) { const stale: string[] = []; for (const view of this.projection.all()) { const definition = catalog.find((item) => item.id === view.authorityId); const threshold = thresholds[definition?.turnClass ?? 'INFORMATIONAL']; if (Date.parse(now) - Date.parse(view.committedAt) > threshold) { this.projection.markStale(view.projectionKey); stale.push(view.projectionKey); } } return stale; }
  rebuild(events: readonly P2Event[], projectedAt: string) { this.projection.clear(); this.gate.reset(); let applied = 0; for (const event of events) { const validation = this.gate.validate(event, true); if (!validation.valid) throw new Error(`REBUILD_${validation.reason}`); if (this.projection.apply(event, projectedAt).applied) applied += 1; } return { applied, parity: applied === events.length }; }
}

export function projectValidated(event: P2Event, gate: P2ValidationGate, journal: DurableSignedJournal, projection: FederatedTurnProjection, projectedAt: string) { const validation = gate.validate(event); if (!validation.valid) { journal.quarantine(event, validation.reason); return { status: 'QUARANTINED', reason: validation.reason } as const; } const appended = journal.append(event); if (!appended.accepted) return { status: 'DENIED', reason: appended.reason } as const; const reflected = projection.apply(event, projectedAt); return { status: reflected.applied ? 'REFLECTED' : 'DENIED', reason: reflected.applied ? 'VALIDATED' : reflected.reason } as const; }
function sha(value: string) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`; if (value && typeof value === 'object') { const record = value as Record<string, unknown>; return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`; } return JSON.stringify(value); }
