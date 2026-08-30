import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { routingVehicleClasses, type RoutingVehicleClass } from '../car-mover.contract';

export const routeSources=['TOM','CACHE','VALHALLA','OFFICIAL_AUTHORITY','MANUAL','EXTERNAL_PAID','UNKNOWN'] as const;
export const routeCacheStates=['HIT','MISS','NOT_APPLICABLE'] as const;
export const tollKnowledgeStates=['VERIFIED','ESTIMATED','UNKNOWN','NOT_APPLICABLE'] as const;
export const routeFallbackReasons=['NONE','TOM_UNAVAILABLE','TOM_TIMEOUT','CACHE_MISS','ROUTE_RESTRICTIONS_INCOMPLETE','VEHICLE_CLASS_UNKNOWN','TOLL_DATA_INCOMPLETE','ADDRESS_AMBIGUOUS','USER_REQUESTED'] as const;
export const finalRouteDecisions=['ACCEPTED','REJECTED','PENDING'] as const;
export const coreAvailabilityStates=['AVAILABLE','DEGRADED','UNAVAILABLE','UNKNOWN'] as const;
export const externalProviderAssessments=['NOT_NEEDED','CANDIDATE','UNKNOWN'] as const;

export class RecordRoutingObservationDto {
  @IsIn(['JOB','OFFER']) entityType!:'JOB'|'OFFER';
  @IsUUID() entityId!:string;
  @IsIn(routingVehicleClasses) vehicleClass!:RoutingVehicleClass;
  @IsIn(routeSources) routeSource!:typeof routeSources[number];
  @IsIn(routeCacheStates) cacheState!:typeof routeCacheStates[number];
  @IsIn(tollKnowledgeStates) tollStatus!:typeof tollKnowledgeStates[number];
  @IsOptional() @IsInt() @Min(0) @Max(100) tollConfidence?:number;
  @IsIn(routeFallbackReasons) fallbackReason!:typeof routeFallbackReasons[number];
  @IsIn(coreAvailabilityStates) coreAvailability!:typeof coreAvailabilityStates[number];
  @IsOptional() @IsInt() @Min(0) @Max(600_000) routeLatencyMs?:number;
  @IsOptional() @IsString() @MaxLength(120) routeErrorCode?:string;
  @IsOptional() @IsString() @MaxLength(120) tollErrorCode?:string;
  @IsIn(externalProviderAssessments) externalProviderAssessment!:typeof externalProviderAssessments[number];
  @IsBoolean() manualConfirmation!:boolean;
  @IsBoolean() externalPaidLookup!:boolean;
  @IsOptional() @IsString() @MaxLength(160) externalAuthorizationReference?:string;
  @IsIn(finalRouteDecisions) finalRouteDecision!:typeof finalRouteDecisions[number];
  @IsOptional() @IsDateString() measuredAt?:string;
}
