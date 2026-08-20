import type { ControlledExternalAdapter } from './external-capability.executor';
import { SlackContextGroundedConversation, type SlackGroundedConversationResult } from './slack-context-grounded-conversation';
import { SlackMessagePostConversation, type SlackPostConversationState } from './slack-message-post.conversation';
import type { SlackContextQueryTarget } from './slack-allowlisted-context-query';

export type SlackGroundedControlledActionState =
  | Readonly<{ phase: 'IDLE' }>
  | Readonly<{ phase: 'GROUNDED'; grounded: SlackGroundedConversationResult }>
  | Readonly<{ phase: 'PROPOSED'; grounded: SlackGroundedConversationResult; action: SlackPostConversationState }>
  | Readonly<{ phase: 'COMPLETED'; grounded: SlackGroundedConversationResult; readReceiptIds: readonly string[]; writeReceiptId: string; status: 'SUCCESS' }>
  | Readonly<{ phase: 'DENIED'; reason: string; readReceiptIds: readonly string[]; writeReceiptId?: string }>;

export class SlackGroundedControlledAction {
  private state: SlackGroundedControlledActionState = { phase: 'IDLE' };
  private readonly grounding = new SlackContextGroundedConversation();
  private readonly write = new SlackMessagePostConversation();
  private revoked = false;

  get snapshot(): SlackGroundedControlledActionState { return this.state; }

  revoke(): void {
    this.revoked = true;
    this.grounding.revoke();
    this.write.revoke();
  }

  async ground(input: Readonly<{
    question: string; targets: readonly SlackContextQueryTarget[]; actorId: string;
    tenantId?: string; workspaceId?: string; queryId?: string;
  }>, adapter: ControlledExternalAdapter): Promise<SlackGroundedControlledActionState> {
    if (this.revoked) return this.deny('PERMISSION_REVOKED');
    const grounded = await this.grounding.answer(input, adapter);
    if (grounded.status !== 'GROUNDED') return this.deny(grounded.reason, grounded.auditReceiptIds);
    return this.state = { phase: 'GROUNDED', grounded };
  }

  propose(message: string, actorId: string, tenantId = 'tenant:agm'): SlackGroundedControlledActionState {
    if (this.state.phase !== 'GROUNDED') return this.deny('GROUNDED_CONTEXT_REQUIRED', this.readReceiptIds());
    if (this.revoked) return this.deny('PERMISSION_REVOKED', this.state.grounded.auditReceiptIds);
    const grounded = this.state.grounded;
    const action = this.write.prepare(message, actorId, tenantId);
    return this.state = { phase: 'PROPOSED', grounded, action };
  }

  confirm(utterance: string): SlackGroundedControlledActionState {
    if (this.state.phase !== 'PROPOSED') return this.deny('ACTION_PREVIEW_REQUIRED', this.readReceiptIds());
    const grounded = this.state.grounded;
    const action = this.write.confirm(utterance);
    if (action.phase === 'RECEIPT' && action.status === 'DENIED') return this.deny(action.reason, grounded.auditReceiptIds, action.receiptId);
    return this.state = { phase: 'PROPOSED', grounded, action };
  }

  revise(message: string): SlackGroundedControlledActionState {
    if (this.state.phase !== 'PROPOSED') return this.deny('ACTION_PREVIEW_REQUIRED', this.readReceiptIds());
    const grounded = this.state.grounded;
    const action = this.write.revise(message);
    return this.state = { phase: 'PROPOSED', grounded, action };
  }

  async execute(transport: (body: Readonly<{ channel: string; text: string }>) => Promise<{ ok: true; ts: string }>): Promise<SlackGroundedControlledActionState> {
    if (this.state.phase !== 'PROPOSED') return this.deny('CONFIRMED_ACTION_REQUIRED', this.readReceiptIds());
    if (this.revoked) return this.deny('PERMISSION_REVOKED', this.state.grounded.auditReceiptIds);
    const grounded = this.state.grounded;
    const action = await this.write.dispatch(transport);
    if (action.phase !== 'RECEIPT' || action.status !== 'SUCCESS' || !action.receiptId) return this.deny(action.phase === 'RECEIPT' ? action.reason : 'WRITE_NOT_COMPLETED', grounded.auditReceiptIds, action.phase === 'RECEIPT' ? action.receiptId : undefined);
    return this.state = { phase: 'COMPLETED', grounded, readReceiptIds: grounded.auditReceiptIds, writeReceiptId: action.receiptId, status: 'SUCCESS' };
  }

  private readReceiptIds(): readonly string[] {
    return 'grounded' in this.state ? this.state.grounded.auditReceiptIds : Object.freeze([]);
  }

  private deny(reason: string, readReceiptIds: readonly string[] = [], writeReceiptId?: string): SlackGroundedControlledActionState {
    return this.state = { phase: 'DENIED', reason, readReceiptIds: Object.freeze([...readReceiptIds]), writeReceiptId };
  }
}
