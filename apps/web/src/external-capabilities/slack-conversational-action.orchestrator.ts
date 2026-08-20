import { ExternalCapabilityExecutor, type ControlledExternalAdapter } from './external-capability.executor';
import { ExternalCapabilityPermissionRegistry, sanitizeExternalValue, type ExternalAuditReceipt, type ExternalPermissionRequest } from './external-capability.policy';
import { SlackMessagePostConversation, type SlackPostConversationState } from './slack-message-post.conversation';
import { AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST, AGM_SLACK_WORKSPACE_ID, evaluateSlackReadTarget } from './slack-readonly.policy';

export type SlackConversationContext = Readonly<{
  conversationId: string;
  actorId: string;
  tenantId: string;
  channelName: string;
  channelId: string;
  messages: readonly unknown[];
  readReceipt: ExternalAuditReceipt;
}>;

export type SlackActionOrchestrationState =
  | Readonly<{ phase: 'IDLE' }>
  | Readonly<{ phase: 'CONTEXT_READY'; context: SlackConversationContext }>
  | Readonly<{ phase: 'ACTION_PENDING'; context: SlackConversationContext; action: SlackPostConversationState }>
  | Readonly<{ phase: 'RETURNED_TO_CONVERSATION'; context: SlackConversationContext; writeReceiptId: string; status: 'SUCCESS' }>
  | Readonly<{ phase: 'DENIED'; reason: string; receiptId?: string }>;

export class SlackConversationalActionOrchestrator {
  private state: SlackActionOrchestrationState = { phase: 'IDLE' };
  private readonly permissions = new ExternalCapabilityPermissionRegistry();
  private readonly executor = new ExternalCapabilityExecutor(this.permissions);
  private readonly write = new SlackMessagePostConversation();
  private revoked = false;

  get snapshot(): SlackActionOrchestrationState { return this.state; }

  revoke(): void {
    this.revoked = true;
    this.permissions.revoke('SLACK_CHANNEL_HISTORY_READ');
    this.write.revoke();
  }

  async readContext(input: Readonly<{
    channelName: string;
    channelId: string;
    actorId: string;
    tenantId?: string;
    workspaceId?: string;
  }>, adapter: ControlledExternalAdapter): Promise<SlackActionOrchestrationState> {
    const tenantId = input.tenantId ?? 'tenant:agm';
    const workspaceId = input.workspaceId ?? AGM_SLACK_WORKSPACE_ID;
    const request: ExternalPermissionRequest = {
      requestId: crypto.randomUUID(), capabilityId: 'SLACK_CHANNEL_HISTORY_READ', provider: 'SLACK',
      domain: 'slack.com', action: 'READ_ALLOWLISTED_CHANNEL_HISTORY', access: 'READ',
      scope: `channels.history:${input.channelId}`, entitlement: 'premium.voice-assistant',
      actorId: input.actorId, tenantId, expectedTenantId: 'tenant:agm', requestedAt: new Date().toISOString(),
    };
    const target = evaluateSlackReadTarget({ workspaceId, channelId: input.channelId, channelName: input.channelName, channelType: 'PUBLIC_CHANNEL' });
    if (target.status === 'DENIED') {
      const receipt = this.permissions.receipt(request, 'DENIED', target.reason, 0);
      return this.state = { phase: 'DENIED', reason: target.reason, receiptId: receipt.receiptId };
    }
    const result = await this.executor.execute(request, adapter);
    if (result.status !== 'SUCCESS') return this.state = { phase: 'DENIED', reason: result.receipt.reason, receiptId: result.receipt.receiptId };
    const data = sanitizeExternalValue(result.data) as { messages?: readonly unknown[] };
    const context: SlackConversationContext = Object.freeze({
      conversationId: crypto.randomUUID(), actorId: input.actorId, tenantId,
      channelName: input.channelName, channelId: input.channelId,
      messages: Object.freeze([...(data.messages ?? [])]), readReceipt: result.receipt,
    });
    return this.state = { phase: 'CONTEXT_READY', context };
  }

  draftAction(text: string): SlackActionOrchestrationState {
    if (this.state.phase !== 'CONTEXT_READY') return this.deny('SLACK_CONTEXT_REQUIRED');
    if (this.revoked) return this.deny('PERMISSION_REVOKED');
    const context = this.state.context;
    const action = this.write.prepare(text, context.actorId, context.tenantId);
    return this.state = { phase: 'ACTION_PENDING', context, action };
  }

  confirm(utterance: string): SlackActionOrchestrationState {
    if (this.state.phase !== 'ACTION_PENDING') return this.deny('NO_ACTIVE_ACTION_PREVIEW');
    const context = this.state.context;
    const action = this.write.confirm(utterance);
    if (action.phase === 'RECEIPT' && action.status === 'DENIED') return this.deny(action.reason, action.receiptId);
    return this.state = { phase: 'ACTION_PENDING', context, action };
  }

  async execute(transport: (body: Readonly<{ channel: string; text: string }>) => Promise<{ ok: true; ts: string }>): Promise<SlackActionOrchestrationState> {
    if (this.state.phase !== 'ACTION_PENDING') return this.deny('NO_CONFIRMED_ACTION');
    if (this.revoked) return this.deny('PERMISSION_REVOKED');
    const context = this.state.context;
    const action = await this.write.dispatch(transport);
    if (action.phase !== 'RECEIPT' || action.status !== 'SUCCESS' || !action.receiptId) return this.deny(action.phase === 'RECEIPT' ? action.reason : 'WRITE_NOT_COMPLETED');
    return this.state = { phase: 'RETURNED_TO_CONVERSATION', context, writeReceiptId: action.receiptId, status: 'SUCCESS' };
  }

  private deny(reason: string, receiptId?: string): SlackActionOrchestrationState {
    return this.state = { phase: 'DENIED', reason, receiptId };
  }
}

export const SLACK_ORCHESTRATION_TEST_CHANNEL = Object.freeze({
  name: 'testing',
  id: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.testing,
});
