import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { reconcileKillSwitchEvidence } from '../packages/copilot-control-plane/src/p9-authorized-pilot-launcher';
async function main() {
  const [runnerPath, launcherPath, policyPath, outputPath] = process.argv.slice(2);
  if (!runnerPath || !launcherPath || !policyPath || !outputPath) throw new Error('RECONCILIATION_ARGUMENTS_REQUIRED');
  const parseJson = async (path: string) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  const runner = await parseJson(runnerPath);
  const launcher = await parseJson(launcherPath);
  const policy = await parseJson(policyPath);
  const killSwitchEvidence = reconcileKillSwitchEvidence(policy, runner);
  const reconciled = {
  contract: 'agm-p9-internal-pilot-reconciled-evidence.v1', reconciliationMode: 'ARTIFACT_ONLY_REPLAY',
  executionId: runner.execution.executionId, sourceHashes: {
    runnerEvidence: createHash('sha256').update(await readFile(runnerPath)).digest('hex').toUpperCase(),
    launcherSummary: createHash('sha256').update(await readFile(launcherPath)).digest('hex').toUpperCase(),
    policy: createHash('sha256').update(await readFile(policyPath)).digest('hex').toUpperCase(),
  },
  workloadVerdict: runner.metrics.completed === 5 && runner.metrics.successes === 5 && runner.metrics.errors === 0 && runner.metrics.timeouts === 0 ? 'TECHNICAL_PASS' : 'FAIL',
  launcherVerdict: launcher.verdict, killSwitchEvidence,
  finalState: { p9: 'STOPPED', trafficAllowed: false, httpTraffic: runner.httpTraffic, workers: runner.cleanup.workersAfter, promotion: 'HELD' },
  replayedAt: new Date().toISOString(), workloadReexecuted: false,
  };
  await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, `${JSON.stringify(reconciled, null, 2)}\n`);
}
void main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
