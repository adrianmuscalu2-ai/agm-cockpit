import 'reflect-metadata';
import {PrismaClient} from '@prisma/client';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalAcpm} from '../src/acpm/acpm.canonical';

// Prepared release-window action; NEVER called by migration/startup or this remediation.
// Import only the independently reviewed receipt hash, before enabling Production Luna.
async function main(){
 if(process.env.AGMATCC_LUNA_PRODUCTION_ENABLED==='true')throw Error('HANDOFF_IMPORT_REQUIRES_LUNA_DISABLED');
 const u=new URL(process.env.DATABASE_URL??'');
 if(process.env.NODE_ENV!=='production'||u.pathname!=='/agm'||u.hostname!==process.env.AGMATCC_LUNA_PRODUCTION_DB_HOST||!process.env.AGMATCC_LUNA_PRODUCTION_DB_HOST||u.port==='55432')throw Error('PRODUCTION_TARGET_REQUIRED');
 const exported=JSON.parse(readFileSync(process.argv[2],'utf8')),r=exported.receipt;
 const hash=createHash('sha256').update(canonicalAcpm(r)).digest('hex');
 if(hash!==exported.receiptHash||hash!==process.env.AGMATCC_LUNA_HANDOFF_SHA256||r.schema!=='luna-budget-handoff.v1'||r.scope!=='agm-luna-evaluation-20261115'||r.sourceDatabase!=='agm_cockpit_191_rehearsal'||r.targetDatabase!=='agm'||!/^\d+$/.test(r.carriedNanoUsd)||BigInt(r.carriedNanoUsd)<1000000n||BigInt(r.carriedNanoUsd)>5000000000n)throw Error('VERIFIED_RECEIPT_REQUIRED');
 const p=new PrismaClient();try{
  await p.$transaction(async tx=>{
   await tx.$executeRaw`SET LOCAL synchronous_commit = on`;
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(191,61115)::text`;
   const [db]=await tx.$queryRaw<Array<{name:string}>>`SELECT current_database() AS name`;
   if(db.name!=='agm')throw Error('ACTUAL_DATABASE_MISMATCH');
   const existing=await tx.$queryRaw<Array<{receiptHash:string}>>`SELECT "receiptHash" FROM "LunaBudgetHandoff" WHERE scope=${r.scope}`;
   if(existing.length){if(existing[0].receiptHash!==hash)throw Error('HANDOFF_CONFLICT');return;}
   const [count]=await tx.$queryRaw<Array<{count:bigint}>>`SELECT count(*) FROM "LunaEvaluationReservation" WHERE scope=${r.scope}`;
   if(BigInt(count.count)!==0n)throw Error('PRODUCTION_ALREADY_HAS_RESERVATIONS');
   await tx.$executeRaw`INSERT INTO "LunaBudgetHandoff" (scope,"sourceDatabase","targetDatabase","carriedNanoUsd","receiptHash",receipt) VALUES (${r.scope},${r.sourceDatabase},${r.targetDatabase},${BigInt(r.carriedNanoUsd)},${hash},${canonicalAcpm(r)}::jsonb)`;
  });
  console.log(JSON.stringify({receiptImported:true,receiptHash:hash,activationGranted:false}));
 }finally{await p.$disconnect();}
}main().catch(e=>{console.error(e.message);process.exitCode=1;});
