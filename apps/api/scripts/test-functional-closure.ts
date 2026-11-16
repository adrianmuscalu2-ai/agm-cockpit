import 'reflect-metadata';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AcpmObserver } from '../src/acpm/acpm.observer';
import { canonicalAcpm } from '../src/acpm/acpm.canonical';
import { OperationalAgentDutyRunner } from '../src/authority-control-plane/operational-agent-duty.runner';
import { projectAcpm, type AcpmEvent } from '@agm/shared';

async function main() {
 const url=new URL(process.env.DATABASE_URL!);
 assert.equal(url.hostname,'127.0.0.1'); assert.equal(url.port,'55432'); assert.equal(url.pathname,'/agm_cockpit_191_rehearsal');
 const db=new PrismaClient(), independent=new PrismaClient();
 try {
  const before=await db.$queryRaw<any[]>`SELECT count(*)::int AS reservations FROM "LunaEvaluationReservation"`;
  const company=await db.company.create({data:{companyName:'FUNCTIONAL_CLOSURE_TEST_NO_PROVIDER_CALL',countryCode:'RO',defaultCurrencyCode:'EUR'}});
  const ctx={companyId:company.id,userId:'internal-test-not-a-human-session',roles:[],requestId:randomUUID(),correlationId:randomUUID()};
  const observer=new AcpmObserver(db as never);
  const runner=new OperationalAgentDutyRunner(db as never,{} as never,{} as never,observer);
  // Real PostgreSQL reads and persistence. No fabricated human login or authority grant.
  const inspector=await runner.executeChiefMonitoringInspector(ctx,{id:randomUUID(),agentId:'chief-monitoring-inspector'},randomUUID());
  assert.equal(inspector.passed,true);
  const [acp]=await runner.execute(ctx,[{id:randomUUID(),agentId:'agm.authority.control-plane'}],randomUUID(),new Set(['agm.authority.control-plane']));
  assert.equal(acp.passed,false); assert.equal(acp.reason,'RUNTIME_CAPABILITY_PROBE_MISSING');
  const events=await independent.$queryRaw<Array<{payload:AcpmEvent,payloadHash:string}>>`SELECT payload,"payloadHash" FROM "AgentChainPerformanceEvent" WHERE "companyId"=${company.id}::uuid`;
  assert.equal(events.length,4);
  for(const event of events) assert.equal(createHash('sha256').update(canonicalAcpm(event.payload)).digest('hex'),event.payloadHash);
  const projection=projectAcpm(events.map(e=>e.payload),new Date().toISOString());
  assert.equal(projection.runs.length,2); assert.ok(projection.runs.every(r=>r.complete&&r.activeMs!==null));
  assert.deepEqual(new Set(projection.runs.map(r=>r.componentKind)),new Set(['INSPECTOR','CONTROL_PLANE']));
  assert.deepEqual(new Set(projection.runs.map(r=>r.departmentId)),new Set(['basic.monitoring','governance']));
  for(const result of [inspector,acp]) {
   const terminal=events.find(e=>e.payload.evidenceRef===result.evidenceRef)!;
   assert.ok(terminal); assert.equal(terminal.payload.evidenceHash,result.outputRef.slice(7));
   assert.ok(await independent.authorityAuditJournal.findUnique({where:{companyId_eventId:{companyId:company.id,eventId:result.evidenceRef.split(':')[1]}}}));
  }
  const after=await independent.$queryRaw<any[]>`SELECT count(*)::int AS reservations FROM "LunaEvaluationReservation"`;
  assert.deepEqual(after,before);
  const report={at:new Date().toISOString(),verdict:'PASS',scope:'EXISTING_REHEARSAL_REAL_POSTGRES_NOT_PRODUCTION_OR_AUTH_E2E',fixtureRetained:company.id,events,projection,independentClient:true,providerCalls:0,budgetReservationsUnchanged:true};
  writeFileSync(join(process.env.FUNCTIONAL_EVIDENCE_DIR!,'real-duty-postgres.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({verdict:'PASS',persistedEvents:events.length,completeRuns:2,hashes:'PASS',references:'PASS',failureNotMasked:true,providerCalls:0}));
 } finally {await db.$disconnect();await independent.$disconnect();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
