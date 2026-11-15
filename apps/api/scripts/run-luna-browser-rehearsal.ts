import 'reflect-metadata';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/agm_cockpit_191_rehearsal') throw new Error('WRONG_REHEARSAL');
  const probe = createServer(); await new Promise<void>(r => probe.listen(0,'127.0.0.1',r));
  const webPort = (probe.address() as { port:number }).port; await new Promise<void>(r => probe.close(() => r()));
  process.env.CORS_ALLOWED_ORIGINS = `http://127.0.0.1:${webPort}`;
  process.env.AGM_TURN_ADMIN_PIN_HASH = await bcrypt.hash(process.env.AGM_REHEARSAL_TURN_PIN!,12);
  const { createAgmatccRehearsalApp } = await import('./start-agmatcc-isolated-local');
  const app = await createAgmatccRehearsalApp();
  const prisma = new PrismaClient();
  try {
    await app.listen(0,'127.0.0.1');
    const api = `${await app.getUrl()}/api/v1`;
    const root = resolve('../..');
    const runId = String(Date.now());
    const child = spawn(process.execPath,[resolve(root,'scripts/validate-luna-authenticated-rehearsal.mjs')],{ cwd:root,env:{...process.env,VITE_AGM_API_BASE_URL:api,REHEARSAL_WEB_PORT:String(webPort),REHEARSAL_RUN_ID:runId},stdio:'inherit' });
    const code = await new Promise<number|null>(r=>child.on('exit',r));
    const rows = await prisma.$queryRaw<Array<{payload:any;payloadHash:string}>>`SELECT payload,"payloadHash" FROM "AgentChainPerformanceEvent" WHERE "companyId"='00000000-0000-0000-0000-000000000001'::uuid ORDER BY "recordedAt"`;
    const { canonicalAcpm } = await import('../src/acpm/acpm.canonical');
    const budget = await prisma.$queryRaw<any[]>`SELECT b.*,COALESCE((SELECT sum(COALESCE("chargedNanoUsd","reservedNanoUsd")) FROM "LunaEvaluationReservation"),0)::bigint AS accounted FROM "LunaEvaluationBudget" b`;
    const result={at:new Date().toISOString(),browserExit:code,events:rows.map(r=>({payload:r.payload,hash:r.payloadHash,valid:createHash('sha256').update(canonicalAcpm(r.payload)).digest('hex')===r.payloadHash})),budget};
    writeFileSync(`D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence/authenticated-db-${runId}.json`,JSON.stringify(result,(_,v)=>typeof v==='bigint'?String(v):v,2));
    if(code!==0)throw new Error('BROWSER_PROBE_FAILED');
    assert.ok(result.events.length && result.events.every(e=>e.valid));
    assert.ok(budget.length===1 && BigInt(budget[0].accounted)+BigInt(budget[0].priorNanoUsd)<=BigInt(budget[0].limitNanoUsd));
    const browserReport=JSON.parse(readFileSync(`D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence/authenticated-browser-${runId}.json`,'utf8'));
    const answer=browserReport.copilot.data??browserReport.copilot;
    for(const ref of answer.evidenceRefs) {
      const match=/^operational-event:(.+)@(\d+):(.+)$/.exec(ref);assert.ok(match);
      const source=await prisma.operationalEvent.findFirst({where:{companyId:'00000000-0000-0000-0000-000000000001',eventId:match[3],aggregateVersion:Number(match[2]),stream:{streamId:match[1]}}});assert.ok(source);
    }
    writeFileSync(`D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence/authenticated-verified-${runId}.json`,JSON.stringify({hashes:'PASS',budget:'PASS',sourceReferences:'PASS',executionId:answer.executionId},null,2));
  } finally { await app.close(); await prisma.$disconnect(); }
}
main().catch(e=>{console.error(e instanceof Error?e.message:'REHEARSAL_FAILED');process.exitCode=1;});
