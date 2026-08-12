import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { OperationalEventStoreService } from '../src/operational-event-store/operational-event-store.service';

async function run() {
  const prisma = new PrismaClient();
  const company = await prisma.company.findFirst({ select: { id: true, users: { select: { id: true }, take: 1 } } });
  if (!company?.users[0]) throw new Error('P1_DB_FIXTURE_REQUIRES_EXISTING_LOCAL_TENANT');
  const tripId = randomUUID(), deviceId = randomUUID();
  const ctx = { companyId: company.id, userId: company.users[0].id, roles: [], requestId: randomUUID(), correlationId: randomUUID() };
  const service = new OperationalEventStoreService(prisma as any);
  const makeEvent = (version: number, previousEventId?: string) => ({ schemaVersion:'operational-event.v1' as const,eventId:randomUUID(),eventType:'trip.p1.db-proof.v1',eventVersion:1 as const,occurredAt:new Date().toISOString(),recordedAt:new Date().toISOString(),tripId,aggregateType:'TripContext' as const,aggregateId:tripId,aggregateVersion:version,lifecycleState:'DRAFT',operationalFlags:[],moduleId:'p1-proof',actor:{type:'system' as const},device:{id:deviceId},operationId:randomUUID(),correlationId:randomUUID(),payload:{proof:true,version},evidenceRefs:[],classification:'INTERNAL',retentionPolicyId:'RET-TRIP-STANDARD',sync:{status:'pending',deviceSequence:version+1},integrity:{previousEventId} });
  const first=makeEvent(0), second=makeEvent(1,first.eventId);
  try {
    const synced=await service.sync([{idempotencyKey:first.eventId,expectedStreamVersion:-1,event:first},{idempotencyKey:second.eventId,expectedStreamVersion:0,event:second}],ctx);
    assert.deepEqual(synced.results.map((r)=>r.status),['acknowledged','acknowledged']);
    const duplicate=await service.sync([{idempotencyKey:first.eventId,expectedStreamVersion:-1,event:first}],ctx); assert.equal(duplicate.results[0].status,'duplicate');
    const replay=await service.read(tripId,-1,ctx); assert.equal(replay.serverVersion,1); assert.equal(replay.events.length,2);
    console.log('P1 PostgreSQL EventStore append/idempotency/replay E2E: PASS');
  } finally {
    await prisma.operationalEventStream.deleteMany({ where: { companyId: company.id, streamId: tripId } });
    await prisma.$disconnect();
  }
}
void run();
