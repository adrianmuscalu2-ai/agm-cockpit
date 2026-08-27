import assert from 'node:assert/strict';
import { ExternalCapabilityPermissionRegistry, type ExternalPermissionRequest } from '../src/external-capabilities/external-capability.policy';
import { AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST, AGM_SLACK_WORKSPACE_ID, evaluateSlackReadTarget } from '../src/external-capabilities/slack-readonly.policy';

const registry = new ExternalCapabilityPermissionRegistry();
const receipts = new Set<string>();
for (const [channelName, channelId] of Object.entries(AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST)) {
  assert.equal(evaluateSlackReadTarget({ workspaceId: AGM_SLACK_WORKSPACE_ID, channelId, channelName, channelType: 'PUBLIC_CHANNEL' }).status, 'ALLOWED');
  const request: ExternalPermissionRequest = { requestId: `dummy-${channelId}`, capabilityId: 'SLACK_CHANNEL_HISTORY_READ', provider: 'SLACK', domain: 'slack.com', action: 'READ_ALLOWLISTED_CHANNEL_HISTORY', access: 'READ', scope: `channels.history:${channelId}`, entitlement: 'premium.voice-assistant', actorId: 'dummy-expansion-test', tenantId: 'tenant:agm', expectedTenantId: 'tenant:agm', requestedAt: new Date().toISOString() };
  const decision = registry.evaluate(request);
  assert.equal(decision.status, 'ALLOWED');
  assert.equal(receipts.has(decision.receipt.receiptId), false);
  receipts.add(decision.receipt.receiptId);
}
assert.equal(receipts.size, 9);

const deniedBase: ExternalPermissionRequest = { requestId: 'dummy-denied', capabilityId: 'SLACK_CHANNEL_HISTORY_READ', provider: 'SLACK', domain: 'slack.com', action: 'READ_ALLOWLISTED_CHANNEL_HISTORY', access: 'READ', scope: 'channels.history:C-NOT-ALLOWLISTED', entitlement: 'premium.voice-assistant', actorId: 'dummy-expansion-test', tenantId: 'tenant:agm', expectedTenantId: 'tenant:agm', requestedAt: new Date().toISOString() };
assert.equal(registry.evaluate(deniedBase).status, 'DENIED');
assert.equal(registry.evaluate({ ...deniedBase, requestId: 'dummy-write', access: 'WRITE', scope: 'channels.history:C0BJ5HGQKLK' }).status, 'DENIED');
registry.revoke('SLACK_CHANNEL_HISTORY_READ');
assert.equal(registry.evaluate({ ...deniedBase, requestId: 'dummy-revoked', scope: 'channels.history:C0BJ5HGQKLK' }).reason, 'PERMISSION_REVOKED_OR_DISABLED');

for (const excluded of ['secrets', 'financiar', 'management']) {
  assert.equal(evaluateSlackReadTarget({ workspaceId: AGM_SLACK_WORKSPACE_ID, channelId: 'C-NOT-ALLOWLISTED', channelName: excluded, channelType: 'PUBLIC_CHANNEL' }).status, 'DENIED');
}
assert.equal(evaluateSlackReadTarget({ workspaceId: AGM_SLACK_WORKSPACE_ID, channelId: 'D-DM', channelType: 'DIRECT_MESSAGE' }).status, 'DENIED');
assert.equal(evaluateSlackReadTarget({ workspaceId: AGM_SLACK_WORKSPACE_ID, channelId: 'G-PRIVATE', channelType: 'PRIVATE_CHANNEL' }).status, 'DENIED');
console.log('AGM SLACK READ EXPANSION SECURE PATH - PASS');
