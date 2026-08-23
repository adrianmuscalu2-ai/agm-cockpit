import { createHash, randomUUID } from 'node:crypto';

export type AgentDeclaration = {
  agentId: string; packageId: string; role: string; capabilities: string[]; tools: string[]; tenantScope: string[];
  riskClasses: string[]; runtimePlacement: string; dossierScoped: true; parkingPolicy: 'DESCRIPTOR_ONLY'; enabled: boolean;
};
export type RegisteredAgent = AgentDeclaration & { registryVersion: string; declarationHash: string; status: 'REGISTERED' | 'REVOKED' };

export class DeclarativeAgentRegistry {
  readonly #entries = new Map<string, RegisteredAgent>();
  constructor(readonly registryVersion: string) {}
  register(input: AgentDeclaration) {
    if (!input.dossierScoped || input.parkingPolicy !== 'DESCRIPTOR_ONLY') throw new Error('P3_UNSAFE_LIFECYCLE_DECLARATION');
    if (!input.capabilities.length || !input.tools.length || !input.tenantScope.length) throw new Error('P3_INCOMPLETE_DECLARATION');
    const declarationHash = hash(stable(input));
    const value = Object.freeze({ ...copyDeclaration(input), registryVersion: this.registryVersion, declarationHash, status: 'REGISTERED' as const });
    this.#entries.set(input.agentId, value); return { ...value };
  }
  revoke(agentId: string) { const current = this.#entries.get(agentId); if (!current) return false; this.#entries.set(agentId, Object.freeze({ ...current, status: 'REVOKED' })); return true; }
  get(agentId: string) { const value = this.#entries.get(agentId); return value ? { ...value, capabilities: [...value.capabilities], tools: [...value.tools], tenantScope: [...value.tenantScope], riskClasses: [...value.riskClasses] } : undefined; }
  restore(entries: readonly RegisteredAgent[]) { this.#entries.clear(); entries.forEach((entry) => this.#entries.set(entry.agentId, Object.freeze({ ...copyDeclaration(entry), registryVersion: entry.registryVersion, declarationHash: entry.declarationHash, status: entry.status }))); }
  snapshot() { return [...this.#entries.values()].map((value) => this.get(value.agentId)!); }
}

export type AdmissionRequest = { agentId: string; mandateId?: string; tenantId: string; dossierId: string; riskClass: string; capabilities: string[]; tools: string[]; now: string; leaseMs: number };
export type AdmissionDecision = { allowed: boolean; reason: string; declaration?: RegisteredAgent };
export class RuntimeAdmissionController {
  readonly #deniedTools = new Set(['SHELL_ARBITRARY', 'SECRET_STORE', 'TURN_CANONICAL_WRITE', 'BASIC_WRITE']);
  constructor(private readonly registry: DeclarativeAgentRegistry) {}
  evaluate(input: AdmissionRequest): AdmissionDecision {
    const declaration = this.registry.get(input.agentId);
    if (!declaration || declaration.status !== 'REGISTERED' || !declaration.enabled) return { allowed: false, reason: 'AGENT_NOT_ACTIVE' };
    if (!input.dossierId) return { allowed: false, reason: 'DOSSIER_REQUIRED' };
    if (!declaration.tenantScope.includes(input.tenantId)) return { allowed: false, reason: 'TENANT_DENIED' };
    if (!declaration.riskClasses.includes(input.riskClass)) return { allowed: false, reason: 'RISK_DENIED' };
    if (input.leaseMs <= 0 || input.leaseMs > 60_000) return { allowed: false, reason: 'LEASE_DENIED' };
    if (input.capabilities.some((value) => !declaration.capabilities.includes(value))) return { allowed: false, reason: 'CAPABILITY_DENIED' };
    if (input.tools.some((value) => this.#deniedTools.has(value) || !declaration.tools.includes(value))) return { allowed: false, reason: 'TOOL_DENIED' };
    return { allowed: true, reason: 'EXPLICIT_DECLARATION_ALLOW', declaration };
  }
}

export type WorkerState = 'STARTED' | 'PARKED' | 'STOPPED' | 'FAILED' | 'EXPIRED';
export type WorkerLease = { leaseId: string; fence: number; expiresAt: string };
export type WorkerSession = { workerId: string; agentId: string; mandateId: string; packageId: string; tenantId: string; dossierId: string; sessionId: string; state: WorkerState; lease: WorkerLease; startedAt: string; credentialId: string; scratchId: string; declarationHash: string };
export type ParkingDescriptor = { workerId: string; agentId: string; packageId: string; tenantId: string; dossierId: string; lastFence: number; registryVersion: string; declarationHash: string; state: 'PARKED'; parkedAt: string };
export type CleanupAttestation = { workerId: string; sessionId: string; credentialsRevoked: true; scratchErased: true; memoryRetained: false; secretRetained: false; completedAt: string; reason: string; attestationHash: string };
export type RuntimeLifecycleEvent = { eventId: string; eventType: 'runtime.started' | 'runtime.parked' | 'runtime.stopped' | 'runtime.failed' | 'runtime.expired'; lifecycle: 'STARTED' | 'PARKED' | 'STOPPED' | 'FAILED' | 'EXPIRED'; aggregateId: string; agentId: string; mandateId: string; tenantId: string; dossierId: string; status: WorkerState; fence: number; occurredAt: string; declarationHash: string };

export class EphemeralDossierRuntime {
  readonly #sessions = new Map<string, WorkerSession>(); readonly #parking = new Map<string, ParkingDescriptor>(); readonly #cleanup: CleanupAttestation[] = []; readonly #events: RuntimeLifecycleEvent[] = []; readonly #fences = new Map<string, number>();
  constructor(private readonly admission: RuntimeAdmissionController) {}
  start(input: AdmissionRequest) {
    const decision = this.admission.evaluate(input); if (!decision.allowed || !decision.declaration) throw new Error(decision.reason);
    const fence = (this.#fences.get(input.dossierId) ?? 0) + 1; this.#fences.set(input.dossierId, fence);
    const workerId = `worker-${randomUUID()}`; const sessionId = `session-${randomUUID()}`;
    const session = Object.freeze({ workerId, agentId: input.agentId, mandateId: input.mandateId ?? `legacy:${input.dossierId}`, packageId: decision.declaration.packageId, tenantId: input.tenantId, dossierId: input.dossierId, sessionId, state: 'STARTED' as const, lease: Object.freeze({ leaseId: `lease-${randomUUID()}`, fence, expiresAt: new Date(Date.parse(input.now) + input.leaseMs).toISOString() }), startedAt: input.now, credentialId: `ephemeral-${randomUUID()}`, scratchId: `scratch-${randomUUID()}`, declarationHash: decision.declaration.declarationHash });
    this.#sessions.set(workerId, session); this.emit(session, 'runtime.started', input.now); return this.session(workerId)!;
  }
  commit(workerId: string, fence: number, now: string) { const session = this.require(workerId); if (session.state !== 'STARTED') throw new Error('WORKER_NOT_ACTIVE'); if (fence !== session.lease.fence || fence !== this.#fences.get(session.dossierId)) throw new Error('STALE_LEASE_FENCED'); if (Date.parse(now) >= Date.parse(session.lease.expiresAt)) { this.expire(workerId, now); throw new Error('LEASE_EXPIRED'); } return { accepted: true, workerId, dossierId: session.dossierId, fence }; }
  park(workerId: string, now: string, registryVersion: string) { const session = this.require(workerId); this.cleanupSession(session, now, 'PARK'); const descriptor = Object.freeze({ workerId: session.workerId, agentId: session.agentId, packageId: session.packageId, tenantId: session.tenantId, dossierId: session.dossierId, lastFence: session.lease.fence, registryVersion, declarationHash: session.declarationHash, state: 'PARKED' as const, parkedAt: now }); this.#parking.set(workerId, descriptor); this.#sessions.set(workerId, Object.freeze({ ...session, state: 'PARKED' })); this.emit({ ...session, state: 'PARKED' }, 'runtime.parked', now); return { ...descriptor };
  }
  stop(workerId: string, now: string) { const session = this.require(workerId); if (session.state === 'STARTED') this.cleanupSession(session, now, 'STOP'); this.#sessions.set(workerId, Object.freeze({ ...session, state: 'STOPPED' })); this.emit({ ...session, state: 'STOPPED' }, 'runtime.stopped', now); }
  fail(workerId: string, now: string) { const session = this.require(workerId); if (session.state === 'STARTED') this.cleanupSession(session, now, 'FAIL'); this.#sessions.set(workerId, Object.freeze({ ...session, state: 'FAILED' })); this.emit({ ...session, state: 'FAILED' }, 'runtime.failed', now); }
  expire(workerId: string, now: string) { const session = this.require(workerId); if (session.state === 'STARTED') this.cleanupSession(session, now, 'EXPIRE'); this.#sessions.set(workerId, Object.freeze({ ...session, state: 'EXPIRED' })); this.emit({ ...session, state: 'EXPIRED' }, 'runtime.expired', now); }
  sweepOrphans(now: string) { const expired: string[] = []; for (const session of this.#sessions.values()) if (session.state === 'STARTED' && Date.parse(now) >= Date.parse(session.lease.expiresAt)) { this.expire(session.workerId, now); expired.push(session.workerId); } return expired; }
  recover(descriptor: ParkingDescriptor, input: Omit<AdmissionRequest, 'dossierId' | 'agentId'>) { return this.start({ ...input, dossierId: descriptor.dossierId, agentId: descriptor.agentId }); }
  session(workerId: string) { const value = this.#sessions.get(workerId); return value ? { ...value, lease: { ...value.lease } } : undefined; }
  parking(workerId: string) { const value = this.#parking.get(workerId); return value ? { ...value } : undefined; }
  cleanup() { return this.#cleanup.map((item) => ({ ...item })); }
  events() { return this.#events.map((item) => ({ ...item })); }
  private require(workerId: string) { const value = this.#sessions.get(workerId); if (!value) throw new Error('WORKER_NOT_FOUND'); return value; }
  private cleanupSession(session: WorkerSession, now: string, reason: string) { const raw = { workerId: session.workerId, sessionId: session.sessionId, credentialsRevoked: true as const, scratchErased: true as const, memoryRetained: false as const, secretRetained: false as const, completedAt: now, reason }; this.#cleanup.push(Object.freeze({ ...raw, attestationHash: hash(stable(raw)) })); }
  private emit(session: WorkerSession, eventType: RuntimeLifecycleEvent['eventType'], occurredAt: string) { this.#events.push(Object.freeze({ eventId: `lifecycle-${randomUUID()}`, eventType, lifecycle: session.state, aggregateId: session.workerId, agentId: session.agentId, mandateId: session.mandateId, tenantId: session.tenantId, dossierId: session.dossierId, status: session.state, fence: session.lease.fence, occurredAt, declarationHash: session.declarationHash })); }
}

export function assertSafeParkingDescriptor(value: ParkingDescriptor) { const forbidden = ['sessionId', 'credentialId', 'scratchId', 'secret', 'token', 'memory', 'prompt', 'conversation']; const keys = Object.keys(value); if (forbidden.some((key) => keys.some((candidate) => candidate.toLowerCase().includes(key.toLowerCase())))) throw new Error('PARKING_DESCRIPTOR_CONTAINS_RUNTIME_STATE'); return true; }
function copyDeclaration<T extends AgentDeclaration>(input: T): T { return { ...input, capabilities: [...input.capabilities], tools: [...input.tools], tenantScope: [...input.tenantScope], riskClasses: [...input.riskClasses] }; }
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') { const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`; } return JSON.stringify(value); }
