import { runObserverTests } from './test-acpm-observer';
import 'reflect-metadata';
import { runAcpmHttpTests } from './test-acpm-http';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { AcpmService, AgentChainPerformanceService } from '../apps/api/src/agent-chain-performance/agent-chain-performance.service';
import type { PrismaService } from '../apps/api/src/prisma/prisma.service';
import { AppendAcpEventDto } from '../apps/api/src/agent-chain-performance/agent-chain-performance.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AgentChainRecorder } from '../packages/shared/src/agent-chain-recorder';
import { createHash } from 'node:crypto';
import { runAcpmMultiInstanceCrashTests } from './test-acpm-multi-instance';
import { AgentRuntimeEventsService } from '../apps/api/src/agent-runtime-events/agent-runtime-events.service';
import { AcpmObserver } from '../apps/api/src/acpm/acpm.observer';

async function main(){
 const bin=process.env.ACP_TEST_PG_BIN;
 const dockerContainer=process.env.ACP_TEST_PG_CONTAINER;
 if(!bin&&!dockerContainer)throw new Error('ACP_TEST_PG_BIN or isolated ACP_TEST_PG_CONTAINER is required; no production fallback');
 const evidence=resolve(process.env.ACP_TEST_EVIDENCE_DIR||'evidence/acpm-operational-20261115/attempt-2');mkdirSync(evidence,{recursive:true});
 const reuse=process.env.ACP_TEST_REUSE_DATA;
 const data=reuse?resolve(reuse):join(evidence,`isolated-pg-${Date.now()}`);
 if(reuse&&!bin)throw new Error('ACP_TEST_REUSE_DATA requires local PostgreSQL binaries');
 if(reuse&&!data.startsWith(resolve('evidence/acpm-operational-20261115')+'\\'))throw new Error('Reuse restricted to isolated operational test evidence');
 const requestedPort=Number(process.env.ACP_TEST_PG_PORT||0);
 const port=requestedPort||await new Promise<number>(resolvePort=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(()=>resolvePort(p));});});
 const run=(exe:string,args:string[],input?:string)=>execFileSync(join(bin!,exe+'.exe'),args,{windowsHide:true,encoding:'utf8',input,timeout:exe==='initdb'?180000:60000,...(exe==='pg_ctl'?{stdio:'ignore' as const}:{})});
 const docker=(args:string[],input?:string)=>execFileSync('docker',args,{windowsHide:true,encoding:'utf8',input,timeout:120000});
 const pgctl=(args:string[])=>dockerContainer?docker(['exec','-u','postgres',dockerContainer,'pg_ctl','-D','/var/lib/postgresql/data',...args]):run('pg_ctl',['-D',data,...args]);
 const psql=(sql:string)=>dockerContainer?docker(['exec','-i',dockerContainer,'psql','-U','acp_test','-d','postgres','-v','ON_ERROR_STOP=1'],sql):run('psql',['-h','127.0.0.1','-p',String(port),'-U','acp_test','-d','postgres','-v','ON_ERROR_STOP=1'],sql);
 if(!reuse&&bin)run('initdb',['-D',data,'-U','acp_test','--auth=trust','--encoding=UTF8','--locale=C']);
 let started=false;let db:PrismaClient|undefined;const passed:string[]=[];
 try{
  if(bin){run('pg_ctl',['-D',data,'-l',join(evidence,'isolated-postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;} else started=true;
  const url=process.env.ACP_TEST_DATABASE_URL||`postgresql://acp_test@127.0.0.1:${port}/postgres`;
  const parsedUrl=new URL(url);
  if(parsedUrl.hostname!=='127.0.0.1'||Number(parsedUrl.port)!==port||parsedUrl.pathname!=='/postgres'||parsedUrl.username!=='acp_test')
    throw new Error('isolated PostgreSQL URL must target the verified loopback test database, expected port, database postgres and role acp_test');
  let containerEvidence:unknown=null;
  if(dockerContainer){
    const inspect=JSON.parse(docker(['inspect',dockerContainer]))[0];
    if(!inspect||inspect.Config?.Image!=='postgres:16'||inspect.Config?.Env?.some((entry:string)=>entry==='POSTGRES_USER=acp_test')!==true||inspect.NetworkSettings?.Ports?.['5432/tcp']?.some((binding:{HostIp:string;HostPort:string})=>binding.HostIp==='127.0.0.1'&&Number(binding.HostPort)===port)!==true)
      throw new Error('Docker PostgreSQL container is not the expected isolated postgres:16 loopback fixture');
    containerEvidence={id:inspect.Id,image:inspect.Config.Image,hostBindings:inspect.NetworkSettings.Ports['5432/tcp']};
  }
  db=new PrismaClient({datasources:{db:{url}}});
  const sql=`CREATE TABLE "Company" (id uuid PRIMARY KEY);
CREATE TABLE "AgentRuntimeEvent" (id uuid PRIMARY KEY,"companyId" uuid NOT NULL,"eventId" uuid NOT NULL,"mandateId" text NOT NULL,"agentId" text NOT NULL,"dossierId" text NOT NULL,lifecycle text NOT NULL,sequence integer NOT NULL,"occurredAt" timestamptz NOT NULL,"recordedAt" timestamptz NOT NULL DEFAULT now(),"evidenceRef" text NOT NULL,"outputRef" text,"evidenceHash" text,detail text NOT NULL);
CREATE UNIQUE INDEX "AgentRuntimeEvent_companyId_eventId_key" ON "AgentRuntimeEvent" ("companyId","eventId");\n`+readFileSync('prisma/migrations/20261115003000_agent_chain_performance/migration.sql','utf8');
  if(!reuse)psql(sql);
  const ctx={companyId:randomUUID(),userId:randomUUID(),roles:['OWNER'],requestId:randomUUID(),correlationId:randomUUID()};
  const other={...ctx,companyId:randomUUID()};
  await db.$executeRaw`INSERT INTO "Company" (id) VALUES (${ctx.companyId}::uuid),(${other.companyId}::uuid)`;
  const service=new AgentChainPerformanceService(db as PrismaService);
  const e:AppendAcpEventDto={eventId:randomUUID(),chainId:'isolated-test',mandateId:'test-only',runId:'test-only',componentId:'test-component',componentKind:'AGENT',kind:'STARTED',sequence:1,occurredAt:new Date(Date.now()-1000).toISOString(),evidenceRef:'fixture:isolated-db-test',evidenceHash:'a'.repeat(64)};
  await db.$executeRaw`CREATE ROLE acpm_runtime_test LOGIN PASSWORD 'acpm-runtime-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE`;
  await db.$executeRaw`GRANT CONNECT ON DATABASE postgres TO acpm_runtime_test`;
  await db.$executeRaw`GRANT USAGE ON SCHEMA public TO acpm_runtime_test`;
  await db.$executeRaw`GRANT SELECT ON TABLE "Company" TO acpm_runtime_test`;
  await db.$executeRaw`GRANT SELECT,INSERT,UPDATE ON TABLE "AgentRuntimeEvent" TO acpm_runtime_test`;
  await db.$executeRaw`GRANT SELECT,INSERT ON TABLE "AgentChainPerformanceEvent" TO acpm_runtime_test`;
  const limitedUrl=new URL(url);limitedUrl.username='acpm_runtime_test';limitedUrl.password='acpm-runtime-test-only';
  const limitedDb=new PrismaClient({datasources:{db:{url:limitedUrl.toString()}}});
  try {
    const limitedAcp=new AcpmService(limitedDb as PrismaService);
    const limitedEvent={...e,eventId:randomUUID(),chainId:'least-privilege-test',runId:'least-privilege-test'};
    await limitedAcp.append(limitedEvent,ctx);
    const limitedRuntime=new AgentRuntimeEventsService(limitedDb as PrismaService,new AcpmObserver(limitedDb as PrismaService));
    await limitedRuntime.append({eventId:randomUUID(),mandateId:'least-privilege-test',agentId:'least-privilege-agent',dossierId:'least-privilege-test',lifecycle:'COMPLETED',sequence:1,occurredAt:new Date().toISOString(),evidenceRef:'fixture:least-privilege',detail:'limited runtime role'},ctx);
    passed.push('non-superuser runtime role with SELECT/INSERT on ACPM, native SELECT/INSERT/UPDATE and synchronous_commit permission writes both paths');
  } finally { await limitedDb.$disconnect(); }
  const secondClient=new PrismaClient({datasources:{db:{url}}});
  try { const secondService=new AgentChainPerformanceService(secondClient as PrismaService);await Promise.all(Array.from({length:12},(_,i)=>(i%2?service:secondService).append(e,ctx))); }
  finally { await secondClient.$disconnect(); }
  assert.equal((await service.snapshot(ctx)).runs[0].events.length,1);passed.push('idempotent insert and persisted read');
  passed.push('parallel retries from two independent Prisma clients converge on one tenant/event row');
  const durability=await db.$transaction(async tx=>{await tx.$executeRaw`SET LOCAL synchronous_commit = on`;return tx.$queryRaw<Array<{fsync:string;synchronous_commit:string}>>`SELECT current_setting('fsync') AS fsync,current_setting('synchronous_commit') AS synchronous_commit`;});
  assert.equal(durability[0].fsync,'on');assert.equal(durability[0].synchronous_commit,'on');passed.push('isolated PostgreSQL has fsync enabled and ACPM transaction requests synchronous_commit=on');
  await assert.rejects(service.append({...e,mandateId:'conflicting'},ctx));passed.push('conflicting duplicate rejected');
  const correction={...e,eventId:randomUUID(),supersedesEventId:e.eventId,correctionReason:'Isolated correction test',capacity:2};
  await service.append(correction,ctx);
  const corrected=await service.snapshot(ctx);assert.equal(corrected.corrections[0].original.eventId,e.eventId);assert.equal(corrected.runs[0].events[0].capacity,2);passed.push('append-only correction retains original');
  assert.equal((await service.snapshot(other)).runs.length,0);passed.push('tenant isolation');
  await assert.rejects(service.snapshot({...ctx,roles:[]}));await assert.rejects(service.append(e,{...ctx,roles:[]}));passed.push('unauthorized reads and writes denied');
  await assert.rejects(db.$executeRaw`UPDATE "AgentChainPerformanceEvent" SET "recordedBy"='changed' WHERE "companyId"=${ctx.companyId}::uuid`);
  await assert.rejects(db.$executeRaw`DELETE FROM "AgentChainPerformanceEvent" WHERE "companyId"=${ctx.companyId}::uuid`);passed.push('database rejects update and delete');
  await assert.rejects(db.$executeRaw`TRUNCATE "AgentChainPerformanceEvent"`);passed.push('database rejects truncate');
  await assert.rejects(service.append({...e,eventId:randomUUID(),kind:'HANDOFF'},ctx));
  await assert.rejects(service.append({...e,eventId:randomUUID(),kind:'BLOCKED'},ctx));passed.push('handoff and block evidence required');
  const bad=plainToInstance(AppendAcpEventDto,{...e,model:{provider:'p',name:'m',version:''},capacity:0});
  assert.ok((await validate(bad,{whitelist:true,forbidNonWhitelisted:true})).length>=2);passed.push('nested model version and capacity validation');
  const newService=new AcpmService(db as PrismaService);
  const newSnapshot=await newService.monitor(ctx,{componentId:e.componentId});
  assert.equal(newSnapshot.contract,'agent-chain-performance-monitor.v1');
  assert.deepEqual(newSnapshot.runs[0].events,corrected.runs[0].events);
  assert.equal((await newService.monitor(ctx,{componentId:'absent'})).runs.length,0);
  await assert.rejects(newService.monitor(ctx,{from:'2026-11-16T00:00:00Z',to:'2026-11-15T00:00:00Z'}));
  passed.push('ACPM and legacy routes share persisted IDs/hashes with server filtering');
  const before=await service.snapshot(ctx);
  const retryEvent={...e,eventId:randomUUID(),chainId:'crash-retry',runId:'crash-retry',evidenceRef:'fixture:commit-ack-lost'};
  await service.append(retryEvent,ctx);
  await db.$disconnect();db=undefined;
  if(dockerContainer){docker(['kill','--signal','SIGKILL',dockerContainer]);started=false;docker(['start',dockerContainer]);let ready=false;for(let i=0;i<60;i++){try{docker(['exec',dockerContainer,'pg_isready','-U','acp_test']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}if(!ready)throw new Error('isolated Docker PostgreSQL did not restart');started=true;}
  else {pgctl(['-m','immediate','-w','stop']);started=false;}
  if(!dockerContainer){run('pg_ctl',['-D',data,'-l',join(evidence,'isolated-postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;}
  db=new PrismaClient({datasources:{db:{url}}});
  const after=await new AgentChainPerformanceService(db as PrismaService).snapshot(ctx);
  assert.deepEqual(after.runs.find(r=>r.chainId===e.chainId)?.events,before.runs.find(r=>r.chainId===e.chainId)?.events);passed.push('isolated PostgreSQL crash recovery and hash verification');
  const retryService=new AgentChainPerformanceService(db as PrismaService);await retryService.append(retryEvent,ctx);
  const retryRows=await db.$queryRaw<Array<{count:bigint}>>`SELECT count(*) AS count FROM "AgentChainPerformanceEvent" WHERE "companyId"=${ctx.companyId}::uuid AND "eventId"=${retryEvent.eventId}::uuid`;
  assert.equal(Number(retryRows[0].count),1);passed.push('crash recovery plus lost-ack retry retains exactly one event by tenant/event ID and matching hash');
  const liveService=new AgentChainPerformanceService(db as PrismaService);
  const recorder=new AgentChainRecorder({chainId:'acp-local-validation',mandateId:'ACP-20261115',runId:randomUUID(),componentId:'acp-database-validator',componentKind:'INSPECTOR',departmentId:'local-validation'},async event=>{const {source,...input}=event;return liveService.append(input,ctx);});
  const reference={evidenceRef:'scripts/test-acpm-database.ts',evidenceHash:createHash('sha256').update(readFileSync('scripts/test-acpm-database.ts')).digest('hex')};
  await recorder.record('STARTED',reference);
  const liveCheck=await db.$queryRaw<Array<{version:string}>>`SELECT version() AS version`;
  assert.ok(liveCheck[0].version.includes('PostgreSQL 16'));
  await recorder.record('COMPLETED',reference);
  const measured=await liveService.snapshot(ctx);
  const measuredRun=measured.runs.find(r=>r.componentId==='acp-database-validator');assert.ok(measuredRun?.complete);
  writeFileSync(join(evidence,'real-local-execution.json'),JSON.stringify({dataClass:'REAL_LOCAL_VALIDATION_EXECUTION_NOT_PRODUCTION',run:measuredRun},null,2));
  passed.push('recorder persisted real local database-validation execution');
  await runAcpmHttpTests(liveService,ctx,e);passed.push('real local HTTP JWT guards, canonical/legacy contracts and invalid filters');
  await runObserverTests(db as PrismaService,ctx,evidence);
  passed.push(...await runAcpmMultiInstanceCrashTests(url,ctx,evidence));
  const atomicEventId=randomUUID();
  await db.$executeRaw`INSERT INTO "AgentChainPerformanceEvent" ("companyId","eventId","recordedBy","payload","payloadHash") VALUES (${other.companyId}::uuid,${atomicEventId}::uuid,'test:conflict','{}'::jsonb,${'f'.repeat(64)})`;
  const runtimeService=new AgentRuntimeEventsService(db as PrismaService,new AcpmObserver(db as PrismaService));
  await assert.rejects(runtimeService.append({eventId:atomicEventId,mandateId:'atomicity-test',agentId:'test-agent',dossierId:'atomicity-test',lifecycle:'COMPLETED',sequence:1,occurredAt:new Date().toISOString(),evidenceRef:'fixture:atomic-rollback',detail:'rollback when ledger identity conflicts'},other));
  const rolledBack=await db.$queryRaw<Array<{count:bigint}>>`SELECT count(*) AS count FROM "AgentRuntimeEvent" WHERE "companyId"=${other.companyId}::uuid AND "eventId"=${atomicEventId}::uuid`;
  assert.equal(Number(rolledBack[0].count),0);passed.push('native runtime row rolls back atomically when ACPM event hash verification fails');
  const engine=dockerContainer?docker(['exec',dockerContainer,'postgres','--version']).trim():run('postgres',['--version']).trim();
  writeFileSync(join(evidence,'database-tests.json'),JSON.stringify({at:new Date().toISOString(),dataClass:'SYNTHETIC_TEST_FIXTURES_ON_REAL_ISOLATED_POSTGRESQL',engine,host:'127.0.0.1',port,data,dockerContainer:dockerContainer??null,containerEvidence,passed,productionAccess:false},null,2));
  console.log(`ACPM database tests: ${passed.length} passed`);
 }finally{await db?.$disconnect();if(started&&!dockerContainer)pgctl(['-m','fast','-w','stop']);}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
