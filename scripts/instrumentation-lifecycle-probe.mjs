import { randomUUID } from 'node:crypto';
import { channel } from 'node:diagnostics_channel';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import process from 'node:process';

const OFFICIAL_BASIC_SLO_MS = 3000;
const MINIMUM_WINDOW_SECONDS = 150;
const SCHEDULING_INTERVAL_MS = 100;

const iso = (epoch = Date.now()) => new Date(epoch).toISOString();
const round = (value, digits = 3) => {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
};
const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
const immediate = () => new Promise((resolveImmediate) => setImmediate(resolveImmediate));
const percentile = (values, fraction) => {
  const usable = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!usable.length) return null;
  return round(usable[Math.min(usable.length - 1, Math.max(0, Math.ceil(usable.length * fraction) - 1))]);
};
const errorDetails = (value) => value instanceof Error
  ? {
      name: value.name,
      code: typeof value.cause?.code === 'string' ? value.cause.code : null,
      message: value.message.slice(0, 512),
    }
  : { name: 'UNKNOWN', code: null, message: String(value).slice(0, 512) };

async function publishJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  try {
    await access(path);
    throw new Error(`ATOMIC_PUBLICATION_TARGET_EXISTS_${path}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const temporaryPath = `${path}.publish-${process.pid}-${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    await rename(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`UNEXPECTED_POSITIONAL_ARGUMENT_${token}`);
    const name = token.slice(2);
    if (!name) throw new Error('EMPTY_ARGUMENT_NAME');
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`ARGUMENT_VALUE_REQUIRED_${name}`);
    values.set(name, value);
    index += 1;
  }

  const required = (name) => {
    const value = values.get(name);
    if (!value) throw new Error(`ARGUMENT_REQUIRED_${name}`);
    return value;
  };
  const number = (name, fallback) => {
    const raw = values.get(name);
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isFinite(value)) throw new Error(`ARGUMENT_NOT_NUMERIC_${name}`);
    return value;
  };

  const output = resolve(required('output'));
  const configuration = {
    baseUrl: required('base-url'),
    output,
    eventsOutput: resolve(values.get('events-output') ?? resolve(dirname(output), 'client-events.jsonl')),
    runId: required('run-id'),
    durationSeconds: number('duration-seconds', MINIMUM_WINDOW_SECONDS),
    requestIntervalMs: number('request-interval-ms', 1000),
    readyFile: resolve(values.get('ready-file') ?? resolve(dirname(output), 'client-ready.json')),
    startSignal: resolve(required('start-signal')),
    boundarySignal: resolve(required('boundary-signal')),
    startTimeoutSeconds: number('start-timeout-seconds', 120),
    parentPid: number('parent-pid', 0),
  };

  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(configuration.runId)) throw new Error('RUN_ID_INVALID');
  if (!Number.isInteger(configuration.durationSeconds) || configuration.durationSeconds < MINIMUM_WINDOW_SECONDS || configuration.durationSeconds > 3600) {
    throw new Error('DURATION_SECONDS_MUST_BE_INTEGER_AT_LEAST_150_AND_AT_MOST_3600');
  }
  if (!Number.isInteger(configuration.requestIntervalMs) || configuration.requestIntervalMs < 250 || configuration.requestIntervalMs > 30_000) {
    throw new Error('REQUEST_INTERVAL_MS_OUT_OF_RANGE');
  }
  if (!Number.isInteger(configuration.startTimeoutSeconds) || configuration.startTimeoutSeconds < 1 || configuration.startTimeoutSeconds > 600) {
    throw new Error('START_TIMEOUT_SECONDS_OUT_OF_RANGE');
  }
  if (!Number.isInteger(configuration.parentPid) || configuration.parentPid < 0) throw new Error('PARENT_PID_INVALID');
  const evidencePaths = [configuration.output, configuration.eventsOutput, configuration.readyFile, configuration.startSignal, configuration.boundarySignal];
  if (new Set(evidencePaths.map((path) => path.toLowerCase())).size !== evidencePaths.length) {
    throw new Error('OUTPUT_READY_EVENT_START_AND_BOUNDARY_SIGNAL_PATHS_MUST_DIFFER');
  }

  const base = new URL(configuration.baseUrl);
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(base.hostname)) {
    throw new Error('LIFECYCLE_PROBE_REQUIRES_LOOPBACK_HTTP');
  }
  configuration.baseUrl = base.href.replace(/\/$/, '');
  return configuration;
}

function parentIsAlive(parentPid) {
  if (!parentPid) return true;
  try {
    process.kill(parentPid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForStartSignal(configuration) {
  const readyAt = Date.now();
  const ready = {
    contract: 'agm-instrumentation-lifecycle-client-ready.v1',
    runId: configuration.runId,
    pid: process.pid,
    parentPid: configuration.parentPid || null,
    readyAt: iso(readyAt),
    startSignalRequired: configuration.startSignal !== null,
    startSignal: configuration.startSignal,
    requestedDurationSeconds: configuration.durationSeconds,
  };
  await mkdir(dirname(configuration.readyFile), { recursive: true });
  await writeFile(configuration.readyFile, `${JSON.stringify(ready, null, 2)}\n`, { flag: 'wx' });

  const waitStarted = performance.now();
  while (performance.now() - waitStarted <= configuration.startTimeoutSeconds * 1000) {
    if (!parentIsAlive(configuration.parentPid)) throw new Error('PARENT_EXITED_BEFORE_START_SIGNAL');
    try {
      await access(configuration.startSignal);
      const signal = JSON.parse((await readFile(configuration.startSignal, 'utf8')).replace(/^\uFEFF/, ''));
      const startAtEpochMs = Number(signal.startAtEpochMs);
      const durationSeconds = Number(signal.durationSeconds);
      if (!Number.isFinite(startAtEpochMs) || startAtEpochMs <= 0) throw new Error('START_SIGNAL_START_EPOCH_INVALID');
      if (!Number.isInteger(durationSeconds) || durationSeconds !== configuration.durationSeconds) {
        throw new Error('START_SIGNAL_DURATION_MISMATCH');
      }
      if (signal.windowId !== undefined && signal.windowId !== configuration.runId) throw new Error('START_SIGNAL_RUN_ID_MISMATCH');
      if (Date.now() - startAtEpochMs > 5000) throw new Error('START_SIGNAL_STALE');
      if (startAtEpochMs - Date.now() > configuration.startTimeoutSeconds * 1000) throw new Error('START_SIGNAL_TOO_FAR_IN_FUTURE');

      while (Date.now() < startAtEpochMs) {
        if (!parentIsAlive(configuration.parentPid)) throw new Error('PARENT_EXITED_BEFORE_SCHEDULED_START');
        await sleep(Math.min(50, Math.max(1, startAtEpochMs - Date.now())));
      }
      return {
        ...ready,
        signalObservedAt: iso(),
        scheduledStartAtEpochMs: startAtEpochMs,
        scheduledStartAt: iso(startAtEpochMs),
        signalDurationSeconds: durationSeconds,
        signalWindowId: typeof signal.windowId === 'string' ? signal.windowId : configuration.runId,
        signalMode: 'JSON_START_SIGNAL',
      };
    } catch (error) {
      if (!(error instanceof SyntaxError) && String(error?.message ?? '').startsWith('START_SIGNAL_')) throw error;
      await sleep(50);
    }
  }
  throw new Error('START_SIGNAL_TIMEOUT');
}

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
  if (Array.isArray(headers)) {
    for (let index = 0; index + 1 < headers.length; index += 2) {
      if (String(headers[index]).toLowerCase() === wantedName) return String(headers[index + 1]);
    }
    return null;
  }
  if (typeof headers === 'string') {
    for (const line of headers.split(/\r?\n/)) {
      const separator = line.indexOf(':');
      if (separator > 0 && line.slice(0, separator).trim().toLowerCase() === wantedName) {
        return line.slice(separator + 1).trim();
      }
    }
    return null;
  }
  if (headers && typeof headers.get === 'function') return headers.get(wantedName);
  if (headers && typeof headers === 'object') {
    for (const [name, value] of Object.entries(headers)) {
      if (name.toLowerCase() === wantedName) return Array.isArray(value) ? String(value[0]) : String(value);
    }
  }
  return null;
};
const captureForRequest = (request) => request && typeof request === 'object'
  ? requestTransportCaptures.get(request) ?? null
  : null;
const markTransportEvent = (capture, event, counter) => {
  if (!capture?._timing || capture.timestamps[event] !== null) return;
  const epochMs = Date.now();
  capture.timestamps[event] = iso(epochMs);
  capture.epochMs[event] = epochMs;
  capture._timing[event] = performance.now();
  transportSubscriberStats[counter] += 1;
};
const handlers = {
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
    if (!capture) return void (transportSubscriberStats.ignoredEvents += 1);
    markTransportEvent(capture, 'bodySentAt', 'bodySentEvents');
  },
  headers(message) {
    const capture = captureForRequest(message?.request);
    if (!capture) return void (transportSubscriberStats.ignoredEvents += 1);
    markTransportEvent(capture, 'responseHeadersAt', 'responseHeadersEvents');
  },
  trailers(message) {
    const capture = captureForRequest(message?.request);
    if (!capture) return void (transportSubscriberStats.ignoredEvents += 1);
    markTransportEvent(capture, 'trailersAt', 'trailersEvents');
    requestTransportCaptures.delete(message.request);
  },
  error(message) {
    const capture = captureForRequest(message?.request);
    if (!capture) return void (transportSubscriberStats.ignoredEvents += 1);
    markTransportEvent(capture, 'errorAt', 'errorEvents');
    capture.transportError = errorDetails(message?.error);
    requestTransportCaptures.delete(message.request);
  },
};
const subscriptions = [
  [channel('undici:request:create'), handlers.create],
  [channel('undici:request:bodySent'), handlers.bodySent],
  [channel('undici:request:headers'), handlers.headers],
  [channel('undici:request:trailers'), handlers.trailers],
  [channel('undici:request:error'), handlers.error],
];
for (const [diagnosticChannel, handler] of subscriptions) diagnosticChannel.subscribe(handler);
transportSubscriberStats.subscribed = true;

function beginTransportCapture(traceId, requestId, clientStartedEpoch, clientStartedPerf) {
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
    durationsMs: {},
    transportError: null,
    captureFinalizedAt: null,
    _timing: { clientStartedAt: clientStartedPerf },
  };
  pendingTransportCaptures.set(traceId, capture);
  transportSubscriberStats.activeCapturePeak = Math.max(transportSubscriberStats.activeCapturePeak, pendingTransportCaptures.size);
  return capture;
}

function finalizeTransportCapture(capture) {
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
}

function unsubscribeTransport() {
  if (transportSubscriberStats.unsubscribed) return;
  for (const [diagnosticChannel, handler] of subscriptions) diagnosticChannel.unsubscribe(handler);
  transportSubscriberStats.unsubscribed = true;
}

const targets = (baseUrl, invalidLoginIdentity) => [
  {
    id: 'health', endpoint: '/health', layer: 'HTTP_NO_DB', url: `${baseUrl}/health`,
    init: { method: 'GET' }, expectedStatuses: [200],
  },
  {
    id: 'login-invalid', endpoint: '/auth/login', layer: 'HTTP_DB_LOOKUP', url: `${baseUrl}/auth/login`,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: invalidLoginIdentity.email,
        password: invalidLoginIdentity.password,
      }),
    },
    expectedStatuses: [401, 429],
  },
  {
    id: 'entitlement-unauthenticated', endpoint: '/auth/entitlements', layer: 'HTTP_AUTH_GUARD',
    url: `${baseUrl}/auth/entitlements`, init: { method: 'GET' }, expectedStatuses: [401, 429],
  },
];

async function closeStream(stream) {
  await new Promise((resolveClose, rejectClose) => {
    stream.once('error', rejectClose);
    stream.end(resolveClose);
  });
}

const configuration = parseArguments(process.argv.slice(2));
// A fresh high-entropy identity makes an accidental valid-login match
// practically impossible without reading or mutating the database. Neither
// credential is serialized into the evidence artifacts.
const invalidLoginIdentity = Object.freeze({
  email: `instrumentation-lifecycle-${randomUUID()}@example.invalid`,
  password: `invalid-${randomUUID()}`,
});
const requestTargets = targets(configuration.baseUrl, invalidLoginIdentity);
await mkdir(dirname(configuration.output), { recursive: true });
await mkdir(dirname(configuration.eventsOutput), { recursive: true });
const eventStream = createWriteStream(configuration.eventsOutput, { flags: 'wx', encoding: 'utf8' });
const writeEvent = (record) => eventStream.write(`${JSON.stringify({ at: iso(), runId: configuration.runId, clientPid: process.pid, ...record })}\n`);

const schedulingSamples = [];
const requests = [];
const lifecycleErrors = [];
const eventLoop = monitorEventLoopDelay({ resolution: 10 });
let schedulingTimer = null;
let externalStopSignal = null;
let signalEvidence = null;
let windowEvidence = null;
let boundaryEvidence = null;
let windowProcessCpu = null;
let windowResourceBefore = null;
let memoryBefore = null;
let skippedScheduleSlots = 0;

for (const signalName of ['SIGINT', 'SIGTERM']) {
  process.once(signalName, () => { externalStopSignal = signalName; });
}

async function captureRequest(target, sequence, slot, scheduledPerf, windowStartEpoch, windowStartPerf) {
  const traceId = randomUUID();
  const requestId = traceId;
  const clientStartedEpoch = Date.now();
  const clientStartedPerf = performance.now();
  const processCpuBefore = process.cpuUsage();
  const usageBefore = process.resourceUsage();
  const transport = beginTransportCapture(traceId, requestId, clientStartedEpoch, clientStartedPerf);
  const signal = AbortSignal.timeout(OFFICIAL_BASIC_SLO_MS);
  let status = 0;
  let error = null;
  let clientHeadersAt = null;
  let clientBodyAt = null;
  let echoedTraceId = null;
  let echoedRequestId = null;

  try {
    const response = await fetch(target.url, {
      ...target.init,
      redirect: 'error',
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

  const clientCompletedEpoch = Date.now();
  const clientCompletedPerf = performance.now();
  await immediate();
  finalizeTransportCapture(transport);
  const processCpu = process.cpuUsage(processCpuBefore);
  const usageAfter = process.resourceUsage();
  const schedulingWindow = schedulingSamples.filter((sample) => {
    const sampledEpoch = Date.parse(sample.sampledAt);
    return sampledEpoch >= clientStartedEpoch - SCHEDULING_INTERVAL_MS && sampledEpoch <= clientCompletedEpoch + SCHEDULING_INTERVAL_MS;
  });
  const timeoutReason = signal.aborted && signal.reason instanceof Error ? signal.reason.name : null;
  const timedOut = timeoutReason === 'TimeoutError' || error?.name === 'TimeoutError';
  const statusAccepted = error === null && target.expectedStatuses.includes(status);
  const durationMs = round(clientCompletedPerf - clientStartedPerf);
  const record = {
    contract: 'agm-instrumentation-lifecycle-client-request.v1',
    sequence,
    scheduleSlot: slot,
    scheduledAt: iso(windowStartEpoch + (scheduledPerf - windowStartPerf)),
    scheduleDelayMs: round(Math.max(0, clientStartedPerf - scheduledPerf)),
    target: target.id,
    endpoint: target.endpoint,
    layer: target.layer,
    method: target.init.method,
    traceId,
    requestId,
    officialSloIncluded: true,
    officialBasicSloMs: OFFICIAL_BASIC_SLO_MS,
    timeoutMs: OFFICIAL_BASIC_SLO_MS,
    retries: 0,
    faultHeaders: 0,
    timestamps: {
      clientStartedAt: iso(clientStartedEpoch),
      deadlineAt: iso(clientStartedEpoch + OFFICIAL_BASIC_SLO_MS),
      clientHeadersAt,
      clientBodyAt,
      clientCompletedAt: iso(clientCompletedEpoch),
    },
    durationMs,
    status,
    expectedStatuses: target.expectedStatuses,
    statusAccepted,
    timedOut,
    timeoutReason,
    withinOfficialSlo: statusAccepted && !timedOut && durationMs <= OFFICIAL_BASIC_SLO_MS,
    error,
    echoedTraceId,
    echoedRequestId,
    identityCorrelated: error === null ? echoedTraceId === traceId && echoedRequestId === requestId : null,
    clientTransport: transport,
    clientRuntime: {
      schedulingSamples: schedulingWindow.length,
      driftP95Ms: percentile(schedulingWindow.map((sample) => sample.driftMs), 0.95),
      driftMaxMs: schedulingWindow.length ? round(Math.max(...schedulingWindow.map((sample) => sample.driftMs))) : null,
      processCpuMicros: processCpu,
      voluntaryContextSwitchDelta: usageAfter.voluntaryContextSwitches - usageBefore.voluntaryContextSwitches,
      involuntaryContextSwitchDelta: usageAfter.involuntaryContextSwitches - usageBefore.involuntaryContextSwitches,
      memory: process.memoryUsage(),
    },
  };
  requests.push(record);
  writeEvent({ type: 'client.request', request: record });
}

let runError = null;
try {
  signalEvidence = await waitForStartSignal(configuration);
  writeEvent({ type: 'client.ready', ready: signalEvidence });

  const actualStartedEpoch = Date.now();
  const actualStartedPerf = performance.now();
  const durationMs = configuration.durationSeconds * 1000;
  const deadlinePerf = actualStartedPerf + durationMs;
  const deadlineEpoch = actualStartedEpoch + durationMs;
  const requestStartCutoffPerf = deadlinePerf - OFFICIAL_BASIC_SLO_MS;
  const processCpuBefore = process.cpuUsage();
  windowResourceBefore = process.resourceUsage();
  memoryBefore = process.memoryUsage();
  eventLoop.enable();
  eventLoop.reset();

  windowEvidence = {
    contract: 'agm-instrumentation-lifecycle-window.v1',
    scheduledStartAt: signalEvidence.scheduledStartAt,
    scheduledStartAtEpochMs: signalEvidence.scheduledStartAtEpochMs,
    actualStartedAt: iso(actualStartedEpoch),
    actualStartedEpochMs: actualStartedEpoch,
    startLatenessMs: round(Math.max(0, actualStartedEpoch - signalEvidence.scheduledStartAtEpochMs)),
    monotonicStartedMs: round(actualStartedPerf),
    requestedDurationMs: durationMs,
    deadlineAt: iso(deadlineEpoch),
    requestStartCutoffAt: iso(actualStartedEpoch + (requestStartCutoffPerf - actualStartedPerf)),
    completedAt: null,
    monotonicCompletedMs: null,
    observedDurationMs: null,
  };
  writeEvent({ type: 'window.start', window: windowEvidence });

  let priorSchedulingEpoch = actualStartedEpoch;
  let priorSchedulingPerf = actualStartedPerf;
  schedulingTimer = setInterval(() => {
    const sampledEpoch = Date.now();
    const sampledPerf = performance.now();
    const sample = {
      sequence: schedulingSamples.length + 1,
      windowStartedAt: iso(priorSchedulingEpoch),
      sampledAt: iso(sampledEpoch),
      expectedIntervalMs: SCHEDULING_INTERVAL_MS,
      observedIntervalMs: round(sampledPerf - priorSchedulingPerf),
      driftMs: round(Math.max(0, sampledPerf - priorSchedulingPerf - SCHEDULING_INTERVAL_MS)),
    };
    schedulingSamples.push(sample);
    writeEvent({ type: 'client.scheduling', sample });
    priorSchedulingEpoch = sampledEpoch;
    priorSchedulingPerf = sampledPerf;
  }, SCHEDULING_INTERVAL_MS);

  let nextScheduledPerf = actualStartedPerf;
  let sequence = 0;
  let scheduleSlot = 0;
  while (performance.now() < requestStartCutoffPerf) {
    if (externalStopSignal) throw new Error(`EXTERNAL_STOP_${externalStopSignal}`);
    if (!parentIsAlive(configuration.parentPid)) throw new Error('PARENT_EXITED_DURING_WINDOW');
    const nowPerf = performance.now();
    if (nowPerf < nextScheduledPerf) {
      await sleep(Math.min(50, Math.max(1, nextScheduledPerf - nowPerf)));
      continue;
    }
    if (nowPerf >= requestStartCutoffPerf) break;

    scheduleSlot += 1;
    sequence += 1;
    const target = requestTargets[(sequence - 1) % requestTargets.length];
    await captureRequest(target, sequence, scheduleSlot, nextScheduledPerf, actualStartedEpoch, actualStartedPerf);

    nextScheduledPerf += configuration.requestIntervalMs;
    const afterRequestPerf = performance.now();
    if (nextScheduledPerf < afterRequestPerf) {
      const missed = Math.floor((afterRequestPerf - nextScheduledPerf) / configuration.requestIntervalMs) + 1;
      skippedScheduleSlots += missed;
      scheduleSlot += missed;
      nextScheduledPerf += missed * configuration.requestIntervalMs;
    }
  }

  while (performance.now() < deadlinePerf) {
    if (externalStopSignal) throw new Error(`EXTERNAL_STOP_${externalStopSignal}`);
    if (!parentIsAlive(configuration.parentPid)) throw new Error('PARENT_EXITED_DURING_WINDOW');
    await sleep(Math.min(50, Math.max(1, deadlinePerf - performance.now())));
  }

  const completedEpoch = Date.now();
  const completedPerf = performance.now();
  windowProcessCpu = process.cpuUsage(processCpuBefore);
  windowEvidence.completedAt = iso(completedEpoch);
  windowEvidence.monotonicCompletedMs = round(completedPerf);
  windowEvidence.observedDurationMs = round(completedPerf - actualStartedPerf);
  windowEvidence.completedAfterDeadlineMs = round(Math.max(0, completedPerf - deadlinePerf));
  const boundaryPublicationRequestedAt = iso();
  boundaryEvidence = {
    contract: 'agm-instrumentation-lifecycle-sampler-boundary.v1',
    runId: configuration.runId,
    windowId: configuration.runId,
    clientPid: process.pid,
    reason: 'CLIENT_WINDOW_COMPLETED',
    requestedAt: boundaryPublicationRequestedAt,
    clientCompletedAt: windowEvidence.completedAt,
    boundaryAt: windowEvidence.completedAt,
    boundaryAtEpochMs: completedEpoch,
    boundaryAtMonotonicMs: windowEvidence.monotonicCompletedMs,
    actualStartedAt: windowEvidence.actualStartedAt,
    actualStartedEpochMs: windowEvidence.actualStartedEpochMs,
    observedDurationMs: windowEvidence.observedDurationMs,
    requestedDurationMs: windowEvidence.requestedDurationMs,
    officialBasicSloMs: OFFICIAL_BASIC_SLO_MS,
    publicationRequestedAt: boundaryPublicationRequestedAt,
  };
  await publishJsonAtomic(configuration.boundarySignal, boundaryEvidence);
  writeEvent({ type: 'window.complete', window: windowEvidence });
} catch (error) {
  runError = errorDetails(error);
  lifecycleErrors.push(runError);
  writeEvent({ type: 'client.error', error: runError });
} finally {
  if (schedulingTimer) clearInterval(schedulingTimer);
  eventLoop.disable();
  unsubscribeTransport();
}

const officialDurations = requests.map((request) => request.durationMs).filter(Number.isFinite);
const withinSlo = requests.filter((request) => request.withinOfficialSlo).length;
const usageAfter = process.resourceUsage();
const memoryAfter = process.memoryUsage();
const schedulingWindowStartMs = Date.parse(windowEvidence?.actualStartedAt ?? '');
const schedulingWindowEndMs = Date.parse(windowEvidence?.completedAt ?? '');
const schedulingExpectedSamples = Number.isFinite(windowEvidence?.observedDurationMs)
  ? Math.floor(windowEvidence.observedDurationMs / SCHEDULING_INTERVAL_MS)
  : null;
const schedulingIntervals = schedulingSamples.map((sample) => ({
  start: Date.parse(sample.windowStartedAt),
  end: Date.parse(sample.sampledAt),
})).filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end >= interval.start);
const schedulingObservedCoveredMs = Number.isFinite(schedulingWindowStartMs) && Number.isFinite(schedulingWindowEndMs)
  ? schedulingIntervals.reduce((total, interval) => total + Math.max(0,
    Math.min(schedulingWindowEndMs, interval.end) - Math.max(schedulingWindowStartMs, interval.start)), 0)
  : null;
const schedulingHeadExcludedMs = Number.isFinite(schedulingWindowStartMs) && schedulingIntervals.length
  ? Math.max(0, schedulingIntervals[0].start - schedulingWindowStartMs)
  : null;
const schedulingTailExcludedMs = Number.isFinite(schedulingWindowEndMs) && schedulingIntervals.length
  ? Math.max(0, schedulingWindowEndMs - schedulingIntervals.at(-1).end)
  : null;
const schedulingClockDomainExcludedMs = Number.isFinite(windowEvidence?.observedDurationMs)
  && Number.isFinite(schedulingWindowStartMs) && Number.isFinite(schedulingWindowEndMs)
  ? Math.max(0, windowEvidence.observedDurationMs - (schedulingWindowEndMs - schedulingWindowStartMs))
  : null;
const schedulingAccountedMs = [schedulingObservedCoveredMs, schedulingHeadExcludedMs,
  schedulingTailExcludedMs, schedulingClockDomainExcludedMs]
  .every(Number.isFinite)
  ? schedulingObservedCoveredMs + schedulingHeadExcludedMs + schedulingTailExcludedMs + schedulingClockDomainExcludedMs
  : null;
const report = {
  contract: 'agm-instrumentation-lifecycle-client-timeline.v1',
  generatedAt: iso(),
  status: runError ? 'PARTIAL_EVIDENCE_OWNER_REVIEW' : 'EVIDENCE_CAPTURED_OWNER_REVIEW',
  runId: configuration.runId,
  clientPid: process.pid,
  configuration: {
    baseUrl: configuration.baseUrl,
    durationSeconds: configuration.durationSeconds,
    requestIntervalMs: configuration.requestIntervalMs,
    schedulingIntervalMs: SCHEDULING_INTERVAL_MS,
    officialBasicSloMs: OFFICIAL_BASIC_SLO_MS,
    officialBasicSloUnchanged: true,
    endpoints: requestTargets.map(({ id, endpoint, layer, init, expectedStatuses }) => ({
      id, endpoint, layer, method: init.method, expectedStatuses,
    })),
    loopbackOnly: true,
    boundarySignal: configuration.boundarySignal,
  },
  custody: {
    p9: 'STOPPED',
    p9ActivationPerformed: false,
    p9TrafficGenerated: false,
    officialSoakRestarted: false,
    production: false,
    deployPerformed: false,
    postgresRestarted: false,
    faultInjection: false,
    faultHeadersSent: 0,
    retriesPerformed: 0,
    externalWrites: 0,
    localEvidenceWritesOnly: true,
    invalidLoginUsesReservedDomainAndKnownInvalidCredential: true,
    invalidLoginIdentityRandomizedPerRun: true,
    invalidLoginIdentityRecordedInEvidence: false,
  },
  readiness: signalEvidence,
  window: windowEvidence,
  boundary: boundaryEvidence,
  summary: {
    requests: requests.length,
    withinOfficialSlo: withinSlo,
    outsideOfficialSlo: requests.length - withinSlo,
    timeouts: requests.filter((request) => request.timedOut).length,
    availabilityPercent: requests.length ? round(requests.filter((request) => request.statusAccepted).length / requests.length * 100) : null,
    p50Ms: percentile(officialDurations, 0.5),
    p95Ms: percentile(officialDurations, 0.95),
    p99Ms: percentile(officialDurations, 0.99),
    maxMs: officialDurations.length ? round(Math.max(...officialDurations)) : null,
    identityCorrelationFailures: requests.filter((request) => request.identityCorrelated === false).length,
    skippedScheduleSlots,
    byEndpoint: Object.fromEntries(requestTargets.map((target) => {
      const subset = requests.filter((request) => request.target === target.id);
      return [target.id, {
        requests: subset.length,
        timeouts: subset.filter((request) => request.timedOut).length,
        maxMs: subset.length ? round(Math.max(...subset.map((request) => request.durationMs))) : null,
      }];
    })),
  },
  clientRuntime: {
    eventLoopDelayMs: {
      mean: Number.isFinite(eventLoop.mean) ? round(eventLoop.mean / 1e6) : null,
      p95: round(eventLoop.percentile(95) / 1e6),
      p99: round(eventLoop.percentile(99) / 1e6),
      max: round(eventLoop.max / 1e6),
    },
    scheduling: {
      contract: 'agm-client-scheduling-temporal-coverage.v1',
      coverageBasis: 'CONTIGUOUS_OBSERVED_INTERVALS_PLUS_EXPLICIT_BOUNDARY_EXCLUSIONS',
      allowedExclusions: ['BOUNDARY_HEAD_BEFORE_FIRST_INTERVAL', 'BOUNDARY_TAIL_AFTER_LAST_COMPLETE_INTERVAL', 'CLOCK_DOMAIN_ROUNDING_SKEW'],
      intervalMs: SCHEDULING_INTERVAL_MS,
      samples: schedulingSamples.length,
      expectedSamples: schedulingExpectedSamples,
      rawSampleRatio: schedulingExpectedSamples ? round(schedulingSamples.length / schedulingExpectedSamples, 6) : null,
      coalescedTimerSlots: schedulingExpectedSamples === null ? null : Math.max(0, schedulingExpectedSamples - schedulingSamples.length),
      observedCoveredMs: schedulingObservedCoveredMs === null ? null : round(schedulingObservedCoveredMs),
      boundaryHeadExcludedMs: schedulingHeadExcludedMs === null ? null : round(schedulingHeadExcludedMs),
      boundaryTailExcludedMs: schedulingTailExcludedMs === null ? null : round(schedulingTailExcludedMs),
      clockDomainRoundingExcludedMs: schedulingClockDomainExcludedMs === null ? null : round(schedulingClockDomainExcludedMs),
      accountedCoverageMs: schedulingAccountedMs === null ? null : round(schedulingAccountedMs),
      accountedCoverageRatio: schedulingAccountedMs === null || !windowEvidence?.observedDurationMs
        ? null
        : round(Math.min(1, schedulingAccountedMs / windowEvidence.observedDurationMs), 6),
      driftP50Ms: percentile(schedulingSamples.map((sample) => sample.driftMs), 0.5),
      driftP95Ms: percentile(schedulingSamples.map((sample) => sample.driftMs), 0.95),
      driftP99Ms: percentile(schedulingSamples.map((sample) => sample.driftMs), 0.99),
      driftMaxMs: schedulingSamples.length ? round(Math.max(...schedulingSamples.map((sample) => sample.driftMs))) : null,
      rawSamples: schedulingSamples,
    },
    process: {
      cpuMicrosDuringWindow: windowProcessCpu,
      resourceUsageStart: windowResourceBefore,
      resourceUsageEnd: usageAfter,
      memoryStart: memoryBefore,
      memoryEnd: memoryAfter,
    },
    transportSubscribers: transportSubscriberStats,
  },
  requests,
  errors: lifecycleErrors,
  invariants: {
    oneClientProcess: true,
    durationAtLeast150Seconds: windowEvidence?.observedDurationMs >= MINIMUM_WINDOW_SECONDS * 1000,
    requestedAndSignalDurationMatch: signalEvidence?.signalDurationSeconds === configuration.durationSeconds,
    officialTimeoutUnchanged: requests.every((request) => request.timeoutMs === OFFICIAL_BASIC_SLO_MS),
    noRetries: requests.every((request) => request.retries === 0),
    noFaultHeaders: requests.every((request) => request.faultHeaders === 0),
    everyRequestRetained: requests.length === requests.filter((request) => request.sequence > 0).length,
    uniqueTraceIds: new Set(requests.map((request) => request.traceId)).size === requests.length,
    requestIdEqualsTraceId: requests.every((request) => request.requestId === request.traceId),
    transportCapturesReleased: pendingTransportCaptures.size === 0,
    transportSubscribersReleased: transportSubscriberStats.unsubscribed,
    rawSchedulingRetained: schedulingSamples.length > 0,
    parentAliveAtCompletion: parentIsAlive(configuration.parentPid),
    boundaryPublishedAtClientWindowCompletion: boundaryEvidence?.boundaryAt === windowEvidence?.completedAt
      && boundaryEvidence?.observedDurationMs === windowEvidence?.observedDurationMs,
  },
};

await closeStream(eventStream);
await writeFile(configuration.output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(`INSTRUMENTATION LIFECYCLE CLIENT EVIDENCE — OWNER REVIEW / ${configuration.output}`);
if (runError) process.exitCode = 2;
