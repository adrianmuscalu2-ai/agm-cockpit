import assert from 'node:assert/strict';
import type { ControlledExternalAdapter } from '../src/external-capabilities/external-capability.executor';
import { SlackConversationalActionOrchestrator, SLACK_ORCHESTRATION_TEST_CHANNEL } from '../src/external-capabilities/slack-conversational-action.orchestrator';

let reads = 0;
const readAdapter: ControlledExternalAdapter = { async invoke() { reads += 1; return { messages: [{ text: 'Allowlisted context' }] }; } };
let writes = 0;
const writeTransport = async () => { writes += 1; return { ok: true as const, ts: 'dummy-ts' }; };

const deniedChannel = new SlackConversationalActionOrchestrator();
assert.equal((await deniedChannel.readContext({ channelName: 'secrets', channelId: 'C-NOT-ALLOWED', actorId: 'owner' }, readAdapter)).phase, 'DENIED');
assert.equal(reads, 0);

const wrongTenant = new SlackConversationalActionOrchestrator();
assert.equal((await wrongTenant.readContext({ ...SLACK_ORCHESTRATION_TEST_CHANNEL, channelName: 'testing', channelId: SLACK_ORCHESTRATION_TEST_CHANNEL.id, actorId: 'owner', tenantId: 'tenant:other' }, readAdapter)).phase, 'DENIED');
assert.equal(reads, 0);

const revokedRead = new SlackConversationalActionOrchestrator();
revokedRead.revoke();
assert.equal((await revokedRead.readContext({ channelName: 'testing', channelId: SLACK_ORCHESTRATION_TEST_CHANNEL.id, actorId: 'owner' }, readAdapter)).phase, 'DENIED');
assert.equal(reads, 0);

const ambiguous = new SlackConversationalActionOrchestrator();
assert.equal((await ambiguous.readContext({ channelName: 'testing', channelId: SLACK_ORCHESTRATION_TEST_CHANNEL.id, actorId: 'owner' }, readAdapter)).phase, 'CONTEXT_READY');
assert.equal(ambiguous.draftAction('Post a controlled update').phase, 'ACTION_PENDING');
assert.equal(ambiguous.confirm('yes').phase, 'DENIED');
assert.equal(writes, 0);

const revokedWrite = new SlackConversationalActionOrchestrator();
await revokedWrite.readContext({ channelName: 'testing', channelId: SLACK_ORCHESTRATION_TEST_CHANNEL.id, actorId: 'owner' }, readAdapter);
revokedWrite.draftAction('Do not post after revoke');
revokedWrite.confirm('CONFIRM POST');
revokedWrite.revoke();
assert.equal((await revokedWrite.execute(writeTransport)).phase, 'DENIED');
assert.equal(writes, 0);

const valid = new SlackConversationalActionOrchestrator();
const contextReady = await valid.readContext({ channelName: 'testing', channelId: SLACK_ORCHESTRATION_TEST_CHANNEL.id, actorId: 'owner' }, readAdapter);
assert.equal(contextReady.phase, 'CONTEXT_READY');
if (contextReady.phase !== 'CONTEXT_READY') throw new Error('CONTEXT_NOT_READY');
const conversationId = contextReady.context.conversationId;
assert.ok(contextReady.context.readReceipt.receiptId);
valid.draftAction('Single confirmed orchestration test');
assert.equal(valid.confirm('CONFIRM POST').phase, 'ACTION_PENDING');
const returned = await valid.execute(writeTransport);
assert.equal(returned.phase, 'RETURNED_TO_CONVERSATION');
if (returned.phase !== 'RETURNED_TO_CONVERSATION') throw new Error('CONVERSATION_NOT_RESUMED');
assert.equal(returned.context.conversationId, conversationId);
assert.ok(returned.writeReceiptId);
assert.equal(writes, 1);
assert.equal((await valid.execute(writeTransport)).phase, 'DENIED');
assert.equal(writes, 1);
assert.doesNotMatch(JSON.stringify({ contextReady, returned }), /xoxb-|bearer|credential|api[_-]?key/i);

console.log('AGM COPILOT CONVERSATIONAL ACTION ORCHESTRATION - PASS');
