import { AcpmSemanticIndex } from '../src/acpm/acpm.semantic';
import { AcpmService } from '../src/acpm/acpm.service';
import { AcpmController } from '../src/acpm/acpm.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { canonicalAcpm } from '../src/acpm/acpm.canonical';
import { createHash } from 'node:crypto';
import type { AcpmEvent } from '@agm/shared';

const at = '2026-11-16T10:00:00.000Z';
const event = (patch: Partial<AcpmEvent> = {}): AcpmEvent => ({ eventId:'11111111-1111-4111-8111-111111111111',
  chainId:'chain-1', mandateId:'mandate-1', runId:'run-1', componentId:'agent-alpha', componentKind:'AGENT',
  kind:'STARTED', sequence:1, occurredAt:'2026-11-16T09:00:00.000Z', evidenceRef:'incident:case-42', source:'ACP', ...patch });
const end = (patch: Partial<AcpmEvent> = {}) => event({eventId:'22222222-2222-4222-8222-222222222222',kind:'COMPLETED',sequence:2,occurredAt:'2026-11-16T09:00:01.000Z',...patch});
describe('ACPM derived semantic index (synthetic fixtures, no model calls)', () => {
  it('accepts Romanian inflected facet nouns without hiding an exact agent match',()=>{
    const i=new AcpmSemanticIndex('a');i.sync([event(),end()],at);
    expect(i.search({q:'execuțiile agentului agent-alpha',agent:'agent-alpha'}).total).toBe(2);
  });
  it('retrieves Romanian/English concepts with exact agent, model, mandate and incident evidence', () => {
    const index=new AcpmSemanticIndex('tenant-a');
    index.sync([event(),end({kind:'BLOCKED',model:{provider:'fixture',name:'model-a',version:'v1'},block:{classification:'JUSTIFIED',reason:'Aprobarea lipsește',decisionRef:'incident:case-42'}})],at);
    const result=index.search({q:'Arată blocajele justificate',agent:'agent-alpha',model:'model-a',mandate:'mandate-1',incident:'case-42'});
    expect(result.total).toBe(1);expect(result.results[0].provenance.evidenceRef).toBe('incident:case-42');
    expect(index.search({q:'show unjustified blocks'}).total).toBe(0);
    expect(index.search({q:'show justified blocks'}).total).toBe(1);
    expect(index.search({incident:'not-recorded'}).total).toBe(0);
  });
  it('indexes incrementally, accepts late arrivals and rebuilds the same stable IDs without mutating history', () => {
    const index=new AcpmSemanticIndex('a'), events=[event(),end()], original=JSON.stringify(events);
    index.sync([end()],at);const update=index.sync(events,at);
    expect(update.added).toBe(1);expect(update.reused).toBe(1);
    const rebuilt=new AcpmSemanticIndex('a');rebuilt.sync(events.slice().reverse(),at);
    expect(index.status().documentSetHash).toBe(rebuilt.status().documentSetHash);
    expect(JSON.stringify(events)).toBe(original);
    const other=new AcpmSemanticIndex('b');other.sync(events,at);
    expect(other.search().results[0].id).not.toBe(index.search().results[0].id);
  });
  it('rejects changed source IDs atomically and does not replace accepted evidence', () => {
    const index=new AcpmSemanticIndex('a');index.sync([event()],at);const before=index.status();
    expect(()=>index.sync([event({kind:'FAILED'})],at)).toThrow('SOURCE_CONFLICT');
    expect(index.status()).toEqual(before);
  });
  it('retains correction history, excludes superseded search hits by default', () => {
    const index=new AcpmSemanticIndex('a');index.sync([event(),end(),end({eventId:'correction',supersedesEventId:end().eventId,correctionReason:'Canonical correction',kind:'FAILED'})],at);
    expect(index.search({q:'completed'}).total).toBe(0);
    expect(index.search({q:'completed',includeHistory:true}).total).toBe(1);
    expect(index.chain('chain-1').snapshot.corrections).toHaveLength(1);
  });
  it('recovers a complete observed chain and marks missing parent/truncated evidence as PARTIAL', () => {
    const index=new AcpmSemanticIndex('a');index.sync([event(),end()],at);
    expect(index.chain('chain-1').completeness).toBe('COMPLETE_OBSERVED_CHAIN');
    index.sync([event(),end()],at,true);expect(index.chain('chain-1').completeness).toBe('PARTIAL');
    const missing=new AcpmSemanticIndex('a');missing.sync([event({parentEventId:'missing'}),end()],at);
    expect(missing.chain('chain-1').missingParents).toHaveLength(1);
    expect(missing.chain('absent').completeness).toBe('UNKNOWN');
  });
  it('reports explicit pause and stale telemetry without inventing interruption or model identity', () => {
    const index=new AcpmSemanticIndex('a');index.sync([event({model:{provider:'fixture',name:'model-a',version:'reported'}}),end({kind:'SUSPENDED'})],at);
    expect(index.search({q:'opriri'}).total).toBe(1);
    expect(index.modelState('model-a').demonstratedProviderModel).toBeNull();
    expect(index.modelState('gpt-6-luna').verdict).toBe('UNKNOWN');
    expect(index.search().results.some(r=>r.missingMetadata.includes('model'))).toBe(true);
  });
  it('compares only complete equivalent workloads with sufficient samples', () => {
    const events:AcpmEvent[]=[];
    for(const name of ['a','b'])for(let i=0;i<3;i++) {
      const identity={runId:`${name}${i}`,chainId:`${name}${i}`,model:{provider:'fixture',name,version:'v1'},workload:{equivalenceKey:'same',protocolVersion:'v1',environment:'test',configurationHash:'a'.repeat(64)}};
      events.push(event({...identity,eventId:`${name}${i}s`}),end({...identity,eventId:`${name}${i}e`}));
    }
    const index=new AcpmSemanticIndex('a');index.sync(events,at);
    // Full-chain projection shares the canonical comparison engine; no rankings across filtered models.
    const sameChain=events.map(e=>({...e,chainId:'comparison'}));const c=new AcpmSemanticIndex('a');c.sync(sameChain,at);
    expect(c.chain('comparison').snapshot.comparisons[0].comparable).toBe(true);
    const different=sameChain.map(e=>e.model!.name==='b'?{...e,workload:{...e.workload!,environment:'other'}}:e);
    const d=new AcpmSemanticIndex('a');d.sync(different,at);
    expect(d.chain('comparison').snapshot.comparisons.every(x=>!x.comparable)).toBe(true);
  });
  it('keeps all semantic routes behind the existing JWT guard', () => {
    expect(Reflect.getMetadata('__guards__',AcpmController)).toContain(JwtAuthGuard);
  });
  it('enforces OWNER before any semantic read and detects stored hash mismatch', async () => {
    const payload=event(), digest=createHash('sha256').update(canonicalAcpm(payload)).digest('hex');
    const query=jest.fn(async()=>[{payload,payloadHash:digest,recordedAt:new Date(at)}]);
    const prisma={$transaction:async(fn:Function)=>fn({$executeRaw:async()=>0,$queryRaw:(strings:TemplateStringsArray,...values:unknown[])=>strings.join('').includes('AgentChainPerformanceEvent')?query():[]})};
    const service=new AcpmService(prisma as never);const ctx={companyId:'a',userId:'u',roles:[],requestId:'r',correlationId:'c'};
    await expect(service.semanticSearch(ctx,{})).rejects.toThrow('ACP_OWNER_REQUIRED');expect(query).not.toHaveBeenCalled();
    const allowed={...ctx,roles:['company_owner']};await expect(service.semanticSearch(allowed,{})).resolves.toMatchObject({total:1});
    query.mockResolvedValueOnce([{payload,payloadHash:'bad',recordedAt:new Date(at)}]);
    await expect(service.semanticSearch(allowed,{})).rejects.toThrow('HASH_MISMATCH');
  });
  it('validates query bounds',()=>{const i=new AcpmSemanticIndex('a');i.sync([],at);expect(()=>i.search({limit:101})).toThrow();expect(()=>i.search({q:'x'.repeat(501)})).toThrow();});
  it('reuses the existing semantic engine for cross-language domain concepts',()=>{
    const i=new AcpmSemanticIndex('a');i.sync([event({evidenceRef:'evidence:approval-needed'})],at);
    expect(i.search({q:'aprobare'}).total).toBe(1);
    expect(i.status().sharedEngine).toBe('agmatcc-semantic-hash-v1');
    expect(i.search({q:'aprobare'}).results[0].score).toBeGreaterThan(0);
  });
  it('preserves terminal context when only STARTED identifies the model',()=>{
    const i=new AcpmSemanticIndex('a');i.sync([event({model:{provider:'fixture',name:'a',version:'v'}}),end()],at);
    expect(i.modelState('a').runs[0]).toMatchObject({status:'COMPLETED',wallMs:1000,complete:true});
  });
  it('reports stale open execution as unobserved telemetry, not a fabricated failure',()=>{
    const i=new AcpmSemanticIndex('a');i.sync([event({model:{provider:'fixture',name:'a',version:'v'}})],at);
    const state=i.modelState('a');expect(state.signals.some(s=>s.kind==='TELEMETRY_STALE')).toBe(true);
    expect(state.runs[0].status).toBe('ACTIVE');expect(state.inactivity).toContain('UNKNOWN');
  });
  it('follows explicit cross-agent handoff and exposes missing acceptance',()=>{
    const handoff=end({kind:'HANDOFF',targetComponentId:'agent-beta'});
    const transferred=event({eventId:'beta-start',componentId:'agent-beta',runId:'beta-run',parentEventId:handoff.eventId,occurredAt:'2026-11-16T09:00:02.000Z'});
    const i=new AcpmSemanticIndex('a');i.sync([event(),handoff],at);
    expect(i.chain('chain-1').snapshot.transfers[0].acceptedByEventId).toBeNull();
    i.sync([event(),handoff,transferred],at);
    expect(i.chain('chain-1').snapshot.transfers[0].acceptedByEventId).toBe('beta-start');
    expect(i.chain('chain-1').completeness).toBe('PARTIAL');
  });
  it('separates tenant caches and rechecks role on every cached request',async()=>{
    const rows=(company:string)=>{const payload=event({componentId:company});return [{payload,payloadHash:createHash('sha256').update(canonicalAcpm(payload)).digest('hex'),recordedAt:new Date(at)}];};
    const prisma={$transaction:async(fn:Function)=>fn({$executeRaw:async()=>0,$queryRaw:(strings:TemplateStringsArray,company:string)=>strings.join('').includes('AgentChainPerformanceEvent')?rows(company):[]})};
    const s=new AcpmService(prisma as never),ctx={companyId:'tenant-a',userId:'u',roles:['OWNER'],requestId:'r',correlationId:'c'};
    const a=await s.semanticSearch(ctx,{}),b=await s.semanticSearch({...ctx,companyId:'tenant-b'},{});
    expect(a.results[0].labels.agent).toBe('tenant-a');expect(b.results[0].labels.agent).toBe('tenant-b');
    await expect(s.semanticSearch({...ctx,roles:[]},{})).rejects.toThrow('ACP_OWNER_REQUIRED');
    const rebuilt=await s.semanticSearch(ctx,{},true);expect(rebuilt.documentSetHash).toBe(a.documentSetHash);
    expect(rebuilt.registryDeclarations.some(d=>d.componentId==='chief-monitoring-inspector')).toBe(true);
  });
});
