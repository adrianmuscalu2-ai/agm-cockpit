import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

export type PilotUsageInput = {
  providerId:string; adapterId:string; category:string; eventType:string; inputHash?:string; outcome:string;
  latencyMs?:number; cacheHit?:boolean; coalesced?:boolean; recalculation?:boolean; fallbackActivation?:boolean;
  rateLimited?:boolean; timeout?:boolean; stale?:boolean; errorCode?:string; estimatedCostMicros?:number;
  actualCostMicros?:number; metrics?:Record<string,unknown>;
};

@Injectable()
export class PilotOperationsService {
  constructor(private readonly prisma:PrismaService) {}

  async eligibility(providerId:string,ctx:RequestContext){
    const activation=await this.prisma.providerPilotActivation.findUnique({where:{companyId_providerId:{companyId:ctx.companyId,providerId}}});
    if(!activation)return{allowed:false,reason:'PROVIDER_NOT_PROVISIONED',activation:null};
    const now=new Date();
    if(activation.state!=='ACTIVE')return{allowed:false,reason:`PROVIDER_${activation.state}`,activation};
    if(activation.allowedUserId&&activation.allowedUserId!==ctx.userId)return{allowed:false,reason:'PILOT_USER_SCOPE_DENIED',activation};
    if(now<activation.pilotStartAt||now>=activation.pilotEndAt)return{allowed:false,reason:'PILOT_WINDOW_CLOSED',activation};
    const since=startOfUtcDay(now);
    const used=await this.prisma.providerUsageEvent.count({where:{companyId:ctx.companyId,providerId,eventType:'PROVIDER_REQUEST',occurredAt:{gte:since}}});
    if(used>=activation.dailyRequestLimit)return{allowed:false,reason:'PILOT_DAILY_REQUEST_LIMIT',activation,used};
    return{allowed:true,reason:'ACTIVE',activation,used};
  }

  async record(input:PilotUsageInput,ctx:RequestContext){
    const activation=await this.prisma.providerPilotActivation.findUnique({where:{companyId_providerId:{companyId:ctx.companyId,providerId:input.providerId}}});
    const estimated=input.estimatedCostMicros??(input.eventType==='PROVIDER_REQUEST'?activation?.estimatedUnitCostMicros??undefined:undefined);
    return this.prisma.providerUsageEvent.create({data:{companyId:ctx.companyId,userId:ctx.userId,providerId:input.providerId,adapterId:input.adapterId,category:input.category,eventType:input.eventType,inputHash:input.inputHash,outcome:input.outcome,latencyMs:input.latencyMs,cacheHit:input.cacheHit??false,coalesced:input.coalesced??false,recalculation:input.recalculation??false,fallbackActivation:input.fallbackActivation??false,rateLimited:input.rateLimited??false,timeout:input.timeout??false,stale:input.stale??false,errorCode:input.errorCode,estimatedCostMicros:estimated,actualCostMicros:input.actualCostMicros,metrics:input.metrics as Prisma.InputJsonValue|undefined}});
  }

  list(ctx:RequestContext){this.requireOwner(ctx);return this.prisma.providerPilotActivation.findMany({where:{companyId:ctx.companyId},orderBy:{providerId:'asc'}});}

  async setState(providerId:string,state:'ACTIVE'|'SUSPENDED'|'READY',reason:string|undefined,ctx:RequestContext){
    this.requireOwner(ctx);
    if(!['tomtom','here','tollguru','gmail'].includes(providerId))throw new NotFoundException('PILOT_PROVIDER_NOT_REGISTERED');
    if(!['ACTIVE','SUSPENDED','READY'].includes(state))throw new ForbiddenException('PILOT_STATE_INVALID');
    const current=await this.prisma.providerPilotActivation.findUnique({where:{companyId_providerId:{companyId:ctx.companyId,providerId}}});
    if(!current)throw new NotFoundException('PILOT_PROVIDER_NOT_PROVISIONED');
    if(state==='ACTIVE'&&!current.credentialReference)throw new ForbiddenException('GUARDIAN_CREDENTIAL_REFERENCE_REQUIRED');
    const safeReason=reason??(state==='SUSPENDED'?'OWNER_SUSPENDED':'OWNER_CONTROLLED_STATE_CHANGE');
    if(!/^[A-Z0-9_-]{3,80}$/.test(safeReason))throw new ForbiddenException('PILOT_STATE_REASON_INVALID');
    return this.prisma.$transaction(async(tx)=>{
      const updated=await tx.providerPilotActivation.update({where:{id:current.id},data:{state,suspendedReason:state==='SUSPENDED'?safeReason:null,updatedByUserId:ctx.userId}});
      await tx.providerUsageEvent.create({data:{companyId:ctx.companyId,userId:ctx.userId,providerId,adapterId:'pilot.control',category:'CONTROL',eventType:'CONTROL_STATE_CHANGE',outcome:state,metrics:{previousState:current.state,reason:safeReason}}});
      return updated;
    });
  }

  async recordBilling(providerId:string,actualCostMicros:number,currencyCode:string,periodStart:string,periodEnd:string,ctx:RequestContext){
    this.requireOwner(ctx);
    if(!Number.isInteger(actualCostMicros)||actualCostMicros<0)throw new ForbiddenException('BILLING_COST_INVALID');
    const expectedCurrency=providerCurrency(providerId);if(currencyCode!==expectedCurrency)throw new ForbiddenException('BILLING_CURRENCY_MISMATCH');
    if(Number.isNaN(Date.parse(periodStart))||Number.isNaN(Date.parse(periodEnd))||new Date(periodStart)>=new Date(periodEnd))throw new ForbiddenException('BILLING_PERIOD_INVALID');
    return this.record({providerId,adapterId:`billing.${providerId}`,category:'BILLING',eventType:'BILLING_RECONCILIATION',outcome:'RECORDED',actualCostMicros,metrics:{currencyCode,periodStart,periodEnd}},ctx);
  }

  async report(ctx:RequestContext,from?:string,to?:string){
    this.requireOwner(ctx);const end=to?new Date(to):new Date();const start=from?new Date(from):new Date(end.getTime()-7*86_400_000);
    const [activations,events,gmail]=await Promise.all([
      this.prisma.providerPilotActivation.findMany({where:{companyId:ctx.companyId},orderBy:{providerId:'asc'}}),
      this.prisma.providerUsageEvent.findMany({where:{companyId:ctx.companyId,occurredAt:{gte:start,lte:end}},orderBy:{occurredAt:'asc'}}),
      this.prisma.gmailPilotTelemetry.findUnique({where:{companyId:ctx.companyId}}),
    ]);
    const providers=activations.map((activation)=>{
      const rows=events.filter((event)=>event.providerId===activation.providerId);const requests=rows.filter((event)=>event.eventType==='PROVIDER_REQUEST');const latencies=requests.map((event)=>event.latencyMs).filter((value):value is number=>value!==null);const activeUsers=new Set(rows.map((event)=>event.userId).filter(Boolean));
      const daily=new Map<string,{requests:number;estimatedCostMicros:number|null;actualCostMicros:number|null}>();for(const event of rows){if(event.eventType!=='PROVIDER_REQUEST'&&event.estimatedCostMicros===null&&event.actualCostMicros===null)continue;const day=event.occurredAt.toISOString().slice(0,10),item=daily.get(day)??{requests:0,estimatedCostMicros:null,actualCostMicros:null};if(event.eventType==='PROVIDER_REQUEST'){item.requests++;const estimate=event.estimatedCostMicros??activation.estimatedUnitCostMicros;if(estimate!==null)item.estimatedCostMicros=(item.estimatedCostMicros??0)+estimate;}if(event.actualCostMicros!==null)item.actualCostMicros=(item.actualCostMicros??0)+event.actualCostMicros;daily.set(day,item);}
      const estimatedRows=requests.map((event)=>event.estimatedCostMicros??activation.estimatedUnitCostMicros).filter((value):value is number=>value!==null),actualRows=rows.filter((event)=>event.actualCostMicros!==null);const estimatedCostMicros=estimatedRows.length?sum(estimatedRows):null,actualCostMicros=actualRows.length?sum(actualRows.map((event)=>event.actualCostMicros!)):null,cacheHits=rows.filter((event)=>event.cacheHit).length,resolutions=requests.length+cacheHits;
      const costForUser=actualCostMicros??estimatedCostMicros;
      return{providerId:activation.providerId,state:activation.state,pilotStartAt:activation.pilotStartAt,pilotEndAt:activation.pilotEndAt,dailyRequestLimit:activation.dailyRequestLimit,requestsTotal:requests.length,requestsPerDay:Object.fromEntries(daily),estimatedCostMicros,actualCostMicros,costCurrencyCode:providerCurrency(activation.providerId),costBasis:activation.costBasis,costPerActiveUserMicros:activeUsers.size&&costForUser!==null?Math.round(costForUser/activeUsers.size):null,cacheHits,cacheHitRateBps:resolutions?Math.round(cacheHits/resolutions*10_000):0,requestDedup:rows.filter((event)=>event.coalesced).length,recalculations:rows.filter((event)=>event.recalculation).length,fallbacks:rows.filter((event)=>event.fallbackActivation).length,averageLatencyMs:requests.length?Math.round(sum(latencies)/requests.length):null,timeouts:rows.filter((event)=>event.timeout).length,rateLimitEvents:rows.filter((event)=>event.rateLimited).length,errors:rows.filter((event)=>event.outcome==='ERROR').length,staleEvents:rows.filter((event)=>event.stale).length,tollCallsSkipped:rows.filter((event)=>event.eventType==='TOLL_CALL_SKIPPED').length,tollCallsAvoidedByCacheOrDedup:rows.filter((event)=>event.category==='TOLL'&&(event.cacheHit||event.coalesced)).length,tollValueAppliedCount:rows.filter((event)=>event.eventType==='TOLL_VALUE_APPLIED').length,alertState:alertState(activation.dailyRequestLimit,activation.anomalyAlertPercent,activation.dailyCostAlertMicros,requests.length,estimatedCostMicros,actualCostMicros)};
    });
    return{contractVersion:'agm-provider-pilot-report.v1',from:start,to:end,providers,gmail:gmail??emptyGmail(ctx.companyId),externalJobCreationAutomatic:false};
  }

  async recordGmailSync(ctx:RequestContext,value:{processed:number;duplicates:number;latencyMs:number;backlog:number;stale:number;errorCode?:string}){
    const ok=!value.errorCode;return this.prisma.gmailPilotTelemetry.upsert({where:{companyId:ctx.companyId},create:{companyId:ctx.companyId,state:ok?'HEALTHY':'DEGRADED',syncCount:1,messagesProcessed:value.processed,duplicatesEliminated:value.duplicates,totalLatencyMs:value.latencyMs,backlog:value.backlog,staleMessages:value.stale,lastSuccessfulSyncAt:ok?new Date():undefined,lastErrorAt:ok?undefined:new Date(),lastErrorCode:value.errorCode},update:{state:ok?'HEALTHY':'DEGRADED',syncCount:{increment:1},messagesProcessed:{increment:value.processed},duplicatesEliminated:{increment:value.duplicates},totalLatencyMs:{increment:value.latencyMs},backlog:value.backlog,staleMessages:{increment:value.stale},lastSuccessfulSyncAt:ok?new Date():undefined,lastErrorAt:ok?undefined:new Date(),lastErrorCode:value.errorCode??null}});
  }

  async recordGmailAnalysis(ctx:RequestContext,value:{processed:number;relevant:number;created:number;duplicates:number;parsingErrors:number;backlog:number}){return this.prisma.gmailPilotTelemetry.upsert({where:{companyId:ctx.companyId},create:{companyId:ctx.companyId,state:value.parsingErrors?'DEGRADED':'HEALTHY',messagesProcessed:value.processed,relevantMessages:value.relevant,opportunitiesExtracted:value.created,duplicatesEliminated:value.duplicates,parsingErrors:value.parsingErrors,backlog:value.backlog,lastAnalysisAt:new Date()},update:{state:value.parsingErrors?'DEGRADED':'HEALTHY',relevantMessages:{increment:value.relevant},opportunitiesExtracted:{increment:value.created},duplicatesEliminated:{increment:value.duplicates},parsingErrors:{increment:value.parsingErrors},backlog:value.backlog,lastAnalysisAt:new Date()}});}

  private requireOwner(ctx:RequestContext){if(!ctx.roles.some((role)=>['OWNER','company_owner'].includes(role)))throw new ForbiddenException('PILOT_OWNER_REQUIRED');}
}
const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);
const startOfUtcDay=(value:Date)=>new Date(Date.UTC(value.getUTCFullYear(),value.getUTCMonth(),value.getUTCDate()));
const alertState=(limit:number,threshold:number,costLimit:number|null,requests:number,estimated:number|null,actual:number|null)=>requests>=limit?'LIMIT_REACHED':requests>=Math.ceil(limit*threshold/100)?'ANOMALY_WARNING':costLimit!==null&&(actual??estimated??0)>=costLimit?'COST_WARNING':'NORMAL';
const emptyGmail=(companyId:string)=>({companyId,state:'NO_TELEMETRY',syncCount:0,messagesProcessed:0,relevantMessages:0,opportunitiesExtracted:0,duplicatesEliminated:0,parsingErrors:0,staleMessages:0,totalLatencyMs:0,backlog:0,lastSuccessfulSyncAt:null,lastAnalysisAt:null,lastErrorAt:null,lastErrorCode:null});
const providerCurrency=(providerId:string)=>providerId==='tollguru'?'USD':'EUR';
