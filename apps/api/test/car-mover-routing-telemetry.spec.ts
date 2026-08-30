import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { RequestContext } from '../src/common/request-context';
import { CarMoverRoutingTelemetryService } from '../src/car-mover/car-mover-routing-telemetry.service';
import type { RecordRoutingObservationDto } from '../src/car-mover/dto/record-routing-observation.dto';

const context:RequestContext={companyId:'company-1',userId:'owner-1',roles:['OWNER','PREMIUM_ACCESS'],requestId:'request-1',correlationId:'correlation-1'};
const observation:RecordRoutingObservationDto={entityType:'JOB',entityId:'11111111-1111-4111-8111-111111111111',vehicleClass:'PASSENGER_CAR',routeSource:'TOM',cacheState:'MISS',tollStatus:'UNKNOWN',fallbackReason:'NONE',coreAvailability:'AVAILABLE',routeLatencyMs:240,externalProviderAssessment:'NOT_NEEDED',manualConfirmation:false,externalPaidLookup:false,finalRouteDecision:'PENDING'};

describe('Car Mover routing telemetry',()=>{
  const prisma=(rows:unknown[]=[])=>({
    carMoverJob:{findFirst:jest.fn().mockResolvedValue({id:observation.entityId}),findMany:jest.fn().mockResolvedValue([{id:observation.entityId,sourceReference:'FIELD-CASE-0001'}])},
    carMoverPlatformOffer:{findFirst:jest.fn()},
    providerUsageEvent:{create:jest.fn().mockResolvedValue({id:'observation-1'}),findMany:jest.fn().mockResolvedValue(rows)},
  });

  it('records every required field without turning hypotheses into PASS',async()=>{
    const db=prisma();
    const service=new CarMoverRoutingTelemetryService(db as never);
    await expect(service.record(observation,context)).resolves.toMatchObject({recorded:true,measurementStatus:'MEASURED_NOT_PREDECLARED'});
    expect(db.providerUsageEvent.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({providerId:'agm-routing-policy',latencyMs:240,cacheHit:false,fallbackActivation:false,estimatedCostMicros:0,metrics:expect.objectContaining({vehicleClass:'PASSENGER_CAR',routeSource:'TOM',cacheState:'MISS',tollStatus:'UNKNOWN',fallbackReason:'NONE',coreAvailability:'AVAILABLE',routeLatencyMs:240,externalProviderAssessment:'NOT_NEEDED',manualConfirmation:false,externalPaidLookup:false,finalRouteDecision:'PENDING',unknownIsNotZero:true,unknownIsNotSafe:true,unknownIsNotPass:true})})}));
    const report=await service.report(context);
    expect(report).toMatchObject({planningHypotheses:{fallbackRangePercent:[2,5],paidExternalRangePercent:[0,1],status:'HYPOTHESES_NOT_PASS'},target:{fallbackPercentMax:3,status:'TARGET_NOT_VERDICT'},runtimeReadiness:{valhallaOsm:'REGISTERED_NOT_RUNTIME_READY',agmTollLibrary:'REGISTERED_NOT_RUNTIME_READY'},providerRecommendation:'INSUFFICIENT_DATA_NO_PROVIDER_DECISION',fieldValidation:'INSUFFICIENT_DATA_NO_FIELD_DATA',verdict:'INSUFFICIENT_DATA_NO_FIELD_DATA'});
    await expect(service.protocol(context)).resolves.toMatchObject({phase:'CONTROLLED_FIELD_MEASUREMENT',defaultVehicleProfile:'PASSENGER_CAR',initialFieldResult:'NO_FIELD_DATA',assignedCases:[{id:observation.entityId,sourceReference:'FIELD-CASE-0001'}]});
  });

  it('rejects accepted unknown vehicles without human confirmation',async()=>{
    const service=new CarMoverRoutingTelemetryService(prisma() as never);
    await expect(service.record({...observation,vehicleClass:'UNKNOWN',routeSource:'UNKNOWN',fallbackReason:'VEHICLE_CLASS_UNKNOWN',finalRouteDecision:'ACCEPTED'},context)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects numeric confidence for an unknown toll',async()=>{
    const service=new CarMoverRoutingTelemetryService(prisma() as never);
    await expect(service.record({...observation,tollConfidence:0},context)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a paid lookup without an explicit authorization reference',async()=>{
    const service=new CarMoverRoutingTelemetryService(prisma() as never);
    await expect(service.record({...observation,routeSource:'EXTERNAL_PAID',externalPaidLookup:true},context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects registered but not runtime-ready Valhalla observations',async()=>{
    const service=new CarMoverRoutingTelemetryService(prisma() as never);
    await expect(service.record({...observation,routeSource:'VALHALLA'},context)).rejects.toThrow('VALHALLA_REGISTERED_NOT_RUNTIME_READY');
  });

  it('requires an error code when CORE is unavailable',async()=>{
    const service=new CarMoverRoutingTelemetryService(prisma() as never);
    await expect(service.record({...observation,coreAvailability:'UNAVAILABLE',fallbackReason:'TOM_UNAVAILABLE'},context)).rejects.toThrow('UNAVAILABLE_CORE_REQUIRES_ROUTE_ERROR_CODE');
  });

  it('preserves unknown latency as unknown instead of coercing it to zero',async()=>{
    const db=prisma();
    const service=new CarMoverRoutingTelemetryService(db as never);
    const pending:RecordRoutingObservationDto={...observation,routeSource:'UNKNOWN',cacheState:'NOT_APPLICABLE',coreAvailability:'UNKNOWN',externalProviderAssessment:'UNKNOWN'};
    delete pending.routeLatencyMs;
    await expect(service.record(pending,context)).resolves.toMatchObject({recorded:true});
    expect(db.providerUsageEvent.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({latencyMs:undefined,metrics:expect.objectContaining({routeLatencyMs:null,unknownIsNotZero:true})})}));
    await expect(service.record({...pending,routeLatencyMs:0},context)).rejects.toThrow('UNKNOWN_CORE_AVAILABILITY_MUST_NOT_HAVE_NUMERIC_LATENCY');
    const knownWithoutLatency:RecordRoutingObservationDto={...observation};
    delete knownWithoutLatency.routeLatencyMs;
    await expect(service.record(knownWithoutLatency,context)).rejects.toThrow('KNOWN_CORE_AVAILABILITY_REQUIRES_LATENCY');
  });

  it('issues PASS only for a sufficient measured sample and deduplicates cases',async()=>{
    const started=new Date('2026-07-01T10:00:00.000Z');
    const rows=Array.from({length:100},(_,index)=>({
      userId:`tester-${index%3}`,occurredAt:new Date(started.getTime()+(index%30)*86_400_000),
      metrics:{entityType:'JOB',entityId:`job-${index}`,vehicleClass:'PASSENGER_CAR',routeSource:'TOM',cacheState:'MISS',tollStatus:'NOT_APPLICABLE',tollConfidence:null,fallbackReason:'NONE',coreAvailability:'AVAILABLE',routeLatencyMs:200+index,routeErrorCode:null,tollErrorCode:null,externalProviderAssessment:'NOT_NEEDED',manualConfirmation:false,externalPaidLookup:false,finalRouteDecision:'ACCEPTED',coreResolved:true},
    }));
    rows.push({...rows[0],occurredAt:new Date('2026-07-30T11:00:00.000Z'),metrics:{...rows[0].metrics,routeLatencyMs:180}});
    const service=new CarMoverRoutingTelemetryService(prisma(rows) as never);
    const report=await service.report(context,'2026-07-01T00:00:00.000Z','2026-08-01T00:00:00.000Z');
    expect(report).toMatchObject({sampleStatus:{finalizedCases:100,distinctTesters:3,activeDays:30,elapsedDays:30,sufficient:true,reasons:[]},measured:{rawObservations:101,uniqueCases:100,finalizedCases:100,coreResolvedCount:100,coreResolvedRateBps:10_000,fallbackCount:0,unknownSafetyViolations:0},targetComparison:{fallbackTargetBps:300,measuredFallbackBps:0,status:'WITHIN_TARGET'},fieldValidation:'PASS'});
  });
});
