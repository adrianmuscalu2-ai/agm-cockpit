import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ExternalCapabilityPermissionRegistry, type ExternalPermissionRequest } from '../src/external-capabilities/external-capability.policy';
import { externalCapabilityRegistry } from '../src/external-capabilities/external-capability.registry';
import { AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST, AGM_SLACK_WORKSPACE_ID, evaluateSlackReadTarget } from '../src/external-capabilities/slack-readonly.policy';

assert.equal(Object.keys(AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST).length, 9);
assert.deepEqual(externalCapabilityRegistry.get('SLACK_CHANNELS_READ')?.allowedActions, ['LIST_ALLOWLISTED_CHANNELS']);
assert.deepEqual(externalCapabilityRegistry.get('SLACK_CHANNEL_HISTORY_READ')?.allowedActions, ['READ_ALLOWLISTED_CHANNEL_HISTORY']);
assert.equal(evaluateSlackReadTarget({ workspaceId: AGM_SLACK_WORKSPACE_ID, channelId: 'C0BJ5HGQKLK', channelName: 'general', channelType: 'PUBLIC_CHANNEL' }).status, 'ALLOWED');
assert.equal(evaluateSlackReadTarget({ workspaceId: 'T-WRONG', channelId: 'C0BJ5HGQKLK', channelName: 'general', channelType: 'PUBLIC_CHANNEL' }).reason, 'SLACK_WORKSPACE_ISOLATION_VIOLATION');
assert.equal(evaluateSlackReadTarget({ workspaceId: AGM_SLACK_WORKSPACE_ID, channelId: 'C-UNKNOWN', channelName: 'random', channelType: 'PUBLIC_CHANNEL' }).reason, 'SLACK_CHANNEL_NOT_ALLOWLISTED');
assert.equal(evaluateSlackReadTarget({ workspaceId: AGM_SLACK_WORKSPACE_ID, channelId: 'C-PRIVATE', channelName: 'secrets', channelType: 'PRIVATE_CHANNEL' }).reason, 'SLACK_NON_PUBLIC_CHANNEL_DENIED');
assert.equal(evaluateSlackReadTarget({ workspaceId: AGM_SLACK_WORKSPACE_ID, channelId: 'D-DM', channelType: 'DIRECT_MESSAGE' }).reason, 'SLACK_NON_PUBLIC_CHANNEL_DENIED');

const permissions = new ExternalCapabilityPermissionRegistry();
const request: ExternalPermissionRequest = { requestId: 'slack-read-1', capabilityId: 'SLACK_CHANNELS_READ', provider: 'SLACK', domain: 'slack.com', action: 'LIST_ALLOWLISTED_CHANNELS', access: 'READ', scope: 'channels.metadata', entitlement: 'premium.voice-assistant', actorId: 'owner', tenantId: 'tenant:agm', expectedTenantId: 'tenant:agm', requestedAt: new Date().toISOString() };
assert.equal(permissions.evaluate(request).status, 'ALLOWED');
assert.equal(permissions.evaluate({ ...request, access: 'WRITE' }).status, 'DENIED');
assert.equal(permissions.evaluate({ ...request, action: 'POST_MESSAGE' }).status, 'DENIED');
permissions.revoke('SLACK_CHANNELS_READ');
assert.equal(permissions.evaluate(request).reason, 'PERMISSION_REVOKED_OR_DISABLED');

const providerSource = readFileSync(new URL('../src/external-capabilities/slack-readonly.provider.ts', import.meta.url), 'utf8');
assert.doesNotMatch(providerSource, /chat\.postMessage|conversations\.create|conversations\.archive|conversations\.rename/);
assert.match(providerSource, /httpMethod: 'GET' \| 'POST' = 'GET'/);
assert.match(providerSource, /'auth\.test'.*'POST'/s);
console.log('AGM Slack READ-only policy PASS');
