import { readAcpmHistory } from '../src/acpm/acpm.repository';
import { AcpmSemanticIndex } from '../src/acpm/acpm.semantic';
import { OpenAIResponsesAgmatccProvider } from '../src/agmatcc-copilot/agmatcc-copilot.provider';
import { AcpmService } from '../src/acpm/acpm.service';
import { runtimeObservation } from '../src/acpm/acpm.runtime';
import type { AcpmEvent } from '@agm/shared';

describe('ACPM persistence and model identity (explicit controlled fixtures)',()=>{
  it('reads every legacy row beyond10000 with stable chronological order and no mutation',async()=>{
    const rows=Array.from({length:11007},(_,i)=>({eventId:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,cursorAt:new Date(1700000000000+(11007-i)*1000).toISOString()}));
    const before=JSON.stringify(rows),calls:string[]=[];
    const tx={$executeRaw:async()=>0,$queryRaw:async(strings:TemplateStringsArray,...args:unknown[])=>{
      const sql=strings.join('?');calls.push(sql);if(sql.includes('AgentChainPerformanceEvent'))return [];
      const cursor=args.length===3?String(args[1]):'';return rows.filter(r=>r.eventId>cursor).slice(0,Number(args.at(-1)));
    }};
    const p={$transaction:async(fn:Function,opts:unknown)=>{expect(opts).toMatchObject({isolationLevel:'RepeatableRead'});return fn(tx);}};
    const result=await readAcpmHistory(p as never,'tenant',1000);
    expect(result.legacy).toHaveLength(11007);expect(new Set(result.legacy.map(e=>e.eventId)).size).toBe(11007);
    expect(result.pagination.legacyPages).toBe(12);expect(result.legacy[0].eventId).toBe(rows.at(-1)!.eventId);
    expect(JSON.stringify(rows)).toBe(before);expect(calls.every(c=>c.includes('companyId'))).toBe(true);
  });
  const response={id:'resp_fixture',model:'gpt-6-luna-provider-reported-id',output_text:JSON.stringify({status:'UNKNOWN',answer:'fixture',evidenceRefs:[]}),usage:{input_tokens:10,output_tokens:2}};
  it('separates requested alias, returned model ID, response ID and unknown provider version',async()=>{
    const fetcher=jest.fn(async()=>new Response(JSON.stringify(response),{status:200}));
    const provider=new OpenAIResponsesAgmatccProvider('EXAMPLE_SYNTHETIC_KEY',fetcher as typeof fetch);
    const result=await provider.complete([{role:'user',content:'fixture'}],false);
    expect(result.providerExecution).toMatchObject({requestedModel:'gpt-6-luna',executedModel:response.model,responseId:'resp_fixture',providerVersion:null,source:'PROVIDER_RESPONSE'});
  });
  it('retains UNKNOWN when the provider does not return model identity',async()=>{
    const provider=new OpenAIResponsesAgmatccProvider('EXAMPLE_SYNTHETIC_KEY',(async()=>new Response(JSON.stringify({...response,model:undefined,id:undefined}))) as typeof fetch);
    expect((await provider.complete([],false)).providerExecution).toMatchObject({executedModel:null,responseId:null,missingReason:'PROVIDER_MODEL_NOT_RETURNED'});
  });
  it('keeps response identity on a structured-output error instead of erasing evidence',async()=>{
    const provider=new OpenAIResponsesAgmatccProvider('EXAMPLE_SYNTHETIC_KEY',(async()=>new Response(JSON.stringify({...response,output_text:'invalid'}))) as typeof fetch);
    await expect(provider.complete([],false)).rejects.toMatchObject({providerExecution:{executedModel:response.model},usage:{inputTokens:10}});
  });
  it('does not promote OWNER-supplied model metadata to a demonstrated provider execution',()=>{
    const e:AcpmEvent={eventId:'e',chainId:'c',mandateId:'m',runId:'r',componentId:'a',componentKind:'AGENT',kind:'STARTED',sequence:1,occurredAt:'2026-11-16T10:00:00Z',evidenceRef:'fixture',source:'ACP',providerExecution:{provider:'openai',requestedModel:'gpt-6-luna',executedModel:'claimed',providerVersion:null,responseId:'resp_fixture',observedAt:'2026-11-16T10:00:00Z',source:'PROVIDER_RESPONSE',missingReason:null,providerVersionReason:'UNKNOWN'}};
    const i=new AcpmSemanticIndex('company');i.sync([e],'2026-11-16T10:01:00Z');expect(i.modelState('gpt-6-luna').demonstratedProviderModel).toBeNull();
    i.sync([e],'2026-11-16T10:01:00Z',false,[],['e']);expect(i.modelState('gpt-6-luna').demonstratedProviderModel).toBe('claimed');
  });
  it('reports DISABLED from configuration while preserving historical UNKNOWNs',async()=>{
    const previous=process.env.AGMATCC_COPILOT_ISOLATED_ENABLED;process.env.AGMATCC_COPILOT_ISOLATED_ENABLED='false';
    try {
      const prisma={$transaction:async(fn:Function)=>fn({$executeRaw:async()=>0,$queryRaw:async()=>[]})};
      const s=new AcpmService(prisma as never),ctx={companyId:'company',userId:'owner',roles:['OWNER'],requestId:'r',correlationId:'c'};
      const state=await s.semanticModelState(ctx,'gpt-6-luna');expect(state.operationalState).toBe('DISABLED');expect(state.currentModelExecutionIds).toEqual([]);expect(state.demonstratedProviderModel).toBeNull();
      expect(runtimeObservation(ctx,'fixture-orchestrator')).toMatchObject({requestCorrelationId:'c',orchestratorId:'fixture-orchestrator',source:'RUNTIME_OBSERVER'});
    }finally{if(previous===undefined)delete process.env.AGMATCC_COPILOT_ISOLATED_ENABLED;else process.env.AGMATCC_COPILOT_ISOLATED_ENABLED=previous;}
  });
});
import { AcpmObserver } from '../src/acpm/acpm.observer';
import { canonicalAcpm } from '../src/acpm/acpm.canonical';
import { createHash } from 'node:crypto';
describe('ACPM native replay',()=>{
 it('preserves original runtime metadata and rejects divergent content',async()=>{
  let stored:any;let writes=0;
  const tx={$executeRaw:async(strings:TemplateStringsArray,...v:any[])=>{if(strings.join('').includes('INSERT')){writes++;stored={payload:JSON.parse(v[3]),payloadHash:v[4]};}return 1;},$queryRaw:async()=>stored?[stored]:[]};
  const o=new AcpmObserver({} as never),ctx={companyId:'t',userId:'u',roles:['OWNER'],correlationId:'first',requestId:'r'};
  const input={eventId:'e',mandateId:'m',agentId:'a',dossierId:'d',lifecycle:'STARTED' as const,sequence:1,occurredAt:'2026-11-16T00:00:00Z',evidenceRef:'fixture',detail:''};
  await o.persistNativeInTransaction(tx as never,ctx,input);
  stored.payload.execution.runtimeSessionId='previous-process';stored.payloadHash=createHash('sha256').update(canonicalAcpm(stored.payload)).digest('hex');
  const before=JSON.stringify(stored);await o.persistNativeInTransaction(tx as never,{...ctx,correlationId:'retry'},input);
  expect(JSON.stringify(stored)).toBe(before);expect(writes).toBe(1);
  await expect(o.persistNativeInTransaction(tx as never,ctx,{...input,sequence:2})).rejects.toThrow('ACPM_OBSERVER_HASH_CONFLICT');
 });
});
describe('ACPM admission',()=>{
 it('coalesces tenant reads, bounds other tenants and checks OWNER before cache access',async()=>{
  const service=new AcpmService({} as never);let release!:()=>void;
  const gate=new Promise<void>(resolve=>release=resolve);
  const build=jest.spyOn(service as any,'buildSemanticView').mockImplementation(async()=>{await gate;return {index:new AcpmSemanticIndex('t')};});
  const ctx={companyId:'t',userId:'u',roles:['OWNER'],correlationId:'c',requestId:'r'};
  const a=service.semanticSearch(ctx,{}),b=service.semanticSearch(ctx,{});
  await expect(service.semanticSearch({...ctx,companyId:'other'},{})).rejects.toThrow('ACPM_INDEX_BUSY_RETRY');
  await expect(service.semanticSearch({...ctx,roles:[]},{})).rejects.toThrow('ACP_OWNER_REQUIRED');
  release();await Promise.all([a,b]);expect(build).toHaveBeenCalledTimes(1);
 });
});
