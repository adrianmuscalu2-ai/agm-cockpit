import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CapabilityBroker } from '../src/premium-capabilities/capability.broker';
import { ActionConfirmationStore } from '../src/premium-capabilities/action-confirmation';
import { createActionPreview, previewChanged } from '../src/premium-capabilities/action-preview';
import { CommunicationHandoffGateway } from '../src/premium-capabilities/communication-handoff.gateway';
import type { HandoffPort } from '../src/capabilities/handoff/handoff.port';

const scope={productId:'agm-cockpit' as const,moduleId:'premium-copilot',tenantId:'tenant-a',subjectId:'user-a',premiumEntitled:true,conversationId:'voice-c1',requestedAt:new Date().toISOString()};
const broker=new CapabilityBroker();
assert.equal((await broker.prepare({...scope,requestId:'unknown',capabilityId:'SEND_SMS',parameters:{recipient:'+49123',body:'x'}})).status,'DENIED');
assert.equal((await broker.prepare({...scope,requestId:'email-missing',capabilityId:'SEND_EMAIL',parameters:{body:'Status'}})).status,'NEEDS_INPUT');
const email=await broker.prepare({...scope,requestId:'email-1',capabilityId:'SEND_EMAIL',parameters:{recipient:'dispatch@example.test',subject:'Status',body:'Sosire la 18:00'}});
assert.equal(email.status,'PREVIEW_READY'); if(email.status!=='PREVIEW_READY')throw new Error('email preview');
assert.equal(email.preview.executionMode,'PROVIDER_HANDOFF'); assert.equal(email.preview.actionType,'EMAIL');

const store=new ActionConfirmationStore(); store.setPreview(email.preview);
const touch=store.confirm({confirmationId:email.preview.confirmationId,previewVersion:1,contentHash:email.preview.contentHash,method:'TOUCH'}); assert.equal(touch.status,'CONFIRMED');
const memory=new Map<string,string>(); const storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>void memory.set(k,v)};
let handoffs=0; const port:HandoffPort={platform:'android',composeEmail:async()=>{handoffs++},share:async()=>{handoffs++}};
const gateway=new CommunicationHandoffGateway(storage as Storage,port,()=>true);
await assert.rejects(()=>gateway.open(email.preview,touch.status==='CONFIRMED'?touch.confirmation:null as never),/VERBAL_CONFIRMATION_REQUIRED/);

store.setPreview(email.preview); const voice=store.confirm({confirmationId:email.preview.confirmationId,previewVersion:1,contentHash:email.preview.contentHash,method:'VOICE'}); assert.equal(voice.status,'CONFIRMED');
if(voice.status!=='CONFIRMED')throw new Error('voice confirmation');
const receipt=await gateway.open(email.preview,voice.confirmation); assert.equal(receipt.status,'OPENED'); assert.equal(handoffs,1); assert.ok(receipt.receiptId);
const replay=await gateway.open(email.preview,voice.confirmation); assert.equal(replay.receiptId,receipt.receiptId); assert.equal(handoffs,1);

const changed=await createActionPreview({...scope,requestId:'email-2',capabilityId:'SEND_EMAIL',parameters:{recipient:'other@example.test',subject:'Status',body:'Sosire la 19:00'}},2);
assert.equal(previewChanged(email.preview,changed),true); assert.notEqual(changed.contentHash,email.preview.contentHash);
store.setPreview(changed); assert.equal(store.confirm({confirmationId:changed.confirmationId,previewVersion:2,contentHash:email.preview.contentHash,method:'VOICE'}).status,'DENIED');

const expired={...changed,expiresAt:new Date(Date.now()-1).toISOString()}; store.setPreview(expired); assert.equal(store.confirm({confirmationId:expired.confirmationId,previewVersion:2,contentHash:expired.contentHash,method:'VOICE'}).status,'DENIED');
const whatsapp=await broker.prepare({...scope,requestId:'wa-1',capabilityId:'SEND_WHATSAPP',parameters:{recipient:'+49 7131 555555',body:'Am ajuns'}}); assert.equal(whatsapp.status,'PREVIEW_READY');
if(whatsapp.status!=='PREVIEW_READY')throw new Error('WhatsApp preview');
const offlineStore=new ActionConfirmationStore();offlineStore.setPreview(whatsapp.preview);const waConfirm=offlineStore.confirm({confirmationId:whatsapp.preview.confirmationId,previewVersion:1,contentHash:whatsapp.preview.contentHash,method:'VOICE'});if(waConfirm.status!=='CONFIRMED')throw new Error('WhatsApp confirmation');
const offline=new CommunicationHandoffGateway(storage as Storage,port,()=>false);const offlineReceipt=await offline.open(whatsapp.preview,waConfirm.confirmation);assert.equal(offlineReceipt.status,'FAILED');assert.equal(handoffs,1);
const recovered=new CommunicationHandoffGateway(storage as Storage,port,()=>true);const recoveredReceipt=await recovered.open(whatsapp.preview,waConfirm.confirmation);assert.equal(recoveredReceipt.status,'OPENED');assert.equal(handoffs,2);
assert.ok(broker.auditSnapshot().some(entry=>entry.capabilityId==='SEND_EMAIL'&&entry.stage==='PREVIEW'));assert.ok(broker.auditSnapshot().every(entry=>!JSON.stringify(entry).includes('dispatch@example.test')));
const manifest=readFileSync(new URL('../android/app/src/main/AndroidManifest.xml',import.meta.url),'utf8');for(const forbidden of ['ACCESS_COARSE_LOCATION','READ_CONTACTS','ACCESS_BACKGROUND_LOCATION','READ_CALL_LOG','READ_SMS','BIND_NOTIFICATION_LISTENER_SERVICE','READ_EXTERNAL_STORAGE'])assert.equal(manifest.includes(forbidden),false);
console.log('AGMA Wave 2B contract tests PASS');
