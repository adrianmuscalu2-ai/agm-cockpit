import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { DeclarativeAgentRegistry, RuntimeAdmissionController, EphemeralDossierRuntime } from '../src/p3-runtime';
import { InMemoryTurnLifecycleEventStore, P3TurnLifecycleAdapter, executeP3AgentInspector } from '../src/p3-turn-adapter';

const root = resolve(process.cwd());
const mandateId = 'mandate-p0-agent-inspector-e2e';
const registry = new DeclarativeAgentRegistry('turn-runtime-e2e.v1');
registry.register({ agentId: 'agent-inspector', packageId: '@agm/agent-inspector', role: 'evidence inspector', capabilities: ['evidence:read'], tools: ['filesystem:read'], tenantScope: ['premium-e2e'], riskClasses: ['LOW'], runtimePlacement: 'P3', dossierScoped: true, parkingPolicy: 'DESCRIPTOR_ONLY', enabled: true });
const runtime = new EphemeralDossierRuntime(new RuntimeAdmissionController(registry));
const store = new InMemoryTurnLifecycleEventStore();
const adapter = new P3TurnLifecycleAdapter(store);
const outputRoot = resolve(root, 'evidence/turn-reality/p0-agent-inspector-e2e');
void (async () => {
  const execution = await executeP3AgentInspector({ agentId: 'agent-inspector', mandateId, tenantId: 'premium-e2e', dossierId: 'dossier-p0-agent-inspector', riskClass: 'LOW', capabilities: ['evidence:read'], tools: ['filesystem:read'], now: new Date().toISOString(), leaseMs: 30_000, evidenceRef: 'evidence/turn-reality/TURN_AGENT_PANEL_INTEGRATION_2026-08-21.md', evidenceRoot: root, outputRoot }, runtime, adapter);
  const events = await store.read(mandateId);
  assert.deepEqual(events.map((event) => event.lifecycle), ['STARTED', 'WORKING', 'COMPLETED']);
  assert.equal(execution.result.verdict, 'PASS');
  assert.equal(execution.session.mandateId, mandateId);
  const failedMandateId = `${mandateId}-failed`;
  await assert.rejects(() => executeP3AgentInspector({ agentId: 'agent-inspector', mandateId: failedMandateId, tenantId: 'premium-e2e', dossierId: 'dossier-p0-agent-inspector-failed', riskClass: 'LOW', capabilities: ['evidence:read'], tools: ['filesystem:read'], now: new Date().toISOString(), leaseMs: 30_000, evidenceRef: 'evidence/turn-reality/DOES_NOT_EXIST.md', evidenceRoot: root, outputRoot }, runtime, adapter));
  const failedEvents = await store.read(failedMandateId);
  assert.deepEqual(failedEvents.map((event) => event.lifecycle), ['STARTED', 'WORKING', 'FAILED']);
  console.log(JSON.stringify({ verdict: 'FIRST REAL TURN AGENT E2E', status: 'PASS', mandateId, agentId: 'agent-inspector', workerId: execution.session.workerId, completedLifecycle: events, failedMandateId, failedLifecycle: failedEvents, evidenceRef: execution.result.evidenceRef, outputRef: execution.result.outputRef, evidenceHash: execution.result.evidenceHash, outputHash: execution.result.outputHash }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
