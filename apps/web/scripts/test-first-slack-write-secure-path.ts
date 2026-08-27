import assert from 'node:assert/strict';
import { issueDummyExplicitConfirmation, type ControlledWriteRequest } from '../src/external-capabilities/controlled-write.foundation';
import { prepareSlackMessagePreview, SlackMessagePostFoundation, SLACK_MESSAGE_POST_PILOT, type SlackMessageDraft } from '../src/external-capabilities/slack-message-post.foundation';

const draft: SlackMessageDraft = { requestId: 'slack-write-dummy-1', tenantId: 'tenant:agm', actorId: 'owner-dummy', workspaceId: SLACK_MESSAGE_POST_PILOT.workspaceId, channelId: SLACK_MESSAGE_POST_PILOT.channelId, text: 'AGM controlled WRITE dummy preview — no external send', createdAt: new Date().toISOString() };
const preview = prepareSlackMessagePreview(draft);
const request: ControlledWriteRequest = { requestId: draft.requestId, capabilityId: SLACK_MESSAGE_POST_PILOT.capabilityId, provider: SLACK_MESSAGE_POST_PILOT.provider, action: SLACK_MESSAGE_POST_PILOT.action, tenantId: draft.tenantId, expectedTenantId: 'tenant:agm', actorId: draft.actorId, payloadDigest: preview.payloadDigest, requestedAt: draft.createdAt };
let transportCalls = 0;
const transport = async (body: Readonly<{channel:string;text:string}>) => { transportCalls++; assert.equal(body.channel, 'C0BJ9R1NPEJ'); return { ok: true as const, ts: 'dummy-ts' }; };

assert.equal((await new SlackMessagePostFoundation().executeDummy(draft, preview, undefined, transport)).status, 'DENIED');
assert.equal((await new SlackMessagePostFoundation().executeDummy(draft, preview, { ...issueDummyExplicitConfirmation(request), explicit: false }, transport)).status, 'DENIED');
const expired = { ...issueDummyExplicitConfirmation(request), expiresAt: new Date(Date.now() - 1000).toISOString() };
assert.equal((await new SlackMessagePostFoundation().executeDummy(draft, preview, expired, transport)).reason, 'CONFIRMATION_EXPIRED');
assert.equal((await new SlackMessagePostFoundation().executeDummy({ ...draft, channelId: 'C-NOT-ALLOWED' }, preview, issueDummyExplicitConfirmation(request), transport)).status, 'DENIED');
assert.equal((await new SlackMessagePostFoundation().executeDummy({ ...draft, workspaceId: 'T-WRONG' }, preview, issueDummyExplicitConfirmation(request), transport)).status, 'DENIED');

const foundation = new SlackMessagePostFoundation();
const confirmation = issueDummyExplicitConfirmation(request);
const success = await foundation.executeDummy(draft, preview, confirmation, transport);
assert.equal(success.status, 'SUCCESS');
assert.equal(transportCalls, 1);
const replay = await foundation.executeDummy(draft, preview, confirmation, transport);
assert.equal(replay.status, 'DENIED'); assert.equal(transportCalls, 1);

const revoked = new SlackMessagePostFoundation(); revoked.revoke();
assert.equal((await revoked.executeDummy(draft, preview, issueDummyExplicitConfirmation(request), transport)).status, 'DENIED');
assert.equal(transportCalls, 1);
assert.equal(SLACK_MESSAGE_POST_PILOT.requiredAdditionalScope, 'chat:write');
assert.doesNotMatch(JSON.stringify({ success, replay }), /token|secret|credential|xoxb-/i);
console.log('FIRST REAL SLACK WRITE SECURE PATH - PASS / NO REAL WRITE');
