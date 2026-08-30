export const LIVE_ADAPTER_CONTRACT_VERSION = 'agm-live-adapters.v1';
export type AdapterCategory = 'GEOCODING'|'ROUTE'|'TRAFFIC'|'TOLL'|'TRANSIT';
export type AdapterStatus = 'HEALTHY'|'DEGRADED'|'RATE_LIMITED'|'UNAVAILABLE'|'STALE'|'NO_TELEMETRY';
export type Coordinates = { latitude:number; longitude:number };
export type NormalizedLocation = { label:string; coordinates:Coordinates; countryCode?:string; postalCode?:string };
export type LiveMetadata = { provider:string; timestamp:string; validUntil:string; freshness:'LIVE'|'STALE'; confidence:number; sourceReference:string; warnings:readonly string[] };
export type GeocodingResult = LiveMetadata & { contractType:'GeocodingResult'; normalizedLocation:NormalizedLocation; ambiguous:boolean; alternatives:readonly NormalizedLocation[] };
export type RouteAlternative = { distanceKm:number; estimatedDurationMinutes:number; polyline?:string; tollRoad:boolean; restrictions:readonly string[] };
export type RouteResult = LiveMetadata & { contractType:'RouteResult'; origin:NormalizedLocation; destination:NormalizedLocation; distanceKm:number; estimatedDurationMinutes:number; alternatives:readonly RouteAlternative[]; tollsAvailable:boolean; restrictions:readonly string[]; trafficDelayMinutes?:number };
export type TrafficSnapshot = LiveMetadata & { contractType:'TrafficSnapshot'; affectedSegment:{ origin:Coordinates; destination:Coordinates }; delayMinutes:number; congestionLevel:'FREE_FLOW'|'MODERATE'|'HEAVY'|'CLOSED'|'UNKNOWN' };
export type TollEstimate = LiveMetadata & { contractType:'TollEstimate'; routeReference:string; estimatedToll:number; currencyCode:string; assumptions:readonly string[] };
export type TransitOption = LiveMetadata & { contractType:'TransitOption'; origin:NormalizedLocation; destination:NormalizedLocation; departure:string; arrival:string; transfers:number; durationMinutes:number; estimatedPrice?:number; currencyCode?:string; operator:string; modes:readonly string[] };
export type PlatformOpportunityFeed = { contractType:'PlatformOpportunityFeed'; sourcePlatform:string; sourceOpportunityId:string; rawReference:string; normalizedFields:Record<string,unknown>; sourceTimestamp:string; validUntil?:string; freshness:'LIVE'|'STALE'; confidence:number; dedupFingerprint:string };
export type NormalizedLiveContract = GeocodingResult|RouteResult|TrafficSnapshot|TollEstimate|TransitOption;

export type GeocodingInput = { query:string; countrySet?:string[] };
export type RouteInput = { origin:Coordinates; destination:Coordinates; departureTime?:string; vehicle?:{ commercial?:boolean; weightKg?:number; heightMeters?:number; widthMeters?:number; lengthMeters?:number } };
export type TrafficInput = { origin:Coordinates; destination:Coordinates };
export const TOLL_REQUIRED_REASONS = ['ROUTE_TOLL_SEGMENTS','COST_RISK_EXPLICIT','ROUTE_PROVIDER_INSUFFICIENT','USER_REQUESTED','JUDGE_DISCRIMINATOR'] as const;
export type TollRequiredReason = typeof TOLL_REQUIRED_REASONS[number];
export type TollInput = { routeReference:string; origin:Coordinates; destination:Coordinates; tollRequired:boolean; tollReason?:TollRequiredReason; departureTime?:string; vehicle?:{ type?:string; axles?:number; weightKg?:number; emissionClass?:string }; authoritySources?:readonly {sourceId:string;jurisdiction:string}[]; authorityScopeConfirmed?:boolean };
export type TransitInput = { origin:Coordinates; destination:Coordinates; departureTime:string };
export type AdapterInput = GeocodingInput|RouteInput|TrafficInput|TollInput|TransitInput;

export interface LiveProviderAdapter<TInput extends AdapterInput = AdapterInput> {
  readonly adapterId:string; readonly providerId:string; readonly category:AdapterCategory; readonly priority:number;
  configured():boolean;
  fetch(input:TInput):Promise<NormalizedLiveContract>;
}

export type LiveResolution = { mode:'LIVE'|'CACHE'|'STALE_CACHE'|'MANUAL'|'SKIPPED'; status:AdapterStatus; snapshotId?:string; provider?:string; data?:NormalizedLiveContract; warning?:string; cacheAgeSeconds?:number; canonicalAuthority?:unknown };

export const FRESHNESS_MS:Record<AdapterCategory,number>={GEOCODING:30*24*60*60_000,ROUTE:30*60_000,TRAFFIC:3*60_000,TOLL:30*60_000,TRANSIT:15*60_000};

export class LiveProviderError extends Error {
  constructor(public readonly code:'RATE_LIMITED'|'TIMEOUT'|'UNAVAILABLE'|'MALFORMED_RESPONSE',message:string=code){super(message);}
}

export function coordinates(value:unknown):Coordinates {
  const item=value as Record<string,unknown>;const latitude=Number(item?.latitude??item?.lat);const longitude=Number(item?.longitude??item?.lon??item?.lng);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude < -90||latitude > 90||longitude < -180||longitude > 180)throw new LiveProviderError('MALFORMED_RESPONSE');
  return {latitude,longitude};
}

export function location(label:string,point:unknown,countryCode?:string,postalCode?:string):NormalizedLocation {if(!label?.trim())throw new LiveProviderError('MALFORMED_RESPONSE');return{label:label.trim(),coordinates:coordinates(point),countryCode,postalCode};}
