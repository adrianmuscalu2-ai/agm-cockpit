import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../src/audit/audit.service';
import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';
import { CarMoverService } from '../src/car-mover/car-mover.service';
import type { RequestContext } from '../src/common/request-context';
import { LiveAdapterService } from '../src/live-adapters/live-adapter.service';
import { HereGeocodingAdapter, HereRouteAdapter, HereTransitAdapter, TollGuruAdapter, TomTomGeocodingAdapter, TomTomRouteAdapter, TomTomTrafficAdapter } from '../src/live-adapters/provider-adapters';
import { OpportunityIntelligenceService } from '../src/opportunity-intelligence/opportunity-intelligence.service';
import { PilotOperationsService } from '../src/pilot-operations/pilot-operations.service';
import { PrismaService } from '../src/prisma/prisma.service';

const config=new ConfigService(process.env),prisma=new PrismaService(config),pilot=new PilotOperationsService(prisma);
async function main(){
  await prisma.$connect();
  const user=await prisma.user.findFirst({where:{email:{equals:'agm.transporte.logistik@gmail.com',mode:'insensitive'},status:'Active'},include:{roles:{include:{role:true}}}});if(!user)throw new Error('PILOT_OWNER_ACCOUNT_NOT_FOUND');
  const ctx:RequestContext={companyId:user.companyId,userId:user.id,roles:[...user.roles.map((item)=>item.role.code),'OWNER','PREMIUM_ACCESS'],requestId:randomUUID(),correlationId:randomUUID()};
  const audit=new AuditService(prisma),authority=new AuthorityControlPlaneService(prisma),carMover=new CarMoverService(prisma,audit,pilot),oi=new OpportunityIntelligenceService(prisma,authority,carMover,audit);
  const live=new LiveAdapterService(prisma,oi,new TomTomGeocodingAdapter(config),new HereGeocodingAdapter(config),new TomTomRouteAdapter(config),new HereRouteAdapter(config),new TomTomTrafficAdapter(config),new TollGuruAdapter(config),new HereTransitAdapter(config),pilot);
  const before=await metrics(ctx),origin={latitude:48.1351,longitude:11.582},destination={latitude:48.5734,longitude:7.7521};
  const skipped=await live.resolve('TOLL',{routeReference:'pilot-no-toll-required',origin,destination,tollRequired:false},ctx,false);
  const input={routeReference:`pilot-cache-${Date.now()}`,origin,destination,tollRequired:true as const,tollReason:'USER_REQUESTED' as const,departureTime:new Date(Date.now()+2*60*60_000).toISOString(),vehicle:{type:'2AxlesAuto',axles:2}};
  const first=await live.resolve('TOLL',input,ctx,true),cached=await live.resolve('TOLL',input,ctx,false),after=await metrics(ctx);
  assert(skipped.mode==='SKIPPED'&&first.mode==='LIVE'&&first.provider==='tollguru'&&cached.mode==='CACHE','Conditional live/cache sequence failed');
  assert(after.requests-before.requests===1&&after.cacheHits-before.cacheHits===1&&after.skipped-before.skipped===1,'TollGuru cost guard counters are inconsistent');
  console.log(JSON.stringify({verdict:'PASS',secretValuesPrinted:false,tollRequiredBoundary:'PASS',providerRequestsAdded:1,cacheHitsAdded:1,notRequiredCallsAvoided:1,first:{mode:first.mode,status:first.status,provider:first.provider,freshness:first.data?.freshness},second:{mode:cached.mode,status:cached.status,provider:cached.provider,freshness:cached.data?.freshness},estimatedCostMicros:after.report.estimatedCostMicros,actualCostMicros:after.report.actualCostMicros,costBasis:after.report.costBasis},null,2));
}
async function metrics(ctx:RequestContext){const report=(await pilot.report(ctx)).providers.find((item)=>item.providerId==='tollguru');if(!report)throw new Error('TOLLGURU_REPORT_MISSING');return{report,requests:report.requestsTotal,cacheHits:report.cacheHits,skipped:report.tollCallsSkipped};}
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(`TOLLGURU_CACHE_GATE_FAILED:${message}`);}
void main().catch((error)=>{console.error(error instanceof Error?error.message:'TOLLGURU_CACHE_GATE_FAILED');process.exitCode=1;}).finally(()=>prisma.$disconnect());
