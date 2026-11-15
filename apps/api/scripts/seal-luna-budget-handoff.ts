import 'reflect-metadata';
import {PrismaClient} from '@prisma/client';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {canonicalAcpm} from '../src/acpm/acpm.canonical';

async function main(){
 const url=new URL(process.env.DATABASE_URL??'');
 if(url.hostname!=='127.0.0.1'||url.port!=='55432'||url.pathname!=='/agm_cockpit_191_rehearsal')throw Error('REHEARSAL_ONLY');
 const p=new PrismaClient();try{
 const row=await p.$transaction(async tx=>{
  await tx.$executeRaw`SET LOCAL synchronous_commit = on`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(191,61115)::text`;
  const existing=await tx.$queryRaw<any[]>`SELECT * FROM "LunaBudgetHandoff"`;
  if(existing.length)return existing[0];
  const rows=await tx.$queryRaw<any[]>`SELECT b.scope,b."priorNanoUsd"+COALESCE(SUM(COALESCE(r."chargedNanoUsd",r."reservedNanoUsd")),0)::bigint AS carried FROM "LunaEvaluationBudget" b LEFT JOIN "LunaEvaluationReservation" r ON r.scope=b.scope GROUP BY b.scope,b."priorNanoUsd"`;
  if(rows.length!==1)throw Error('BUDGET_SCOPE_MISMATCH');
  // Unknown reservations are transferred at their full amount; never refunded.
  const receipt={schema:'luna-budget-handoff.v1',scope:rows[0].scope,sourceDatabase:'agm_cockpit_191_rehearsal',targetDatabase:'agm',carriedNanoUsd:String(rows[0].carried),sealedAt:new Date().toISOString()};
  const serialized=canonicalAcpm(receipt),hash=createHash('sha256').update(serialized).digest('hex');
  await tx.$executeRaw`INSERT INTO "LunaBudgetHandoff" (scope,"sourceDatabase","targetDatabase","carriedNanoUsd","receiptHash",receipt) VALUES (${receipt.scope},${receipt.sourceDatabase},${receipt.targetDatabase},${rows[0].carried},${hash},${serialized}::jsonb)`;
  return {receipt,receiptHash:hash};
 });
 writeFileSync('D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence/luna-budget-handoff.json',JSON.stringify(row,(_,v)=>typeof v==='bigint'?String(v):v,2));
 console.log(JSON.stringify({sourceFrozen:true,receiptHash:row.receiptHash,receipt:row.receipt}));
 }finally{await p.$disconnect();}
}main().catch(e=>{console.error(e.message);process.exitCode=1;});
