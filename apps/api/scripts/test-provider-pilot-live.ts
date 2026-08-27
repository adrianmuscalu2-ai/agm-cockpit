import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../src/audit/audit.service';
import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';
import { CarMoverService } from '../src/car-mover/car-mover.service';
import type { RequestContext } from '../src/common/request-context';
import { CommunicationProviderRegistry } from '../src/communications/communication-provider.port';
import { CommunicationService } from '../src/communications/communication.service';
import { GmailCommunicationProvider } from '../src/communications/providers/gmail.provider';
import { LiveAdapterService } from '../src/live-adapters/live-adapter.service';
import { HereGeocodingAdapter, HereRouteAdapter, HereTransitAdapter, TollGuruAdapter, TomTomGeocodingAdapter, TomTomRouteAdapter, TomTomTrafficAdapter } from '../src/live-adapters/provider-adapters';
import { OpportunityIntelligenceService } from '../src/opportunity-intelligence/opportunity-intelligence.service';
import { PilotOperationsService } from '../src/pilot-operations/pilot-operations.service';
import { PrismaService } from '../src/prisma/prisma.service';

const config=new ConfigService(process.env),prisma=new PrismaService(config),pilot=new PilotOperationsService(prisma);
async function main(){
  await prisma.$connect();
  const user=await prisma.user.findFirst({where:{email:{equals:'agm.transporte.logistik@gmail.com',mode:'insensitive'},status:'Active'},include:{roles:{include:{role:true}}}});if(!user)throw new Error('PILOT_OWNER_ACCOUNT_NOT_FOUND');
  const ctx:RequestContext={companyId:user.companyId,userId:user.id,roles:[...user.roles.map((item)=>item.role.code),'OWNER','PREMIUM_ACCESS'],requestId:crypto.randomUUID(),correlationId:crypto.randomUUID()};
  const audit=new AuditService(prisma),authority=new AuthorityControlPlaneService(prisma),carMover=new CarMoverService(prisma,audit,pilot),oi=new OpportunityIntelligenceService(prisma,authority,carMover,audit);
  const tomtomGeo=new TomTomGeocodingAdapter(config),hereGeo=new HereGeocodingAdapter(config),tomtomRoute=new TomTomRouteAdapter(config),hereRoute=new HereRouteAdapter(config),tomtomTraffic=new TomTomTrafficAdapter(config),tollGuru=new TollGuruAdapter(config),hereTransit=new HereTransitAdapter(config);
  const live=new LiveAdapterService(prisma,oi,tomtomGeo,hereGeo,tomtomRoute,hereRoute,tomtomTraffic,tollGuru,hereTransit,pilot);
  const results:Record<string,unknown>={};
  const origin={latitude:coordinate('PILOT_ORIGIN_LAT',48.1351,-90,90),longitude:coordinate('PILOT_ORIGIN_LON',11.582,-180,180)};
  const destination={latitude:coordinate('PILOT_DESTINATION_LAT',48.5734,-90,90),longitude:coordinate('PILOT_DESTINATION_LON',7.7521,-180,180)};
  if(process.env.TOMTOM_API_KEY){
    results.geocoding=brief(await live.resolve('GEOCODING',{query:process.env.PILOT_DESTINATION_QUERY??'Strasbourg, France',countrySet:['FR']},ctx,true));
    const routeInput={origin,destination,departureTime:new Date(Date.now()+60*60_000).toISOString(),vehicle:{commercial:true}};
    results.route=brief(await live.resolve('ROUTE',routeInput,ctx,true));
    results.routeCache=brief(await live.resolve('ROUTE',routeInput,ctx,false));
    results.routeRecalculation=brief(await live.resolve('ROUTE',routeInput,ctx,true));
    results.traffic=brief(await live.resolve('TRAFFIC',{origin:routeInput.origin,destination:routeInput.destination},ctx,true));
  }else results.tomtom='READY_CREDENTIAL_REQUIRED';
  if(process.env.HERE_API_KEY){
    results.transit=brief(await live.resolve('TRANSIT',{origin,destination,departureTime:new Date(Date.now()+90*60_000).toISOString()},ctx,true));
    if(process.env.TOMTOM_API_KEY){const activation=await prisma.providerPilotActivation.findUnique({where:{companyId_providerId:{companyId:ctx.companyId,providerId:'tomtom'}}});if(activation){await pilot.setState('tomtom','SUSPENDED','CONTROLLED_FALLBACK_PROBE',ctx);try{results.tomtomToHereFallback=brief(await live.resolve('ROUTE',{origin,destination,departureTime:new Date(Date.now()+2*60*60_000).toISOString(),vehicle:{commercial:true}},ctx,true));}finally{await pilot.setState('tomtom','ACTIVE',undefined,ctx);}}}
  }else results.here='READY_CREDENTIAL_REQUIRED';
  if(process.env.TOLLGURU_API_KEY)results.toll=brief(await live.resolve('TOLL',{routeReference:`pilot-${origin.latitude},${origin.longitude}-${destination.latitude},${destination.longitude}`,origin,destination,tollRequired:true,tollReason:'USER_REQUESTED',departureTime:new Date(Date.now()+60*60_000).toISOString(),vehicle:{type:'2AxlesAuto',axles:2}},ctx,true));else results.tollguru='READY_CREDENTIAL_REQUIRED';
  if(process.env.GMAIL_FROM_ADDRESS){const gmail=new GmailCommunicationProvider(config),communications=new CommunicationService(prisma,new CommunicationProviderRegistry([gmail]),pilot);const sync=await communications.syncRecent('email',ctx);const extracted=await carMover.analyzeInboundOffers(ctx);const intake=await oi.importExistingOffers(ctx);results.gmail={sync,extracted,intake,automaticJobCreation:false};}else results.gmail='READY_CREDENTIAL_REQUIRED';
  const report=await pilot.report(ctx,new Date(Date.now()-24*60*60_000).toISOString(),new Date().toISOString());
  console.log(JSON.stringify({verdict:'PILOT_LIVE_PROBE_COMPLETE',secretValuesPrinted:false,automaticJobCreation:false,results,telemetry:report},null,2));
}
const brief=(value:any)=>({mode:value.mode,status:value.status,provider:value.provider,warning:value.warning,snapshotId:value.snapshotId,freshness:value.data?.freshness,sourceReference:value.data?.sourceReference});
const coordinate=(name:string,fallback:number,min:number,max:number)=>{const value=Number(process.env[name]??fallback);if(!Number.isFinite(value)||value<min||value>max)throw new Error(`${name}_INVALID`);return value;};
void main().catch((error)=>{console.error(error instanceof Error?error.message:'PILOT_LIVE_PROBE_FAILED');process.exitCode=1;}).finally(()=>prisma.$disconnect());
