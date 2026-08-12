import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CommunicationService } from '../src/communications/communication.service';
import { CommunicationProviderRegistry, type CommunicationProviderPort } from '../src/communications/communication-provider.port';

type Row=Record<string,any>;
const messages:Row[]=[]; const conversations:Row[]=[]; let sends=0; let failNext=false;
const provider:CommunicationProviderPort={channel:'email',provider:'gmail',configured:()=>true,send:async()=>{sends++;if(failNext){failNext=false;throw new Error('CONTROLLED_PROVIDER_FAILURE');}return{providerMessageId:`provider-${sends}`,externalThreadId:`thread-${sends}`,status:'sent'};}};
const matches=(row:Row,where:Row):boolean=>Object.entries(where).every(([key,value])=>{if(key==='OR')return(value as Row[]).some((item)=>matches(row,item));if(value&&typeof value==='object'&&!Array.isArray(value))return matches(row[key]??{},value as Row);return row[key]===value;});
const prisma:any={communicationConversation:{findFirst:async({where}:any)=>conversations.find(row=>matches(row,where)),create:async({data}:any)=>{const row={id:`conversation-${conversations.length+1}`,status:'open',...data};conversations.push(row);return row;},update:async({where,data}:any)=>Object.assign(conversations.find(row=>matches(row,where))!,data)},communicationMessage:{findUnique:async({where}:any)=>messages.find(row=>matches(row,where.companyId_clientMessageId)),findFirst:async({where}:any)=>messages.find(row=>matches(row,where)),create:async({data}:any)=>{const row={id:`message-${messages.length+1}`,retryCount:0,...data};messages.push(row);return row;},update:async({where,data}:any)=>{const row=messages.find(item=>matches(item,where))!;for(const[key,value]of Object.entries(data)){row[key]=value&&typeof value==='object'&&'increment'in(value as any)?(row[key]??0)+(value as any).increment:value;}return row;}}};
const service=new CommunicationService(prisma,new CommunicationProviderRegistry([provider]));
const ctx=(companyId:string)=>({companyId,userId:`user-${companyId}`} as any);
const outbound=(id:string)=>({contractVersion:'communication-message.v1',clientMessageId:id,channel:'email',to:'driver@example.com',bodyText:'Controlled local validation'});

async function main(){
  const duplicateId=randomUUID(); const first=await service.send(outbound(duplicateId),ctx('tenant-a')); const duplicate=await service.send(outbound(duplicateId),ctx('tenant-a')); assert.equal(first.status,'sent');assert.equal(duplicate.duplicate,true);assert.equal(sends,1);
  const isolated=await service.send(outbound(duplicateId),ctx('tenant-b'));assert.equal(isolated.duplicate,false);assert.equal(sends,2);
  await assert.rejects(()=>service.retry(first.id,ctx('tenant-a')),(error:any)=>error?.response?.code==='COMMUNICATION_RETRY_NOT_ALLOWED');assert.equal(sends,2);
  failNext=true;const failed=await service.send(outbound(randomUUID()),ctx('tenant-a'));assert.equal(failed.status,'failed');const retried=await service.retry(failed.id,ctx('tenant-a'));assert.equal(retried.status,'sent');assert.equal(sends,4);
  const exhausted={...messages.find(row=>row.id===failed.id),id:'message-exhausted',status:'failed',retryCount:5};messages.push(exhausted);await assert.rejects(()=>service.retry(exhausted.id,ctx('tenant-a')),(error:any)=>error?.response?.code==='COMMUNICATION_RETRY_EXHAUSTED');assert.equal(sends,4);
  const inbound={contractVersion:'communication-message.v1' as const,provider:'gmail',providerEventId:'event-1',providerMessageId:'inbound-1',channel:'email' as const,from:'driver@example.com',to:'owner@example.com',bodyText:'Reply',occurredAt:new Date().toISOString()};const received=await service.ingest(inbound,'tenant-a');const receivedDuplicate=await service.ingest(inbound,'tenant-a');const receivedOtherTenant=await service.ingest(inbound,'tenant-b');assert.equal(received.duplicate,false);assert.equal(receivedDuplicate.duplicate,true);assert.equal(receivedOtherTenant.duplicate,false);
  console.log(JSON.stringify({verdict:'COMMUNICATION_DELIVERY_CONTROLS_PASS',controlledFailureRetry:true,maxAttemptsFive:true,confirmedResendDenied:true,outboundDedup:true,inboundDedup:true,tenantIsolation:true,externalMessagesSent:false}));
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'COMMUNICATION_DELIVERY_CONTROLS_FAILED');process.exitCode=1;});
