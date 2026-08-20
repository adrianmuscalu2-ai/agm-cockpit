import { issueDummyExplicitConfirmation, type ControlledWriteRequest } from './controlled-write.foundation';
import { prepareSlackMessagePreview, SlackMessagePostFoundation, SLACK_MESSAGE_POST_PILOT, type SlackMessageDraft, type SlackMessagePreview } from './slack-message-post.foundation';

export type SlackPostConversationState =
  | Readonly<{ phase: 'IDLE' }>
  | Readonly<{ phase: 'PREVIEW'; draft: SlackMessageDraft; preview: SlackMessagePreview }>
  | Readonly<{ phase: 'READY_TO_DISPATCH'; draft: SlackMessageDraft; preview: SlackMessagePreview; confirmationText: 'CONFIRM POST' }>
  | Readonly<{ phase: 'RECEIPT'; status: 'SUCCESS' | 'DENIED'; reason: string; receiptId?: string }>;

export class SlackMessagePostConversation {
  private state: SlackPostConversationState = { phase: 'IDLE' };
  private readonly foundation = new SlackMessagePostFoundation();
  get snapshot(): SlackPostConversationState { return this.state; }
  revoke(): void { this.foundation.revoke(); }

  prepare(text: string, actorId: string, tenantId = 'tenant:agm'): SlackPostConversationState {
    const draft: SlackMessageDraft = { requestId: crypto.randomUUID(), tenantId, actorId, workspaceId: SLACK_MESSAGE_POST_PILOT.workspaceId, channelId: SLACK_MESSAGE_POST_PILOT.channelId, text, createdAt: new Date().toISOString() };
    const preview = prepareSlackMessagePreview(draft);
    return this.state = { phase: 'PREVIEW', draft, preview };
  }

  confirm(utterance: string): SlackPostConversationState {
    if (this.state.phase !== 'PREVIEW') return this.deny('NO_ACTIVE_PREVIEW');
    if (utterance.trim() !== 'CONFIRM POST') return this.deny('EXPLICIT_CONFIRMATION_REQUIRED');
    return this.state = { phase: 'READY_TO_DISPATCH', draft: this.state.draft, preview: this.state.preview, confirmationText: 'CONFIRM POST' };
  }

  revise(text: string): SlackPostConversationState {
    if (this.state.phase !== 'PREVIEW' && this.state.phase !== 'READY_TO_DISPATCH') return this.deny('NO_ACTIVE_DRAFT');
    return this.prepare(text, this.state.draft.actorId, this.state.draft.tenantId);
  }

  cancel(): SlackPostConversationState { return this.deny('USER_CANCELLED'); }

  async dispatch(transport: (body: Readonly<{channel:string;text:string}>) => Promise<{ok:true;ts:string}>): Promise<SlackPostConversationState> {
    if (this.state.phase !== 'READY_TO_DISPATCH') return this.deny('EXPLICIT_CONFIRMATION_REQUIRED');
    const request: ControlledWriteRequest = { requestId: this.state.draft.requestId, capabilityId: SLACK_MESSAGE_POST_PILOT.capabilityId, provider: SLACK_MESSAGE_POST_PILOT.provider, action: SLACK_MESSAGE_POST_PILOT.action, tenantId: this.state.draft.tenantId, expectedTenantId: 'tenant:agm', actorId: this.state.draft.actorId, payloadDigest: this.state.preview.payloadDigest, requestedAt: this.state.draft.createdAt };
    const result = await this.foundation.executeDummy(this.state.draft, this.state.preview, issueDummyExplicitConfirmation(request), transport);
    return this.state = {
      phase: 'RECEIPT',
      status: result.status === 'SUCCESS' ? 'SUCCESS' : 'DENIED',
      reason: result.reason,
      receiptId: 'receipt' in result ? result.receipt?.receiptId : undefined,
    };
  }

  private deny(reason: string): SlackPostConversationState { return this.state = { phase: 'RECEIPT', status: 'DENIED', reason }; }
}
