import { ControlledExternalWriteFoundation, type ControlledWriteConfirmation, type ControlledWriteRequest } from './controlled-write.foundation';

export const SLACK_MESSAGE_POST_PILOT = Object.freeze({
  capabilityId: 'SLACK_MESSAGE_POST',
  provider: 'SLACK',
  action: 'POST_NEW_MESSAGE',
  workspaceId: 'T0BJBPRN24A',
  channelName: 'testing',
  channelId: 'C0BJ9R1NPEJ',
  requiredAdditionalScope: 'chat:write',
});

export type SlackMessageDraft = Readonly<{ requestId: string; tenantId: string; actorId: string; workspaceId: string; channelId: string; text: string; createdAt: string }>;
export type SlackMessagePreview = Readonly<{ requestId: string; channelName: string; channelId: string; text: string; payloadDigest: string; expiresAt: string }>;

export function prepareSlackMessagePreview(draft: SlackMessageDraft): SlackMessagePreview {
  if (draft.workspaceId !== SLACK_MESSAGE_POST_PILOT.workspaceId) throw new Error('SLACK_WORKSPACE_ISOLATION_VIOLATION');
  if (draft.channelId !== SLACK_MESSAGE_POST_PILOT.channelId) throw new Error('SLACK_WRITE_CHANNEL_NOT_ALLOWLISTED');
  const text = draft.text.trim();
  if (!text || text.length > 4000) throw new Error('SLACK_MESSAGE_INVALID');
  const payloadDigest = `v1:${draft.workspaceId}:${draft.channelId}:${text.length}:${simpleDigest(text)}`;
  return Object.freeze({ requestId: draft.requestId, channelName: SLACK_MESSAGE_POST_PILOT.channelName, channelId: draft.channelId, text, payloadDigest, expiresAt: new Date(Date.parse(draft.createdAt) + 60_000).toISOString() });
}

function simpleDigest(value: string): string {
  let hash = 2166136261;
  for (const character of value) { hash ^= character.codePointAt(0) ?? 0; hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export class SlackMessagePostFoundation {
  private readonly policy = new ControlledExternalWriteFoundation(SLACK_MESSAGE_POST_PILOT);
  private readonly executedRequests = new Set<string>();
  revoke(): void { this.policy.revoke(); }

  async executeDummy(draft: SlackMessageDraft, preview: SlackMessagePreview, confirmation: ControlledWriteConfirmation | undefined, transport: (body: Readonly<{ channel: string; text: string }>) => Promise<{ ok: true; ts: string }>) {
    if (draft.workspaceId !== SLACK_MESSAGE_POST_PILOT.workspaceId) return { status: 'DENIED' as const, reason: 'SLACK_WORKSPACE_ISOLATION_VIOLATION' };
    if (draft.channelId !== SLACK_MESSAGE_POST_PILOT.channelId) return { status: 'DENIED' as const, reason: 'SLACK_WRITE_CHANNEL_NOT_ALLOWLISTED' };
    if (preview.requestId !== draft.requestId || preview.channelId !== draft.channelId || preview.text !== draft.text.trim()) return { status: 'DENIED' as const, reason: 'PREVIEW_BINDING_INVALID' };
    const request: ControlledWriteRequest = { requestId: draft.requestId, capabilityId: SLACK_MESSAGE_POST_PILOT.capabilityId, provider: SLACK_MESSAGE_POST_PILOT.provider, action: SLACK_MESSAGE_POST_PILOT.action, tenantId: draft.tenantId, expectedTenantId: 'tenant:agm', actorId: draft.actorId, payloadDigest: preview.payloadDigest, requestedAt: draft.createdAt };
    const decision = this.policy.evaluate(request, confirmation);
    if (decision.status === 'DENIED') return decision;
    if (this.executedRequests.has(request.requestId)) return { status: 'DENIED' as const, reason: 'DUPLICATE_EXECUTION_DENIED', receipt: decision.receipt };
    this.executedRequests.add(request.requestId);
    const providerResult = await transport(Object.freeze({ channel: draft.channelId, text: preview.text }));
    return { status: 'SUCCESS' as const, reason: 'DUMMY_PROVIDER_ACCEPTED', receipt: decision.receipt, providerResult };
  }
}
