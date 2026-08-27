import assert from 'node:assert/strict';
import type { ControlledExternalAdapter } from '../src/external-capabilities/external-capability.executor';
import { SlackAllowlistedContextQuery } from '../src/external-capabilities/slack-allowlisted-context-query';
import { AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST } from '../src/external-capabilities/slack-readonly.policy';

let calls = 0;
const adapter: ControlledExternalAdapter = { async invoke(request) {
  calls += 1;
  return { messages: [
    { text: `AGM status for ${request.scope}` },
    { text: 'unrelated message' },
    { text: 'AGM follow-up' },
  ] };
} };

const restricted = new SlackAllowlistedContextQuery();
const denied = await restricted.execute({ queryId: 'q-denied', query: 'AGM', actorId: 'owner', targets: [{ channelName: 'secrets', channelId: 'C-SECRET' }] }, adapter);
assert.equal(denied.status, 'DENIED');
assert.equal(calls, 0);
assert.equal(denied.receipts.length, 1);

const badBinding = new SlackAllowlistedContextQuery();
assert.equal((await badBinding.execute({ queryId: 'q-binding', query: 'AGM', actorId: 'owner', targets: [{ channelName: 'general', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.testing }] }, adapter)).status, 'DENIED');
assert.equal(calls, 0);

const wrongTenant = new SlackAllowlistedContextQuery();
assert.equal((await wrongTenant.execute({ queryId: 'q-tenant', query: 'AGM', actorId: 'owner', tenantId: 'tenant:other', targets: [{ channelName: 'testing', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.testing }] }, adapter)).status, 'DENIED');
assert.equal(calls, 0);

const wrongWorkspace = new SlackAllowlistedContextQuery();
assert.equal((await wrongWorkspace.execute({ queryId: 'q-workspace', query: 'AGM', actorId: 'owner', workspaceId: 'T-WRONG', targets: [{ channelName: 'testing', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.testing }] }, adapter)).status, 'DENIED');
assert.equal(calls, 0);

const overLimit = new SlackAllowlistedContextQuery();
assert.equal((await overLimit.execute({ queryId: 'q-limit', query: 'AGM', actorId: 'owner', targets: [
  { channelName: 'testing', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.testing },
  { channelName: 'development', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.development },
  { channelName: 'documentation', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.documentation },
  { channelName: 'general', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.general },
] }, adapter)).reason, 'CHANNEL_QUERY_LIMIT_DENIED');
assert.equal(calls, 0);

const revoked = new SlackAllowlistedContextQuery();
revoked.revoke();
assert.equal((await revoked.execute({ queryId: 'q-revoked', query: 'AGM', actorId: 'owner', targets: [{ channelName: 'testing', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.testing }] }, adapter)).status, 'DENIED');
assert.equal(calls, 0);

const query = new SlackAllowlistedContextQuery();
const result = await query.execute({ queryId: 'q-valid', query: 'agm', actorId: 'owner', targets: [
  { channelName: 'testing', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.testing },
  { channelName: 'development', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.development },
] }, adapter);
assert.equal(result.status, 'SUCCESS');
assert.equal(result.receipts.length, 2);
assert.equal(result.matches.length, 2);
assert.equal(result.matches.every((match) => match.excerpts.length === 2), true);
assert.equal(calls, 2);
assert.equal((await query.execute({ queryId: 'q-valid', query: 'agm', actorId: 'owner', targets: [{ channelName: 'testing', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.testing }] }, adapter)).reason, 'DUPLICATE_QUERY_DENIED');
assert.equal(calls, 2);
assert.doesNotMatch(JSON.stringify(result), /xoxb-|bearer|credential|api[_-]?key/i);

console.log('AGM COPILOT SLACK ALLOWLISTED CONTEXT QUERY - PASS');
