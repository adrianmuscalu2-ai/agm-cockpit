import 'reflect-metadata';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
async function main(){
 const u=new URL(process.env.DATABASE_URL!);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'55432');assert.equal(u.pathname,'/agm_cockpit_191_rehearsal');
 const clients=[new PrismaClient(),new PrismaClient()];try{
 const [before]=await clients[0].$queryRaw<any[]>`SELECT count(*)::int AS count FROM "LunaEvaluationReservation"`;
 const attempts=await Promise.allSettled(Array.from({length:20},(_,i)=>clients[i%2].$executeRaw`INSERT INTO "LunaEvaluationReservation" ("callId","companyId","executionId",scope,"reservedNanoUsd",state,"startedAt") VALUES (${randomUUID()}::uuid,'00000000-0000-0000-0000-000000000001'::uuid,${randomUUID()}::uuid,'agm-luna-evaluation-20261115',100000000,'RESERVED',now())`));
 assert.ok(attempts.every(r=>r.status==='rejected'&&String(r.reason).includes('LUNA_SOURCE_BUDGET_FROZEN_DB')));
 const [after]=await clients[1].$queryRaw<any[]>`SELECT count(*)::int AS count FROM "LunaEvaluationReservation"`;
 assert.equal(after.count,before.count);
 await assert.rejects(clients[0].$executeRaw`UPDATE "LunaBudgetSourceFence" SET frozen=false`,/LUNA_FENCE_IRREVERSIBLE/);
 const [accounting]=await clients[0].$queryRaw<any[]>`SELECT b."priorNanoUsd"+(SELECT sum(COALESCE("chargedNanoUsd","reservedNanoUsd"))::bigint FROM "LunaEvaluationReservation") AS current,h."carriedNanoUsd" AS carried FROM "LunaEvaluationBudget" b JOIN "LunaBudgetHandoff" h ON h.scope=b.scope`;
 assert.equal(String(accounting.current),String(accounting.carried));
 const report={verdict:'PASS',target:'existing rehearsal',legacyDirectWritersRefused:20,clients:2,rowsUnchanged:true,unfreezeRefused:true,currentNanoUsd:String(accounting.current),carriedNanoUsd:String(accounting.carried),providerCalls:0};
 writeFileSync('D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence/source-write-fence.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await Promise.all(clients.map(p=>p.$disconnect()));}
}main().catch(e=>{console.error(e.message);process.exitCode=1;});
