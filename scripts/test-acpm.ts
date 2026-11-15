import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { asAcpm, projectAcpm, selectAcpm, AcpmRecorder, type AcpmEvent } from '../packages/shared/src/acpm';
import { projectAcp } from '../packages/shared/src/agent-chain-performance';
import { AgentChainRecorder } from '../packages/shared/src/agent-chain-recorder';
import { projectAcp as frozenProjection } from '../evidence/acpm-20261115/baseline/packages/shared/src/agent-chain-performance';
const tests:string[]=[];
const at=(s:number)=>new Date(Date.UTC(2026,10,15,0,0,s)).toISOString();
const event=(kind:AcpmEvent['kind'],sequence:number,s:number,extra:Partial<AcpmEvent>={}):AcpmEvent=>({eventId:`fixture-${sequence}`,chainId:'fixture-chain',runId:'fixture-run',mandateId:'fixture-mandate',componentId:'fixture-agent',componentKind:'AGENT',departmentId:'fixture-department',source:'ACP',kind,sequence,occurredAt:at(s),evidenceRef:'fixture-not-operational',...extra});
const input=[event('STARTED',1,0),event('WORKING',2,2),event('SUSPENDED',3,3),event('RESUMED',4,7),event('COMPLETED',5,10)];
const check=(name:string,fn:()=>void)=>{fn();tests.push(name);};
check('legacy contract and identifiers retained',()=>{
 const old=projectAcp(input,at(15)),current=projectAcpm(input,at(15));
 assert.equal(old.contract,'agent-chain-performance.v1');assert.equal(current.contract,'agent-chain-performance-monitor.v1');assert.equal(current.module,'ACPM');
 assert.deepEqual(old.runs,current.runs);assert.equal(AgentChainRecorder,AcpmRecorder);
 assert.deepEqual(old,frozenProjection(input,at(15)));
});
check('individual selection and complete intervention history',()=>{
 const s=selectAcpm(projectAcpm(input,at(15)),{componentId:'fixture-agent'});
 assert.equal(s.runs.length,1);assert.deepEqual(s.chronology.map(e=>e.kind),['STARTED','WORKING','SUSPENDED','RESUMED','COMPLETED']);assert.equal(s.runs[0].activeMs,6000);
 assert.equal(selectAcpm(projectAcpm(input,at(15)),{componentId:'missing'}).runs.length,0);
});
check('department and kind filters use exact identities',()=>{
 assert.equal(selectAcpm(projectAcpm(input,at(15)),{departmentId:'fixture-department',kind:'AGENT'}).runs.length,1);
 assert.equal(selectAcpm(projectAcpm(input,at(15)),{kind:'ORCHESTRATOR'}).runs.length,0);
});
check('individual consultation retains cross-component handoff acceptance',()=>{
 const sender=[event('STARTED',1,0),event('HANDOFF',2,1,{targetComponentId:'fixture-inspector'})];
 const receiver=event('STARTED',1,2,{eventId:'receiver',runId:'receiver-run',componentId:'fixture-inspector',componentKind:'INSPECTOR',parentEventId:sender[1].eventId});
 const s=projectAcpm([...sender,receiver],at(3));
 assert.equal(selectAcpm(s,{componentId:'fixture-agent'}).transfers[0].acceptedByEventId,'receiver');
 assert.equal(selectAcpm(s,{componentId:'fixture-inspector'}).transfers[0].eventId,sender[1].eventId);
});
check('time windows retain context but exclude incomplete-window analytics',()=>{
 const source=projectAcpm(input,at(15));
 const s=selectAcpm(source,{from:at(4),to:at(8)});assert.equal(s.runs.length,1);assert.equal(s.chronology.length,5);assert.equal(s.evolution.length,0);
 assert.equal(selectAcpm(source,{from:at(11)}).runs.length,0);
 assert.throws(()=>selectAcpm(source,{from:at(10),to:at(1)}));assert.throws(()=>selectAcpm(source,{from:'invalid'}));
});
check('correction provenance and integrity problems survive filtering',()=>{
 const correction={...input[1],eventId:'correction',supersedesEventId:input[1].eventId,correctionReason:'fixture correction'};
 const s=selectAcpm(projectAcpm([...input,correction],at(15)),{});assert.equal(s.corrections[0].original.eventId,input[1].eventId);
 const invalid=projectAcpm([...input,{...input[0],mandateId:'conflict'}],at(15));
 assert.equal(selectAcpm(invalid,{}).runs[0].activeMs,null);
});
check('model comparisons and regression stay within selected component and window',()=>{
 const events:AcpmEvent[]=[];
 for(let i=0;i<9;i++){
  const meta={runId:`run${i}`,model:{provider:'fixture',name:'test',version:i<6?'v1':'v2'},workload:{equivalenceKey:'equivalent',protocolVersion:'1',environment:'fixture-only',configurationHash:'a'.repeat(64)}};
  events.push(event('STARTED',1,i*5,{...meta,eventId:`s${i}`}));events.push(event('COMPLETED',2,i*5+(i>=3&&i<6?3:1),{...meta,eventId:`e${i}`}));
 }
 const full=selectAcpm(projectAcpm(events,at(60)),{});assert.equal(full.comparisons[0].comparable,true);assert.equal(full.signals.some(s=>s.kind==='REGRESSION_CANDIDATE'),true);
 const narrowed=selectAcpm(projectAcpm(events,at(60)),{from:at(30)});assert.equal(narrowed.comparisons[0].comparable,false);assert.equal(narrowed.signals.some(s=>s.kind==='REGRESSION_CANDIDATE'),false);
});
// Reuse the already accepted source; no new production audit or manufactured events.
const historical=JSON.parse(readFileSync('evidence/acp-20261115/historical-replay.json','utf8'));
const bytes=readFileSync(historical.source);assert.equal(createHash('sha256').update(bytes).digest('hex'),historical.sha256);
let accountability:any;
function find(x:any):void{if(typeof x==='string'){try{find(JSON.parse(x));}catch{}return;}if(!x||typeof x!=='object')return;if(x.contractVersion==='agent-runtime-accountability.v2'&&x.agents)accountability=x;for(const v of Object.values(x))find(v);}
find(JSON.parse(bytes.toString('utf8')));assert.ok(accountability);
const snapshot=asAcpm({...historical.projection,inventory:accountability.agents.map((a:any)=>({componentId:a.identity,kind:a.kind,module:'UNAVAILABLE_IN_SNAPSHOT',supervisorId:null,observation:'HISTORICAL_LAST_EXECUTION_ONLY'}))});
check('real historical data keeps identity, provenance and missing coverage',()=>{
 assert.equal(snapshot.runs.length,27);assert.equal(snapshot.comparisons.length,0);
 const selected=selectAcpm(snapshot,{componentId:'premium.orchestrator'});assert.equal(selected.runs.length,1);assert.equal(selected.runs[0].activeMs,null);
 assert.ok(selectAcpm(snapshot,{kind:'INSPECTOR'}).runs.length>=2);
 assert.equal(selectAcpm(snapshot,{from:'2026-11-14T00:00:00Z'}).runs.length,0);
});
writeFileSync('evidence/acpm-20261115/historical-replay.json',JSON.stringify({dataClass:historical.dataClass,source:historical.source,sha256:historical.sha256,adaptation:historical.adaptation,inventoryProvenance:'Declared kind from same original accountability snapshot; no department inferred',projection:snapshot},null,2));
writeFileSync('evidence/acpm-20261115/selection-tests.json',JSON.stringify({at:new Date().toISOString(),passed:tests,fixtureBoundary:'First six checks use labelled synthetic fixtures; last check and historical replay use real archived observations'},null,2));
console.log(`ACPM selection/compatibility tests: ${tests.length} passed; 27 historical observations reused`);
