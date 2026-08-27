import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeCopilotIntent } from '../src/premium-copilot/copilot.contract';
import { ConversationalRoutingLedger, selectConversationalCapability } from '../src/premium-capabilities/conversational-routing';

const cases = [
  ['Sună la +49 7131 555555', 'OPEN_DIALER'],
  ['Deschide navigația spre Heilbronn', 'OPEN_MAPS'],
  ['Trimite email dispatch@example.test: sosesc la 18', 'SEND_EMAIL'],
  ['WhatsApp +49 7131 555555: sosesc la 18', 'SEND_WHATSAPP'],
] as const;
for (const [text, expected] of cases) {
  const decision = routeCopilotIntent(text);
  const selection = selectConversationalCapability(decision, text, true);
  assert.equal(selection.status, 'SELECTED');
  if (selection.status === 'SELECTED') assert.equal(selection.capabilityId, expected);
}
assert.equal(selectConversationalCapability(routeCopilotIntent('Fotografiază documentul CMR'), 'Fotografiază documentul CMR', true).status, 'DENIED');
assert.equal(selectConversationalCapability(routeCopilotIntent('Trimite un mesaj'), 'Trimite un mesaj', false).status, 'DENIED');
assert.equal(selectConversationalCapability(routeCopilotIntent('Cum este vremea?'), 'Cum este vremea?', true).status, 'CONVERSATION_ONLY');

const memory = new Map<string,string>();
const storage = { getItem:(key:string)=>memory.get(key)??null, setItem:(key:string,value:string)=>void memory.set(key,value) };
const ledger = new ConversationalRoutingLedger(storage as Storage);
ledger.record({conversationId:'voice-current',intent:'PHONE',stage:'INTENT_IDENTIFIED',outcome:'HIGH'});
ledger.record({conversationId:'voice-current',requestId:'r1',intent:'PHONE',capabilityId:'OPEN_DIALER',stage:'CAPABILITY_SELECTED',outcome:'ALLOWLIST_MATCH'});
ledger.record({conversationId:'voice-current',requestId:'r1',intent:'PHONE',capabilityId:'OPEN_DIALER',stage:'PREVIEW_PRESENTED',outcome:'AWAITING_CONFIRMATION'});
ledger.record({conversationId:'voice-current',requestId:'r1',intent:'PHONE',capabilityId:'OPEN_DIALER',stage:'CANCELLED',outcome:'USER_CANCELLED'});
ledger.record({conversationId:'voice-current',intent:'PHONE',stage:'CONVERSATION_RESUMED',outcome:'AFTER_CANCEL'});
assert.deepEqual(ledger.snapshot().map(event=>event.stage),['INTENT_IDENTIFIED','CAPABILITY_SELECTED','PREVIEW_PRESENTED','CANCELLED','CONVERSATION_RESUMED']);
assert.ok(ledger.snapshot().every(event=>event.conversationId==='voice-current'));

const manifest=readFileSync(new URL('../android/app/src/main/AndroidManifest.xml',import.meta.url),'utf8');
for(const forbidden of ['ACCESS_COARSE_LOCATION','READ_CONTACTS','ACCESS_BACKGROUND_LOCATION','READ_CALL_LOG','READ_SMS','BIND_NOTIFICATION_LISTENER_SERVICE','READ_EXTERNAL_STORAGE']) assert.equal(manifest.includes(forbidden),false);
console.log('AGMA Wave 2D conversational routing contract tests PASS');
