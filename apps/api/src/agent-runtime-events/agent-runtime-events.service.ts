import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  DeclarativeAgentRegistry,
  EphemeralDossierRuntime,
  P3TurnLifecycleAdapter,
  RuntimeAdmissionController,
  executeP3AgentInspector,
  type TurnAgentLifecycle,
  type TurnLifecycleEventStore,
} from '../../../../packages/copilot-control-plane/dist/p3-api';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import type { AgentRuntimeEventInput } from './agent-runtime-event.contract';

@Injectable()
export class AgentRuntimeEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: AgentRuntimeEventInput, ctx: RequestContext) {
    const event = await this.prisma.agentRuntimeEvent.upsert({
      where: { companyId_eventId: { companyId: ctx.companyId, eventId: input.eventId } },
      create: { companyId: ctx.companyId, ...input, occurredAt: new Date(input.occurredAt) },
      update: {},
    });
    return serialize(event);
  }

  async read(ctx: RequestContext, options: { mandateId?: string; after?: string; limit?: number }) {
    const after = options.after && !Number.isNaN(Date.parse(options.after)) ? new Date(options.after) : undefined;
    const events = await this.prisma.agentRuntimeEvent.findMany({
      where: { companyId: ctx.companyId, ...(options.mandateId ? { mandateId: options.mandateId } : {}), ...(after ? { recordedAt: { gt: after } } : {}) },
      orderBy: options.mandateId ? [{ sequence: 'asc' }, { recordedAt: 'asc' }] : [{ recordedAt: 'asc' }, { sequence: 'asc' }],
      take: Math.min(Math.max(options.limit ?? 200, 1), 500),
    });
    const cursor = events.reduce<Date | undefined>((latest, event) => !latest || event.recordedAt > latest ? event.recordedAt : latest, undefined);
    return { events: events.map(serialize), cursor: cursor?.toISOString() ?? options.after ?? null };
  }

  async executeInspector(expectedOutcome: 'COMPLETED' | 'FAILED', ctx: RequestContext) {
    if (!ctx.roles.some((role) => ['company_owner', 'OWNER', 'PRODUCT_OWNER'].includes(role))) {
      throw new ForbiddenException('TURN_AGENT_EXECUTION_ROLE_REQUIRED');
    }
    const suffix = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const mandateId = `turn-production-${expectedOutcome.toLowerCase()}-${suffix}`;
    const dossierId = `dossier-${mandateId}`;
    const registry = new DeclarativeAgentRegistry('turn-runtime-production.v1');
    registry.register({
      agentId: 'agent-inspector',
      packageId: '@agm/agent-inspector',
      role: 'evidence inspector',
      capabilities: ['evidence:read'],
      tools: ['filesystem:read'],
      tenantScope: [ctx.companyId],
      riskClasses: ['LOW'],
      runtimePlacement: 'P3',
      dossierScoped: true,
      parkingPolicy: 'DESCRIPTOR_ONLY',
      enabled: true,
    });
    const runtime = new EphemeralDossierRuntime(new RuntimeAdmissionController(registry));
    const store: TurnLifecycleEventStore = {
      append: async (event: TurnAgentLifecycle) => {
        const { eventType: _eventType, ...input } = event;
        await this.append(input, ctx);
      },
      read: async (id: string) => {
        const result = await this.read(ctx, { mandateId: id, limit: 50 });
        return result.events.map((event) => ({
          ...event,
          lifecycle: event.lifecycle as TurnAgentLifecycle['lifecycle'],
          outputRef: event.outputRef ?? undefined,
          evidenceHash: event.evidenceHash ?? undefined,
          eventType: 'agent.lifecycle' as const,
        }));
      },
    };
    const adapter = new P3TurnLifecycleAdapter(store);
    const evidenceRef = expectedOutcome === 'COMPLETED'
      ? 'apps/api/runtime-evidence/agent-inspector-acceptance.json'
      : 'apps/api/runtime-evidence/agent-inspector-missing.json';
    let result: Awaited<ReturnType<typeof executeP3AgentInspector>> | undefined;
    let failure: string | undefined;
    try {
      result = await executeP3AgentInspector({
        agentId: 'agent-inspector',
        mandateId,
        tenantId: ctx.companyId,
        dossierId,
        riskClass: 'LOW',
        capabilities: ['evidence:read'],
        tools: ['filesystem:read'],
        now: new Date().toISOString(),
        leaseMs: 30_000,
        evidenceRef,
        evidenceRoot: process.cwd(),
        outputRoot: resolve(tmpdir(), 'agm-agent-inspector'),
      }, runtime, adapter);
    } catch (error) {
      failure = error instanceof Error ? error.message : 'AGENT_INSPECTOR_FAILED';
      if (expectedOutcome !== 'FAILED') throw error;
    }
    const persisted = await this.read(ctx, { mandateId, limit: 50 });
    const lifecycle = persisted.events.map((event) => event.lifecycle);
    const expectedLifecycle = expectedOutcome === 'COMPLETED'
      ? 'STARTED,WORKING,COMPLETED'
      : 'STARTED,WORKING,FAILED';
    if (lifecycle.join(',') !== expectedLifecycle) {
      throw new Error(`TURN_AGENT_LIFECYCLE_INVALID:${lifecycle.join(',')}`);
    }
    return {
      mandateId,
      agentId: 'agent-inspector',
      expectedOutcome,
      lifecycle,
      evidenceRef,
      outputRef: result?.result.outputRef ?? null,
      evidenceHash: result?.result.evidenceHash ?? null,
      failure: failure ?? null,
    };
  }
}

function serialize(event: { eventId: string; mandateId: string; agentId: string; dossierId: string; lifecycle: string; sequence: number; occurredAt: Date; recordedAt: Date; evidenceRef: string; outputRef: string | null; evidenceHash: string | null; detail: string }) {
  return { ...event, occurredAt: event.occurredAt.toISOString(), recordedAt: event.recordedAt.toISOString() };
}
