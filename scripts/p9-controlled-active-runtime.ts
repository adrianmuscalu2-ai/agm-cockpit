import { mkdir, writeFile } from 'node:fs/promises';
import { DeclarativeAgentRegistry, RuntimeAdmissionController, EphemeralDossierRuntime } from '../packages/copilot-control-plane/src/p3-runtime';
import { P9PilotController, projectP9Turn, parseP9FeatureFlag } from '../packages/copilot-control-plane/src/p9-pilot';

async function main() {
  const enabled = parseP9FeatureFlag(process.env.AGM_P9_ENABLED);
  const ownerAuthorization = process.env.AGM_P9_OWNER_AUTHORIZATION === 'CONTROLLED_INTERNAL_ONLY';
  if (!enabled || !ownerAuthorization) throw new Error('P9_LAUNCH_NOT_AUTHORIZED');

  const output = process.argv[2] ?? 'tmp/p9-controlled-active.json'; const tenant = 'tenant-agm-p9-controlled';
  const registry = new DeclarativeAgentRegistry('p9-controlled.v1');
  registry.register({ agentId: 'p9-reader', packageId: 'agm.p9.reader', role: 'INTERNAL_READ', capabilities: ['KNOWLEDGE_READ'], tools: ['CANONICAL_READ'], tenantScope: [tenant], riskClasses: ['LOW'], runtimePlacement: 'PRE_PRODUCTION', dossierScoped: true, parkingPolicy: 'DESCRIPTOR_ONLY', enabled: true });
  const admission = new RuntimeAdmissionController(registry); const runtime = new EphemeralDossierRuntime(admission);
  const pilot = new P9PilotController(tenant, runtime, { enabled: true, autoStart: false, promoted: false, trafficAllowed: false, killSwitchActive: false });
  const now = () => new Date().toISOString(); pilot.admit(now(), true);
  for (let index = 0; index < 4; index += 1) { const worker = runtime.start({ agentId: 'p9-reader', tenantId: tenant, dossierId: `controlled-${index}`, riskClass: 'LOW', capabilities: ['KNOWLEDGE_READ'], tools: ['CANONICAL_READ'], now: now(), leaseMs: 60_000 }); pilot.track(worker, now()); }
  await mkdir(output.replace(/[\\/][^\\/]+$/, ''), { recursive: true });
  await writeFile(output, `${JSON.stringify({ contract: 'agm-p9-controlled-active-runtime.v2', at: now(), state: 'ACTIVE', workers: pilot.activeWorkers(), readOnly: true, externalWrites: 0, productionChanges: 0, events: projectP9Turn(pilot.events()) }, null, 2)}\n`);
  console.log('P9 CONTROLLED ACTIVE - READY'); setInterval(() => {}, 1_000);
}

void main();
