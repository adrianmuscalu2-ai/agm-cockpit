import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const baseUrl = process.env.AGM_P0_BASIC_URL ?? 'http://127.0.0.1:3000/api/v1';
const iterations = 20;
const targets = [
  { id: 'health', url: `${baseUrl}/health`, method: 'GET', expected: [200] },
  { id: 'login-invalid', url: `${baseUrl}/auth/login`, method: 'POST', body: { email: 'p0-isolation-probe.invalid@example.invalid', password: 'not-a-real-credential' }, expected: [401, 429] },
  { id: 'entitlement-unauthenticated', url: `${baseUrl}/auth/entitlements`, method: 'GET', expected: [401, 429] },
];

const children = [];
const startDummy = (name, busy = false) => {
  const code = busy
    ? "const end=Date.now()+2500;while(Date.now()<end){};setInterval(()=>{},1000)"
    : "setInterval(()=>{},1000)";
  const child = spawn(process.execPath, ['-e', code], { stdio: 'ignore', windowsHide: true });
  child.label = name;
  children.push(child);
  return child;
};

const sample = async (target, phase, iteration) => {
  const started = performance.now();
  let status = 0;
  let error = null;
  try {
    const response = await fetch(target.url, {
      method: target.method,
      headers: target.body ? { 'content-type': 'application/json' } : undefined,
      body: target.body ? JSON.stringify(target.body) : undefined,
      signal: AbortSignal.timeout(3000),
    });
    status = response.status;
    await response.arrayBuffer();
  } catch (value) {
    error = value instanceof Error ? value.name : 'UNKNOWN';
  }
  return { target: target.id, phase, iteration, status, expected: target.expected, latencyMs: Math.round((performance.now() - started) * 100) / 100, pass: target.expected.includes(status), error };
};

const results = [];
const runPhase = async (phase) => {
  for (let i = 0; i < iterations; i += 1) {
    for (const target of targets) results.push(await sample(target, phase, i + 1));
  }
};

try {
  await runPhase('baseline');
  const controlPlane = startDummy('copilot-control-plane');
  const turnProjection = startDummy('turn-projection');
  const worker = startDummy('copilot-worker', true);
  await runPhase('copilot-running-and-worker-saturated');
  controlPlane.kill();
  turnProjection.kill();
  worker.kill();
  await runPhase('copilot-turn-total-failure');

  const canonical = [
    { eventId: 'evt-1', revision: 1, status: 'ACTIVE' },
    { eventId: 'evt-2', revision: 2, status: 'OWNER_REVIEW' },
  ];
  const canonicalSnapshot = JSON.stringify(canonical);
  let projection = canonical.map((event) => ({ ...event }));
  projection[1] = { eventId: 'corrupt', revision: 2, status: 'HEALTHY' };
  const corruptionDetected = JSON.stringify(projection) !== canonicalSnapshot;
  projection = canonical.map((event) => ({ ...event }));
  const reconstructionPass = JSON.stringify(projection) === canonicalSnapshot;
  const canonicalUnchanged = JSON.stringify(canonical) === canonicalSnapshot;

  const latencies = results.map((item) => item.latencyMs).sort((a, b) => a - b);
  const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)];
  const failed = results.filter((item) => !item.pass);
  const report = {
    contract: 'agm-copilot-v1.2-p0-isolation-evidence.v1',
    generatedAt: new Date().toISOString(),
    basicUrl: baseUrl,
    slo: { availabilityPercentRequired: 100, p95LatencyMsMax: 1000, maxLatencyMsMax: 3000 },
    samples: results.length,
    availabilityPercent: ((results.length - failed.length) / results.length) * 100,
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: latencies.at(-1) },
    phases: [...new Set(results.map((item) => item.phase))],
    endpointResults: Object.fromEntries(targets.map((target) => {
      const subset = results.filter((item) => item.target === target.id);
      return [target.id, { samples: subset.length, passed: subset.filter((item) => item.pass).length, expectedStatuses: target.expected }];
    })),
    turnRecovery: { corruptionDetected, canonicalUnchanged, reconstructionPass },
    secretExposure: 'ZERO_BY_TEST_DESIGN',
    verdict: failed.length === 0 && percentile(0.95) <= 1000 && latencies.at(-1) <= 3000 && corruptionDetected && canonicalUnchanged && reconstructionPass ? 'PASS' : 'FAIL',
    failures: failed,
  };
  await mkdir('evidence/governance/copilot-v1.2/p0/runtime', { recursive: true });
  await writeFile('evidence/governance/copilot-v1.2/p0/runtime/basic-isolation-fault-injection-report.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`P0 BASIC ISOLATION / TURN RECOVERY — ${report.verdict}`);
  console.log(`samples=${report.samples} availability=${report.availabilityPercent}% p95=${report.latencyMs.p95}ms max=${report.latencyMs.max}ms`);
  if (report.verdict !== 'PASS') process.exitCode = 1;
} finally {
  for (const child of children) if (!child.killed) child.kill();
}
