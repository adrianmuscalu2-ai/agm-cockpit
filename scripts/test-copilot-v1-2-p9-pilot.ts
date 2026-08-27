import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DeclarativeAgentRegistry, RuntimeAdmissionController, EphemeralDossierRuntime } from '../packages/copilot-control-plane/src/p3-runtime';
import { P9PilotController, P9_DISABLED_BY_DEFAULT, parseP9FeatureFlag, projectP9Turn, type P9FeatureConfiguration } from '../packages/copilot-control-plane/src/p9-pilot';

const tenant = 'tenant-agm-p9-internal';
const now = '2026-08-14T12:00:00.000Z';
const later = '2026-08-14T12:00:01.000Z';
let passed = 0;

function harness(feature: P9FeatureConfiguration = P9_DISABLED_BY_DEFAULT) {
  const registry = new DeclarativeAgentRegistry('p9-registry.v2');
  registry.register({ agentId: 'p9-reader', packageId: 'agm.p9.reader', role: 'INTERNAL_READ', capabilities: ['KNOWLEDGE_READ'], tools: ['CANONICAL_READ'], tenantScope: [tenant], riskClasses: ['LOW'], runtimePlacement: 'PRE_PRODUCTION', dossierScoped: true, parkingPolicy: 'DESCRIPTOR_ONLY', enabled: true });
  const runtime = new EphemeralDossierRuntime(new RuntimeAdmissionController(registry));
  return { runtime, pilot: new P9PilotController(tenant, runtime, feature) };
}

function syntheticEnabled(): P9FeatureConfiguration { return { enabled: true, autoStart: false, promoted: false, trafficAllowed: false, killSwitchActive: false }; }
function worker(runtime: EphemeralDossierRuntime, dossierId = 'synthetic-unit') { return runtime.start({ agentId: 'p9-reader', tenantId: tenant, dossierId, riskClass: 'LOW', capabilities: ['KNOWLEDGE_READ'], tools: ['CANONICAL_READ'], now, leaseMs: 30_000 }); }
async function test(name: string, body: () => unknown | Promise<unknown>) { await body(); passed += 1; console.log(`PASS ${name}`); }

async function main() {
await test('default-contract-is-off', () => assert.deepEqual(P9_DISABLED_BY_DEFAULT, { enabled: false, autoStart: false, promoted: false, trafficAllowed: false, killSwitchActive: true }));
await test('missing-flag-is-off', () => assert.equal(parseP9FeatureFlag(undefined), false));
await test('empty-flag-is-off', () => assert.equal(parseP9FeatureFlag(''), false));
await test('false-and-zero-flags-are-off', () => { assert.equal(parseP9FeatureFlag('false'), false); assert.equal(parseP9FeatureFlag('0'), false); });
await test('invalid-flag-fails-closed', () => assert.throws(() => parseP9FeatureFlag('TRUE'), /P9_FEATURE_FLAG_INVALID/));
await test('default-controller-has-no-route-or-worker', () => assert.deepEqual(harness().pilot.status(), { state: 'BLOCKED', featureEnabled: false, autoStart: false, promoted: false, trafficAllowed: false, killSwitchActive: true, admission: false, providerRoute: false, activeWorkers: 0 }));
await test('default-admission-denied-before-any-runtime-work', () => { const { pilot, runtime } = harness(); assert.throws(() => pilot.admit(now, true), /P9_FEATURE_DISABLED/); assert.equal(pilot.activeWorkers(), 0); assert.equal(runtime.events().length, 0); });
await test('kill-switch-active-denies-synthetic-admission', () => { const { pilot } = harness({ ...P9_DISABLED_BY_DEFAULT, enabled: true }); assert.throws(() => pilot.admit(now, true), /P9_KILL_SWITCH_ACTIVE/); });
await test('unauthorized-runtime-shape-denied', () => { const { runtime } = harness(); assert.throws(() => new P9PilotController(tenant, runtime, { enabled: true, autoStart: false, promoted: true as never, trafficAllowed: false, killSwitchActive: false }), /P9_UNAUTHORIZED_CONFIGURATION/); });
await test('kill-switch-certification-is-complete', () => { const result = harness().pilot.certifyKillSwitch(now); assert.equal(result.pass, true); assert.equal(result.orphanWorkers, 0); assert.equal(result.secretExposure, 'ZERO'); });
await test('external-production-secret-writes-denied', () => { const { pilot } = harness(); assert.throws(() => pilot.writeExternal(), /P9_EXTERNAL_WRITE_DENIED/); assert.throws(() => pilot.production(), /P9_PRODUCTION_DENIED/); assert.throws(() => pilot.secret(), /P9_SECRET_ACCESS_DENIED/); });
await test('synthetic-unit-admission-needs-kill-switch-proof', () => { const { pilot } = harness(syntheticEnabled()); assert.throws(() => pilot.admit(now, false), /P9_KILL_SWITCH_REQUIRED/); });
await test('failure-containment-stops-all-synthetic-workers', () => { const { pilot, runtime } = harness(syntheticEnabled()); pilot.admit(now, true); const first = worker(runtime, 'synthetic-1'); const second = worker(runtime, 'synthetic-2'); pilot.track(first, now); pilot.track(second, now); const incident = pilot.fail(later, 'SYNTHETIC_PROVIDER_FAILURE'); assert.match(incident, /^incident-/); assert.equal(pilot.activeWorkers(), 0); assert.equal(runtime.session(first.workerId)?.state, 'STOPPED'); assert.equal(runtime.session(second.workerId)?.state, 'STOPPED'); assert.equal(runtime.cleanup().length, 2); assert.equal(pilot.status().providerRoute, false); });
await test('stop-also-cleans-synthetic-workers', () => { const { pilot, runtime } = harness(syntheticEnabled()); pilot.admit(now, true); const active = worker(runtime); pilot.track(active, now); pilot.stop(later, 'OWNER_STOP'); assert.equal(runtime.session(active.workerId)?.state, 'STOPPED'); assert.equal(pilot.activeWorkers(), 0); });
await test('disabled-instance-cannot-restore-active-snapshot', () => { const active = harness(syntheticEnabled()).pilot; active.admit(now, true); const snapshot = active.snapshot(); assert.throws(() => harness().pilot.restore(snapshot), /P9_SNAPSHOT_ACTIVATION_DENIED/); });
await test('corrupt-snapshot-denied', () => { const { pilot } = harness(); const snapshot = pilot.snapshot(); assert.throws(() => pilot.restore({ ...snapshot, snapshotHash: 'bad' }), /P9_SNAPSHOT_CORRUPT/); });
await test('event-projection-does-not-expose-runtime-secrets', () => { const { pilot } = harness(); pilot.certifyKillSwitch(now); const serialized = JSON.stringify(projectP9Turn(pilot.events())); assert.doesNotMatch(serialized, /credential|scratch|secret|session/i); });
await test('policy-v2-contract-is-disabled-and-isolated', async () => { const policy = JSON.parse(await readFile('config/copilot-v1.2/p9-pilot-policy.json', 'utf8')); assert.equal(policy.contract, 'agm-copilot-v1.2-p9-pilot-policy.v2'); assert.equal(policy.featureFlag.default, false); assert.equal(policy.featureFlag.autoStart, false); assert.equal(policy.killSwitchDefault, 'ACTIVE'); assert.equal(policy.trafficAllowed, false); assert.equal(policy.officialSoakAutoStart, false); assert.equal(policy.promotionState, 'NOT_PROMOTED'); assert.deepEqual(policy.basicIsolation.synchronousDependencies, []); assert.equal(policy.basicIsolation.failureMode, 'FAIL_CLOSED_P9_ONLY'); });
await test('basic-api-has-no-p9-import-or-startup-wiring', async () => { const files = ['apps/api/src/main.ts', 'apps/api/src/app.module.ts', 'apps/api/src/auth/auth.controller.ts']; for (const file of files) { const source = await readFile(file, 'utf8'); assert.doesNotMatch(source, /p9-pilot|P9PilotController|AGM_P9_ENABLED/); } });
await test('controlled-launcher-requires-flag-and-owner-authorization', async () => { const source = await readFile('scripts/p9-controlled-active-runtime.ts', 'utf8'); assert.match(source, /AGM_P9_ENABLED/); assert.match(source, /AGM_P9_OWNER_AUTHORIZATION/); assert.match(source, /P9_LAUNCH_NOT_AUTHORIZED/); });

console.log(`P9 IMPLEMENTATION STATIC/UNIT CONTRACT PASS ${passed}/${passed}; LIVE_P9_TRAFFIC=0`);
}

void main();
