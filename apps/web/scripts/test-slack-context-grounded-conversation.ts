import assert from 'node:assert/strict';
import type { ControlledExternalAdapter } from '../src/external-capabilities/external-capability.executor';
import { SlackContextGroundedConversation } from '../src/external-capabilities/slack-context-grounded-conversation';
import { AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST } from '../src/external-capabilities/slack-readonly.policy';

let reads = 0;
const relevantAdapter: ControlledExternalAdapter = { async invoke() { reads += 1; return { messages: [
  { text: 'Atlas rollout este pregătit pentru verificare.' },
  { text: 'Acest mesaj nu este relevant.' },
] }; } };
const target = [{ channelName: 'testing', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.testing }] as const;

const grounded = new SlackContextGroundedConversation();
const answer = await grounded.answer({ question: 'Care este situația pentru Atlas?', targets: target, actorId: 'owner', queryId: 'grounded-1' }, relevantAdapter);
assert.equal(answer.status, 'GROUNDED');
assert.equal(answer.usesSlackContext, true);
assert.match(answer.answer, /bazat pe context Slack allowlisted/);
assert.match(answer.answer, /Atlas rollout este pregătit pentru verificare/);
assert.equal(answer.sources.length, 1);
assert.ok(answer.sources[0].receiptId);
assert.equal(answer.auditReceiptIds.length, 1);
assert.equal(reads, 1);
assert.doesNotMatch(answer.answer, /livrat cu succes|aprobat de management/i);

const irrelevantAdapter: ControlledExternalAdapter = { async invoke() { reads += 1; return { messages: [{ text: 'Alt subiect fără legătură.' }] }; } };
const fallback = await new SlackContextGroundedConversation().answer({ question: 'Ce știm despre Orion?', targets: target, actorId: 'owner', queryId: 'fallback-1' }, irrelevantAdapter);
assert.equal(fallback.status, 'FALLBACK');
assert.equal(fallback.usesSlackContext, false);
assert.equal(fallback.sources.length, 0);
assert.equal(fallback.auditReceiptIds.length, 1);

const excluded = await new SlackContextGroundedConversation().answer({ question: 'Ce este în secrets?', targets: [{ channelName: 'secrets', channelId: 'C-SECRET' }], actorId: 'owner', queryId: 'denied-1' }, relevantAdapter);
assert.equal(excluded.status, 'DENIED');
assert.equal(excluded.usesSlackContext, false);
assert.equal(excluded.auditReceiptIds.length, 1);

const wrongTenant = await new SlackContextGroundedConversation().answer({ question: 'Care este situația Atlas?', targets: target, actorId: 'owner', tenantId: 'tenant:other', queryId: 'denied-tenant' }, relevantAdapter);
assert.equal(wrongTenant.status, 'DENIED');

const wrongWorkspace = await new SlackContextGroundedConversation().answer({ question: 'Care este situația Atlas?', targets: target, actorId: 'owner', workspaceId: 'T-WRONG', queryId: 'denied-workspace' }, relevantAdapter);
assert.equal(wrongWorkspace.status, 'DENIED');

const revoked = new SlackContextGroundedConversation();
revoked.revoke();
assert.equal((await revoked.answer({ question: 'Care este situația Atlas?', targets: target, actorId: 'owner', queryId: 'denied-revoked' }, relevantAdapter)).status, 'DENIED');
assert.equal(reads, 2);
assert.doesNotMatch(JSON.stringify({ answer, fallback, excluded }), /xoxb-|bearer|credential|api[_-]?key/i);

console.log('AGM COPILOT SLACK CONTEXT GROUNDED CONVERSATION - PASS');
