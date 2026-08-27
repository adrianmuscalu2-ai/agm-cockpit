import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const phase = String(process.argv[2] ?? '').toUpperCase();
const output = process.argv[3];
const url = process.argv[4] ?? 'http://127.0.0.1:3000/api/v1/health';
const requestCount = Number(process.argv[5] ?? 10);
const intervalMs = Number(process.argv[6] ?? 1000);
const officialSloMs = 3000;

if (!['BEFORE', 'AFTER'].includes(phase)) throw new Error('OBSERVER_API_PHASE_MUST_BE_BEFORE_OR_AFTER');
if (!output) throw new Error('OBSERVER_API_OUTPUT_REQUIRED');
if (!Number.isInteger(requestCount) || requestCount < 1 || requestCount > 30) throw new Error('OBSERVER_API_REQUEST_COUNT_INVALID');
if (!Number.isInteger(intervalMs) || intervalMs < 250 || intervalMs > 10_000) throw new Error('OBSERVER_API_INTERVAL_INVALID');
const parsedUrl = new URL(url);
if (parsedUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname)) {
  throw new Error('OBSERVER_API_REQUIRES_LOOPBACK_HTTP');
}

const round = (value) => Math.round(value * 1000) / 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const percentile = (values, quantile) => {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * quantile) - 1)];
};

const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();
const driftSamples = [];
let expectedTick = performance.now() + 100;
const driftTimer = setInterval(() => {
  const now = performance.now();
  driftSamples.push(round(Math.max(0, now - expectedTick)));
  expectedTick = now + 100;
}, 100);
driftTimer.unref();

const startedAt = new Date().toISOString();
const samples = [];
for (let sequence = 1; sequence <= requestCount; sequence += 1) {
  const traceId = randomUUID();
  const requestStartedAt = new Date().toISOString();
  const started = performance.now();
  let status = 0;
  let error = null;
  let responseHeadersAt = null;
  let completedAt = null;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'x-trace-id': traceId, 'x-request-id': traceId },
      signal: AbortSignal.timeout(officialSloMs),
    });
    status = response.status;
    responseHeadersAt = new Date().toISOString();
    await response.arrayBuffer();
  } catch (value) {
    error = value instanceof Error ? { name: value.name, code: value.cause?.code ?? null } : { name: 'UNKNOWN', code: null };
  } finally {
    completedAt = new Date().toISOString();
  }
  const durationMs = round(performance.now() - started);
  samples.push({
    sequence,
    traceId,
    requestId: traceId,
    method: 'GET',
    endpoint: parsedUrl.pathname,
    requestStartedAt,
    responseHeadersAt,
    completedAt,
    durationMs,
    status,
    error,
    timedOut: error?.name === 'TimeoutError',
    officialSloPass: error === null && status === 200 && durationMs <= officialSloMs,
  });
  if (sequence < requestCount) await sleep(intervalMs);
}

clearInterval(driftTimer);
loop.disable();
const completedAt = new Date().toISOString();
const latencies = samples.map((sample) => sample.durationMs);
const report = {
  contract: 'agm-instrumentation-observer-api-client.v1',
  phase,
  generatedAt: completedAt,
  startedAt,
  completedAt,
  url,
  configuration: {
    method: 'GET',
    requestCount,
    intervalMs,
    officialBasicSloMs: officialSloMs,
    officialBasicSloUnchanged: true,
    retries: 0,
    faultInjection: false,
    readOnly: true,
  },
  summary: {
    requests: samples.length,
    availabilityPercent: round(samples.filter((sample) => sample.status === 200 && sample.error === null).length / samples.length * 100),
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
    maxMs: Math.max(...latencies),
    timeouts: samples.filter((sample) => sample.timedOut).length,
    failures: samples.filter((sample) => !sample.officialSloPass).length,
  },
  clientHarnessNodeEventLoop: {
    label: 'CLIENT_HARNESS_NODE_EVENT_LOOP_NOT_SERVER_RUNTIME',
    delayMs: {
      mean: Number.isFinite(loop.mean) ? round(loop.mean / 1e6) : null,
      p95: round(loop.percentile(95) / 1e6),
      p99: round(loop.percentile(99) / 1e6),
      max: round(loop.max / 1e6),
    },
    intervalDriftMs: {
      samples: driftSamples.length,
      p95: percentile(driftSamples, 0.95),
      max: driftSamples.length ? Math.max(...driftSamples) : null,
    },
  },
  samples,
  custody: {
    p9: 'STOPPED',
    killSwitch: 'ACTIVE',
    officialSoakRestarted: false,
    productionChanges: 0,
    basicFunctionalChanges: 0,
    externalSystemWrites: 0,
  },
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`OBSERVER API CLIENT - ${phase} / requests=${samples.length} failures=${report.summary.failures} p95=${report.summary.p95Ms}ms max=${report.summary.maxMs}ms`);

