'use strict';

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');
const { monitorEventLoopDelay, PerformanceObserver, performance } = require('node:perf_hooks');

const output = process.env.AGM_CORRELATED_TELEMETRY_PATH;
if (!output) throw new Error('AGM_CORRELATED_TELEMETRY_PATH_REQUIRED');
const runId = process.env.AGM_CORRELATED_RUN_ID ?? 'missing-run-id';
const processInstance = `api-${randomUUID()}`;
fs.mkdirSync(path.dirname(output), { recursive: true });
const stream = fs.createWriteStream(output, { flags: 'a', encoding: 'utf8' });
const storage = new AsyncLocalStorage();
const active = new Map();
const recent = new Map();
const allowedFaults = process.env.AGM_DIAGNOSTIC_FAULTS === 'AUTHORIZED';
let shuttingDown = false;

const iso = (epoch = Date.now()) => new Date(epoch).toISOString();
const round = (value) => Math.round(Number(value) * 1000) / 1000;
const safeId = (value) => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : null;
const safePath = (value) => String(value ?? '/').split('?')[0].slice(0, 256);
const write = (record, context = storage.getStore()) => {
  const identity = context ? { requestInstanceId: context.requestInstanceId, requestId: context.requestId, traceId: context.traceId } : {};
  stream.write(`${JSON.stringify({ at: iso(), pid: process.pid, runId, processInstance, ...identity, ...record })}\n`);
};
const overlaps = (context, startEpoch, endEpoch) => {
  const contextEnd = context.responseFinishedEpoch ?? Date.now();
  return context.receivedEpoch <= endEpoch && contextEnd >= startEpoch;
};
const matchingContexts = (startEpoch, endEpoch) => [...active.values(), ...recent.values()].filter((context) => overlaps(context, startEpoch, endEpoch));
const updateMemoryPeak = (context) => {
  const memory = process.memoryUsage();
  context.memoryPeakRss = Math.max(context.memoryPeakRss, memory.rss);
  context.memoryPeakHeapUsed = Math.max(context.memoryPeakHeapUsed, memory.heapUsed);
  context.memoryPeakExternal = Math.max(context.memoryPeakExternal, memory.external);
  return memory;
};
const syncSpan = (context, kind, operation, fn, extra = {}) => {
  const startedEpoch = Date.now(), started = performance.now();
  write({ type: 'span.start', kind, operation, startedAt: iso(startedEpoch), ...extra }, context);
  try {
    return fn();
  } finally {
    const durationMs = performance.now() - started;
    write({ type: 'span.end', kind, operation, durationMs: round(durationMs), outcome: 'complete', ...extra }, context);
    if (kind === 'runtime') context.runtimeBusyMs += durationMs;
    if (kind === 'io') context.ioMs += durationMs;
    if (kind === 'gc') context.gcControlMs += durationMs;
    if (kind === 'memory') context.memoryPressureMs += durationMs;
    updateMemoryPeak(context);
  }
};

const eventLoop = monitorEventLoopDelay({ resolution: 10 });
eventLoop.enable();
let lastTickPerf = performance.now();
let lastTickEpoch = Date.now();
const runtimeTimer = setInterval(() => {
  const nowPerf = performance.now(), nowEpoch = Date.now();
  const driftMs = Math.max(0, nowPerf - lastTickPerf - 100);
  const histogramMaxMs = Number.isFinite(eventLoop.max) ? eventLoop.max / 1e6 : 0;
  const lagMs = Math.max(driftMs, histogramMaxMs);
  const contexts = matchingContexts(lastTickEpoch, nowEpoch);
  for (const context of contexts) {
    context.eventLoopLagMaxMs = Math.max(context.eventLoopLagMaxMs, lagMs);
    context.runtimeSamples += 1;
    updateMemoryPeak(context);
  }
  const memory = process.memoryUsage(), usage = process.resourceUsage();
  write({
    type: 'runtime.sample',
    windowStartedAt: iso(lastTickEpoch),
    windowCompletedAt: iso(nowEpoch),
    traceIds: contexts.map((context) => context.traceId),
    eventLoopLagMs: round(lagMs),
    intervalDriftMs: round(driftMs),
    eventLoopHistogramMaxMs: round(histogramMaxMs),
    memory: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal, external: memory.external },
    cpu: process.cpuUsage(),
    scheduling: { voluntaryContextSwitches: usage.voluntaryContextSwitches, involuntaryContextSwitches: usage.involuntaryContextSwitches },
    io: { fsRead: usage.fsRead, fsWrite: usage.fsWrite },
  }, null);
  eventLoop.reset();
  lastTickPerf = nowPerf;
  lastTickEpoch = nowEpoch;
}, 100);
runtimeTimer.unref();

const gcObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const startedEpoch = performance.timeOrigin + entry.startTime;
    const completedEpoch = startedEpoch + entry.duration;
    const contexts = matchingContexts(startedEpoch, completedEpoch);
    for (const context of contexts) {
      context.gcPauseTotalMs += entry.duration;
      context.gcPauseMaxMs = Math.max(context.gcPauseMaxMs, entry.duration);
      context.gcEvents += 1;
    }
    write({ type: 'gc.pause', traceIds: contexts.map((context) => context.traceId), startedAt: iso(startedEpoch), completedAt: iso(completedEpoch), durationMs: round(entry.duration), gcKind: entry.detail?.kind ?? entry.kind }, null);
  }
});
gcObserver.observe({ entryTypes: ['gc'] });

const originalEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function correlatedRequestEmit(event, request, response) {
  if (event !== 'request' || !request || !response) return originalEmit.apply(this, arguments);
  if (request.url === '/__agm_diagnostic/flush-and-stop' && request.headers['x-agm-diagnostic-control'] === runId) {
    shuttingDown = true;
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ status: 'flushed', runId }));
    response.once('finish', () => {
      clearInterval(runtimeTimer); eventLoop.disable(); gcObserver.disconnect();
      write({ type: 'instrumentation.flush', activeRequests: active.size, recentRequests: recent.size, graceful: true }, null);
      stream.end(() => process.exit(0));
    });
    return true;
  }
  const supplied = safeId(request.headers['x-trace-id']) ?? safeId(request.headers['x-request-id']) ?? safeId(request.headers['x-correlation-id']);
  const traceId = supplied ?? `trace-${randomUUID()}`;
  const requestId = safeId(request.headers['x-request-id']) ?? traceId;
  const receivedEpoch = Date.now(), receivedPerf = performance.now();
  const memoryBefore = process.memoryUsage(), cpuBefore = process.cpuUsage(), usageBefore = process.resourceUsage();
  const requestInstanceId = `instance-${randomUUID()}`;
  const context = {
    requestInstanceId, traceId, requestId, receivedEpoch, receivedPerf, endpoint: safePath(request.url), method: request.method,
    fault: allowedFaults ? safeId(request.headers['x-agm-diagnostic-fault']) : null,
    responseFinishedEpoch: null, dbNetworkMs: 0, outboundNetworkMs: 0, ioMs: 0, runtimeBusyMs: 0, gcControlMs: 0, memoryPressureMs: 0,
    eventLoopLagMaxMs: 0, gcPauseTotalMs: 0, gcPauseMaxMs: 0, gcEvents: 0, runtimeSamples: 0,
    memoryBefore, memoryPeakRss: memoryBefore.rss, memoryPeakHeapUsed: memoryBefore.heapUsed,
    memoryPeakExternal: memoryBefore.external, cpuBefore, usageBefore, retainedPressure: null,
  };
  active.set(requestInstanceId, context);
  if (!response.headersSent) {
    response.setHeader('x-request-id', requestId);
    response.setHeader('x-trace-id', traceId);
  }
  const originalWriteHead = response.writeHead;
  let responseHeadersRecorded = false;
  response.writeHead = function correlatedWriteHead(...argumentsList) {
    if (!responseHeadersRecorded) {
      responseHeadersRecorded = true;
      context.responseHeadersEpoch = Date.now();
      write({
        type: 'response.headers',
        endpoint: context.endpoint,
        status: Number(argumentsList[0] ?? response.statusCode),
        headersAt: iso(context.responseHeadersEpoch),
        source: 'SERVER_WRITE_HEAD',
      }, context);
    }
    return originalWriteHead.apply(this, argumentsList);
  };
  write({ type: 'request.receive', method: context.method, endpoint: context.endpoint, receivedAt: iso(receivedEpoch) }, context);
  if (context.fault) write({ type: 'fault.control', fault: context.fault, authorization: 'AUTHORIZED_DIAGNOSTIC_ONLY' }, context);
  let finalized = false;
  const finalize = (outcome) => {
    if (finalized) return; finalized = true;
    context.responseFinishedEpoch = Date.now();
    const serverDurationMs = performance.now() - receivedPerf;
    const memoryAfter = updateMemoryPeak(context), cpu = process.cpuUsage(cpuBefore), usage = process.resourceUsage();
    write({ type: outcome === 'finish' ? 'response.finish' : 'response.close', endpoint: context.endpoint, status: response.statusCode, completedAt: iso(context.responseFinishedEpoch), serverDurationMs: round(serverDurationMs), outcome }, context);
    active.delete(requestInstanceId);
    const knownSpanMs = context.dbNetworkMs + context.outboundNetworkMs + context.ioMs + context.runtimeBusyMs + context.gcControlMs + context.memoryPressureMs;
    const summary = {
      type: 'request.summary', endpoint: context.endpoint, method: context.method, status: response.statusCode, outcome,
      receivedAt: iso(context.receivedEpoch), serverResponseAt: iso(context.responseFinishedEpoch), serverDurationMs: round(serverDurationMs),
      phases: {
        prismaPathMs: round(context.dbNetworkMs), outboundNetworkMs: round(context.outboundNetworkMs), ioMs: round(context.ioMs),
        runtimeBusyMs: round(context.runtimeBusyMs), gcControlMs: round(context.gcControlMs), memoryPressureMs: round(context.memoryPressureMs),
        residualServerMs: round(Math.max(0, serverDurationMs - knownSpanMs)), sumMayOverlap: true,
      },
      runtime: { eventLoopLagMaxMs: round(context.eventLoopLagMaxMs), runtimeSamples: context.runtimeSamples, gcEvents: context.gcEvents, gcPauseTotalMs: round(context.gcPauseTotalMs), gcPauseMaxMs: round(context.gcPauseMaxMs) },
      process: {
        cpuUserMicros: cpu.user, cpuSystemMicros: cpu.system,
        voluntaryContextSwitchDelta: usage.voluntaryContextSwitches - usageBefore.voluntaryContextSwitches,
        involuntaryContextSwitchDelta: usage.involuntaryContextSwitches - usageBefore.involuntaryContextSwitches,
        fsReadDelta: usage.fsRead - usageBefore.fsRead, fsWriteDelta: usage.fsWrite - usageBefore.fsWrite,
      },
      memory: {
        rssBefore: memoryBefore.rss, rssAfter: memoryAfter.rss, rssPeak: context.memoryPeakRss,
        heapUsedBefore: memoryBefore.heapUsed, heapUsedAfter: memoryAfter.heapUsed, heapUsedPeak: context.memoryPeakHeapUsed,
        externalBefore: memoryBefore.external, externalAfter: memoryAfter.external, externalPeak: context.memoryPeakExternal,
      },
    };
    write(summary, context);
    recent.set(requestInstanceId, context);
    setTimeout(() => {
      write({ type: 'request.runtime-association', endpoint: context.endpoint, eventLoopLagMaxMs: round(context.eventLoopLagMaxMs), runtimeSamples: context.runtimeSamples, gcEvents: context.gcEvents, gcPauseTotalMs: round(context.gcPauseTotalMs), gcPauseMaxMs: round(context.gcPauseMaxMs) }, context);
      context.retainedPressure = null;
      recent.delete(requestInstanceId);
    }, 500).unref();
  };
  response.once('finish', () => finalize('finish'));
  response.once('close', () => { if (!response.writableFinished) finalize('client_closed_before_finish'); });
  return storage.run(context, () => {
    if (context.fault === 'EVENT_LOOP_STALL') {
      syncSpan(context, 'runtime', 'event-loop-stall-control', () => { const until = performance.now() + 3300; while (performance.now() < until) {} });
    } else if (context.fault === 'GC_PAUSE') {
      syncSpan(context, 'gc', 'gc-pressure-control', () => {
        context.retainedPressure = Array.from({ length: 300000 }, (_, index) => ({ index, value: `gc-${index}` }));
        updateMemoryPeak(context);
        if (global.gc) { global.gc(); global.gc(); }
      });
    } else if (context.fault === 'MEMORY_PRESSURE') {
      syncSpan(context, 'memory', 'memory-pressure-control', () => { context.retainedPressure = Buffer.alloc(96 * 1024 * 1024, 1); updateMemoryPeak(context); });
    } else if (context.fault === 'IO_CONTENTION') {
      syncSpan(context, 'io', 'filesystem-contention-control', () => {
        const temp = `${output}.${process.pid}.io-control.tmp`, block = Buffer.alloc(8 * 1024 * 1024, 7);
        try { for (let index = 0; index < 8; index += 1) fs.writeFileSync(temp, block); } finally { try { fs.unlinkSync(temp); } catch {} }
      }, { bytes: 64 * 1024 * 1024 });
    }
    return originalEmit.apply(this, arguments);
  });
};

function patchPrisma() {
  try {
    const { PrismaClient } = require('@prisma/client');
    let owner = PrismaClient.prototype;
    while (owner && !Object.prototype.hasOwnProperty.call(owner, '_request')) owner = Object.getPrototypeOf(owner);
    if (!owner || typeof owner._request !== 'function') throw new Error('PRISMA_REQUEST_HOOK_NOT_FOUND');
    const originalRequest = owner._request;
    owner._request = async function correlatedPrismaRequest(args) {
      const context = storage.getStore();
      if (!context) return originalRequest.call(this, args);
      const started = performance.now();
      const metadata = { operation: String(args?.action ?? args?.clientMethod ?? 'unknown').slice(0, 64), model: args?.model ? String(args.model).slice(0, 64) : null };
      write({ type: 'span.start', kind: 'prisma.path', ...metadata }, context);
      let outcome = 'complete';
      try {
        if (context.fault === 'DB_NETWORK_DELAY') await new Promise((resolve) => setTimeout(resolve, 3300));
        return await originalRequest.call(this, args);
      } catch (error) {
        outcome = 'error';
        throw error;
      } finally {
        const durationMs = performance.now() - started;
        context.dbNetworkMs += durationMs;
        write({ type: 'span.end', kind: 'prisma.path', ...metadata, durationMs: round(durationMs), outcome, semantics: 'prisma-engine-queue-db-wire-decode-total' }, context);
      }
    };
    return true;
  } catch (error) {
    write({ type: 'instrumentation.error', component: 'prisma', error: error instanceof Error ? error.message : 'UNKNOWN' }, null);
    return false;
  }
}

function patchOutboundRequest(module, component) {
  const original = module.request;
  module.request = function correlatedOutboundRequest(...args) {
    const context = storage.getStore();
    if (!context) return original.apply(this, args);
    const started = performance.now();
    const request = original.apply(this, args);
    let completed = false;
    const finish = (outcome) => {
      if (completed) return; completed = true;
      const durationMs = performance.now() - started; context.outboundNetworkMs += durationMs;
      write({ type: 'span.end', kind: 'outbound.network', operation: component, durationMs: round(durationMs), outcome }, context);
    };
    write({ type: 'span.start', kind: 'outbound.network', operation: component }, context);
    request.once('response', () => finish('response'));
    request.once('error', () => finish('error'));
    return request;
  };
}
patchOutboundRequest(http, 'http');
patchOutboundRequest(https, 'https');

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function correlatedSocketConnect(...args) {
  const context = storage.getStore();
  if (!context) return originalConnect.apply(this, args);
  const started = performance.now(); let completed = false;
  const finish = (outcome) => { if (completed) return; completed = true; const durationMs = performance.now() - started; context.outboundNetworkMs += durationMs; write({ type: 'span.end', kind: 'socket.connect', operation: 'connect', durationMs: round(durationMs), outcome }, context); };
  write({ type: 'span.start', kind: 'socket.connect', operation: 'connect' }, context);
  this.once('connect', () => finish('connected')); this.once('error', () => finish('error'));
  return originalConnect.apply(this, args);
};

const prismaPatched = patchPrisma();
write({ type: 'instrumentation.status', contract: 'agm-server-correlated-instrumentation.v1', prismaPatched, asyncContext: true, responseHeaderHook: true, officialBasicSloMs: 3000, functionalBasicChange: false, nodeEnv: process.env.NODE_ENV ?? null, apiHost: process.env.API_HOST ?? null, port: Number(process.env.PORT ?? 0), production: process.env.NODE_ENV === 'production' }, null);
process.once('exit', () => { if (!shuttingDown) { write({ type: 'runtime.stop', signal: 'unexpected-exit' }, null); stream.end(); } });
