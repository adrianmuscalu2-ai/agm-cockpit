import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createActiveTripContext, createLocalOperationalContextPorts, synchronizeOperationalOutbox, type EventSyncResponse } from '../src/premium-operational-context';

function memory() { const values = new Map<string,string>(); return { getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k) }; }
const ports = createLocalOperationalContextPorts(memory());
const runtime = { now:()=>new Date().toISOString(), createId:()=>randomUUID(), deviceId:randomUUID() };
const trip = await createActiveTripContext(ports, runtime);
let calls = 0;
const accepted = new Map<string, unknown>();
const server = {
  async sync(items: any[]): Promise<EventSyncResponse> { calls += 1; if (calls < 2) throw new Error('OFFLINE'); return { results: items.map(({event}:any) => { const duplicate=accepted.has(event.eventId); accepted.set(event.eventId,event); return { eventId:event.eventId,status:duplicate?'duplicate':'acknowledged',serverVersion:event.aggregateVersion }; }), projections: items.map(({event}:any)=>({streamId:event.tripId,serverVersion:event.aggregateVersion,projection:{schemaVersion:'operational-projection.v1',tripId:event.tripId,contextVersion:event.aggregateVersion,lifecycleState:event.lifecycleState,flags:event.operationalFlags,lastEventId:event.eventId,updatedAt:event.occurredAt}})) }; },
  async read() { return { serverVersion:0, events:[...accepted.values()] as any[], projection:null }; },
};
const recovered = await synchronizeOperationalOutbox({ tripId:trip.tripId, ports, server, retry:async()=>{} });
assert.equal(recovered.status,'synchronized'); assert.equal(calls,2); assert.equal((await ports.outbox.pending(trip.tripId)).length,0); assert.equal(accepted.size,1);
const idle = await synchronizeOperationalOutbox({ tripId:trip.tripId, ports, server }); assert.equal(idle.status,'idle');

const conflictPorts = createLocalOperationalContextPorts(memory()); const conflictedTrip = await createActiveTripContext(conflictPorts, runtime);
const conflictServer = { async sync(items:any[]):Promise<EventSyncResponse>{ return {results:items.map(({event}:any)=>({eventId:event.eventId,status:'conflict',serverVersion:4,reason:'STREAM_VERSION_CONFLICT'})),projections:[]};}, async read(){return {serverVersion:4,events:[],projection:{schemaVersion:'operational-projection.v1' as const,tripId:conflictedTrip.tripId,contextVersion:4,lifecycleState:'TRIP_ACTIVE',flags:['RECOVERY_REQUIRED'],lastEventId:randomUUID(),updatedAt:new Date().toISOString()}};} };
const conflict = await synchronizeOperationalOutbox({tripId:conflictedTrip.tripId,ports:conflictPorts,server:conflictServer});
assert.equal(conflict.status,'conflict'); assert.equal(conflict.conflicts,1); assert.equal((await conflictPorts.outbox.pending(conflictedTrip.tripId))[0].sync.status,'conflict'); assert.equal(conflict.projection?.contextVersion,4);
const conflictEvent=(await conflictPorts.outbox.pending(conflictedTrip.tripId))[0];
await conflictPorts.outbox.resolveConflict(conflictEvent.eventId,'retry-local'); assert.equal((await conflictPorts.outbox.pending(conflictedTrip.tripId))[0].sync.status,'pending');
await conflictPorts.outbox.markConflict(conflictEvent.eventId); await conflictPorts.outbox.resolveConflict(conflictEvent.eventId,'accept-server');
assert.equal((await conflictPorts.outbox.pending(conflictedTrip.tripId)).length,0); assert.equal((await conflictPorts.outbox.resolvedConflicts(conflictedTrip.tripId)).length,1);
console.log('Premium EventStore online/offline/reconnect/conflict E2E: PASS');
