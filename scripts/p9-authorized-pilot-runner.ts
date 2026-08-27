import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DeclarativeAgentRegistry, RuntimeAdmissionController, EphemeralDossierRuntime } from '../packages/copilot-control-plane/src/p3-runtime';
import { P9PilotController } from '../packages/copilot-control-plane/src/p9-pilot';
import { executeInternalPilotWorkload, P9_INTERNAL_WORKLOAD, reconcileKillSwitchEvidence, validateInternalPilotContract, type InternalPilotContract } from '../packages/copilot-control-plane/src/p9-authorized-pilot-launcher';

async function main() {
  const [mode, configurationPath, output] = process.argv.slice(2);
  if (!mode || !configurationPath || !output || !['ContractSimulation', 'AuthorizedPilot'].includes(mode)) throw new Error('P9_RUNNER_ARGUMENTS_REQUIRED');
  const contract = JSON.parse(await readFile(configurationPath, 'utf8')) as InternalPilotContract;
  validateInternalPilotContract(contract);
  if (mode === 'ContractSimulation' && process.env.AGM_P9_ENABLED === 'true') throw new Error('SIMULATION_REQUIRES_GLOBAL_P9_OFF');
  if (mode === 'AuthorizedPilot' && process.env.AGM_P9_INTERNAL_PILOT_AUTHORIZATION !== 'OWNER_SINGLE_WINDOW') throw new Error('INTERNAL_PILOT_AUTHORIZATION_MISSING');

  const tenantId = 'tenant-agm-p9-internal'; const registry = new DeclarativeAgentRegistry('p9-internal-pilot.v2');
  registry.register({ agentId: 'p9-reader', packageId: 'agm.p9.reader', role: 'INTERNAL_READ', capabilities: ['KNOWLEDGE_READ'], tools: ['CANONICAL_READ'], tenantScope: [tenantId], riskClasses: ['LOW'], runtimePlacement: 'PRE_PRODUCTION', dossierScoped: true, parkingPolicy: 'DESCRIPTOR_ONLY', enabled: true });
  const runtime = new EphemeralDossierRuntime(new RuntimeAdmissionController(registry));
  const pilot = new P9PilotController(tenantId, runtime, { enabled: true, autoStart: false, promoted: false, trafficAllowed: false, killSwitchActive: false });
  const startedAt = new Date().toISOString(); const pilotBefore = pilot.status(); let workerId = ''; let cleanup;
  try {
    pilot.admit(new Date().toISOString(), true);
    const worker = runtime.start({ agentId: 'p9-reader', tenantId, dossierId: contract.executionId, riskClass: 'LOW', capabilities: ['KNOWLEDGE_READ'], tools: ['CANONICAL_READ'], now: new Date().toISOString(), leaseMs: 60_000 });
    workerId = worker.workerId; pilot.track(worker, new Date().toISOString());
    const expectedIdentity = { workerId: worker.workerId, dossierId: contract.executionId, fence: worker.lease.fence };
    const measured = await executeInternalPilotWorkload(contract, async (_operationId, signal) => {
      if (signal.aborted) throw Object.assign(new Error('timeout'), { name: 'AbortError' });
      const accepted = runtime.commit(worker.workerId, worker.lease.fence, new Date().toISOString());
      if (!accepted.accepted) throw new Error('P9_COMMIT_REJECTED');
      return { workerId: accepted.workerId, dossierId: accepted.dossierId, fence: accepted.fence, identityVerified: true };
    }, expectedIdentity);
    pilot.stop(new Date().toISOString(), 'INTERNAL_PILOT_COMPLETE'); const certification = pilot.certifyKillSwitch(new Date().toISOString());
    cleanup = { workersBefore: 1, workersAfter: pilot.activeWorkers(), attestations: runtime.cleanup().length, killSwitchCertified: certification.pass };
    if (cleanup.workersAfter !== 0 || cleanup.attestations < 1 || !cleanup.killSwitchCertified) throw new Error('P9_CLEANUP_ATTESTATION_FAILED');
    const attestedResults = measured.results.map((result) => ({ ...result, cleanupState: 'ATTESTED' as const }));
    const pilotAfter = pilot.status();
    const killSwitchEvidence = reconcileKillSwitchEvidence({ killSwitchDefault: 'ACTIVE' }, { pilotAfter, cleanup });
    const evidence = { contract: 'agm-p9-internal-pilot-evidence.v2', mode, execution: contract, startedAt, finishedAt: new Date().toISOString(), pid: process.pid, parentPid: process.ppid, identity: 'P9_INTERNAL_PILOT_RUNNER', operation: P9_INTERNAL_WORKLOAD, results: attestedResults, metrics: measured.metrics, pilotBefore, pilotAfter, killSwitchEvidence, cleanup, httpTraffic: 0, secretsRecorded: false };
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
  } catch (error) {
    pilot.fail(new Date().toISOString(), 'INTERNAL_PILOT_FAILURE'); pilot.certifyKillSwitch(new Date().toISOString());
    throw error;
  } finally {
    if (workerId && runtime.session(workerId)?.state === 'STARTED') runtime.stop(workerId, new Date().toISOString());
  }
}
void main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
