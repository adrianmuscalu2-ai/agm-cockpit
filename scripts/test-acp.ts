import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { projectAcp, type AcpEvent } from '../packages/shared/src/agent-chain-performance';
const cases: string[]=[];
const t=(n:number)=>new Date(Date.UTC(2026,10,15,0,0,n)).toISOString();
const event=(kind:AcpEvent['kind'],sequence:number,second:number,overrides:Partial<AcpEvent>={}):AcpEvent=>({eventId:`fixture-${sequence}`,chainId:'test-chain',mandateId:'test-mandate',runId:'test-run',componentId:'test-agent',componentKind:'AGENT',kind,sequence,occurredAt:t(second),evidenceRef:'fixture:not-operational',source:'ACP',...overrides});
function test(name:string,fn:()=>void){fn();cases.push(name);}
test('active vs suspended duration, justified block is not failure',()=>{
 const r=projectAcp([event('STARTED',1,0),event('BLOCKED',2,3,{block:{classification:'JUSTIFIED',reason:'Guardian protection',decisionRef:'fixture-decision'}}),event('RESUMED',3,8),event('COMPLETED',4,10)],t(11));
 assert.equal(r.runs[0].activeMs,5000);assert.equal(r.runs[0].suspendedMs,5000);assert.equal(r.runs[0].wallMs,10000);assert.equal(r.signals.length,0);assert.equal(r.blocks[0].classification,'JUSTIFIED');
});
test('unknown blockers never become unjustified by inference',()=>assert.equal(projectAcp([event('STARTED',1,0),event('BLOCKED',2,1)],t(2)).blocks[0].classification,'UNREVIEWED'));
test('append-only correction preserves original and updates projection',()=>{
 const original=event('BLOCKED',2,1);
 const corrected={...original,eventId:'correction',supersedesEventId:original.eventId,correctionReason:'Recorded decision received',block:{classification:'JUSTIFIED' as const,reason:'Protection',decisionRef:'fixture-decision'}};
 const r=projectAcp([event('STARTED',1,0),original,corrected],t(2));
 assert.equal(r.blocks.length,1);assert.equal(r.blocks[0].classification,'JUSTIFIED');assert.equal(r.corrections[0].original.eventId,original.eventId);assert.equal(r.issues.length,0);
 assert.equal(projectAcp([corrected],t(2)).issues.length,1);
});
test('legacy cannot fabricate active durations',()=>assert.equal(projectAcp([event('STARTED',1,0,{source:'LEGACY'}),event('COMPLETED',2,3,{source:'LEGACY'})],t(4)).runs[0].activeMs,null));
test('gaps and invalid resumes invalidate metrics',()=>{
 assert.equal(projectAcp([event('STARTED',1,0),event('COMPLETED',3,3)],t(4)).runs[0].activeMs,null);
 assert.equal(projectAcp([event('STARTED',1,0),event('RESUMED',2,1),event('COMPLETED',3,3)],t(4)).runs[0].complete,false);
});
test('duplicate idempotence and conflicting duplicates',()=>{
 const e=event('STARTED',1,0);assert.equal(projectAcp([e,e],t(1)).runs[0].events.length,1);
 assert.equal(projectAcp([e,{...e,mandateId:'other'}],t(1)).runs[0].activeMs,null);
});
test('truncation, reversed time and future time cannot certify',()=>{
 assert.equal(projectAcp([event('STARTED',1,0)],t(1),true).runs[0].activeMs,null);
 assert.equal(projectAcp([event('STARTED',1,2),event('COMPLETED',2,1)],t(3)).runs[0].activeMs,null);
 assert.equal(projectAcp([event('STARTED',1,3)],t(2)).issues.length,1);
});
test('handoff requires same-chain target acceptance',()=>{
 const input=[event('STARTED',1,0),event('HANDOFF',2,1,{targetComponentId:'inspector'}),event('STARTED',1,2,{eventId:'target-start',runId:'target',componentId:'inspector',componentKind:'INSPECTOR',parentEventId:'fixture-2'})];
 assert.equal(projectAcp(input,t(3)).transfers[0].acceptedByEventId,'target-start');
 input[2].chainId='different';assert.equal(projectAcp(input,t(3)).transfers[0].acceptedByEventId,null);
});
test('overload requires explicit consistent capacity',()=>{
 const a=event('STARTED',1,0,{capacity:1}),b=event('STARTED',1,0,{eventId:'second',runId:'second',capacity:1});
 assert.equal(projectAcp([a,b],t(1)).signals[0].kind,'OVERLOAD');
 delete a.capacity;delete b.capacity;assert.equal(projectAcp([a,b],t(1)).signals.length,0);
 (a as any).capacity=null;assert.equal(projectAcp([a,b],t(1)).signals.length,0);
});
test('stale open runs are not treated as current overload or measured active time',()=>{
 const r=projectAcp([event('STARTED',1,0,{capacity:1})],t(120));
 assert.equal(r.runs[0].activeMs,0);assert.equal(r.signals[0].kind,'TELEMETRY_STALE');
});
test('model comparison, equivalence and regression minimum samples',()=>{
 const events:AcpEvent[]=[];
 for(let i=0;i<9;i++){
  const metadata={runId:`r${i}`,model:{provider:'fixture',name:'model',version:i<6?'1':'2'},workload:{equivalenceKey:'same',protocolVersion:'1',environment:'isolated-fixture',configurationHash:'a'.repeat(64)}};
  events.push(event('STARTED',1,i*5,{...metadata,eventId:`s${i}`}));
  events.push(event('COMPLETED',2,i*5+(i>=3&&i<6?3:1),{...metadata,eventId:`e${i}`}));
 }
 const r=projectAcp(events,t(60));assert.equal(r.comparisons[0].comparable,true);assert.equal(r.signals.filter(s=>s.kind==='REGRESSION_CANDIDATE').length,1);
 for(const e of events)if(e.model?.version==='2')e.workload!.environment='different';
 assert.equal(projectAcp(events,t(60)).comparisons.some(c=>c.comparable),false);
});
mkdirSync('evidence/acp-20261115',{recursive:true});
writeFileSync('evidence/acp-20261115/unit-tests.json',JSON.stringify({at:new Date().toISOString(),dataClass:'SYNTHETIC_TEST_FIXTURES_NOT_OPERATIONAL_RESULTS',passed:cases},null,2));
console.log(`ACP unit tests: ${cases.length} passed (synthetic fixtures explicitly labelled)`);
