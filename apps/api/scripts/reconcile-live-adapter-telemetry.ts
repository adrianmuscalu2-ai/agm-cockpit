import { PrismaClient } from '@prisma/client';

const prisma=new PrismaClient();
const adapters=[
  {adapterId:'live.geocoding.tomtom',providerId:'tomtom',category:'GEOCODING'},
  {adapterId:'live.route.tomtom',providerId:'tomtom',category:'ROUTE'},
  {adapterId:'live.traffic.tomtom',providerId:'tomtom',category:'TRAFFIC'},
  {adapterId:'live.geocoding.here',providerId:'here',category:'GEOCODING'},
  {adapterId:'live.route.here',providerId:'here',category:'ROUTE'},
  {adapterId:'live.transit.here',providerId:'here',category:'TRANSIT'},
  {adapterId:'live.toll.tollguru',providerId:'tollguru',category:'TOLL'},
] as const;

async function main(){
  const company=await prisma.company.findFirst({orderBy:{createdAt:'asc'}});if(!company)throw new Error('COMPANY_NOT_FOUND');
  const result=[];
  for(const adapter of adapters){
    const events=await prisma.providerUsageEvent.findMany({where:{companyId:company.id,adapterId:adapter.adapterId,eventType:'PROVIDER_REQUEST'},orderBy:{occurredAt:'asc'}});
    const latest=events.at(-1),success=[...events].reverse().find((event)=>event.outcome==='SUCCESS');
    const errors=events.filter((event)=>event.outcome==='ERROR').length,status=!latest?'NO_TELEMETRY':latest.outcome==='SUCCESS'?'HEALTHY':latest.rateLimited?'RATE_LIMITED':'UNAVAILABLE';
    const existing=await prisma.liveAdapterTelemetry.findUnique({where:{companyId_adapterId:{companyId:company.id,adapterId:adapter.adapterId}}});
    if(existing)await prisma.liveAdapterTelemetry.update({where:{id:existing.id},data:{category:adapter.category,providerId:adapter.providerId,status,lastAttemptAt:latest?.occurredAt??existing.lastAttemptAt,lastSuccessAt:success?.occurredAt??null,latencyMs:latest?.latencyMs??null,requestCount:events.length,errorCount:errors,errorRateBps:events.length?Math.round(errors/events.length*10_000):0,rateLimitState:latest?.rateLimited?'ACTIVE':'CLEAR',fallbackActivation:latest?.fallbackActivation?`PRIMARY_TO_${adapter.providerId.toUpperCase()}`:null,cacheAgeSeconds:null,lastErrorCode:latest?.errorCode??null,requestCostMicros:null,contractVersion:'agm-live-adapters.v1'}});
    result.push({adapterId:adapter.adapterId,status,realProviderRequests:events.length,realErrors:errors,secretDisplayed:false});
  }
  console.log(JSON.stringify({verdict:'LIVE_TELEMETRY_RECONCILED',source:'PROVIDER_USAGE_EVENTS_ONLY',result},null,2));
}

void main().catch((error)=>{console.error(error instanceof Error?error.message:'RECONCILIATION_FAILED');process.exitCode=1;}).finally(()=>prisma.$disconnect());
