import { ServiceUnavailableException, BadRequestException, ConflictException, ForbiddenException, Injectable, Optional, Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { projectAcp, asAcpm, selectAcpm, type AcpmFilters, type AcpmEvent } from '@agm/shared';
import { AcpmObserver } from './acpm.observer';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/request-context';
import type { AppendAcpmEventDto } from './acpm.dto';
import { premiumNetworkSeed } from '../authority-control-plane/premium-network.seed';
import { basicAgentDutySeed } from '../authority-control-plane/basic-agent-duty.seed';

import { canonicalAcpm } from './acpm.canonical';
import { AcpmSemanticIndex, type SemanticQuery } from './acpm.semantic';
import { readAcpmHistory } from './acpm.repository';
import { ACPM_RUNTIME_SESSION } from './acpm.runtime';
import { AGMATCC_COPILOT_CONTRACT } from '../agmatcc-copilot/agmatcc-copilot.contract';
export { canonicalAcpm } from './acpm.canonical';
export function legacyAcp(row: {eventId:string; mandateId:string; agentId:string; dossierId:string; lifecycle:string; sequence:number; occurredAt:Date; evidenceRef:string; evidenceHash:string|null}): AcpmEvent {
  return { eventId:row.eventId,chainId:row.mandateId,mandateId:row.mandateId,runId:row.dossierId,componentId:row.agentId,componentKind:'UNKNOWN',kind:row.lifecycle as AcpmEvent['kind'],sequence:row.sequence,occurredAt:row.occurredAt.toISOString(),evidenceRef:row.evidenceRef,evidenceHash:row.evidenceHash ?? undefined,source:'LEGACY' };
}
@Injectable()
export class AcpmService {
  private readonly semanticViews = new Map<string, AcpmSemanticIndex>();
  private readonly semanticInFlight = new Map<string, Promise<Awaited<ReturnType<AcpmService['buildSemanticView']>>>>();
  private readonly snapshotsInFlight = new Map<string, Promise<Awaited<ReturnType<AcpmService['buildSnapshot']>>>>();
  constructor(private readonly prisma: PrismaService, @Optional() @Inject(AcpmObserver) private readonly observer?:AcpmObserver) {}
  private requireReader(ctx: RequestContext) {
    if (!ctx.roles.some(r=>['company_owner','OWNER','PRODUCT_OWNER'].includes(r))) throw new ForbiddenException('ACP_OWNER_REQUIRED');
  }
  async append(input: AppendAcpmEventDto, ctx: RequestContext) {
    this.requireReader(ctx);
    if (Date.parse(input.occurredAt)>Date.now()) throw new BadRequestException('ACP_FUTURE_EVENT');
    if (input.kind==='HANDOFF' && !input.targetComponentId) throw new BadRequestException('ACP_HANDOFF_TARGET_REQUIRED');
    if (input.kind==='BLOCKED' && !input.block) throw new BadRequestException('ACP_BLOCK_ASSESSMENT_REQUIRED');
    if(input.supersedesEventId) {
      const prior=await this.prisma.$queryRaw<Array<{payload:AcpmEvent}>>`SELECT "payload" FROM "AgentChainPerformanceEvent" WHERE "companyId"=${ctx.companyId}::uuid AND "eventId"=${input.supersedesEventId}::uuid`;
      const original=prior[0]?.payload;
      if(!original || !input.correctionReason || original.eventId===input.eventId || ['chainId','runId','mandateId','componentId','sequence'].some(k=>original[k as keyof AcpmEvent]!==input[k as keyof AppendAcpmEventDto])) throw new BadRequestException('ACP_INVALID_CORRECTION');
    }
    const payload = canonicalAcpm({...input,source:'ACP'});
    const hash = createHash('sha256').update(payload).digest('hex');
    // ON CONFLICT never overwrites an observation. Conflicting idempotency keys are rejected.
    await this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SET LOCAL synchronous_commit = on`;
      await tx.$executeRaw`INSERT INTO "AgentChainPerformanceEvent" ("companyId","eventId","recordedBy","payload","payloadHash") VALUES (${ctx.companyId}::uuid,${input.eventId}::uuid,${ctx.userId},${payload}::jsonb,${hash}) ON CONFLICT DO NOTHING`;
      const rows = await tx.$queryRaw<Array<{payloadHash:string}>>`SELECT "payloadHash" FROM "AgentChainPerformanceEvent" WHERE "companyId"=${ctx.companyId}::uuid AND "eventId"=${input.eventId}::uuid`;
      if (rows[0]?.payloadHash!==hash) throw new ConflictException('ACP_EVENT_ID_CONFLICT');
    });
    return {eventId:input.eventId,payloadHash:hash};
  }
  async snapshot(ctx: RequestContext): Promise<Awaited<ReturnType<AcpmService['buildSnapshot']>>> {
    this.requireReader(ctx);
    const pending=this.snapshotsInFlight.get(ctx.companyId);
    if(pending)return pending;
    if(this.snapshotsInFlight.size)throw new ServiceUnavailableException('ACPM_HISTORY_BUSY_RETRY');
    const work=this.buildSnapshot(ctx);this.snapshotsInFlight.set(ctx.companyId,work);
    try{return await work;}finally{this.snapshotsInFlight.delete(ctx.companyId);}
  }
  private async buildSnapshot(ctx: RequestContext) {
    this.requireReader(ctx);
    const {observations,legacy,pagination}=await readAcpmHistory(this.prisma,ctx.companyId);
    const integrityErrors = observations.filter(r=>createHash('sha256').update(canonicalAcpm(r.payload)).digest('hex')!==r.payloadHash).map(r=>r.payload.eventId);
    if (integrityErrors.length) throw new ConflictException('ACP_STORED_PAYLOAD_HASH_MISMATCH');
    const truncated = false;
    const current=observations.map(r=>r.payload);
    const currentById=new Map(current.map(event=>[event.eventId,event]));
    const legacyEvents=legacy.map(legacyAcp).filter(event=>{
      const native=currentById.get(event.eventId); if(!native)return true;
      // Native runtime rows are bridged with the same identity/evidence. Prefer
      // that ACPM representation; retain a divergent pair so the engine exposes
      // the conflict instead of silently merging unlike observations.
      return native.chainId!==event.chainId||native.mandateId!==event.mandateId||native.runId!==event.runId||native.componentId!==event.componentId||native.sequence!==event.sequence||native.occurredAt!==event.occurredAt||native.evidenceRef!==event.evidenceRef||native.evidenceHash!==event.evidenceHash||native.kind!==event.kind;
    });
    const snapshot = projectAcp([...current,...legacyEvents],new Date().toISOString(),truncated);
    const declarations=[...premiumNetworkSeed.filter(n=>n.kind!=='HUMAN_AUTHORITY'),...basicAgentDutySeed.map(n=>({...n,supervisorId:null}))];
    const inventory=declarations.map(n=>({componentId:n.canonicalId,kind:n.kind,module:n.module,supervisorId:n.supervisorId,scope:n.scope,
      observation:snapshot.runs.some(r=>r.componentId===n.canonicalId)?'OBSERVED':'NO_PERFORMANCE_EVENTS'}));
    return {...snapshot, inventory, provenance:{ledger:'AgentChainPerformanceEvent',legacy:'AgentRuntimeEvent',registry:'premiumNetworkSeed + basicAgentDutySeed (declarations, not execution proof)',payloadHashesVerified:observations.length,sourceEvidenceContentVerified:false,pagination,
      internalProviderEventIds:observations.filter(r=>r.recordedBy==='agmatcc:internal-measurement:v1').map(r=>r.payload.eventId)}, coverageLimit:'All persisted rows in a consistent snapshot; unrecorded metadata remains UNKNOWN.'};
  }
  async monitor(ctx:RequestContext,filters:AcpmFilters={}) {
    const snapshot=await this.snapshot(ctx);
    try { return {...selectAcpm(asAcpm(snapshot),filters),provenance:snapshot.provenance,coverageLimit:snapshot.coverageLimit,observerHealth:this.observer?.health(ctx.companyId)}; }
    catch { throw new BadRequestException('ACPM_INVALID_FILTERS'); }
  }
  private async semanticView(ctx: RequestContext, rebuild = false): Promise<Awaited<ReturnType<AcpmService['buildSemanticView']>>> {
    this.requireReader(ctx);
    const pending=this.semanticInFlight.get(ctx.companyId);
    if(pending) {
      if(rebuild){await pending;return this.semanticView(ctx,true);}
      return pending;
    }
    // One full-history builder per process bounds peak memory; no events are omitted.
    if(this.semanticInFlight.size)throw new ServiceUnavailableException('ACPM_INDEX_BUSY_RETRY');
    const work=this.buildSemanticView(ctx,rebuild);
    this.semanticInFlight.set(ctx.companyId,work);
    try{return await work;}finally{this.semanticInFlight.delete(ctx.companyId);}
  }
  private async buildSemanticView(ctx: RequestContext, rebuild = false) {
    // snapshot performs the unchanged OWNER check, tenant filtering and hash validation.
    const snapshot = await this.snapshot(ctx);
    let index = rebuild ? undefined : this.semanticViews.get(ctx.companyId);
    if (!index) index = new AcpmSemanticIndex(ctx.companyId);
    const refresh = index.sync([...snapshot.runs.flatMap(r => r.events), ...snapshot.corrections.map(c => c.original)],
      snapshot.observedAt, snapshot.truncated, snapshot.issues,snapshot.provenance.internalProviderEventIds);
    this.semanticViews.delete(ctx.companyId);
    this.semanticViews.set(ctx.companyId, index);
    // Disposable bounded cache, never an alternate historical store.
    if (this.semanticViews.size > 1) this.semanticViews.delete(this.semanticViews.keys().next().value!);
    return { index, refresh, sourceProvenance: snapshot.provenance, registryDeclarations: snapshot.inventory };
  }
  async semanticSearch(ctx: RequestContext, query: SemanticQuery, rebuild = false) {
    const { index, ...metadata } = await this.semanticView(ctx, rebuild);
    try { return { ...index.search(query), ...metadata }; }
    catch { throw new BadRequestException('ACPM_INVALID_SEMANTIC_QUERY'); }
  }
  async semanticChain(ctx: RequestContext, chainId: string) {
    const { index, ...metadata } = await this.semanticView(ctx);
    const chain=index.chain(chainId),ids=[...new Set(chain.snapshot.runs.map(r=>r.mandateId))];
    const mandates=await this.prisma.authorityMandate.findMany({where:{companyId:ctx.companyId,OR:[{id:{in:ids.filter(id=>/^[a-f0-9-]{36}$/i.test(id))}},{mandateKey:{in:ids}}]},select:{id:true,mandateKey:true,agentId:true,scopeId:true,status:true,version:true,issuedAt:true,expiresAt:true}});
    return { ...chain, ...metadata,mandates,unresolvedMandateIds:ids.filter(id=>!mandates.some(m=>m.id===id||m.mandateKey===id)),mandateProvenance:'Current AuthorityMandate rows, tenant scoped; not retroactive execution authorization'};
  }
  async semanticModelState(ctx: RequestContext, model: string) {
    const { index, ...metadata } = await this.semanticView(ctx);
    const modelState=index.modelState(model);
    const production=process.env.NODE_ENV==='production';
    const enabled=(production?process.env.AGMATCC_LUNA_PRODUCTION_ENABLED:process.env.AGMATCC_COPILOT_ISOLATED_ENABLED)==='true';
    const configurationReady=enabled&&(!production||(process.env.AGMATCC_COPILOT_PROVIDER==='openai'&&/^[a-f0-9]{64}$/.test(process.env.AGMATCC_LUNA_COMMANDER_FAMILY_SHA256??'')&&!!process.env.AGMATCC_LUNA_PRODUCTION_DB_HOST&&/^[a-f0-9]{64}$/.test(process.env.AGMATCC_LUNA_HANDOFF_SHA256??'')));
    const active=modelState.runs.filter(r=>r.status==='ACTIVE'&&r.events.some(e=>e.execution?.runtimeSessionId===ACPM_RUNTIME_SESSION.id)&&Date.now()-Date.parse(r.events.at(-1)!.occurredAt)<=90000);
    return { ...modelState, ...metadata,
      operationalState:model!==AGMATCC_COPILOT_CONTRACT.candidateModel?'UNKNOWN':!enabled?'DISABLED':!configurationReady?'CONFIGURATION_BLOCKED':active.length?'EXECUTION_OBSERVED':'ENABLED_NO_CURRENT_EXECUTION_OBSERVED',
      stateObservedAt:new Date().toISOString(),stateEvidence:'Current configuration plus canonical events in this telemetry process session; no provider call made by read',
      applicationRuntimeSession:{...ACPM_RUNTIME_SESSION,kind:'PROCESS_TELEMETRY_NOT_AUTHENTICATION'},
      currentModelExecutionIds:enabled?active.map(r=>r.runId):[],
      configuration: model === AGMATCC_COPILOT_CONTRACT.candidateModel ? {
        observedAt: new Date().toISOString(), modelAlias: AGMATCC_COPILOT_CONTRACT.candidateModel,
        providerSelection: process.env.AGMATCC_COPILOT_PROVIDER ?? 'simulated',
        productionEnabled: process.env.AGMATCC_LUNA_PRODUCTION_ENABLED === 'true',
        commanderFamilyConfigured: /^[a-f0-9]{64}$/.test(process.env.AGMATCC_LUNA_COMMANDER_FAMILY_SHA256 ?? ''),
        provenance: 'agmatcc-copilot.contract.ts + current process configuration; not provider execution proof',
      } : null };
  }
}
/** Legacy integration alias; no second service or ledger. */
export { AcpmService as AgentChainPerformanceService };

export { canonicalAcpm as canonicalAcp };

