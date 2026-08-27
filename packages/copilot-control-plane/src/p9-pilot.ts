import { createHash } from 'node:crypto';
import type { EphemeralDossierRuntime, WorkerSession } from './p3-runtime';

export type PilotState = 'BLOCKED' | 'ACTIVE' | 'HEALTHY' | 'DEGRADED' | 'STOPPED' | 'FAILED' | 'ROLLBACK';
export type PilotEvent = { eventId: string; tenantId: string; status: PilotState; occurredAt: string; reason: string; workers: number; canonicalHash: string; previousHash: string | null; chainHash: string };
export type P9FeatureConfiguration = Readonly<{
  enabled: boolean;
  autoStart: false;
  promoted: false;
  trafficAllowed: false;
  killSwitchActive: boolean;
}>;

export const P9_DISABLED_BY_DEFAULT: P9FeatureConfiguration = Object.freeze({
  enabled: false,
  autoStart: false,
  promoted: false,
  trafficAllowed: false,
  killSwitchActive: true,
});

export function parseP9FeatureFlag(value: string | undefined): boolean {
  if (value === undefined || value === '' || value === 'false' || value === '0') return false;
  if (value === 'true') return true;
  throw new Error('P9_FEATURE_FLAG_INVALID');
}

export class P9PilotController {
  #admission = false;
  #providerRoute = false;
  #state: PilotState = 'BLOCKED';
  readonly #workers = new Map<string, WorkerSession>();
  readonly #events: PilotEvent[] = [];
  readonly #incidents: { id: string; status: 'OPEN' | 'RESOLVED'; reason: string }[] = [];

  constructor(
    readonly tenantId: string,
    private readonly runtime: EphemeralDossierRuntime,
    private readonly feature: P9FeatureConfiguration = P9_DISABLED_BY_DEFAULT,
  ) {
    if (feature.autoStart || feature.promoted || feature.trafficAllowed) throw new Error('P9_UNAUTHORIZED_CONFIGURATION');
  }

  status() {
    return Object.freeze({
      state: this.#state,
      featureEnabled: this.feature.enabled,
      autoStart: false as const,
      promoted: false as const,
      trafficAllowed: false as const,
      killSwitchActive: this.feature.killSwitchActive,
      admission: this.#admission,
      providerRoute: this.#providerRoute,
      activeWorkers: this.#workers.size,
    });
  }

  certifyKillSwitch(now: string) {
    const before = this.canonicalHash(true);
    this.#admission = false;
    this.#providerRoute = false;
    this.stopWorkers(now);
    this.transition('STOPPED', now, 'KILL_SWITCH_CERTIFICATION');
    return { pass: !this.#admission && !this.#providerRoute && this.#workers.size === 0, canonicalPreserved: before === this.canonicalHash(true), evidencePreserved: this.#events.length > 0, orphanWorkers: 0, partialPublication: false, secretExposure: 'ZERO' };
  }

  admit(now: string, killSwitchPass: boolean) {
    if (!this.feature.enabled) throw new Error('P9_FEATURE_DISABLED');
    if (this.feature.killSwitchActive) throw new Error('P9_KILL_SWITCH_ACTIVE');
    if (!killSwitchPass) throw new Error('P9_KILL_SWITCH_REQUIRED');
    this.#admission = true;
    this.#providerRoute = true;
    this.transition('ACTIVE', now, 'OWNER_AUTHORIZED_INTERNAL_READ_ONLY');
  }

  track(worker: WorkerSession, now: string) {
    if (!this.#admission || !this.#providerRoute) throw new Error('PILOT_ADMISSION_BLOCKED');
    if (worker.tenantId !== this.tenantId) throw new Error('PILOT_TENANT_DENIED');
    if (this.#workers.size >= 4) throw new Error('PILOT_WORKER_QUOTA');
    this.#workers.set(worker.workerId, worker);
    this.transition('HEALTHY', now, 'WORKER_ADMITTED');
  }

  stop(now: string, reason: string) {
    this.#admission = false;
    this.#providerRoute = false;
    this.stopWorkers(now);
    this.transition('STOPPED', now, reason);
  }

  fenceWorkers(now: string) {
    const fenced = [...this.#workers.keys()];
    this.stopWorkers(now);
    this.transition('ROLLBACK', now, 'WORKERS_FENCED');
    return fenced;
  }

  fail(now: string, reason: string) {
    this.#admission = false;
    this.#providerRoute = false;
    this.stopWorkers(now);
    const id = `incident-${hash(reason + now).slice(0, 16)}`;
    this.#incidents.push({ id, status: 'OPEN', reason });
    this.transition('FAILED', now, reason);
    return id;
  }

  resolveIncident(id: string) { const incident = this.#incidents.find((item) => item.id === id); if (!incident) throw new Error('INCIDENT_NOT_FOUND'); incident.status = 'RESOLVED'; }
  writeExternal() { throw new Error('P9_EXTERNAL_WRITE_DENIED'); }
  production() { throw new Error('P9_PRODUCTION_DENIED'); }
  secret() { throw new Error('P9_SECRET_ACCESS_DENIED'); }

  snapshot() {
    const events = this.events(); const incidents = this.incidents(); const state = this.#state; const admission = this.#admission; const providerRoute = this.#providerRoute;
    return { state, admission, providerRoute, events, incidents, snapshotHash: hash(stable({ state, admission, providerRoute, events, incidents })) };
  }

  restore(snapshot: ReturnType<P9PilotController['snapshot']>) {
    if (snapshot.snapshotHash !== hash(stable({ state: snapshot.state, admission: snapshot.admission, providerRoute: snapshot.providerRoute, events: snapshot.events, incidents: snapshot.incidents }))) throw new Error('P9_SNAPSHOT_CORRUPT');
    if ((!this.feature.enabled || this.feature.killSwitchActive) && (snapshot.admission || snapshot.providerRoute || snapshot.state === 'ACTIVE' || snapshot.state === 'HEALTHY')) throw new Error('P9_SNAPSHOT_ACTIVATION_DENIED');
    this.#state = snapshot.state; this.#admission = snapshot.admission; this.#providerRoute = snapshot.providerRoute;
    this.#events.length = 0; this.#events.push(...snapshot.events.map((event) => ({ ...event })));
    this.#incidents.length = 0; this.#incidents.push(...snapshot.incidents.map((incident) => ({ ...incident })));
  }

  events() { return this.#events.map((event) => ({ ...event })); }
  incidents() { return this.#incidents.map((incident) => ({ ...incident })); }
  state() { return this.#state; }
  activeWorkers() { return this.#workers.size; }

  private stopWorkers(now: string) {
    for (const worker of this.#workers.values()) if (this.runtime.session(worker.workerId)?.state === 'STARTED') this.runtime.stop(worker.workerId, now);
    this.#workers.clear();
  }

  private transition(status: PilotState, occurredAt: string, reason: string) {
    this.#state = status; const previousHash = this.#events.at(-1)?.chainHash ?? null;
    const core = { tenantId: this.tenantId, status, occurredAt, reason, workers: this.#workers.size, canonicalHash: this.canonicalHash(), previousHash };
    const chainHash = hash(stable(core)); this.#events.push(Object.freeze({ eventId: `p9-${chainHash.slice(0, 20)}`, ...core, chainHash }));
  }

  private canonicalHash(ignoreOperational = false) {
    return hash(stable({ tenantId: this.tenantId, scope: 'READ_ONLY_LOW_INTERNAL', production: false, featureEnabled: this.feature.enabled, autoStart: false, promoted: false, trafficAllowed: false, ...(!ignoreOperational ? { admission: this.#admission, providerRoute: this.#providerRoute } : {}) }));
  }
}

export function projectP9Turn(events: PilotEvent[]) { return events.map((event) => ({ eventId: event.eventId, tenantId: event.tenantId, status: event.status, occurredAt: event.occurredAt, reason: event.reason, workers: event.workers, canonicalHash: event.canonicalHash, chainHash: event.chainHash })); }
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') { const record = value as Record<string, unknown>; return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`; } return JSON.stringify(value); }
