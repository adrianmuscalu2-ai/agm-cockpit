import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  P1ControlPlane,
  renderVisibleTurnStatus,
  type Identity,
  type SignedEvent,
} from '../packages/copilot-control-plane/src/index';

const tenantId = 'tenant-agm-p1-isolated';
const signingKey = Buffer.from('p1-dummy-signing-key-only-for-isolated-test-0001');
const operator: Identity = { principalId: 'p1-operator', workloadId: 'p1-control-plane', tenantId, roles: ['CONTROL_PLANE_OPERATOR'] };
const viewer: Identity = { principalId: 'turn-viewer', workloadId: 'turn-read-model', tenantId, roles: ['TURN_VIEWER'] };
const custodian: Identity = { principalId: 'turn-custodian', workloadId: 'turn-custodian', tenantId, roles: ['TURN_CUSTODIAN'] };
const cases: Array<{ id: string; result: 'PASS' | 'FAIL'; detail: string }> = [];
const test = async (id: string, fn: () => void | Promise<void>) => {
  try { await fn(); cases.push({ id, result: 'PASS', detail: 'validated' }); }
  catch (error) { cases.push({ id, result: 'FAIL', detail: error instanceof Error ? error.message : 'UNKNOWN' }); }
};

const control = new P1ControlPlane({ tenantId, signingKeyId: 'p1-dummy-key', signingKey });

async function main() {
await test('control-plane-bootstrap-and-e2e-visible-status', () => {
  const result = control.transition({ identity: operator, aggregateId: 'control-plane-main', status: 'ACTIVE', now: '2026-08-13T12:00:00.000Z', projectedAt: '2026-08-13T12:00:00.125Z', correlationId: 'corr-1', eventId: 'evt-p1-1' });
  assert.equal(result.state.status, 'ACTIVE');
  assert.equal(result.validation.valid, true);
  assert.equal(result.visible.status, 'ACTIVE');
  assert.equal(result.visible.source, 'P1_CANONICAL_TEST_AUTHORITY');
  assert.equal(result.projection.lagMs, 125);
});

await test('identity-pdp-deny-by-default', () => {
  const denied = control.pdp.evaluate({ identity: viewer, action: 'control-plane:transition', resourceTenantId: tenantId });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'DENY_BY_DEFAULT');
});

await test('tenant-boundary-denied', () => {
  const denied = control.pdp.evaluate({ identity: operator, action: 'control-plane:transition', resourceTenantId: 'tenant-other' });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'TENANT_MISMATCH');
});

await test('turn-and-custodian-have-no-canonical-authority', () => {
  for (const identity of [viewer, custodian]) {
    const denied = control.pdp.evaluate({ identity, action: 'control-plane:transition', resourceTenantId: tenantId });
    assert.equal(denied.allowed, false);
  }
  assert.equal('transition' in control.projector, false);
  assert.equal('publish' in control.custodian, false);
});

await test('signed-envelope-tamper-denied', () => {
  const event = control.journal.events()[0];
  const tampered = { ...event, sanitizedPayload: { status: 'FAILED' as const } };
  const isolated = new P1ControlPlane({ tenantId, signingKeyId: 'p1-dummy-key', signingKey });
  assert.deepEqual(isolated.gate.validate(tampered), { valid: false, reason: 'INVALID_SIGNATURE' });
});

await test('wrong-signing-key-denied', () => {
  const isolated = new P1ControlPlane({ tenantId, signingKeyId: 'other-key', signingKey: Buffer.from('different-dummy-signing-key-only-for-test-000000') });
  assert.deepEqual(isolated.gate.validate(control.journal.events()[0]), { valid: false, reason: 'INVALID_SIGNATURE' });
});

await test('duplicate-event-journal-denied', () => {
  const event = control.journal.events()[0];
  assert.deepEqual(control.journal.append(event), { accepted: false, reason: 'DUPLICATE_EVENT' });
});

await test('revision-gap-denied', () => {
  const base = control.journal.events()[0];
  const { signature: _signature, ...unsigned } = { ...base, eventId: 'evt-gap', sourceSequence: 3, aggregateRevision: 3, idempotencyKey: 'evt-gap', outboxCommitRef: 'outbox:gap:3' };
  const gap = control.signer.sign(unsigned);
  assert.deepEqual(control.gate.validate(gap), { valid: false, reason: 'REVISION_GAP' });
});

await test('secret-field-denied-before-turn', () => {
  const base = control.journal.events()[0];
  const unsafeUnsigned = { ...base, eventId: 'evt-secret', sourceSequence: 2, aggregateRevision: 2, idempotencyKey: 'evt-secret', outboxCommitRef: 'outbox:secret:2', sanitizedPayload: { status: 'ACTIVE', token: 'dummy-never-real' } };
  const { signature: _signature, ...unsigned } = unsafeUnsigned;
  const unsafe = control.signer.sign(unsigned as never) as SignedEvent;
  assert.deepEqual(control.gate.validate(unsafe), { valid: false, reason: 'SECRET_FIELD_DENIED' });
});

await test('second-canonical-transition-owner-review', () => {
  const result = control.transition({ identity: operator, aggregateId: 'control-plane-main', status: 'OWNER_REVIEW', now: '2026-08-13T12:00:01.000Z', projectedAt: '2026-08-13T12:00:01.250Z', correlationId: 'corr-2', eventId: 'evt-p1-2' });
  assert.equal(result.state.revision, 2);
  assert.equal(result.visible.status, 'OWNER_REVIEW');
});

await test('stale-state-detection', () => {
  const result = control.custodian.detectStale('control-plane-main', '2026-08-13T12:01:02.000Z', 60_000);
  assert.equal(result.stale, true);
  assert.equal(renderVisibleTurnStatus(control.projector.view('control-plane-main')).status, 'STALE');
});

await test('restart-reconstruction-from-journal', () => {
  const canonicalBefore = control.authority.state('control-plane-main');
  const events = control.journal.events();
  control.projector.clear();
  assert.equal(renderVisibleTurnStatus(control.projector.view('control-plane-main')).status, 'UNAVAILABLE');
  const restarted = new P1ControlPlane({ tenantId, signingKeyId: 'p1-dummy-key', signingKey });
  const restartedRecovery = restarted.custodian.rebuild(events, '2026-08-13T12:02:00.000Z', custodian);
  assert.deepEqual(restartedRecovery, { applied: 2, parity: true });
  assert.equal(restarted.projector.view('control-plane-main')?.sourceStateHash, canonicalBefore?.stateHash);
  const recovery = control.custodian.rebuild(events, '2026-08-13T12:02:01.000Z', custodian);
  assert.deepEqual(recovery, { applied: 2, parity: true });
  const rebuilt = control.projector.view('control-plane-main');
  assert.equal(rebuilt?.canonicalRevision, canonicalBefore?.revision);
  assert.equal(rebuilt?.sourceStateHash, canonicalBefore?.stateHash);
  assert.deepEqual(control.authority.state('control-plane-main'), canonicalBefore);
});

await test('audit-chain-integrity', () => {
  assert.equal(control.audit.verify(), true);
  assert.ok(control.audit.records().some((record) => record.action === 'turn.projection.rebuild'));
});

await test('rollback-path-derived-only', () => {
  const canonicalBefore = control.authority.state('control-plane-main');
  const snapshot = control.projector.snapshot();
  control.projector.clear();
  control.projector.restore(snapshot);
  assert.deepEqual(control.authority.state('control-plane-main'), canonicalBefore);
  assert.equal(control.projector.view('control-plane-main')?.canonicalRevision, 2);
});

const failed = cases.filter((item) => item.result === 'FAIL');
const report = {
  contract: 'agm-copilot-v1.2-p1-walking-skeleton-evidence.v1',
  generatedAt: new Date().toISOString(),
  tenantId,
  secretMode: 'DUMMY_ONLY_NO_REAL_SECRET',
  cases,
  totals: { cases: cases.length, passed: cases.length - failed.length, failed: failed.length },
  canonicalState: control.authority.state('control-plane-main'),
  visibleTurnStatus: renderVisibleTurnStatus(control.projector.view('control-plane-main')),
  journalEvents: control.journal.events().length,
  auditRecords: control.audit.records().length,
  auditIntegrity: control.audit.verify(),
  verdict: failed.length === 0 ? 'PASS' : 'FAIL',
};
await mkdir('evidence/governance/copilot-v1.2/p1/runtime', { recursive: true });
await writeFile('evidence/governance/copilot-v1.2/p1/runtime/walking-skeleton-report.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`P1 WALKING SKELETON — ${report.verdict} (${report.totals.passed}/${report.totals.cases})`);
console.log(`VISIBLE TURN STATUS — ${report.visibleTurnStatus.status} / revision ${report.visibleTurnStatus.revision}`);
if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'P1_TEST_FAILURE');
  process.exitCode = 1;
});
