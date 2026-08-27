import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ExternalCapabilityPermissionRegistry, type ExternalPermissionRequest } from '../src/external-capabilities/external-capability.policy';
import { createSlackReadOnlyAdapter } from '../src/external-capabilities/slack-readonly.provider';
import { AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST, AGM_SLACK_WORKSPACE_ID } from '../src/external-capabilities/slack-readonly.policy';

const token = process.env.SLACK_BOT_TOKEN;
if (!token) throw new Error('SLACK_BOT_TOKEN_NOT_CONFIGURED');
const registry = new ExternalCapabilityPermissionRegistry();
const adapter = createSlackReadOnlyAdapter(token);
const base: ExternalPermissionRequest = { requestId: crypto.randomUUID(), capabilityId: 'SLACK_CHANNELS_READ', provider: 'SLACK', domain: 'slack.com', action: 'LIST_ALLOWLISTED_CHANNELS', access: 'READ', scope: 'channels.metadata', entitlement: 'premium.voice-assistant', actorId: 'wave-slack-owner-pilot', tenantId: 'tenant:agm', expectedTenantId: 'tenant:agm', requestedAt: new Date().toISOString() };
async function diagnosticExecute(request: ExternalPermissionRequest) {
  const policy = registry.evaluate(request);
  if (policy.status === 'DENIED') return { status: 'DENIED' as const, data: undefined, receipt: policy.receipt, safeCause: policy.reason };
  try {
    const data = await adapter.invoke(Object.freeze({ ...request }), AbortSignal.timeout(15_000));
    return { status: 'SUCCESS' as const, data, receipt: registry.receipt(request, 'SUCCESS', 'PROVIDER_RESULT_ACCEPTED', 1), safeCause: undefined };
  } catch (error) {
    const safeCause = String(error instanceof Error ? error.message : error).replace(/xox[baprs]-[A-Za-z0-9-]+/gi, '[REDACTED]').replace(/[^A-Z0-9_\[\]-]/gi, '_');
    return { status: 'FAILURE' as const, data: undefined, receipt: registry.receipt(request, 'FAILURE', safeCause, 1), safeCause };
  }
}

const list = await diagnosticExecute(base);
const listData = list.data as { workspaceId: string; allowedChannelCount: number; channels: Array<{ id: string; name: string }> } | undefined;

const historyResults = [];
if (list.status === 'SUCCESS') {
  for (const [channelName, channelId] of Object.entries(AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST)) {
    const historyRequest: ExternalPermissionRequest = { ...base, requestId: crypto.randomUUID(), capabilityId: 'SLACK_CHANNEL_HISTORY_READ', action: 'READ_ALLOWLISTED_CHANNEL_HISTORY', scope: `channels.history:${channelId}` };
    const history = await diagnosticExecute(historyRequest);
    historyResults.push({ id: `allowlisted-history-${channelId}`, channelName, channelId, allowlisted: true, status: history.status, safeCause: history.safeCause, receipt: history.receipt });
  }
}
const denied = registry.evaluate({ ...base, requestId: crypto.randomUUID(), action: 'POST_MESSAGE', access: 'WRITE' });
const unallowlisted = registry.evaluate({ ...base, requestId: crypto.randomUUID(), capabilityId: 'SLACK_CHANNEL_HISTORY_READ', action: 'READ_ALLOWLISTED_CHANNEL_HISTORY', scope: 'channels.history:C-NOT-ALLOWLISTED' });
registry.revoke('SLACK_CHANNEL_HISTORY_READ');
const revoked = registry.evaluate({ ...base, requestId: crypto.randomUUID(), capabilityId: 'SLACK_CHANNEL_HISTORY_READ', action: 'READ_ALLOWLISTED_CHANNEL_HISTORY', scope: 'channels.history:C0BJ5HGQKLK' });
registry.restore('SLACK_CHANNEL_HISTORY_READ');

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.resolve(process.cwd(), '..', '..', 'evidence', 'agma-slack-readonly', 'provider', runId);
await mkdir(out, { recursive: true });
const passed = list.status === 'SUCCESS' && listData?.workspaceId === AGM_SLACK_WORKSPACE_ID && historyResults.length === 9 && historyResults.every((item) => item.status === 'SUCCESS') && denied.status === 'DENIED' && unallowlisted.status === 'DENIED' && revoked.reason === 'PERMISSION_REVOKED_OR_DISABLED';
await writeFile(path.join(out, 'report.json'), JSON.stringify({ schemaVersion: 2, runId, status: passed ? 'PASS' : 'FAIL', provider: 'SLACK', workspaceId: AGM_SLACK_WORKSPACE_ID, access: 'READ_ONLY', production: 'UNCHANGED', secretExposure: 'ZERO', contentPersisted: 'ZERO', results: [{ id: 'allowlisted-channel-list', status: list.status, safeCause: list.safeCause, receipt: list.receipt, allowedChannelCount: listData?.allowedChannelCount ?? 0 }, ...historyResults, { id: 'unallowlisted-channel-denied', status: unallowlisted.status, receipt: unallowlisted.receipt }, { id: 'revocation-immediate', status: revoked.status, receipt: revoked.receipt }, { id: 'write-denied', status: denied.status === 'DENIED' ? 'PASS' : 'FAIL', receipt: denied.receipt }], finishedAt: new Date().toISOString() }, null, 2));
const firstFailure = historyResults.find((item) => item.status !== 'SUCCESS')?.safeCause;
if (!passed) throw new Error(`SLACK_REAL_GATE_FAILED_${list.safeCause ?? firstFailure ?? 'VALIDATION'}`);
console.log('AGM Slack real READ-only pilot PASS');
console.log(path.join(out, 'report.json'));
