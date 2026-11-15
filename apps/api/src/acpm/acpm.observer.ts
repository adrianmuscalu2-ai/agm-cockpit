import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { AcpmEvent } from '@agm/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/request-context';
import { canonicalAcpm } from './acpm.canonical';

type Identity = Pick<AcpmEvent,'mandateId'|'chainId'|'componentId'|'componentKind'|'departmentId'>;
type Health = { accepted:number; persisted:number; failed:number; dropped:number; pending:number; missingIdentity:number };
export class AcpmPersistenceError extends Error {
  constructor(){super('ACPM_PERSISTENCE_FAILED');this.name='AcpmPersistenceError';}
}
/** Internal producer only. No HTTP surface, role escalation, or authority decisions.
 * Each newly observed event is committed to the shared PostgreSQL ledger before
 * the producer continues. It never scans or reconstructs historical events. */
@Injectable()
export class AcpmObserver {
  private pending=0;
  private lookups=0;
  private readonly tenants=new Map<string,Health>();
  readonly startedAt=new Date().toISOString();
  constructor(private readonly prisma:PrismaService) {}
  private counters(tenant:string) {
    let h=this.tenants.get(tenant);
    if(!h){h={accepted:0,persisted:0,failed:0,dropped:0,pending:0,missingIdentity:0};this.tenants.set(tenant,h);}
    return h;
  }
  health(tenant:string) { return {...this.counters(tenant),startedAt:this.startedAt,
    durability:'POSTGRES_TRANSACTION_COMMIT; SYNCHRONOUS_COMMIT_ON; UNIQUE_TENANT_EVENT_ID; HASH_CONFIRMED',
    scope:'NEW_EVENTS_ONLY; NOT_CLUSTER_OR_HISTORICAL_HEALTH'}; }
  async flush(){}
  async ready(){}
  async shutdown(){}
  private async persistInTransaction(tx:Prisma.TransactionClient,companyId:string,event:AcpmEvent) {
    const payload=canonicalAcpm(event);
    const digest=createHash('sha256').update(payload).digest('hex');
    await tx.$executeRaw`SET LOCAL synchronous_commit = on`;
    await tx.$executeRaw`INSERT INTO "AgentChainPerformanceEvent" ("companyId","eventId","recordedBy","payload","payloadHash") VALUES (${companyId}::uuid,${event.eventId}::uuid,${'acpm:internal-observer:v1'},${payload}::jsonb,${digest}) ON CONFLICT DO NOTHING`;
    const rows=await tx.$queryRaw<Array<{payloadHash:string}>>`SELECT "payloadHash" FROM "AgentChainPerformanceEvent" WHERE "companyId"=${companyId}::uuid AND "eventId"=${event.eventId}::uuid`;
    if(rows[0]?.payloadHash!==digest)throw new Error('ACPM_OBSERVER_HASH_CONFLICT');
  }
  private async persist(companyId:string,event:AcpmEvent) {
    const retryable=(error:unknown)=>{
      const value=error as {code?:string;meta?:{code?:string};cause?:{code?:string}};
      const code=value?.code??value?.meta?.code??value?.cause?.code??'';
      return ['P1001','P1002','P1008','P1017','P2024','40001','40P01','08000','08003','08006','08007'].includes(code);
    };
    for(let attempt=0;;attempt++) {
      try { await this.prisma.$transaction(tx=>this.persistInTransaction(tx,companyId,event));return; }
      catch(error) { if(!retryable(error)||attempt>=2)throw error; await new Promise(resolve=>setTimeout(resolve,25*(attempt+1))); }
    }
  }
  async persistNativeInTransaction(tx:Prisma.TransactionClient,ctx:RequestContext,input:{eventId:string;mandateId:string;agentId:string;dossierId:string;lifecycle:'STARTED'|'WORKING'|'COMPLETED'|'FAILED'|'BLOCKED';sequence:number;occurredAt:string;evidenceRef:string;evidenceHash?:string|null;detail:string}) {
    const kind=input.lifecycle;
    const event:AcpmEvent={eventId:input.eventId,chainId:input.mandateId,mandateId:input.mandateId,runId:input.dossierId,
      componentId:input.agentId,componentKind:input.agentId==='agent-inspector'?'INSPECTOR':'AGENT',kind,sequence:input.sequence,
      occurredAt:input.occurredAt,evidenceRef:input.evidenceRef,evidenceHash:input.evidenceHash??undefined,source:'ACP',
      ...(kind==='BLOCKED'?{block:{classification:'UNREVIEWED',reason:input.detail||'Native runtime reported BLOCKED',decisionRef:input.evidenceRef}}:{})};
    await this.persistInTransaction(tx,ctx.companyId,event);
  }
  noteNativeCommitted(tenant:string){const h=this.counters(tenant);h.accepted++;h.persisted++;}
  noteNativeFailed(tenant:string){this.counters(tenant).failed++;}
  private async enqueue(companyId:string,event:AcpmEvent) {
    const h=this.counters(companyId);
    this.pending++;h.pending++;h.accepted++;
    try { await this.persist(companyId,event);h.persisted++; }
    catch { h.failed++;throw new AcpmPersistenceError(); }
    finally {this.pending--;h.pending--;}
  }
  /** Bridges a newly written native runtime lifecycle event into ACPM. It preserves
   * the native event id, sequence, occurredAt and evidence; it never searches old rows. */
  /** Called only after the service's existing authority check. Lookup is tenant scoped,
   * read-only, and intentionally does not interpret a lease as an AI model identity. */
  async leaseIdentity(ctx:RequestContext,leaseId:string,componentId:string,componentKind:AcpmEvent['componentKind']):Promise<Identity|undefined> {
    let timeout:ReturnType<typeof setTimeout>|undefined;
    try {
      if(this.lookups>=16){this.counters(ctx.companyId).missingIdentity++;return undefined;}
      this.lookups++;
      const lookup=Promise.resolve().then(()=>this.prisma.authorityLease.findFirst({where:{id:leaseId,companyId:ctx.companyId,agentId:componentId},select:{mandateId:true}})).finally(()=>this.lookups--);
      // Racing does not cancel the DB query. The outstanding-query cap prevents
      // repeated requests from building an unbounded pool queue during an outage.
      const lease=await Promise.race([lookup,new Promise<undefined>(resolve=>{timeout=setTimeout(()=>resolve(undefined),250);})]);
      if(lease)return {mandateId:lease.mandateId,chainId:ctx.correlationId,componentId,componentKind};
    } catch { /* A telemetry lookup must not fail an authorized business action. */ }
    finally {if(timeout)clearTimeout(timeout);}
    this.counters(ctx.companyId).missingIdentity++;return undefined;
  }
  session(ctx:RequestContext,identity:Identity,evidenceRef:string) {
    const runId=randomUUID();let sequence=0;let state:'NEW'|'ACTIVE'|'PAUSED'|'TERMINAL'='NEW';
    let pending:{kind:AcpmEvent['kind'];metadata:string;event:AcpmEvent}|undefined;
    let emitTail:Promise<void>=Promise.resolve();
    const emit=(kind:AcpmEvent['kind'],metadata:Partial<Pick<AcpmEvent,'block'|'parentEventId'|'targetComponentId'>>={})=>{
      const work=emitTail.then(async()=>{
      const allowed=state==='NEW'?['STARTED']:state==='ACTIVE'?['WORKING','SUSPENDED','BLOCKED','HANDOFF','COMPLETED','FAILED']:state==='PAUSED'?['RESUMED','COMPLETED','FAILED']:[];
      const metadataKey=JSON.stringify(metadata);
      if(pending&&(pending.kind!==kind||pending.metadata!==metadataKey))throw new Error('ACPM_OBSERVER_PRIOR_EVENT_UNCONFIRMED');
      if(!pending&&!allowed.includes(kind))throw new Error('ACPM_OBSERVER_INVALID_TRANSITION');
      const event=pending?.event??{...identity,...metadata,runId,eventId:randomUUID(),sequence:sequence+1,kind,occurredAt:new Date().toISOString(),evidenceRef,source:'ACP' as const};
      pending??={kind,metadata:metadataKey,event};
      await this.enqueue(ctx.companyId,event);
      pending=undefined;sequence=event.sequence;
      state=kind==='COMPLETED'||kind==='FAILED'?'TERMINAL':kind==='SUSPENDED'||kind==='BLOCKED'?'PAUSED':'ACTIVE';
      return event;
      });
      emitTail=work.then(()=>undefined,()=>undefined);
      return work;
    };
    return {emit,wait:async<T>(operation:()=>Promise<T>)=>{
      await emit('SUSPENDED');
      let result:T;
      try {result=await operation();}
      catch(error){try{await emit('RESUMED');}catch{}throw error;}
      await emit('RESUMED');return result;
    }};
  }
  async measureSync<T>(ctx:RequestContext,identity:Identity|undefined,evidenceRef:string,operation:()=>T|Promise<T>,parentEventId?:string):Promise<T> {
    if(!identity)return await operation();
    const session=this.session(ctx,identity,evidenceRef);await session.emit('STARTED',parentEventId?{parentEventId}:{});
    let result:T;
    try {result=await operation();}
    catch(error){if(error instanceof AcpmPersistenceError)throw error;try{await session.emit('FAILED');}catch{}throw error;}
    await session.emit('COMPLETED');return result;
  }
  async pipeline<T>(ctx:RequestContext,identities:Array<Identity|undefined>,operation:(tracker:ReturnType<AcpmObserver['session']>|undefined)=>Promise<T>):Promise<T> {
    // A request can span several authority mandates. Never invent a parent mandate.
    if(identities.some(i=>!i)||new Set(identities.map(i=>i?.mandateId)).size!==1)return operation(undefined);
    const session=this.session(ctx,{...identities[0]!,componentId:'opportunity.analysis-pipeline',componentKind:'ORCHESTRATOR'},`opportunity-analysis:${ctx.correlationId}`);
    await session.emit('STARTED');
    let result:T;
    try{result=await operation(session);}
    catch(error){
      if(error instanceof AcpmPersistenceError)throw error;
      const status=(error as {getStatus?:()=>number})?.getStatus?.();
      try {
        if(status===403||status===409)await session.emit('BLOCKED',{block:{classification:'UNREVIEWED',reason:'Business gate prevented completion; no performance failure inferred',decisionRef:`opportunity-analysis:${ctx.correlationId}`}});
        else await session.emit('FAILED');
      } catch {}
      throw error;
    }
    await session.emit('COMPLETED');return result;
  }
}
