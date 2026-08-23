import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { DeclarativeAgentRegistry, EphemeralDossierRuntime, RuntimeAdmissionController } from '../../../packages/copilot-control-plane/src/p3-runtime';
import { HttpTurnLifecycleEventStore, P3TurnLifecycleAdapter, executeP3AgentInspector } from '../../../packages/copilot-control-plane/src/p3-turn-adapter';

function loadEnvironment(path: string) {
  return readFile(path, 'utf8').then((content) => {
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  });
}

void (async () => {
  const root = resolve(process.cwd());
  await loadEnvironment(resolve(root, '.env'));
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({ where: { status: 'Active' }, orderBy: { createdAt: 'asc' } });
    assert.ok(user, 'ACTIVE_USER_REQUIRED');
    assert.ok(process.env.JWT_SECRET, 'JWT_SECRET_REQUIRED');
    const accessToken = await new JwtService({ secret: process.env.JWT_SECRET }).signAsync({ sub: user.id, companyId: user.companyId, roles: [], scope: 'user' }, { expiresIn: '5m' });
    const registry = new DeclarativeAgentRegistry('turn-runtime-persistent-e2e.v1');
    registry.register({ agentId: 'agent-inspector', packageId: '@agm/agent-inspector', role: 'evidence inspector', capabilities: ['evidence:read'], tools: ['filesystem:read'], tenantScope: [user.companyId], riskClasses: ['LOW'], runtimePlacement: 'P3', dossierScoped: true, parkingPolicy: 'DESCRIPTOR_ONLY', enabled: true });
    const runtime = new EphemeralDossierRuntime(new RuntimeAdmissionController(registry));
    const store = new HttpTurnLifecycleEventStore({ baseUrl: process.env.AGENT_RUNTIME_API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1', accessToken: () => accessToken });
    const adapter = new P3TurnLifecycleAdapter(store);
    const suffix = process.env.AGENT_RUNTIME_RUN_SUFFIX ?? Date.now().toString(36);
    const completedMandateId = `p0-live-completed-${suffix}`;
    const failedMandateId = `p0-live-failed-${suffix}`;
    const common = { agentId: 'agent-inspector', tenantId: user.companyId, riskClass: 'LOW', capabilities: ['evidence:read'], tools: ['filesystem:read'], now: new Date().toISOString(), leaseMs: 30_000, evidenceRoot: root, outputRoot: resolve(root, 'evidence/turn-reality/p0-agent-inspector-e2e') };
    const completed = await executeP3AgentInspector({ ...common, mandateId: completedMandateId, dossierId: `dossier-${completedMandateId}`, evidenceRef: 'evidence/turn-reality/TURN_AGENT_PANEL_INTEGRATION_2026-08-21.md' }, runtime, adapter);
    await assert.rejects(() => executeP3AgentInspector({ ...common, mandateId: failedMandateId, dossierId: `dossier-${failedMandateId}`, evidenceRef: 'evidence/turn-reality/DOES_NOT_EXIST.md' }, runtime, adapter));
    const completedEvents = await store.read(completedMandateId);
    const failedEvents = await store.read(failedMandateId);
    assert.deepEqual(completedEvents.map((event) => event.lifecycle), ['STARTED', 'WORKING', 'COMPLETED']);
    assert.deepEqual(failedEvents.map((event) => event.lifecycle), ['STARTED', 'WORKING', 'FAILED']);
    const evidence = { contract: 'agm.turn-agent-runtime-persistent-e2e.v1', checkedAt: new Date().toISOString(), completedMandateId, failedMandateId, completedEvents, failedEvents, outputRef: completed.result.outputRef, evidenceHash: completed.result.evidenceHash, result: 'PASS' };
    const evidenceRoot = resolve(root, 'evidence/turn-reality/p0-agent-runtime-live');
    await mkdir(evidenceRoot, { recursive: true });
    const evidencePath = resolve(evidenceRoot, 'persistent-api-e2e.json');
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
    console.log(JSON.stringify({ result: 'PASS', completedMandateId, failedMandateId, completedLifecycle: completedEvents.map((event) => event.lifecycle), failedLifecycle: failedEvents.map((event) => event.lifecycle), evidencePath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
