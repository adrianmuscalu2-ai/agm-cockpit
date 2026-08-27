import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FRESHNESS_MS,
  LiveProviderError,
  type GeocodingInput,
  type LiveProviderAdapter,
  type RouteInput,
  type TollInput,
  type TrafficInput,
  type TransitInput,
  location,
} from './live-adapter.contracts';

type ProviderAddress = { freeformAddress?: string; municipality?: string; countryCodeISO3?: string; countryCode?: string; postalCode?: string };
type GeocodingRow = { score?: number; title?: string; position?: unknown; address?: ProviderAddress; scoring?: { queryScore?: number } };
type TomTomRouteRow = { summary?: { lengthInMeters?: number; travelTimeInSeconds?: number; tollRoadLengthInMeters?: number; trafficDelayInSeconds?: number } };
type ProviderNotice = { code?: string };
type ProviderFare = { price?: { value?: number; currency?: string } };
type HereSection = {
  summary?: { length?: number; duration?: number };
  tolls?: unknown[];
  notices?: ProviderNotice[];
  departure?: { time?: string };
  arrival?: { time?: string };
  fares?: ProviderFare[];
  transport?: { name?: string; mode?: string };
  type?: string;
};
type HereRouteRow = { sections?: HereSection[] };
type TrafficFlow = { currentSpeed?: number; freeFlowSpeed?: number; currentTravelTime?: number; freeFlowTravelTime?: number; roadClosure?: boolean };
type TollRoute = { costs?: { tag?: number; cash?: number; currency?: string }; tollCosts?: number; tolls?: number; currency?: string };

@Injectable()
export class TomTomGeocodingAdapter implements LiveProviderAdapter<GeocodingInput> {
  readonly adapterId='live.geocoding.tomtom';readonly providerId='tomtom';readonly category='GEOCODING' as const;readonly priority=10;
  constructor(private readonly config:ConfigService){}
  configured(){return Boolean(this.config.get<string>('TOMTOM_API_KEY'));}
  async fetch(input:GeocodingInput){
    const key=this.config.getOrThrow<string>('TOMTOM_API_KEY');const url=new URL(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(input.query)}.json`);
    url.searchParams.set('key',key);url.searchParams.set('limit','5');if(input.countrySet?.length)url.searchParams.set('countrySet',input.countrySet.join(','));
    const body=await jsonFetch<{results?:GeocodingRow[]}>(url);const rows=body.results??[];if(!rows.length)throw new LiveProviderError('UNAVAILABLE','ADDRESS_UNKNOWN');
    const alternatives=rows.map((row)=>location(row.address?.freeformAddress??row.address?.municipality??input.query,row.position,row.address?.countryCodeISO3,row.address?.postalCode));
    const now=new Date();return{contractType:'GeocodingResult',normalizedLocation:alternatives[0],ambiguous:alternatives.length>1,alternatives:alternatives.slice(1),provider:this.providerId,timestamp:now.toISOString(),validUntil:new Date(now.getTime()+FRESHNESS_MS.GEOCODING).toISOString(),freshness:'LIVE',confidence:Math.round(Number(rows[0].score??0.8)*100),sourceReference:'tomtom:geocoding',warnings:[]} as const;
  }
}

@Injectable()
export class HereGeocodingAdapter implements LiveProviderAdapter<GeocodingInput> {
  readonly adapterId='live.geocoding.here';readonly providerId='here';readonly category='GEOCODING' as const;readonly priority=20;
  constructor(private readonly config:ConfigService){}
  configured(){return Boolean(this.config.get<string>('HERE_API_KEY'));}
  async fetch(input:GeocodingInput){
    const url=new URL('https://geocode.search.hereapi.com/v1/geocode');url.searchParams.set('q',input.query);url.searchParams.set('limit','5');url.searchParams.set('apiKey',this.config.getOrThrow<string>('HERE_API_KEY'));
    const body=await jsonFetch<{items?:GeocodingRow[]}>(url);const rows=body.items??[];if(!rows.length)throw new LiveProviderError('UNAVAILABLE','ADDRESS_UNKNOWN');
    const alternatives=rows.map((row)=>location(row.title??input.query,row.position,row.address?.countryCode,row.address?.postalCode));const now=new Date();
    return{contractType:'GeocodingResult',normalizedLocation:alternatives[0],ambiguous:alternatives.length>1,alternatives:alternatives.slice(1),provider:this.providerId,timestamp:now.toISOString(),validUntil:new Date(now.getTime()+FRESHNESS_MS.GEOCODING).toISOString(),freshness:'LIVE',confidence:rows[0].scoring?.queryScore?Math.round(rows[0].scoring.queryScore*100):85,sourceReference:'here:geocoding-v1',warnings:[]} as const;
  }
}

@Injectable()
export class TomTomRouteAdapter implements LiveProviderAdapter<RouteInput> {
  readonly adapterId='live.route.tomtom';readonly providerId='tomtom';readonly category='ROUTE' as const;readonly priority=10;
  constructor(private readonly config:ConfigService){}
  configured(){return Boolean(this.config.get<string>('TOMTOM_API_KEY'));}
  async fetch(input:RouteInput){
    const o=input.origin,d=input.destination;const url=new URL(`https://api.tomtom.com/routing/1/calculateRoute/${o.latitude},${o.longitude}:${d.latitude},${d.longitude}/json`);
    url.searchParams.set('key',this.config.getOrThrow<string>('TOMTOM_API_KEY'));url.searchParams.set('traffic','true');url.searchParams.set('routeType','fastest');url.searchParams.set('maxAlternatives','2');if(input.departureTime)url.searchParams.set('departAt',input.departureTime);if(input.vehicle?.commercial)url.searchParams.set('vehicleCommercial','true');
    const body=await jsonFetch<{routes?:TomTomRouteRow[]}>(url);const rows=body.routes??[];if(!rows.length)throw new LiveProviderError('UNAVAILABLE','ROUTE_UNAVAILABLE');
    const map=(row:TomTomRouteRow)=>({distanceKm:round(Number(row.summary?.lengthInMeters)/1000),estimatedDurationMinutes:Math.ceil(Number(row.summary?.travelTimeInSeconds)/60),tollRoad:Boolean(row.summary?.tollRoadLengthInMeters),restrictions:[] as string[]});
    const best=map(rows[0]);const now=new Date();return{contractType:'RouteResult',origin:location(`${o.latitude},${o.longitude}`,o),destination:location(`${d.latitude},${d.longitude}`,d),...best,alternatives:rows.slice(1).map(map),tollsAvailable:best.tollRoad,restrictions:[],trafficDelayMinutes:Math.ceil(Number(rows[0].summary?.trafficDelayInSeconds??0)/60),provider:this.providerId,timestamp:now.toISOString(),validUntil:new Date(now.getTime()+FRESHNESS_MS.ROUTE).toISOString(),freshness:'LIVE',confidence:90,sourceReference:'tomtom:routing-v1',warnings:[]} as const;
  }
}

@Injectable()
export class HereRouteAdapter implements LiveProviderAdapter<RouteInput> {
  readonly adapterId='live.route.here';readonly providerId='here';readonly category='ROUTE' as const;readonly priority=20;
  constructor(private readonly config:ConfigService){}
  configured(){return Boolean(this.config.get<string>('HERE_API_KEY'));}
  async fetch(input:RouteInput){
    const url=new URL('https://router.hereapi.com/v8/routes');url.searchParams.set('origin',`${input.origin.latitude},${input.origin.longitude}`);url.searchParams.set('destination',`${input.destination.latitude},${input.destination.longitude}`);url.searchParams.set('transportMode',input.vehicle?.commercial?'truck':'car');url.searchParams.set('return','summary,travelSummary');url.searchParams.set('alternatives','2');url.searchParams.set('departureTime',input.departureTime??new Date().toISOString());url.searchParams.set('apiKey',this.config.getOrThrow<string>('HERE_API_KEY'));
    const body=await jsonFetch<{routes?:HereRouteRow[]}>(url);const rows=body.routes??[];if(!rows.length)throw new LiveProviderError('UNAVAILABLE','ROUTE_UNAVAILABLE');
    const map=(row:HereRouteRow)=>{const sections=row.sections??[];return{distanceKm:round(sum(sections.map((section)=>Number(section.summary?.length??0)))/1000),estimatedDurationMinutes:Math.ceil(sum(sections.map((section)=>Number(section.summary?.duration??0)))/60),tollRoad:sections.some((section)=>Boolean(section.tolls?.length)),restrictions:sections.flatMap((section)=>(section.notices??[]).map((notice)=>String(notice.code??'NOTICE')))};};
    const best=map(rows[0]);const now=new Date();return{contractType:'RouteResult',origin:location(`${input.origin.latitude},${input.origin.longitude}`,input.origin),destination:location(`${input.destination.latitude},${input.destination.longitude}`,input.destination),...best,alternatives:rows.slice(1).map(map),tollsAvailable:best.tollRoad,restrictions:best.restrictions,provider:this.providerId,timestamp:now.toISOString(),validUntil:new Date(now.getTime()+FRESHNESS_MS.ROUTE).toISOString(),freshness:'LIVE',confidence:90,sourceReference:'here:routing-v8',warnings:[]} as const;
  }
}

@Injectable()
export class TomTomTrafficAdapter implements LiveProviderAdapter<TrafficInput> {
  readonly adapterId='live.traffic.tomtom';readonly providerId='tomtom';readonly category='TRAFFIC' as const;readonly priority=10;
  constructor(private readonly config:ConfigService){}
  configured(){return Boolean(this.config.get<string>('TOMTOM_API_KEY'));}
  async fetch(input:TrafficInput){
    const url=new URL('https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json');url.searchParams.set('point',`${input.origin.latitude},${input.origin.longitude}`);url.searchParams.set('unit','KMPH');url.searchParams.set('key',this.config.getOrThrow<string>('TOMTOM_API_KEY'));
    const body=await jsonFetch<{flowSegmentData?:TrafficFlow}>(url);const flow=body.flowSegmentData;if(!flow)throw new LiveProviderError('MALFORMED_RESPONSE');
    const current=Number(flow.currentSpeed),free=Number(flow.freeFlowSpeed),currentTime=Number(flow.currentTravelTime??0),freeTime=Number(flow.freeFlowTravelTime??0);if(![current,free,currentTime,freeTime].every(Number.isFinite)||free<=0)throw new LiveProviderError('MALFORMED_RESPONSE');
    const ratio=current/free;const now=new Date();return{contractType:'TrafficSnapshot',affectedSegment:input,delayMinutes:Math.max(0,Math.round(currentTime/60-freeTime/60)),congestionLevel:flow.roadClosure?'CLOSED':ratio<.45?'HEAVY':ratio<.8?'MODERATE':'FREE_FLOW',provider:this.providerId,timestamp:now.toISOString(),validUntil:new Date(now.getTime()+FRESHNESS_MS.TRAFFIC).toISOString(),freshness:'LIVE',confidence:90,sourceReference:'tomtom:traffic-flow-v4',warnings:[]} as const;
  }
}

@Injectable()
export class TollGuruAdapter implements LiveProviderAdapter<TollInput> {
  readonly adapterId='live.toll.tollguru';readonly providerId='tollguru';readonly category='TOLL' as const;readonly priority=10;
  constructor(private readonly config:ConfigService){}
  configured(){return Boolean(this.config.get<string>('TOLLGURU_API_KEY'));}
  async fetch(input:TollInput){
    const body=await jsonFetch<{routes?:TollRoute[];route?:TollRoute[];summary?:{routes?:TollRoute[]}}>(new URL('https://apis.tollguru.com/toll/v2/origin-destination-waypoints'),{method:'POST',headers:{'content-type':'application/json','x-api-key':this.config.getOrThrow<string>('TOLLGURU_API_KEY')},body:JSON.stringify({from:{lat:input.origin.latitude,lng:input.origin.longitude},to:{lat:input.destination.latitude,lng:input.destination.longitude},serviceProvider:'here',departure_time:input.departureTime,vehicle:{type:input.vehicle?.type??'2AxlesAuto',axles:input.vehicle?.axles,emissionClass:input.vehicle?.emissionClass}})});
    const route=body.routes?.[0]??body.route?.[0]??body.summary?.routes?.[0];const amount=Number(route?.costs?.tag??route?.costs?.cash??route?.tollCosts??route?.tolls);if(!Number.isFinite(amount))throw new LiveProviderError('MALFORMED_RESPONSE');
    const now=new Date();return{contractType:'TollEstimate',routeReference:input.routeReference,estimatedToll:round(amount),currencyCode:String(route?.costs?.currency??route?.currency??'EUR').toUpperCase(),assumptions:['PROVIDER_ESTIMATE_NOT_ACCOUNTING'],provider:this.providerId,timestamp:now.toISOString(),validUntil:new Date(now.getTime()+FRESHNESS_MS.TOLL).toISOString(),freshness:'LIVE',confidence:85,sourceReference:'tollguru:origin-destination-v2',warnings:[]} as const;
  }
}

@Injectable()
export class HereTransitAdapter implements LiveProviderAdapter<TransitInput> {
  readonly adapterId='live.transit.here';readonly providerId='here';readonly category='TRANSIT' as const;readonly priority=10;
  constructor(private readonly config:ConfigService){}
  configured(){return Boolean(this.config.get<string>('HERE_API_KEY'));}
  async fetch(input:TransitInput){
    const url=new URL('https://transit.router.hereapi.com/v8/routes');url.searchParams.set('origin',`${input.origin.latitude},${input.origin.longitude}`);url.searchParams.set('destination',`${input.destination.latitude},${input.destination.longitude}`);url.searchParams.set('departureTime',input.departureTime);url.searchParams.set('return','travelSummary,fares,intermediate');url.searchParams.set('apiKey',this.config.getOrThrow<string>('HERE_API_KEY'));
    const body=await jsonFetch<{routes?:HereRouteRow[]}>(url);const route=body.routes?.[0],sections=route?.sections??[];if(!sections.length)throw new LiveProviderError('UNAVAILABLE','TRANSIT_UNAVAILABLE');
    const departure=sections[0].departure?.time,arrival=sections.at(-1)?.arrival?.time;if(!departure||!arrival)throw new LiveProviderError('MALFORMED_RESPONSE');const fares=sections.flatMap((section)=>section.fares??[]),price=fares[0]?.price?.value;const now=new Date();
    return{contractType:'TransitOption',origin:location(`${input.origin.latitude},${input.origin.longitude}`,input.origin),destination:location(`${input.destination.latitude},${input.destination.longitude}`,input.destination),departure,arrival,transfers:Math.max(0,sections.length-1),durationMinutes:Math.ceil((new Date(arrival).getTime()-new Date(departure).getTime())/60_000),estimatedPrice:Number.isFinite(Number(price))?Number(price):undefined,currencyCode:fares[0]?.price?.currency,operator:String(sections.find((section)=>section.transport?.name)?.transport?.name??'HERE_TRANSIT'),modes:[...new Set(sections.map((section)=>String(section.type??section.transport?.mode??'TRANSIT')))],provider:this.providerId,timestamp:now.toISOString(),validUntil:new Date(Math.min(new Date(departure).getTime(),now.getTime()+FRESHNESS_MS.TRANSIT)).toISOString(),freshness:'LIVE',confidence:85,sourceReference:'here:public-transit-v8',warnings:[]} as const;
  }
}

export const LIVE_ADAPTERS=[TomTomGeocodingAdapter,HereGeocodingAdapter,TomTomRouteAdapter,HereRouteAdapter,TomTomTrafficAdapter,TollGuruAdapter,HereTransitAdapter];

async function jsonFetch<T>(url:URL,init:RequestInit={}):Promise<T>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8_000);try{const response=await fetch(url,{...init,signal:controller.signal});if(response.status===429)throw new LiveProviderError('RATE_LIMITED');if(!response.ok)throw new LiveProviderError('UNAVAILABLE',`PROVIDER_HTTP_${response.status}`);try{return await response.json() as T;}catch{throw new LiveProviderError('MALFORMED_RESPONSE');}}catch(error){if(error instanceof LiveProviderError)throw error;if((error as Error).name==='AbortError')throw new LiveProviderError('TIMEOUT');throw new LiveProviderError('UNAVAILABLE');}finally{clearTimeout(timer);}}
const round=(value:number)=>Math.round(value*100)/100;
const sum=(values:number[])=>values.reduce((left,right)=>left+right,0);
