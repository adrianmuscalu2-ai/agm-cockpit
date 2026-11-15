import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LunaAcpmLedger } from '../src/agmatcc-copilot/luna-acpm-ledger';
import { estimateCost } from '../src/agmatcc-copilot/agmatcc-copilot.provider';

// One explicitly authorized diagnostic. Production key stays in its existing container.
// Reserve the shared evaluation budget BEFORE opening the remote inference process.
async function main() {
 const prisma=new PrismaClient();const ledger=new LunaAcpmLedger(prisma as never);
 const executionId=randomUUID();
 try {
  const r=await ledger.reserve({companyId:'00000000-0000-0000-0000-000000000001',userId:'authorized-production-provider-probe',roles:[],requestId:executionId,correlationId:executionId},executionId,'isolated-eval:PRODUCTION_KEY_RESPONSES_PROBE');
  const remote=`(async()=>{try{const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-6-luna',input:'Răspunde în română cu exact: Verificare reușită.',reasoning:{effort:'low'},max_output_tokens:120,service_tier:'default',store:false}),signal:AbortSignal.timeout(30000)});const j=await r.json();console.log(JSON.stringify({httpStatus:r.status,model:j.model??null,status:j.status??null,usage:j.usage??null,text:(j.output??[]).flatMap(x=>x.content??[]).map(x=>x.text??'').join(''),errorCode:j.error?.code??null}));}catch{console.log(JSON.stringify({error:'UNCONFIRMED_REMOTE_REQUEST'}));}})();`;
  const child=spawn('ssh',['-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=8','-i',join(process.env.USERPROFILE!,'.ssh/agm_release_operations_hetzner_ed25519'),'agmops@167.233.237.253','sudo -n docker exec -i agm-production-api node'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  let stdout='';child.stdout.on('data',b=>stdout+=b.toString());child.stderr.resume();child.stdin.end(remote);
  const code=await new Promise<number|null>((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
  let result:any;try{result=JSON.parse(stdout);}catch{result={error:'REMOTE_RESULT_UNCONFIRMED',exitCode:code};}
  const i=result.usage?.input_tokens,o=result.usage?.output_tokens;
  const usage=Number.isSafeInteger(i)&&i>=0&&Number.isSafeInteger(o)&&o>=0?{inputTokens:i,outputTokens:o,estimatedCostUsd:estimateCost(i,o)}:undefined;
  await ledger.settle(r,usage,result.httpStatus===200?null:'PRODUCTION_RESPONSES_PROBE_FAILED',[],result.status);
  const evidence={at:new Date().toISOString(),executionId,productionKeyTransferred:false,productionDatabaseModified:false,budgetReservation:r.callId,...result,accountedUsage:usage??'UNCONFIRMED_RESERVED_0.10_USD'};
  writeFileSync('D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence/production-responses-probe-'+executionId+'.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
  if(result.httpStatus!==200||!usage||!result.text)process.exitCode=1;
 } finally {await prisma.$disconnect();}
}
main().catch(()=>{console.error('PROBE_FAILED_RESERVATION_RETAINED_IF_CREATED');process.exitCode=1;});
