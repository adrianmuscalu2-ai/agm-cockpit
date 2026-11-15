import { BadRequestException, ConflictException, ForbiddenException, Injectable, Optional, Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { projectAcp, asAcpm, selectAcpm, type AcpmFilters, type AcpmEvent } from '@agm/shared';
import { AcpmObserver } from './acpm.observer';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/request-context';
import type { AppendAcpmEventDto } from './acpm.dto';
import { premiumNetworkSeed } from '../authority-control-plane/premium-network.seed';

import { canonicalAcpm } from './acpm.canonical';
export { canonicalAcpm } from './acpm.canonical';
export function legacyAcp(row: {eventId:string; mandateId:string; agentId:string; dossierId:string; lifecycle:string; sequence:number; occurredAt:Date; evidenceRef:string; evidenceHash:string|null}): AcpmEvent {
  return { eventId:row.eventId,chainId:row.mandateId,mandateId:row.mandateId,runId:row.dossierId,componentId:row.agentId,componentKind:'UNKNOWN',kind:row.lifecycle as AcpmEvent['kind'],sequence:row.sequence,occurredAt:row.occurredAt.toISOString(),evidenceRef:row.evidenceRef,evidenceHash:row.evidenceHash ?? undefined,source:'LEGACY' };
}
@Injectable()
export class AcpmService {
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
  async snapshot(ctx: RequestContext) {
    this.requireReader(ctx);
    const [observations, legacy] = await Promise.all([
      this.prisma.$queryRaw<Array<{payload:AcpmEvent;payloadHash:string;recordedAt:Date}>>`SELECT "payload","payloadHash","recordedAt" FROM "AgentChainPerformanceEvent" WHERE "companyId"=${ctx.companyId}::uuid ORDER BY "recordedAt" DESC,"eventId" DESC LIMIT 10001`,
      this.prisma.agentRuntimeEvent.findMany({where:{companyId:ctx.companyId},orderBy:[{recordedAt:'desc'},{eventId:'desc'}],take:10001}),
    ]);
    const integrityErrors = observations.filter(r=>createHash('sha256').update(canonicalAcpm(r.payload)).digest('hex')!==r.payloadHash).map(r=>r.payload.eventId);
    if (integrityErrors.length) throw new ConflictException('ACP_STORED_PAYLOAD_HASH_MISMATCH');
    const truncated = observations.length>10000 || legacy.length>10000;
    const current=observations.slice(0,10000).map(r=>r.payload);
    const currentById=new Map(current.map(event=>[event.eventId,event]));
    const legacyEvents=legacy.slice(0,10000).map(legacyAcp).filter(event=>{
      const native=currentById.get(event.eventId); if(!native)return true;
      // Native runtime rows are bridged with the same identity/evidence. Prefer
      // that ACPM representation; retain a divergent pair so the engine exposes
      // the conflict instead of silently merging unlike observations.
      return native.chainId!==event.chainId||native.mandateId!==event.mandateId||native.runId!==event.runId||native.componentId!==event.componentId||native.sequence!==event.sequence||native.occurredAt!==event.occurredAt||native.evidenceRef!==event.evidenceRef||native.evidenceHash!==event.evidenceHash||native.kind!==event.kind;
    });
    const snapshot = projectAcp([...current,...legacyEvents],new Date().toISOString(),truncated);
    const inventory=premiumNetworkSeed.filter(n=>n.kind!=='HUMAN_AUTHORITY').map(n=>({componentId:n.canonicalId,kind:n.kind,module:n.module,supervisorId:n.supervisorId,scope:n.scope,
      observation:snapshot.runs.some(r=>r.componentId===n.canonicalId)?'OBSERVED':'NO_PERFORMANCE_EVENTS'}));
    return {...snapshot, inventory, provenance:{ledger:'AgentChainPerformanceEvent',legacy:'AgentRuntimeEvent',registry:'premiumNetworkSeed (declaration, not execution proof)',payloadHashesVerified:observations.length,sourceEvidenceContentVerified:false}, coverageLimit:'Only instrumented observations; missing components are not healthy by inference.'};
  }
  async monitor(ctx:RequestContext,filters:AcpmFilters={}) {
    const snapshot=await this.snapshot(ctx);
    try { return {...selectAcpm(asAcpm(snapshot),filters),provenance:snapshot.provenance,coverageLimit:snapshot.coverageLimit,observerHealth:this.observer?.health(ctx.companyId)}; }
    catch { throw new BadRequestException('ACPM_INVALID_FILTERS'); }
  }
}
/** Legacy integration alias; no second service or ledger. */
export { AcpmService as AgentChainPerformanceService };

export { canonicalAcpm as canonicalAcp };

