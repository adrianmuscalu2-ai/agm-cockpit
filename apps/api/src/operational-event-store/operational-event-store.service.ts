import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { validateEventSyncItem, type EventSyncItem, type OperationalEventEnvelopeV1 } from './operational-event.contract';

type SyncResult = { eventId: string; status: 'acknowledged' | 'duplicate' | 'conflict'; serverVersion: number; reason?: string };

@Injectable()
export class OperationalEventStoreService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(values: unknown[], ctx: RequestContext) {
    if (!values.length) return { results: [], projections: [] };
    let items: EventSyncItem[];
    try { items = values.map(validateEventSyncItem); }
    catch { throw new BadRequestException({ code: 'OPERATIONAL_EVENT_INVALID' }); }
    const duplicateIds = new Set<string>();
    for (const item of items) {
      if (duplicateIds.has(item.event.eventId)) throw new BadRequestException({ code: 'DUPLICATE_EVENT_IN_BATCH' });
      duplicateIds.add(item.event.eventId);
    }
    const results: SyncResult[] = [];
    for (const item of items) results.push(await this.append(item, ctx));
    const streamIds = [...new Set(items.map((item) => item.event.tripId))];
    return { results, projections: await Promise.all(streamIds.map((id) => this.projection(id, ctx))) };
  }

  async read(streamId: string, afterVersion: number, ctx: RequestContext) {
    const stream = await this.prisma.operationalEventStream.findUnique({
      where: { companyId_streamId: { companyId: ctx.companyId, streamId } },
      include: { events: { where: { aggregateVersion: { gt: afterVersion } }, orderBy: { aggregateVersion: 'asc' } } },
    });
    if (!stream) return { streamId, serverVersion: -1, events: [], projection: null };
    return { streamId, serverVersion: stream.currentVersion, events: stream.events.map((row) => row.envelope), projection: stream.projection };
  }

  private async append(item: EventSyncItem, ctx: RequestContext): Promise<SyncResult> {
    const event = item.event;
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.operationalEvent.findFirst({
        where: { companyId: ctx.companyId, OR: [{ eventId: event.eventId }, { idempotencyKey: item.idempotencyKey }] },
      });
      if (duplicate) {
        if (canonical(duplicate.envelope) !== canonical(event)) return { eventId: event.eventId, status: 'conflict', serverVersion: duplicate.aggregateVersion, reason: 'IDEMPOTENCY_INTEGRITY_CONFLICT' };
        return { eventId: event.eventId, status: 'duplicate', serverVersion: duplicate.aggregateVersion };
      }
      const stream = await tx.operationalEventStream.upsert({
        where: { companyId_streamId: { companyId: ctx.companyId, streamId: event.tripId } },
        create: { companyId: ctx.companyId, streamId: event.tripId, aggregateType: event.aggregateType, currentVersion: -1 },
        update: {},
      });
      if (stream.currentVersion !== item.expectedStreamVersion) return { eventId: event.eventId, status: 'conflict', serverVersion: stream.currentVersion, reason: 'STREAM_VERSION_CONFLICT' };
      if ((event.integrity.previousEventId ?? null) !== await this.lastEventId(tx, stream.id)) return { eventId: event.eventId, status: 'conflict', serverVersion: stream.currentVersion, reason: 'EVENT_CHAIN_CONFLICT' };
      const claimed = await tx.operationalEventStream.updateMany({
        where: { id: stream.id, currentVersion: item.expectedStreamVersion },
        data: { currentVersion: event.aggregateVersion, projection: project(event) as Prisma.InputJsonValue },
      });
      if (claimed.count !== 1) {
        const latest = await tx.operationalEventStream.findUnique({ where: { id: stream.id } });
        return { eventId: event.eventId, status: 'conflict', serverVersion: latest?.currentVersion ?? -1, reason: 'CONCURRENT_APPEND' };
      }
      await tx.operationalEvent.create({ data: {
        companyId: ctx.companyId, streamRecordId: stream.id, eventId: event.eventId,
        idempotencyKey: item.idempotencyKey, schemaVersion: event.schemaVersion, eventType: event.eventType,
        eventVersion: event.eventVersion, aggregateVersion: event.aggregateVersion, deviceId: event.device.id,
        deviceSequence: event.sync.deviceSequence, operationId: event.operationId, correlationId: event.correlationId,
        occurredAt: new Date(event.occurredAt), recordedAt: new Date(event.recordedAt),
        payload: event.payload as Prisma.InputJsonValue, envelope: event as unknown as Prisma.InputJsonValue,
      }});
      return { eventId: event.eventId, status: 'acknowledged', serverVersion: event.aggregateVersion };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async lastEventId(tx: Prisma.TransactionClient, streamRecordId: string) {
    const row = await tx.operationalEvent.findFirst({ where: { streamRecordId }, orderBy: { aggregateVersion: 'desc' }, select: { eventId: true } });
    return row?.eventId ?? null;
  }

  private async projection(streamId: string, ctx: RequestContext) {
    const stream = await this.prisma.operationalEventStream.findUnique({ where: { companyId_streamId: { companyId: ctx.companyId, streamId } } });
    return { streamId, serverVersion: stream?.currentVersion ?? -1, projection: stream?.projection ?? null };
  }
}

function project(event: OperationalEventEnvelopeV1) {
  return { schemaVersion: 'operational-projection.v1', tripId: event.tripId, contextVersion: event.aggregateVersion,
    lifecycleState: event.lifecycleState, flags: event.operationalFlags, lastEventId: event.eventId, updatedAt: event.occurredAt };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') { const r = value as Record<string, unknown>; return `{${Object.keys(r).filter((k) => r[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(r[k])}`).join(',')}}`; }
  return JSON.stringify(value);
}
