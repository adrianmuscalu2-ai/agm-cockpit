import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AuditService } from '../src/audit/audit.service';
import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';
import { CarMoverService } from '../src/car-mover/car-mover.service';
import type { RequestContext } from '../src/common/request-context';
import { LiveAdapterService } from '../src/live-adapters/live-adapter.service';
import { HereGeocodingAdapter, HereRouteAdapter, HereTransitAdapter, TollGuruAdapter, TomTomGeocodingAdapter, TomTomRouteAdapter, TomTomTrafficAdapter } from '../src/live-adapters/provider-adapters';
import { OpportunityIntelligenceService } from '../src/opportunity-intelligence/opportunity-intelligence.service';
import { hash } from '../src/opportunity-intelligence/opportunity-intelligence.engine';
import { PilotOperationsService } from '../src/pilot-operations/pilot-operations.service';
import { PrismaService } from '../src/prisma/prisma.service';

type LeaseProof = { id:string; epoch:number; fencingToken:number; agentId:string; providerId:string };
type PilotState = 'ACTIVE'|'SUSPENDED'|'READY';

const config=new ConfigService(process.env),prisma=new PrismaService(config),pilot=new PilotOperationsService(prisma);

async function main(){
  await prisma.$connect();
  const user=await prisma.user.findFirst({where:{email:{equals:'agm.transporte.logistik@gmail.com',mode:'insensitive'},status:'Active'},include:{roles:{include:{role:true}}}});
  if(!user)throw new Error('PILOT_OWNER_ACCOUNT_NOT_FOUND');
  const ctx:RequestContext={companyId:user.companyId,userId:user.id,roles:[...user.roles.map((item)=>item.role.code),'OWNER','PREMIUM_ACCESS'],requestId:randomUUID(),correlationId:randomUUID()};
  const runId=`provider-gate-${Date.now()}`,audit=new AuditService(prisma),authority=new AuthorityControlPlaneService(prisma),carMover=new CarMoverService(prisma,audit,pilot),oi=new OpportunityIntelligenceService(prisma,authority,carMover,audit);
  const live=new LiveAdapterService(prisma,oi,new TomTomGeocodingAdapter(config),new HereGeocodingAdapter(config),new TomTomRouteAdapter(config),new HereRouteAdapter(config),new TomTomTrafficAdapter(config),new TollGuruAdapter(config),new HereTransitAdapter(config),pilot);
  const activations=await prisma.providerPilotActivation.findMany({where:{companyId:ctx.companyId,providerId:{in:['tomtom','here']}}});
  const original=new Map(activations.map((item)=>[item.providerId,item.state as PilotState]));
  const leases:LeaseProof[]=[];
  try{
    assert(process.env.TOMTOM_API_KEY&&process.env.HERE_API_KEY&&process.env.TOLLGURU_API_KEY,'Guardian process bindings are required');
    const routeInput={origin:{latitude:48.1351,longitude:11.582},destination:{latitude:48.5734,longitude:7.7521},departureTime:new Date(Date.now()+4*60*60_000).toISOString(),vehicle:{commercial:true}};

    await ensureState('here','ACTIVE','GATE_HERE_FALLBACK_READY',ctx);
    await ensureState('tomtom','SUSPENDED','GATE_PRIMARY_UNAVAILABLE_PROBE',ctx);
    const fallback=await live.resolve('ROUTE',routeInput,ctx,true);
    assert(fallback.mode==='LIVE'&&fallback.provider==='here'&&fallback.status==='DEGRADED'&&fallback.snapshotId,'Primary unavailable must resolve through live HERE fallback');

    const cacheKey=hash({category:'ROUTE',input:routeInput});
    await prisma.liveAdapterCache.update({where:{companyId_category_cacheKey:{companyId:ctx.companyId,category:'ROUTE',cacheKey}},data:{validUntil:new Date(Date.now()-1)}});
    await ensureState('here','SUSPENDED','GATE_STALE_AND_MANUAL_PROBE',ctx);
    const stale=await live.resolve('ROUTE',routeInput,ctx,true);
    assert(stale.mode==='STALE_CACHE'&&stale.status==='STALE'&&stale.warning==='STALE_CACHE_EXPLICIT_WARNING','Expired cache must be explicit when providers are unavailable');
    const manual=await live.resolve('ROUTE',{...routeInput,destination:{latitude:48.5744,longitude:7.7531}},ctx,true);
    assert(manual.mode==='MANUAL'&&manual.status==='DEGRADED'&&manual.warning?.endsWith('MANUAL_FALLBACK_REQUIRED'),'No-provider route must preserve explicit manual fallback');

    await restoreStates(original,ctx);
    const [toll,transit]=await Promise.all([
      latestSnapshot('TOLL','tollguru',ctx.companyId),
      latestSnapshot('TRANSIT','here',ctx.companyId),
    ]);
    const mobility=await live.opportunityInput({routeSnapshotId:fallback.snapshotId,tollSnapshotId:toll.id,transitSnapshotIds:[transit.id]},ctx);
    assert(mobility.freshnessStatus==='FRESH','Live provider inputs must remain fresh at Opportunity boundary');

    const intake=await oi.intake({idempotencyKey:`${runId}-intake`,channel:'manual',provider:'provider-gate-live',platform:'AGM_PILOT',sourceOpportunityId:runId,pickupLocation:'Munich',deliveryLocation:'Strasbourg',pickupWindowStart:new Date(Date.now()+5*60*60_000).toISOString(),priceAmount:950,currencyCode:'EUR',vehicleType:'Passenger car',sourceTimestamp:new Date().toISOString()},ctx);
    assert(intake.normalizedOpportunityId,'Normalized Opportunity must be created before analysis');
    const routeAuthority=await provision(authority,ctx,runId,'route','premium.car-mover.route','premium.car-mover.route-mobility','opportunity.route.assess','openai-primary');leases.push(routeAuthority);
    const costAuthority=await provision(authority,ctx,runId,'cost','premium.car-mover.cost-risk','premium.car-mover.cost-risk','opportunity.cost.assess','openai-primary');leases.push(costAuthority);
    const plannerAuthority=await provision(authority,ctx,runId,'planner','premium.car-mover.opportunity.planning','premium.car-mover.opportunity-planner','opportunity.chain.plan','openai-primary');leases.push(plannerAuthority);
    const judgeAuthority=await provision(authority,ctx,runId,'judge','premium.car-mover.opportunity.judgement','premium.car-mover.opportunity-judge','opportunity.verdict.issue','openai-primary');leases.push(judgeAuthority);
    const jobsBefore=await prisma.carMoverJob.count({where:{companyId:ctx.companyId}});
    const analyzed=await oi.analyze({idempotencyKey:`${runId}-analysis`,variants:[{variantKey:`${runId}-live`,objective:'BALANCED',segments:[{opportunityId:intake.normalizedOpportunityId,route:{...mobility.route,mobilityModes:[...mobility.route.mobilityModes],tolls:mobility.route.tolls.map((item)=>({...item})),restrictions:[...mobility.route.restrictions],sources:[...mobility.route.sources],assumptions:[...mobility.route.assumptions],warnings:[...mobility.route.warnings],availableGapMinutes:180},cost:{...mobility.cost,assumptions:[...mobility.cost.assumptions],fuel:75,otherReposition:0}}]}],routeAuthority:proof(routeAuthority),costAuthority:proof(costAuthority),plannerAuthority:proof(plannerAuthority),judgeAuthority:proof(judgeAuthority)},ctx);
    const planning=await oi.planning(ctx),copilot=await oi.copilot(ctx);
    assert(analyzed.verdicts.length===1&&planning.some((item)=>item.verdict.id===analyzed.verdicts[0].id)&&copilot.variantCount>0,'Planning, Judge and Copilot projection must consume the live-derived analysis');
    assert(await prisma.carMoverJob.count({where:{companyId:ctx.companyId}})===jobsBefore,'Opportunity analysis must not create a Job without Human Decide');

    const manualJob=await carMover.create({vehicle:{vehicleClass:'OTHER_DRIVABLE_VEHICLE',vehicleType:'Provider gate manual fallback'},pickup:{label:'Manual pickup'},destination:{label:'Manual destination'},sourceReference:`${runId}-manual`},ctx);
    assert((await carMover.getJobFile(manualJob.jobId,ctx)).job.id===manualJob.jobId,'Manual Car Mover must remain operational independently of providers');
    const providerReport=await pilot.report(ctx,new Date(Date.now()-24*60*60_000).toISOString(),new Date().toISOString());
    const report={verdict:'PASS',runId,secretValuesPrinted:false,automaticJobCreation:false,results:{primaryUnavailableToSecondary:brief(fallback),staleCache:brief(stale),manualFallback:brief(manual),opportunity:{freshness:mobility.freshnessStatus,routeProvider:'here',tollProvider:'tollguru',classification:analyzed.verdicts[0].classification,planningVisible:true,copilotVisible:true,humanDecisionRequired:true},manualCarMover:{operational:true,jobId:manualJob.jobId}},telemetry:providerReport};
    const directory=path.resolve(__dirname,'../../../evidence/live-mobility/pilot',runId);await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'report.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');
    console.log(JSON.stringify({...report,reportPath:path.join(directory,'report.json')},null,2));
  }finally{
    await restoreStates(original,ctx).catch(()=>undefined);
    for(const lease of leases.reverse())try{await authority.revokeLease(lease.id,'Provider activation gate complete',ctx);}catch{/* already revoked */}
  }
}

async function latestSnapshot(category:string,providerId:string,companyId:string){const value=await prisma.liveMobilitySnapshot.findFirst({where:{companyId,category,providerId},orderBy:{createdAt:'desc'}});if(!value)throw new Error(`${category}_${providerId}_LIVE_SNAPSHOT_MISSING`);return value;}
async function ensureState(providerId:'tomtom'|'here',state:PilotState,reason:string,ctx:RequestContext){const current=await prisma.providerPilotActivation.findUniqueOrThrow({where:{companyId_providerId:{companyId:ctx.companyId,providerId}}});if(current.state!==state)await pilot.setState(providerId,state,reason,ctx);}
async function restoreStates(states:Map<string,PilotState>,ctx:RequestContext){for(const providerId of ['tomtom','here'] as const){const state=states.get(providerId);if(state)await ensureState(providerId,state,'GATE_STATE_RESTORED',ctx);}}
async function provision(authority:AuthorityControlPlaneService,ctx:RequestContext,runId:string,key:string,scopeId:string,agentId:string,command:string,providerId:string):Promise<LeaseProof>{const mandate=await authority.createMandate({mandateKey:`${runId}-${key}-mandate`,scopeId,agentId,mode:'EXECUTIVE',readSet:['opportunity.read'],writeSet:[command],resourceSelectors:[],prohibitedActions:['car-mover.job.create','accounting.write','commercial.auto-accept']},ctx);const decision=await authority.createDecision({decisionKey:`${runId}-${key}-decision`,mandateId:mandate.id,actionType:'OPPORTUNITY_ANALYSIS',decision:{approved:true,humanApprovedAuthority:true}},ctx);return authority.issueLease({leaseKey:`${runId}-${key}-lease`,requestId:`${runId}-${key}-request`,mandateId:mandate.id,decisionId:decision.id,providerId,ttlSeconds:900},ctx);}
const proof=(lease:LeaseProof)=>({leaseId:lease.id,epoch:lease.epoch,fencingToken:lease.fencingToken});
const brief=(value:any)=>({mode:value.mode,status:value.status,provider:value.provider,warning:value.warning,snapshotId:value.snapshotId,freshness:value.data?.freshness});
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`PROVIDER_GATE_FAILED:${message}`);}

void main().catch((error)=>{console.error(error instanceof Error?error.message:'PROVIDER_GATE_FAILED');process.exitCode=1;}).finally(()=>prisma.$disconnect());
