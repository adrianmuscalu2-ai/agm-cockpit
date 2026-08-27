import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const evidenceRoot = resolve(root, 'evidence/governance/copilot-v1.2/p9/controlled-activation/p9-promoted-20260815-001');
const runtimePath = resolve(evidenceRoot, 'active-runtime.json');
const smokePath = resolve(evidenceRoot, 'smoke-result.json');
const policyPath = resolve(root, 'config/copilot-v1.2/p9-pilot-policy.json');
const processPath = resolve(evidenceRoot, 'activation-process.json');
const outputPath = resolve(root, 'apps/web/public/operational/p9-turn-projection.json');
const parse = async (path) => JSON.parse(await readFile(path, 'utf8'));

const [runtime, smoke, policy, activation] = await Promise.all([
  parse(runtimePath), parse(smokePath), parse(policyPath), parse(processPath),
]);
if (runtime.contract !== 'agm-p9-controlled-active-runtime.v2' || runtime.state !== 'ACTIVE') throw new Error('P9_RUNTIME_NOT_ACTIVE');
if (smoke.metrics?.successes !== 5 || smoke.metrics?.completed !== 5 || smoke.metrics?.errors !== 0 || smoke.metrics?.timeouts !== 0) throw new Error('P9_SMOKE_NOT_PASS');
if (policy.killSwitchDefault !== 'ACTIVE') throw new Error('P9_KILL_SWITCH_NOT_ACTIVE');
try { process.kill(Number(activation.pid), 0); } catch { throw new Error('P9_RUNTIME_PROCESS_NOT_PRESENT'); }

const relative = (path) => path.slice(root.length + 1).replaceAll('\\', '/');
const projection = {
  contract: 'agm-turn-p9-operational-projection.v1',
  executionId: smoke.execution.executionId,
  state: runtime.state,
  smoke: { passed: smoke.metrics.successes, total: smoke.metrics.completed, errors: smoke.metrics.errors, timeouts: smoke.metrics.timeouts },
  killSwitch: policy.killSwitchDefault,
  rollback: 'READY',
  lastValidatedAt: smoke.finishedAt,
  projectedAt: new Date().toISOString(),
  runtimePid: activation.pid,
  source: { kind: 'OPERATIONAL_EVIDENCE', runtime: relative(runtimePath), smoke: relative(smokePath), policy: relative(policyPath) },
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(projection, null, 2)}\n`);
console.log(`P9 Turn projection synchronized from live operational evidence: ${outputPath}`);
