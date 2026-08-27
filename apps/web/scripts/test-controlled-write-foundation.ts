import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ControlledExternalWriteFoundation, issueDummyExplicitConfirmation, type ControlledWriteRequest } from '../src/external-capabilities/controlled-write.foundation';

const base: ControlledWriteRequest = { requestId: 'write-foundation-1', capabilityId: 'CONTROLLED_EXTERNAL_WRITE_FOUNDATION', provider: 'FOUNDATION_DUMMY_PROVIDER', action: 'CONTROLLED_WRITE_HANDOFF', tenantId: 'tenant:agm', expectedTenantId: 'tenant:agm', actorId: 'owner-dummy', payloadDigest: 'sha256:dummy-payload-v1', requestedAt: new Date().toISOString() };
const receipts = [];

const noConfirmationPolicy = new ControlledExternalWriteFoundation();
let decision = noConfirmationPolicy.evaluate(base);
assert.equal(decision.status, 'DENIED'); assert.equal(decision.reason, 'EXPLICIT_CONFIRMATION_REQUIRED'); receipts.push(decision.receipt);

decision = new ControlledExternalWriteFoundation().evaluate(base, { ...issueDummyExplicitConfirmation(base), explicit: false });
assert.equal(decision.reason, 'EXPLICIT_CONFIRMATION_REQUIRED'); receipts.push(decision.receipt);

const allowedPolicy = new ControlledExternalWriteFoundation();
const explicit = issueDummyExplicitConfirmation(base);
decision = allowedPolicy.evaluate(base, explicit);
assert.equal(decision.status, 'POLICY_ALLOWED'); receipts.push(decision.receipt);

decision = new ControlledExternalWriteFoundation().evaluate({ ...base, provider: 'EVIL_PROVIDER' }, issueDummyExplicitConfirmation(base));
assert.equal(decision.reason, 'PROVIDER_NOT_ALLOWLISTED'); receipts.push(decision.receipt);

decision = new ControlledExternalWriteFoundation().evaluate({ ...base, action: 'BATCH_WRITE' }, issueDummyExplicitConfirmation(base));
assert.equal(decision.reason, 'ACTION_NOT_ALLOWLISTED'); receipts.push(decision.receipt);

decision = new ControlledExternalWriteFoundation().evaluate({ ...base, tenantId: 'tenant:other' }, issueDummyExplicitConfirmation(base));
assert.equal(decision.reason, 'TENANT_ISOLATION_VIOLATION'); receipts.push(decision.receipt);

const revokedPolicy = new ControlledExternalWriteFoundation(); revokedPolicy.revoke();
decision = revokedPolicy.evaluate(base, issueDummyExplicitConfirmation(base));
assert.equal(decision.reason, 'PERMISSION_REVOKED'); receipts.push(decision.receipt);

decision = allowedPolicy.evaluate(base, explicit);
assert.equal(decision.reason, 'CONFIRMATION_REPLAY_DENIED'); receipts.push(decision.receipt);

const changedPayload = { ...base, payloadDigest: 'sha256:changed' };
decision = new ControlledExternalWriteFoundation().evaluate(changedPayload, issueDummyExplicitConfirmation(base));
assert.equal(decision.reason, 'CONFIRMATION_BINDING_INVALID'); receipts.push(decision.receipt);

assert.equal(receipts.length, 9);
assert.ok(receipts.every((receipt) => receipt.receiptId && receipt.access === 'WRITE' && receipt.attempts === 0));
assert.doesNotMatch(JSON.stringify(receipts), /token|secret|credential|password|xoxb-/i);

const source = readFileSync(new URL('../src/external-capabilities/controlled-write.foundation.ts', import.meta.url), 'utf8');
assert.doesNotMatch(source, /fetch\(|https?:\/\/|SLACK_BOT_TOKEN|chat\.postMessage/);
console.log('AGM COPILOT CONTROLLED WRITE FOUNDATION - PASS');
