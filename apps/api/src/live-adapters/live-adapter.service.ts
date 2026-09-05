import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { RequestContext } from '../common/request-context';
import { CanonicalAuthorityService } from '../canonical-authority/canonical-authority.service';
import { hash } from '../opportunity-intelligence/opportunity-intelligence.engine';
import { OpportunityIntelligenceService } from '../opportunity-intelligence/opportunity-intelligence.service';
import { PilotOperationsService } from '../pilot-operations/pilot-operations.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  LIVE_ADAPTER_CONTRACT_VERSION,
  LiveProviderError,
  type AdapterCategory,
  type AdapterInput,
  type LiveProviderAdapter,
  type LiveResolution,
  type NormalizedLiveContract,
  type PlatformOpportunityFeed,
  type RouteResult,
  type TollInput,
  type TollEstimate,
  type TrafficSnapshot,
  type TransitOption,
} from './live-adapter.contracts';
import {
  HereGeocodingAdapter,
  HereRouteAdapter,
  HereTransitAdapter,
  TollGuruAdapter,
  TomTomGeocodingAdapter,
  TomTomRouteAdapter,
  TomTomTrafficAdapter,
} from './provider-adapters';
import type { MobilityInputDto, PlatformFeedDto } from './live-adapter.dto';

const json = (value:unknown) => value as Prisma.InputJsonValue;
const OPTIONAL_EXTERNAL_PROVIDERS=new Set(['here','tollguru']);
export type OptionalExternalProviderAuthorization={providerIds:readonly ('here'|'tollguru')[];authorizationReference:string};

@Injectable()
export class LiveAdapterService {
  private readonly coalesced = new Map<string,Promise<LiveResolution>>();
  private readonly providers:LiveProviderAdapter[];

  constructor(
    private readonly prisma:PrismaService,
    private readonly opportunities:OpportunityIntelligenceService,
    tomtomGeo:TomTomGeocodingAdapter,
    hereGeo:HereGeocodingAdapter,
    tomtomRoute:TomTomRouteAdapter,
    hereRoute:HereRouteAdapter,
    tomtomTraffic:TomTomTrafficAdapter,
    tollGuru:TollGuruAdapter,
    hereTransit:HereTransitAdapter,
    @Optional() private readonly pilot?:PilotOperationsService,
    @Optional() private readonly canonicalAuthority?:CanonicalAuthorityService,
  ) {
    this.providers=[tomtomGeo,hereGeo,tomtomRoute,hereRoute,tomtomTraffic,tollGuru,hereTransit];
  }

  resolve(category:AdapterCategory,input:AdapterInput,ctx:RequestContext,forceRefresh=false,optionalExternal?:OptionalExternalProviderAuthorization){
    this.authorize(ctx);
    const allowedOptional=this.authorizedOptionalProviders(optionalExternal,ctx);
    const inputHash=hash(input),key=`${ctx.companyId}:${category}:${inputHash}:${[...allowedOptional].sort().join(',')}`;
    if(category==='TOLL'){
      const toll=input as TollInput;
      if(toll.tollRequired!==true||!toll.tollReason){
        const warning=toll.tollRequired===true?'TOLL_REASON_REQUIRED_PROVIDER_NOT_CALLED':'TOLL_NOT_REQUIRED_PROVIDER_NOT_CALLED';
        void this.safeRecord({providerId:'tollguru',adapterId:'live.toll.tollguru',category,eventType:'TOLL_CALL_SKIPPED',inputHash,outcome:'NOT_REQUIRED',metrics:{reason:toll.tollRequired===true?'TOLL_REASON_REQUIRED':'TOLL_NOT_REQUIRED'}},ctx);
        return this.withAdapterRuntime(category,ctx,()=>this.categoryTelemetry(ctx.companyId,category,toll.tollRequired===true?'DEGRADED':'HEALTHY','not-required',toll.tollRequired===true?'TOLL_REASON_REQUIRED':undefined)
          .then(()=>({mode:'SKIPPED',status:toll.tollRequired===true?'DEGRADED':'HEALTHY',warning} as LiveResolution)));
      }
      if(!this.canonicalAuthority||!toll.authorityScopeConfirmed||!toll.authoritySources?.length){
        return this.withAdapterRuntime(category,ctx,()=>this.categoryTelemetry(ctx.companyId,category,'DEGRADED','authority-gate','CANONICAL_AUTHORITY_REQUIRED')
          .then(()=>({mode:'MANUAL',status:'DEGRADED',warning:'CANONICAL_AUTHORITY_REQUIRED:UNKNOWN_HUMAN_VERIFICATION',canonicalAuthority:{resolvedValue:null,fallback:'UNKNOWN_HUMAN_VERIFICATION',decisions:[]}} as LiveResolution)));
      }
      const evaluatedAt=toll.departureTime??new Date().toISOString();
      const authority=this.canonicalAuthority.evaluateMany(toll.authoritySources.map((item)=>({domain:'ROUTING_TOLL' as const,sourceId:item.sourceId,jurisdiction:item.jurisdiction,evaluatedAt,purpose:'NORMATIVE' as const,scopeConfirmed:true})));
      if(!authority.allNormativelyUsable){
        return this.withAdapterRuntime(category,ctx,()=>this.categoryTelemetry(ctx.companyId,category,'DEGRADED','authority-gate','CANONICAL_AUTHORITY_NOT_CURRENT')
          .then(()=>({mode:'MANUAL',status:'DEGRADED',warning:'CANONICAL_AUTHORITY_NOT_CURRENT:UNKNOWN_HUMAN_VERIFICATION',canonicalAuthority:authority} as LiveResolution)));
      }
      return this.resolveWithAuthority(category,input,ctx,forceRefresh,allowedOptional,authority);
    }
    const existing=this.coalesced.get(key);
    if(existing){
      void existing.then((result)=>{if(result.provider)return this.safeRecord({providerId:result.provider,adapterId:`live.${category.toLowerCase()}.${result.provider}`,category,eventType:'REQUEST_COALESCED',inputHash,outcome:'DEDUPLICATED',coalesced:true},ctx);});
      return existing;
    }
    const promise=this.withAdapterRuntime(category,ctx,()=>this.resolveOnce(category,input,ctx,forceRefresh,allowedOptional)).finally(()=>this.coalesced.delete(key));
    this.coalesced.set(key,promise);
    return promise;
  }

  private resolveWithAuthority(category:AdapterCategory,input:AdapterInput,ctx:RequestContext,forceRefresh:boolean,allowedOptional:ReadonlySet<string>,authority:unknown){
    const inputHash=hash(input),key=`${ctx.companyId}:${category}:${inputHash}:${[...allowedOptional].sort().join(',')}`;
    const existing=this.coalesced.get(key);
    if(existing)return existing;
    const promise=this.withAdapterRuntime(category,ctx,()=>this.resolveOnce(category,input,ctx,forceRefresh,allowedOptional)).then((result)=>({...result,canonicalAuthority:authority})).finally(()=>this.coalesced.delete(key));
    this.coalesced.set(key,promise);
    return promise;
  }

  private async resolveOnce(category:AdapterCategory,input:AdapterInput,ctx:RequestContext,forceRefresh:boolean,allowedOptional:ReadonlySet<string>):Promise<LiveResolution>{
    const inputHash=hash(input),cacheKey=hash({category,input});
    const cached=await this.prisma.liveAdapterCache.findUnique({where:{companyId_category_cacheKey:{companyId:ctx.companyId,category,cacheKey}}});
    const usableCached=cached&&(!OPTIONAL_EXTERNAL_PROVIDERS.has(cached.providerId)||allowedOptional.has(cached.providerId))?cached:null;
    const now=new Date();
    if(usableCached&&!forceRefresh&&usableCached.validUntil>now){
      await this.cacheTelemetry(ctx.companyId,category,usableCached.providerId,usableCached.fetchedAt);
      await this.safeRecord({providerId:usableCached.providerId,adapterId:`live.${category.toLowerCase()}.${usableCached.providerId}`,category,eventType:'CACHE_HIT',inputHash,outcome:'HIT',cacheHit:true},ctx);
      return{mode:'CACHE',status:'HEALTHY',provider:usableCached.providerId,data:usableCached.payload as unknown as NormalizedLiveContract,cacheAgeSeconds:Math.floor((Date.now()-usableCached.fetchedAt.getTime())/1000)};
    }

    const configured=this.providers.filter((item)=>item.category===category&&item.configured()&&(!OPTIONAL_EXTERNAL_PROVIDERS.has(item.providerId)||allowedOptional.has(item.providerId))).sort((a,b)=>a.priority-b.priority);
    const adapters:LiveProviderAdapter[]=[];
    let lastCode=configured.length?'PROVIDER_NOT_ACTIVE':'NO_CONFIGURED_PROVIDER';
    for(const adapter of configured){
      if(!this.pilot){adapters.push(adapter);continue;}
      const eligibility=await this.pilot.eligibility(adapter.providerId,ctx);
      if(eligibility.allowed)adapters.push(adapter);else lastCode=eligibility.reason;
    }

    for(let index=0;index<adapters.length;index++){
      const adapter=adapters[index],started=Date.now();
      try{
        const data=await adapter.fetch(input as never);
        validate(data,category);
        const fetchedAt=new Date(data.timestamp),validUntil=new Date(data.validUntil),payloadHash=hash(data);
        const snapshot=await this.prisma.$transaction(async(tx)=>{
          await tx.liveAdapterCache.upsert({
            where:{companyId_category_cacheKey:{companyId:ctx.companyId,category,cacheKey}},
            create:{companyId:ctx.companyId,category,providerId:adapter.providerId,cacheKey,inputHash,payloadHash,payload:json(data),sourceReference:data.sourceReference,fetchedAt,validUntil},
            update:{providerId:adapter.providerId,inputHash,payloadHash,payload:json(data),sourceReference:data.sourceReference,fetchedAt,validUntil},
          });
          return tx.liveMobilitySnapshot.create({data:{companyId:ctx.companyId,category,contractType:data.contractType,contractVersion:LIVE_ADAPTER_CONTRACT_VERSION,providerId:adapter.providerId,sourceReference:data.sourceReference,inputHash,payloadHash,payload:json(data),fetchedAt,validUntil,confidence:data.confidence}});
        });
        const latencyMs=Date.now()-started,fallback=index>0||adapter.priority>10,recalculation=category==='ROUTE'&&forceRefresh&&Boolean(usableCached);
        await this.telemetry(ctx.companyId,adapter,'HEALTHY',latencyMs,fallback?`PRIMARY_TO_${adapter.providerId.toUpperCase()}`:undefined);
        await this.safeRecord({providerId:adapter.providerId,adapterId:adapter.adapterId,category,eventType:'PROVIDER_REQUEST',inputHash,outcome:'SUCCESS',latencyMs,recalculation,fallbackActivation:fallback},ctx);
        return{mode:'LIVE',status:fallback?'DEGRADED':'HEALTHY',snapshotId:snapshot.id,provider:adapter.providerId,data,warning:fallback?'PRIMARY_PROVIDER_UNAVAILABLE_SECONDARY_USED':undefined};
      }catch(error){
        const lastError=error instanceof LiveProviderError?error:new LiveProviderError('UNAVAILABLE');
        lastCode=lastError.code;
        const latencyMs=Date.now()-started;
        await this.telemetry(ctx.companyId,adapter,lastCode==='RATE_LIMITED'?'RATE_LIMITED':'UNAVAILABLE',latencyMs,undefined,lastCode);
        await this.safeRecord({providerId:adapter.providerId,adapterId:adapter.adapterId,category,eventType:'PROVIDER_REQUEST',inputHash,outcome:'ERROR',latencyMs,recalculation:category==='ROUTE'&&forceRefresh&&Boolean(usableCached),rateLimited:lastCode==='RATE_LIMITED',timeout:lastCode==='TIMEOUT',errorCode:lastCode},ctx);
      }
    }

    if(usableCached){
      const cachedData=usableCached.payload as unknown as NormalizedLiveContract;
      const staleData={...cachedData,freshness:'STALE' as const,warnings:[...cachedData.warnings,'STALE_CACHE_FALLBACK'],validUntil:usableCached.validUntil.toISOString()};
      await this.cacheTelemetry(ctx.companyId,category,usableCached.providerId,usableCached.fetchedAt,true);
      await this.safeRecord({providerId:usableCached.providerId,adapterId:`live.${category.toLowerCase()}.${usableCached.providerId}`,category,eventType:'STALE_CACHE_HIT',inputHash,outcome:'STALE',cacheHit:true,stale:true,errorCode:lastCode},ctx);
      return{mode:'STALE_CACHE',status:'STALE',provider:usableCached.providerId,data:staleData,warning:'STALE_CACHE_EXPLICIT_WARNING',cacheAgeSeconds:Math.floor((Date.now()-usableCached.fetchedAt.getTime())/1000)};
    }
    await this.categoryTelemetry(ctx.companyId,category,'DEGRADED','manual',lastCode);
    return{mode:'MANUAL',status:'DEGRADED',warning:`${lastCode}:MANUAL_FALLBACK_REQUIRED`};
  }

  ingestPlatformFeed(dto:PlatformFeedDto,ctx:RequestContext){
    return this.withAdapterRuntime('PLATFORM_FEED',ctx,()=>this.ingestPlatformFeedObserved(dto,ctx));
  }

  private async ingestPlatformFeedObserved(dto:PlatformFeedDto,ctx:RequestContext){
    const started=Date.now();
    try{
      this.authorize(ctx);
      const feed:PlatformOpportunityFeed={contractType:'PlatformOpportunityFeed',...dto,freshness:!dto.validUntil||new Date(dto.validUntil)>new Date()?'LIVE':'STALE'};
      const expected=hash({platform:dto.sourcePlatform,id:dto.sourceOpportunityId,fields:dto.normalizedFields});
      if(dto.dedupFingerprint!==expected)throw new LiveProviderError('MALFORMED_RESPONSE','PLATFORM_DEDUP_FINGERPRINT_MISMATCH');
      const f=dto.normalizedFields as Record<string,unknown>;
      const result=await this.opportunities.intake({idempotencyKey:`platform-feed:${dto.sourcePlatform}:${dto.rawReference}`,channel:'platform-api',provider:dto.sourcePlatform,platformReference:dto.rawReference,sourceOpportunityId:dto.sourceOpportunityId,platform:dto.sourcePlatform,pickupLocation:text(f.pickupLocation),deliveryLocation:text(f.deliveryLocation),pickupWindowStart:text(f.pickupWindowStart),deliveryWindowStart:text(f.deliveryWindowStart),priceAmount:number(f.priceAmount),currencyCode:text(f.currencyCode),declaredKm:number(f.declaredKm),vehicleType:text(f.vehicleType),sourceTimestamp:dto.sourceTimestamp,retainRawPayload:false},ctx);
      const payloadHash=hash(feed);
      const snapshot=await this.prisma.liveMobilitySnapshot.create({data:{companyId:ctx.companyId,category:'PLATFORM_FEED',contractType:feed.contractType,contractVersion:LIVE_ADAPTER_CONTRACT_VERSION,entityReference:result.normalizedOpportunityId??undefined,providerId:dto.sourcePlatform,sourceReference:dto.rawReference,inputHash:expected,payloadHash,payload:json(feed),fetchedAt:new Date(dto.sourceTimestamp),validUntil:new Date(dto.validUntil??new Date(dto.sourceTimestamp).getTime()+60*60_000),stale:feed.freshness==='STALE',confidence:dto.confidence}});
      await this.categoryTelemetry(ctx.companyId,'PLATFORM_FEED',feed.freshness==='STALE'?'STALE':'HEALTHY',dto.sourcePlatform,undefined,Date.now()-started);
      return{feed,snapshotId:snapshot.id,...result};
    }catch(error){
      const code=error instanceof LiveProviderError?error.code:'PLATFORM_FEED_EXECUTION_FAILED';
      await this.categoryTelemetry(ctx.companyId,'PLATFORM_FEED','UNAVAILABLE',dto.sourcePlatform||'unknown',code,Date.now()-started);
      throw error;
    }
  }

  async opportunityInput(dto:MobilityInputDto,ctx:RequestContext){
    this.authorize(ctx);
    const ids=[dto.routeSnapshotId,dto.trafficSnapshotId,dto.tollSnapshotId,...(dto.transitSnapshotIds??[])].filter((v):v is string=>Boolean(v));
    const snapshots=await this.prisma.liveMobilitySnapshot.findMany({where:{companyId:ctx.companyId,id:{in:ids}}});
    if(snapshots.length!==ids.length)throw new NotFoundException('LIVE_MOBILITY_SNAPSHOT_NOT_FOUND');
    const route=snapshots.find((s)=>s.id===dto.routeSnapshotId)?.payload as unknown as RouteResult;
    if(route.contractType!=='RouteResult')throw new LiveProviderError('MALFORMED_RESPONSE');
    const traffic=snapshots.find((s)=>s.id===dto.trafficSnapshotId)?.payload as unknown as TrafficSnapshot|undefined;
    const tollSnapshot=snapshots.find((s)=>s.id===dto.tollSnapshotId),toll=tollSnapshot?.payload as unknown as TollEstimate|undefined;
    const transit=snapshots.filter((s)=>(dto.transitSnapshotIds??[]).includes(s.id)).map((s)=>s.payload as unknown as TransitOption);
    const now=Date.now(),all=[route,traffic,toll,...transit].filter(Boolean) as NormalizedLiveContract[];
    const stale=all.some((item)=>new Date(item.validUntil).getTime()<=now||item.freshness==='STALE');
    if(toll)await this.safeRecord({providerId:toll.provider,adapterId:'opportunity.cost-risk',category:'TOLL',eventType:'TOLL_VALUE_APPLIED',inputHash:hash({snapshotId:tollSnapshot?.id,routeReference:toll.routeReference}),outcome:'COST_RISK_INPUT',metrics:{snapshotId:tollSnapshot?.id,estimatedToll:toll.estimatedToll,currencyCode:toll.currencyCode}},ctx);
    return{
      route:{distanceKm:Math.round(route.distanceKm),durationMinutes:route.estimatedDurationMinutes+(traffic?.delayMinutes??0),distanceToPickupKm:Math.round(route.distanceKm),repositionKm:Math.round(route.distanceKm),repositionMinutes:route.estimatedDurationMinutes+(traffic?.delayMinutes??0),mobilityModes:transit.length?['ROAD',...new Set(transit.flatMap((item)=>item.modes))]:['ROAD'],tolls:toll?[{label:'Live toll estimate',amount:toll.estimatedToll,currencyCode:toll.currencyCode}]:[],restrictions:route.restrictions,sources:all.map((item)=>item.sourceReference),assumptions:['NORMALIZED_ADAPTER_CONTRACTS_ONLY'],confidence:Math.min(...all.map((item)=>item.confidence)),warnings:[...all.flatMap((item)=>item.warnings),...(stale?['LIVE_SOURCE_EXPIRED_RECALCULATION_REQUIRED']:[])],validForMinutes:Math.max(1,Math.floor((Math.min(...all.map((item)=>new Date(item.validUntil).getTime()))-now)/60_000))},
      cost:{train:sum(transit.filter((item)=>item.modes.some((mode)=>/TRAIN|RAIL/i.test(mode))).map((item)=>item.estimatedPrice??0)),bus:sum(transit.filter((item)=>item.modes.some((mode)=>/BUS/i.test(mode))).map((item)=>item.estimatedPrice??0)),tolls:toll?.estimatedToll??0,assumptions:['ESTIMATED_NOT_ACTUAL']},
      freshnessStatus:stale?'STALE':'FRESH',sourceSnapshotIds:ids,
    };
  }

  telemetrySnapshot(ctx:RequestContext){this.authorize(ctx);return this.prisma.liveAdapterTelemetry.findMany({where:{companyId:ctx.companyId},orderBy:{adapterId:'asc'}});}

  private async telemetry(companyId:string,adapter:LiveProviderAdapter,status:string,latencyMs:number,fallbackActivation?:string,lastErrorCode?:string){
    const old=await this.prisma.liveAdapterTelemetry.findUnique({where:{companyId_adapterId:{companyId,adapterId:adapter.adapterId}}});
    const requests=(old?.requestCount??0)+1,errors=(old?.errorCount??0)+(status==='HEALTHY'?0:1);
    return this.prisma.liveAdapterTelemetry.upsert({
      where:{companyId_adapterId:{companyId,adapterId:adapter.adapterId}},
      create:{companyId,adapterId:adapter.adapterId,category:adapter.category,providerId:adapter.providerId,status,lastAttemptAt:new Date(),lastSuccessAt:status==='HEALTHY'?new Date():undefined,latencyMs,requestCount:requests,errorCount:errors,errorRateBps:Math.round(errors/requests*10_000),rateLimitState:status==='RATE_LIMITED'?'ACTIVE':'CLEAR',fallbackActivation,lastErrorCode,contractVersion:LIVE_ADAPTER_CONTRACT_VERSION},
      update:{status,lastAttemptAt:new Date(),lastSuccessAt:status==='HEALTHY'?new Date():old?.lastSuccessAt,latencyMs,requestCount:requests,errorCount:errors,errorRateBps:Math.round(errors/requests*10_000),rateLimitState:status==='RATE_LIMITED'?'ACTIVE':'CLEAR',fallbackActivation:fallbackActivation??null,lastErrorCode:lastErrorCode??null,contractVersion:LIVE_ADAPTER_CONTRACT_VERSION},
    });
  }

  private cacheTelemetry(companyId:string,category:AdapterCategory,providerId:string,fetchedAt:Date,stale=false){
    const adapterId=`live.${category.toLowerCase()}.${providerId}`;
    return this.prisma.liveAdapterTelemetry.upsert({where:{companyId_adapterId:{companyId,adapterId}},create:{companyId,adapterId,category,providerId,status:stale?'STALE':'HEALTHY',lastAttemptAt:new Date(),lastSuccessAt:fetchedAt,requestCount:0,errorCount:0,errorRateBps:0,rateLimitState:'CLEAR',cacheAgeSeconds:Math.floor((Date.now()-fetchedAt.getTime())/1000),contractVersion:LIVE_ADAPTER_CONTRACT_VERSION},update:{status:stale?'STALE':'HEALTHY',lastAttemptAt:new Date(),cacheAgeSeconds:Math.floor((Date.now()-fetchedAt.getTime())/1000)}});
  }
  private categoryTelemetry(companyId:string,category:AdapterCategory|'PLATFORM_FEED',status:string,providerId:string,lastErrorCode?:string,latencyMs?:number){
    const adapterId=`live.${category.toLowerCase().replace('_','-')}.runtime`;
    const now=new Date();
    return this.prisma.liveAdapterTelemetry.upsert({where:{companyId_adapterId:{companyId,adapterId}},create:{companyId,adapterId,category,providerId,status,lastAttemptAt:now,lastSuccessAt:status==='HEALTHY'?now:undefined,latencyMs,requestCount:1,errorCount:status==='HEALTHY'?0:1,errorRateBps:status==='HEALTHY'?0:10_000,rateLimitState:'CLEAR',lastErrorCode,contractVersion:LIVE_ADAPTER_CONTRACT_VERSION},update:{providerId,status,lastAttemptAt:now,...(status==='HEALTHY'?{lastSuccessAt:now}:{}),latencyMs,requestCount:{increment:1},errorCount:{increment:status==='HEALTHY'?0:1},errorRateBps:status==='HEALTHY'?0:10_000,lastErrorCode:lastErrorCode??null}});
  }
  private async withAdapterRuntime<T extends LiveResolution|Record<string,unknown>>(category:AdapterCategory|'PLATFORM_FEED',ctx:RequestContext,execute:()=>Promise<T>):Promise<T>{
    const operationId=randomUUID(),agentId=adapterAgentId(category),startedAt=new Date();
    await this.safeRuntimeEvent(ctx.companyId,agentId,operationId,'STARTED',1,startedAt,`Adapter category ${category} invocation started.`);
    try{
      const result=await execute();
      const status='status' in result&&typeof result.status==='string'?result.status:'COMPLETED';
      const outputRef='snapshotId' in result&&typeof result.snapshotId==='string'?`LiveMobilitySnapshot:${result.snapshotId}`:`AdapterInvocation:${operationId}`;
      await this.safeRuntimeEvent(ctx.companyId,agentId,operationId,'COMPLETED',2,new Date(),`Adapter category ${category} completed with ${status}.`,outputRef);
      return result;
    }catch(error){
      const code=error instanceof LiveProviderError?error.code:'ADAPTER_EXECUTION_FAILED';
      await this.safeRuntimeEvent(ctx.companyId,agentId,operationId,'FAILED',2,new Date(),`Adapter category ${category} failed with ${code}.`,`failure:${code}`);
      throw error;
    }
  }
  private async safeRuntimeEvent(companyId:string,agentId:string,operationId:string,lifecycle:'STARTED'|'COMPLETED'|'FAILED',sequence:number,occurredAt:Date,detail:string,outputRef?:string){
    try{await this.prisma.agentRuntimeEvent.create({data:{companyId,eventId:randomUUID(),mandateId:`live-adapter:${agentId}`,agentId,dossierId:operationId,lifecycle,sequence,occurredAt,evidenceRef:`AdapterInvocation:${operationId}`,outputRef,detail}});}catch{/* stale/missing runtime evidence remains visible if instrumentation persistence fails */}
  }
  private async safeRecord(input:Parameters<PilotOperationsService['record']>[0],ctx:RequestContext){try{await this.pilot?.record(input,ctx);}catch{/* telemetry cannot block Car Mover */}}
  private authorizedOptionalProviders(authorization:OptionalExternalProviderAuthorization|undefined,ctx:RequestContext):ReadonlySet<string>{
    if(!authorization)return new Set();
    if(!ctx.roles.some((role)=>['OWNER','company_owner'].includes(role)))throw new ForbiddenException('OPTIONAL_EXTERNAL_PROVIDER_OWNER_AUTHORIZATION_REQUIRED');
    if(!/^[A-Z0-9][A-Z0-9_.:-]{2,159}$/i.test(authorization.authorizationReference))throw new ForbiddenException('OPTIONAL_EXTERNAL_PROVIDER_AUTHORIZATION_REFERENCE_INVALID');
    return new Set(authorization.providerIds);
  }
  private authorize(ctx:RequestContext){if(!ctx.roles.includes('PREMIUM_ACCESS')&&!ctx.roles.includes('OWNER'))throw new ForbiddenException('Premium access required.');}
}

function validate(data:NormalizedLiveContract,category:AdapterCategory){const expected={GEOCODING:'GeocodingResult',ROUTE:'RouteResult',TRAFFIC:'TrafficSnapshot',TOLL:'TollEstimate',TRANSIT:'TransitOption'}[category];if(data.contractType!==expected||!data.provider||!data.sourceReference||!Number.isFinite(data.confidence)||Number.isNaN(new Date(data.validUntil).getTime()))throw new LiveProviderError('MALFORMED_RESPONSE');}
const text=(v:unknown)=>typeof v==='string'?v:undefined;
const number=(v:unknown)=>Number.isFinite(Number(v))?Number(v):undefined;
const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);
const adapterAgentId=(category:AdapterCategory|'PLATFORM_FEED')=>`premium.adapters.${({GEOCODING:'geocoding',ROUTE:'routing',TRAFFIC:'traffic',TOLL:'toll',TRANSIT:'transit',PLATFORM_FEED:'platform-feed'} as Record<string,string>)[category]}`;
