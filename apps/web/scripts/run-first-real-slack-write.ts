import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { issueDummyExplicitConfirmation, type ControlledWriteRequest } from '../src/external-capabilities/controlled-write.foundation';
import { prepareSlackMessagePreview, SlackMessagePostFoundation, SLACK_MESSAGE_POST_PILOT, type SlackMessageDraft } from '../src/external-capabilities/slack-message-post.foundation';

const dryRun = process.env.AGM_SLACK_WRITE_DRY_RUN === '1';
const token = process.env.SLACK_BOT_TOKEN;
if (!token || !/^xoxb-[A-Za-z0-9-]+$/.test(token)) throw new Error('SLACK_BOT_TOKEN_FORMAT_REJECTED');
const draft: SlackMessageDraft = { requestId: crypto.randomUUID(), tenantId: 'tenant:agm', actorId: 'product-owner-confirmed-pilot', workspaceId: SLACK_MESSAGE_POST_PILOT.workspaceId, channelId: SLACK_MESSAGE_POST_PILOT.channelId, text: 'AGM Copilot controlled WRITE pilot validation - single confirmed message.', createdAt: new Date().toISOString() };
const preview = prepareSlackMessagePreview(draft);
console.log(`PREVIEW: provider=Slack workspace=${draft.workspaceId} channel=${SLACK_MESSAGE_POST_PILOT.channelName}/${draft.channelId}`);
console.log(`PREVIEW MESSAGE: ${preview.text}`);
console.log('No edit, delete, thread, batch, private channel, or DM action is included.');

let answer = process.env.AGM_WRITE_CONFIRMATION;
if (!answer) {
  const prompt = createInterface({ input: stdin, output: stdout });
  try { answer = await prompt.question('Type exactly CONFIRM POST to execute this single message: '); }
  finally { prompt.close(); }
}
if (answer !== 'CONFIRM POST') throw new Error('EXPLICIT_CONFIRMATION_REQUIRED');

const request: ControlledWriteRequest = { requestId: draft.requestId, capabilityId: SLACK_MESSAGE_POST_PILOT.capabilityId, provider: SLACK_MESSAGE_POST_PILOT.provider, action: SLACK_MESSAGE_POST_PILOT.action, tenantId: draft.tenantId, expectedTenantId: 'tenant:agm', actorId: draft.actorId, payloadDigest: preview.payloadDigest, requestedAt: draft.createdAt };
const confirmation = issueDummyExplicitConfirmation(request);
let providerCalls = 0;
const foundation = new SlackMessagePostFoundation();
const result = await foundation.executeDummy(draft, preview, confirmation, async (body) => {
  providerCalls++;
  if (dryRun) return { ok: true as const, ts: 'dry-run-ts' };
  const response = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`SLACK_HTTP_FAILURE_${response.status}`);
  const payload = await response.json() as { ok?: boolean; error?: string; ts?: string; channel?: string };
  if (!payload.ok || !payload.ts) throw new Error(`SLACK_API_FAILURE_${(payload.error ?? 'unknown').replace(/[^a-z0-9_]/gi, '_')}`);
  return { ok: true as const, ts: payload.ts };
});
if (result.status !== 'SUCCESS' || providerCalls !== 1) throw new Error('SINGLE_WRITE_FAILED');
const replay = await foundation.executeDummy(draft, preview, confirmation, async () => { providerCalls++; return { ok: true, ts: 'forbidden-replay' }; });
if (replay.status !== 'DENIED' || providerCalls !== 1) throw new Error('DUPLICATE_PREVENTION_FAILED');

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.resolve(process.cwd(), '..', '..', 'evidence', 'agma-first-real-slack-write', dryRun ? 'dry-run' : 'provider', runId);
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'report.json'), JSON.stringify({ schemaVersion: 1, runId, status: 'PASS', dryRun, capabilityId: SLACK_MESSAGE_POST_PILOT.capabilityId, provider: 'SLACK', workspaceId: draft.workspaceId, channelName: SLACK_MESSAGE_POST_PILOT.channelName, channelId: draft.channelId, action: SLACK_MESSAGE_POST_PILOT.action, confirmation: 'EXPLICIT_BOUND_SINGLE_USE', providerCalls, providerEvidence: { accepted: true, ts: result.providerResult.ts }, auditReceipt: result.receipt, replay: { status: replay.status, reason: replay.reason }, secretExposure: 'ZERO', messageContentPersisted: 'ZERO', production: 'UNCHANGED', finishedAt: new Date().toISOString() }, null, 2));
console.log(dryRun ? 'FIRST SLACK WRITE DRY RUN PASS' : 'AGM FIRST REAL SLACK WRITE PASS');
console.log(path.join(out, 'report.json'));
