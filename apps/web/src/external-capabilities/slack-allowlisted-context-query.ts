import { ExternalCapabilityExecutor, type ControlledExternalAdapter } from './external-capability.executor';
import { ExternalCapabilityPermissionRegistry, sanitizeExternalValue, type ExternalAuditReceipt, type ExternalPermissionRequest } from './external-capability.policy';
import { AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST, AGM_SLACK_WORKSPACE_ID, evaluateSlackReadTarget } from './slack-readonly.policy';

export type SlackContextQueryTarget = Readonly<{ channelName: string; channelId: string }>;
export type SlackContextMatch = Readonly<{ channelName: string; channelId: string; excerpts: readonly string[] }>;
export type SlackContextQueryResult = Readonly<{
  status: 'SUCCESS' | 'DENIED';
  reason: string;
  queryId: string;
  matches: readonly SlackContextMatch[];
  receipts: readonly ExternalAuditReceipt[];
}>;

const MAX_CHANNELS_PER_QUERY = 3;
const MAX_EXCERPTS_PER_CHANNEL = 5;

export class SlackAllowlistedContextQuery {
  private readonly permissions = new ExternalCapabilityPermissionRegistry();
  private readonly executor = new ExternalCapabilityExecutor(this.permissions);
  private readonly consumedQueryIds = new Set<string>();

  revoke(): void { this.permissions.revoke('SLACK_CHANNEL_HISTORY_READ'); }

  async execute(input: Readonly<{
    queryId: string;
    query: string;
    targets: readonly SlackContextQueryTarget[];
    actorId: string;
    tenantId?: string;
    workspaceId?: string;
  }>, adapter: ControlledExternalAdapter): Promise<SlackContextQueryResult> {
    const query = input.query.trim();
    const tenantId = input.tenantId ?? 'tenant:agm';
    const workspaceId = input.workspaceId ?? AGM_SLACK_WORKSPACE_ID;
    if (!query) return this.denied(input.queryId, 'QUERY_REQUIRED');
    if (this.consumedQueryIds.has(input.queryId)) return this.denied(input.queryId, 'DUPLICATE_QUERY_DENIED');
    if (input.targets.length === 0 || input.targets.length > MAX_CHANNELS_PER_QUERY) return this.denied(input.queryId, 'CHANNEL_QUERY_LIMIT_DENIED');

    const preflightReceipts: ExternalAuditReceipt[] = [];
    for (const target of input.targets) {
      const request = this.request(input.queryId, target.channelId, input.actorId, tenantId);
      const decision = evaluateSlackReadTarget({ workspaceId, channelId: target.channelId, channelName: target.channelName, channelType: 'PUBLIC_CHANNEL' });
      if (decision.status === 'DENIED') {
        preflightReceipts.push(this.permissions.receipt(request, 'DENIED', decision.reason, 0));
        return this.denied(input.queryId, decision.reason, preflightReceipts);
      }
      if (AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST[target.channelName as keyof typeof AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST] !== target.channelId) {
        preflightReceipts.push(this.permissions.receipt(request, 'DENIED', 'SLACK_CHANNEL_NAME_ID_BINDING_INVALID', 0));
        return this.denied(input.queryId, 'SLACK_CHANNEL_NAME_ID_BINDING_INVALID', preflightReceipts);
      }
    }

    this.consumedQueryIds.add(input.queryId);
    const receipts: ExternalAuditReceipt[] = [];
    const matches: SlackContextMatch[] = [];
    for (const target of input.targets) {
      const result = await this.executor.execute(this.request(input.queryId, target.channelId, input.actorId, tenantId), adapter);
      receipts.push(result.receipt);
      if (result.status !== 'SUCCESS') return this.denied(input.queryId, result.receipt.reason, receipts);
      const data = sanitizeExternalValue(result.data) as { messages?: readonly { text?: unknown }[] };
      const excerpts = (data.messages ?? [])
        .map((message) => typeof message.text === 'string' ? message.text : '')
        .filter((text) => text.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
        .slice(0, MAX_EXCERPTS_PER_CHANNEL);
      matches.push(Object.freeze({ channelName: target.channelName, channelId: target.channelId, excerpts: Object.freeze(excerpts) }));
    }
    return Object.freeze({ status: 'SUCCESS', reason: 'ALLOWLISTED_CONTEXT_QUERY_COMPLETE', queryId: input.queryId, matches: Object.freeze(matches), receipts: Object.freeze(receipts) });
  }

  private request(queryId: string, channelId: string, actorId: string, tenantId: string): ExternalPermissionRequest {
    return { requestId: `${queryId}:${channelId}`, capabilityId: 'SLACK_CHANNEL_HISTORY_READ', provider: 'SLACK', domain: 'slack.com', action: 'READ_ALLOWLISTED_CHANNEL_HISTORY', access: 'READ', scope: `channels.history:${channelId}`, entitlement: 'premium.voice-assistant', actorId, tenantId, expectedTenantId: 'tenant:agm', requestedAt: new Date().toISOString() };
  }

  private denied(queryId: string, reason: string, receipts: readonly ExternalAuditReceipt[] = []): SlackContextQueryResult {
    return Object.freeze({ status: 'DENIED', reason, queryId, matches: Object.freeze([]), receipts: Object.freeze([...receipts]) });
  }
}
