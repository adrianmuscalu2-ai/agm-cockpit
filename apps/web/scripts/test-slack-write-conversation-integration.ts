import assert from 'node:assert/strict';
import { SlackMessagePostConversation } from '../src/external-capabilities/slack-message-post.conversation';

let calls=0;const transport=async()=>{calls++;return{ok:true as const,ts:'dummy'}};
const missing=new SlackMessagePostConversation();assert.equal((await missing.dispatch(transport)).status,'DENIED');assert.equal(calls,0);
const ambiguous=new SlackMessagePostConversation();ambiguous.prepare('Draft','owner');assert.equal(ambiguous.confirm('yes').status,'DENIED');assert.equal(calls,0);
const cancelled=new SlackMessagePostConversation();cancelled.prepare('Draft','owner');assert.equal(cancelled.cancel().status,'DENIED');assert.equal(calls,0);
const revised=new SlackMessagePostConversation();revised.prepare('Old','owner');revised.confirm('CONFIRM POST');assert.equal(revised.revise('New').phase,'PREVIEW');assert.equal((await revised.dispatch(transport)).status,'DENIED');assert.equal(calls,0);
const valid=new SlackMessagePostConversation();assert.equal(valid.prepare('One controlled message','owner').phase,'PREVIEW');assert.equal(valid.confirm('CONFIRM POST').phase,'READY_TO_DISPATCH');const receipt=await valid.dispatch(transport);assert.equal(receipt.status,'SUCCESS');assert.ok(receipt.receiptId);assert.equal(calls,1);assert.equal((await valid.dispatch(transport)).status,'DENIED');assert.equal(calls,1);
assert.doesNotMatch(JSON.stringify({receipt}),/token|secret|credential|xoxb-/i);
console.log('SLACK WRITE CONVERSATION INTEGRATION - PASS');
