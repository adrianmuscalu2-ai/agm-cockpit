import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type Identity = {
  principalId: string;
  workloadId: string;
  tenantId: string;
  roles: readonly string[];
};

export type PermissionRequest = {
  identity: Identity;
  action: string;
  resourceTenantId: string;
};

export type AuditRecord = {
  sequence: number;
  occurredAt: string;
  action: string;
  outcome: 'ALLOWED' | 'DENIED' | 'APPLIED' | 'REJECTED';
  tenantId: string;
  principalId: string;
  correlationId: string;
  detailCode: string;
  previousHash: string | null;
  recordHash: string;
};

export class AppendOnlyAudit {
  readonly #records: AuditRecord[] = [];

  append(input: Omit<AuditRecord, 'sequence' | 'previousHash' | 'recordHash'>) {
    const previousHash = this.#records.at(-1)?.recordHash ?? null;
    const sequence = this.#records.length + 1;
    const recordHash = sha256(canonical({ ...input, sequence, previousHash }));
    const record = Object.freeze({ ...input, sequence, previousHash, recordHash });
    this.#records.push(record);
    return record;
  }

  records() { return this.#records.map((record) => ({ ...record })); }

  verify() {
    return this.#records.every((record, index) => {
      const previousHash = index === 0 ? null : this.#records[index - 1].recordHash;
      return record.previousHash === previousHash
        && record.recordHash === sha256(canonical({ ...record, recordHash: undefined }));
    });
  }
}

export class DenyByDefaultPdp {
  readonly #rules = new Map<string, ReadonlySet<string>>();

  allow(role: string, actions: readonly string[]) {
    this.#rules.set(role, new Set(actions));
  }

  evaluate(request: PermissionRequest) {
    if (request.identity.tenantId !== request.resourceTenantId) return { allowed: false, reason: 'TENANT_MISMATCH' } as const;
    const allowed = request.identity.roles.some((role) => this.#rules.get(role)?.has(request.action));
    return allowed ? { allowed: true, reason: 'EXPLICIT_ALLOW' } as const : { allowed: false, reason: 'DENY_BY_DEFAULT' } as const;
  }
}

export type CanonicalStatus = 'BOOTSTRAPPING' | 'ACTIVE' | 'OWNER_REVIEW' | 'STOPPED' | 'FAILED';
export type CanonicalState = {
  tenantId: string;
  aggregateId: string;
  revision: number;
  status: CanonicalStatus;
  updatedAt: string;
  stateHash: string;
};

export type SignedEvent = {
  eventId: string;
  eventType: 'control_plane.status_changed';
  aggregateType: 'COPILOT_CONTROL_PLANE';
  aggregateId: string;
  tenantId: string;
  sourceAuthority: 'P1_CANONICAL_TEST_AUTHORITY';
  workloadIdentity: string;
  sourceSequence: number;
  aggregateRevision: number;
  occurredAt: string;
  committedAt: string;
  schemaVersion: '1.0.0';
  policyVersion: 'p1.0.0';
  classification: 'INTERNAL';
  sanitizedPayload: { status: CanonicalStatus };
  previousStateHash: string | null;
  currentStateHash: string;
  correlationId: string;
  causationId: string;
  traceId: string;
  idempotencyKey: string;
  signatureKeyId: string;
  signature: string;
  outboxCommitRef: string;
};

type UnsignedEvent = Omit<SignedEvent, 'signature'>;

export class EventSigner {
  constructor(readonly keyId: string, private readonly key: Buffer) {
    if (key.length < 32) throw new Error('SIGNING_KEY_TOO_SHORT');
  }

  sign(event: UnsignedEvent): SignedEvent {
    return Object.freeze({ ...event, signature: createHmac('sha256', this.key).update(canonical(event)).digest('hex') });
  }

  verify(event: SignedEvent) {
    if (event.signatureKeyId !== this.keyId) return false;
    const { signature, ...unsigned } = event;
    const expected = createHmac('sha256', this.key).update(canonical(unsigned)).digest('hex');
    const supplied = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
  }
}

export class SignedEventJournal {
  readonly #events: SignedEvent[] = [];
  readonly #ids = new Set<string>();

  append(event: SignedEvent) {
    if (this.#ids.has(event.eventId)) return { accepted: false, reason: 'DUPLICATE_EVENT' } as const;
    this.#events.push(Object.freeze({ ...event, sanitizedPayload: Object.freeze({ ...event.sanitizedPayload }) }));
    this.#ids.add(event.eventId);
    return { accepted: true, sequence: this.#events.length } as const;
  }

  events() { return this.#events.map((event) => ({ ...event, sanitizedPayload: { ...event.sanitizedPayload } })); }
}

export class ValidationGate {
  readonly #lastRevision = new Map<string, number>();

  constructor(private readonly signer: EventSigner, private readonly allowedTenant: string) {}

  validate(event: SignedEvent, options: { replay?: boolean } = {}) {
    if (!this.signer.verify(event)) return { valid: false, reason: 'INVALID_SIGNATURE' } as const;
    if (event.tenantId !== this.allowedTenant) return { valid: false, reason: 'TENANT_MISMATCH' } as const;
    if (event.schemaVersion !== '1.0.0' || event.eventType !== 'control_plane.status_changed') return { valid: false, reason: 'SCHEMA_OR_TYPE_DENIED' } as const;
    if (Object.keys(event.sanitizedPayload).some((key) => /secret|token|credential|password/i.test(key))) return { valid: false, reason: 'SECRET_FIELD_DENIED' } as const;
    const previous = this.#lastRevision.get(event.aggregateId) ?? 0;
    if (!options.replay && event.aggregateRevision !== previous + 1) return { valid: false, reason: 'REVISION_GAP' } as const;
    if (options.replay && event.aggregateRevision < previous) return { valid: false, reason: 'STALE_REPLAY' } as const;
    this.#lastRevision.set(event.aggregateId, event.aggregateRevision);
    return { valid: true, reason: 'VALIDATED' } as const;
  }

  reset() { this.#lastRevision.clear(); }
}

export class CanonicalTestAuthority {
  readonly #states = new Map<string, CanonicalState>();
  readonly #outbox: SignedEvent[] = [];

  constructor(private readonly signer: EventSigner, private readonly audit: AppendOnlyAudit) {}

  transition(input: { identity: Identity; aggregateId: string; status: CanonicalStatus; now: string; correlationId: string; eventId: string }, decision: { allowed: boolean; reason: string }) {
    if (!decision.allowed) {
      this.audit.append({ occurredAt: input.now, action: 'canonical.transition', outcome: 'DENIED', tenantId: input.identity.tenantId, principalId: input.identity.principalId, correlationId: input.correlationId, detailCode: decision.reason });
      throw new Error(decision.reason);
    }
    const previous = this.#states.get(input.aggregateId);
    const revision = (previous?.revision ?? 0) + 1;
    const raw = { tenantId: input.identity.tenantId, aggregateId: input.aggregateId, revision, status: input.status, updatedAt: input.now };
    const state = Object.freeze({ ...raw, stateHash: sha256(canonical(raw)) });
    this.#states.set(input.aggregateId, state);
    const unsigned: UnsignedEvent = {
      eventId: input.eventId, eventType: 'control_plane.status_changed', aggregateType: 'COPILOT_CONTROL_PLANE', aggregateId: input.aggregateId,
      tenantId: input.identity.tenantId, sourceAuthority: 'P1_CANONICAL_TEST_AUTHORITY', workloadIdentity: input.identity.workloadId,
      sourceSequence: revision, aggregateRevision: revision, occurredAt: input.now, committedAt: input.now, schemaVersion: '1.0.0', policyVersion: 'p1.0.0',
      classification: 'INTERNAL', sanitizedPayload: { status: input.status }, previousStateHash: previous?.stateHash ?? null, currentStateHash: state.stateHash,
      correlationId: input.correlationId, causationId: input.correlationId, traceId: input.correlationId, idempotencyKey: input.eventId,
      signatureKeyId: this.signer.keyId, outboxCommitRef: `outbox:${input.aggregateId}:${revision}`,
    };
    const event = this.signer.sign(unsigned);
    this.#outbox.push(event);
    this.audit.append({ occurredAt: input.now, action: 'canonical.transition', outcome: 'APPLIED', tenantId: input.identity.tenantId, principalId: input.identity.principalId, correlationId: input.correlationId, detailCode: input.status });
    return { state: { ...state }, event };
  }

  state(aggregateId: string) { const state = this.#states.get(aggregateId); return state ? { ...state } : undefined; }
  outbox() { return [...this.#outbox]; }
}

export type ProjectionHealth = 'CURRENT' | 'STALE' | 'REBUILDING' | 'UNAVAILABLE';
export type TurnProjection = {
  tenantId: string;
  aggregateId: string;
  canonicalStatus: CanonicalStatus;
  canonicalRevision: number;
  lastEventId: string;
  sourceAuthority: string;
  sourceStateHash: string;
  canonicalCommittedAt: string;
  projectedAt: string;
  health: ProjectionHealth;
  integrity: 'VERIFIED' | 'UNVERIFIED';
  lagMs: number;
};

export class DeterministicTurnProjector {
  readonly #views = new Map<string, TurnProjection>();

  apply(event: SignedEvent, projectedAt: string) {
    const existing = this.#views.get(event.aggregateId);
    if (existing && event.aggregateRevision <= existing.canonicalRevision) return { applied: false, reason: 'IDEMPOTENT_SKIP' } as const;
    const lagMs = Math.max(0, Date.parse(projectedAt) - Date.parse(event.committedAt));
    const view = Object.freeze({ tenantId: event.tenantId, aggregateId: event.aggregateId, canonicalStatus: event.sanitizedPayload.status,
      canonicalRevision: event.aggregateRevision, lastEventId: event.eventId, sourceAuthority: event.sourceAuthority, sourceStateHash: event.currentStateHash,
      canonicalCommittedAt: event.committedAt, projectedAt, health: 'CURRENT' as const, integrity: 'VERIFIED' as const, lagMs });
    this.#views.set(event.aggregateId, view);
    return { applied: true, view: { ...view } } as const;
  }

  view(aggregateId: string) { const value = this.#views.get(aggregateId); return value ? { ...value } : undefined; }
  snapshot() { return [...this.#views.values()].map((view) => ({ ...view })); }
  restore(values: readonly TurnProjection[]) { this.#views.clear(); values.forEach((view) => this.#views.set(view.aggregateId, Object.freeze({ ...view }))); }
  clear() { this.#views.clear(); }
  markHealth(aggregateId: string, health: ProjectionHealth) { const current = this.#views.get(aggregateId); if (current) this.#views.set(aggregateId, Object.freeze({ ...current, health })); }
}

export class TurnStateCustodian {
  constructor(private readonly projector: DeterministicTurnProjector, private readonly gate: ValidationGate, private readonly audit: AppendOnlyAudit) {}

  detectStale(aggregateId: string, now: string, staleMs: number) {
    const view = this.projector.view(aggregateId);
    if (!view) return { stale: true, reason: 'PROJECTION_MISSING' } as const;
    const stale = Date.parse(now) - Date.parse(view.canonicalCommittedAt) > staleMs;
    if (stale) this.projector.markHealth(aggregateId, 'STALE');
    return { stale, reason: stale ? 'SLO_EXCEEDED' : 'CURRENT' } as const;
  }

  rebuild(events: readonly SignedEvent[], projectedAt: string, actor: Identity) {
    this.projector.clear();
    this.gate.reset();
    let applied = 0;
    for (const event of events) {
      const validation = this.gate.validate(event, { replay: true });
      if (!validation.valid) throw new Error(`REBUILD_${validation.reason}`);
      if (this.projector.apply(event, projectedAt).applied) applied += 1;
    }
    this.audit.append({ occurredAt: projectedAt, action: 'turn.projection.rebuild', outcome: 'APPLIED', tenantId: actor.tenantId, principalId: actor.principalId, correlationId: `rebuild:${projectedAt}`, detailCode: `EVENTS_${applied}` });
    return { applied, parity: applied === events.length };
  }
}

export function renderVisibleTurnStatus(view: TurnProjection | undefined) {
  if (!view) return { status: 'UNAVAILABLE', label: 'Turn projection unavailable', asOf: null, source: null, revision: null };
  return Object.freeze({ status: view.health === 'CURRENT' ? view.canonicalStatus : view.health, label: `${view.aggregateId}: ${view.canonicalStatus}`, asOf: view.projectedAt, source: view.sourceAuthority, revision: view.canonicalRevision });
}

export class P1ControlPlane {
  readonly audit = new AppendOnlyAudit();
  readonly pdp = new DenyByDefaultPdp();
  readonly signer: EventSigner;
  readonly journal = new SignedEventJournal();
  readonly gate: ValidationGate;
  readonly authority: CanonicalTestAuthority;
  readonly projector = new DeterministicTurnProjector();
  readonly custodian: TurnStateCustodian;

  constructor(input: { tenantId: string; signingKeyId: string; signingKey: Buffer }) {
    this.signer = new EventSigner(input.signingKeyId, input.signingKey);
    this.gate = new ValidationGate(this.signer, input.tenantId);
    this.authority = new CanonicalTestAuthority(this.signer, this.audit);
    this.custodian = new TurnStateCustodian(this.projector, this.gate, this.audit);
    this.pdp.allow('CONTROL_PLANE_OPERATOR', ['control-plane:transition']);
  }

  transition(input: { identity: Identity; aggregateId: string; status: CanonicalStatus; now: string; correlationId: string; eventId: string; projectedAt: string }) {
    const decision = this.pdp.evaluate({ identity: input.identity, action: 'control-plane:transition', resourceTenantId: input.identity.tenantId });
    this.audit.append({ occurredAt: input.now, action: 'pdp.evaluate', outcome: decision.allowed ? 'ALLOWED' : 'DENIED', tenantId: input.identity.tenantId, principalId: input.identity.principalId, correlationId: input.correlationId, detailCode: decision.reason });
    const { state, event } = this.authority.transition(input, decision);
    const appended = this.journal.append(event);
    if (!appended.accepted) throw new Error(appended.reason);
    const validation = this.gate.validate(event);
    this.audit.append({ occurredAt: input.projectedAt, action: 'event.validate', outcome: validation.valid ? 'ALLOWED' : 'REJECTED', tenantId: input.identity.tenantId, principalId: input.identity.principalId, correlationId: input.correlationId, detailCode: validation.reason });
    if (!validation.valid) throw new Error(validation.reason);
    const projection = this.projector.apply(event, input.projectedAt);
    if (!projection.applied) throw new Error(projection.reason);
    this.audit.append({ occurredAt: input.projectedAt, action: 'turn.project', outcome: 'APPLIED', tenantId: input.identity.tenantId, principalId: input.identity.principalId, correlationId: input.correlationId, detailCode: `REVISION_${state.revision}` });
    return { state, event, validation, projection: projection.view, visible: renderVisibleTurnStatus(projection.view) };
  }
}

function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
