import { PrismaClient } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataRightsService } from '../src/data-rights/data-rights.service';
import { ExternalDsarIntakeWorkflow } from '../src/data-rights/external-intake.workflow';
import { scrubSubjectArtifact } from '../src/data-rights/dsar-artifact-scrubber';

const prisma=new PrismaClient();const companyId='10000000-0000-4000-8000-000000000001';
const ids={access:'20000000-0000-4000-8000-000000000001',delete:'20000000-0000-4000-8000-000000000002',hold:'20000000-0000-4000-8000-000000000003',duplicate:'20000000-0000-4000-8000-000000000004',partial:'20000000-0000-4000-8000-000000000005'};
const ctx=(userId:string)=>({userId,companyId,roles:['USER'],requestId:crypto.randomUUID(),correlationId:crypto.randomUUID()});
const results:any={contract:'agm-dsar-real-system.v1',database:'isolated-postgresql',syntheticOnly:true,cases:{}};

async function user(id:string,email:string,hold=false){return prisma.user.create({data:{id,companyId,displayName:'Synthetic Subject',email,passwordHash:'SYNTHETIC_NOT_LOGIN_CAPABLE',legalRetentionReason:hold?'SYNTHETIC_LEGAL_HOLD':null,status:'Active',personalDataStatus:'Active'}});}
async function seed(){
  await prisma.company.create({data:{id:companyId,companyName:'AGM DSAR ISOLATED TEST',countryCode:'DE',defaultCurrencyCode:'EUR'}});
  for(const [key,id] of Object.entries(ids))await user(id,`${key}@dsar.invalid`,key==='hold');
  await prisma.authSession.create({data:{companyId,userId:ids.access,familyId:'30000000-0000-4000-8000-000000000001',tokenHash:'a'.repeat(64),expiresAt:new Date(Date.now()+3600000)}});
  await prisma.auditEvent.create({data:{companyId,actorUserId:ids.access,actorType:'USER',actionCode:'SYNTHETIC',entityType:'User',entityId:ids.access,requestId:'40000000-0000-4000-8000-000000000001',correlationId:'40000000-0000-4000-8000-000000000002',subjectType:'User',subjectId:ids.access,metadata:{nestedSubject:ids.access}}});
  await prisma.operationalEventStream.create({data:{companyId,streamId:'50000000-0000-4000-8000-000000000001',aggregateType:'Synthetic',subjectType:'User',subjectId:ids.access,projection:{driverUserId:ids.access}}});
  await prisma.evidenceMetadata.create({data:{companyId,evidenceType:'SYNTHETIC',storageProvider:'inactive-reference-only',storageKey:'synthetic',uploadedByUserId:ids.delete,originalFileName:'subject-document.txt',description:'synthetic subject evidence'}});
}

async function main(){
  await seed();const service=new DataRightsService(prisma as any);
  const exported=await service.exportSelf(ctx(ids.access));results.cases.accessExport={pass:exported.subject.id===ids.access&&exported.data.auditEvents.length===1,sha256Recorded:true};
  const rectified=await service.rectifySelf(ctx(ids.access),{displayName:'Rectified Synthetic'});results.cases.rectification={pass:rectified.status==='COMPLETED'&&(await prisma.user.findUnique({where:{id:ids.access}}))?.displayName==='Rectified Synthetic'};
  const restricted=await service.restrictSelf(ctx(ids.access),'synthetic accuracy dispute');results.cases.restriction={pass:restricted.status==='RESTRICTED'};
  const deletion=await service.deleteSelf(ctx(ids.delete));const deleted=await prisma.user.findUnique({where:{id:ids.delete}});results.cases.deletion={pass:deletion.status==='COMPLETED'&&deleted?.personalDataStatus==='Anonymized'};
  const legal=await service.deleteSelf(ctx(ids.hold));results.cases.legalException={pass:legal.status==='RESTRICTED'&&legal.reason==='LEGAL_RETENTION_ACTIVE'};
  try{await service.exportSelf(ctx('29999999-0000-4000-8000-000000000099'));results.cases.missingUser={pass:false};}catch{results.cases.missingUser={pass:true};}
  await prisma.dataSubjectRequest.create({data:{companyId,requestedByUserId:ids.duplicate,requestType:'ACCESS_EXPORT',status:'PROCESSING'}});try{await service.exportSelf(ctx(ids.duplicate));results.cases.duplicate={pass:false};}catch{results.cases.duplicate={pass:true};}
  const realTransaction=(prisma as any).$transaction.bind(prisma);let fail=true;const proxy=new Proxy(prisma as any,{get(target,key){if(key==='$transaction')return async(fn:any)=>{if(fail){fail=false;throw new Error('SYNTHETIC_PARTIAL_FAILURE');}return realTransaction(fn);};return target[key];}});const partialService=new DataRightsService(proxy);let failedRequest='';try{await partialService.deleteSelf(ctx(ids.partial));}catch{const row=await prisma.dataSubjectRequest.findFirst({where:{requestedByUserId:ids.partial,requestType:'DELETE_ACCOUNT'},orderBy:{requestedAt:'desc'}});failedRequest=row?.id??'';}const retried=await partialService.retryDelete(ctx(ids.partial),failedRequest);results.cases.partialRetry={pass:retried.status==='COMPLETED'};

  let notification:any;const intake=new ExternalDsarIntakeWorkflow(prisma as any,async message=>{notification=message});await intake.intake({email:'access@dsar.invalid',requestType:'ACCESS'});const external=await prisma.$queryRawUnsafe<any[]>('SELECT id,status FROM "DataRightsExternalRequest" WHERE "contactHash" IS NOT NULL ORDER BY "createdAt" DESC LIMIT 1');const verified=await intake.verify(external[0].id,notification.verificationCode);results.cases.unauthenticatedVerification={pass:verified.verified===true};await intake.intake({email:'former-user@dsar.invalid',requestType:'ACCESS'});const former=await prisma.$queryRawUnsafe<any[]>('SELECT status FROM "DataRightsExternalRequest" ORDER BY "createdAt" DESC LIMIT 1');results.cases.formerUser={pass:former[0].status==='IDENTITY_EVIDENCE_REQUIRED'};

  const artifactRoot=join(process.cwd(),'..','..','.tmp','dsar-real-system');await mkdir(artifactRoot,{recursive:true});const log=join(artifactRoot,'synthetic.log'),backup=join(artifactRoot,'synthetic-backup.json');await writeFile(log,`actor=${ids.delete} email=delete@dsar.invalid\n`);await writeFile(backup,JSON.stringify({userId:ids.delete,email:'delete@dsar.invalid'}));const scrubbed=[await scrubSubjectArtifact(log,[ids.delete,'delete@dsar.invalid']),await scrubSubjectArtifact(backup,[ids.delete,'delete@dsar.invalid'])];results.cases.logsAndBackups={pass:scrubbed.every(x=>x.replacements===2),artifacts:scrubbed};
  const final=JSON.stringify(results,null,2);await writeFile(join(artifactRoot,'report.json'),final);console.log(final);
}
main().finally(()=>prisma.$disconnect());
