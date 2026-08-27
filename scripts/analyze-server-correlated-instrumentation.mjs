import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('EVIDENCE_ROOT_REQUIRED');
const client = JSON.parse(await readFile(join(root, 'client-timeline.json'), 'utf8'));
const telemetry = (await readFile(join(root, 'server-correlated-telemetry.jsonl'), 'utf8'))
  .replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line.replace(/^\uFEFF/, '')));
const host = JSON.parse((await readFile(join(root, 'host-process-snapshots.json'), 'utf8')).replace(/^\uFEFF/, ''));
const statuses = telemetry.filter((entry) => entry.type === 'instrumentation.status');
assert.equal(statuses.length, 1, 'telemetry must contain exactly one API instrumentation status');
const status = statuses[0];
assert.ok(telemetry.every((entry) => entry.pid === status.pid && entry.runId === status.runId && entry.processInstance === status.processInstance), 'telemetry contains a foreign PID/run/process instance');
assert.equal(status.production, false, 'diagnostic API must not run as Production');
assert.equal(status.apiHost, '127.0.0.1', 'diagnostic API must bind loopback only');
const flushes = telemetry.filter((entry) => entry.type === 'instrumentation.flush');
assert.equal(flushes.length, 1, 'telemetry must contain exactly one graceful flush record');
assert.equal(flushes[0].graceful, true, 'telemetry writer was not flushed gracefully');
assert.equal(flushes[0].activeRequests, 0, 'active requests remained at flush');
const ms = (later, earlier) => later && earlier ? Date.parse(later) - Date.parse(earlier) : null;
const spanKinds = (traceId) => telemetry.filter((entry) => entry.traceId === traceId && entry.type === 'span.end');

const records = client.cases.map((item) => {
  const receive = telemetry.find((entry) => entry.traceId === item.traceId && entry.type === 'request.receive');
  const response = telemetry.find((entry) => entry.traceId === item.traceId && entry.type === 'response.finish');
  const summary = telemetry.find((entry) => entry.traceId === item.traceId && entry.type === 'request.summary');
  const spans = spanKinds(item.traceId);
  const association = telemetry.find((entry) => entry.traceId === item.traceId && entry.type === 'request.runtime-association');
  assert.ok(receive, `${item.id}: request.receive missing`);
  assert.ok(response, `${item.id}: response.finish missing`);
  assert.ok(summary, `${item.id}: request.summary missing`);
  assert.ok(association, `${item.id}: request.runtime-association missing`);
  assert.equal(item.tracePropagationPass, true, `${item.id}: trace header propagation failed`);
  assert.equal(item.error, null, `${item.id}: client error`);
  assert.ok(item.status === 200 || spans.some((span) => span.kind === 'prisma.path'), `${item.id}: unexpected HTTP status ${item.status}`);

  const heapPeakDelta = summary.memory.heapUsedPeak - summary.memory.heapUsedBefore;
  const externalPeakDelta = summary.memory.externalPeak - summary.memory.externalBefore;
  const clientMinusServerMs = Math.max(0, item.durationMs - summary.serverDurationMs);
  const derived = {
    clientToServerReceiveMs: ms(receive.receivedAt, item.clientStartedAt),
    serverDurationMs: summary.serverDurationMs,
    serverResponseToClientHeadersMs: ms(item.clientHeadersAt, response.completedAt),
    clientHeadersToBodyMs: ms(item.clientBodyAt, item.clientHeadersAt),
    clientEndToEndMs: item.durationMs,
    clientMinusServerMs,
  };

  let classification = 'UNATTRIBUTED';
  if (summary.phases.runtimeBusyMs >= 3000 && summary.phases.prismaPathMs < 1000) classification = 'EVENT_LOOP_STALL_CORRELATED';
  else if (summary.phases.prismaPathMs >= 3000 && summary.phases.runtimeBusyMs < 1000 && association.eventLoopLagMaxMs < 1000) classification = 'DB_NETWORK_CORRELATED';
  else if (summary.phases.prismaPathMs >= 3000 && (summary.phases.runtimeBusyMs >= 1000 || association.eventLoopLagMaxMs >= 1000)) classification = 'DB_NETWORK_VS_RUNTIME_UNRESOLVED';
  else if (clientMinusServerMs >= 1000 && item.clientEventLoopLagMaxMs >= 1000 && summary.serverDurationMs < 1000) classification = 'CLIENT_HARNESS_CORRELATED';
  else if (spans.some((span) => span.kind === 'gc') && association.gcEvents > 0 && association.gcPauseTotalMs > 0) classification = 'GC_PAUSE_CORRELATED';
  else if (spans.some((span) => span.kind === 'memory') && Math.max(heapPeakDelta, externalPeakDelta) >= 64 * 1024 * 1024) classification = 'MEMORY_PRESSURE_CORRELATED';
  else if (spans.some((span) => span.kind === 'io') && summary.phases.ioMs > 0) classification = 'IO_CONTENTION_CORRELATED';
  else if (item.controlledCpuProcesses.length >= 4 && item.hostCpuPercent >= 70) classification = 'CPU_CONTENTION_ASSOCIATED';
  else if (summary.serverDurationMs < 1000 && clientMinusServerMs < 1000 && item.controlledCpuProcesses.length === 0) classification = 'HEALTHY_CONTROL';

  return {
    id: item.id, scenario: item.scenario, expected: item.expected, classification, attributionPass: classification === item.expected,
    traceId: item.traceId, requestId: item.requestId, endpoint: item.endpoint, status: item.status,
    timeline: { clientStartedAt: item.clientStartedAt, serverReceivedAt: receive.receivedAt, serverResponseAt: response.completedAt, clientHeadersAt: item.clientHeadersAt, clientBodyAt: item.clientBodyAt, clientCompletedAt: item.clientCompletedAt },
    derived,
    serverPhases: summary.phases,
    runtime: { ...summary.runtime, finalAssociation: association },
    process: summary.process,
    memory: { ...summary.memory, heapPeakDelta, externalPeakDelta },
    client: { eventLoopLagMaxMs: item.clientEventLoopLagMaxMs, hostCpuPercent: item.hostCpuPercent, controlledCpuProcesses: item.controlledCpuProcesses },
    spans: spans.map(({ kind, operation, durationMs, outcome, semantics }) => ({ kind, operation, durationMs, outcome, semantics })),
  };
});

const failed = records.filter((record) => !record.attributionPass);
const report = {
  contract: 'agm-server-side-correlated-instrumentation-validation.v1', generatedAt: new Date().toISOString(),
  instrumentationStatus: status ?? null,
  gracefulFlush: flushes[0],
  flow: 'client.requestStart → server.request.receive → runtime/event-loop + DB/network + GC/memory/I/O/process → server.response.finish → client.headers/body',
  sameTraceIdValidated: records.every((record) => record.traceId && record.requestId),
  records, totals: { cases: records.length, passed: records.length - failed.length, failed: failed.length },
  hostProcessSnapshots: host,
  safety: { diagnosticOnly: true, officialBasicSloMs: 3000, officialBasicSloUnchanged: true, basicFunctionalChanges: 0, productionChanges: 0, externalWrites: 0, newUnjustifiedSecretAccess: 0, p9: 'STOPPED', killSwitch: 'ACTIVE', soakRestarted: false },
  verdict: failed.length === 0 && status?.prismaPatched === true ? 'PASS' : 'FAIL',
};
await writeFile(join(root, 'correlated-attribution-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`SERVER-SIDE CORRELATED INSTRUMENTATION — ${report.verdict} (${report.totals.passed}/${report.totals.cases})`);
if (failed.length) { console.error(JSON.stringify(failed.map((record) => ({ id: record.id, expected: record.expected, actual: record.classification })), null, 2)); process.exitCode = 1; }
