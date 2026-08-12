import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basicLanguageCodes } from '../src/language-registry';
import { createOperationalCase, transitionOperationalCase } from '../src/premium-situation-router/operational-case.machine';
import { roadControlCopy } from '../src/premium-situation-router/road-control.i18n';
import { authorizedSituationRegistry, executableSituationIds } from '../src/premium-situation-router/situation.registry';
import { applyRoadControlSyncResult, enqueueRoadControlTransition, flushRoadControlTransitions, pendingRoadControlTransitions } from '../src/premium-situation-router/road-control.sync';
import type { OperationalCase } from '../src/premium-situation-router/situation-router.types';

assert.deepEqual(executableSituationIds.slice(0,2),['required-document','road-control']);
assert.equal(authorizedSituationRegistry['road-control'].hub,'AFTER_DEPARTURE');

let value=createOperationalCase('road-1','road-control','ro','2026-08-11T18:00:00.000Z');
value=transitionOperationalCase(value,{type:'CONFIRM_SAFE_INTERACTION',safe:false});
assert.equal(value.state,'SAFETY_GATE');
assert.equal(value.data.safeToInteract,false);
const locked=transitionOperationalCase(value,{type:'ADVANCE'});
assert.equal(locked,value);

value=transitionOperationalCase(value,{type:'CONFIRM_SAFE_INTERACTION',safe:true});
assert.equal(value.activeStep,'safe-stop');
const beforeStop=transitionOperationalCase(value,{type:'ADD_EVIDENCE',evidence:{id:'x',kind:'original',sha256:'x'}});
assert.equal(beforeStop,value);
value=transitionOperationalCase(value,{type:'CONFIRM_SAFE_STOP'});
assert.equal(value.data.safelyStopped,true);
value=transitionOperationalCase(value,{type:'SET_DATA',values:{requestType:'document'}});
value=transitionOperationalCase(value,{type:'ADD_EVIDENCE',evidence:{id:'original',kind:'original',sha256:'original'}});
value=transitionOperationalCase(value,{type:'ADD_EVIDENCE',evidence:{id:'ocr',kind:'ocr-proposal',sha256:'ocr',sourceId:'original',sourceSha256:'original',initialText:'CMR'}});
value=transitionOperationalCase(value,{type:'ADD_EVIDENCE',evidence:{id:'human',kind:'human-confirmation',sha256:'human',sourceId:'ocr',sourceSha256:'ocr',confirmedText:'CMR',confirmedAt:'2026-08-11T18:01:00.000Z',confirmedBy:'owner'}});
assert.equal(value.evidence.length,3);
value=transitionOperationalCase(value,{type:'PREPARE_EXTERNAL',effect:{operationId:'road-1:email',channel:'email'}});
assert.equal(value.externalEffects[0].phase,'PREPARED');
value=transitionOperationalCase(value,{type:'CONFIRM_EXTERNAL',operationId:'road-1:email'});
assert.equal(value.externalEffects[0].phase,'HUMAN_CONFIRMED');
const duplicate=transitionOperationalCase(value,{type:'PREPARE_EXTERNAL',effect:{operationId:'road-1:email',channel:'email'}});
assert.equal(duplicate,value);
value=transitionOperationalCase(value,{type:'SET_DISPOSITION',disposition:'FOLLOW_UP_REQUIRED'});
assert.equal(value.state,'FOLLOW_UP_REQUIRED');

const requiredKeys=Object.keys(roadControlCopy.en) as (keyof typeof roadControlCopy.en)[];
for(const language of basicLanguageCodes){
  assert.deepEqual(Object.keys(roadControlCopy[language]),requiredKeys,`${language} semantic keys`);
  for(const key of requiredKeys)assert.ok(roadControlCopy[language][key].trim().length>0,`${language}.${key}`);
}

const component=readFileSync(new URL('../src/premium-situation-router/road-control.component.ts',import.meta.url),'utf8');
assert.match(component,/CONFIRM_SAFE_INTERACTION/);
assert.match(component,/CONFIRM_SAFE_STOP/);
assert.match(component,/PREPARE_EXTERNAL/);
assert.match(component,/CONFIRM_EXTERNAL/);
assert.match(component,/SET_DISPOSITION/);
assert.match(component,/tel:112/);
assert.doesNotMatch(component,/incident|breakdown|fatigue|cargo|weather/);
assert.doesNotMatch(component,/MARK_SENT|RECORD_RECEIPT/);

function memory(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>void values.set(key,value),removeItem:(key:string)=>void values.delete(key)};}
const storage=memory();
let offline=createOperationalCase('22222222-2222-4222-8222-222222222222','road-control','ro','2026-08-11T18:00:00.000Z');
offline=transitionOperationalCase(offline,{type:'CONFIRM_SAFE_INTERACTION',safe:true});
await enqueueRoadControlTransition(storage as Storage,offline,false);
offline=transitionOperationalCase(offline,{type:'CONFIRM_SAFE_STOP'});
await enqueueRoadControlTransition(storage as Storage,offline,false);
offline=transitionOperationalCase(offline,{type:'PREPARE_EXTERNAL',effect:{operationId:`road-control:${offline.id}:email`,channel:'email'}});
await enqueueRoadControlTransition(storage as Storage,offline,false);
offline=transitionOperationalCase(offline,{type:'CONFIRM_EXTERNAL',operationId:`road-control:${offline.id}:email`});
await enqueueRoadControlTransition(storage as Storage,offline,false);
let queued=await pendingRoadControlTransitions(storage as Storage);
assert.deepEqual(queued.map(event=>event.payload.caseRevision),[1,2,3,4]);
assert.equal((queued.at(-1)?.payload.caseSnapshot as OperationalCase).externalEffects[0].phase,'HUMAN_CONFIRMED');
assert.equal(queued.some(event=>JSON.stringify(event).includes('MARK_SENT')||JSON.stringify(event).includes('RECORD_RECEIPT')),false);
// A fresh adapter over the same durable storage models refresh/restart recovery.
assert.equal((await pendingRoadControlTransitions(storage as Storage)).length,4);
let calls=0;const receipts=new Set<string>();
const server={async sync(items:any[]){calls+=1;return {results:items.map(({event}:any)=>{const duplicate=receipts.has(event.eventId);receipts.add(event.eventId);return {eventId:event.eventId,status:duplicate?'duplicate':'acknowledged',serverVersion:event.aggregateVersion};}),projections:[]};},async read(){return {serverVersion:0,events:[],projection:null};}};
const flushed=await flushRoadControlTransitions({storage:storage as Storage,server});
assert.equal(flushed.status,'synchronized');assert.equal((await pendingRoadControlTransitions(storage as Storage)).length,0);
const callsAfterReceipt=calls;assert.equal((await flushRoadControlTransitions({storage:storage as Storage,server})).status,'idle');assert.equal(calls,callsAfterReceipt);
assert.equal((await enqueueRoadControlTransition(storage as Storage,offline,true)).status,'duplicate');
assert.equal((await pendingRoadControlTransitions(storage as Storage)).length,0);
offline=transitionOperationalCase(offline,{type:'SET_DATA',values:{notes:'conflict'}});await enqueueRoadControlTransition(storage as Storage,offline,true);
const conflictServer={async sync(items:any[]){return {results:items.map(({event}:any)=>({eventId:event.eventId,status:'conflict',serverVersion:99})),projections:[]};},async read(){return {serverVersion:99,events:[],projection:null};}};
const conflict=await flushRoadControlTransitions({storage:storage as Storage,server:conflictServer});
assert.equal(applyRoadControlSyncResult(offline,conflict).state,'RECOVERY_REQUIRED');

console.log('Vertical Slice B road-control foundation, safety, evidence, PREPARE/HUMAN CONFIRM, outbox/order/restart/reconnect/dedup/conflict and i18n 9/9: PASS');
