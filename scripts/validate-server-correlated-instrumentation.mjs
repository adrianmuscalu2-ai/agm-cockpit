import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const base = process.argv[2] ?? 'http://127.0.0.1:3200/api/v1';
const output = process.argv[3] ?? 'server-correlated-client.json';
const officialSloMs = 3000;

const cpuSnapshot = () => os.cpus().map((cpu) => ({ ...cpu.times }));
const cpuUtilization = (before, after) => {
  let idle = 0, total = 0;
  for (let index = 0; index < Math.min(before.length, after.length); index += 1) {
    const keys = ['user', 'nice', 'sys', 'idle', 'irq'];
    for (const key of keys) total += after[index][key] - before[index][key];
    idle += after[index].idle - before[index].idle;
  }
  return total > 0 ? Math.round((1 - idle / total) * 10000) / 100 : null;
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cases = [];

async function runCase({ id, scenario, endpoint = 'health', fault = null, clientStallMs = 0, cpuContention = false, expected }) {
  const transportId = `trace-${id.toLowerCase()}-${randomUUID()}`;
  const traceId = transportId;
  const requestId = transportId;
  const loop = monitorEventLoopDelay({ resolution: 10 }); loop.enable();
  let timerPrior = performance.now(), intervalDriftMaxMs = 0;
  const timer = setInterval(() => { const now = performance.now(); intervalDriftMaxMs = Math.max(intervalDriftMaxMs, now - timerPrior - 10); timerPrior = now; }, 10);
  const cpuBefore = cpuSnapshot();
  const workers = [];
  if (cpuContention) {
    const workerCount = Math.min(8, Math.max(4, os.cpus().length));
    for (let index = 0; index < workerCount; index += 1) {
      workers.push(spawn(process.execPath, ['-e', 'const end=Date.now()+1500;while(Date.now()<end){}'], { stdio: 'ignore', windowsHide: true }));
    }
    await delay(100);
  }
  const clientStartedAt = new Date().toISOString(), started = performance.now();
  let status = 0, error = null, clientHeadersAt = null, clientBodyAt = null, echoedTraceId = null, echoedRequestId = null;
  try {
    const response = await fetch(`${base}/${endpoint}`, {
      headers: {
        'x-trace-id': traceId,
        'x-request-id': requestId,
        ...(fault ? { 'x-agm-diagnostic-fault': fault } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    status = response.status;
    clientHeadersAt = new Date().toISOString();
    echoedTraceId = response.headers.get('x-trace-id');
    echoedRequestId = response.headers.get('x-request-id');
    if (clientStallMs) { const until = performance.now() + clientStallMs; while (performance.now() < until) {} }
    await response.arrayBuffer();
    clientBodyAt = new Date().toISOString();
  } catch (value) {
    error = value instanceof Error ? value.name : 'UNKNOWN';
  }
  const clientCompletedAt = new Date().toISOString(), durationMs = performance.now() - started;
  await Promise.all(workers.map((worker) => new Promise((resolve) => worker.once('exit', resolve))));
  await delay(80);
  clearInterval(timer); loop.disable();
  cases.push({
    id, scenario, expected, traceId, requestId, endpoint, fault, clientStartedAt, clientHeadersAt, clientBodyAt, clientCompletedAt,
    durationMs, status, error, sampleType: 'DIAGNOSTIC_CONTROL', countsTowardOfficialSlo: false, observedAgainstOfficialSlo: durationMs <= officialSloMs, echoedTraceId, echoedRequestId,
    tracePropagationPass: echoedTraceId === traceId && echoedRequestId === requestId,
    clientEventLoopLagMaxMs: Math.max(loop.max / 1e6, intervalDriftMaxMs),
    hostCpuPercent: cpuUtilization(cpuBefore, cpuSnapshot()),
    controlledCpuProcesses: workers.map((worker) => worker.pid).filter(Boolean),
  });
  await delay(1000);
}

const scenarios = [
  { scenario: 'EVENT_LOOP_STALL', fault: 'EVENT_LOOP_STALL', expected: 'EVENT_LOOP_STALL_CORRELATED' },
  { scenario: 'DB_NETWORK_DELAY', endpoint: 'health/ready', fault: 'DB_NETWORK_DELAY', expected: 'DB_NETWORK_CORRELATED' },
  { scenario: 'CLIENT_HARNESS', clientStallMs: 1250, expected: 'CLIENT_HARNESS_CORRELATED' },
  { scenario: 'GC_PAUSE', fault: 'GC_PAUSE', expected: 'GC_PAUSE_CORRELATED' },
  { scenario: 'MEMORY_PRESSURE', fault: 'MEMORY_PRESSURE', expected: 'MEMORY_PRESSURE_CORRELATED' },
  { scenario: 'IO_CONTENTION', fault: 'IO_CONTENTION', expected: 'IO_CONTENTION_CORRELATED' },
  { scenario: 'CPU_CONTENTION', fault: 'CPU_CONTENTION', cpuContention: true, expected: 'CPU_CONTENTION_ASSOCIATED' },
];
for (const scenario of scenarios) {
  for (let iteration = 1; iteration <= 3; iteration += 1) {
    await runCase({ id: `${scenario.scenario}_CONTROL_${iteration}`, scenario: scenario.scenario, endpoint: scenario.endpoint, expected: 'HEALTHY_CONTROL' });
    await runCase({ id: `${scenario.scenario}_FAULT_${iteration}`, ...scenario });
  }
}

await mkdir(output.replace(/[\\/][^\\/]+$/, ''), { recursive: true });
await writeFile(output, `${JSON.stringify({ contract: 'agm-server-correlated-client-evidence.v1', generatedAt: new Date().toISOString(), distributionScope: 'DIAGNOSTIC_FAULT_ATTRIBUTION_ONLY', officialSloMs, officialSloUnchanged: true, cases }, null, 2)}\n`);
console.log(`SERVER CORRELATED CLIENT — COMPLETE (${cases.length} cases)`);
