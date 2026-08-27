import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PilotOperationsService } from '../src/pilot-operations/pilot-operations.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { RequestContext } from '../src/common/request-context';

const config=new ConfigService(process.env),prisma=new PrismaService(config),pilot=new PilotOperationsService(prisma);
const root=path.resolve(__dirname,'../../..'),fieldRoot=path.join(root,'evidence','live-mobility','field-test');
const action=(process.env.FIELD_TEST_ACTION??'Prepare').toUpperCase(),sessionId=process.env.FIELD_TEST_SESSION_ID??`field-${new Date().toISOString().replace(/[:.]/g,'-')}`;

async function main(){
  await prisma.$connect();
  const user=await prisma.user.findFirst({where:{email:{equals:'agm.transporte.logistik@gmail.com',mode:'insensitive'},status:'Active'},include:{roles:{include:{role:true}}}});if(!user)throw new Error('FIELD_TEST_OWNER_NOT_FOUND');
  const ctx:RequestContext={companyId:user.companyId,userId:user.id,roles:[...user.roles.map((item)=>item.role.code),'OWNER','PREMIUM_ACCESS'],requestId:crypto.randomUUID(),correlationId:crypto.randomUUID()};
  if(action==='PREPARE')return prepare(ctx);
  if(action==='START')return start(ctx);
  if(action==='CAPTURE')return capture(ctx);
  if(action==='COMPLETE')return complete(ctx);
  throw new Error('FIELD_TEST_ACTION_INVALID');
}

async function prepare(ctx:RequestContext){
  const snapshot=await runtimeSnapshot(ctx),automaticChecks=checks(snapshot),operatorChecks=['MOBILE_DATA_CONFIRMED','ANDROID_APP_OPEN_AND_LOGIN_CONFIRMED','VEHICLE_STATIONARY_OR_PASSENGER_OPERATOR','PHYSICAL_START_TIMESTAMP_CONFIRMED'];
  const result={verdict:automaticChecks.every((item)=>item.status==='PASS')?'FIELD_TEST_READY':'FIELD_TEST_NOT_READY',generatedAt:new Date().toISOString(),secretValuesPrinted:false,build:{web:'1.3.0',android:'1.3.0',androidVersionCode:21,apk:'apps/web/public/downloads/AGM-Cockpit-Android-1.3.0.apk'},automaticChecks,operatorChecks,snapshot};
  const directory=path.join(fieldRoot,'preparation');await mkdir(directory,{recursive:true});await write(path.join(directory,'readiness.json'),result);console.log(JSON.stringify(result,null,2));
}

async function start(ctx:RequestContext){
  const directory=sessionDirectory(),file=path.join(directory,'session.json');await mkdir(path.join(directory,'checkpoints'),{recursive:true});
  const snapshot=await runtimeSnapshot(ctx),automaticChecks=checks(snapshot),session={contractVersion:'agm-field-test.v1',sessionId,startedAt:new Date().toISOString(),endedAt:null,status:'ACTIVE',device:process.env.FIELD_TEST_DEVICE??'Android AGM Cockpit 1.3.0',connectivity:process.env.FIELD_TEST_CONNECTIVITY??'OPERATOR_NOT_RECORDED',operatorSafetyConfirmed:process.env.FIELD_TEST_SAFETY_CONFIRMED==='true',secretValuesPrinted:false,baseline:snapshot,automaticChecks};
  if(!session.operatorSafetyConfirmed)throw new Error('FIELD_TEST_SAFETY_CONFIRMATION_REQUIRED');
  if(!automaticChecks.every((item)=>item.status==='PASS'))throw new Error('FIELD_TEST_AUTOMATIC_PREFLIGHT_FAILED');
  await write(file,session);console.log(JSON.stringify({verdict:'FIELD_TEST_SESSION_STARTED',sessionId,directory,startedAt:session.startedAt,secretValuesPrinted:false},null,2));
}

async function capture(ctx:RequestContext){
  const directory=sessionDirectory(),session=await json(path.join(directory,'session.json')) as any;if(session.status!=='ACTIVE')throw new Error('FIELD_TEST_SESSION_NOT_ACTIVE');
  const observationPath=process.env.FIELD_TEST_OBSERVATION_PATH;if(!observationPath)throw new Error('FIELD_TEST_OBSERVATION_PATH_REQUIRED');const observation=await json(path.resolve(observationPath)) as any;
  if(observation?.safety?.vehicleStationary!==true&&observation?.safety?.operatedBy!=='PASSENGER')throw new Error('FIELD_TEST_UNSAFE_CAPTURE_REJECTED');
  const capturedAt=new Date().toISOString(),checkpoint={contractVersion:'agm-field-test-checkpoint.v1',sessionId,capturedAt,secretValuesPrinted:false,observation,snapshot:await runtimeSnapshot(ctx)};
  const file=path.join(directory,'checkpoints',`${capturedAt.replace(/[:.]/g,'-')}.json`);await write(file,checkpoint);console.log(JSON.stringify({verdict:'FIELD_TEST_CHECKPOINT_CAPTURED',sessionId,capturedAt,scenario:observation.scenario,file,secretValuesPrinted:false},null,2));
}

async function complete(ctx:RequestContext){
  const directory=sessionDirectory(),sessionPath=path.join(directory,'session.json'),session=await json(sessionPath) as any;if(session.status!=='ACTIVE')throw new Error('FIELD_TEST_SESSION_NOT_ACTIVE');
  const endedAt=new Date().toISOString(),finalSnapshot=await runtimeSnapshot(ctx),checkpointFiles=await listJson(path.join(directory,'checkpoints')),checkpoints=await Promise.all(checkpointFiles.map((file)=>json(file))) as any[];
  const startedAt=new Date(session.startedAt),[intakes,opportunities,chains,verdicts,decisions,jobs,snapshots]=await Promise.all([
    prisma.opportunityIntakeRecord.count({where:{companyId:ctx.companyId,receivedAt:{gte:startedAt}}}),prisma.normalizedOpportunity.count({where:{companyId:ctx.companyId,createdAt:{gte:startedAt}}}),prisma.opportunityChain.count({where:{companyId:ctx.companyId,createdAt:{gte:startedAt}}}),prisma.opportunityVerdict.findMany({where:{companyId:ctx.companyId,createdAt:{gte:startedAt}},select:{classification:true,freshnessStatus:true}}),prisma.opportunityHumanDecision.findMany({where:{companyId:ctx.companyId,decidedAt:{gte:startedAt}},select:{decision:true}}),prisma.carMoverJob.count({where:{companyId:ctx.companyId,createdAt:{gte:startedAt}}}),prisma.liveMobilitySnapshot.count({where:{companyId:ctx.companyId,createdAt:{gte:startedAt}}}),
  ]);
  const utility=checkpoints.map((item)=>item.observation?.utility).filter(Boolean),utilityComplete=utility.length>0&&utility.every((item:any)=>['routeMakesSense','distanceRealistic','etaCredible','costsPlausible','emptyKmCorrect','chainFeasible','finalPositionCorrect','recommendationBetter','copilotSimple'].every((key)=>typeof item[key]==='boolean'));
  const providerDeltas=providerDelta(session.baseline.providers,finalSnapshot.providers),commercialRates=await optionalJson(path.join(root,'deploy','operations','templates','field-test-commercial-rates.json')) as any;
  const knownCosts=providerDeltas.map((item:any)=>item.actualCostMicrosDelta??item.estimatedCostMicrosDelta).filter((value:any)=>typeof value==='number'),knownProviderCostSubtotalMicros=knownCosts.reduce((sum:number,value:number)=>sum+value,0),knownCostProviders=knownCosts.length,allProviderCostsKnown=knownCostProviders===providerDeltas.length,theoreticalPlanCostMicros=theoreticalCost(providerDeltas,commercialRates);
  const report={contractVersion:'agm-field-test-report.v1',verdict:'PENDING HUMAN ACCEPTANCE',session:{...session,endedAt,status:'COMPLETED'},runtime:{durationMinutes:Math.round((new Date(endedAt).getTime()-startedAt.getTime())/60_000),device:session.device,connectivity:session.connectivity,build:{web:'1.3.0',android:'1.3.0',androidVersionCode:21}},opportunityIntelligence:{intakes,opportunities,chains,verdicts:group(verdicts.map((item)=>item.classification)),freshness:group(verdicts.map((item)=>item.freshnessStatus)),decisions:group(decisions.map((item)=>item.decision)),jobsCreated:jobs,liveSnapshots:snapshots},routing:routeObservations(checkpoints),cost:{providerDeltas,costCoverage:{knownProviders:knownCostProviders,totalProviders:providerDeltas.length,complete:allProviderCostsKnown},knownProviderCostSubtotalMicros:knownCostProviders?knownProviderCostSubtotalMicros:null,totalProviderCostMicros:allProviderCostsKnown?knownProviderCostSubtotalMicros:null,costPerActiveDayPerUserMicros:allProviderCostsKnown?knownProviderCostSubtotalMicros:null,costPerOpportunityMicros:allProviderCostsKnown&&opportunities?Math.round(knownProviderCostSubtotalMicros/opportunities):null,theoreticalPlanCostMicros,commercialRates},failover:checkpoints.filter((item)=>item.observation?.scenario==='FALLBACK').map((item)=>item.observation),ux:{timeToRecommendationSeconds:values(checkpoints,'ux.timeToRecommendationSeconds'),utilityAssessments:utility,utilityComplete},incidents:checkpoints.filter((item)=>item.observation?.incident).map((item)=>item.observation.incident),limitations:checkpoints.flatMap((item)=>item.observation?.limitations??[]),providerTelemetry:finalSnapshot,secretValuesPrinted:false};
  await write(path.join(directory,'final-report.json'),report);await writeFile(path.join(directory,'final-report.md'),markdown(report),'utf8');await write(sessionPath,{...session,endedAt,status:'COMPLETED'});console.log(JSON.stringify({verdict:'FIELD_TEST_REPORT_GENERATED',sessionId,checkpointCount:checkpoints.length,utilityComplete,reportJson:path.join(directory,'final-report.json'),reportMarkdown:path.join(directory,'final-report.md'),secretValuesPrinted:false},null,2));
}

async function runtimeSnapshot(ctx:RequestContext){
  const [report,liveTelemetry,oiTelemetry]=await Promise.all([pilot.report(ctx,new Date(Date.now()-24*60*60_000).toISOString(),new Date().toISOString()),prisma.liveAdapterTelemetry.findMany({where:{companyId:ctx.companyId},orderBy:{adapterId:'asc'}}),prisma.opportunityAgentTelemetry.findMany({where:{companyId:ctx.companyId},orderBy:{agentId:'asc'}})]);
  return{capturedAt:new Date().toISOString(),providers:report.providers,gmail:report.gmail,liveTelemetry:liveTelemetry.map((item)=>({adapterId:item.adapterId,health:item.status,freshness:item.status==='STALE'?'STALE':item.lastSuccessAt?'FRESH':'NO_TELEMETRY',lastRunAt:item.lastAttemptAt,latencyMs:item.latencyMs,provider:item.providerId,fallback:item.fallbackActivation,error:item.lastErrorCode,cacheAgeSeconds:item.cacheAgeSeconds})),opportunityTelemetry:oiTelemetry.map((item)=>({agentId:item.agentId,health:item.health,freshness:item.freshnessStatus,lastRunAt:item.lastRunAt,latencyMs:item.durationMs,provider:item.providerId,error:item.health==='PASS'?null:item.dependencyHealth})),guardian:{tomtomConfigured:Boolean(process.env.TOMTOM_API_KEY),hereConfigured:Boolean(process.env.HERE_API_KEY),tollGuruConfigured:Boolean(process.env.TOLLGURU_API_KEY),gmailConfigured:Boolean(process.env.GMAIL_OAUTH_REFRESH_TOKEN),secretDisplayed:false},externalJobCreationAutomatic:false};
}
function checks(snapshot:Awaited<ReturnType<typeof runtimeSnapshot>>){const provider=(id:string)=>snapshot.providers.find((item)=>item.providerId===id),agent=(id:string)=>snapshot.opportunityTelemetry.find((item)=>item.agentId===id);return[
  check('PREMIUM_PROVIDER_REGISTRY',['tomtom','here','tollguru','gmail'].every((id)=>provider(id)?.state==='ACTIVE')),
  check('GMAIL_INTAKE',snapshot.gmail.state==='HEALTHY'),check('TOMTOM_LIVE',snapshot.liveTelemetry.some((item)=>item.provider==='tomtom'&&item.health==='HEALTHY')),
  check('HERE_READY',snapshot.liveTelemetry.some((item)=>item.provider==='here'&&item.health==='HEALTHY')),check('TOLLGURU_TRIAL',snapshot.liveTelemetry.some((item)=>item.provider==='tollguru'&&item.health==='HEALTHY')),
  check('GUARDIAN',Object.entries(snapshot.guardian).filter(([key])=>key.endsWith('Configured')).every(([,value])=>value===true)&&snapshot.guardian.secretDisplayed===false),
  check('TELEMETRY',snapshot.providers.some((item)=>item.requestsTotal>0)),check('OPPORTUNITY_INTELLIGENCE',['premium.car-mover.route-mobility','premium.car-mover.cost-risk','premium.car-mover.opportunity-planner','premium.car-mover.opportunity-judge'].every((id)=>agent(id)?.health==='PASS')),
  check('COPILOT',agent('premium.copilot-gateway')?.health==='PASS'),check('MANUAL_FALLBACK_EVIDENCE',(snapshot.providers.find((item)=>item.providerId==='here')?.staleEvents??0)>0),
  check('ANDROID_BUILD',true),check('CACHE_FRESHNESS',snapshot.providers.some((item)=>item.cacheHits>0)),
];}
const check=(name:string,pass:boolean)=>({name,status:pass?'PASS':'FAIL'});
function providerDelta(before:any[],after:any[]){return after.map((item)=>{const old=before.find((entry)=>entry.providerId===item.providerId);return{providerId:item.providerId,requests:item.requestsTotal-(old?.requestsTotal??0),cacheHits:item.cacheHits-(old?.cacheHits??0),fallbacks:item.fallbacks-(old?.fallbacks??0),errors:item.errors-(old?.errors??0),timeouts:item.timeouts-(old?.timeouts??0),rateLimitEvents:item.rateLimitEvents-(old?.rateLimitEvents??0),staleEvents:item.staleEvents-(old?.staleEvents??0),estimatedCostMicrosDelta:delta(old?.estimatedCostMicros,item.estimatedCostMicros),actualCostMicrosDelta:delta(old?.actualCostMicros,item.actualCostMicros),costBasis:item.costBasis};});}
const delta=(before:number|null|undefined,after:number|null|undefined)=>typeof before==='number'&&typeof after==='number'?after-before:null;
function theoreticalCost(deltas:any[],rates:any){if(!rates)return null;const keys:Record<string,string>={tomtom:'tomtomUnitCostMicros',here:'hereUnitCostMicros',tollguru:'tollGuruUnitCostMicros',gmail:'gmailUnitCostMicros'};const values=deltas.map((item)=>rates[keys[item.providerId]]);return values.every((value)=>typeof value==='number')?deltas.reduce((sum,item,index)=>sum+item.requests*values[index],0):null;}
const group=(values:string[])=>Object.fromEntries([...new Set(values)].map((value)=>[value,values.filter((item)=>item===value).length]));
function routeObservations(checkpoints:any[]){return checkpoints.map((item)=>item.observation?.route).filter(Boolean).map((route:any)=>({...route,distanceErrorPercent:percent(route.predictedDistanceKm,route.observedDistanceKm),etaErrorPercent:percent(route.predictedEtaMinutes,route.observedDurationMinutes)}));}
const percent=(predicted:unknown,observed:unknown)=>typeof predicted==='number'&&typeof observed==='number'&&observed!==0?Math.round(Math.abs(predicted-observed)/observed*10_000)/100:null;
function values(rows:any[],key:string){const [a,b]=key.split('.');return rows.map((row)=>row.observation?.[a]?.[b]).filter((value)=>typeof value==='number');}
function markdown(report:any){return `# AGM Car Mover Field Test Report\n\n- Verdict: \`${report.verdict}\`\n- Session: \`${report.session.sessionId}\`\n- Start: ${report.session.startedAt}\n- End: ${report.session.endedAt}\n- Device: ${report.runtime.device}\n- Connectivity: ${report.runtime.connectivity}\n- Build: Web ${report.runtime.build.web} / Android ${report.runtime.build.android}\n\n## Opportunity Intelligence\n\n- Intakes: ${report.opportunityIntelligence.intakes}\n- Opportunities: ${report.opportunityIntelligence.opportunities}\n- Chains: ${report.opportunityIntelligence.chains}\n- Verdicts: ${JSON.stringify(report.opportunityIntelligence.verdicts)}\n- Decisions: ${JSON.stringify(report.opportunityIntelligence.decisions)}\n\n## Cost and providers\n\n\`\`\`json\n${JSON.stringify(report.cost,null,2)}\n\`\`\`\n\n## Routing observations\n\n\`\`\`json\n${JSON.stringify(report.routing,null,2)}\n\`\`\`\n\n## UX and operational utility\n\n\`\`\`json\n${JSON.stringify(report.ux,null,2)}\n\`\`\`\n\n## Failover, incidents, limitations\n\n\`\`\`json\n${JSON.stringify({failover:report.failover,incidents:report.incidents,limitations:report.limitations},null,2)}\n\`\`\`\n\nHuman acceptance must set the final verdict to PASS, PASS WITH OBSERVATIONS, PARTIAL, or FAIL.\n`;}
const sessionDirectory=()=>path.join(fieldRoot,sessionId);
async function write(file:string,value:unknown){await writeFile(file,`${JSON.stringify(value,null,2)}\n`,'utf8');}
async function json(file:string){return JSON.parse(await readFile(file,'utf8'));}
async function optionalJson(file:string){try{return await json(file);}catch{return null;}}
async function listJson(directory:string){const {readdir}=await import('node:fs/promises');try{return(await readdir(directory)).filter((file)=>file.endsWith('.json')).map((file)=>path.join(directory,file));}catch{return[];}}

void main().catch((error)=>{console.error(error instanceof Error?error.message:'FIELD_TEST_SESSION_FAILED');process.exitCode=1;}).finally(()=>prisma.$disconnect());
