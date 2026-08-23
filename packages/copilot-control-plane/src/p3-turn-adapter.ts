import { randomUUID } from 'node:crypto';
import type { EphemeralDossierRuntime, AdmissionRequest } from './p3-runtime';
import { executeAgentInspector, type InspectorExecutionContext, type InspectorLifecycle, type InspectorExecutionResult } from './agent-inspector-executor';

export type TurnAgentLifecycle = Readonly<{
  eventId: string;
  eventType: 'agent.lifecycle';
  lifecycle: InspectorLifecycle['eventType'];
  sequence: number;
  agentId: string;
  mandateId: string;
  dossierId: string;
  occurredAt: string;
  evidenceRef: string;
  outputRef?: string;
  evidenceHash?: string;
  detail: string;
}>;

export interface TurnLifecycleEventStore {
  append(event: TurnAgentLifecycle): Promise<void> | void;
  read(mandateId: string): Promise<readonly TurnAgentLifecycle[]> | readonly TurnAgentLifecycle[];
}

export class InMemoryTurnLifecycleEventStore implements TurnLifecycleEventStore {
  readonly #events: TurnAgentLifecycle[] = [];
  append(event: TurnAgentLifecycle) { this.#events.push(Object.freeze({ ...event })); }
  read(mandateId: string) { return this.#events.filter((event) => event.mandateId === mandateId).map((event) => ({ ...event })); }
}

export class P3TurnLifecycleAdapter {
  readonly #pending = new Set<Promise<void>>();
  readonly #sequences = new Map<string, number>();
  constructor(private readonly store: TurnLifecycleEventStore) {}
  ingest(event: InspectorLifecycle) {
    const key = `${event.mandateId}:${event.agentId}`;
    const sequence = (this.#sequences.get(key) ?? 0) + 1;
    this.#sequences.set(key, sequence);
    const mapped: TurnAgentLifecycle = { eventId: randomUUID(), eventType: 'agent.lifecycle', lifecycle: event.eventType, sequence, agentId: event.agentId, mandateId: event.mandateId, dossierId: event.dossierId, occurredAt: event.occurredAt, evidenceRef: event.evidenceRef, outputRef: event.outputRef, evidenceHash: event.evidenceHash, detail: event.detail };
    const pending = Promise.resolve(this.store.append(mapped)).then(() => undefined);
    this.#pending.add(pending);
    void pending.finally(() => this.#pending.delete(pending));
    return mapped;
  }
  async flush() { await Promise.all([...this.#pending]); }
}

export class HttpTurnLifecycleEventStore implements TurnLifecycleEventStore {
  readonly #baseUrl: string;
  constructor(input: { baseUrl: string; accessToken: () => string | undefined; fetch?: typeof fetch }) { this.#baseUrl = input.baseUrl.replace(/\/$/, ''); this.accessToken = input.accessToken; this.fetcher = input.fetch ?? fetch; }
  private readonly accessToken: () => string | undefined;
  private readonly fetcher: typeof fetch;
  async append(event: TurnAgentLifecycle) {
    const token = this.accessToken();
    if (!token) throw new Error('TURN_LIFECYCLE_AUTH_REQUIRED');
    const { eventType: _eventType, ...body } = event;
    const response = await this.fetcher(`${this.#baseUrl}/agent-runtime-events`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`TURN_LIFECYCLE_APPEND_HTTP_${response.status}`);
  }
  async read(mandateId: string) {
    const token = this.accessToken();
    if (!token) throw new Error('TURN_LIFECYCLE_AUTH_REQUIRED');
    const response = await this.fetcher(`${this.#baseUrl}/agent-runtime-events?mandateId=${encodeURIComponent(mandateId)}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!response.ok) throw new Error(`TURN_LIFECYCLE_READ_HTTP_${response.status}`);
    const payload = await response.json() as { data?: { events?: Array<Omit<TurnAgentLifecycle, 'eventType'> & { recordedAt: string }> } };
    return (payload.data?.events ?? []).map((event) => ({ ...event, eventType: 'agent.lifecycle' as const }));
  }
}

export type ExecutableAgentContext = InspectorExecutionContext;

export class ExecutableAgentRegistry {
  readonly #targets = new Map<string, (context: ExecutableAgentContext) => Promise<InspectorExecutionResult>>();
  register(agentId: string, target: (context: ExecutableAgentContext) => Promise<InspectorExecutionResult>) { if (this.#targets.has(agentId)) throw new Error(`EXECUTABLE_TARGET_ALREADY_REGISTERED:${agentId}`); this.#targets.set(agentId, target); }
  resolve(agentId: string) { return this.#targets.get(agentId); }
}

export const defaultExecutableAgentRegistry = new ExecutableAgentRegistry();
defaultExecutableAgentRegistry.register('agent-inspector', executeAgentInspector);

export async function executeP3AgentInspector(input: AdmissionRequest & Omit<InspectorExecutionContext, 'mandateId' | 'agentId' | 'dossierId' | 'now' | 'onLifecycle'> & { mandateId: string; now?: () => Date }, runtime: EphemeralDossierRuntime, adapter: P3TurnLifecycleAdapter, registry = defaultExecutableAgentRegistry) {
  const target = registry.resolve(input.agentId);
  if (!target) throw new Error(`NOT_EXECUTABLE:${input.agentId}`);
  const session = runtime.start(input);
  try {
    const result = await target({ mandateId: input.mandateId, agentId: 'agent-inspector', dossierId: input.dossierId, evidenceRef: input.evidenceRef, evidenceRoot: input.evidenceRoot, outputRoot: input.outputRoot, capabilities: ['evidence:read'], tools: ['filesystem:read'], now: input.now ? () => new Date(input.now) : undefined, onLifecycle: (event) => { adapter.ingest(event); } });
    return { session, result };
  } finally {
    await adapter.flush();
  }
}
