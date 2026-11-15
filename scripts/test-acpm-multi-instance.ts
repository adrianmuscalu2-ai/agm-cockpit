import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { AcpmService, canonicalAcpm } from '../apps/api/src/acpm/acpm.service';
import { AcpmObserver } from '../apps/api/src/acpm/acpm.observer';
import { AgentRuntimeEventsService } from '../apps/api/src/agent-runtime-events/agent-runtime-events.service';
import type { PrismaService } from '../apps/api/src/prisma/prisma.service';
import type { RequestContext } from '../apps/api/src/common/request-context';

function worker(mode:string,url:string,context:RequestContext,payload:unknown){
  const cli=resolve('node_modules/tsx/dist/cli.mjs');
  const child=spawn(process.execPath,[cli,'--tsconfig','apps/api/tsconfig.json','scripts/acpm-persistence-worker.ts'],{
    cwd:process.cwd(),windowsHide:true,stdio:['pipe','pipe','pipe'],
    env:{...process.env,DATABASE_URL:url,ACPM_TEST_WORKER_MODE:mode,ACPM_TEST_CONTEXT:JSON.stringify(context),
      ...(mode==='append'?{ACPM_TEST_EVENT:JSON.stringify(payload)}:{ACPM_TEST_NATIVE_EVENT:JSON.stringify(payload)})},
  });
  let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=String(chunk));child.stderr.on('data',chunk=>stderr+=String(chunk));
  return {child,get stdout(){return stdout;},get stderr(){return stderr;},workerPid:undefined as number|undefined};
}
function waitForMarker(target:ReturnType<typeof worker>,marker:string,timeoutMs=30000){
  return new Promise<string>((resolveMarker,reject)=>{
    const started=Date.now();
    const timer=setInterval(()=>{
      if(target.stdout.includes(marker)){clearInterval(timer);resolveMarker(target.stdout.split('\n').find(line=>line.includes(marker))!);}
      else if(Date.now()-started>timeoutMs){clearInterval(timer);reject(new Error(`worker marker timeout ${marker}: ${target.stderr.slice(-1000)}`));}
    },20);
    target.child.once('exit',(code,signal)=>{if(!target.stdout.includes(marker)){clearInterval(timer);reject(new Error(`worker exited before ${marker}; code=${code}; signal=${signal}; ${target.stderr.slice(-1000)}`));}});
  });
}
function waitForExit(child:ChildProcessWithoutNullStreams,timeoutMs=5000){return new Promise<void>((resolveExit,reject)=>{if(child.exitCode!==null||child.signalCode!==null)return resolveExit();const timer=setTimeout(()=>reject(new Error(`worker wrapper ${child.pid} did not exit after executor termination`)),timeoutMs);child.once('exit',()=>{clearTimeout(timer);resolveExit();});});}
function isAlive(pid:number){try{process.kill(pid,0);return true;}catch(error){return (error as NodeJS.ErrnoException).code!=='ESRCH';}}
async function terminateExecutor(target:ReturnType<typeof worker>){
  const pid=target.workerPid;
  if(!pid){
    const launcherPid=target.child.pid;
    if(!launcherPid)throw new Error('worker launcher PID unavailable before executor readiness marker');
    if(isAlive(launcherPid)&&process.platform==='win32')execFileSync('taskkill.exe',['/PID',String(launcherPid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    else if(isAlive(launcherPid))target.child.kill('SIGKILL');
    await waitForExit(target.child);
    return;
  }
  if(isAlive(pid)){
    if(process.platform==='win32')execFileSync('taskkill.exe',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    else process.kill(pid,'SIGKILL');
  }
  for(let i=0;i<100&&isAlive(pid);i++)await new Promise(resolveDelay=>setTimeout(resolveDelay,25));
  if(isAlive(pid))throw new Error(`SIGKILL did not terminate executor PID ${pid}`);
  await waitForExit(target.child);
}

export async function runAcpmMultiInstanceCrashTests(url:string,ctx:RequestContext,evidence:string){
  const db=new PrismaClient({datasources:{db:{url}}});
  const passed:string[]=[];const active:Array<ReturnType<typeof worker>>=[];
  mkdirSync(evidence,{recursive:true});
  try{
    await db.$executeRawUnsafe(`CREATE FUNCTION public.acpm_test_concurrency_pause() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."payload"->>'evidenceRef'='fixture:multi-instance-same-event' THEN PERFORM pg_sleep(0.75); END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe('CREATE TRIGGER acpm_test_concurrency_pause BEFORE INSERT ON "AgentChainPerformanceEvent" FOR EACH ROW EXECUTE FUNCTION public.acpm_test_concurrency_pause()');
    const eventId=randomUUID();
    const event={eventId,chainId:'multi-instance-test',mandateId:'multi-instance-test',runId:'multi-instance-test',componentId:'concurrent-api-worker',componentKind:'AGENT' as const,kind:'STARTED' as const,sequence:1,occurredAt:new Date().toISOString(),evidenceRef:'fixture:multi-instance-same-event',evidenceHash:'c'.repeat(64)};
    const a=worker('append',url,ctx,event),b=worker('append',url,ctx,event);active.push(a,b);
    const [readyA,readyB]=await Promise.all([waitForMarker(a,'WORKER_READY'),waitForMarker(b,'WORKER_READY')]);
    a.workerPid=JSON.parse(readyA).workerPid;b.workerPid=JSON.parse(readyB).workerPid;
    a.child.stdin.write('GO\n');b.child.stdin.write('GO\n');
    let peakConcurrentPgSleep=0;
    const overlapDeadline=Date.now()+10000;
    while(Date.now()<overlapDeadline){
      const sleeping=await db.$queryRaw<Array<{count:bigint}>>`SELECT count(*) AS count FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND wait_event='PgSleep' AND query ILIKE '%AgentChainPerformanceEvent%'`;
      peakConcurrentPgSleep=Math.max(peakConcurrentPgSleep,Number(sleeping[0].count));
      if(peakConcurrentPgSleep>=2)break;
      await new Promise(resolveDelay=>setTimeout(resolveDelay,10));
    }
    assert.ok(peakConcurrentPgSleep>=2,`expected to observe two simultaneous insert transactions sleeping in the database trigger; peak=${peakConcurrentPgSleep}`);
    const [lineA,lineB]=await Promise.all([waitForMarker(a,'WORKER_COMMITTED'),waitForMarker(b,'WORKER_COMMITTED')]);
    const resultA=JSON.parse(lineA),resultB=JSON.parse(lineB);assert.equal(resultA.eventId,eventId);assert.equal(resultB.eventId,eventId);assert.equal(resultA.payloadHash,resultB.payloadHash);
    await Promise.all([terminateExecutor(a),terminateExecutor(b)]);
    await db.$executeRawUnsafe('DROP TRIGGER acpm_test_concurrency_pause ON "AgentChainPerformanceEvent"');
    await db.$executeRawUnsafe('DROP FUNCTION public.acpm_test_concurrency_pause()');
    const rows=await db.$queryRaw<Array<{payload:any;payloadHash:string}>>`SELECT "payload","payloadHash" FROM "AgentChainPerformanceEvent" WHERE "companyId"=${ctx.companyId}::uuid AND "eventId"=${eventId}::uuid`;
    assert.equal(rows.length,1);assert.equal(rows[0].payloadHash,createHash('sha256').update(canonicalAcpm(rows[0].payload)).digest('hex'));
    await new AcpmService(db as PrismaService).append(event,ctx);
    const afterRetry=await db.$queryRaw<Array<{count:bigint}>>`SELECT count(*) AS count FROM "AgentChainPerformanceEvent" WHERE "companyId"=${ctx.companyId}::uuid AND "eventId"=${eventId}::uuid`;
    assert.equal(Number(afterRetry[0].count),1);passed.push('two independent worker processes commit/retry same event ID and hash exactly once; killing both after commit preserves it');

    const nativeId=randomUUID();
    const native={eventId:nativeId,mandateId:'crash-rollback-test',agentId:'worker-agent',dossierId:'crash-rollback-test',lifecycle:'COMPLETED' as const,sequence:1,occurredAt:new Date().toISOString(),evidenceRef:'fixture:interrupted-native-transaction',detail:'isolated crash rollback'};
    const crashed=worker('crash-native-tx',url,ctx,native);active.push(crashed);
    const openMarker=JSON.parse(await waitForMarker(crashed,'TX_OPEN_BEFORE_COMMIT')) as {workerPid:number;backendPid:number};
    crashed.workerPid=openMarker.workerPid;
    await terminateExecutor(crashed);
    let backendClosed=false;
    for(let attempt=0;attempt<50;attempt++){
      const activeBackends=await db.$queryRaw<Array<{count:bigint}>>`SELECT count(*) AS count FROM pg_stat_activity WHERE pid=${openMarker.backendPid}`;
      if(Number(activeBackends[0].count)===0){backendClosed=true;break;}
      await new Promise(resolveDelay=>setTimeout(resolveDelay,100));
    }
    assert.equal(backendClosed,true,'killed worker PostgreSQL backend must disappear before rollback is accepted');
    let rolledBack=false;
    for(let attempt=0;attempt<50;attempt++){
      const [nativeRows,ledgerRows]=await Promise.all([
        db.$queryRaw<Array<{count:bigint}>>`SELECT count(*) AS count FROM "AgentRuntimeEvent" WHERE "companyId"=${ctx.companyId}::uuid AND "eventId"=${nativeId}::uuid`,
        db.$queryRaw<Array<{count:bigint}>>`SELECT count(*) AS count FROM "AgentChainPerformanceEvent" WHERE "companyId"=${ctx.companyId}::uuid AND "eventId"=${nativeId}::uuid`,
      ]);
      if(Number(nativeRows[0].count)===0&&Number(ledgerRows[0].count)===0){rolledBack=true;break;}
      await new Promise(resolveDelay=>setTimeout(resolveDelay,100));
    }
    assert.equal(rolledBack,true,'interrupted transaction must roll back both rows');
    const runtime=new AgentRuntimeEventsService(db as PrismaService,new AcpmObserver(db as PrismaService));
    await runtime.append(native,ctx);await runtime.append(native,ctx);
    const [nativeRows,ledgerRows]=await Promise.all([
      db.$queryRaw<Array<{count:bigint}>>`SELECT count(*) AS count FROM "AgentRuntimeEvent" WHERE "companyId"=${ctx.companyId}::uuid AND "eventId"=${nativeId}::uuid`,
      db.$queryRaw<Array<{payload:any;payloadHash:string}>>`SELECT "payload","payloadHash" FROM "AgentChainPerformanceEvent" WHERE "companyId"=${ctx.companyId}::uuid AND "eventId"=${nativeId}::uuid`,
    ]);
    assert.equal(Number(nativeRows[0].count),1);assert.equal(ledgerRows.length,1);
    assert.equal(ledgerRows[0].payloadHash,createHash('sha256').update(canonicalAcpm(ledgerRows[0].payload)).digest('hex'));
    passed.push('killed worker rolls back native+ACPM transaction; retry through real service creates one source row and one hash-valid ledger row');
    writeFileSync(join(evidence,'multi-instance-crash-tests.json'),JSON.stringify({at:new Date().toISOString(),dataClass:'SYNTHETIC_FIXTURES_ON_ISOLATED_POSTGRESQL',instanceProcesses:2,concurrencyBarrier:'both workers reported READY before GO; parent observed concurrent pg_stat_activity rows waiting in test-only BEFORE INSERT pg_sleep trigger',peakConcurrentPgSleep,workerPids:[a.workerPid,b.workerPid,crashed.workerPid],killedBackendPid:openMarker.backendPid,killedBackendObservedClosed:backendClosed,productionAccess:false,passed},null,2));
    return passed;
  } finally {
    const cleanupErrors:string[]=[];
    await Promise.all(active.map(async target=>{try{await terminateExecutor(target);}catch(error){cleanupErrors.push(`worker cleanup: ${error instanceof Error?error.message:String(error)}`);}}));
    try{await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS acpm_test_concurrency_pause ON "AgentChainPerformanceEvent"');await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS public.acpm_test_concurrency_pause()');}catch(error){cleanupErrors.push(`database-trigger cleanup: ${error instanceof Error?error.message:String(error)}`);}
    try{await db.$disconnect();}catch(error){cleanupErrors.push(`database disconnect: ${error instanceof Error?error.message:String(error)}`);}
    if(cleanupErrors.length)throw new Error(`isolated multi-instance cleanup failed: ${cleanupErrors.join('; ')}`);
  }
}
