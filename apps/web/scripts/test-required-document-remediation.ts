import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basicLanguageCodes } from '../src/language-registry';
import { createOperationalCase, transitionOperationalCase } from '../src/premium-situation-router/operational-case.machine';
import { requiredDocumentCopy } from '../src/premium-situation-router/required-document.i18n';
import { preDepartureCopy } from '../src/pre-departure/pre-departure.i18n';
import { applyRequiredDocumentSyncResult, enqueueRequiredDocumentTransition, flushRequiredDocumentTransitions, pendingRequiredDocumentTransitions } from '../src/premium-situation-router/required-document.sync';

function memory(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>void values.set(key,value),removeItem:(key:string)=>void values.delete(key)};}
const storage=memory();
let value=createOperationalCase('11111111-1111-4111-8111-111111111111','required-document','ro','2026-08-10T02:00:00.000Z');
value=transitionOperationalCase(value,{type:'SET_DATA',values:{documentType:'cmr',syncStatus:'SYNC_PENDING'}});
const first=await enqueueRequiredDocumentTransition(storage as Storage,value,false);
assert.equal(first.status,'pending');
let pending=(await pendingRequiredDocumentTransitions(storage as Storage)).filter((event)=>event.moduleId==='premium-required-document');
assert.equal(pending.length,1);assert.equal(pending[0].operationId,pending[0].eventId);assert.equal(pending[0].payload.caseRevision,value.revision);

value=transitionOperationalCase(value,{type:'SET_DATA',values:{available:true,syncStatus:'SYNC_PENDING'}});
await enqueueRequiredDocumentTransition(storage as Storage,value,false);
pending=(await pendingRequiredDocumentTransitions(storage as Storage)).filter((event)=>event.moduleId==='premium-required-document');
assert.deepEqual(pending.map((event)=>event.payload.caseRevision),[1,2]);

// Refresh/restart uses a new adapter over the same durable storage.
assert.equal((await pendingRequiredDocumentTransitions(storage as Storage)).filter((event)=>event.moduleId==='premium-required-document').length,2);

let syncCalls=0;const receipts=new Set<string>();
const server={async sync(items:any[]){syncCalls+=1;return {results:items.map(({event}:any)=>{const duplicate=receipts.has(event.eventId);receipts.add(event.eventId);return {eventId:event.eventId,status:duplicate?'duplicate':'acknowledged',serverVersion:event.aggregateVersion};}),projections:[]};},async read(){return {serverVersion:0,events:[],projection:null};}};
const synced=await flushRequiredDocumentTransitions({storage:storage as Storage,value,server});
assert.equal(synced.status,'synchronized');assert.equal((await pendingRequiredDocumentTransitions(storage as Storage)).length,0);
const afterReceiptCalls=syncCalls;
assert.equal((await flushRequiredDocumentTransitions({storage:storage as Storage,value,server})).status,'idle');assert.equal(syncCalls,afterReceiptCalls);

// Same deterministic operation after receipt is not queued again.
assert.equal((await enqueueRequiredDocumentTransition(storage as Storage,value,true)).status,'duplicate');
assert.equal((await pendingRequiredDocumentTransitions(storage as Storage)).length,0);

value=transitionOperationalCase(value,{type:'SET_DATA',values:{readable:false,syncStatus:'SYNC_PENDING'}});
await enqueueRequiredDocumentTransition(storage as Storage,value,true);
const conflictServer={async sync(items:any[]){return {results:items.map(({event}:any)=>({eventId:event.eventId,status:'conflict',serverVersion:99,reason:'STREAM_VERSION_CONFLICT'})),projections:[]};},async read(){return {serverVersion:99,events:[],projection:null};}};
const conflict=await flushRequiredDocumentTransitions({storage:storage as Storage,value,server:conflictServer});
assert.equal(conflict.status,'conflict');
const recovered=applyRequiredDocumentSyncResult(value,conflict);assert.equal(recovered.state,'RECOVERY_REQUIRED');assert.equal(recovered.data.syncStatus,'RECOVERY_REQUIRED');

const statusKeys=['ocrStarted','ocrFailed','ocrUnavailable','cameraDenied','cameraUnavailable','invalidImport','unsupportedFile','originalMissing','originalChanged','storageFailed','syncPending','reconnecting','syncConflict','recoveryRequired'] as const;
for(const language of basicLanguageCodes)for(const key of statusKeys)assert.equal(typeof requiredDocumentCopy[language][key]==='string'&&requiredDocumentCopy[language][key].trim().length>0,true,`${language}.${key}`);
for(const language of basicLanguageCodes.filter((value)=>value!=='en')) {
  assert.notEqual(preDepartureCopy[language].issueRegisterTitle,preDepartureCopy.en.issueRegisterTitle,`${language}.issueRegisterTitle must not fall back to English`);
  assert.notEqual(preDepartureCopy[language].issueRegisterEmpty,preDepartureCopy.en.issueRegisterEmpty,`${language}.issueRegisterEmpty must not fall back to English`);
}
const component=readFileSync(new URL('../src/premium-situation-router/required-document.component.ts',import.meta.url),'utf8');
assert.doesNotMatch(component,/alert\s*\(/);assert.doesNotMatch(component,/>\s*(revision|OCR failed|Camera unavailable)\s*</i);
assert.match(component,/d\.documentType==='cmr'\?'selected'/);
assert.match(component,/verified\.reason}\);next=transitionOperationalCase\(next,\{type:'SET_DATA',values:\{flowStatus:null}}\)/);
const preDepartureController=readFileSync(new URL('../src/pre-departure/pre-departure.controller.ts',import.meta.url),'utf8');
const preDepartureI18n=readFileSync(new URL('../src/pre-departure/pre-departure.i18n.ts',import.meta.url),'utf8');
const preDepartureShell=readFileSync(new URL('../src/pre-departure/pre-departure.shell.ts',import.meta.url),'utf8');
assert.match(preDepartureController,/document\.documentElement\.lang = language/);
assert.match(preDepartureI18n,/Faqja mund të ringarkohet/);
assert.doesNotMatch(preDepartureShell,/WhatsApp Share/);
console.log('Slice A limited remediation: outbox/order/restart/reconnect/dedup/conflict/i18n/hardcoded audit PASS');
