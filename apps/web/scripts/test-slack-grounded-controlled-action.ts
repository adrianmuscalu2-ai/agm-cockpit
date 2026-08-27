import assert from 'node:assert/strict';
import type { ControlledExternalAdapter } from '../src/external-capabilities/external-capability.executor';
import { SlackGroundedControlledAction } from '../src/external-capabilities/slack-grounded-controlled-action';
import { AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST } from '../src/external-capabilities/slack-readonly.policy';

let reads = 0;
let writes = 0;
const readAdapter: ControlledExternalAdapter = { async invoke() { reads += 1; return { messages: [{ text: 'Atlas rollout este pregătit pentru verificare.' }] }; } };
const writeTransport = async () => { writes += 1; return { ok: true as const, ts: 'dummy-ts' }; };
const target = [{ channelName: 'testing', channelId: AGM_SLACK_PUBLIC_CHANNEL_ALLOWLIST.testing }] as const;
const input = { question: 'Care este situația Atlas?', targets: target, actorId: 'owner', queryId: 'gca-valid' } as const;

const absent = new SlackGroundedControlledAction();
assert.equal((await absent.ground({ ...input, queryId: 'gca-absent' }, readAdapter)).phase, 'GROUNDED');
assert.equal(absent.propose('Publică actualizarea Atlas', 'owner').phase, 'PROPOSED');
assert.equal((await absent.execute(writeTransport)).phase, 'DENIED');
assert.equal(writes, 0);

const ambiguous = new SlackGroundedControlledAction();
await ambiguous.ground({ ...input, queryId: 'gca-ambiguous' }, readAdapter);
ambiguous.propose('Publică actualizarea Atlas', 'owner');
assert.equal(ambiguous.confirm('da').phase, 'DENIED');
assert.equal(writes, 0);

const revised = new SlackGroundedControlledAction();
await revised.ground({ ...input, queryId: 'gca-revised' }, readAdapter);
revised.propose('Mesaj inițial Atlas', 'owner');
revised.confirm('CONFIRM POST');
assert.equal(revised.revise('Mesaj modificat Atlas').phase, 'PROPOSED');
assert.equal((await revised.execute(writeTransport)).phase, 'DENIED');
assert.equal(writes, 0);

const revoked = new SlackGroundedControlledAction();
await revoked.ground({ ...input, queryId: 'gca-revoked' }, readAdapter);
revoked.propose('Nu publica după revocare', 'owner');
revoked.confirm('CONFIRM POST');
revoked.revoke();
assert.equal((await revoked.execute(writeTransport)).phase, 'DENIED');
assert.equal(writes, 0);

const valid = new SlackGroundedControlledAction();
const grounded = await valid.ground(input, readAdapter);
assert.equal(grounded.phase, 'GROUNDED');
const proposed = valid.propose('Publică actualizarea grounded Atlas', 'owner');
assert.equal(proposed.phase, 'PROPOSED');
if (proposed.phase !== 'PROPOSED' || proposed.action.phase !== 'PREVIEW') throw new Error('PREVIEW_NOT_PRESENT');
assert.equal(proposed.action.preview.text, 'Publică actualizarea grounded Atlas');
assert.equal(valid.confirm('CONFIRM POST').phase, 'PROPOSED');
const completed = await valid.execute(writeTransport);
assert.equal(completed.phase, 'COMPLETED');
if (completed.phase !== 'COMPLETED') throw new Error('ACTION_NOT_COMPLETED');
assert.equal(completed.readReceiptIds.length, 1);
assert.ok(completed.writeReceiptId);
assert.equal(writes, 1);
assert.equal((await valid.execute(writeTransport)).phase, 'DENIED');
assert.equal(writes, 1);
assert.equal(reads, 5);
assert.doesNotMatch(JSON.stringify({ grounded, proposed, completed }), /xoxb-|bearer|credential|api[_-]?key/i);

console.log('AGM COPILOT GROUNDED CONTROLLED ACTION - PASS');
