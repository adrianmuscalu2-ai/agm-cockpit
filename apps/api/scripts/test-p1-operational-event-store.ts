import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OperationalEventStoreService } from '../src/operational-event-store/operational-event-store.service';

const streams:any[]=[]; const events:any[]=[];
const tx:any={
  operationalEvent:{
    findFirst:async({where,orderBy,select}:any)=>{ let rows=events.filter((e)=>!where.companyId||e.companyId===where.companyId).filter((e)=>!where.streamRecordId||e.streamRecordId===where.streamRecordId); if(where.OR) rows=rows.filter((e:any)=>where.OR.some((c:any)=>c.eventId===e.eventId||c.idempotencyKey===e.idempotencyKey)); if(orderBy) rows.sort((a,b)=>b.aggregateVersion-a.aggregateVersion); const row=rows[0]; return row&&select?{eventId:row.eventId}:row; },
    create:async({data}:any)=>{events.push({...data});return data;},
  },
  operationalEventStream:{
    upsert:async({where,create}:any)=>{let row=streams.find((s)=>s.companyId===where.companyId_streamId.companyId&&s.streamId===where.companyId_streamId.streamId);if(!row){row={id:randomUUID(),...create,projection:null};streams.push(row);}return {...row};},
    updateMany:async({where,data}:any)=>{const row=streams.find((s)=>s.id===where.id&&s.currentVersion===where.currentVersion);if(!row)return{count:0};Object.assign(row,data);return{count:1};},
    findUnique:async({where,include}:any)=>{const key=where.companyId_streamId;const row=where.id?streams.find((s)=>s.id===where.id):streams.find((s)=>s.companyId===key.companyId&&s.streamId===key.streamId);if(!row)return null;if(!include)return{...row};return{...row,events:events.filter((e)=>e.streamRecordId===row.id&&e.aggregateVersion>include.events.where.aggregateVersion.gt).sort((a,b)=>a.aggregateVersion-b.aggregateVersion)};},
  },
};
const prisma:any={...tx,$transaction:async(fn:any)=>fn(tx)};
const service=new OperationalEventStoreService(prisma);
const ctx:any={companyId:randomUUID(),userId:randomUUID(),roles:[],requestId:randomUUID(),correlationId:randomUUID()};
const tripId=randomUUID(), deviceId=randomUUID();
function event(version:number,previousEventId?:string){return{schemaVersion:'operational-event.v1' as const,eventId:randomUUID(),eventType:'trip.test.v1',eventVersion:1 as const,occurredAt:new Date().toISOString(),recordedAt:new Date().toISOString(),tripId,aggregateType:'TripContext' as const,aggregateId:tripId,aggregateVersion:version,lifecycleState:'DRAFT',operationalFlags:[],moduleId:'test',actor:{type:'system' as const},device:{id:deviceId},operationId:randomUUID(),correlationId:randomUUID(),payload:{version},evidenceRefs:[],classification:'INTERNAL',retentionPolicyId:'RET-TRIP-STANDARD',sync:{status:'pending',deviceSequence:version+1},integrity:{previousEventId}};}
async function run() {
const first=event(0); const second=event(1,first.eventId);
const initial=await service.sync([{idempotencyKey:first.eventId,expectedStreamVersion:-1,event:first},{idempotencyKey:second.eventId,expectedStreamVersion:0,event:second}],ctx);
assert.deepEqual(initial.results.map((r)=>r.status),['acknowledged','acknowledged']); assert.equal(events.length,2);
const duplicate=await service.sync([{idempotencyKey:first.eventId,expectedStreamVersion:-1,event:first}],ctx); assert.equal(duplicate.results[0].status,'duplicate'); assert.equal(events.length,2);
const stale=event(1,first.eventId); const conflict=await service.sync([{idempotencyKey:stale.eventId,expectedStreamVersion:0,event:stale}],ctx); assert.equal(conflict.results[0].status,'conflict'); assert.equal(events.length,2);
const replay=await service.read(tripId,-1,ctx); assert.equal(replay.serverVersion,1); assert.equal(replay.events.length,2); assert.equal((replay.projection as any).lastEventId,second.eventId);
console.log('P1 operational EventStore idempotency/version/replay tests: PASS');
}
void run();
