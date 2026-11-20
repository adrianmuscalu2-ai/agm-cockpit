import assert from 'node:assert/strict';
import { AgmatccConversationContext, runAgmatccAiConversation } from '../src/turn-agmatcc/agmatcc.ai-conversation';

const reply = { answer: 'Evidence found', status: 'PASS', model: 'configured-alias', provider: 'openai', executionId: 'execution-1', testMandateId: 'request-1', evidenceRefs: ['operational-event:stream@1:event'], providerExecutions: [{ source: 'PROVIDER_RESPONSE', executedModel: 'provider-reported-model', responseId: 'response-1', providerVersion: null }] };
const entries: Array<{ text: string; provenance: string }> = [];
let calls = 0;
const fetcher = async (_path: string, init: RequestInit) => {
  calls++;
  assert.equal(entries.length, 1, 'request is persisted before inference');
  assert.equal(JSON.parse(String(init.body)).testMandateId, 'request-1');
  return new Response(JSON.stringify({ data: reply }), { status: 200 });
};
const result = await runAgmatccAiConversation({ question: 'Read the journal', requestId: 'request-1', fetcher, append: async (text, provenance) => { entries.push({ text, provenance }); return { status: 'SYNCED' }; } });
assert.equal(result.executedModel, 'provider-reported-model');
assert.equal(result.journalStatus, 'SYNCED');
assert.equal(entries.length, 2);
assert.equal(JSON.parse(entries[1].text.slice('AI_RESPONSE '.length)).requestId, 'request-1');
assert.ok(entries[1].text.includes('response-1'));
assert.equal(entries[1].provenance, 'system');
await assert.rejects(runAgmatccAiConversation({ question: 'Read', requestId: 'blocked', fetcher, append: async () => ({ status: 'PENDING' }) }), /JOURNAL_NOT_SYNCED/);
assert.equal(calls, 1, 'no provider request when durable request write fails');
let writes = 0;
const unknown = await runAgmatccAiConversation({ question: 'Read', requestId: 'unknown', fetcher: async () => new Response(JSON.stringify({ data: { ...reply, providerExecutions: [] } })), append: async () => ({ status: ++writes === 1 ? 'SYNCED' : 'PENDING' }) });
assert.equal(unknown.executedModel, 'UNKNOWN', 'configured alias cannot prove execution');
assert.equal(unknown.journalStatus, 'PENDING', 'response persistence failure is visible');
const failures: string[] = [];
await assert.rejects(runAgmatccAiConversation({ question: 'Read', requestId: 'failed', fetcher: async () => new Response('', { status: 403 }), append: async text => { failures.push(text); return { status: 'SYNCED' }; } }), /HTTP_403/);
assert.equal(failures.length, 2);
assert.ok(failures[1].startsWith('AI_FAILURE '));
await assert.rejects(runAgmatccAiConversation({ question: 'Cancelled', requestId: 'cancelled', isCancelled: () => true, fetcher, append: async () => ({ status: 'SYNCED' }) }), /CANCELLED_BEFORE_PROVIDER/);
assert.equal(calls, 1, 'STOP before inference cannot charge a provider call');
console.log('PASS AGMaTCC AI conversation: durable ordering, correlation, provider identity, unknown identity, pending response, failed request');

const context = new AgmatccConversationContext();
for (let i = 0; i < 8; i++) context.remember(`question-${i}`, `answer-${i}`);
assert.equal(context.snapshot().length, 12);
assert.equal(context.snapshot()[0].content, 'question-2');
const copy = context.snapshot(); copy[0].content = 'mutated';
assert.equal(context.snapshot()[0].content, 'question-2');
let sent: any;
await runAgmatccAiConversation({ question: 'Și de ce?', requestId: 'followup', history: context.snapshot(),
  append: async () => ({ status: 'SYNCED' }), fetcher: async (_path, init) => {
    sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ data: reply }));
  } });
assert.equal(sent.history.at(-1).content, 'answer-7');
assert.equal(sent.question, 'Și de ce?');
context.clear(); assert.deepEqual(context.snapshot(), []);
assert.deepEqual(new AgmatccConversationContext().snapshot(), []);
console.log('PASS bounded multi-turn context, independent snapshots, follow-up transport, explicit reset and fresh session');
let sessionWrites = 0;
let sessionCurrent = true;
const switched = await runAgmatccAiConversation({ question: 'Old session', requestId: 'session-switch',
  isSessionCurrent: () => sessionCurrent,
  append: async () => { sessionWrites++; return { status: 'SYNCED' }; },
  fetcher: async () => { sessionCurrent = false; return new Response(JSON.stringify({ data: reply })); } });
assert.equal(sessionWrites, 1, 'a response from an old session must not be journalled under the new caller');
assert.equal(switched.journalStatus, 'UNAVAILABLE');
