import 'reflect-metadata';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {createHash,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {LunaAcpmLedger} from '../src/agmatcc-copilot/luna-acpm-ledger';
import {canonicalAcpm} from '../src/acpm/acpm.canonical';

// Integration fixture: exercise Production accounting SQL in the EXISTING rehearsal.
// Only target assertion is overridden; never deploy this fixture or invoke a provider.
class RehearsalProductionLedger extends LunaAcpmLedger {
 protected override requireTarget(){const u=new URL(process.env.DATABASE_URL!);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'55432');assert.equal(u.pathname,'/agm_cockpit_191_rehearsal');}
}
async function main(){
 const p=new PrismaClient(),q=new PrismaClient();try{
 const [fence]=await p.$queryRaw<any[]>`SELECT to_regclass('"LunaBudgetSourceFence"')::text AS name`;
 if(fence.name){
  // The one-way seal intentionally prevents repeating positive writes here.
  // Reuse the accepted concurrency report; run only the affected legacy-writer gate.
  await import('./test-luna-source-fence');return;
 }
 const company=await p.company.create({data:{companyName:'PR35 Production budget SQL fixture - NO PROVIDER',countryCode:'RO',defaultCurrencyCode:'EUR'}});
 const ctx={companyId:company.id,userId:'budget-fixture-no-auth-claim',roles:[],requestId:randomUUID(),correlationId:randomUUID()};
 const [handoff]=await p.$queryRaw<any[]>`SELECT * FROM "LunaBudgetHandoff"`;
 assert.ok(handoff);process.env.NODE_ENV='development';
 await assert.rejects(new LunaAcpmLedger(p as never).reserve(ctx,randomUUID(),'SOURCE_FREEZE_TEST'),/SOURCE_BUDGET_FROZEN/);
 process.env.NODE_ENV='production';process.env.AGMATCC_LUNA_HANDOFF_SHA256='0'.repeat(64);
 const a=new RehearsalProductionLedger(p as never),b=new RehearsalProductionLedger(q as never);
 await assert.rejects(a.reserve(ctx,randomUUID(),'BAD_RECEIPT_TEST'),/VERIFIED_HANDOFF_REQUIRED/);
 process.env.AGMATCC_LUNA_HANDOFF_SHA256=handoff.receiptHash;
 const results=await Promise.allSettled(Array.from({length:55},(_,i)=>(i%2?a:b).reserve(ctx,randomUUID(),'PRODUCTION_BUDGET_NO_PROVIDER')));
 const accepted=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]),rejected=results.filter(r=>r.status==='rejected') as PromiseRejectedResult[];
 assert.ok(accepted.length>0&&accepted.length<=49&&rejected.length>0);
 for(const r of rejected)assert.match(String(r.reason),/BUDGET_EXHAUSTED/);
 const [peak]=await p.$queryRaw<any[]>`SELECT (SELECT "carriedNanoUsd" FROM "LunaBudgetHandoff")+sum(COALESCE("chargedNanoUsd","reservedNanoUsd"))::bigint AS accounted FROM "LunaEvaluationReservation"`;
 assert.ok(BigInt(peak.accounted)<=5000000000n);
 for(const r of accepted)await a.settle(r,{inputTokens:0,outputTokens:0,estimatedCostUsd:0},'TEST_NO_PROVIDER_CALL',[]);
 await assert.rejects(b.settle(accepted[0],{inputTokens:0,outputTokens:0,estimatedCostUsd:0},null,[]),/ALREADY_SETTLED/);
 const rows=await q.$queryRaw<any[]>`SELECT payload,"payloadHash" FROM "AgentChainPerformanceEvent" WHERE "companyId"=${company.id}::uuid`;
 assert.equal(rows.length,accepted.length*2);
 assert.ok(rows.every(r=>createHash('sha256').update(canonicalAcpm(r.payload)).digest('hex')===r.payloadHash));
 const report={verdict:'PASS',target:'existing rehearsal only; Production accounting policy, not deployed Production',providerCalls:0,requests:55,accepted:accepted.length,refused:rejected.length,peakNanoUsd:String(peak.accounted),hashes:rows.length,sourceFreeze:'PASS',badReceiptRejected:'PASS',duplicateSettlementRejected:'PASS',receiptHash:handoff.receiptHash};
 writeFileSync('D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence/production-budget-rehearsal-'+Date.now()+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await p.$disconnect();await q.$disconnect();}
}main().catch(e=>{console.error(e.message);process.exitCode=1;});
