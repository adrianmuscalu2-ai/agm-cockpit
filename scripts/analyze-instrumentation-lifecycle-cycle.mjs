import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';

const OWNER_REVIEW_STATUS = 'INSTRUMENTATION LIFECYCLE CLOSURE \u2014 OWNER REVIEW';
const OFFICIAL_BASIC_SLO_MS = 3000;
const REQUIRED_WINDOW_MS = 150_000;

const root = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('RUN_DIRECTORY_REQUIRED');
const output = resolve(process.argv[3] ?? join(root, 'instrumentation-lifecycle-analysis.json'));
const issues = [];
const cautions = [];

const round = (value, digits = 3) => {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
};
const finite = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const numericDelta = (after, before) => {
  const normalizedAfter = finite(after);
  const normalizedBefore = finite(before);
  return normalizedAfter === null || normalizedBefore === null ? null : normalizedAfter - normalizedBefore;
};
const epoch = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const percentile = (values, fraction) => {
  const usable = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!usable.length) return null;
  return round(usable[Math.min(usable.length - 1, Math.max(0, Math.ceil(usable.length * fraction) - 1))]);
};
const pick = (object, paths) => {
  for (const path of paths) {
    let current = object;
    let found = true;
    for (const part of path.split('.')) {
      if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(Object(current), part)) {
        found = false;
        break;
      }
      current = current[part];
    }
    if (found) return current;
  }
  return undefined;
};
const addIssue = (code, detail = null) => issues.push(detail === null ? { code } : { code, detail });
const addCaution = (code, detail = null) => cautions.push(detail === null ? { code } : { code, detail });

async function loadJson(name, required = true) {
  const path = join(root, name);
  try {
    return { present: true, name, path, document: JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      if (required) addIssue('EVIDENCE_FILE_MISSING', name);
      return { present: false, name, path, document: null };
    }
    addIssue('EVIDENCE_JSON_INVALID', { name, error: error instanceof Error ? error.message : String(error) });
    return { present: false, name, path, document: null };
  }
}

async function loadFirstJson(names, label, required = true) {
  for (const name of names) {
    const loaded = await loadJson(name, false);
    if (loaded.present) return loaded;
  }
  if (required) addIssue('EVIDENCE_FILE_GROUP_MISSING', { label, candidates: names });
  return { present: false, name: null, path: null, document: null };
}

async function loadJsonLines(names, label, required = true) {
  let selected = null;
  let text = null;
  for (const name of names) {
    try {
      text = (await readFile(join(root, name), 'utf8')).replace(/^\uFEFF/, '');
      selected = name;
      break;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        addIssue('EVIDENCE_JSONL_READ_FAILED', { name, error: error instanceof Error ? error.message : String(error) });
        return { present: false, name, records: [], invalidLines: [] };
      }
    }
  }
  if (!selected) {
    if (required) addIssue('EVIDENCE_FILE_GROUP_MISSING', { label, candidates: names });
    return { present: false, name: null, records: [], invalidLines: [] };
  }
  const records = [];
  const invalidLines = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try { records.push(JSON.parse(line)); }
    catch { invalidLines.push(index + 1); }
  });
  if (invalidLines.length) addIssue('EVIDENCE_JSONL_INVALID_LINES', { name: selected, lines: invalidLines });
  return { present: true, name: selected, records, invalidLines };
}

function intervalCoverage(intervals, start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { coveredMs: 0, coverageRatio: null, maxInternalGapMs: null, intervals: 0, boundaryStartCovered: false, boundaryEndCovered: false };
  }
  const clipped = intervals
    .map((item) => ({ start: Math.max(start, item.start), end: Math.min(end, item.end) }))
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end >= item.start)
    .sort((left, right) => left.start - right.start);
  if (!clipped.length) {
    return { coveredMs: 0, coverageRatio: 0, maxInternalGapMs: end - start, intervals: 0, boundaryStartCovered: false, boundaryEndCovered: false };
  }
  const merged = [];
  for (const current of clipped) {
    const prior = merged.at(-1);
    if (!prior || current.start > prior.end) merged.push({ ...current });
    else prior.end = Math.max(prior.end, current.end);
  }
  const coveredMs = merged.reduce((sum, item) => sum + Math.max(0, item.end - item.start), 0);
  const gaps = [];
  for (let index = 1; index < merged.length; index += 1) gaps.push(Math.max(0, merged[index].start - merged[index - 1].end));
  return {
    coveredMs: round(coveredMs),
    coverageRatio: round(coveredMs / (end - start), 6),
    maxInternalGapMs: gaps.length ? round(Math.max(...gaps)) : 0,
    intervals: clipped.length,
    mergedIntervals: merged.length,
    boundaryStartCovered: clipped.some((item) => item.start <= start && item.end >= start),
    boundaryEndCovered: clipped.some((item) => item.start <= end && item.end >= end),
  };
}

const clientEvidence = await loadJson('client-timeline.json');
const clientEventsEvidence = await loadJsonLines(['client-events.jsonl'], 'client event journal');
const serverEvidence = await loadJsonLines(['server-correlated-telemetry.jsonl', 'server-telemetry.jsonl'], 'server telemetry');
const hostEvidence = await loadJsonLines(['host-telemetry.jsonl'], 'host telemetry');
const processEvidence = await loadJsonLines(['process-telemetry.jsonl'], 'process telemetry');
const authorizationEvidence = await loadJson('authorization.json');
const custodyEvidence = await loadJson('custody.json');
const knownProtectedBackgroundEvidence = await loadJson('known-protected-background.json');
const preflightInventoryEvidence = await loadJson('process-inventory-before.json');
const readinessEvidence = await loadJson('readiness.json');
const runnerErrorEvidence = await loadJson('runner-error.json', false);
const hostSessionEvidence = await loadFirstJson(['host-sampler-session.json', 'sampler-session.json'], 'host sampler session', false);
const hostLifecycleEvidence = await loadJson('host-sampler-lifecycle.json');
const processLifecycleEvidence = await loadJson('process-sampler-lifecycle.json');
const overheadEvidence = await loadJson('observer-overhead.json');
const shutdownEvidence = await loadJson('shutdown.json');
const managedRootsEvidence = await loadJson('managed-process-roots.json');
const beforeWindowInventoryEvidence = await loadJson('managed-process-tree-before-window.json');
const preShutdownInventoryEvidence = await loadJson('managed-process-tree-before-shutdown.json');
const samplerBoundaryEvidence = await loadJson('client-boundary.json', false);
const samplerReleaseEvidence = await loadJson('sampler-release.json', false);
const hostBoundaryReadyEvidence = await loadJson('host-boundary-ready.json', false);
const processBoundaryReadyEvidence = await loadJson('process-boundary-ready.json', false);
const closureIntentEvidence = await loadJson('closure-intent.json', false);
const externalFinalizerIdentityEvidence = await loadJson('external-finalizer-identity.json', false);
const externalFinalizerRunnerExitEvidence = await loadJson('external-finalizer-runner-exit.json', false);
const externalFinalizerLifecycleEvidence = await loadJson('external-finalizer-lifecycle.json', false);
const externalFinalizerVerdictEvidence = await loadJson('external-finalizer-verdict.json', false);
const finalInventoryEvidence = await loadFirstJson(
  ['process-inventory-after.json', 'final-process-inventory.json', 'post-process-inventory.json'],
  'final process inventory',
  true,
);

const client = clientEvidence.document ?? {};
const custody = custodyEvidence.document ?? {};
const authorization = authorizationEvidence.document ?? {};
const preflightInventory = preflightInventoryEvidence.document ?? {};
const knownProtectedBackground = knownProtectedBackgroundEvidence.document ?? {};
const windowStart = epoch(pick(client, ['window.actualStartedEpochMs', 'window.actualStartedAt', 'window.startedAt']));
const windowEnd = epoch(pick(client, ['window.completedAt', 'window.deadlineAt']));
const observedDurationMs = finite(pick(client, ['window.observedDurationMs']));
const requestedDurationMs = finite(pick(client, ['window.requestedDurationMs']))
  ?? finite(pick(custody, ['window.requestedDurationMs', 'window.durationSeconds'])) * 1000;
const runId = String(client.runId ?? custody.runId ?? '');
const requests = Array.isArray(client.requests) ? client.requests : [];
const requestSequences = requests.map((request) => finite(request.sequence));
const requestSequenceIntegrity = {
  count: requestSequences.length,
  allNumeric: requestSequences.every(Number.isFinite),
  unique: new Set(requestSequences).size === requestSequences.length,
  contiguousFromOne: requestSequences.every((sequence, index) => sequence === index + 1),
};
const clientEventRequests = clientEventsEvidence.records.filter((record) => record.type === 'client.request').map((record) => record.request);
const clientEventScheduling = clientEventsEvidence.records.filter((record) => record.type === 'client.scheduling').map((record) => record.sample);
const clientEventReady = clientEventsEvidence.records.filter((record) => record.type === 'client.ready');
const clientEventWindowStart = clientEventsEvidence.records.filter((record) => record.type === 'window.start');
const clientEventWindowComplete = clientEventsEvidence.records.filter((record) => record.type === 'window.complete');
const finalSchedulingSamples = Array.isArray(pick(client, ['clientRuntime.scheduling.rawSamples']))
  ? pick(client, ['clientRuntime.scheduling.rawSamples'])
  : [];
const clientEventIntegrity = {
  journalPresent: clientEventsEvidence.present,
  invalidLines: clientEventsEvidence.invalidLines.length,
  requestSequence: requestSequenceIntegrity,
  requestRecords: clientEventRequests.length,
  finalRequestRecords: requests.length,
  requestOrderAndIdentityMatch: clientEventRequests.length === requests.length
    && clientEventRequests.every((eventRequest, index) => eventRequest?.sequence === requests[index]?.sequence
      && eventRequest?.traceId === requests[index]?.traceId
      && eventRequest?.requestId === requests[index]?.requestId),
  schedulingRecords: clientEventScheduling.length,
  finalSchedulingRecords: finalSchedulingSamples.length,
  schedulingOrderMatch: clientEventScheduling.length === finalSchedulingSamples.length
    && clientEventScheduling.every((sample, index) => sample?.sequence === finalSchedulingSamples[index]?.sequence
      && sample?.sampledAt === finalSchedulingSamples[index]?.sampledAt),
  readyRecords: clientEventReady.length,
  windowStartRecords: clientEventWindowStart.length,
  windowCompleteRecords: clientEventWindowComplete.length,
};

if (client.contract !== 'agm-instrumentation-lifecycle-client-timeline.v1') addIssue('CLIENT_CONTRACT_UNEXPECTED', client.contract ?? null);
if (client.status !== 'EVIDENCE_CAPTURED_OWNER_REVIEW') addIssue('CLIENT_CAPTURE_STATUS_INVALID', client.status ?? null);
if (!Array.isArray(client.errors) || client.errors.length !== 0) addIssue('CLIENT_LIFECYCLE_ERRORS_PRESENT', client.errors ?? null);
const clientInvariants = client.invariants && typeof client.invariants === 'object' ? client.invariants : {};
if (!Object.keys(clientInvariants).length || Object.values(clientInvariants).some((value) => value !== true)) {
  addIssue('CLIENT_REPORTED_INVARIANT_FAILED', clientInvariants);
}
if (!runId) addIssue('RUN_ID_MISSING');
if (client.runId && custody.runId && client.runId !== custody.runId) addIssue('CLIENT_CUSTODY_RUN_ID_MISMATCH');
if (runnerErrorEvidence.present) addIssue('RUNNER_ERROR_EVIDENCE_PRESENT', runnerErrorEvidence.document?.message ?? null);
if (custody.runnerCompleted !== true) addIssue('RUNNER_COMPLETION_NOT_PROVEN');
if (custody.finalGate !== OWNER_REVIEW_STATUS) addIssue('CUSTODY_FINAL_GATE_INVALID', custody.finalGate ?? null);
if (authorization.ownerGate !== OWNER_REVIEW_STATUS || authorization.p9 !== 'STOPPED'
  || authorization.durationSeconds !== 150 || authorization.officialBasicSloMs !== OFFICIAL_BASIC_SLO_MS
  || authorization.officialBasicSloUnchanged !== true || authorization.officialSoakRestarted !== false
  || authorization.faultInjection !== false || authorization.deploy !== false
  || authorization.postgresqlRestart !== false || authorization.infrastructureChanges !== false) {
  addIssue('OWNER_AUTHORIZATION_CUSTODY_INVALID');
}
const completeCoverageStatuses = new Set([
  'COMPLETE_FOR_CANDIDATE_IMAGES',
  'COMPLETE_WITH_IDENTITY_BOUND_KNOWN_PROTECTED_BACKGROUND',
]);
if (knownProtectedBackground.contract !== 'agm-instrumentation-known-protected-background.v1'
  || knownProtectedBackground.scope !== 'PRE_EXISTING_BACKGROUND / NON_P9 / NON_OBSERVER'
  || knownProtectedBackground.source?.scheduledTask?.expectedActionMatched !== true
  || knownProtectedBackground.source?.supervisorSource?.p9OrInstrumentationInvocationFound !== false
  || knownProtectedBackground.rawCommandLinesRecorded !== false
  || knownProtectedBackground.secretsRecorded !== false) {
  addIssue('KNOWN_PROTECTED_BACKGROUND_EVIDENCE_INVALID');
}
if (preflightInventoryEvidence.name !== 'process-inventory-before.json'
  || preflightInventory.contract !== 'agm-instrumentation-lifecycle-process-inventory.v2'
  || preflightInventory.identityContract !== 'agm-instrumentation-sanitized-process-identity.v2'
  || preflightInventory.runId !== runId
  || preflightInventory.capturePhase !== 'PREFLIGHT'
  || preflightInventory.trafficGenerated !== false
  || finite(preflightInventory.processChanges) !== 0
  || finite(preflightInventory.queryAttempts) === null
  || finite(preflightInventory.queryAttempts) < 1
  || preflightInventory.queryStatus !== 'SUCCESS'
  || !completeCoverageStatuses.has(preflightInventory.coverageStatus)
  || finite(preflightInventory.knownProtectedBackground?.unclassifiedUnavailableCount) !== 0
  || finite(preflightInventory.matchCounts?.p9) !== 0
  || finite(preflightInventory.matchCounts?.observer) !== 0) {
  addIssue('PREFLIGHT_PROCESS_INVENTORY_INVALID');
}
if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd < windowStart) addIssue('FORMAL_WINDOW_BOUNDARY_INVALID');
if (requestedDurationMs !== REQUIRED_WINDOW_MS) addIssue('REQUESTED_WINDOW_NOT_150_SECONDS', requestedDurationMs);
if (observedDurationMs === null || observedDurationMs < REQUIRED_WINDOW_MS) addIssue('OBSERVED_WINDOW_SHORTER_THAN_150_SECONDS', observedDurationMs);
if (pick(client, ['readiness.signalMode']) !== 'JSON_START_SIGNAL') addIssue('JSON_START_SIGNAL_NOT_PROVEN');
if (finite(pick(client, ['readiness.signalDurationSeconds'])) !== 150) addIssue('START_SIGNAL_DURATION_NOT_150_SECONDS');
const readyAt = epoch(pick(client, ['readiness.readyAt']));
const scheduledStartAt = epoch(pick(client, ['readiness.scheduledStartAt']));
if (readyAt === null || scheduledStartAt === null || readyAt > scheduledStartAt) addIssue('READY_BEFORE_SCHEDULED_START_NOT_PROVEN');
const startLatenessMs = finite(pick(client, ['window.startLatenessMs']));
if (startLatenessMs === null) addIssue('START_SCHEDULING_LATENESS_NOT_MEASURED');
else if (startLatenessMs > 500) addIssue('FORMAL_START_SCHEDULING_LATE', startLatenessMs);
if (finite(pick(client, ['configuration.officialBasicSloMs'])) !== OFFICIAL_BASIC_SLO_MS) addIssue('CLIENT_OFFICIAL_SLO_CHANGED');
if (pick(client, ['configuration.officialBasicSloUnchanged']) !== true) addIssue('CLIENT_OFFICIAL_SLO_CUSTODY_MISSING');
if (!requests.length) addIssue('CLIENT_REQUESTS_EMPTY');
if (!requestSequenceIntegrity.allNumeric || !requestSequenceIntegrity.unique || !requestSequenceIntegrity.contiguousFromOne) {
  addIssue('CLIENT_REQUEST_SEQUENCE_INTEGRITY_FAILED', requestSequenceIntegrity);
}
if (!clientEventIntegrity.requestOrderAndIdentityMatch) addIssue('CLIENT_REQUEST_JOURNAL_FINAL_MISMATCH');
if (!clientEventIntegrity.schedulingOrderMatch) addIssue('CLIENT_SCHEDULING_JOURNAL_FINAL_MISMATCH');
if (clientEventIntegrity.readyRecords !== 1 || clientEventIntegrity.windowStartRecords !== 1 || clientEventIntegrity.windowCompleteRecords !== 1) {
  addIssue('CLIENT_LIFECYCLE_EVENT_COUNT_INVALID', {
    ready: clientEventIntegrity.readyRecords,
    windowStart: clientEventIntegrity.windowStartRecords,
    windowComplete: clientEventIntegrity.windowCompleteRecords,
  });
}

const clientConstraintChecks = {
  p9Stopped: pick(client, ['custody.p9']) === 'STOPPED',
  noP9Activation: pick(client, ['custody.p9ActivationPerformed']) === false,
  noP9Traffic: pick(client, ['custody.p9TrafficGenerated']) === false,
  soakNotRestarted: pick(client, ['custody.officialSoakRestarted']) === false,
  noFaultInjection: pick(client, ['custody.faultInjection']) === false && requests.every((request) => finite(request.faultHeaders) === 0),
  noRetries: requests.every((request) => finite(request.retries) === 0),
  officialTimeoutUnchanged: requests.every((request) => finite(request.timeoutMs) === OFFICIAL_BASIC_SLO_MS),
  invalidLoginIdentityRandomizedAndNotRecorded: pick(client, ['custody.invalidLoginIdentityRandomizedPerRun']) === true
    && pick(client, ['custody.invalidLoginIdentityRecordedInEvidence']) === false,
  clientTransportDispatchCaptured: requests.every((request) => epoch(request.clientTransport?.timestamps?.requestCreateAt) !== null
    && epoch(request.clientTransport?.timestamps?.bodySentAt) !== null
    && request.clientTransport?.headerCorrelation?.traceIdMatched === true
    && request.clientTransport?.headerCorrelation?.requestIdMatched === true
    && request.clientTransport?.headerCorrelation?.sameRequestAndTraceId === true),
  clientTransportReceiveOrErrorCaptured: requests.every((request) => request.error === null
    ? epoch(request.clientTransport?.timestamps?.responseHeadersAt) !== null
    : epoch(request.clientTransport?.timestamps?.errorAt) !== null || request.timedOut === true),
  everyRequestHasUniqueIdentity: requests.every((request) => request.traceId && request.requestId === request.traceId)
    && new Set(requests.map((request) => request.traceId)).size === requests.length,
};
for (const [name, satisfied] of Object.entries(clientConstraintChecks)) {
  if (!satisfied) addIssue('CLIENT_CONSTRAINT_NOT_SATISFIED', name);
}

const schedulingSamples = pick(client, ['clientRuntime.scheduling.rawSamples']);
const scheduling = Array.isArray(schedulingSamples) ? schedulingSamples : [];
const schedulingIntervalMs = finite(pick(client, ['clientRuntime.scheduling.intervalMs'])) ?? 100;
const schedulingEpochs = scheduling.map((sample) => epoch(sample.sampledAt)).filter(Number.isFinite).sort((left, right) => left - right);
const schedulingGaps = schedulingEpochs.slice(1).map((value, index) => value - schedulingEpochs[index]);
const expectedSchedulingSamples = observedDurationMs === null ? null : Math.floor(observedDurationMs / schedulingIntervalMs);
const schedulingIntervals = scheduling.map((sample) => ({
  start: epoch(sample.windowStartedAt),
  end: epoch(sample.sampledAt),
})).filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end));
const schedulingTemporalCoverage = intervalCoverage(schedulingIntervals, windowStart, windowEnd);
const schedulingHeadExcludedMs = schedulingIntervals.length && Number.isFinite(windowStart)
  ? Math.max(0, schedulingIntervals[0].start - windowStart)
  : null;
const schedulingTailExcludedMs = schedulingIntervals.length && Number.isFinite(windowEnd)
  ? Math.max(0, windowEnd - schedulingIntervals.at(-1).end)
  : null;
const schedulingClockDomainExcludedMs = observedDurationMs === null || !Number.isFinite(windowStart) || !Number.isFinite(windowEnd)
  ? null
  : Math.max(0, observedDurationMs - (windowEnd - windowStart));
const schedulingAccountedMs = schedulingHeadExcludedMs === null || schedulingTailExcludedMs === null || schedulingClockDomainExcludedMs === null
  ? null
  : schedulingTemporalCoverage.coveredMs + schedulingHeadExcludedMs + schedulingTailExcludedMs + schedulingClockDomainExcludedMs;
const schedulingAccountedRatio = schedulingAccountedMs === null || observedDurationMs === null || observedDurationMs <= 0
  ? null
  : round(Math.min(1, schedulingAccountedMs / observedDurationMs), 6);
const schedulingCoverage = {
  contract: pick(client, ['clientRuntime.scheduling.contract']),
  coverageBasis: pick(client, ['clientRuntime.scheduling.coverageBasis']),
  allowedExclusions: pick(client, ['clientRuntime.scheduling.allowedExclusions']),
  intervalMs: schedulingIntervalMs,
  samples: scheduling.length,
  expectedSamples: expectedSchedulingSamples,
  rawSampleRatio: expectedSchedulingSamples ? round(scheduling.length / expectedSchedulingSamples, 6) : null,
  coalescedTimerSlots: expectedSchedulingSamples === null ? null : Math.max(0, expectedSchedulingSamples - scheduling.length),
  temporalCoveredMs: schedulingTemporalCoverage.coveredMs,
  temporalCoverageRatio: schedulingTemporalCoverage.coverageRatio,
  maxInternalGapMs: schedulingTemporalCoverage.maxInternalGapMs,
  boundaryHeadExcludedMs: round(schedulingHeadExcludedMs),
  boundaryTailExcludedMs: round(schedulingTailExcludedMs),
  clockDomainRoundingExcludedMs: round(schedulingClockDomainExcludedMs),
  accountedCoverageMs: round(schedulingAccountedMs),
  accountedCoverageRatio: schedulingAccountedRatio,
  firstAt: scheduling[0]?.sampledAt ?? null,
  lastAt: scheduling.at(-1)?.sampledAt ?? null,
  maxObservedGapMs: schedulingGaps.length ? round(Math.max(...schedulingGaps)) : null,
  driftP50Ms: percentile(scheduling.map((sample) => finite(sample.driftMs)).filter(Number.isFinite), 0.5),
  driftP95Ms: percentile(scheduling.map((sample) => finite(sample.driftMs)).filter(Number.isFinite), 0.95),
  driftP99Ms: percentile(scheduling.map((sample) => finite(sample.driftMs)).filter(Number.isFinite), 0.99),
  driftMaxMs: percentile(scheduling.map((sample) => finite(sample.driftMs)).filter(Number.isFinite), 1),
};
if (!scheduling.length) addIssue('CLIENT_SCHEDULING_RAW_SAMPLES_MISSING');
const declaredSchedulingCoverage = pick(client, ['clientRuntime.scheduling']);
const allowedSchedulingExclusions = ['BOUNDARY_HEAD_BEFORE_FIRST_INTERVAL', 'BOUNDARY_TAIL_AFTER_LAST_COMPLETE_INTERVAL', 'CLOCK_DOMAIN_ROUNDING_SKEW'];
if (schedulingCoverage.contract !== 'agm-client-scheduling-temporal-coverage.v1'
  || schedulingCoverage.coverageBasis !== 'CONTIGUOUS_OBSERVED_INTERVALS_PLUS_EXPLICIT_BOUNDARY_EXCLUSIONS'
  || JSON.stringify(schedulingCoverage.allowedExclusions) !== JSON.stringify(allowedSchedulingExclusions)) {
  addIssue('CLIENT_SCHEDULING_COVERAGE_CONTRACT_INVALID');
}
if (schedulingCoverage.maxInternalGapMs !== 0) {
  addIssue('CLIENT_SCHEDULING_INTERNAL_GAP', schedulingCoverage.maxInternalGapMs);
}
if (schedulingCoverage.accountedCoverageRatio !== 1) {
  addIssue('CLIENT_SCHEDULING_WINDOW_COVERAGE_INCOMPLETE', schedulingCoverage);
}
for (const [field, derived] of Object.entries({
  expectedSamples: schedulingCoverage.expectedSamples,
  rawSampleRatio: schedulingCoverage.rawSampleRatio,
  coalescedTimerSlots: schedulingCoverage.coalescedTimerSlots,
  observedCoveredMs: schedulingCoverage.temporalCoveredMs,
  boundaryHeadExcludedMs: schedulingCoverage.boundaryHeadExcludedMs,
  boundaryTailExcludedMs: schedulingCoverage.boundaryTailExcludedMs,
  clockDomainRoundingExcludedMs: schedulingCoverage.clockDomainRoundingExcludedMs,
  accountedCoverageMs: schedulingCoverage.accountedCoverageMs,
  accountedCoverageRatio: schedulingCoverage.accountedCoverageRatio,
})) {
  const declared = finite(declaredSchedulingCoverage?.[field]);
  const tolerance = field.endsWith('Ratio') ? 0.000001 : field.endsWith('Slots') || field === 'expectedSamples' ? 0 : 1;
  if (declared === null || derived === null || Math.abs(declared - derived) > tolerance) {
    addIssue('CLIENT_SCHEDULING_DECLARED_DERIVATION_MISMATCH', { field, declared, derived });
  }
}

const serverRecords = serverEvidence.records;
const instrumentationStatuses = serverRecords.filter((record) => record.type === 'instrumentation.status');
const instrumentationFlushes = serverRecords.filter((record) => record.type === 'instrumentation.flush');
if (instrumentationStatuses.length !== 1) addIssue('SERVER_INSTRUMENTATION_STATUS_COUNT', instrumentationStatuses.length);
if (instrumentationStatuses[0]?.contract !== 'agm-server-correlated-instrumentation.v1') {
  addIssue('SERVER_INSTRUMENTATION_CONTRACT_UNEXPECTED', instrumentationStatuses[0]?.contract ?? null);
}
if (instrumentationStatuses[0]?.prismaPatched !== true) addIssue('SERVER_PRISMA_HOOK_NOT_READY');
if (instrumentationStatuses[0]?.asyncContext !== true) addIssue('SERVER_ASYNC_CONTEXT_NOT_READY');
if (instrumentationStatuses[0]?.responseHeaderHook !== true) addIssue('SERVER_RESPONSE_HEADER_HOOK_NOT_READY');
if (finite(instrumentationStatuses[0]?.officialBasicSloMs) !== OFFICIAL_BASIC_SLO_MS) addIssue('SERVER_OFFICIAL_SLO_CHANGED');
if (instrumentationStatuses[0]?.functionalBasicChange !== false
  || instrumentationStatuses[0]?.production !== false
  || instrumentationStatuses[0]?.nodeEnv !== 'test'
  || instrumentationStatuses[0]?.apiHost !== '127.0.0.1'
  || finite(instrumentationStatuses[0]?.port) !== finite(custody.diagnosticApi?.port)) {
  addIssue('SERVER_DIAGNOSTIC_CUSTODY_INVALID', instrumentationStatuses[0] ?? null);
}
if (instrumentationFlushes.length !== 1 || instrumentationFlushes[0]?.graceful !== true) addIssue('SERVER_GRACEFUL_FLUSH_NOT_PROVEN');
if (finite(instrumentationFlushes[0]?.activeRequests) !== 0) addIssue('SERVER_ACTIVE_REQUESTS_AT_FLUSH');

const uniqueServerRunIds = [...new Set(serverRecords.map((record) => record.runId).filter(Boolean))];
if (uniqueServerRunIds.length !== 1 || uniqueServerRunIds[0] !== runId) addIssue('SERVER_RUN_BINDING_INVALID', uniqueServerRunIds);
const serverPids = [...new Set(serverRecords.map((record) => finite(record.pid)).filter(Number.isFinite))];
if (serverPids.length !== 1) addIssue('SERVER_PID_NOT_UNIQUE', serverPids);

function exactlyOne(records, predicate, label, traceId, localIssues) {
  const matches = records.filter(predicate);
  if (matches.length !== 1) localIssues.push({ code: `${label}_COUNT`, count: matches.length });
  return matches[0] ?? null;
}

function normalizedEndpointPath(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const pathname = new URL(value, 'http://localhost').pathname.replace(/\/+$/, '');
    return pathname || '/';
  } catch {
    return null;
  }
}

function endpointsEquivalent(clientEndpoint, serverEndpoint) {
  const clientPath = normalizedEndpointPath(clientEndpoint);
  const serverPath = normalizedEndpointPath(serverEndpoint);
  if (!clientPath || !serverPath) return false;
  return serverPath === clientPath || serverPath.endsWith(clientPath);
}

const runtimeSamples = serverRecords.filter((record) => record.type === 'runtime.sample');
const correlations = [];
for (const request of requests) {
  const traceId = request.traceId;
  const localIssues = [];
  const direct = serverRecords.filter((record) => record.traceId === traceId);
  const receive = exactlyOne(direct, (record) => record.type === 'request.receive', 'REQUEST_RECEIVE', traceId, localIssues);
  const summary = exactlyOne(direct, (record) => record.type === 'request.summary', 'REQUEST_SUMMARY', traceId, localIssues);
  const association = exactlyOne(direct, (record) => record.type === 'request.runtime-association', 'RUNTIME_ASSOCIATION', traceId, localIssues);
  const responseHeaders = exactlyOne(direct, (record) => record.type === 'response.headers', 'SERVER_RESPONSE_HEADERS', traceId, localIssues);
  const response = exactlyOne(direct, (record) => record.type === 'response.finish' || record.type === 'response.close', 'SERVER_RESPONSE', traceId, localIssues);
  const clientStart = epoch(pick(request, ['timestamps.clientStartedAt']));
  const clientComplete = epoch(pick(request, ['timestamps.clientCompletedAt']));
  const transportCreate = epoch(pick(request, ['clientTransport.timestamps.requestCreateAt']));
  const bodySent = epoch(pick(request, ['clientTransport.timestamps.bodySentAt']));
  const transportHeaders = epoch(pick(request, ['clientTransport.timestamps.responseHeadersAt', 'timestamps.clientHeadersAt']));
  const serverReceive = epoch(pick(receive ?? {}, ['receivedAt', 'at']));
  const serverHeaders = epoch(pick(responseHeaders ?? {}, ['headersAt', 'at']));
  const serverResponse = epoch(pick(response ?? summary ?? {}, ['completedAt', 'serverResponseAt', 'at']));
  const requestRuntimeSamples = runtimeSamples.filter((record) => Array.isArray(record.traceIds) && record.traceIds.includes(traceId));

  if (request.requestId !== traceId) localIssues.push({ code: 'CLIENT_IDENTITY_MISMATCH' });
  for (const record of [receive, summary, association, responseHeaders, response].filter(Boolean)) {
    if (record.requestId !== traceId || record.traceId !== traceId) localIssues.push({ code: 'SERVER_IDENTITY_MISMATCH', type: record.type });
  }
  if (receive && !endpointsEquivalent(request.endpoint, receive.endpoint)) {
    localIssues.push({ code: 'ENDPOINT_MISMATCH', clientEndpoint: request.endpoint, serverEndpoint: receive.endpoint });
  }
  if (request.identityCorrelated === false) localIssues.push({ code: 'ECHOED_IDENTITY_MISMATCH' });
  if (summary && request.error === null && request.timedOut !== true
    && (finite(summary.status) !== finite(request.status) || summary.outcome !== 'finish')) {
    localIssues.push({ code: 'SERVER_CLIENT_STATUS_OR_OUTCOME_MISMATCH', clientStatus: request.status, serverStatus: summary.status, outcome: summary.outcome });
  }
  if (responseHeaders && request.error === null && request.timedOut !== true
    && finite(responseHeaders.status) !== finite(request.status)) {
    localIssues.push({ code: 'SERVER_CLIENT_HEADER_STATUS_MISMATCH', clientStatus: request.status, serverStatus: responseHeaders.status });
  }
  if (transportCreate === null || bodySent === null) localIssues.push({ code: 'CLIENT_TRANSPORT_DISPATCH_TIMESTAMPS_MISSING' });
  if (request.error === null && transportHeaders === null) localIssues.push({ code: 'CLIENT_TRANSPORT_RESPONSE_HEADERS_MISSING' });
  if (request.clientTransport?.headerCorrelation?.traceIdMatched !== true
    || request.clientTransport?.headerCorrelation?.requestIdMatched !== true
    || request.clientTransport?.headerCorrelation?.sameRequestAndTraceId !== true) {
    localIssues.push({ code: 'CLIENT_TRANSPORT_HEADER_IDENTITY_MISMATCH' });
  }
  if (!requestRuntimeSamples.length) localIssues.push({ code: 'REQUEST_RUNTIME_WINDOW_MISSING' });

  const phasesMs = {
    clientStartToRequestCreate: finite(pick(request, ['clientTransport.durationsMs.clientStartToRequestCreate'])),
    requestCreateToBodySent: finite(pick(request, ['clientTransport.durationsMs.requestCreateToBodySent'])),
    requestCreateToServerReceive: transportCreate !== null && serverReceive !== null ? round(serverReceive - transportCreate) : null,
    bodySentToServerReceive: bodySent !== null && serverReceive !== null ? round(serverReceive - bodySent) : null,
    serverReceiveToResponse: finite(summary?.serverDurationMs)
      ?? (serverReceive !== null && serverResponse !== null ? round(serverResponse - serverReceive) : null),
    serverHeadersToClientHeaders: serverHeaders !== null && transportHeaders !== null ? round(transportHeaders - serverHeaders) : null,
    serverFinishToClientComplete: serverResponse !== null && clientComplete !== null ? round(clientComplete - serverResponse) : null,
    clientHeadersToComplete: transportHeaders !== null && clientComplete !== null ? round(clientComplete - transportHeaders) : null,
    clientTotal: finite(request.durationMs),
  };
  const causallyOrderedCrossProcessPhases = new Set([
    'clientStartToRequestCreate',
    'requestCreateToBodySent',
    'requestCreateToServerReceive',
    'serverReceiveToResponse',
    'serverHeadersToClientHeaders',
    'serverFinishToClientComplete',
    'clientHeadersToComplete',
    'clientTotal',
  ]);
  for (const [phase, duration] of Object.entries(phasesMs)) {
    if (!causallyOrderedCrossProcessPhases.has(phase)) continue;
    if (duration !== null && duration < -5) localIssues.push({ code: 'NEGATIVE_CROSS_PROCESS_PHASE', phase, durationMs: duration });
  }

  correlations.push({
    sequence: request.sequence,
    traceId,
    requestId: request.requestId,
    endpoint: request.endpoint,
    durationMs: finite(request.durationMs),
    timedOut: request.timedOut === true,
    serverRecords: {
      receive: receive?.at ?? receive?.receivedAt ?? null,
      summary: summary?.at ?? null,
      responseHeaders: responseHeaders?.headersAt ?? responseHeaders?.at ?? null,
      response: response?.at ?? response?.completedAt ?? null,
      runtimeAssociation: association?.at ?? null,
      runtimeSamples: requestRuntimeSamples.length,
    },
    phasesMs,
    serverAttribution: summary ? {
      prismaPathMs: finite(summary.phases?.prismaPathMs),
      outboundNetworkMs: finite(summary.phases?.outboundNetworkMs),
      ioMs: finite(summary.phases?.ioMs),
      runtimeBusyMs: finite(summary.phases?.runtimeBusyMs),
      residualServerMs: finite(summary.phases?.residualServerMs),
      phasesMayOverlap: summary.phases?.sumMayOverlap === true,
      additiveAttributionPermitted: false,
      eventLoopLagMaxMs: finite(association?.eventLoopLagMaxMs ?? summary.runtime?.eventLoopLagMaxMs),
      gcPauseTotalMs: finite(association?.gcPauseTotalMs ?? summary.runtime?.gcPauseTotalMs),
      gcPauseMaxMs: finite(association?.gcPauseMaxMs ?? summary.runtime?.gcPauseMaxMs),
    } : null,
    correlated: localIssues.length === 0,
    issues: localIssues,
  });
}

const correlationFailures = correlations.filter((record) => !record.correlated);
if (correlationFailures.length) addIssue('REQUEST_CORRELATION_INCOMPLETE', correlationFailures.length);

const runtimeIntervals = runtimeSamples.map((record) => ({
  start: epoch(record.windowStartedAt) ?? epoch(record.at),
  end: epoch(record.windowCompletedAt) ?? epoch(record.at),
})).filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end));
const runtimeCoverage = intervalCoverage(runtimeIntervals, windowStart, windowEnd);
runtimeCoverage.samples = runtimeSamples.length;
runtimeCoverage.expectedIntervalMs = 100;
const windowRuntimeSamples = runtimeSamples.filter((record) => {
  const started = epoch(record.windowStartedAt) ?? epoch(record.at);
  const completed = epoch(record.windowCompletedAt) ?? epoch(record.at);
  return Number.isFinite(started) && Number.isFinite(completed) && started <= windowEnd && completed >= windowStart;
});
const firstRuntimeSample = windowRuntimeSamples[0] ?? null;
const lastRuntimeSample = windowRuntimeSamples.at(-1) ?? null;
const serverRuntimeSummary = {
  samples: windowRuntimeSamples.length,
  eventLoopLagP50Ms: percentile(windowRuntimeSamples.map((record) => finite(record.eventLoopLagMs)).filter(Number.isFinite), 0.5),
  eventLoopLagP95Ms: percentile(windowRuntimeSamples.map((record) => finite(record.eventLoopLagMs)).filter(Number.isFinite), 0.95),
  eventLoopLagP99Ms: percentile(windowRuntimeSamples.map((record) => finite(record.eventLoopLagMs)).filter(Number.isFinite), 0.99),
  eventLoopLagMaxMs: percentile(windowRuntimeSamples.map((record) => finite(record.eventLoopLagMs)).filter(Number.isFinite), 1),
  intervalDriftMaxMs: percentile(windowRuntimeSamples.map((record) => finite(record.intervalDriftMs)).filter(Number.isFinite), 1),
  rssMaxBytes: percentile(windowRuntimeSamples.map((record) => finite(record.memory?.rss)).filter(Number.isFinite), 1),
  heapUsedMaxBytes: percentile(windowRuntimeSamples.map((record) => finite(record.memory?.heapUsed)).filter(Number.isFinite), 1),
  cpuUserMicrosDelta: firstRuntimeSample && lastRuntimeSample
    ? numericDelta(lastRuntimeSample.cpu?.user, firstRuntimeSample.cpu?.user)
    : null,
  cpuSystemMicrosDelta: firstRuntimeSample && lastRuntimeSample
    ? numericDelta(lastRuntimeSample.cpu?.system, firstRuntimeSample.cpu?.system)
    : null,
  fsReadDelta: firstRuntimeSample && lastRuntimeSample
    ? numericDelta(lastRuntimeSample.io?.fsRead, firstRuntimeSample.io?.fsRead)
    : null,
  fsWriteDelta: firstRuntimeSample && lastRuntimeSample
    ? numericDelta(lastRuntimeSample.io?.fsWrite, firstRuntimeSample.io?.fsWrite)
    : null,
  gcPauses: serverRecords.filter((record) => record.type === 'gc.pause'
    && epoch(record.startedAt) <= windowEnd && epoch(record.completedAt) >= windowStart).length,
  gcPauseTotalMs: round(serverRecords.filter((record) => record.type === 'gc.pause'
    && epoch(record.startedAt) <= windowEnd && epoch(record.completedAt) >= windowStart)
    .reduce((sum, record) => sum + (finite(record.durationMs) ?? 0), 0)),
};
if (runtimeCoverage.coverageRatio !== null && runtimeCoverage.coverageRatio < 0.98) addIssue('SERVER_RUNTIME_WINDOW_COVERAGE_LOW', runtimeCoverage.coverageRatio);
if (runtimeCoverage.maxInternalGapMs !== null && runtimeCoverage.maxInternalGapMs > 500) addIssue('SERVER_RUNTIME_WINDOW_GAP', runtimeCoverage.maxInternalGapMs);

const hostSession = hostSessionEvidence.document ?? {};
const hostLifecycle = hostLifecycleEvidence.document ?? {};
const hostSampleIntervalSeconds = finite(pick(hostSession, ['sampleIntervalSeconds']))
  ?? finite(pick(hostLifecycle, ['sampleIntervalSeconds']))
  ?? finite(pick(hostEvidence.records[0] ?? {}, ['sampleIntervalSeconds', 'intervalSeconds']))
  ?? 5;
const hostIntervalMs = hostSampleIntervalSeconds * 1000;
const hostBoundarySchema = hostLifecycle.cadenceModel === 'ABSOLUTE_MONOTONIC_NO_CATCH_UP_BURST'
  || hostEvidence.records.some((record) => record.sampleKind === 'BOUNDARY_FINAL' || epoch(record.scheduledAt) !== null);
const hostPeriodicRecords = hostBoundarySchema
  ? hostEvidence.records.filter((record) => record.sampleKind === 'PERIODIC')
  : hostEvidence.records;
const hostBoundaryFinalRecords = hostBoundarySchema
  ? hostEvidence.records.filter((record) => record.sampleKind === 'BOUNDARY_FINAL')
  : [];
const sortedHost = hostPeriodicRecords.map((record) => ({
  record,
  scheduled: epoch(record.scheduledAt),
  captureStarted: epoch(record.captureStartedAt),
  end: epoch(pick(record, ['captureStartedAt', 'windowCompletedAt', 'captureAt', 'at'])),
  explicitStart: epoch(pick(record, ['scheduledAt', 'windowStartedAt'])),
})).filter((item) => Number.isFinite(item.end)).sort((left, right) => left.end - right.end);
const hostIntervals = sortedHost.map((item) => ({
  start: item.explicitStart ?? item.end - hostIntervalMs,
  end: hostBoundarySchema && item.explicitStart !== null ? item.explicitStart + hostIntervalMs : item.end,
  record: item.record,
}));
const hostCaptureGapsMs = sortedHost.slice(1).map((item, index) => item.end - sortedHost[index].end);
const hostScheduledGapsMs = sortedHost.slice(1).map((item, index) => item.scheduled - sortedHost[index].scheduled);
const hostCadenceViolations = hostBoundarySchema ? sortedHost.slice(1).flatMap((item, index) => {
  const prior = sortedHost[index];
  const missedSlots = finite(item.record.missedSlots);
  const expectedGap = hostIntervalMs * (1 + (missedSlots ?? 0));
  const declaredLateness = finite(item.record.scheduleLatenessMs);
  const derivedLateness = item.captureStarted !== null && item.scheduled !== null ? item.captureStarted - item.scheduled : null;
  const reasons = [];
  if (item.scheduled === null || prior.scheduled === null || Math.abs((item.scheduled - prior.scheduled) - expectedGap) > 1) reasons.push('SCHEDULE_GAP');
  if (missedSlots === null || missedSlots < 0 || !Number.isInteger(missedSlots)) reasons.push('MISSED_SLOTS');
  if (derivedLateness === null || declaredLateness === null || Math.abs(derivedLateness - declaredLateness) > 1) reasons.push('LATENESS_DERIVATION');
  if (item.captureStarted === null || prior.captureStarted === null || item.captureStarted <= prior.captureStarted) reasons.push('CAPTURE_START_ORDER');
  return reasons.length ? [{ sequence: finite(item.record.sequence), reasons }] : [];
}) : [];
const hostCoverage = intervalCoverage(hostIntervals, windowStart, windowEnd);
hostCoverage.samples = hostIntervals.filter((item) => item.start <= windowEnd && item.end >= windowStart).length;
hostCoverage.sampleIntervalSeconds = hostSampleIntervalSeconds;
hostCoverage.semantics = 'FIVE_SECOND_CONTEXT_WINDOWS_NOT_REQUEST_EXACT';
hostCoverage.maxCaptureGapMs = hostCaptureGapsMs.length ? round(Math.max(...hostCaptureGapsMs)) : null;
hostCoverage.maxScheduledGapMs = hostScheduledGapsMs.length ? round(Math.max(...hostScheduledGapsMs)) : null;
hostCoverage.captureGapP95Ms = percentile(hostCaptureGapsMs, 0.95);
hostCoverage.cadenceModel = hostLifecycle.cadenceModel ?? (hostBoundarySchema ? 'UNKNOWN_BOUNDARY_SCHEMA' : 'LEGACY_COMPLETION_CADENCE');
hostCoverage.missedSlotsTotal = finite(hostLifecycle.missedSlotsTotal);
hostCoverage.derivedMissedSlotsTotal = hostBoundarySchema
  ? sortedHost.reduce((sum, item) => sum + (finite(item.record.missedSlots) ?? 0), 0)
  : null;
hostCoverage.cadenceViolations = hostCadenceViolations;
hostCoverage.boundaryFinalCardinality = hostBoundaryFinalRecords.length;
hostCoverage.periodicCapturesStartedAfterBoundary = hostBoundarySchema
  ? sortedHost.filter((item) => item.captureStarted !== null && item.captureStarted >= windowEnd).map((item) => finite(item.record.sequence))
  : [];
hostCoverage.boundaryFinalBound = !hostBoundarySchema || (hostBoundaryFinalRecords.length === 1
  && epoch(hostBoundaryFinalRecords[0].scheduledAt) === windowEnd
  && epoch(hostBoundaryFinalRecords[0].captureStartedAt) >= windowEnd
  && finite(hostLifecycle.boundaryFinalSequence) === finite(hostBoundaryFinalRecords[0].sequence));
hostCoverage.cpuP50 = percentile(hostIntervals.filter((item) => item.start <= windowEnd && item.end >= windowStart).map((item) => finite(pick(item.record, ['cpuPercent', 'cpuTotalPercent']))).filter(Number.isFinite), 0.5);
hostCoverage.cpuP95 = percentile(hostIntervals.filter((item) => item.start <= windowEnd && item.end >= windowStart).map((item) => finite(pick(item.record, ['cpuPercent', 'cpuTotalPercent']))).filter(Number.isFinite), 0.95);
hostCoverage.queueP50 = percentile(hostIntervals.filter((item) => item.start <= windowEnd && item.end >= windowStart).map((item) => finite(item.record.processorQueue)).filter(Number.isFinite), 0.5);
hostCoverage.queueP95 = percentile(hostIntervals.filter((item) => item.start <= windowEnd && item.end >= windowStart).map((item) => finite(item.record.processorQueue)).filter(Number.isFinite), 0.95);
hostCoverage.apiPids = [...new Set(hostIntervals
  .filter((item) => item.start <= windowEnd && item.end >= windowStart)
  .map((item) => finite(pick(item.record, ['api.pid', 'apiPid'])))
  .filter(Number.isFinite))];
hostCoverage.apiPidBoundToServer = serverPids.length === 1
  && hostCoverage.apiPids.length === 1
  && hostCoverage.apiPids[0] === serverPids[0];
if (hostCoverage.coverageRatio !== null && hostCoverage.coverageRatio < 0.95) addIssue('HOST_WINDOW_COVERAGE_LOW', hostCoverage.coverageRatio);
if (hostCoverage.maxInternalGapMs !== null && hostCoverage.maxInternalGapMs > hostIntervalMs * 1.5) addIssue('HOST_WINDOW_GAP_EXCEEDS_CONFIGURED_CADENCE', hostCoverage.maxInternalGapMs);
if (!hostBoundarySchema && hostCoverage.maxCaptureGapMs !== null && hostCoverage.maxCaptureGapMs > hostIntervalMs * 1.5) addIssue('HOST_CAPTURE_CADENCE_GAP', hostCoverage.maxCaptureGapMs);
if (hostBoundarySchema && (hostCadenceViolations.length > 0
  || hostCoverage.missedSlotsTotal !== hostCoverage.derivedMissedSlotsTotal)) {
  addIssue('HOST_ABSOLUTE_CADENCE_PROOF_INVALID', { violations: hostCadenceViolations, declaredMissedSlots: hostCoverage.missedSlotsTotal, derivedMissedSlots: hostCoverage.derivedMissedSlotsTotal });
}
if (!hostCoverage.boundaryFinalBound) addIssue('HOST_BOUNDARY_FINAL_BINDING_INVALID', hostCoverage.boundaryFinalCardinality);
if (hostCoverage.periodicCapturesStartedAfterBoundary.length) addIssue('HOST_PERIODIC_CAPTURE_AFTER_BOUNDARY', hostCoverage.periodicCapturesStartedAfterBoundary);
if (!hostCoverage.apiPidBoundToServer) addIssue('HOST_API_PID_BINDING_INVALID', hostCoverage.apiPids);

for (const correlation of correlations) {
  const request = requests.find((candidate) => candidate.traceId === correlation.traceId);
  const start = epoch(pick(request ?? {}, ['timestamps.clientStartedAt']));
  const end = epoch(pick(request ?? {}, ['timestamps.clientCompletedAt']));
  const midpoint = Number.isFinite(start) && Number.isFinite(end) ? start + ((end - start) / 2) : null;
  const nearestHost = Number.isFinite(midpoint) && sortedHost.length
    ? [...sortedHost].sort((left, right) => Math.abs(left.end - midpoint) - Math.abs(right.end - midpoint))[0]
    : null;
  correlation.hostSamples = Number.isFinite(start) && Number.isFinite(end)
    ? hostIntervals.filter((item) => item.start <= end && item.end >= start).length
    : 0;
  correlation.hostContext = nearestHost ? {
    semantics: 'NEAREST_FIVE_SECOND_CONTEXT_SAMPLE',
    captureAt: new Date(nearestHost.end).toISOString(),
    midpointOffsetMs: round(nearestHost.end - midpoint),
    cpuPercent: finite(nearestHost.record.cpuPercent),
    processorQueue: finite(nearestHost.record.processorQueue),
    availableMemoryMB: finite(nearestHost.record.availableMemoryMB),
    pagesPerSec: finite(nearestHost.record.pagesPerSec),
    diskQueue: finite(nearestHost.record.diskQueue),
    diskBytesPerSec: finite(nearestHost.record.diskBytesPerSec),
    networkBytesPerSec: finite(nearestHost.record.networkBytesPerSec),
    apiCpuSec: finite(nearestHost.record.api?.cpuSec),
    apiWorkingSetMB: finite(nearestHost.record.api?.workingSetMB),
  } : null;
  if (correlation.hostSamples === 0) {
    correlation.correlated = false;
    correlation.issues.push({ code: 'HOST_WINDOW_NOT_OVERLAPPED' });
  }
}
const correlationsWithoutHost = correlations.filter((record) => record.hostSamples === 0).length;
if (correlationsWithoutHost) addIssue('REQUEST_HOST_CORRELATION_INCOMPLETE', correlationsWithoutHost);

const processRecords = processEvidence.records.filter((record) => record.contract === 'agm-real-basic-process-sample.v1');
const orderedProcess = processRecords.map((record) => ({
  record,
  start: epoch(record.windowStartedAt),
  captureStarted: epoch(record.captureStartedAt),
  captured: epoch(pick(record, ['captureCompletedAt', 'capturedAt', 'at'])),
})).filter((item) => Number.isFinite(item.captured)).sort((left, right) => left.captured - right.captured);
const processLifecycleDocument = processLifecycleEvidence.document ?? {};
const processBoundarySchema = processLifecycleDocument.boundarySignalRequired === true
  || orderedProcess.some((item) => ['READINESS_BASELINE', 'FORMAL_BASELINE', 'MEASUREMENT_FINAL'].includes(item.record.sampleKind));
const readinessProcess = processBoundarySchema
  ? orderedProcess.find((item) => item.record.sampleKind === 'READINESS_BASELINE') ?? null
  : orderedProcess.find((item) => item.record.sampleKind === 'BASELINE')
    ?? orderedProcess.filter((item) => item.captured <= windowStart + 2000).at(-1)
    ?? null;
const formalBaselineCandidates = processBoundarySchema
  ? orderedProcess.filter((item) => item.record.sampleKind === 'FORMAL_BASELINE')
  : readinessProcess ? [readinessProcess] : [];
const baselineProcess = formalBaselineCandidates.length === 1 ? formalBaselineCandidates[0] : null;
const finalProcessCandidates = orderedProcess.filter((item) => item.record.sampleKind === (processBoundarySchema ? 'MEASUREMENT_FINAL' : 'MEASUREMENT'));
const finalProcess = finalProcessCandidates.length === 1 ? finalProcessCandidates[0] : null;
if (processBoundarySchema && formalBaselineCandidates.length !== 1) addIssue('PROCESS_FORMAL_BASELINE_CARDINALITY_INVALID', formalBaselineCandidates.length);
if (finalProcessCandidates.length !== 1) addIssue('PROCESS_FINAL_CAPTURE_CARDINALITY_INVALID', finalProcessCandidates.length);
const measurementBaselineEpoch = epoch(pick(processLifecycleDocument, ['measurementBaselineAt']))
  ?? baselineProcess?.captureStarted
  ?? finalProcess?.start
  ?? null;
const processFinalCaptureStartedEpoch = epoch(finalProcess?.record?.captureStartedAt);
const processFinalCaptureCompletedEpoch = epoch(finalProcess?.record?.captureCompletedAt) ?? finalProcess?.captured ?? null;
const derivedStartToStartCadenceSeconds = processFinalCaptureStartedEpoch !== null && measurementBaselineEpoch !== null
  ? round((processFinalCaptureStartedEpoch - measurementBaselineEpoch) / 1000, 6)
  : null;
const processCadenceSeconds = processBoundarySchema
  ? derivedStartToStartCadenceSeconds
  : finalProcess && measurementBaselineEpoch !== null
    ? round((finalProcess.captured - measurementBaselineEpoch) / 1000)
    : finite(finalProcess?.record?.wallSeconds);
const scheduledClientStart = epoch(client.window?.scheduledStartAt) ?? epoch(client.readiness?.scheduledStartAt) ?? windowStart;
const processCadence = {
  schema: processBoundarySchema ? 'BOUNDARY_V2' : 'LEGACY',
  samples: orderedProcess.length,
  rawBaselineCapturedAt: readinessProcess ? new Date(readinessProcess.captured).toISOString() : null,
  formalBaselineCapturedAt: baselineProcess ? new Date(baselineProcess.captured).toISOString() : null,
  measurementBaselineAt: measurementBaselineEpoch !== null ? new Date(measurementBaselineEpoch).toISOString() : null,
  finalAt: processFinalCaptureStartedEpoch !== null ? new Date(processFinalCaptureStartedEpoch).toISOString() : null,
  finalCompletedAt: processFinalCaptureCompletedEpoch !== null ? new Date(processFinalCaptureCompletedEpoch).toISOString() : null,
  observedSeconds: processCadenceSeconds,
  canonicalSource: processBoundarySchema ? 'FORMAL_BASELINE_TO_MEASUREMENT_FINAL_CAPTURE_START_SECONDS' : 'LEGACY_CAPTURE_INTERVAL',
  declaredSeconds: processBoundarySchema ? {
    processSample: finite(finalProcess?.record?.cadenceSeconds),
    processLifecycle: finite(processLifecycleDocument.measurementCadenceSeconds),
  } : null,
  derivedStartToStartCadenceSeconds,
  deviationFrom150Seconds: processCadenceSeconds === null ? null : round(processCadenceSeconds - 150),
  baselineOffsetMs: measurementBaselineEpoch === null || !Number.isFinite(windowStart) ? null : round(measurementBaselineEpoch - windowStart, 6),
  finalCaptureStartOffsetMs: processFinalCaptureStartedEpoch === null || !Number.isFinite(windowEnd) ? null : round(processFinalCaptureStartedEpoch - windowEnd, 6),
  finalCaptureEndOffsetMs: processFinalCaptureCompletedEpoch === null || !Number.isFinite(windowEnd) ? null : round(processFinalCaptureCompletedEpoch - windowEnd, 6),
  finalizationTailMs: processFinalCaptureStartedEpoch === null || processFinalCaptureCompletedEpoch === null ? null : round(processFinalCaptureCompletedEpoch - processFinalCaptureStartedEpoch, 6),
  rawBaselineBeforeOrAtWindow: readinessProcess !== null && readinessProcess.captured <= windowStart,
  measurementBaselineAlignedToWindow: measurementBaselineEpoch !== null && Math.abs(measurementBaselineEpoch - windowStart) <= 2000,
  finalAtOrAfterWindow: processFinalCaptureStartedEpoch !== null && processFinalCaptureStartedEpoch >= windowEnd,
  withinFiveSecondTolerance: processCadenceSeconds !== null && Math.abs(processCadenceSeconds - 150) <= 5,
  topCpuProcesses: Array.isArray(finalProcess?.record?.topCpuProcesses) ? finalProcess.record.topCpuProcesses : [],
  explicitWindowBinding: processBoundarySchema
    ? baselineProcess !== null && finalProcess !== null
      && epoch(baselineProcess.record.scheduledAt) === scheduledClientStart
      && epoch(finalProcess.record.scheduledAt) === windowEnd
      && epoch(processLifecycleDocument.boundaryClientCompletedAt) === windowEnd
      && finite(processLifecycleDocument.boundaryFinalSequence) === finite(finalProcess.record.sequence)
      && epoch(processLifecycleDocument.measurementBaselineAt) === baselineProcess.captureStarted
      && epoch(processLifecycleDocument.measurementFinalAt) === processFinalCaptureStartedEpoch
      && epoch(processLifecycleDocument.measurementFinalCompletedAt) === processFinalCaptureCompletedEpoch
    : finalProcess !== null
      && finalProcess.record.windowId === runId
      && epoch(finalProcess.record.formalWindowStartedAt) === windowStart
      && epoch(finalProcess.record.formalWindowCompletedAt) === windowEnd,
};
processCadence.topCpuIdentityComplete = processCadence.topCpuProcesses.length > 0
  && processCadence.topCpuProcesses.every((row) => finite(row.pid) !== null
    && epoch(row.processStartTimeUtc) !== null
    && typeof row.processName === 'string'
    && finite(row.cpuPercentOfOneCore) !== null);
if (!readinessProcess) addIssue('PROCESS_RAW_BASELINE_MISSING');
else if (!processCadence.rawBaselineBeforeOrAtWindow) addIssue('PROCESS_RAW_BASELINE_AFTER_WINDOW_START');
if (measurementBaselineEpoch === null) addIssue('PROCESS_MEASUREMENT_BASELINE_MISSING');
else if (Math.abs(measurementBaselineEpoch - windowStart) > 2000) addIssue('PROCESS_MEASUREMENT_BASELINE_NOT_ALIGNED', round(measurementBaselineEpoch - windowStart));
if (!finalProcess) addIssue('PROCESS_FINAL_CAPTURE_MISSING');
else if (!processCadence.finalAtOrAfterWindow) addIssue('PROCESS_FINAL_CAPTURE_BEFORE_WINDOW_END');
if (!processCadence.explicitWindowBinding) addIssue('PROCESS_FINAL_EXACT_WINDOW_BINDING_MISSING');
if (processCadenceSeconds !== null && Math.abs(processCadenceSeconds - 150) > 5) addIssue('PROCESS_CADENCE_NOT_150_SECONDS', processCadenceSeconds);
if (processBoundarySchema) {
  for (const [source, declared] of Object.entries(processCadence.declaredSeconds)) {
    if (declared === null) addIssue('PROCESS_DECLARED_CADENCE_INVALID', { source, declared });
    else if (derivedStartToStartCadenceSeconds === null || Math.abs(declared - derivedStartToStartCadenceSeconds) > 0.001) {
      addIssue('PROCESS_DECLARED_CADENCE_DERIVATION_MISMATCH', { source, declared, derived: derivedStartToStartCadenceSeconds });
    }
  }
}
if (processCadence.explicitWindowBinding && (Math.abs(processCadence.baselineOffsetMs) > (processBoundarySchema ? 1000 : 1)
  || Math.abs(processCadence.finalCaptureStartOffsetMs) > (processBoundarySchema ? 1000 : 1))) {
  addIssue('PROCESS_EXACT_BOUNDARY_NOT_ALIGNED', {
    baselineOffsetMs: processCadence.baselineOffsetMs,
    finalCaptureStartOffsetMs: processCadence.finalCaptureStartOffsetMs,
    finalCaptureEndOffsetMs: processCadence.finalCaptureEndOffsetMs,
  });
}
if (!processCadence.topCpuIdentityComplete) addIssue('PROCESS_CPU_IDENTITY_EVIDENCE_INCOMPLETE');

const managedRootsDocument = managedRootsEvidence.document ?? {};
const managedRoots = Array.isArray(managedRootsDocument.managedRoots) ? managedRootsDocument.managedRoots : [];
const managedRootByRole = new Map(managedRoots.map((rootRecord) => [String(rootRecord.role), rootRecord]));
const managedRootsCheck = {
  contract: managedRootsDocument.contract ?? null,
  runId: managedRootsDocument.runId ?? null,
  records: managedRoots.length,
  uniquePids: new Set(managedRoots.map((rootRecord) => finite(rootRecord.pid)).filter(Number.isFinite)).size,
  roles: [...managedRootByRole.keys()].sort(),
  everyIdentityComplete: managedRoots.every((rootRecord) => finite(rootRecord.pid) !== null && epoch(rootRecord.startTimeUtc) !== null),
  fingerprintSchemaSupported: managedRootsDocument.contract === 'agm-instrumentation-lifecycle-managed-process-roots.v2',
  everyFingerprintComplete: managedRoots.every((rootRecord) => {
    const pid = finite(rootRecord.pid);
    const creationEpochMs = finite(rootRecord.creationEpochMs);
    const executableHash = String(rootRecord.executablePathSha256 ?? '');
    const commandHash = String(rootRecord.commandLineSha256 ?? '');
    const canonical = pid === null || creationEpochMs === null || typeof rootRecord.imageName !== 'string'
      ? null
      : `${pid}|${creationEpochMs}|${rootRecord.imageName.toLowerCase()}|${executableHash}|${commandHash}`;
    return pid !== null && finite(rootRecord.parentPid) !== null && typeof rootRecord.imageName === 'string'
      && Math.trunc(epoch(rootRecord.creationAt)) === creationEpochMs
      && Math.abs(epoch(rootRecord.startTimeUtc) - creationEpochMs) <= 2000
      && /^[0-9a-f]{64}$/.test(executableHash) && /^[0-9a-f]{64}$/.test(commandHash)
      && rootRecord.identityStrength === 'FULL_CURRENT' && rootRecord.identityEvidence === 'INITIAL_MANAGED_ROOT_SNAPSHOT'
      && rootRecord.identitySha256 === createHash('sha256').update(canonical).digest('hex');
  }),
  fingerprintDocumentValid: managedRootsDocument.contract !== 'agm-instrumentation-lifecycle-managed-process-roots.v2'
    || (managedRootsDocument.identity === 'PID_CREATION_EPOCH_MS_IMAGE_EXECUTABLE_PATH_SHA256_COMMAND_LINE_SHA256'
      && managedRootsDocument.identityHashAlgorithm === 'SHA256'
      && managedRootsDocument.rawExecutablePathsRecorded === false
      && managedRootsDocument.rawCommandLinesRecorded === false),
};
managedRootsCheck.contractSupported = ['agm-instrumentation-lifecycle-managed-process-roots.v1', 'agm-instrumentation-lifecycle-managed-process-roots.v2']
  .includes(managedRootsCheck.contract);
managedRootsCheck.valid = managedRootsCheck.contractSupported
  && managedRootsCheck.runId === runId
  && managedRootsCheck.records === 4
  && managedRootsCheck.uniquePids === 4
  && managedRootsCheck.everyIdentityComplete
  && (!managedRootsCheck.fingerprintSchemaSupported || (managedRootsCheck.fingerprintDocumentValid && managedRootsCheck.everyFingerprintComplete))
  && ['API', 'CLIENT', 'HOST_SAMPLER', 'PROCESS_SAMPLER'].every((role) => managedRootByRole.has(role));
if (!managedRootsCheck.valid) addIssue('MANAGED_PROCESS_ROOT_IDENTITIES_INVALID', managedRootsCheck);
const readiness = readinessEvidence.document ?? {};
const readinessCheck = {
  contract: readiness.contract ?? null,
  apiReady: readiness.api?.ready === true,
  apiPidBound: finite(readiness.api?.pid) === finite(managedRootByRole.get('API')?.pid)
    && finite(readiness.api?.pid) === serverPids[0],
  hostSamplerPidBound: finite(readiness.hostSampler?.pid) === finite(managedRootByRole.get('HOST_SAMPLER')?.pid),
  processSamplerPidBound: finite(readiness.processSampler?.pid) === finite(managedRootByRole.get('PROCESS_SAMPLER')?.pid),
  clientPidBound: finite(readiness.client?.pid) === finite(managedRootByRole.get('CLIENT')?.pid)
    && finite(readiness.client?.pid) === finite(client.clientPid),
  formalStartBound: epoch(readiness.formalStartAt) === epoch(client.window?.scheduledStartAt),
};
readinessCheck.valid = readinessCheck.contract === 'agm-instrumentation-lifecycle-readiness.v1'
  && Object.entries(readinessCheck).filter(([key]) => !['contract', 'valid'].includes(key)).every(([, value]) => value === true);
if (!readinessCheck.valid) addIssue('READINESS_IDENTITY_OR_BOUNDARY_INVALID', readinessCheck);

function validateLifecycle(document, expectedRole, managedRole) {
  if (!document) return { present: false, role: expectedRole, valid: false };
  const managedRoot = managedRootByRole.get(managedRole) ?? null;
  const managedApi = managedRootByRole.get('API') ?? null;
  const result = {
    present: true,
    contract: document.contract ?? null,
    role: document.role ?? null,
    runId: document.runId ?? null,
    samplerPid: finite(document.samplerPid),
    samplerStartTimeUtc: document.samplerStartTimeUtc ?? null,
    parentPid: finite(document.parentPid),
    parentStartTimeUtc: document.parentStartTimeUtc ?? null,
    apiPid: finite(document.apiPid),
    apiStartTimeUtc: document.apiStartTimeUtc ?? null,
    startedAt: document.startedAt ?? null,
    completedAt: document.completedAt ?? null,
    sampleIntervalSeconds: finite(document.sampleIntervalSeconds),
    samplesWritten: finite(document.samplesWritten),
    stopSignalObserved: document.stopReason === 'STOP_SIGNAL',
    graceful: document.graceful === true,
    exitCode: finite(document.exitCode),
    error: document.error ?? null,
  };
  result.samplerIdentityBound = managedRoot !== null
    && result.samplerPid === finite(managedRoot.pid)
    && epoch(result.samplerStartTimeUtc) === epoch(managedRoot.startTimeUtc);
  result.parentIdentityBound = result.parentPid === finite(custody.runnerPid)
    && epoch(result.parentStartTimeUtc) === epoch(custody.runnerStartTimeUtc);
  result.apiIdentityBound = managedApi !== null
    && result.apiPid === finite(managedApi.pid)
    && epoch(result.apiStartTimeUtc) === epoch(managedApi.startTimeUtc)
    && serverPids.length === 1
    && result.apiPid === serverPids[0];
  result.valid = result.contract === 'agm-real-basic-sampler-lifecycle.v1'
    && result.role === expectedRole
    && result.runId === runId
    && result.samplerPid !== null
    && result.samplerIdentityBound
    && result.parentIdentityBound
    && result.apiIdentityBound
    && result.stopSignalObserved
    && result.graceful
    && result.exitCode === 0
    && result.error === null;
  if (!result.valid) addIssue('SAMPLER_LIFECYCLE_INVALID', expectedRole);
  return result;
}
const hostLifecycleCheck = validateLifecycle(hostLifecycleEvidence.document, 'HOST', 'HOST_SAMPLER');
const processLifecycleCheck = validateLifecycle(processLifecycleEvidence.document, 'PROCESS', 'PROCESS_SAMPLER');
hostLifecycleCheck.expectedFiveSecondCadence = hostLifecycleCheck.sampleIntervalSeconds === 5;
processLifecycleCheck.expected150SecondCadence = processLifecycleCheck.sampleIntervalSeconds === 150;
processLifecycleCheck.startSignalRequired = processLifecycleEvidence.document?.startSignalRequired === true;
processLifecycleCheck.startSignalObservedAt = processLifecycleEvidence.document?.startSignalObservedAt ?? null;
processLifecycleCheck.startSignalDurationSeconds = finite(processLifecycleEvidence.document?.startSignalDurationSeconds);
processLifecycleCheck.startSignalWindowId = processLifecycleEvidence.document?.startSignalWindowId ?? null;
if (!hostLifecycleCheck.expectedFiveSecondCadence) addIssue('HOST_SAMPLER_INTERVAL_NOT_FIVE_SECONDS', hostLifecycleCheck.sampleIntervalSeconds);
if (!processLifecycleCheck.expected150SecondCadence) addIssue('PROCESS_SAMPLER_INTERVAL_NOT_150_SECONDS', processLifecycleCheck.sampleIntervalSeconds);
if (!processLifecycleCheck.startSignalRequired || !processLifecycleCheck.startSignalObservedAt) addIssue('PROCESS_SAMPLER_START_SIGNAL_NOT_PROVEN');
if (processLifecycleCheck.startSignalDurationSeconds !== 150) addIssue('PROCESS_SAMPLER_SIGNAL_DURATION_NOT_150_SECONDS', processLifecycleCheck.startSignalDurationSeconds);
if (processLifecycleCheck.startSignalWindowId !== null && processLifecycleCheck.startSignalWindowId !== runId) {
  addIssue('PROCESS_SAMPLER_SIGNAL_RUN_ID_MISMATCH', processLifecycleCheck.startSignalWindowId);
}

const samplerBoundary = samplerBoundaryEvidence.document ?? {};
const samplerRelease = samplerReleaseEvidence.document ?? {};
const hostBoundaryReady = hostBoundaryReadyEvidence.document ?? {};
const processBoundaryReady = processBoundaryReadyEvidence.document ?? {};
const boundaryProtocolRequired = processBoundarySchema
  || samplerBoundaryEvidence.present || samplerReleaseEvidence.present
  || shutdownEvidence.document?.contract === 'agm-instrumentation-lifecycle-shutdown.v2';
const boundaryAckCommonValid = (ack, role, lifecycle, managedRole) => ack?.contract === 'agm-real-basic-sampler-boundary-ready.v1'
  && ack.role === role
  && ack.runId === runId
  && finite(ack.samplerPid) === lifecycle.samplerPid
  && epoch(ack.samplerStartTimeUtc) === epoch(managedRootByRole.get(managedRole)?.startTimeUtc)
  && ack.boundary?.contract === samplerBoundary.contract
  && epoch(ack.boundary?.requestedAt) === epoch(samplerBoundary.requestedAt)
  && epoch(ack.boundary?.clientCompletedAt) === windowEnd
  && ack.periodicSamplingStopped === true
  && ack.quiescentUntilRelease === true;
const boundaryRequestedEpoch = epoch(samplerBoundary.requestedAt);
const hostBoundaryObservedEpoch = epoch(hostBoundaryReady.boundary?.observedAt);
const hostBoundaryReadyEpoch = epoch(hostBoundaryReady.readyAt);
const processBoundaryObservedEpoch = epoch(processBoundaryReady.boundary?.observedAt);
const processBoundaryReadyEpoch = epoch(processBoundaryReady.readyAt);
const processAckBaselineStartedEpoch = epoch(processBoundaryReady.measurement?.baseline?.captureStartedAt);
const processAckFinalStartedEpoch = epoch(processBoundaryReady.measurement?.final?.captureStartedAt);
const processAckDeclaredCadenceSeconds = finite(processBoundaryReady.measurement?.cadenceSeconds);
const processAckExpectedDurationSeconds = finite(processBoundaryReady.measurement?.expectedDurationSeconds);
const processAckDeclaredDeviationSeconds = finite(processBoundaryReady.measurement?.cadenceDeviationSeconds);
const processAckDerivedCadenceSeconds = Number.isFinite(processAckBaselineStartedEpoch) && Number.isFinite(processAckFinalStartedEpoch)
  ? (processAckFinalStartedEpoch - processAckBaselineStartedEpoch) / 1000
  : null;
const processAckCadenceValid = [processAckDeclaredCadenceSeconds, processAckExpectedDurationSeconds,
  processAckDeclaredDeviationSeconds, processAckDerivedCadenceSeconds].every(Number.isFinite)
  && Math.abs(processAckDeclaredCadenceSeconds - processAckDerivedCadenceSeconds) <= 0.001
  && Math.abs(processAckDeclaredDeviationSeconds - (processAckDerivedCadenceSeconds - processAckExpectedDurationSeconds)) <= 0.001
  && Math.abs(processAckDeclaredDeviationSeconds) <= 1;
if (boundaryProtocolRequired && !processAckCadenceValid) {
  addIssue('PROCESS_ACK_CADENCE_DECLARATION_INVALID', {
    declaredSeconds: processAckDeclaredCadenceSeconds,
    derivedSeconds: round(processAckDerivedCadenceSeconds, 6),
    expectedSeconds: processAckExpectedDurationSeconds,
    declaredDeviationSeconds: processAckDeclaredDeviationSeconds,
  });
}
const preShutdownStartedEpoch = epoch(preShutdownInventoryEvidence.document?.captureStartedAt);
const preShutdownCompletedEpoch = epoch(preShutdownInventoryEvidence.document?.capturedAt);
const releaseRequestedEpoch = epoch(samplerRelease.requestedAt);
const boundaryProtocolCheck = {
  required: boundaryProtocolRequired,
  filesPresent: !boundaryProtocolRequired || [samplerBoundaryEvidence, samplerReleaseEvidence, hostBoundaryReadyEvidence, processBoundaryReadyEvidence].every((item) => item.present),
  boundaryValid: !boundaryProtocolRequired || (samplerBoundary.contract === 'agm-instrumentation-lifecycle-sampler-boundary.v1'
    && samplerBoundary.runId === runId
    && samplerBoundary.windowId === runId
    && finite(samplerBoundary.clientPid) === finite(client.clientPid)
    && samplerBoundary.reason === 'CLIENT_WINDOW_COMPLETED'
    && epoch(samplerBoundary.clientCompletedAt) === windowEnd
    && epoch(samplerBoundary.requestedAt) >= windowEnd),
  releaseValid: !boundaryProtocolRequired || (samplerRelease.contract === 'agm-instrumentation-lifecycle-sampler-release.v1'
    && samplerRelease.runId === runId
    && epoch(samplerRelease.requestedAt) !== null
    && epoch(samplerRelease.boundaryRequestedAt) === epoch(samplerBoundary.requestedAt)
    && epoch(samplerRelease.boundaryClientCompletedAt) === windowEnd),
  hostAckValid: !boundaryProtocolRequired || (boundaryAckCommonValid(hostBoundaryReady, 'HOST', hostLifecycleCheck, 'HOST_SAMPLER')
    && hostBoundaryReady.finalSample?.sampleKind === 'BOUNDARY_FINAL'
    && finite(hostBoundaryReady.finalSample?.sequence) === finite(hostLifecycleEvidence.document?.boundaryFinalSequence)
    && epoch(hostBoundaryReady.finalSample?.scheduledAt) === windowEnd),
  processAckValid: !boundaryProtocolRequired || (boundaryAckCommonValid(processBoundaryReady, 'PROCESS', processLifecycleCheck, 'PROCESS_SAMPLER')
    && processBoundaryReady.measurement?.baseline?.sampleKind === 'FORMAL_BASELINE'
    && processBoundaryReady.measurement?.final?.sampleKind === 'MEASUREMENT_FINAL'
    && processBoundaryReady.measurement?.snapshotSemantics === 'NON_ATOMIC_PROCESS_ENUMERATION_START_TO_START_DENOMINATOR'
    && processAckExpectedDurationSeconds === 150
    && processAckCadenceValid
    && epoch(processBoundaryReady.measurement?.baseline?.scheduledAt) === scheduledClientStart
    && processAckBaselineStartedEpoch === baselineProcess?.captureStarted
    && processAckFinalStartedEpoch === processFinalCaptureStartedEpoch
    && finite(processBoundaryReady.measurement?.final?.sequence) === finite(processLifecycleEvidence.document?.boundaryFinalSequence)
    && epoch(processBoundaryReady.measurement?.final?.scheduledAt) === windowEnd),
  lifecycleBound: !boundaryProtocolRequired || [hostLifecycleEvidence.document, processLifecycleEvidence.document].every((document) => document?.boundarySignalRequired === true
    && document.releaseSignalRequired === true
    && epoch(document.boundaryRequestedAt) === epoch(samplerBoundary.requestedAt)
    && epoch(document.boundaryClientCompletedAt) === windowEnd
    && epoch(document.releaseRequestedAt) === epoch(samplerRelease.requestedAt)
    && epoch(document.releaseObservedAt) >= epoch(samplerRelease.requestedAt)
    && epoch(document.completedAt) >= epoch(document.releaseObservedAt)),
  orderValid: !boundaryProtocolRequired || ([windowEnd, boundaryRequestedEpoch, hostBoundaryObservedEpoch, hostBoundaryReadyEpoch,
    processBoundaryObservedEpoch, processBoundaryReadyEpoch, preShutdownStartedEpoch, preShutdownCompletedEpoch, releaseRequestedEpoch].every(Number.isFinite)
    && boundaryRequestedEpoch >= windowEnd
    && hostBoundaryObservedEpoch >= boundaryRequestedEpoch && hostBoundaryReadyEpoch >= hostBoundaryObservedEpoch
    && processBoundaryObservedEpoch >= boundaryRequestedEpoch && processBoundaryReadyEpoch >= processBoundaryObservedEpoch
    && preShutdownStartedEpoch >= Math.max(hostBoundaryReadyEpoch, processBoundaryReadyEpoch)
    && preShutdownCompletedEpoch >= preShutdownStartedEpoch
    && releaseRequestedEpoch >= preShutdownCompletedEpoch),
};
boundaryProtocolCheck.valid = Object.entries(boundaryProtocolCheck)
  .filter(([key]) => !['required', 'valid'].includes(key))
  .every(([, value]) => value === true);
if (!boundaryProtocolCheck.valid) addIssue('SAMPLER_BOUNDARY_RELEASE_PROTOCOL_INVALID', boundaryProtocolCheck);

function validateSamplerTelemetryRows(records, expectedContract, lifecycle, label) {
  const sequences = records.map((record) => finite(record.sequence));
  const result = {
    rows: records.length,
    expectedContract,
    contractBound: records.length > 0 && records.every((record) => record.contract === expectedContract),
    runBound: records.length > 0 && records.every((record) => record.runId === runId),
    samplerPidBound: records.length > 0 && records.every((record) => finite(record.samplerPid) === lifecycle.samplerPid),
    sequenceNumeric: sequences.every(Number.isFinite),
    sequenceUnique: new Set(sequences).size === sequences.length,
    sequenceContiguousFromOne: sequences.every((sequence, index) => sequence === index + 1),
    lifecycleCountBound: lifecycle.samplesWritten === records.length,
  };
  result.valid = result.contractBound && result.runBound && result.samplerPidBound
    && result.sequenceNumeric && result.sequenceUnique && result.sequenceContiguousFromOne && result.lifecycleCountBound;
  if (!result.valid) addIssue('SAMPLER_TELEMETRY_IDENTITY_OR_SEQUENCE_INVALID', { label, ...result });
  return result;
}
const hostTelemetryIntegrity = validateSamplerTelemetryRows(
  hostEvidence.records,
  'agm-real-basic-host-sample.v1',
  hostLifecycleCheck,
  'HOST',
);
const processTelemetryIntegrity = validateSamplerTelemetryRows(
  processEvidence.records,
  'agm-real-basic-process-sample.v1',
  processLifecycleCheck,
  'PROCESS',
);

const overhead = overheadEvidence.document ?? {};
const overheadRows = Array.isArray(overhead.processes)
  ? overhead.processes
  : Array.isArray(overhead.observers)
    ? overhead.observers
    : Array.isArray(overhead.measurements)
      ? overhead.measurements
      : [];
const normalizedOverhead = overheadRows.map((row) => ({
  role: String(row.role ?? row.name ?? '').toUpperCase(),
  pid: finite(row.pid),
  cpuSecondsDelta: finite(pick(row, ['cpuSecondsDelta', 'cpuDeltaSeconds'])),
  cpuPercentOfOneCore: finite(row.cpuPercentOfOneCore),
  cpuPercentOfHost: finite(row.cpuPercentOfHost),
  wallSeconds: finite(row.wallSeconds) ?? finite(overhead.wallSeconds),
  captureDurationP50Ms: finite(pick(row, ['captureDurationMs.p50', 'captureDurationP50Ms'])),
  captureDurationP95Ms: finite(pick(row, ['captureDurationMs.p95', 'captureDurationP95Ms'])),
  captureDurationMaxMs: finite(pick(row, ['captureDurationMs.max', 'captureDurationMaxMs'])),
}));
const hostOverhead = normalizedOverhead.find((row) => row.role.includes('HOST')) ?? null;
const processOverhead = normalizedOverhead.find((row) => row.role.includes('PROCESS')) ?? null;
const overheadCheck = {
  contract: overhead.contract ?? null,
  runId: overhead.runId ?? null,
  windowId: overhead.windowId ?? null,
  windowStartedAt: overhead.windowStartedAt ?? null,
  windowCompletedAt: overhead.windowCompletedAt ?? null,
  exactWindowSeconds: finite(overhead.exactWindowSeconds),
  clientObservedDurationMs: finite(client.window?.observedDurationMs),
  measurementCapturedAtStart: overhead.capturedAtStart ?? null,
  measurementCapturedAtEnd: overhead.capturedAtEnd ?? null,
  wallSeconds: finite(overhead.wallSeconds),
  hostSampler: hostOverhead,
  processSampler: processOverhead,
  bothSamplerPidsMeasured: hostOverhead?.pid === hostLifecycleCheck.samplerPid && processOverhead?.pid === processLifecycleCheck.samplerPid,
  cpuDeltasMeasured: hostOverhead?.cpuSecondsDelta !== null && processOverhead?.cpuSecondsDelta !== null,
  captureDurationsMeasured: hostOverhead?.captureDurationP50Ms !== null
    && hostOverhead?.captureDurationP95Ms !== null
    && hostOverhead?.captureDurationMaxMs !== null
    && processOverhead?.captureDurationP50Ms !== null
    && processOverhead?.captureDurationP95Ms !== null
    && processOverhead?.captureDurationMaxMs !== null,
};
overheadCheck.contractValid = ['agm-instrumentation-lifecycle-observer-overhead.v1', 'agm-instrumentation-lifecycle-observer-overhead.v2']
  .includes(overheadCheck.contract);
overheadCheck.v2 = overheadCheck.contract === 'agm-instrumentation-lifecycle-observer-overhead.v2';
overheadCheck.runBound = overheadCheck.runId === runId;
overheadCheck.windowIdBound = !overheadCheck.v2 || overheadCheck.windowId === runId;
overheadCheck.declaredWindowBound = epoch(overheadCheck.windowStartedAt) === windowStart
  && epoch(overheadCheck.windowCompletedAt) === windowEnd;
overheadCheck.wallClockWindowDurationMs = Number.isFinite(windowStart) && Number.isFinite(windowEnd)
  ? round(windowEnd - windowStart, 6)
  : null;
overheadCheck.exactWindowReferenceMs = overheadCheck.v2
  ? overheadCheck.clientObservedDurationMs
  : overheadCheck.wallClockWindowDurationMs;
overheadCheck.clockDomainSkewMs = overheadCheck.clientObservedDurationMs !== null && overheadCheck.wallClockWindowDurationMs !== null
  ? round(overheadCheck.wallClockWindowDurationMs - overheadCheck.clientObservedDurationMs, 6)
  : null;
overheadCheck.exactWindowDurationBound = overheadCheck.exactWindowSeconds !== null
  && overheadCheck.exactWindowReferenceMs !== null
  && Math.abs((overheadCheck.exactWindowSeconds * 1000) - overheadCheck.exactWindowReferenceMs) <= 0.001;
overheadCheck.startOffsetMs = epoch(overheadCheck.measurementCapturedAtStart) !== null && Number.isFinite(windowStart)
  ? round(epoch(overheadCheck.measurementCapturedAtStart) - windowStart)
  : null;
overheadCheck.endOffsetMs = epoch(overheadCheck.measurementCapturedAtEnd) !== null && Number.isFinite(windowEnd)
  ? round(epoch(overheadCheck.measurementCapturedAtEnd) - windowEnd)
  : null;
overheadCheck.measurementWallSeconds = epoch(overheadCheck.measurementCapturedAtStart) !== null && epoch(overheadCheck.measurementCapturedAtEnd) !== null
  ? round((epoch(overheadCheck.measurementCapturedAtEnd) - epoch(overheadCheck.measurementCapturedAtStart)) / 1000, 6)
  : null;
if (!hostOverhead || !processOverhead) addIssue('OBSERVER_OVERHEAD_SAMPLER_ROWS_MISSING');
if (!overheadCheck.contractValid) addIssue('OBSERVER_OVERHEAD_CONTRACT_INVALID', overheadCheck.contract);
if (!overheadCheck.runBound) addIssue('OBSERVER_OVERHEAD_RUN_BINDING_INVALID', overheadCheck.runId);
if (!overheadCheck.windowIdBound) addIssue('OBSERVER_OVERHEAD_WINDOW_ID_BINDING_INVALID', overheadCheck.windowId);
if (!overheadCheck.declaredWindowBound) addIssue('OBSERVER_OVERHEAD_DECLARED_WINDOW_BINDING_INVALID', {
  startedAt: overheadCheck.windowStartedAt,
  completedAt: overheadCheck.windowCompletedAt,
});
if (!overheadCheck.exactWindowDurationBound) addIssue('OBSERVER_OVERHEAD_EXACT_WINDOW_DURATION_INVALID', overheadCheck.exactWindowSeconds);
if (!overheadCheck.bothSamplerPidsMeasured) addIssue('OBSERVER_OVERHEAD_PID_BINDING_INVALID');
if (!overheadCheck.cpuDeltasMeasured) addIssue('OBSERVER_OVERHEAD_CPU_DELTA_MISSING');
if (!overheadCheck.captureDurationsMeasured) addIssue('OBSERVER_CAPTURE_DURATION_MISSING');
if (overheadCheck.wallSeconds !== null && overheadCheck.wallSeconds < 149) addIssue('OBSERVER_OVERHEAD_WINDOW_TOO_SHORT', overheadCheck.wallSeconds);
if (overheadCheck.startOffsetMs === null || Math.abs(overheadCheck.startOffsetMs) > 1000) {
  addIssue('OBSERVER_OVERHEAD_START_NOT_ALIGNED', overheadCheck.startOffsetMs);
}
// The end snapshot intentionally includes the first complete 5 s host sample
// after the formal boundary, so the accepted tail is bounded by one cadence.
if (overheadCheck.endOffsetMs === null || overheadCheck.endOffsetMs < -1000 || overheadCheck.endOffsetMs > hostIntervalMs + 1500) {
  addIssue('OBSERVER_OVERHEAD_END_NOT_ALIGNED', overheadCheck.endOffsetMs);
}
if (overheadCheck.v2) {
  overheadCheck.boundaryContractValid = overhead.boundary?.contract === 'agm-instrumentation-lifecycle-sampler-boundary.v1';
  overheadCheck.boundaryWindowBound = epoch(overhead.boundary?.clientCompletedAt) === windowEnd;
  overheadCheck.formalWindowBound = epoch(overhead.formalWindow?.declaredStartedAt) === windowStart
    && epoch(overhead.formalWindow?.declaredCompletedAt) === windowEnd
    && epoch(overhead.formalWindow?.cpuSnapshotStartedAt) === epoch(overheadCheck.measurementCapturedAtStart)
    && epoch(overhead.formalWindow?.cpuSnapshotCompletedAt) === epoch(overheadCheck.measurementCapturedAtEnd);
  overheadCheck.boundaryAcquisitionBounded = overheadCheck.startOffsetMs !== null
    && overheadCheck.endOffsetMs !== null
    && Math.abs(overheadCheck.startOffsetMs) <= 250
    && overheadCheck.endOffsetMs >= 0
    && overheadCheck.endOffsetMs <= 250;
  overheadCheck.finalizationTailExplicit = finite(overhead.finalizationTail?.wallSeconds) !== null
    && epoch(overhead.finalizationTail?.startedAt) === epoch(overheadCheck.measurementCapturedAtEnd)
    && epoch(overhead.finalizationTail?.completedAt) !== null;
  if (!overheadCheck.boundaryContractValid || !overheadCheck.boundaryWindowBound || !overheadCheck.formalWindowBound) {
    addIssue('OBSERVER_OVERHEAD_V2_BOUNDARY_BINDING_INVALID');
  }
  if (!overheadCheck.boundaryAcquisitionBounded) {
    addIssue('OBSERVER_OVERHEAD_V2_BOUNDARY_ACQUISITION_UNBOUNDED', {
      startOffsetMs: overheadCheck.startOffsetMs,
      endOffsetMs: overheadCheck.endOffsetMs,
    });
  }
  if (!overheadCheck.finalizationTailExplicit) addIssue('OBSERVER_OVERHEAD_V2_FINALIZATION_TAIL_MISSING');
} else if (overheadCheck.startOffsetMs === null || overheadCheck.endOffsetMs === null
  || Math.abs(overheadCheck.startOffsetMs) > 1 || Math.abs(overheadCheck.endOffsetMs) > 1) {
  addIssue('OBSERVER_OVERHEAD_EXACT_MEASUREMENT_BOUNDARY_INVALID', {
    startOffsetMs: overheadCheck.startOffsetMs,
    endOffsetMs: overheadCheck.endOffsetMs,
  });
}
if (overheadCheck.measurementWallSeconds !== null && overheadCheck.wallSeconds !== null
  && Math.abs(overheadCheck.measurementWallSeconds - overheadCheck.wallSeconds) > 1) {
  addIssue('OBSERVER_OVERHEAD_NUMERATOR_DENOMINATOR_WINDOW_MISMATCH', {
    measurementWallSeconds: overheadCheck.measurementWallSeconds,
    declaredWallSeconds: overheadCheck.wallSeconds,
  });
}

const shutdown = shutdownEvidence.document ?? {};
const shutdownRows = Array.isArray(shutdown.processes) ? shutdown.processes : [];
const normalizedShutdown = shutdownRows.map((row) => ({
  role: String(row.role ?? row.name ?? '').toUpperCase(),
  pid: finite(row.pid),
  graceful: row.graceful === true,
  forced: row.forced === true || row.forceUsed === true || row.forcedStopUsed === true,
  aliveAfter: row.aliveAfter === true || row.hasExited === false,
  exitCode: finite(row.exitCode),
  actualProcessExitCode: finite(row.actualProcessExitCode),
}));
const knownPids = [hostLifecycleCheck.samplerPid, processLifecycleCheck.samplerPid, finite(client.clientPid), serverPids[0]].filter(Number.isFinite);
const shutdownPids = normalizedShutdown.map((row) => row.pid).filter(Number.isFinite);
const missingShutdownPids = knownPids.filter((pid) => !shutdownPids.includes(pid));
const finalInventoryBytes = finalInventoryEvidence.present ? await readFile(finalInventoryEvidence.path) : null;
const finalInventorySha256 = finalInventoryBytes ? createHash('sha256').update(finalInventoryBytes).digest('hex') : null;
const shutdownCheck = {
  contract: shutdown.contract ?? null,
  processRecords: normalizedShutdown.length,
  knownPids,
  missingKnownPids: missingShutdownPids,
  forcedStops: normalizedShutdown.filter((row) => row.forced).length,
  aliveAfter: normalizedShutdown.filter((row) => row.aliveAfter).length,
  nongraceful: normalizedShutdown.filter((row) => !row.graceful).length,
  nonzeroOrMissingActualExitCodes: normalizedShutdown.filter((row) => row.actualProcessExitCode !== 0).map((row) => ({ role: row.role, actualProcessExitCode: row.actualProcessExitCode })),
  declaredOrphans: finite(shutdown.orphans) ?? (Array.isArray(shutdown.orphanProcesses) ? shutdown.orphanProcesses.length : null),
  cleanupErrors: Array.isArray(shutdown.cleanupErrors) ? shutdown.cleanupErrors : null,
};
shutdownCheck.contractSupported = ['agm-instrumentation-lifecycle-shutdown.v1', 'agm-instrumentation-lifecycle-shutdown.v2', 'agm-instrumentation-lifecycle-shutdown.v3'].includes(shutdownCheck.contract);
shutdownCheck.v2 = shutdownCheck.contract === 'agm-instrumentation-lifecycle-shutdown.v2';
shutdownCheck.v3 = shutdownCheck.contract === 'agm-instrumentation-lifecycle-shutdown.v3';
shutdownCheck.v2BoundaryProtocolBound = !shutdownCheck.v2 || (shutdown.runId === runId
  && shutdown.windowId === runId
  && boundaryProtocolCheck.valid
  && epoch(shutdown.boundarySignalCreatedAt) === epoch(samplerBoundary.requestedAt)
  && epoch(shutdown.releaseSignalCreatedAt) === epoch(samplerRelease.requestedAt)
  && epoch(shutdown.boundary?.clientCompletedAt) === windowEnd
  && shutdown.boundaryAcknowledgements?.host?.runId === runId
  && shutdown.boundaryAcknowledgements?.process?.runId === runId);
shutdownCheck.v2FinalInventoryBound = !shutdownCheck.v2 || (shutdown.finalInventory?.contract === 'agm-instrumentation-lifecycle-process-inventory.v2'
  && shutdown.finalInventory?.runId === runId
  && shutdown.finalInventory?.capturePhase === 'AFTER_SHUTDOWN'
  && shutdown.finalInventory?.trackedClosureComplete === true
  && finite(shutdown.finalInventory?.currentTrackedMatches) === 0
  && finite(shutdown.finalInventory?.p9Matches) === 0
  && finite(shutdown.finalInventory?.observerMatches) === 0
  && basename(String(shutdown.finalInventory?.evidence?.path ?? '')) === finalInventoryEvidence.name
  && finite(shutdown.finalInventory?.evidence?.bytes) === finalInventoryBytes?.byteLength
  && shutdown.finalInventory?.evidence?.sha256 === finalInventorySha256);
if (!shutdownCheck.contractSupported) addIssue('SHUTDOWN_CONTRACT_INVALID', shutdownCheck.contract);
if (!shutdownCheck.v2BoundaryProtocolBound) addIssue('SHUTDOWN_V2_BOUNDARY_PROTOCOL_BINDING_INVALID');
if (!shutdownCheck.v2FinalInventoryBound) addIssue('SHUTDOWN_V2_FINAL_INVENTORY_BINDING_INVALID');
const closureIntent = closureIntentEvidence.document ?? {};
const finalizerIdentity = externalFinalizerIdentityEvidence.document ?? {};
const finalizerRunnerExit = externalFinalizerRunnerExitEvidence.document ?? {};
const finalizerLifecycle = externalFinalizerLifecycleEvidence.document ?? {};
const finalizerVerdict = externalFinalizerVerdictEvidence.document ?? {};
const signedFileValid = async (signature, expectedName) => {
  if (basename(String(signature?.path ?? '')) !== expectedName || !Number.isSafeInteger(finite(signature?.bytes))
    || !/^[0-9a-f]{64}$/.test(String(signature?.sha256 ?? ''))) return false;
  const bytes = await readFile(join(root, expectedName)).catch(() => null);
  return bytes !== null && bytes.byteLength === finite(signature.bytes)
    && createHash('sha256').update(bytes).digest('hex') === signature.sha256;
};
shutdownCheck.v3ExternalFinalizationBound = !shutdownCheck.v3 || (closureIntent.contract === 'agm-instrumentation-lifecycle-closure-intent.v2'
  && closureIntent.contractVersion === 2
  && closureIntent.runId === runId && closureIntent.phase === 'RUNNER_CLEANUP_COMPLETE_PENDING_EXTERNAL_FINALIZATION'
  && closureIntent.runnerMustExitBeforeFinalInventory === true && closureIntent.finalizerMustDeclareExactIdentity === true
  && Number.isSafeInteger(finite(closureIntent.runner?.pid)) && /^[0-9a-f]{64}$/.test(String(closureIntent.runner?.identitySha256 ?? ''))
  && await signedFileValid(closureIntent.windowIdentity?.signature, 'window.json')
  && await signedFileValid(closureIntent.inputs?.shutdown, 'shutdown.json')
  && await signedFileValid(closureIntent.inputs?.managedRoots, 'managed-process-roots.json')
  && await signedFileValid(closureIntent.inputs?.priorInventory, 'managed-process-tree-before-shutdown.json')
  && String(closureIntent.externalFinalizerSource?.path ?? '').replaceAll('\\', '/') === 'scripts/Invoke-InstrumentationLifecycleExternalFinalizer.ps1'
  && /^[0-9a-f]{64}$/.test(String(closureIntent.externalFinalizerSource?.sha256 ?? ''))
  && finalizerIdentity.contract === 'agm-instrumentation-external-finalizer-identity.v1' && finalizerIdentity.runId === runId
  && finalizerIdentity.role === 'EXTERNAL_FINALIZER' && /^[0-9a-f]{64}$/.test(String(finalizerIdentity.identitySha256 ?? ''))
  && finalInventoryEvidence.document?.externalFinalizer?.observed === true
  && finalInventoryEvidence.document?.externalFinalizer?.identitySha256 === finalizerIdentity.identitySha256
  && finalInventoryEvidence.document?.externalFinalizer?.genericObserverFiltering === false
  && finalizerRunnerExit.contract === 'agm-instrumentation-external-finalizer-runner-exit.v1'
  && finalizerRunnerExit.runId === runId && finalizerRunnerExit.runnerPid === finite(closureIntent.runner?.pid)
  && finalizerRunnerExit.expectedIdentitySha256 === closureIntent.runner?.identitySha256
  && finalizerRunnerExit.runnerPidAbsent === true && finalizerRunnerExit.runnerPidReuseDetected === false
  && epoch(finalInventoryEvidence.document?.captureStartedAt) >= epoch(finalizerRunnerExit.verifiedAt));
if (!shutdownCheck.v3ExternalFinalizationBound) addIssue('SHUTDOWN_V3_EXTERNAL_FINALIZATION_INVALID');
if (missingShutdownPids.length) addIssue('SHUTDOWN_PID_COVERAGE_INCOMPLETE', missingShutdownPids);
if (shutdownCheck.forcedStops > 0) addIssue('FORCED_STOP_USED', shutdownCheck.forcedStops);
if (shutdownCheck.aliveAfter > 0) addIssue('OBSERVER_OR_SERVER_PROCESS_ALIVE_AFTER_SHUTDOWN', shutdownCheck.aliveAfter);
if (shutdownCheck.declaredOrphans !== 0) addIssue('ZERO_ORPHANS_NOT_PROVEN', shutdownCheck.declaredOrphans);
if (shutdownCheck.nongraceful !== 0) addIssue('NONGRACEFUL_MANAGED_PROCESS_SHUTDOWN', shutdownCheck.nongraceful);
if (shutdownCheck.nonzeroOrMissingActualExitCodes.length) addIssue('MANAGED_PROCESS_ACTUAL_EXIT_CODE_INVALID', shutdownCheck.nonzeroOrMissingActualExitCodes);
if (!Array.isArray(shutdownCheck.cleanupErrors) || shutdownCheck.cleanupErrors.length) addIssue('CLEANUP_ERRORS_PRESENT', shutdownCheck.cleanupErrors);

function validateLiveTreeInventory(document, label, expectedLiveRootRoles, expectedPriorName = null, expectedPriorDescendants = null) {
  const tracked = document?.trackedClosure ?? {};
  const bindingRequired = document?.contract === 'agm-instrumentation-lifecycle-process-inventory.v2';
  const rootsAlive = Array.isArray(tracked.rootIdentityMatches) ? tracked.rootIdentityMatches : [];
  const descendants = Array.isArray(tracked.descendantMatches) ? tracked.descendantMatches : [];
  const result = {
    label,
    contract: document?.contract ?? null,
    contractValid: ['agm-instrumentation-lifecycle-process-inventory.v1', 'agm-instrumentation-lifecycle-process-inventory.v2'].includes(document?.contract),
    identityContractValid: !bindingRequired || document?.identityContract === 'agm-instrumentation-sanitized-process-identity.v2',
    querySuccessful: document?.queryStatus === 'SUCCESS',
    coverageStatus: document?.coverageStatus ?? null,
    coverageComplete: completeCoverageStatuses.has(document?.coverageStatus)
      && Array.isArray(document?.candidateCommandLinesUnavailable)
      && document.candidateCommandLinesUnavailable.length === 0
      && finite(document?.knownProtectedBackground?.unclassifiedUnavailableCount) === 0,
    identityBoundKnownProtectedCount: finite(document?.knownProtectedBackground?.identityBoundCount),
    p9Matches: finite(document?.matchCounts?.p9),
    trackedClosureRequested: tracked.requested === true,
    rootsRequested: finite(tracked.rootsRequested),
    rootIdentityMatches: rootsAlive.length,
    liveRootRoles: rootsAlive.map((record) => String(record.role)).sort(),
    descendantsObserved: descendants.length,
    priorInventoryName: typeof tracked.priorInventorySource === 'string' ? basename(tracked.priorInventorySource) : null,
    priorDescendantIdentities: finite(tracked.priorDescendantIdentities),
    runBindingSupported: Object.prototype.hasOwnProperty.call(Object(document), 'runId'),
    runBound: bindingRequired
      ? Object.prototype.hasOwnProperty.call(Object(document), 'runId') && document.runId === runId
      : !Object.prototype.hasOwnProperty.call(Object(document), 'runId') || document.runId === runId,
    phaseBindingSupported: Object.prototype.hasOwnProperty.call(Object(document), 'capturePhase'),
    phaseBound: bindingRequired
      ? Object.prototype.hasOwnProperty.call(Object(document), 'capturePhase') && document.capturePhase === label
      : !Object.prototype.hasOwnProperty.call(Object(document), 'capturePhase') || document.capturePhase === label,
  };
  result.valid = result.contractValid && result.identityContractValid && result.querySuccessful && result.coverageComplete && result.p9Matches === 0
    && result.trackedClosureRequested && result.rootsRequested === 4
    && result.rootIdentityMatches === expectedLiveRootRoles.length
    && JSON.stringify(result.liveRootRoles) === JSON.stringify([...expectedLiveRootRoles].sort())
    && result.runBound && result.phaseBound
    && (expectedPriorName === null || (result.priorInventoryName === expectedPriorName
      && result.priorDescendantIdentities === expectedPriorDescendants));
  if (!result.valid) addIssue('LIVE_MANAGED_PROCESS_TREE_INVENTORY_INVALID', result);
  return result;
}
const beforeWindowTreeCheck = validateLiveTreeInventory(
  beforeWindowInventoryEvidence.document,
  'BEFORE_WINDOW',
  ['API', 'CLIENT', 'HOST_SAMPLER', 'PROCESS_SAMPLER'],
);
const beforeWindowDescendants = beforeWindowTreeCheck.descendantsObserved;
const preShutdownTreeCheck = validateLiveTreeInventory(
  preShutdownInventoryEvidence.document,
  'BEFORE_SHUTDOWN',
  ['API', 'HOST_SAMPLER', 'PROCESS_SAMPLER'],
  'managed-process-tree-before-window.json',
  beforeWindowDescendants,
);

const inventory = finalInventoryEvidence.document;
const earliestManagedRootEpoch = Math.min(...managedRoots.map((rootRecord) => epoch(rootRecord.startTimeUtc)).filter(Number.isFinite));
const temporalLineageRejections = [];
for (const [phase, document] of [
  ['BEFORE_WINDOW', beforeWindowInventoryEvidence.document],
  ['BEFORE_SHUTDOWN', preShutdownInventoryEvidence.document],
  ['AFTER_SHUTDOWN', inventory],
]) {
  const descendants = Array.isArray(document?.trackedClosure?.descendantMatches)
    ? document.trackedClosure.descendantMatches
    : [];
  for (const descendant of descendants) {
    const createdAt = epoch(descendant.creationAt);
    if (Number.isFinite(earliestManagedRootEpoch) && createdAt !== null && createdAt < earliestManagedRootEpoch) {
      const rejection = {
        phase,
        pid: finite(descendant.pid),
        parentPid: finite(descendant.parentPid),
        imageName: descendant.imageName ?? null,
        creationAt: descendant.creationAt ?? null,
        predatesEarliestManagedRootSeconds: round((earliestManagedRootEpoch - createdAt) / 1000),
        derivedClassification: 'TEMPORALLY_IMPOSSIBLE_DESCENDANT / STALE_PARENT_PID_OR_PID_REUSE',
        rawEvidencePreserved: true,
      };
      temporalLineageRejections.push(rejection);
      addIssue('TEMPORALLY_IMPOSSIBLE_DESCENDANT', rejection);
    }
  }
}
const inventoryMatches = Array.isArray(inventory?.matches) ? inventory.matches : [];
const orphanObserverRoles = new Set(['HOST_SAMPLER', 'PROCESS_SAMPLER', 'CONTROLLED_HOST_SAMPLER', 'REAL_BASIC_CLIENT', 'LIFECYCLE_CLIENT']);
const orphanObserverMatches = inventoryMatches.filter((match) => Array.isArray(match.roles)
  && match.roles.some((role) => orphanObserverRoles.has(String(role))));
const trackedClosure = inventory?.trackedClosure ?? null;
const trackedRootIdentityMatches = Array.isArray(trackedClosure?.rootIdentityMatches) ? trackedClosure.rootIdentityMatches : [];
const trackedDescendantMatches = Array.isArray(trackedClosure?.descendantMatches) ? trackedClosure.descendantMatches : [];
const inventoryCheck = inventory ? {
  present: true,
  contract: inventory.contract ?? null,
  contractValid: ['agm-instrumentation-lifecycle-process-inventory.v1', 'agm-instrumentation-lifecycle-process-inventory.v2'].includes(inventory.contract),
  identityContractValid: inventory.contract !== 'agm-instrumentation-lifecycle-process-inventory.v2'
    || inventory.identityContract === 'agm-instrumentation-sanitized-process-identity.v2',
  captureSucceeded: inventory.queryStatus === 'SUCCESS' && inventory.error == null,
  coverageStatus: inventory.coverageStatus ?? null,
  coverageComplete: completeCoverageStatuses.has(inventory.coverageStatus)
    && Array.isArray(inventory.candidateCommandLinesUnavailable)
    && inventory.candidateCommandLinesUnavailable.length === 0
    && finite(inventory.knownProtectedBackground?.unclassifiedUnavailableCount) === 0,
  identityBoundKnownProtectedCount: finite(inventory.knownProtectedBackground?.identityBoundCount),
  p9Matches: finite(pick(inventory, ['matchCounts.p9', 'summary.p9Matches', 'p9Matches']))
    ?? (Array.isArray(inventory.p9Processes) ? inventory.p9Processes.length : null),
  observerMatchesTotal: finite(pick(inventory, ['matchCounts.observer', 'summary.observerMatches', 'observerMatches'])),
  orphanObserverMatches: orphanObserverMatches.length,
  orphanObserverPids: orphanObserverMatches.map((match) => finite(match.pid)).filter(Number.isFinite),
  trackedClosureRequested: trackedClosure?.requested === true,
  trackedRootsRequested: finite(trackedClosure?.rootsRequested),
  priorDescendantIdentities: finite(trackedClosure?.priorDescendantIdentities),
  trackedRootIdentityMatches: trackedRootIdentityMatches.length,
  trackedDescendantMatches: trackedDescendantMatches.length,
  trackedCurrentMatches: finite(trackedClosure?.currentTrackedMatches),
  trackedClosureComplete: trackedClosure?.complete === true,
  trackedPriorInventoryName: typeof trackedClosure?.priorInventorySource === 'string'
    ? basename(trackedClosure.priorInventorySource)
    : null,
  trackedCurrentPids: [...trackedRootIdentityMatches, ...trackedDescendantMatches]
    .map((match) => finite(match.pid)).filter(Number.isFinite),
  runBindingSupported: Object.prototype.hasOwnProperty.call(Object(inventory), 'runId'),
  runBound: inventory.contract === 'agm-instrumentation-lifecycle-process-inventory.v2'
    ? Object.prototype.hasOwnProperty.call(Object(inventory), 'runId') && inventory.runId === runId
    : !Object.prototype.hasOwnProperty.call(Object(inventory), 'runId') || inventory.runId === runId,
  phaseBindingSupported: Object.prototype.hasOwnProperty.call(Object(inventory), 'capturePhase'),
  phaseBound: inventory.contract === 'agm-instrumentation-lifecycle-process-inventory.v2'
    ? Object.prototype.hasOwnProperty.call(Object(inventory), 'capturePhase') && inventory.capturePhase === 'AFTER_SHUTDOWN'
    : !Object.prototype.hasOwnProperty.call(Object(inventory), 'capturePhase') || inventory.capturePhase === 'AFTER_SHUTDOWN',
} : {
  present: false,
  captureSucceeded: false,
  coverageStatus: null,
  coverageComplete: false,
  identityBoundKnownProtectedCount: null,
  p9Matches: null,
  observerMatchesTotal: null,
  orphanObserverMatches: null,
  orphanObserverPids: [],
  trackedClosureRequested: false,
  trackedRootsRequested: null,
  priorDescendantIdentities: null,
  trackedRootIdentityMatches: null,
  trackedDescendantMatches: null,
  trackedCurrentMatches: null,
  trackedClosureComplete: false,
  trackedPriorInventoryName: null,
  trackedCurrentPids: [],
  runBindingSupported: false,
  runBound: false,
  phaseBindingSupported: false,
  phaseBound: false,
};
if (!inventoryCheck.present) addCaution('FINAL_PROCESS_INVENTORY_FILE_NOT_FOUND');
else {
  if (!inventoryCheck.contractValid || !inventoryCheck.identityContractValid) addIssue('FINAL_PROCESS_INVENTORY_CONTRACT_INVALID', inventoryCheck.contract);
  if (!inventoryCheck.captureSucceeded) addIssue('FINAL_PROCESS_INVENTORY_UNRELIABLE');
  if (!inventoryCheck.runBound || !inventoryCheck.phaseBound) addIssue('FINAL_PROCESS_INVENTORY_RUN_OR_PHASE_BINDING_INVALID');
  if (!inventoryCheck.coverageComplete) addIssue('FINAL_PROCESS_INVENTORY_VISIBILITY_INCOMPLETE');
  if (inventoryCheck.p9Matches !== 0) addIssue('P9_PROCESS_MATCH_AFTER_WINDOW', inventoryCheck.p9Matches);
  if (inventoryCheck.observerMatchesTotal !== 0) addIssue('OBSERVER_PROCESS_MATCH_AFTER_WINDOW', inventoryCheck.observerMatchesTotal);
  if (inventoryCheck.orphanObserverMatches !== 0) addIssue('OBSERVER_PROCESS_MATCH_AFTER_WINDOW', inventoryCheck.orphanObserverPids);
  if (!inventoryCheck.trackedClosureRequested || inventoryCheck.trackedRootsRequested !== 4) {
    addIssue('MANAGED_PROCESS_TREE_TRACKING_INCOMPLETE', inventoryCheck.trackedRootsRequested);
  }
  if (!inventoryCheck.trackedClosureComplete || inventoryCheck.trackedCurrentMatches !== 0) {
    addIssue('MANAGED_PROCESS_OR_DESCENDANT_ALIVE_AFTER_SHUTDOWN', inventoryCheck.trackedCurrentPids);
  }
  if (inventoryCheck.trackedPriorInventoryName !== 'managed-process-tree-before-shutdown.json'
    || inventoryCheck.priorDescendantIdentities !== preShutdownTreeCheck.descendantsObserved) {
    addIssue('POST_SHUTDOWN_DESCENDANT_LINEAGE_CHAIN_INVALID', {
      priorInventory: inventoryCheck.trackedPriorInventoryName,
      priorIdentities: inventoryCheck.priorDescendantIdentities,
      expectedPriorIdentities: preShutdownTreeCheck.descendantsObserved,
    });
  }
}

const custodyChecks = {
  p9Stopped: pick(custody, ['p9', 'operational.p9']) === 'STOPPED',
  killSwitchActive: pick(custody, ['killSwitch', 'operational.killSwitch']) === 'ACTIVE',
  officialSloUnchanged: finite(pick(custody, ['officialBasicSloMs', 'basicSloMs'])) === OFFICIAL_BASIC_SLO_MS
    && pick(custody, ['officialBasicSloUnchanged', 'basicSloUnchanged']) === true,
  officialSoakNotRestarted: pick(custody, ['officialSoakRestarted', 'soakRestarted']) === false,
  noP9Traffic: pick(custody, ['p9TrafficGenerated', 'constraints.p9Traffic']) === false,
  noFaultInjection: pick(custody, ['faultInjection', 'constraints.faultInjection']) === false,
  noDeploy: pick(custody, ['deployPerformed', 'constraints.deploy']) === false,
  noPostgresRestart: pick(custody, ['postgresRestarted', 'constraints.postgresRestart']) === false,
  noInfrastructureChange: pick(custody, ['infrastructureChanges', 'constraints.infrastructureChanges']) === 0,
  oneWindow: pick(custody, ['singleWindow', 'window.singleWindow']) === true,
};
for (const [name, satisfied] of Object.entries(custodyChecks)) {
  if (!satisfied) addIssue('CUSTODY_CONSTRAINT_NOT_SATISFIED', name);
}

addCaution('HOST_TELEMETRY_IS_FIVE_SECOND_CONTEXT_NOT_REQUEST_EXACT');
addCaution('SERVER_PHASE_TOTALS_MAY_OVERLAP_AND_ARE_NOT_ADDITIVE');
addCaution('OBSERVER_CPU_PERCENT_IS_SAMPLER_ONLY_CLIENT_AND_SERVER_ARE_CONTEXTUAL');
addCaution('P9_EXTERNAL_PROCESS_CUSTODY_USES_BOUNDARY_SNAPSHOTS_NOT_CONTINUOUS_PROCESS_EVENTS');
addCaution('DESCENDANT_CUSTODY_USES_CAPTURED_WINDOWS_PARENT_LINEAGE_SNAPSHOTS');

const durations = requests.map((request) => finite(request.durationMs)).filter(Number.isFinite);
const requestSummary = {
  requests: requests.length,
  timeouts: requests.filter((request) => request.timedOut === true).length,
  latencyBreachesOver3000Ms: requests.filter((request) => finite(request.durationMs) !== null && finite(request.durationMs) > OFFICIAL_BASIC_SLO_MS).length,
  acceptedStatusResponses: requests.filter((request) => request.statusAccepted === true).length,
  statusOrTransportFailures: requests.filter((request) => request.statusAccepted !== true).length,
  p50Ms: percentile(durations, 0.5),
  p95Ms: percentile(durations, 0.95),
  p99Ms: percentile(durations, 0.99),
  maxMs: percentile(durations, 1),
  correlatedRequests: correlations.filter((record) => record.correlated).length,
  uncorrelatedRequests: correlations.filter((record) => !record.correlated).length,
};

const analysis = {
  contract: 'agm-instrumentation-lifecycle-cycle-analysis.v1',
  generatedAt: new Date().toISOString(),
  status: OWNER_REVIEW_STATUS,
  decisionAuthority: 'PRODUCT_OWNER',
  run: {
    directory: basename(root),
    runId,
    formalWindow: {
      startedAt: Number.isFinite(windowStart) ? new Date(windowStart).toISOString() : null,
      completedAt: Number.isFinite(windowEnd) ? new Date(windowEnd).toISOString() : null,
      requestedDurationMs,
      observedDurationMs,
    },
    p9: 'STOPPED',
    officialBasicSloMs: OFFICIAL_BASIC_SLO_MS,
    officialBasicSloUnchanged: true,
    officialSoakRestarted: false,
  },
  evidenceFiles: {
    client: clientEvidence.name,
    clientEvents: clientEventsEvidence.name,
    server: serverEvidence.name,
    host: hostEvidence.name,
    process: processEvidence.name,
    authorization: authorizationEvidence.name,
    custody: custodyEvidence.name,
    knownProtectedBackground: knownProtectedBackgroundEvidence.name,
    preflightInventory: preflightInventoryEvidence.name,
    readiness: readinessEvidence.name,
    runnerError: runnerErrorEvidence.present ? runnerErrorEvidence.name : null,
    hostLifecycle: hostLifecycleEvidence.name,
    processLifecycle: processLifecycleEvidence.name,
    observerOverhead: overheadEvidence.name,
    shutdown: shutdownEvidence.name,
    managedRoots: managedRootsEvidence.name,
    beforeWindowProcessTree: beforeWindowInventoryEvidence.name,
    beforeShutdownProcessTree: preShutdownInventoryEvidence.name,
    finalInventory: finalInventoryEvidence.name,
    samplerBoundary: samplerBoundaryEvidence.present ? samplerBoundaryEvidence.name : null,
    samplerRelease: samplerReleaseEvidence.present ? samplerReleaseEvidence.name : null,
    hostBoundaryReady: hostBoundaryReadyEvidence.present ? hostBoundaryReadyEvidence.name : null,
    processBoundaryReady: processBoundaryReadyEvidence.present ? processBoundaryReadyEvidence.name : null,
  },
  requestSummary,
  clientEvidenceIntegrity: clientEventIntegrity,
  clientScheduling: schedulingCoverage,
  correlation: {
    requests: correlations.length,
    fullyCorrelated: correlations.filter((record) => record.correlated).length,
    incomplete: correlations.filter((record) => !record.correlated).length,
    records: correlations,
  },
  coverage: {
    serverRuntime: runtimeCoverage,
    serverRuntimeSummary,
    host: hostCoverage,
    processCadence,
  },
  lifecycle: {
    managedRoots: managedRootsCheck,
    readiness: readinessCheck,
    hostSampler: hostLifecycleCheck,
    processSampler: processLifecycleCheck,
    boundaryReleaseProtocol: boundaryProtocolCheck,
    telemetryIdentity: {
      host: hostTelemetryIntegrity,
      process: processTelemetryIntegrity,
    },
    observerOverhead: overheadCheck,
    shutdown: shutdownCheck,
    beforeWindowProcessTree: beforeWindowTreeCheck,
    beforeShutdownProcessTree: preShutdownTreeCheck,
    finalInventory: inventoryCheck,
    temporalLineageRejections,
  },
  constraints: {
    client: clientConstraintChecks,
    custody: custodyChecks,
  },
  evidenceAssessment: {
    issues: issues.length,
    cautions: cautions.length,
    reviewableWithoutMissingRequiredEvidence: issues.length === 0,
  },
  issues,
  cautions,
  attributionBoundary: {
    timeoutRootCauseDeterminedByThisGate: false,
    observerLifecycleAndOverheadOnly: true,
    causalClaim: 'NONE',
  },
  nextGate: OWNER_REVIEW_STATUS,
};

await writeFile(output, `${JSON.stringify(analysis, null, 2)}\n`, { flag: 'wx' });
console.log(`${OWNER_REVIEW_STATUS} / ${output}`);
if (issues.length) process.exitCode = 2;
