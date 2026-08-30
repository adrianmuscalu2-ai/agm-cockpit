import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { routingPolicyFor } from './car-mover-routing.policy';
import type { RecordRoutingObservationDto } from './dto/record-routing-observation.dto';

const TELEMETRY_PROVIDER='agm-routing-policy';
const TELEMETRY_ADAPTER='car-mover.routing-observation';
export const CAR_MOVER_ROUTING_TELEMETRY_VERSION='car-mover-routing-telemetry.v2';
export const FIELD_SAMPLE_POLICY={minimumFinalizedCases:100,minimumDistinctTesters:3,minimumActiveDays:14,minimumElapsedDays:30} as const;

@Injectable()
export class CarMoverRoutingTelemetryService {
  constructor(private readonly prisma:PrismaService) {}

  async protocol(ctx:RequestContext){
    this.requirePremium(ctx);
    const assignedCases=await this.prisma.carMoverJob.findMany({where:{companyId:ctx.companyId,productId:'agm-car-mover',moduleId:'field-measurement',createdByUserId:ctx.userId},select:{id:true,sourceReference:true},orderBy:{sourceReference:'asc'},take:50});
    return{contractVersion:CAR_MOVER_ROUTING_TELEMETRY_VERSION,phase:'CONTROLLED_FIELD_MEASUREMENT',defaultVehicleProfile:'PASSENGER_CAR',core:['TOM_TOMTOM','EXISTING_CORE_COMPONENTS'],unknownPolicy:'HUMAN_CONFIRMATION_REQUIRED',planningHypotheses:{fallbackRangePercent:[2,5],paidExternalRangePercent:[0,1],status:'HYPOTHESES_NOT_PASS'},target:{fallbackPercentMax:3,status:'TARGET_NOT_VERDICT'},samplePolicy:FIELD_SAMPLE_POLICY,runtimeReadiness:{valhallaOsm:'REGISTERED_NOT_RUNTIME_READY',agmTollLibrary:'REGISTERED_NOT_RUNTIME_READY',here:'INACTIVE_NOT_REQUIRED',tollGuru:'INACTIVE_NOT_REQUIRED'},initialFieldResult:'NO_FIELD_DATA',assignedCases};
  }

  async record(dto:RecordRoutingObservationDto,ctx:RequestContext){
    this.requirePremium(ctx);
    await this.requireEntity(dto.entityType,dto.entityId,ctx.companyId);
    const policy=routingPolicyFor(dto.vehicleClass);
    if(policy.requiresVehicleConfirmation&&dto.finalRouteDecision==='ACCEPTED'&&!dto.manualConfirmation)throw new BadRequestException('UNKNOWN_OR_UNSPECIFIED_VEHICLE_REQUIRES_MANUAL_CONFIRMATION');
    if(dto.tollStatus==='UNKNOWN'&&dto.tollConfidence!==undefined)throw new BadRequestException('UNKNOWN_TOLL_MUST_NOT_HAVE_NUMERIC_CONFIDENCE');
    if(dto.tollStatus==='NOT_APPLICABLE'&&dto.tollConfidence!==undefined)throw new BadRequestException('NOT_APPLICABLE_TOLL_MUST_NOT_HAVE_NUMERIC_CONFIDENCE');
    if(dto.coreAvailability==='UNKNOWN'&&dto.routeLatencyMs!==undefined)throw new BadRequestException('UNKNOWN_CORE_AVAILABILITY_MUST_NOT_HAVE_NUMERIC_LATENCY');
    if(dto.coreAvailability!=='UNKNOWN'&&dto.routeLatencyMs===undefined)throw new BadRequestException('KNOWN_CORE_AVAILABILITY_REQUIRES_LATENCY');
    if(dto.coreAvailability==='UNAVAILABLE'&&!dto.routeErrorCode)throw new BadRequestException('UNAVAILABLE_CORE_REQUIRES_ROUTE_ERROR_CODE');
    if(dto.externalProviderAssessment==='CANDIDATE'&&dto.fallbackReason==='NONE')throw new BadRequestException('EXTERNAL_PROVIDER_CANDIDATE_REQUIRES_FALLBACK_REASON');
    if(dto.routeSource==='VALHALLA')throw new BadRequestException('VALHALLA_REGISTERED_NOT_RUNTIME_READY');
    if(dto.finalRouteDecision==='ACCEPTED'&&dto.routeSource==='UNKNOWN')throw new BadRequestException('UNKNOWN_ROUTE_SOURCE_CANNOT_BE_ACCEPTED');
    if(dto.finalRouteDecision==='ACCEPTED'&&dto.tollStatus==='UNKNOWN'&&!dto.manualConfirmation)throw new BadRequestException('UNKNOWN_TOLL_REQUIRES_MANUAL_CONFIRMATION');
    if(dto.finalRouteDecision==='ACCEPTED'&&dto.coreAvailability==='UNKNOWN'&&!dto.manualConfirmation)throw new BadRequestException('UNKNOWN_CORE_AVAILABILITY_REQUIRES_MANUAL_CONFIRMATION');
    if(dto.finalRouteDecision==='ACCEPTED'&&dto.externalProviderAssessment==='UNKNOWN'&&!dto.manualConfirmation)throw new BadRequestException('UNKNOWN_EXTERNAL_NEED_REQUIRES_MANUAL_CONFIRMATION');
    if(dto.externalPaidLookup&&!dto.externalAuthorizationReference)throw new ForbiddenException('EXTERNAL_PAID_LOOKUP_REQUIRES_EXPLICIT_AUTHORIZATION_REFERENCE');
    if(!dto.externalPaidLookup&&dto.externalAuthorizationReference)throw new BadRequestException('EXTERNAL_AUTHORIZATION_REFERENCE_WITHOUT_LOOKUP');
    if(dto.routeSource==='EXTERNAL_PAID'&&!dto.externalPaidLookup)throw new BadRequestException('EXTERNAL_ROUTE_SOURCE_REQUIRES_PAID_LOOKUP_FLAG');
    const fallbackActivated=dto.fallbackReason!=='NONE';
    const measuredAt=dto.measuredAt?new Date(dto.measuredAt):new Date();
    const metrics={
      contractVersion:CAR_MOVER_ROUTING_TELEMETRY_VERSION,entityType:dto.entityType,entityId:dto.entityId,
      vehicleClass:dto.vehicleClass,routingProfile:policy.routingProfile,routeSource:dto.routeSource,cacheState:dto.cacheState,
      tollStatus:dto.tollStatus,tollConfidence:dto.tollConfidence??null,fallbackReason:dto.fallbackReason,
      coreAvailability:dto.coreAvailability,routeLatencyMs:dto.routeLatencyMs??null,routeErrorCode:dto.routeErrorCode??null,
      tollErrorCode:dto.tollErrorCode??null,externalProviderAssessment:dto.externalProviderAssessment,
      manualConfirmation:dto.manualConfirmation,externalPaidLookup:dto.externalPaidLookup,
      externalAuthorizationReference:dto.externalAuthorizationReference??null,finalRouteDecision:dto.finalRouteDecision,
      coreResolved:isCoreResolved(dto),
      measuredAt:measuredAt.toISOString(),unknownIsNotZero:true,unknownIsNotSafe:true,unknownIsNotPass:true,
    };
    const event=await this.prisma.providerUsageEvent.create({data:{
      companyId:ctx.companyId,userId:ctx.userId,providerId:TELEMETRY_PROVIDER,adapterId:TELEMETRY_ADAPTER,
      category:'ROUTE_POLICY',eventType:'ROUTE_OBSERVATION',outcome:dto.finalRouteDecision,
      latencyMs:dto.routeLatencyMs,cacheHit:dto.cacheState==='HIT',fallbackActivation:fallbackActivated,
      timeout:dto.fallbackReason==='TOM_TIMEOUT',errorCode:dto.routeErrorCode,
      estimatedCostMicros:dto.externalPaidLookup?undefined:0,metrics:metrics as Prisma.InputJsonValue,occurredAt:measuredAt,
    }});
    return{observationId:event.id,recorded:true,policy,measurementStatus:'MEASURED_NOT_PREDECLARED'};
  }

  async report(ctx:RequestContext,from?:string,to?:string){
    this.requireOwner(ctx);
    const end=to?new Date(to):new Date(),start=from?new Date(from):new Date(end.getTime()-30*86_400_000);
    if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>=end)throw new BadRequestException('ROUTING_TELEMETRY_PERIOD_INVALID');
    const rows=await this.prisma.providerUsageEvent.findMany({where:{companyId:ctx.companyId,providerId:TELEMETRY_PROVIDER,eventType:'ROUTE_OBSERVATION',occurredAt:{gte:start,lte:end}},orderBy:{occurredAt:'asc'}});
    const observations:Record<string,unknown>[]=rows.flatMap((row)=>{const metrics=readMetrics(row.metrics);return metrics?[{...metrics,_userId:row.userId,_occurredAt:row.occurredAt.toISOString()}]:[];});
    const cases=latestCases(observations),finalized=cases.filter((row)=>row.finalRouteDecision==='ACCEPTED'||row.finalRouteDecision==='REJECTED');
    const fallbackCount=finalized.filter((row)=>row.fallbackReason!=='NONE').length;
    const paidCount=finalized.filter((row)=>row.externalPaidLookup===true).length;
    const coreResolvedCount=finalized.filter((row)=>row.coreResolved===true).length;
    const confidence=cases.map((row)=>row.tollConfidence).filter((value):value is number=>typeof value==='number');
    const latencies=cases.map((row)=>row.routeLatencyMs).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value)).sort((a,b)=>a-b);
    const testers=new Set(observations.map((row)=>row._userId).filter((value):value is string=>typeof value==='string'&&Boolean(value)));
    const activeDays=new Set(observations.map((row)=>String(row._occurredAt).slice(0,10)));
    const elapsedDays=fieldElapsedDays(observations);
    const sample={finalizedCases:finalized.length,distinctTesters:testers.size,activeDays:activeDays.size,elapsedDays};
    const sufficiencyReasons=[sample.finalizedCases<FIELD_SAMPLE_POLICY.minimumFinalizedCases?'FINALIZED_CASES_BELOW_MINIMUM':null,sample.distinctTesters<FIELD_SAMPLE_POLICY.minimumDistinctTesters?'DISTINCT_TESTERS_BELOW_MINIMUM':null,sample.activeDays<FIELD_SAMPLE_POLICY.minimumActiveDays?'ACTIVE_DAYS_BELOW_MINIMUM':null,sample.elapsedDays<FIELD_SAMPLE_POLICY.minimumElapsedDays?'ELAPSED_DAYS_BELOW_MINIMUM':null].filter((value):value is string=>Boolean(value));
    const sufficient=sufficiencyReasons.length===0;
    const routingErrorCount=cases.filter((row)=>typeof row.routeErrorCode==='string'||row.coreAvailability==='UNAVAILABLE').length;
    const tollIssueCount=cases.filter((row)=>row.tollStatus==='UNKNOWN'||typeof row.tollErrorCode==='string').length;
    const unknownSafetyViolations=finalized.filter((row)=>row.finalRouteDecision==='ACCEPTED'&&!row.manualConfirmation&&(row.vehicleClass==='UNKNOWN'||row.routeSource==='UNKNOWN'||row.tollStatus==='UNKNOWN'||row.coreAvailability==='UNKNOWN'||row.externalProviderAssessment==='UNKNOWN')).length;
    const fallbackRateBps=finalized.length?Math.round(fallbackCount/finalized.length*10_000):null;
    const fieldValidation=cases.length===0?'INSUFFICIENT_DATA_NO_FIELD_DATA':!sufficient?'INSUFFICIENT_DATA':unknownSafetyViolations||paidCount||routingErrorCount||(fallbackRateBps??10_000)>300?'FAIL':'PASS';
    const exceptions=cases.filter((row)=>row.fallbackReason!=='NONE'||typeof row.routeErrorCode==='string'||row.tollStatus==='UNKNOWN'||typeof row.tollErrorCode==='string'||row.externalProviderAssessment==='CANDIDATE').map((row)=>({entityType:row.entityType,entityId:row.entityId,vehicleClass:row.vehicleClass,routeSource:row.routeSource,fallbackReason:row.fallbackReason,routeErrorCode:row.routeErrorCode??null,tollStatus:row.tollStatus,tollErrorCode:row.tollErrorCode??null,externalProviderAssessment:row.externalProviderAssessment,finalRouteDecision:row.finalRouteDecision,measuredAt:row.measuredAt}));
    const providerRecommendation=!sufficient?'INSUFFICIENT_DATA_NO_PROVIDER_DECISION':count(cases,'externalProviderAssessment','CANDIDATE')===0?'KEEP_HERE_TOLLGURU_INACTIVE':'REVIEW_MEASURED_EXCEPTIONS_BEFORE_SEPARATE_OWNER_DECISION';
    return{
      contractVersion:CAR_MOVER_ROUTING_TELEMETRY_VERSION,from:start.toISOString(),to:end.toISOString(),
      governance:{productPrinciple:'BUILD_ONLY_FOR_REAL_USER_NEED',unknownRules:['UNKNOWN_NE_ZERO','UNKNOWN_NE_SAFE','UNKNOWN_NE_PASS'],hereRequired:false,tollGuruRequired:false,automaticExternalPaidLookup:false},
      planningHypotheses:{fallbackRangePercent:[2,5],paidExternalRangePercent:[0,1],status:'HYPOTHESES_NOT_PASS'},
      target:{fallbackPercentMax:3,status:'TARGET_NOT_VERDICT'},
      runtimeReadiness:{tomTom:'CORE_EXISTING',valhallaOsm:'REGISTERED_NOT_RUNTIME_READY',agmTollLibrary:'REGISTERED_NOT_RUNTIME_READY',here:'INACTIVE_NOT_REQUIRED',tollGuru:'INACTIVE_NOT_REQUIRED'},
      samplePolicy:FIELD_SAMPLE_POLICY,sampleStatus:{...sample,sufficient,reasons:sufficiencyReasons},
      measured:{rawObservations:observations.length,uniqueCases:cases.length,finalizedCases:finalized.length,coreResolvedCount,coreResolvedRateBps:finalized.length?Math.round(coreResolvedCount/finalized.length*10_000):null,fallbackCount,paidExternalLookupCount:paidCount,fallbackRateBps,paidExternalRateBps:finalized.length?Math.round(paidCount/finalized.length*10_000):null,manualConfirmations:cases.filter((row)=>row.manualConfirmation===true).length,manualConfirmationRateBps:cases.length?Math.round(cases.filter((row)=>row.manualConfirmation===true).length/cases.length*10_000):null,externalProviderCandidates:count(cases,'externalProviderAssessment','CANDIDATE'),externalProviderCandidateRateBps:cases.length?Math.round(count(cases,'externalProviderAssessment','CANDIDATE')/cases.length*10_000):null,routingErrorCount,tollIssueCount,unknownSafetyViolations,accepted:count(cases,'finalRouteDecision','ACCEPTED'),rejected:count(cases,'finalRouteDecision','REJECTED'),pending:count(cases,'finalRouteDecision','PENDING'),cacheHits:count(cases,'cacheState','HIT'),cacheMisses:count(cases,'cacheState','MISS'),latencyMs:{average:latencies.length?Math.round(latencies.reduce((sum,value)=>sum+value,0)/latencies.length):null,p50:percentile(latencies,50),p95:percentile(latencies,95),maximum:latencies.length?latencies[latencies.length-1]:null},averageTollConfidence:confidence.length?Math.round(confidence.reduce((sum,value)=>sum+value,0)/confidence.length):null,vehicleClasses:group(cases,'vehicleClass'),routeSources:group(cases,'routeSource'),coreAvailability:group(cases,'coreAvailability'),tollStatuses:group(cases,'tollStatus'),fallbackReasons:group(cases,'fallbackReason'),externalProviderAssessments:group(cases,'externalProviderAssessment')},
      targetComparison:{fallbackTargetBps:300,measuredFallbackBps:fallbackRateBps,status:fallbackRateBps===null?'NOT_MEASURED':fallbackRateBps<=300?'WITHIN_TARGET':'ABOVE_TARGET'},
      exceptions:exceptions.slice(0,200),exceptionsTruncated:exceptions.length>200,providerRecommendation,
      fieldValidation,productionAuthorization:'SEPARATE_OWNER_DECISION',verdict:fieldValidation,
    };
  }

  private async requireEntity(type:'JOB'|'OFFER',id:string,companyId:string){
    const entity=type==='JOB'
      ?await this.prisma.carMoverJob.findFirst({where:{id,companyId,productId:'agm-car-mover'},select:{id:true}})
      :await this.prisma.carMoverPlatformOffer.findFirst({where:{id,companyId},select:{id:true}});
    if(!entity)throw new NotFoundException(type==='JOB'?'CAR_MOVER_JOB_NOT_FOUND':'CAR_MOVER_OFFER_NOT_FOUND');
  }
  private requirePremium(ctx:RequestContext){if(!ctx.roles.includes('PREMIUM_ACCESS'))throw new ForbiddenException('Car Mover entitlement required.');}
  private requireOwner(ctx:RequestContext){if(!ctx.roles.some((role)=>['OWNER','company_owner'].includes(role)))throw new ForbiddenException('ROUTING_TELEMETRY_OWNER_REQUIRED');}
}

function readMetrics(value:Prisma.JsonValue|null):Record<string,unknown>|null{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;}
function count(rows:Record<string,unknown>[],field:string,value:unknown){return rows.filter((row)=>row[field]===value).length;}
function group(rows:Record<string,unknown>[],field:string){const result:Record<string,number>={};for(const row of rows){const key=String(row[field]??'UNKNOWN');result[key]=(result[key]??0)+1;}return result;}
function latestCases(rows:Record<string,unknown>[]){const result=new Map<string,Record<string,unknown>>();for(const row of rows)result.set(`${String(row.entityType)}:${String(row.entityId)}`,row);return[...result.values()];}
function percentile(values:number[],value:number){if(!values.length)return null;return values[Math.ceil(value/100*values.length)-1];}
function fieldElapsedDays(rows:Record<string,unknown>[]){if(!rows.length)return 0;const times=rows.map((row)=>new Date(String(row._occurredAt)).getTime()).filter(Number.isFinite);return times.length?Math.max(1,Math.floor((Math.max(...times)-Math.min(...times))/86_400_000)+1):0;}
function isCoreResolved(dto:RecordRoutingObservationDto){return dto.finalRouteDecision==='ACCEPTED'&&(dto.routeSource==='TOM'||dto.routeSource==='CACHE')&&dto.fallbackReason==='NONE'&&!dto.manualConfirmation&&dto.coreAvailability==='AVAILABLE'&&!dto.routeErrorCode;}
