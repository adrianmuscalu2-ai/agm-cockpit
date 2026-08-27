import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertOperationIdentity, executeInternalPilotWorkload, P9_INTERNAL_WORKLOAD, percentile, reconcileKillSwitchEvidence, summarizeInternalOperations, validateInternalPilotContract, type InternalPilotContract } from '../packages/copilot-control-plane/src/p9-authorized-pilot-launcher';
const valid: InternalPilotContract = { executionId: 'static-contract-001', workload: P9_INTERNAL_WORKLOAD, operationCount: 3, cadenceMs: 0, timeoutMs: 100, maximumWindowMs: 300 };
const identity = { workerId: 'worker-test', dossierId: valid.executionId, fence: 1 };
let passed = 0; async function test(name: string, body: () => unknown | Promise<unknown>) { await body(); passed++; console.log(`PASS ${name}`); }
async function main() {
  await test('all-workload-parameters-are-required', () => { for (const key of Object.keys(valid)) assert.throws(() => validateInternalPilotContract({ ...valid, [key]: undefined } as never)); });
  await test('contract-rejects-invalid-workload-volume-cadence-timeout-window-and-id', () => {
    assert.throws(() => validateInternalPilotContract({ ...valid, workload: 'HTTP' as never }), /WORKLOAD/);
    assert.throws(() => validateInternalPilotContract({ ...valid, operationCount: 0 }), /COUNT/);
    assert.throws(() => validateInternalPilotContract({ ...valid, cadenceMs: -1 }), /CADENCE/);
    assert.throws(() => validateInternalPilotContract({ ...valid, timeoutMs: 0 }), /TIMEOUT/);
    assert.throws(() => validateInternalPilotContract({ ...valid, maximumWindowMs: 1 }), /WINDOW/);
    assert.throws(() => validateInternalPilotContract({ ...valid, executionId: 'x' }), /EXECUTION/);
  });
  await test('nearest-rank-statistics', () => { assert.equal(percentile([1, 2, 3, 4, 100], 50), 3); assert.equal(percentile([1, 2, 3, 4, 100], 95), 100); });
  await test('deterministic-internal-workload-counts-results', async () => {
    const times = [0, 5, 10, 20, 30, 60].map((ms) => new Date(1_755_216_000_000 + ms));
    const measured = await executeInternalPilotWorkload(valid, async () => ({ ...identity, identityVerified: true }), identity, () => times.shift()!, async () => {});
    assert.deepEqual(measured.metrics, { planned: 3, started: 3, completed: 3, successes: 3, errors: 0, timeouts: 0, p50Ms: 10, p95Ms: 30, maximumMs: 30 });
  });
  await test('timeout-and-errors-are-contractual-and-redacted', async () => {
    const timeout = await executeInternalPilotWorkload({ ...valid, operationCount: 1, timeoutMs: 2, maximumWindowMs: 2 }, async (_id, signal) => new Promise((_r, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('secret'), { name: 'AbortError' })))), identity, undefined, async () => {});
    assert.equal(timeout.metrics.timeouts, 1); assert.doesNotMatch(JSON.stringify(timeout), /secret/);
    const error = summarizeInternalOperations([{ operationId: 'x', startedAt: 'a', finishedAt: 'b', latencyMs: 1, outcome: 'OPERATION_ERROR', errorCode: 'P9_OPERATION_ERROR', ...identity, identityVerified: false, operationTimestamp: 'a', cleanupState: 'PENDING_WINDOW_CLEANUP' }]); assert.equal(error.errors, 1);
  });
  await test('timeout-is-enforced-for-an-uncooperative-operation', async () => {
    const measured = await executeInternalPilotWorkload({ ...valid, operationCount: 1, timeoutMs: 2, maximumWindowMs: 2 }, async () => new Promise(() => {}), identity, undefined, async () => {});
    assert.equal(measured.metrics.timeouts, 1); assert.equal(measured.metrics.completed, 1);
  });
  await test('worker-dossier-or-fence-mismatch-fails-closed', () => {
    assert.throws(() => assertOperationIdentity({ ...identity, workerId: 'wrong', identityVerified: true }, identity), /IDENTITY_MISMATCH/);
    assert.throws(() => assertOperationIdentity({ ...identity, dossierId: 'wrong', identityVerified: true }, identity), /IDENTITY_MISMATCH/);
    assert.throws(() => assertOperationIdentity({ ...identity, fence: 2, identityVerified: true }, identity), /IDENTITY_MISMATCH/);
  });
  await test('runner-imports-internal-p9-and-has-no-http', async () => {
    const runner = await readFile('scripts/p9-authorized-pilot-runner.ts', 'utf8');
    assert.match(runner, /P9PilotController/); assert.match(runner, /runtime\.commit/); assert.doesNotMatch(runner, /fetch\(|health\/ready|https?:\/\//);
  });
  await test('api-app-module-remains-disconnected-from-p9', async () => { const app = await readFile('apps/api/src/app.module.ts', 'utf8'); assert.doesNotMatch(app, /P9|p9-pilot|copilot-control-plane/); });
  await test('schema-and-contract-require-v2-fields', async () => {
    const schema = JSON.parse(await readFile('config/copilot-v1.2/p9-authorized-pilot-evidence.schema.json', 'utf8'));
    const contract = JSON.parse(await readFile('config/copilot-v1.2/p9-internal-pilot-contract.json', 'utf8'));
    assert.equal(schema.properties.httpTraffic.const, 0); assert.equal(contract.workload, P9_INTERNAL_WORKLOAD);
    for (const field of ['executionId', 'operationCount', 'cadenceMs', 'timeoutMs', 'maximumWindowMs']) assert.ok(contract.requiredParameters.includes(field));
  });
  await test('persistent-kill-switch-is-canonical-and-temporary-state-is-labeled', () => {
    const reconciled = reconcileKillSwitchEvidence({ killSwitchDefault: 'ACTIVE' }, { pilotAfter: { killSwitchActive: false }, cleanup: { killSwitchCertified: true, workersAfter: 0 } });
    assert.equal(reconciled.persistent.state, 'ACTIVE'); assert.equal(reconciled.temporaryPilotConfiguration.killSwitchActive, false);
    assert.equal(reconciled.temporaryPilotConfiguration.semantic, 'AUTHORIZED_WINDOW_ADMISSION_CONFIGURATION'); assert.equal(reconciled.effectiveFinalState, 'ACTIVE');
    assert.throws(() => reconcileKillSwitchEvidence({ killSwitchDefault: 'INACTIVE' }, { pilotAfter: { killSwitchActive: false }, cleanup: { killSwitchCertified: true, workersAfter: 0 } }), /PERSISTENT/);
  });
  console.log(`P9 INTERNAL PILOT ARCHITECTURE PASS ${passed}/${passed}; P9_FLAG=OFF; API_TRAFFIC=0`);
}
void main();
