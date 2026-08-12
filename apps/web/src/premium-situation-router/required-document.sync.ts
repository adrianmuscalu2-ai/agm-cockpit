import { createLocalOperationalContextPorts } from '../premium-operational-context/local-adapters';
import { createOperationalEvent } from '../premium-operational-context/operational-event';
import { createActiveTripContext } from '../premium-operational-context/trip-context.service';
import { createHttpOperationalEventServer, synchronizeOperationalOutbox, type OperationalEventServerPort } from '../premium-operational-context/server-sync';
import type { OperationalCase } from './situation-router.types';
import { transitionOperationalCase } from './operational-case.machine';

const DEVICE_KEY='agm.premium.device-id.v1';
let writeQueue:Promise<unknown>=Promise.resolve();

type SliceStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;

export function enqueueRequiredDocumentTransition(storage:SliceStorage,value:OperationalCase,online:boolean) {
  return serialize(async()=>{
    const ports=createLocalOperationalContextPorts(storage);
    const deviceId=getDeviceId(storage);
    const runtime={now:()=>new Date().toISOString(),createId:()=>crypto.randomUUID(),deviceId};
    const context=await createActiveTripContext(ports,runtime);
    const operationId=await deterministicUuid(`slice-a:${value.id}:revision:${value.revision}`);
    const existing=(await ports.eventStore.readTrip(context.tripId)).find((event)=>event.eventId===operationId);
    if(existing) return {status:'duplicate' as const,operationId,tripId:context.tripId};
    const events=await ports.eventStore.readTrip(context.tripId);
    const last=events.at(-1);
    const aggregateVersion=(last?.aggregateVersion??-1)+1;
    const flags=[...new Set([...context.flags,'SYNC_PENDING' as const,...(!online?['OFFLINE' as const]:[])])];
    const event={...createOperationalEvent({eventId:operationId,eventType:'premium.required-document.transition.v1',occurredAt:value.updatedAt,tripId:context.tripId,aggregateVersion,lifecycleState:context.lifecycleState,operationalFlags:flags,moduleId:'premium-required-document',actor:{type:'user'},deviceId,operationId,correlationId:await deterministicUuid(`slice-a:${value.id}`),previousEventId:last?.eventId,deviceSequence:aggregateVersion+1,payload:{caseId:value.id,caseRevision:value.revision,caseSnapshot:value}}),evidenceRefs:value.evidence.map((item)=>item.id)};
    await ports.eventStore.append(event);
    await ports.outbox.enqueue(event);
    return {status:'pending' as const,operationId,tripId:context.tripId};
  });
}

export function flushRequiredDocumentTransitions(input:{storage:SliceStorage;value:OperationalCase;server?:OperationalEventServerPort}) {
  return serialize(async()=>{
    const ports=createLocalOperationalContextPorts(input.storage);
    const context=await ports.repository.readActive();
    if(!context)return {status:'idle' as const,acknowledged:0,conflicts:0,projection:null};
    const server=input.server??createHttpOperationalEventServer({baseUrl:apiBaseUrl(),token:()=>sessionStorage.getItem('agm.auth.accessToken')??localStorage.getItem('agm.auth.accessToken')});
    return synchronizeOperationalOutbox({tripId:context.tripId,ports,server,maxAttempts:3});
  });
}

export async function pendingRequiredDocumentTransitions(storage:SliceStorage) {
  const ports=createLocalOperationalContextPorts(storage);const context=await ports.repository.readActive();
  return context?ports.outbox.pending(context.tripId):[];
}

export function applyRequiredDocumentSyncResult(value:OperationalCase,result:{status:string}) {
  if(result.status==='conflict'){
    const recovered=transitionOperationalCase(value,{type:'REQUIRE_RECOVERY',reason:'SYNC_CONFLICT'});
    return {...recovered,data:{...recovered.data,syncStatus:'RECOVERY_REQUIRED'}};
  }
  return {...value,data:{...value.data,syncStatus:result.status==='synchronized'||result.status==='idle'?'SYNCED':'SYNC_PENDING'}};
}

function serialize<T>(operation:()=>Promise<T>){const next=writeQueue.then(operation,operation);writeQueue=next.then(()=>undefined,()=>undefined);return next;}
function getDeviceId(storage:Pick<Storage,'getItem'|'setItem'>){let id=storage.getItem(DEVICE_KEY);if(!id){id=crypto.randomUUID();storage.setItem(DEVICE_KEY,id);}return id;}
function apiBaseUrl(){return (import.meta.env.VITE_AGM_API_BASE_URL?.trim()||'/api/v1').replace(/\/$/,'');}
async function deterministicUuid(value:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).slice(0,16);bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map((item)=>item.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
