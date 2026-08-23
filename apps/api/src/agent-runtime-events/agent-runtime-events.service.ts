import { Injectable } from '@nestjs/common';
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
}

function serialize(event: { eventId: string; mandateId: string; agentId: string; dossierId: string; lifecycle: string; sequence: number; occurredAt: Date; recordedAt: Date; evidenceRef: string; outputRef: string | null; evidenceHash: string | null; detail: string }) {
  return { ...event, occurredAt: event.occurredAt.toISOString(), recordedAt: event.recordedAt.toISOString() };
}
