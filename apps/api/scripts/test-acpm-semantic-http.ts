import 'reflect-metadata';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { canonicalAcpm } from '../src/acpm/acpm.canonical';
let stage='target';

async function main() {
  const target=new URL(process.env.DATABASE_URL??'');
  assert.equal(target.hostname,'127.0.0.1');assert.equal(target.port,'55432');assert.equal(target.pathname,'/agm_cockpit_191_rehearsal');
  assert.equal(process.env.AGMATCC_COPILOT_PROVIDER,'simulated');
  const output=process.argv[2];assert.ok(output);
  const db=new PrismaClient();
  const ledger=async()=>{
    const rows=await db.$queryRaw<Array<{payload:unknown;payloadHash:string}>>`SELECT payload,"payloadHash" FROM "AgentChainPerformanceEvent" ORDER BY "companyId","eventId"`;
    const reservations=await db.$queryRaw<unknown[]>`SELECT * FROM "LunaEvaluationReservation" ORDER BY "callId"`;
    return createHash('sha256').update(canonicalAcpm(JSON.parse(JSON.stringify({rows,reservations},(_,v)=>typeof v==='bigint'?String(v):v)))).digest('hex');
  };
  stage='ledger-before';const before=await ledger();
  stage='bootstrap';
  const {createAgmatccRehearsalApp}=await import('./start-agmatcc-isolated-local');
  const app=await createAgmatccRehearsalApp();
  try {
    await app.listen(0,'127.0.0.1');const api=`${await app.getUrl()}/api/v1`;
    stage='unauthorized';const unauthorized=await fetch(`${api}/acpm/semantic?q=blocaje`);assert.equal(unauthorized.status,401);
    stage='existing-owner-login';
    const login=await fetch(`${api}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.AGM_REHEARSAL_OWNER_EMAIL,password:process.env.AGM_REHEARSAL_OWNER_PASSWORD})});
    assert.equal(login.status,201);const identity=(await login.json()).data;assert.ok(identity.accessToken);
    const headers={Authorization:`Bearer ${identity.accessToken}`};
    const probes:Array<{route:string;http:number;data:unknown}>=[];
    for(const route of ['acpm/semantic?limit=3','acpm/semantic?q=blocaje%20justificate','acpm/model-state?model=gpt-6-luna',...(process.env.ACPM_VERIFY_CHAIN?['acpm/semantic-chain?chain='+encodeURIComponent(process.env.ACPM_VERIFY_CHAIN)]:[])]) {
      stage=route;
      const response=await fetch(`${api}/${route}`,{headers});assert.equal(response.status,200);probes.push({route,http:response.status,data:(await response.json()).data});
    }
    const all=await (await fetch(`${api}/acpm/semantic?limit=1`,{headers})).json();
    const chain=all.data.results[0]?.event.chainId;
    if(chain){const response=await fetch(`${api}/acpm/semantic-chain?chain=${encodeURIComponent(chain)}`,{headers});assert.equal(response.status,200);probes.push({route:'acpm/semantic-chain',http:200,data:(await response.json()).data});}
    const rebuild=await (await fetch(`${api}/acpm/semantic?limit=1&rebuild=true`,{headers})).json();
    assert.equal(rebuild.data.documentSetHash,all.data.documentSetHash);
    const invalid=await fetch(`${api}/acpm/semantic?limit=10001`,{headers});assert.equal(invalid.status,400);
    stage='ledger-after';const after=await ledger();assert.equal(after,before);
    let realExecution:unknown=null;
    if(process.env.ACPM_EXECUTE_REAL_INSPECTOR==='true') {
      stage='real-local-inspector';
      const originals=await db.$queryRaw<Array<{eventId:string;payloadHash:string}>>`SELECT "eventId","payloadHash" FROM "AgentChainPerformanceEvent"`;
      const execution=await fetch(`${api}/agent-runtime-events/execute-inspector`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({expectedOutcome:'COMPLETED'})});
      assert.equal(execution.status,201);const result=(await execution.json()).data;
      const chainResponse=await fetch(`${api}/acpm/semantic-chain?chain=${encodeURIComponent(result.mandateId)}`,{headers});assert.equal(chainResponse.status,200);
      const chain=(await chainResponse.json()).data;
      assert.equal(chain.completeness,'COMPLETE_OBSERVED_CHAIN');assert.ok(chain.correlation.every((r:any)=>r.runtimeSessions.length===1&&r.orchestrators.includes('AgentRuntimeEventsService')));
      const finalRows=await db.$queryRaw<Array<{eventId:string;payloadHash:string}>>`SELECT "eventId","payloadHash" FROM "AgentChainPerformanceEvent"`;
      const hashes=new Map(finalRows.map(r=>[r.eventId,r.payloadHash]));assert.ok(originals.every(r=>hashes.get(r.eventId)===r.payloadHash));
      assert.equal(finalRows.length-originals.length,3);
      realExecution={scope:'REAL_LOCAL_P3_INSPECTOR_EXECUTION_NOT_AI_MODEL_OR_AUTHORITYMANDATE_APPROVAL',result,chain,originalHashesUnchanged:true,appendedEvents:3};
    }
    writeFileSync(output,JSON.stringify({at:new Date().toISOString(),scope:'REAL_LOCAL_REHEARSAL_HTTP_EXISTING_OWNER',compiledArtifact:process.env.ACPM_COMPILED_REPLAY==='true',documentSetHash:all.data.documentSetHash,verdict:'PASS',unauthorizedHTTP:401,ownerLoginHTTP:201,ownerId:identity.user?.id,invalidQueryHTTP:400,rebuildIdentical:true,canonicalLedgerAndBudgetUnchanged:true,ledgerSHA256:after,providerCalls:0,productionMutations:0,realExecution,probes},null,2),{flag:'wx'});
  } finally {await app.close();await db.$disconnect();}
}
main().catch(e=>{console.error(JSON.stringify({code:'ACPM_REAL_HTTP_TEST_FAILED',stage,type:e.constructor.name,assertion:e.code==='ERR_ASSERTION'?{expected:e.expected,actual:typeof e.actual==='number'?e.actual:'REDACTED'}:null,secretsLogged:false}));process.exitCode=1;});
