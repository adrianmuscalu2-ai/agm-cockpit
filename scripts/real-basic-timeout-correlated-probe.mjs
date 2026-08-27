import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { channel } from 'node:diagnostics_channel';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import os from 'node:os';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const baseUrl = process.argv[2] ?? process.env.AGM_REAL_BASIC_URL ?? 'http://127.0.0.1:3200/api/v1';
const hasExplicitBatchArgument = process.argv[4] !== undefined;
const batch = hasExplicitBatchArgument ? Number(process.argv[3]) : 1;
const output = (hasExplicitBatchArgument ? process.argv[4] : process.argv[3])
  ?? 'evidence/governance/copilot-v1.2/p9/server-correlated-instrumentation/real-basic-timeout-probe.json';
const runId = process.argv[5] ?? null;
const profile = String(process.argv[6] ?? 'P0_COMPAT_THREE_PHASE').toUpperCase();
if (!['P0_COMPAT_THREE_PHASE', 'NATURAL_P9_OFF'].includes(profile)) {
  throw new Error('REAL_BASIC_PROBE_PROFILE_UNSUPPORTED');
}
const iterationsPerPhase = profile === 'NATURAL_P9_OFF' ? 60 : 20;
const officialTimeoutMs = 3000;
const diagnosticTimeoutMs = 10_000;
const phaseOrder = profile === 'NATURAL_P9_OFF'
  ? ['natural-p9-off']
  : ['baseline', 'copilot-running-and-worker-saturated', 'copilot-turn-total-failure'];

const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(parsedBaseUrl.hostname)) {
  throw new Error('REAL_BASIC_PROBE_REQUIRES_LOOPBACK_HTTP_TARGET');
}
if (hasExplicitBatchArgument && (!runId || !/^[A-Za-z0-9._:-]{1,128}$/.test(runId))) {
  throw new Error('REAL_BASIC_PROBE_RUN_ID_REQUIRED');
}

const targets = [
  {
    id: 'health',
    endpoint: '/health',
    url: `${baseUrl}/health`,
    init: { method: 'GET' },
    expectedStatuses: [200],
    layer: 'HTTP_NO_DB',
  },
  {
    id: 'login-invalid',
    endpoint: '/auth/login',
    url: `${baseUrl}/auth/login`,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'real-basic-timeout-probe.invalid@example.invalid',
        password: 'not-a-real-credential',
      }),
    },
    expectedStatuses: [401, 429],
    layer: 'HTTP_DB_LOOKUP',
  },
  {
    id: 'entitlement-unauthenticated',
    endpoint: '/auth/entitlements',
    url: `${baseUrl}/auth/entitlements`,
    init: { method: 'GET' },
    expectedStatuses: [401, 429],
    layer: 'HTTP_AUTH_GUARD',
  },
];

const round = (value) => Math.round(Number(value) * 1000) / 1000;
const iso = (epoch = Date.now()) => new Date(epoch).toISOString();
const immediate = () => new Promise((resolveImmediate) => setImmediate(resolveImmediate));
const percentile = (values, fraction) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};
const errorDetails = (value) => value instanceof Error
  ? { name: value.name, code: typeof value.cause?.code === 'string' ? value.cause.code : null }
  : { name: 'UNKNOWN', code: null };

const undiciChannelNames = [
  'undici:request:create',
  'undici:request:bodySent',
  'undici:request:headers',
  'undici:request:trailers',
  'undici:request:error',
];
const pendingTransportCaptures = new Map();
const requestTransportCaptures = new WeakMap();
const transportSubscriberStats = {
  source: 'node:diagnostics_channel',
  channels: undiciChannelNames,
  subscribed: false,
  unsubscribed: false,
  requestCreateEvents: 0,
  bodySentEvents: 0,
  responseHeadersEvents: 0,
  trailersEvents: 0,
  errorEvents: 0,
  ignoredEvents: 0,
  activeCapturePeak: 0,
};

const undiciHeader = (request, wantedName) => {
  const headers = request?.headers;
  if (!Array.isArray(headers)) return null;
  for (let index = 0; index + 1 < headers.length; index += 2) {
    if (String(headers[index]).toLowerCase() === wantedName) return String(headers[index + 1]);
  }
  return null;
};

const captureForRequest = (request) => request && typeof request === 'object'
  ? requestTransportCaptures.get(request) ?? null
  : null;

const markTransportEvent = (capture, event, counter) => {
  if (!capture?._timing || capture.timestamps[event] !== null) return;
  const epochMs = Date.now();
  const perfMs = performance.now();
  capture.timestamps[event] = iso(epochMs);
  capture.epochMs[event] = epochMs;
  capture._timing[event] = perfMs;
  transportSubscriberStats[counter] += 1;
};

const transportHandlers = {
  create(message) {
    const traceId = undiciHeader(message?.request, 'x-trace-id');
    const requestId = undiciHeader(message?.request, 'x-request-id');
    const capture = traceId ? pendingTransportCaptures.get(traceId) : null;
    if (!capture || !message?.request) {
      transportSubscriberStats.ignoredEvents += 1;
      return;
    }
    capture.headerCorrelation = {
      traceIdMatched: traceId === capture.traceId,
      requestIdMatched: requestId === capture.requestId,
      sameRequestAndTraceId: traceId === requestId,
    };
    requestTransportCaptures.set(message.request, capture);
    markTransportEvent(capture, 'requestCreateAt', 'requestCreateEvents');
  },
  bodySent(message) {
    const capture = captureForRequest(message?.request);
    if (!capture) {
      transportSubscriberStats.ignoredEvents += 1;
      return;
    }
    markTransportEvent(capture, 'bodySentAt', 'bodySentEvents');
  },
  headers(message) {
    const capture = captureForRequest(message?.request);
    if (!capture) {
      transportSubscriberStats.ignoredEvents += 1;
      return;
    }
    markTransportEvent(capture, 'responseHeadersAt', 'responseHeadersEvents');
  },
  trailers(message) {
    const capture = captureForRequest(message?.request);
    if (!capture) {
      transportSubscriberStats.ignoredEvents += 1;
      return;
    }
    markTransportEvent(capture, 'trailersAt', 'trailersEvents');
    requestTransportCaptures.delete(message.request);
  },
  error(message) {
    const capture = captureForRequest(message?.request);
    if (!capture) {
      transportSubscriberStats.ignoredEvents += 1;
      return;
    }
    markTransportEvent(capture, 'errorAt', 'errorEvents');
    capture.transportError = errorDetails(message?.error);
    requestTransportCaptures.delete(message.request);
  },
};

const undiciSubscriptions = [
  [channel('undici:request:create'), transportHandlers.create],
  [channel('undici:request:bodySent'), transportHandlers.bodySent],
  [channel('undici:request:headers'), transportHandlers.headers],
  [channel('undici:request:trailers'), transportHandlers.trailers],
  [channel('undici:request:error'), transportHandlers.error],
];
for (const [diagnosticChannel, handler] of undiciSubscriptions) diagnosticChannel.subscribe(handler);
transportSubscriberStats.subscribed = true;

const beginTransportCapture = (traceId, requestId, clientStartedEpoch, clientStartedPerf) => {
  const capture = {
    contract: 'agm-node-undici-client-transport-timeline.v1',
    traceId,
    requestId,
    headerCorrelation: null,
    timestamps: {
      clientStartedAt: iso(clientStartedEpoch),
      requestCreateAt: null,
      bodySentAt: null,
      responseHeadersAt: null,
      trailersAt: null,
      errorAt: null,
    },
    epochMs: {
      clientStartedAt: clientStartedEpoch,
      requestCreateAt: null,
      bodySentAt: null,
      responseHeadersAt: null,
      trailersAt: null,
      errorAt: null,
    },
    durationsMs: {
      clientStartToRequestCreate: null,
      requestCreateToBodySent: null,
      bodySentToResponseHeaders: null,
      requestCreateToResponseHeaders: null,
      responseHeadersToTrailers: null,
    },
    serverJoin: {
      key: 'traceId',
      createToServerReceiveMs: null,
      bodySentToServerReceiveMs: null,
      serverResponseToTransportHeadersMs: null,
      derivation: {
        createToServerReceiveMs: 'server.request.receive.receivedAt - clientTransport.requestCreateAt',
        bodySentToServerReceiveMs: 'server.request.receive.receivedAt - clientTransport.bodySentAt',
        serverResponseToTransportHeadersMs: 'clientTransport.responseHeadersAt - server.response.finish.completedAt',
      },
    },
    transportError: null,
    captureFinalizedAt: null,
    _timing: { clientStartedAt: clientStartedPerf },
  };
  pendingTransportCaptures.set(traceId, capture);
  transportSubscriberStats.activeCapturePeak = Math.max(
    transportSubscriberStats.activeCapturePeak,
    pendingTransportCaptures.size,
  );
  return capture;
};

const finalizeTransportCapture = (capture) => {
  pendingTransportCaptures.delete(capture.traceId);
  const timing = capture._timing;
  const duration = (later, earlier) => timing[later] !== undefined && timing[earlier] !== undefined
    ? round(timing[later] - timing[earlier])
    : null;
  capture.durationsMs = {
    clientStartToRequestCreate: duration('requestCreateAt', 'clientStartedAt'),
    requestCreateToBodySent: duration('bodySentAt', 'requestCreateAt'),
    bodySentToResponseHeaders: duration('responseHeadersAt', 'bodySentAt'),
    requestCreateToResponseHeaders: duration('responseHeadersAt', 'requestCreateAt'),
    responseHeadersToTrailers: duration('trailersAt', 'responseHeadersAt'),
  };
  capture.captureFinalizedAt = iso();
  delete capture._timing;
  return capture;
};

const unsubscribeUndiciTransport = () => {
  if (!transportSubscriberStats.subscribed || transportSubscriberStats.unsubscribed) return;
  for (const [diagnosticChannel, handler] of undiciSubscriptions) diagnosticChannel.unsubscribe(handler);
  transportSubscriberStats.unsubscribed = true;
};

const cpuSnapshot = () => os.cpus().map((cpu) => ({ ...cpu.times }));
const cpuPercent = (before, after) => {
  let idleDelta = 0;
  let totalDelta = 0;
  for (let index = 0; index < Math.min(before.length, after.length); index += 1) {
    for (const key of ['user', 'nice', 'sys', 'idle', 'irq']) {
      totalDelta += after[index][key] - before[index][key];
    }
    idleDelta += after[index].idle - before[index].idle;
  }
  return totalDelta > 0 ? round((1 - idleDelta / totalDelta) * 100) : null;
};

const clientSchedulingSamples = [];
const hostSamples = [];
const eventLoop = monitorEventLoopDelay({ resolution: 10 });
eventLoop.enable();

let schedulingWindowStartedEpoch = Date.now();
let schedulingPrior = performance.now();
const schedulingTimer = setInterval(() => {
  const sampledEpoch = Date.now();
  const sampledPerf = performance.now();
  clientSchedulingSamples.push({
    windowStartedAt: iso(schedulingWindowStartedEpoch),
    sampledAt: iso(sampledEpoch),
    intervalMs: 25,
    driftMs: round(Math.max(0, sampledPerf - schedulingPrior - 25)),
  });
  schedulingWindowStartedEpoch = sampledEpoch;
  schedulingPrior = sampledPerf;
}, 25);
schedulingTimer.unref();

let hostWindowStartedEpoch = Date.now();
let priorHostCpu = cpuSnapshot();
const captureHostSample = () => {
  const sampledEpoch = Date.now();
  const currentHostCpu = cpuSnapshot();
  const processMemory = process.memoryUsage();
  hostSamples.push({
    windowStartedAt: iso(hostWindowStartedEpoch),
    sampledAt: iso(sampledEpoch),
    cpuPercent: cpuPercent(priorHostCpu, currentHostCpu),
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
      usedPercent: round((1 - os.freemem() / os.totalmem()) * 100),
    },
    clientProcess: {
      rssBytes: processMemory.rss,
      heapUsedBytes: processMemory.heapUsed,
      externalBytes: processMemory.external,
    },
    loadAverage: os.loadavg(),
  });
  priorHostCpu = currentHostCpu;
  hostWindowStartedEpoch = sampledEpoch;
};
captureHostSample();
const hostTimer = setInterval(captureHostSample, 100);
hostTimer.unref();

const samples = [];
const controls = [];
const phaseCustody = [];
let sequence = 0;

const childEnvironment = Object.fromEntries(
  ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'Path', 'PATH']
    .filter((key) => typeof process.env[key] === 'string')
    .map((key) => [key, process.env[key]]),
);

function startControl(name, busyInitially = false) {
  const code = busyInitially
    ? 'const end=Date.now()+2500;while(Date.now()<end){};setInterval(()=>{},1000)'
    : 'setInterval(()=>{},1000)';
  const child = spawn(process.execPath, ['-e', code], {
    stdio: 'ignore',
    windowsHide: true,
    env: childEnvironment,
  });
  const record = {
    name,
    pid: child.pid ?? null,
    startedAt: iso(),
    initialBusyMs: busyInitially ? 2500 : 0,
    stopRequestedAt: null,
    exitedAt: null,
    exitCode: null,
    signal: null,
    error: null,
  };
  child.once('exit', (codeValue, signal) => {
    record.exitedAt = iso();
    record.exitCode = codeValue;
    record.signal = signal;
  });
  child.once('error', (value) => {
    record.error = errorDetails(value);
  });
  controls.push({ child, record });
  return child;
}

const waitForExit = (child, timeoutMs = 10_000) => new Promise((resolveExit) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    resolveExit(true);
    return;
  }
  let settled = false;
  const finish = (exited) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    child.off('exit', onExit);
    child.off('error', onError);
    resolveExit(exited);
  };
  const onExit = () => finish(true);
  const onError = () => finish(false);
  const timer = setTimeout(() => finish(false), timeoutMs);
  timer.unref();
  child.once('exit', onExit);
  child.once('error', onError);
});

async function stopControls() {
  const pending = [];
  for (const control of controls) {
    const { child, record } = control;
    if (child.exitCode !== null || child.signalCode !== null) continue;
    record.stopRequestedAt = iso();
    const wait = waitForExit(child);
    child.kill();
    pending.push(wait.then((exited) => ({ name: record.name, exited })));
  }
  const outcomes = await Promise.all(pending);
  return outcomes.every((outcome) => outcome.exited);
}

const samplesOverlapping = (items, startedEpoch, completedEpoch) => items.filter((item) => {
  const windowStart = Date.parse(item.windowStartedAt);
  const windowEnd = Date.parse(item.sampledAt);
  return windowStart <= completedEpoch && windowEnd >= startedEpoch;
});

async function requestSample(target, phase, iteration, kind, timeoutMs, linkedOfficial = null) {
  sequence += 1;
  const traceId = randomUUID();
  const requestId = traceId;
  const hostCpuBefore = cpuSnapshot();
  const hostFreeBefore = os.freemem();
  const processCpuBefore = process.cpuUsage();
  const processUsageBefore = process.resourceUsage();
  const startedEpoch = Date.now();
  const startedPerf = performance.now();
  const clientTransport = beginTransportCapture(traceId, requestId, startedEpoch, startedPerf);
  const signal = AbortSignal.timeout(timeoutMs);
  let status = 0;
  let error = null;
  let clientHeadersAt = null;
  let clientBodyAt = null;
  let echoedTraceId = null;
  let echoedRequestId = null;

  try {
    const response = await fetch(target.url, {
      ...target.init,
      headers: {
        ...(target.init.headers ?? {}),
        'x-trace-id': traceId,
        'x-request-id': requestId,
      },
      signal,
    });
    status = response.status;
    clientHeadersAt = iso();
    echoedTraceId = response.headers.get('x-trace-id');
    echoedRequestId = response.headers.get('x-request-id');
    await response.arrayBuffer();
    clientBodyAt = iso();
  } catch (value) {
    error = errorDetails(value);
  }

  const completedEpoch = Date.now();
  const clientCompletedAt = iso(completedEpoch);
  const durationMs = round(performance.now() - startedPerf);
  const processCpu = process.cpuUsage(processCpuBefore);
  const processUsageAfter = process.resourceUsage();
  const hostCpuAfter = cpuSnapshot();
  const hostFreeAfter = os.freemem();
  const timeoutReason = signal.aborted && signal.reason instanceof Error ? signal.reason.name : null;
  const timedOut = error?.name === 'TimeoutError' || timeoutReason === 'TimeoutError';

  // Allow an overdue scheduling timer to publish after the request duration is frozen.
  await immediate();
  finalizeTransportCapture(clientTransport);
  const associatedThroughEpoch = Date.now();
  const schedulingWindow = samplesOverlapping(clientSchedulingSamples, startedEpoch, associatedThroughEpoch);
  const hostWindow = samplesOverlapping(hostSamples, startedEpoch, associatedThroughEpoch);
  const statusPass = target.expectedStatuses.includes(status);
  const availabilityPass = error === null && statusPass;
  const latencyPass = !timedOut && durationMs <= officialTimeoutMs;
  const correlationPass = error !== null
    ? null
    : echoedTraceId === traceId && echoedRequestId === requestId;

  return {
    sequence,
    kind,
    officialSloIncluded: kind === 'OFFICIAL',
    phase,
    iteration,
    target: target.id,
    endpoint: target.endpoint,
    layer: target.layer,
    method: target.init.method,
    traceId,
    requestId,
    sameRequestAndTraceId: requestId === traceId,
    linkedOfficialTraceId: linkedOfficial?.traceId ?? null,
    linkedOfficialSequence: linkedOfficial?.sequence ?? null,
    timeoutMs,
    officialSloMs: officialTimeoutMs,
    timestamps: {
      clientStartedAt: iso(startedEpoch),
      deadlineAt: iso(startedEpoch + timeoutMs),
      clientHeadersAt,
      clientBodyAt,
      clientCompletedAt,
      schedulingObservedThrough: iso(associatedThroughEpoch),
    },
    durationMs,
    status,
    expectedStatuses: target.expectedStatuses,
    statusPass,
    availabilityPass,
    latencyPass,
    timedOut,
    timeoutReason,
    error,
    echoedTraceId,
    echoedRequestId,
    correlationPass,
    clientTransport,
    officialSloPass: kind === 'OFFICIAL' ? availabilityPass && latencyPass : null,
    diagnosticPass: kind === 'DIAGNOSTIC_RETRY_AFTER_TIMEOUT'
      ? availabilityPass && !timedOut && durationMs <= diagnosticTimeoutMs
      : null,
    clientTelemetry: {
      eventLoopScheduling: {
        samples: schedulingWindow.length,
        driftMaxMs: schedulingWindow.length ? Math.max(...schedulingWindow.map((item) => item.driftMs)) : null,
        driftP95Ms: percentile(schedulingWindow.map((item) => item.driftMs), 0.95),
      },
      processCpuMicros: { user: processCpu.user, system: processCpu.system },
      scheduling: {
        voluntaryContextSwitchDelta: processUsageAfter.voluntaryContextSwitches - processUsageBefore.voluntaryContextSwitches,
        involuntaryContextSwitchDelta: processUsageAfter.involuntaryContextSwitches - processUsageBefore.involuntaryContextSwitches,
      },
      memory: process.memoryUsage(),
    },
    hostTelemetry: {
      cpuPercentDuringRequest: cpuPercent(hostCpuBefore, hostCpuAfter),
      freeMemoryBytesBefore: hostFreeBefore,
      freeMemoryBytesAfter: hostFreeAfter,
      sampledWindowCount: hostWindow.length,
      sampledCpuMaxPercent: hostWindow.some((item) => item.cpuPercent !== null)
        ? Math.max(...hostWindow.map((item) => item.cpuPercent).filter((value) => value !== null))
        : null,
      sampledMemoryUsedMaxPercent: hostWindow.length
        ? Math.max(...hostWindow.map((item) => item.memory.usedPercent))
        : null,
    },
  };
}

async function runPhase(phase) {
  const startedAt = iso();
  const phaseOfficial = [];
  const phaseDiagnostic = [];
  for (let iteration = 1; iteration <= iterationsPerPhase; iteration += 1) {
    for (const target of targets) {
      const official = await requestSample(target, phase, iteration, 'OFFICIAL', officialTimeoutMs);
      samples.push(official);
      phaseOfficial.push(official);
      if (official.timedOut) {
        const diagnostic = await requestSample(
          target,
          phase,
          iteration,
          'DIAGNOSTIC_RETRY_AFTER_TIMEOUT',
          diagnosticTimeoutMs,
          official,
        );
        samples.push(diagnostic);
        phaseDiagnostic.push(diagnostic);
      }
    }
  }
  phaseCustody.push({
    phase,
    startedAt,
    completedAt: iso(),
    officialSamples: phaseOfficial.length,
    diagnosticRetries: phaseDiagnostic.length,
    officialFailures: phaseOfficial.filter((sample) => !sample.officialSloPass).length,
    officialTimeouts: phaseOfficial.filter((sample) => sample.timedOut).length,
  });
}

let harnessError = null;
let controlsStoppedPass = null;
try {
  if (profile === 'NATURAL_P9_OFF') {
    controlsStoppedPass = true;
    await runPhase('natural-p9-off');
  } else {
    await runPhase('baseline');
    startControl('copilot-control-plane');
    startControl('turn-projection');
    startControl('copilot-worker', true);
    await runPhase('copilot-running-and-worker-saturated');
    controlsStoppedPass = await stopControls();
    if (!controlsStoppedPass) throw new Error('CONTROL_PROCESSES_DID_NOT_STOP');
    await runPhase('copilot-turn-total-failure');
  }
} catch (value) {
  harnessError = errorDetails(value);
} finally {
  if (controls.some(({ child }) => child.exitCode === null && child.signalCode === null)) {
    controlsStoppedPass = await stopControls();
  }
  clearInterval(schedulingTimer);
  clearInterval(hostTimer);
  captureHostSample();
  eventLoop.disable();
  unsubscribeUndiciTransport();
}

const officialSamples = samples.filter((sample) => sample.kind === 'OFFICIAL');
const diagnosticRetries = samples.filter((sample) => sample.kind === 'DIAGNOSTIC_RETRY_AFTER_TIMEOUT');
const officialFailures = officialSamples.filter((sample) => !sample.officialSloPass);
const officialLatencies = officialSamples.map((sample) => sample.durationMs);
const summarize = (subset) => {
  const latencies = subset.map((sample) => sample.durationMs);
  const failures = subset.filter((sample) => !sample.officialSloPass);
  return {
    requests: subset.length,
    availabilityPercent: subset.length
      ? round(subset.filter((sample) => sample.availabilityPass).length / subset.length * 100)
      : null,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
    maxMs: latencies.length ? Math.max(...latencies) : null,
    failures: failures.length,
    timeouts: subset.filter((sample) => sample.timedOut).length,
    correlationFailures: subset.filter((sample) => sample.correlationPass === false).length,
  };
};

const report = {
  contract: 'agm-real-basic-timeout-correlated-probe.v1',
  generatedAt: iso(),
  runId,
  batch,
  profile,
  mode: 'P9_OFF_REAL_REQUESTS',
  basicUrl: baseUrl,
  configuration: {
    profile,
    profileArgument: {
      processArgvIndex: 6,
      cliPositionAfterScript: 5,
      default: 'P0_COMPAT_THREE_PHASE',
      naturalProfile: 'NATURAL_P9_OFF',
    },
    iterationsPerPhase,
    phases: phaseOrder,
    endpoints: targets.map(({ id, endpoint, method, expectedStatuses, layer }) => ({ id, endpoint, method, expectedStatuses, layer })),
    officialBasicSlo: { maxLatencyMs: officialTimeoutMs, unchanged: true },
    diagnosticRetry: {
      timeoutMs: diagnosticTimeoutMs,
      onlyAfterOfficialTimeout: true,
      excludedFromOfficialSlo: true,
      linkedBy: ['linkedOfficialTraceId', 'linkedOfficialSequence'],
    },
    clientTransport: {
      source: 'node:diagnostics_channel',
      channels: undiciChannelNames,
      correlationHeaders: ['x-trace-id', 'x-request-id'],
      capturesSecretsHeadersOrBodies: false,
      serverJoinKey: 'traceId',
    },
  },
  custody: {
    p9ActivationPerformed: false,
    p9ExpectedState: 'STOPPED',
    p9StateVerifiedByProbe: false,
    p9StateRequiresOrchestratorCustody: true,
    profile,
    faultInjection: false,
    serverFaultInjection: false,
    diagnosticFaultHeaderSent: false,
    controlProcessesSpawned: controls.length,
    busyLoopControlSpawned: controls.some(({ record }) => record.initialBusyMs > 0),
    backgroundContentionControl: profile === 'P0_COMPAT_THREE_PHASE',
    naturalProfileNoControls: profile === 'NATURAL_P9_OFF' ? controls.length === 0 : null,
    basicFunctionalChanges: 0,
    productionChanges: 0,
    externalSystemWrites: 0,
    localEvidenceWrites: 1,
    secretReadsPerformedByProbe: 0,
    controlsStoppedPass,
    harnessError,
  },
  phaseCustody,
  controls: controls.map(({ record }) => record),
  summary: {
    official: summarize(officialSamples),
    byPhase: Object.fromEntries(phaseOrder.map((phase) => [phase, summarize(officialSamples.filter((sample) => sample.phase === phase))])),
    byEndpoint: Object.fromEntries(targets.map((target) => [target.id, summarize(officialSamples.filter((sample) => sample.target === target.id))])),
    diagnosticRetries: {
      requests: diagnosticRetries.length,
      passed: diagnosticRetries.filter((sample) => sample.diagnosticPass).length,
      failed: diagnosticRetries.filter((sample) => !sample.diagnosticPass).length,
    },
    officialVerdict: harnessError
      ? 'HARNESS_ERROR_PARTIAL_EVIDENCE'
      : officialFailures.length === 0
        ? 'PASS_WITHIN_OFFICIAL_SLO'
        : 'FAIL_EVIDENCE_PRESERVED',
  },
  clientRuntime: {
    eventLoopDelayMs: {
      mean: Number.isFinite(eventLoop.mean) ? round(eventLoop.mean / 1e6) : null,
      p95: round(eventLoop.percentile(95) / 1e6),
      p99: round(eventLoop.percentile(99) / 1e6),
      max: round(eventLoop.max / 1e6),
    },
    schedulingSamples: clientSchedulingSamples,
    transportSubscribers: transportSubscriberStats,
  },
  hostTelemetry: {
    source: 'node:os',
    logicalCpuCount: os.cpus().length,
    availableParallelism: typeof os.availableParallelism === 'function' ? os.availableParallelism() : null,
    samples: hostSamples,
  },
  samples,
  failures: officialFailures,
  correlationFailures: officialSamples.filter((sample) => sample.correlationPass === false),
  diagnosticRetryFailures: diagnosticRetries.filter((sample) => !sample.diagnosticPass),
  diagnosticRetries,
  invariants: {
    expectedOfficialSamples: iterationsPerPhase * phaseOrder.length * targets.length,
    capturedOfficialSamples: officialSamples.length,
    allFailuresPreserved: officialFailures.every((failure) => samples.includes(failure)),
    diagnosticRetryCountMatchesTimeouts: diagnosticRetries.length === officialSamples.filter((sample) => sample.timedOut).length,
    allRequestsUseSameRequestAndTraceId: samples.every((sample) => sample.sameRequestAndTraceId),
    noDiagnosticSampleIncludedInOfficialDistribution: officialLatencies.length === officialSamples.length,
    transportCreateCapturedForAllRequests: samples.every((sample) => sample.clientTransport.timestamps.requestCreateAt !== null),
    transportTerminalCapturedForAllRequests: samples.every((sample) =>
      sample.clientTransport.timestamps.trailersAt !== null || sample.clientTransport.timestamps.errorAt !== null),
    transportCapturesReleased: pendingTransportCaptures.size === 0,
    transportSubscribersCleanedUp: transportSubscriberStats.unsubscribed,
    naturalProfileExactRequestCount: profile === 'NATURAL_P9_OFF'
      ? officialSamples.length === 180 && phaseOrder.length === 1 && iterationsPerPhase === 60
      : null,
    naturalProfileSpawnedNoControls: profile === 'NATURAL_P9_OFF' ? controls.length === 0 : null,
  },
};

await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);

console.log(`REAL BASIC TIMEOUT CORRELATED PROBE - ${report.summary.officialVerdict}`);
for (const phase of phaseOrder) {
  const summary = report.summary.byPhase[phase];
  console.log(`phase=${phase} requests=${summary.requests} failures=${summary.failures} timeouts=${summary.timeouts} p95=${summary.p95Ms}ms max=${summary.maxMs}ms`);
}
console.log(`official=${report.summary.official.requests} diagnosticRetries=${diagnosticRetries.length} correlationFailures=${report.summary.official.correlationFailures} evidence=${output}`);
if (harnessError) process.exitCode = 2;
