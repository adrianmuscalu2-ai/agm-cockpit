#!/usr/bin/env node

/**
 * Analyze naturally occurring Basic timeouts captured by the accepted
 * server-correlated diagnostic preload.
 *
 * CLI:
 *   node scripts/analyze-real-basic-timeouts.mjs <run-directory>
 *     [--slo-ms 3000]
 *     [--server-telemetry server-telemetry.jsonl]
 *     [--custody custody.json]
 *     [--host-telemetry host-telemetry.jsonl|host-telemetry.csv]
 *     [--process-telemetry process-telemetry.jsonl]
 *     [--host-timezone-metadata host-telemetry-metadata.json]
 *
 * Input assumptions:
 *   - <run-directory>/batch-*.json contains an array, or a top-level
 *     `requests`, `samples`, `cases`, or `records` array.
 *   - Every request counted as official explicitly sets one of:
 *     `countsTowardOfficialSlo=true`, `sampleType="OFFICIAL"`,
 *     `kind="OFFICIAL"`, or `official=true`.
 *   - A timeout is explicit (`timedOut`/`timeout`, or an error/outcome whose
 *     name contains Timeout or Abort). A slow 200 response is not silently
 *     converted into a timeout by this analyzer.
 *   - Client records expose equal, non-empty `requestId` and `traceId` values.
 *   - Client batches carry `runId`; when the probe format omits it, a valid
 *     custody.json with the same server `runId` is required as the run-boundary
 *     anchor. Exact trace pairing and timestamps are still verified.
 *   - Server telemetry follows agm-server-correlated-instrumentation.v1 and
 *     contains request.receive, request.summary, and
 *     request.runtime-association for every official client request.
 *   - Host telemetry is optional. JSON, JSONL, and Typeperf CSV are accepted.
 *     Local CSV timestamps require timezone metadata or a PDH UTC bias.
 *   - Process telemetry is optional and, when present, must use contract
 *     agm-real-basic-process-sample.v1. It is contextual background evidence
 *     only and can never establish root cause by itself.
 *
 * The classifier is deliberately blind: injected-fault labels are rejected,
 * never consumed as classification input. Missing or conflicting evidence
 * resolves to NO_SINGLE_CAUSE_PROVEN.
 */

import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';

const CAUSAL_CLASSIFICATIONS = new Set([
  'EVENT_LOOP_RUNTIME_BUSY_CORRELATED',
  'CPU_PROCESS_SCHEDULING_CORRELATED',
  'DB_NETWORK_PATH_CORRELATED',
  'CLIENT_HARNESS_TIMEOUT_ARTIFACT',
  'GC_PAUSE_CORRELATED',
  'MEMORY_PRESSURE_CORRELATED',
  'IO_CONTENTION_CORRELATED',
]);

const KNOWN_CONTROL_OPERATIONS = new Set([
  'event-loop-stall-control',
  'gc-pressure-control',
  'memory-pressure-control',
  'filesystem-contention-control',
]);

function usage() {
  return [
    'Usage: node scripts/analyze-real-basic-timeouts.mjs <run-directory>',
    '  [--slo-ms 3000]',
    '  [--server-telemetry server-telemetry.jsonl]',
    '  [--custody custody.json]',
    '  [--host-telemetry host-telemetry.jsonl|host-telemetry.csv]',
    '  [--process-telemetry process-telemetry.jsonl]',
    '  [--host-timezone-metadata host-telemetry-metadata.json]',
  ].join('\n');
}

function parseCli(argv) {
  const options = {
    root: null,
    sloMs: 3000,
    serverTelemetry: 'server-telemetry.jsonl',
    custody: 'custody.json',
    hostTelemetry: null,
    processTelemetry: 'process-telemetry.jsonl',
    hostTimezoneMetadata: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') return { ...options, help: true };
    if (value === '--slo-ms') options.sloMs = Number(argv[++index]);
    else if (value === '--server-telemetry') options.serverTelemetry = argv[++index];
    else if (value === '--custody') options.custody = argv[++index];
    else if (value === '--host-telemetry') options.hostTelemetry = argv[++index];
    else if (value === '--process-telemetry') options.processTelemetry = argv[++index];
    else if (value === '--host-timezone-metadata') options.hostTimezoneMetadata = argv[++index];
    else if (value.startsWith('--')) throw new Error(`UNKNOWN_OPTION: ${value}`);
    else if (!options.root) options.root = value;
    else throw new Error(`UNEXPECTED_ARGUMENT: ${value}`);
  }
  if (!options.root) throw new Error(`RUN_DIRECTORY_REQUIRED\n${usage()}`);
  if (!Number.isFinite(options.sloMs) || options.sloMs !== 3000) throw new Error('OFFICIAL_BASIC_SLO_MUST_REMAIN_3000_MS');
  options.root = resolve(options.root);
  return options;
}

const cli = parseCli(process.argv.slice(2));
if (cli.help) {
  console.log(usage());
  process.exit(0);
}

const integrityErrors = [];
const integrityWarnings = [];
const addError = (message) => { if (!integrityErrors.includes(message)) integrityErrors.push(message); };
const addWarning = (message) => { if (!integrityWarnings.includes(message)) integrityWarnings.push(message); };
const finite = (value) => {
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(number) ? number : null;
};
const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);
const isoEpoch = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : null;
};
const round = (value, digits = 3) => {
  if (!Number.isFinite(value)) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
};
const sum = (values) => values.reduce((total, value) => total + (finite(value) ?? 0), 0);
const maximum = (values) => {
  const numbers = values.map(finite).filter((value) => value !== null);
  return numbers.length ? Math.max(...numbers) : null;
};
const minimum = (values) => {
  const numbers = values.map(finite).filter((value) => value !== null);
  return numbers.length ? Math.min(...numbers) : null;
};
const asText = (value) => value === undefined || value === null ? null : String(value);
const normalizedErrorName = (value) => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return asText(value.name ?? value.code ?? value.type);
  return null;
};
const pathFromRoot = (root, value) => value && isAbsolute(value) ? value : join(root, value ?? '');

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function extractClientArray(document) {
  if (Array.isArray(document)) return document;
  for (const key of ['requests', 'samples', 'cases', 'records']) {
    if (Array.isArray(document?.[key])) return document[key];
  }
  if (Array.isArray(document?.batch?.requests)) return document.batch.requests;
  return null;
}

function explicitOfficial(record) {
  return record.countsTowardOfficialSlo === true
    || record.officialSloIncluded === true
    || String(record.sampleType ?? '').toUpperCase() === 'OFFICIAL'
    || String(record.kind ?? '').toUpperCase() === 'OFFICIAL'
    || record.official === true;
}

function explicitTimeout(record, errorName) {
  const outcome = [errorName, record.outcome, record.failureReason, record.result]
    .filter(Boolean).join(' ');
  return record.timedOut === true
    || record.timeout === true
    || record.isTimeout === true
    || /timeout|timed\s*out|abort/i.test(outcome);
}

function clientFaultMarker(record) {
  const scenario = String(record.scenario ?? '').toUpperCase();
  return record.faultInjected === true
    || record.diagnosticFault != null
    || (record.fault != null && record.fault !== '')
    || record.headers?.['x-agm-diagnostic-fault'] != null
    || String(record.sampleType ?? '').toUpperCase() === 'DIAGNOSTIC_CONTROL'
    || /EVENT_LOOP_STALL|DB_NETWORK_DELAY|GC_PAUSE|MEMORY_PRESSURE|IO_CONTENTION|CPU_CONTENTION/.test(scenario);
}

function normalizeClientTransport(record) {
  const transport = record.clientTransport;
  if (!transport || typeof transport !== 'object') return { present: false };
  const timestamp = (key) => asText(firstDefined(transport.timestamps?.[key], record.timestamps?.[key]));
  const epoch = (key) => finite(transport.epochMs?.[key]);
  return {
    present: true,
    contract: asText(transport.contract),
    traceId: asText(transport.traceId),
    requestId: asText(transport.requestId),
    headerCorrelation: {
      traceIdMatched: transport.headerCorrelation?.traceIdMatched ?? null,
      requestIdMatched: transport.headerCorrelation?.requestIdMatched ?? null,
      sameRequestAndTraceId: transport.headerCorrelation?.sameRequestAndTraceId ?? null,
    },
    timestamps: {
      clientStartedAt: timestamp('clientStartedAt'),
      requestCreateAt: timestamp('requestCreateAt'),
      bodySentAt: timestamp('bodySentAt'),
      responseHeadersAt: timestamp('responseHeadersAt'),
      trailersAt: timestamp('trailersAt'),
      errorAt: timestamp('errorAt'),
    },
    epochMs: {
      clientStartedAt: epoch('clientStartedAt'),
      requestCreateAt: epoch('requestCreateAt'),
      bodySentAt: epoch('bodySentAt'),
      responseHeadersAt: epoch('responseHeadersAt'),
      trailersAt: epoch('trailersAt'),
      errorAt: epoch('errorAt'),
    },
    reportedDurationsMs: {
      clientStartToRequestCreate: finite(transport.durationsMs?.clientStartToRequestCreate),
      requestCreateToBodySent: finite(transport.durationsMs?.requestCreateToBodySent),
      bodySentToResponseHeaders: finite(transport.durationsMs?.bodySentToResponseHeaders),
      requestCreateToResponseHeaders: finite(transport.durationsMs?.requestCreateToResponseHeaders),
      responseHeadersToTrailers: finite(transport.durationsMs?.responseHeadersToTrailers),
    },
    transportError: transport.transportError ?? null,
    captureFinalizedAt: asText(transport.captureFinalizedAt),
  };
}

function normalizeClientRecord(record, sourceFile, sourceIndex, batchRunId) {
  const error = normalizedErrorName(record.error);
  const durationMs = finite(firstDefined(record.durationMs, record.latencyMs, record.elapsedMs, record.clientDurationMs));
  const status = finite(firstDefined(record.status, record.statusCode));
  const traceId = asText(record.traceId);
  const requestId = asText(record.requestId);
  const official = explicitOfficial(record);
  const timedOut = explicitTimeout(record, error);
  return {
    sourceFile,
    sourceIndex,
    batchRunId: asText(firstDefined(record.runId, batchRunId)),
    id: asText(firstDefined(record.id, record.sampleId, `${basename(sourceFile)}#${sourceIndex + 1}`)),
    sequence: finite(record.sequence),
    phase: asText(record.phase),
    iteration: finite(record.iteration),
    kind: asText(record.kind ?? record.sampleType),
    layer: asText(record.layer),
    traceId,
    requestId,
    endpoint: asText(firstDefined(record.endpoint, record.url, record.target, record.path)),
    clientStartedAt: asText(firstDefined(record.clientStartedAt, record.startedAt, record.requestStartedAt, record.timestamps?.clientStartedAt)),
    clientHeadersAt: asText(firstDefined(record.clientHeadersAt, record.headersReceivedAt, record.serverHeadersAt, record.timestamps?.clientHeadersAt)),
    clientBodyAt: asText(firstDefined(record.clientBodyAt, record.bodyReceivedAt, record.clientReceivedAt, record.responseAt, record.timestamps?.clientBodyAt)),
    clientCompletedAt: asText(firstDefined(record.clientCompletedAt, record.completedAt, record.finishedAt, record.timestamps?.clientCompletedAt)),
    durationMs,
    status,
    error,
    official,
    timedOut,
    officialTimeout: official && timedOut,
    clientTransport: normalizeClientTransport(record),
    faultInjected: clientFaultMarker(record),
    clientEventLoopLagMaxMs: finite(firstDefined(
      record.clientEventLoopLagMaxMs,
      record.clientEventLoopDelayMs?.max,
      record.client?.eventLoopLagMaxMs,
      record.clientRuntime?.eventLoopLagMaxMs,
      record.clientTelemetry?.eventLoopScheduling?.driftMaxMs,
    )),
    clientIntervalDriftMaxMs: finite(firstDefined(record.clientIntervalDriftMaxMs, record.client?.intervalDriftMaxMs, record.clientTelemetry?.eventLoopScheduling?.driftMaxMs)),
    echoedTraceId: asText(record.echoedTraceId),
    echoedRequestId: asText(record.echoedRequestId),
  };
}

async function loadClientBatches(root) {
  const names = (await readdir(root)).filter((name) => /^batch-\d+\.json$/i.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (!names.length) addError('NO_BATCH_JSON_FILES');
  const records = [];
  const batches = [];
  for (const name of names) {
    const path = join(root, name);
    try {
      const document = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
      const items = extractClientArray(document);
      if (!items) {
        addError(`${name}: CLIENT_RECORD_ARRAY_MISSING`);
        continue;
      }
      const batchRunId = asText(document?.runId ?? document?.metadata?.runId);
      batches.push({ file: name, records: items.length, runId: batchRunId });
      items.forEach((item, index) => records.push(normalizeClientRecord(item, path, index, batchRunId)));
    } catch (error) {
      addError(`${name}: INVALID_JSON (${error instanceof Error ? error.message : 'UNKNOWN'})`);
    }
  }
  return { names, batches, records };
}

async function loadJsonLines(path, label) {
  const lines = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '').split(/\r?\n/);
  const records = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim()) continue;
    try { records.push(JSON.parse(lines[index].replace(/^\uFEFF/, ''))); }
    catch (error) { addError(`${label}: INVALID_JSON_LINE_${index + 1}`); }
  }
  return records;
}

async function loadCustody(root, value) {
  const path = pathFromRoot(root, value);
  if (!await exists(path)) return { present: false, path, document: null };
  try {
    const document = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
    return { present: true, path, document };
  } catch (error) {
    addError(`CUSTODY_INVALID_JSON (${error instanceof Error ? error.message : 'UNKNOWN'})`);
    return { present: true, path, document: null };
  }
}

async function loadShortWindowAuthorization(root) {
  const path = join(root, 'short-window-authorization.json');
  if (!await exists(path)) return { present: false, path, document: null };
  try {
    const document = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
    return { present: true, path, document };
  } catch (error) {
    addError(`SHORT_WINDOW_AUTHORIZATION_INVALID_JSON (${error instanceof Error ? error.message : 'UNKNOWN'})`);
    return { present: true, path, document: null };
  }
}

function resolveDiagnosticPolicy(custody, authorization) {
  const custodyPolicy = custody.document?.batchPolicy ?? {};
  const authorizationDocument = authorization.document;
  const authorizationThreshold = finite(authorizationDocument?.diagnosticThresholdMs);
  const custodyThreshold = finite(custodyPolicy.diagnosticThresholdMs);
  const diagnosticThresholdMs = authorizationThreshold ?? custodyThreshold ?? 2000;
  if (diagnosticThresholdMs !== 2000) addError('DIAGNOSTIC_THRESHOLD_MUST_REMAIN_2000_MS');
  if (authorizationThreshold !== null && custodyThreshold !== null && authorizationThreshold !== custodyThreshold) {
    addError('DIAGNOSTIC_THRESHOLD_AUTHORIZATION_CUSTODY_MISMATCH');
  }
  if (authorization.present) {
    if (!authorizationDocument) return { diagnosticThresholdMs: 2000, authorizedShortWindow: true, singleWindow: false };
    if (authorizationDocument.singleWindow !== true) addError('SHORT_WINDOW_SINGLE_WINDOW_NOT_TRUE');
    if (finite(authorizationDocument.officialBasicSloMs) !== 3000) addError('SHORT_WINDOW_OFFICIAL_SLO_NOT_3000_MS');
    if (finite(authorizationDocument.maxBatches) !== 10) addError('SHORT_WINDOW_MAX_BATCHES_NOT_10');
    if (finite(authorizationDocument.maxOfficialRequests) !== 1800) addError('SHORT_WINDOW_MAX_REQUESTS_NOT_1800');
    if (authorizationDocument.automaticExtension !== false) addError('SHORT_WINDOW_AUTOMATIC_EXTENSION_NOT_FALSE');
    if (authorizationDocument.faultInjection !== false) addError('SHORT_WINDOW_FAULT_INJECTION_NOT_FALSE');
    if (authorizationDocument.probeProfile !== 'NATURAL_P9_OFF') addError('SHORT_WINDOW_PROFILE_NOT_NATURAL_P9_OFF');
    if (custodyPolicy.probeProfile !== 'NATURAL_P9_OFF') addError('CUSTODY_PROFILE_NOT_NATURAL_P9_OFF');
    if (authorizationThreshold !== 2000) addError('SHORT_WINDOW_DIAGNOSTIC_THRESHOLD_NOT_2000_MS');
    if (custodyThreshold !== 2000) addError('CUSTODY_DIAGNOSTIC_THRESHOLD_NOT_2000_MS');
    if (custodyPolicy.stopOnFirstDiagnosticEvent !== true) addError('CUSTODY_STOP_ON_FIRST_DIAGNOSTIC_EVENT_NOT_TRUE');
  }
  return {
    diagnosticThresholdMs,
    authorizedShortWindow: authorization.present,
    singleWindow: authorizationDocument?.singleWindow === true,
    maxBatches: finite(authorizationDocument?.maxBatches ?? custodyPolicy.maxBatches),
    stopOnFirstDiagnosticEvent: custodyPolicy.stopOnFirstDiagnosticEvent === true,
  };
}

async function loadProcessTelemetry(root, value) {
  const path = pathFromRoot(root, value);
  if (!await exists(path)) return { present: false, path, samples: [], errors: [] };
  const lines = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '').split(/\r?\n/);
  const samples = [];
  const errors = [];
  const fail = (message) => { errors.push(message); addError(message); };
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim()) continue;
    let record;
    try { record = JSON.parse(lines[index].replace(/^\uFEFF/, '')); }
    catch { fail(`PROCESS_TELEMETRY_INVALID_JSON_LINE_${index + 1}`); continue; }
    if (record?.contract !== 'agm-real-basic-process-sample.v1') {
      fail(`PROCESS_TELEMETRY_CONTRACT_INVALID_LINE_${index + 1}`);
      continue;
    }
    const windowStartEpoch = isoEpoch(record.windowStartedAt);
    const captureCompletedEpoch = isoEpoch(record.captureCompletedAt);
    if (windowStartEpoch === null || captureCompletedEpoch === null || captureCompletedEpoch < windowStartEpoch) {
      fail(`PROCESS_TELEMETRY_WINDOW_INVALID_LINE_${index + 1}`);
      continue;
    }
    if (!Array.isArray(record.topCpuProcesses)) {
      fail(`PROCESS_TELEMETRY_TOP_PROCESSES_INVALID_LINE_${index + 1}`);
      continue;
    }
    const topCpuProcesses = [];
    let processEntryInvalid = false;
    for (const process of record.topCpuProcesses) {
      const pid = finite(process?.pid);
      const processName = asText(process?.processName);
      const cpuPercentOfOneCore = finite(process?.cpuPercentOfOneCore);
      if (pid === null || !processName || cpuPercentOfOneCore === null || cpuPercentOfOneCore < 0) {
        processEntryInvalid = true;
        continue;
      }
      topCpuProcesses.push({ pid, processName, cpuPercentOfOneCore: round(cpuPercentOfOneCore) });
    }
    if (processEntryInvalid) fail(`PROCESS_TELEMETRY_PROCESS_ENTRY_INVALID_LINE_${index + 1}`);
    samples.push({
      sequence: finite(record.sequence),
      windowStartedAt: record.windowStartedAt,
      captureCompletedAt: record.captureCompletedAt,
      windowStartEpoch,
      captureCompletedEpoch,
      wallSeconds: finite(record.wallSeconds),
      topCpuProcesses,
    });
  }
  const sequences = samples.map((sample) => sample.sequence).filter((value) => value !== null);
  if (sequences.length !== samples.length || new Set(sequences).size !== sequences.length) fail('PROCESS_TELEMETRY_SEQUENCE_INVALID_OR_DUPLICATE');
  samples.sort((left, right) => left.windowStartEpoch - right.windowStartEpoch);
  return { present: true, path, samples, errors };
}

function uniqueNonNull(records, key) {
  return [...new Set(records.map((record) => record?.[key]).filter((value) => value !== undefined && value !== null && value !== ''))];
}

function validateServerIdentity(telemetry, clientRecords) {
  if (!telemetry.length) addError('SERVER_TELEMETRY_EMPTY');
  for (const key of ['runId', 'pid', 'processInstance']) {
    if (telemetry.some((entry) => entry?.[key] === undefined || entry?.[key] === null || entry?.[key] === '')) {
      addError(`SERVER_TELEMETRY_${key.toUpperCase()}_MISSING`);
    }
    if (uniqueNonNull(telemetry, key).length !== 1) addError(`SERVER_TELEMETRY_${key.toUpperCase()}_NOT_UNIQUE`);
  }
  const statuses = telemetry.filter((entry) => entry.type === 'instrumentation.status');
  if (statuses.length !== 1) addError(`INSTRUMENTATION_STATUS_COUNT_${statuses.length}`);
  const status = statuses[0] ?? null;
  if (status?.contract !== 'agm-server-correlated-instrumentation.v1') addError('INSTRUMENTATION_CONTRACT_UNEXPECTED');
  if (status?.prismaPatched !== true) addError('PRISMA_CORRELATION_HOOK_NOT_READY');
  if (status?.asyncContext !== true) addError('ASYNC_CONTEXT_CORRELATION_NOT_READY');
  if (finite(status?.officialBasicSloMs) !== 3000) addError('SERVER_OFFICIAL_BASIC_SLO_NOT_3000_MS');
  if (status?.functionalBasicChange !== false) addError('SERVER_FUNCTIONAL_BASIC_CHANGE_NOT_FALSE');
  if (status?.production === true) addError('PRODUCTION_TELEMETRY_NOT_ALLOWED');
  if (status?.runId === 'missing-run-id') addError('SERVER_RUN_ID_MISSING_SENTINEL');
  const runId = uniqueNonNull(telemetry, 'runId')[0] ?? null;
  const pid = uniqueNonNull(telemetry, 'pid')[0] ?? null;
  const processInstance = uniqueNonNull(telemetry, 'processInstance')[0] ?? null;
  for (const client of clientRecords) {
    if (client.batchRunId && runId && client.batchRunId !== runId) addError(`${client.id}: CLIENT_SERVER_RUN_ID_MISMATCH`);
  }
  const flushes = telemetry.filter((entry) => entry.type === 'instrumentation.flush');
  if (flushes.length !== 1) addError(`INSTRUMENTATION_FLUSH_COUNT_${flushes.length}`);
  if (flushes[0]?.graceful !== true) addError('INSTRUMENTATION_NOT_GRACEFULLY_FLUSHED');
  if (finite(flushes[0]?.activeRequests) !== 0) addError('ACTIVE_REQUESTS_REMAINED_AT_FLUSH');
  return { runId, pid, processInstance, status, flush: flushes[0] ?? null };
}

function validateRunBinding(clientEvidence, custody, serverIdentity) {
  const document = custody.document;
  const custodyRunId = asText(document?.runId);
  const batchRunIds = uniqueNonNull(clientEvidence.batches, 'runId').map(asText);
  const batchesWithRunId = clientEvidence.batches.filter((batch) => batch.runId).length;
  if (batchRunIds.length > 1) addError('CLIENT_BATCH_RUN_ID_NOT_UNIQUE');
  if (batchesWithRunId > 0 && batchesWithRunId !== clientEvidence.batches.length) addError('CLIENT_BATCH_RUN_ID_PARTIAL');
  if (batchRunIds.length === 1 && batchRunIds[0] !== serverIdentity.runId) addError('CLIENT_SERVER_RUN_ID_MISMATCH');

  if (custody.present) {
    if (!document) return { mode: 'INVALID_CUSTODY', runId: null };
    if (document.contract !== 'agm-real-basic-timeout-investigation-custody.v1') addError('CUSTODY_CONTRACT_UNEXPECTED');
    if (!custodyRunId) addError('CUSTODY_RUN_ID_MISSING');
    else if (custodyRunId !== serverIdentity.runId) addError('CUSTODY_SERVER_RUN_ID_MISMATCH');
    if (document.apiPid !== undefined && finite(document.apiPid) !== finite(serverIdentity.pid)) addError('CUSTODY_SERVER_PID_MISMATCH');
    if (document.production === true) addError('CUSTODY_PRODUCTION_RUN_NOT_ALLOWED');
    if (document.p9 !== 'STOPPED') addError('CUSTODY_P9_NOT_STOPPED');
    if (document.killSwitch !== 'ACTIVE') addError('CUSTODY_KILL_SWITCH_NOT_ACTIVE');
    if (finite(document.officialBasicSloMs) !== 3000 || document.officialBasicSloUnchanged !== true) addError('CUSTODY_OFFICIAL_BASIC_SLO_NOT_VERIFIED');
    if (document.diagnosticFaultInjectionAuthorized === true || finite(document.diagnosticFaultHeaders) > 0) addError('CUSTODY_FAULT_INJECTION_NOT_ALLOWED');
  }

  if (batchRunIds.length === 0) {
    if (!custody.present || !custodyRunId || custodyRunId !== serverIdentity.runId) addError('CLIENT_RUN_BINDING_MISSING');
    else addWarning('CLIENT_BATCH_RUN_ID_BOUND_BY_CUSTODY_AND_EXACT_TRACE_PAIRING');
  }
  return {
    mode: batchRunIds.length === 1 ? 'CLIENT_BATCH_RUN_ID' : 'CUSTODY_PLUS_EXACT_TRACE_PAIRING',
    runId: batchRunIds[0] ?? custodyRunId ?? null,
  };
}

function validateOneWindowCustody(root, clientEvidence, telemetry, custody, authorization, diagnosticPolicy, serverIdentity) {
  if (!authorization.present) return { required: false, status: 'NOT_APPLICABLE' };
  const document = custody.document;
  const authorized = authorization.document;
  if (!document || !authorized) return { required: true, status: 'FAIL' };
  if (authorized.runId !== undefined && asText(authorized.runId) !== serverIdentity.runId) addError('SHORT_WINDOW_AUTHORIZATION_RUN_ID_MISMATCH');
  if (asText(document.runId) !== basename(root)) addError('SHORT_WINDOW_DIRECTORY_CUSTODY_RUN_ID_MISMATCH');
  const custodyStart = isoEpoch(document.startedAt);
  const custodyEnd = isoEpoch(document.completedAt);
  if (custodyStart === null || custodyEnd === null || custodyEnd < custodyStart) addError('SHORT_WINDOW_CUSTODY_BOUNDARY_INVALID');
  if (document.runnerCompleted !== true) addError('SHORT_WINDOW_RUNNER_NOT_COMPLETED');
  if (finite(document.batchesCompleted) !== clientEvidence.batches.length) addError('SHORT_WINDOW_CUSTODY_BATCH_COUNT_MISMATCH');
  if (diagnosticPolicy.maxBatches !== null && clientEvidence.batches.length > diagnosticPolicy.maxBatches) addError('SHORT_WINDOW_MAX_BATCHES_EXCEEDED');
  if (custodyStart !== null && custodyEnd !== null) {
    for (const client of clientEvidence.records) {
      const start = isoEpoch(client.clientStartedAt);
      const end = isoEpoch(client.clientCompletedAt);
      if (start === null || end === null || start < custodyStart - 1000 || end > custodyEnd + 1000) addError(`${client.id}: CLIENT_OUTSIDE_SINGLE_CUSTODY_WINDOW`);
    }
    for (let index = 0; index < telemetry.length; index += 1) {
      const at = isoEpoch(telemetry[index]?.at);
      if (at === null || at < custodyStart - 1000 || at > custodyEnd + 1000) addError(`SERVER_TELEMETRY_OUTSIDE_SINGLE_CUSTODY_WINDOW_${index + 1}`);
    }
  }
  return {
    required: true,
    status: integrityErrors.length === 0 ? 'PASS' : 'FAIL',
    runId: serverIdentity.runId,
    startedAt: document.startedAt ?? null,
    completedAt: document.completedAt ?? null,
    batchesCompleted: finite(document.batchesCompleted),
    stopReason: asText(document.stopReason),
  };
}

function serverFaultMarker(entry) {
  return entry.type === 'fault.control'
    || entry.type === 'fault-injection'
    || entry.faultInjected === true
    || (entry.fault != null && entry.fault !== '')
    || KNOWN_CONTROL_OPERATIONS.has(String(entry.operation ?? ''));
}

function parseCsvRow(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value); value = '';
    } else value += character;
  }
  values.push(value);
  return values;
}

const WINDOWS_TO_IANA = new Map([
  ['W. Europe Standard Time', 'Europe/Berlin'],
  ['Central Europe Standard Time', 'Europe/Budapest'],
  ['Romance Standard Time', 'Europe/Paris'],
  ['UTC', 'UTC'],
]);

function zonedLocalToEpoch(parts, timeZone) {
  let guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const observedEpoch = Date.UTC(Number(observed.year), Number(observed.month) - 1, Number(observed.day), Number(observed.hour), Number(observed.minute), Number(observed.second), parts.millisecond);
    const desiredEpoch = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
    guess += desiredEpoch - observedEpoch;
  }
  return guess;
}

function localDateParts(value, dateOrder = null) {
  const text = String(value ?? '').trim();
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (match) return { year: +match[1], month: +match[2], day: +match[3], hour: +match[4], minute: +match[5], second: +match[6], millisecond: +(match[7] ?? 0).padEnd(3, '0') };
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[ T](\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!match) return null;
  const left = +match[1], right = +match[2];
  const inferred = dateOrder?.toUpperCase() ?? (left > 12 ? 'DMY' : right > 12 ? 'MDY' : text.includes('.') ? 'DMY' : 'MDY');
  return { year: +match[3], month: inferred === 'DMY' ? right : left, day: inferred === 'DMY' ? left : right, hour: +match[4], minute: +match[5], second: +match[6], millisecond: +(match[7] ?? 0).padEnd(3, '0') };
}

function parseHostEpoch(value, metadata, pdhBiasMinutes) {
  if (typeof value !== 'string') return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value.trim())) return isoEpoch(value);
  const parts = localDateParts(value, metadata?.dateOrder);
  if (!parts) return null;
  const rawZone = metadata?.ianaTimeZone ?? metadata?.timeZone ?? metadata?.timezone;
  const timeZone = WINDOWS_TO_IANA.get(rawZone) ?? rawZone;
  if (timeZone) {
    try { return zonedLocalToEpoch(parts, timeZone); } catch { /* fall through to explicit bias */ }
  }
  const offsetEast = finite(firstDefined(metadata?.utcOffsetMinutesEast, metadata?.utcOffsetMinutes));
  if (offsetEast !== null) return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond) - offsetEast * 60_000;
  const bias = finite(firstDefined(metadata?.utcBiasMinutes, metadata?.timezoneOffsetMinutes, pdhBiasMinutes));
  if (bias !== null) return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond) + bias * 60_000;
  return null;
}

function findCounter(headers, predicates) {
  return headers.findIndex((header) => predicates.every((predicate) => header.toLowerCase().includes(predicate)));
}

function csvNumber(row, index, scale = 1) {
  if (index < 0) return null;
  const value = finite(row[index]);
  return value === null ? null : value * scale;
}

function parseTypeperfCsv(text, metadata) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { samples: [], errors: ['HOST_CSV_EMPTY'], source: 'CSV' };
  const headers = parseCsvRow(lines[0]);
  const pdhBias = finite(headers[0]?.match(/\((-?\d+)\)\s*$/)?.[1]);
  const indexes = {
    cpuPercent: findCounter(headers, ['processor(_total)', '% processor time']),
    processorQueue: findCounter(headers, ['system', 'processor queue length']),
    contextSwitchesPerSec: findCounter(headers, ['system', 'context switches/sec']),
    availableMemoryMB: findCounter(headers, ['memory', 'available mbytes']),
    pagesPerSec: findCounter(headers, ['memory', 'pages/sec']),
    diskQueue: findCounter(headers, ['physicaldisk(_total)', 'avg. disk queue length']),
    diskLatencyMs: findCounter(headers, ['physicaldisk(_total)', 'avg. disk sec/transfer']),
    diskBytesPerSec: findCounter(headers, ['physicaldisk(_total)', 'disk bytes/sec']),
    networkBytesPerSec: findCounter(headers, ['network interface', 'bytes total/sec']),
  };
  const samples = [];
  const errors = [];
  for (let index = 1; index < lines.length; index += 1) {
    const row = parseCsvRow(lines[index]);
    const epoch = parseHostEpoch(row[0], metadata, pdhBias);
    if (epoch === null) { errors.push(`HOST_CSV_TIMESTAMP_UNRESOLVED_ROW_${index + 1}`); continue; }
    samples.push({
      epoch,
      at: new Date(epoch).toISOString(),
      cpuPercent: csvNumber(row, indexes.cpuPercent),
      processorQueue: csvNumber(row, indexes.processorQueue),
      contextSwitchesPerSec: csvNumber(row, indexes.contextSwitchesPerSec),
      availableMemoryMB: csvNumber(row, indexes.availableMemoryMB),
      pagesPerSec: csvNumber(row, indexes.pagesPerSec),
      diskQueue: csvNumber(row, indexes.diskQueue),
      diskLatencyMs: csvNumber(row, indexes.diskLatencyMs, 1000),
      diskBytesPerSec: csvNumber(row, indexes.diskBytesPerSec),
      networkBytesPerSec: csvNumber(row, indexes.networkBytesPerSec),
      apiPid: null, apiCpuSec: null, apiWorkingSetMB: null,
    });
  }
  return { samples, errors, source: 'TYPEPERF_CSV', pdhBiasMinutes: pdhBias };
}

function hostObjects(document) {
  if (Array.isArray(document)) return document;
  for (const key of ['samples', 'records', 'hostSamples']) if (Array.isArray(document?.[key])) return document[key];
  return [];
}

function normalizeHostObject(record) {
  const at = asText(firstDefined(record.captureAt, record.capturedAt, record.at, record.timestamp, record.collectedAt));
  const epoch = isoEpoch(at);
  if (epoch === null) return null;
  return {
    epoch, at: new Date(epoch).toISOString(),
    cpuPercent: finite(firstDefined(record.cpuPercent, record.hostCpuPercent, record.cpu?.percent)),
    processorQueue: finite(firstDefined(record.processorQueue, record.processorQueueLength, record.runQueue)),
    contextSwitchesPerSec: finite(firstDefined(record.contextSwitchesPerSec, record.contextSwitchRate)),
    availableMemoryMB: finite(firstDefined(record.availableMemoryMB, record.memory?.availableMB)),
    pagesPerSec: finite(firstDefined(record.pagesPerSec, record.memory?.pagesPerSec)),
    diskQueue: finite(firstDefined(record.diskQueue, record.disk?.queue)),
    diskLatencyMs: finite(firstDefined(record.diskLatencyMs, record.disk?.latencyMs)),
    diskBytesPerSec: finite(firstDefined(record.diskBytesPerSec, record.disk?.bytesPerSec)),
    networkBytesPerSec: finite(firstDefined(record.networkBytesPerSec, record.network?.bytesPerSec)),
    apiPid: finite(firstDefined(record.apiPid, record.api?.pid)),
    apiCpuSec: finite(firstDefined(record.apiCpuSec, record.api?.cpuSec)),
    apiWorkingSetMB: finite(firstDefined(record.apiWorkingSetMB, record.api?.workingSetMB)),
  };
}

async function loadHostTelemetry(root, explicitPath, explicitMetadata) {
  const candidates = explicitPath ? [explicitPath] : ['host-telemetry.jsonl', 'host-telemetry.csv', 'host-telemetry.json'];
  let selected = null;
  for (const candidate of candidates) {
    const path = pathFromRoot(root, candidate);
    if (await exists(path)) { selected = path; break; }
  }
  if (!selected) return { present: false, path: null, source: null, samples: [], errors: [], metadata: null };
  const metadataCandidates = explicitMetadata ? [explicitMetadata] : ['host-telemetry-metadata.json', 'host-metadata.json'];
  let metadata = null;
  for (const candidate of metadataCandidates) {
    const path = pathFromRoot(root, candidate);
    if (!await exists(path)) continue;
    try { metadata = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')); }
    catch { addWarning(`HOST_TIMEZONE_METADATA_INVALID: ${basename(path)}`); }
    break;
  }
  const extension = extname(selected).toLowerCase();
  if (extension === '.csv') {
    const parsed = parseTypeperfCsv(await readFile(selected, 'utf8'), metadata);
    return { present: true, path: selected, metadata, ...parsed };
  }
  const text = (await readFile(selected, 'utf8')).replace(/^\uFEFF/, '');
  let objects = [];
  const errors = [];
  if (extension === '.jsonl') {
    text.split(/\r?\n/).filter(Boolean).forEach((line, index) => {
      try { objects.push(JSON.parse(line)); } catch { errors.push(`HOST_INVALID_JSON_LINE_${index + 1}`); }
    });
  } else {
    try { objects = hostObjects(JSON.parse(text)); } catch { errors.push('HOST_INVALID_JSON'); }
  }
  const samples = objects.map(normalizeHostObject).filter(Boolean).sort((left, right) => left.epoch - right.epoch);
  return { present: true, path: selected, source: extension === '.jsonl' ? 'JSONL' : 'JSON', samples, errors, metadata };
}

function recordsForTrace(telemetry, traceId) {
  return telemetry.filter((entry) => entry.traceId === traceId || (Array.isArray(entry.traceIds) && entry.traceIds.includes(traceId)));
}

function exactlyOne(records, predicate, label, clientId, localErrors) {
  const matches = records.filter(predicate);
  if (matches.length !== 1) localErrors.push(`${clientId}: ${label}_COUNT_${matches.length}`);
  return matches[0] ?? null;
}

function summarizeHostWindow(host, startEpoch, endEpoch, apiPid) {
  if (!host.present) return { present: false, sufficient: false, samples: 0 };
  const samples = host.samples.filter((sample) => sample.epoch >= startEpoch - 500 && sample.epoch <= endEpoch + 500);
  const maxGapMs = samples.length > 1 ? maximum(samples.slice(1).map((sample, index) => sample.epoch - samples[index].epoch)) : null;
  const apiPids = [...new Set(samples.map((sample) => sample.apiPid).filter((value) => value !== null))];
  const apiPidMatch = apiPids.length > 0 && apiPids.every((value) => value === Number(apiPid));
  const boundaryCovered = samples.length >= 2
    && samples[0].epoch <= startEpoch + 500
    && samples.at(-1).epoch >= endEpoch - 500;
  const sourceClean = host.errors.length === 0;
  const sufficient = samples.length >= 2 && maxGapMs !== null && maxGapMs <= 2000 && apiPidMatch && boundaryCovered && sourceClean;
  const cpuValues = samples.map((sample) => sample.cpuPercent).filter((value) => value !== null);
  return {
    present: true,
    sufficient,
    samples: samples.length,
    maxGapMs: round(maxGapMs),
    apiPidMatch,
    boundaryCovered,
    sourceClean,
    cpuMaxPercent: round(maximum(samples.map((sample) => sample.cpuPercent))),
    cpuAveragePercent: cpuValues.length ? round(cpuValues.reduce((total, value) => total + value, 0) / cpuValues.length) : null,
    processorQueueMax: round(maximum(samples.map((sample) => sample.processorQueue))),
    contextSwitchesPerSecMax: round(maximum(samples.map((sample) => sample.contextSwitchesPerSec))),
    availableMemoryMinMB: round(minimum(samples.map((sample) => sample.availableMemoryMB))),
    pagesPerSecMax: round(maximum(samples.map((sample) => sample.pagesPerSec))),
    diskQueueMax: round(maximum(samples.map((sample) => sample.diskQueue))),
    diskLatencyMaxMs: round(maximum(samples.map((sample) => sample.diskLatencyMs))),
    diskBytesPerSecMax: round(maximum(samples.map((sample) => sample.diskBytesPerSec))),
    networkBytesPerSecMax: round(maximum(samples.map((sample) => sample.networkBytesPerSec))),
    apiCpuSecDelta: round(samples.map((sample) => sample.apiCpuSec).filter((value) => value !== null).length >= 2
      ? Math.max(...samples.map((sample) => sample.apiCpuSec).filter((value) => value !== null)) - Math.min(...samples.map((sample) => sample.apiCpuSec).filter((value) => value !== null))
      : null),
    apiWorkingSetMaxMB: round(maximum(samples.map((sample) => sample.apiWorkingSetMB))),
  };
}

function summarizeProcessWindow(processTelemetry, startEpoch, endEpoch, apiPid) {
  if (!processTelemetry.present) {
    return {
      present: false, integrityStatus: 'NOT_CAPTURED', causalRole: 'BACKGROUND_CONTEXT_ONLY',
      intersectingSamples: 0, coverageRatio: null, topRelevantProcesses: [], backgroundTopProcesses: [],
    };
  }
  const intersecting = processTelemetry.samples.map((sample) => {
    const overlapStart = Math.max(startEpoch, sample.windowStartEpoch);
    const overlapEnd = Math.min(endEpoch, sample.captureCompletedEpoch);
    return { sample, overlapStart, overlapEnd, overlapMs: Math.max(0, overlapEnd - overlapStart) };
  }).filter((item) => item.overlapMs > 0);
  const grouped = new Map();
  for (const item of intersecting) {
    for (const process of item.sample.topCpuProcesses) {
      const key = `${process.pid}|${process.processName}`;
      const current = grouped.get(key) ?? {
        pid: process.pid,
        processName: process.processName,
        isApiProcess: Number(process.pid) === Number(apiPid),
        observedSamples: 0,
        observedOverlapMs: 0,
        weightedCpu: 0,
        maxCpuPercentOfOneCore: 0,
      };
      current.observedSamples += 1;
      current.observedOverlapMs += item.overlapMs;
      current.weightedCpu += process.cpuPercentOfOneCore * item.overlapMs;
      current.maxCpuPercentOfOneCore = Math.max(current.maxCpuPercentOfOneCore, process.cpuPercentOfOneCore);
      grouped.set(key, current);
    }
  }
  const topRelevantProcesses = [...grouped.values()].map((process) => ({
    pid: process.pid,
    processName: process.processName,
    isApiProcess: process.isApiProcess,
    observedSamples: process.observedSamples,
    observedOverlapMs: round(process.observedOverlapMs),
    observedOverlapWeightedCpuPercentOfOneCore: round(process.weightedCpu / process.observedOverlapMs),
    maxCpuPercentOfOneCore: round(process.maxCpuPercentOfOneCore),
  })).sort((left, right) =>
    right.observedOverlapWeightedCpuPercentOfOneCore - left.observedOverlapWeightedCpuPercentOfOneCore
    || right.maxCpuPercentOfOneCore - left.maxCpuPercentOfOneCore
  ).slice(0, 12);
  const intervals = intersecting.map((item) => [item.overlapStart, item.overlapEnd]).sort((left, right) => left[0] - right[0]);
  const merged = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (!previous || interval[0] > previous[1]) merged.push([...interval]);
    else previous[1] = Math.max(previous[1], interval[1]);
  }
  const coveredMs = sum(merged.map(([start, end]) => end - start));
  const serverWindowMs = Math.max(0, endEpoch - startEpoch);
  const backgroundTopProcesses = topRelevantProcesses.filter((process) => !process.isApiProcess).slice(0, 8);
  const backgroundCpuActivityObserved = backgroundTopProcesses.some((process) =>
    process.observedOverlapWeightedCpuPercentOfOneCore >= 25 || process.maxCpuPercentOfOneCore >= 50
  );
  return {
    present: true,
    integrityStatus: processTelemetry.errors.length ? 'FAIL' : 'PASS',
    causalRole: 'BACKGROUND_CONTEXT_ONLY_NOT_ROOT_CAUSE',
    serverWindowStartedAt: new Date(startEpoch).toISOString(),
    serverWindowCompletedAt: new Date(endEpoch).toISOString(),
    intersectingSamples: intersecting.length,
    coveredMs: round(coveredMs),
    coverageRatio: serverWindowMs > 0 ? round(Math.min(1, coveredMs / serverWindowMs), 4) : null,
    backgroundCpuActivityObserved,
    topRelevantProcesses,
    backgroundTopProcesses,
    intersectingWindows: intersecting.map((item) => ({
      sequence: item.sample.sequence,
      windowStartedAt: item.sample.windowStartedAt,
      captureCompletedAt: item.sample.captureCompletedAt,
      overlapMs: round(item.overlapMs),
      topCpuProcesses: item.sample.topCpuProcesses.slice(0, 8),
    })),
  };
}

function runtimeCpuWindow(runtimeSamples, traceId, startEpoch, endEpoch) {
  const timestamp = (entry) => isoEpoch(entry.windowCompletedAt ?? entry.at);
  const ordered = runtimeSamples.map((entry) => ({ entry, epoch: timestamp(entry) })).filter((item) => item.epoch !== null).sort((a, b) => a.epoch - b.epoch);
  const before = [...ordered].reverse().find((item) => item.epoch <= startEpoch && startEpoch - item.epoch <= 2000);
  const after = ordered.find((item) => item.epoch >= endEpoch && item.epoch - endEpoch <= 2000)
    ?? [...ordered].reverse().find((item) => item.epoch <= endEpoch && endEpoch - item.epoch <= 500);
  const associated = ordered.filter((item) => item.epoch >= startEpoch - 250 && item.epoch <= endEpoch + 500 && Array.isArray(item.entry.traceIds) && item.entry.traceIds.includes(traceId));
  if (!before || !after || after.epoch <= before.epoch) {
    return { available: false, associatedSamples: associated.length, eventLoopLagMaxMs: round(maximum(associated.map((item) => item.entry.eventLoopLagMs))) };
  }
  const beforeUser = finite(before.entry.cpu?.user), beforeSystem = finite(before.entry.cpu?.system);
  const afterUser = finite(after.entry.cpu?.user), afterSystem = finite(after.entry.cpu?.system);
  if ([beforeUser, beforeSystem, afterUser, afterSystem].some((value) => value === null)) {
    return { available: false, associatedSamples: associated.length, eventLoopLagMaxMs: round(maximum(associated.map((item) => item.entry.eventLoopLagMs))) };
  }
  const beforeCpu = beforeUser + beforeSystem;
  const afterCpu = afterUser + afterSystem;
  const cpuDeltaMicros = afterCpu - beforeCpu;
  const wallMs = after.epoch - before.epoch;
  const sharedTraceCountMax = maximum(associated.map((item) => Array.isArray(item.entry.traceIds) ? item.entry.traceIds.length : 0)) ?? 0;
  const exclusive = associated.length > 0 && sharedTraceCountMax <= 1;
  return {
    available: cpuDeltaMicros >= 0 && wallMs > 0,
    baselineAt: new Date(before.epoch).toISOString(),
    completedAt: new Date(after.epoch).toISOString(),
    wallMs: round(wallMs),
    cpuDeltaMicros: round(cpuDeltaMicros),
    cpuToWallRatio: round(cpuDeltaMicros / (wallMs * 1000), 4),
    associatedSamples: associated.length,
    eventLoopLagMaxMs: round(maximum(associated.map((item) => item.entry.eventLoopLagMs))),
    sharedTraceCountMax,
    exclusive,
  };
}

function spanSummary(spans, kind) {
  const selected = spans.filter((span) => span.kind === kind);
  return {
    count: selected.length,
    totalMs: round(sum(selected.map((span) => span.durationMs))),
    maxMs: round(maximum(selected.map((span) => span.durationMs)) ?? 0),
    operations: selected.map((span) => ({
      operation: asText(span.operation), model: asText(span.model), durationMs: round(finite(span.durationMs)),
      outcome: asText(span.outcome), semantics: asText(span.semantics),
    })),
  };
}

function buildClientTransportEvidence(client, receiveEpoch, responseEpoch, clientEndEpoch) {
  const transport = client.clientTransport;
  if (!transport.present) return { present: false, contract: null, serverJoin: null, diagnosticStageSignature: 'TRANSPORT_TIMELINE_NOT_CAPTURED' };
  const epoch = (key) => transport.epochMs[key] ?? isoEpoch(transport.timestamps[key]);
  const clientStartedEpoch = epoch('clientStartedAt') ?? isoEpoch(client.clientStartedAt);
  const requestCreateEpoch = epoch('requestCreateAt');
  const bodySentEpoch = epoch('bodySentAt');
  const responseHeadersEpoch = epoch('responseHeadersAt');
  const trailersEpoch = epoch('trailersAt');
  const requiredEvents = {
    clientStartedAt: clientStartedEpoch,
    requestCreateAt: requestCreateEpoch,
    bodySentAt: bodySentEpoch,
    serverReceivedAt: receiveEpoch,
    serverResponseCompletedAt: responseEpoch,
    responseHeadersAt: responseHeadersEpoch,
    clientCompletedAt: clientEndEpoch,
  };
  const missingEvents = Object.entries(requiredEvents).filter(([, value]) => value === null).map(([key]) => key);
  const phaseDurationsMs = {
    clientStartToRequestCreate: clientStartedEpoch !== null && requestCreateEpoch !== null ? round(requestCreateEpoch - clientStartedEpoch) : null,
    requestCreateToServerReceive: requestCreateEpoch !== null && receiveEpoch !== null ? round(receiveEpoch - requestCreateEpoch) : null,
    bodySentToServerReceive: bodySentEpoch !== null && receiveEpoch !== null ? round(receiveEpoch - bodySentEpoch) : null,
    serverReceiveToResponse: receiveEpoch !== null && responseEpoch !== null ? round(responseEpoch - receiveEpoch) : null,
    serverResponseToTransportHeaders: responseEpoch !== null && responseHeadersEpoch !== null ? round(responseHeadersEpoch - responseEpoch) : null,
    serverResponseToTrailers: responseEpoch !== null && trailersEpoch !== null ? round(trailersEpoch - responseEpoch) : null,
    responseHeadersToClientComplete: responseHeadersEpoch !== null && clientEndEpoch !== null ? round(clientEndEpoch - responseHeadersEpoch) : null,
    trailersToClientComplete: trailersEpoch !== null && clientEndEpoch !== null ? round(clientEndEpoch - trailersEpoch) : null,
  };
  const stages = [
    ['CLIENT_BEFORE_TRANSPORT_REQUEST_CREATE', phaseDurationsMs.clientStartToRequestCreate],
    ['CLIENT_TRANSPORT_TO_SERVER_RECEIVE', phaseDurationsMs.requestCreateToServerReceive],
    ['SERVER_RECEIVE_TO_RESPONSE', phaseDurationsMs.serverReceiveToResponse],
    ['SERVER_RESPONSE_TO_CLIENT_COMPLETE', responseEpoch !== null && clientEndEpoch !== null ? round(clientEndEpoch - responseEpoch) : null],
  ].filter(([, durationMs]) => durationMs !== null && durationMs >= 0)
    .sort((left, right) => right[1] - left[1]);
  return {
    present: true,
    contract: transport.contract,
    traceId: transport.traceId,
    requestId: transport.requestId,
    headerCorrelation: transport.headerCorrelation,
    timestamps: transport.timestamps,
    joinedTimestamps: Object.fromEntries(Object.entries(requiredEvents).map(([key, value]) => [key, value === null ? null : new Date(value).toISOString()])),
    epochMs: transport.epochMs,
    reportedDurationsMs: transport.reportedDurationsMs,
    serverJoin: {
      key: 'traceId',
      serverReceivedAt: receiveEpoch === null ? null : new Date(receiveEpoch).toISOString(),
      serverResponseAt: responseEpoch === null ? null : new Date(responseEpoch).toISOString(),
      ...phaseDurationsMs,
    },
    transportError: transport.transportError,
    captureFinalizedAt: transport.captureFinalizedAt,
    diagnosticStageSignature: stages.length ? stages[0][0] : 'TRANSPORT_STAGE_NOT_RESOLVED',
    diagnosticStageDurationsMs: Object.fromEntries(stages),
    transportSufficientForPhaseLocalization: missingEvents.length === 0,
    missingEvents,
    insufficiency: missingEvents.length ? `MISSING_TRANSPORT_OR_JOIN_EVENTS: ${missingEvents.join(',')}` : null,
    causalRole: 'PHASE_LOCALIZATION_EVIDENCE_NOT_AN_INDEPENDENT_ROOT_CAUSE',
  };
}

function classifyFailure(evidence, sloMs, runIntegrityPass) {
  const missing = [...evidence.pairingErrors];
  const conflicts = [];
  const associated = [];
  const rationale = [];
  const serverMs = evidence.durations.serverMs ?? 0;
  const clientMs = evidence.durations.clientMs ?? 0;
  const preServerMs = evidence.durations.clientToServerReceiveMs;
  const postServerMs = evidence.durations.serverResponseToClientCompleteMs;
  const loopLagMs = maximum([
    evidence.runtime.association?.eventLoopLagMaxMs,
    evidence.runtime.cpuWindow.eventLoopLagMaxMs,
  ]) ?? 0;
  const cpuRatio = evidence.runtime.cpuWindow.available && evidence.runtime.cpuWindow.exclusive
    ? evidence.runtime.cpuWindow.cpuToWallRatio : null;
  const host = evidence.host;
  const prismaMaxMs = evidence.prisma.maxMs;
  const outboundMaxMs = evidence.network.outboundHttp.maxMs ?? 0;
  const socketConnectMaxMs = evidence.network.socketConnect.maxMs ?? 0;
  const networkPathMaxMs = Math.max(
    prismaMaxMs,
    outboundMaxMs,
    socketConnectMaxMs,
  );
  const gcTotalMs = finite(evidence.gc.pauseTotalMs) ?? 0;
  const gcMaxMs = finite(evidence.gc.pauseMaxMs) ?? 0;
  const ioMaxMs = Math.max(evidence.io.span.maxMs ?? 0, finite(evidence.serverPhases?.ioMs) ?? 0);
  const memoryPeakDelta = Math.max(evidence.memory.heapPeakDeltaBytes ?? 0, evidence.memory.externalPeakDeltaBytes ?? 0, evidence.memory.rssPeakDeltaBytes ?? 0);
  const serverSlow = serverMs >= Math.max(1500, sloMs * 0.5);
  const eventLoopStrong = serverSlow && loopLagMs >= Math.max(750, serverMs * 0.45);
  const runtimeCpuHigh = cpuRatio !== null && cpuRatio >= 0.55;
  const runtimeCpuLow = cpuRatio !== null && cpuRatio <= 0.25;
  const hostSaturated = host.sufficient && (host.cpuMaxPercent ?? 0) >= 95 && (host.processorQueueMax ?? 0) >= 2;
  const dbDominant = networkPathMaxMs >= Math.max(1500, serverMs * 0.65);
  const dbMaterialThreshold = Math.max(1500, serverMs * 0.65);
  const dbDominantComponents = [
    ['PRISMA_PATH', prismaMaxMs],
    ['OUTBOUND_HTTP', outboundMaxMs],
    ['SOCKET_CONNECT', socketConnectMaxMs],
  ].filter(([, durationMs]) => durationMs >= dbMaterialThreshold).map(([name]) => name);
  const gcDominant = gcTotalMs >= Math.max(500, serverMs * 0.4) || gcMaxMs >= Math.max(500, serverMs * 0.35);
  const serverFast = serverMs > 0 && serverMs < Math.min(1000, clientMs * 0.35);
  const preServerDominant = preServerMs !== null && preServerMs >= Math.max(1000, clientMs * 0.4);
  const postServerDominant = evidence.serverOutcome === 'finish' && postServerMs !== null && postServerMs >= Math.max(1000, clientMs * 0.4);
  const clientGapMs = Math.max(preServerDominant ? preServerMs : 0, postServerDominant ? postServerMs : 0);
  const clientLoopMs = Math.max(evidence.client.eventLoopLagMaxMs ?? 0, evidence.client.intervalDriftMaxMs ?? 0);
  const clientLoopStrong = clientGapMs > 0 && clientLoopMs >= Math.max(750, clientGapMs * 0.5);
  const memoryHostPressure = host.sufficient && ((host.availableMemoryMinMB ?? Infinity) <= 512 || (host.pagesPerSecMax ?? 0) >= 100);
  const memoryStrong = serverSlow && memoryPeakDelta >= 64 * 1024 * 1024 && memoryHostPressure;
  const diskPressure = host.sufficient && ((host.diskQueueMax ?? 0) >= 1 || (host.diskLatencyMaxMs ?? 0) >= 20);
  const ioStrong = serverSlow && ioMaxMs >= Math.max(750, serverMs * 0.5) && diskPressure;
  const cpuSchedulingStrong = eventLoopStrong && runtimeCpuLow && hostSaturated;
  const runtimeBusyStrong = eventLoopStrong && runtimeCpuHigh;
  const clientHarnessStrong = (preServerDominant || postServerDominant) && serverFast && clientLoopStrong;
  const materialCandidates = [
    dbDominant ? 'DB_NETWORK_PATH' : null,
    gcDominant ? 'GC_PAUSE' : null,
    ioStrong ? 'IO_CONTENTION' : null,
    memoryStrong ? 'MEMORY_PRESSURE' : null,
    cpuSchedulingStrong ? 'CPU_PROCESS_SCHEDULING' : null,
    runtimeBusyStrong ? 'EVENT_LOOP_RUNTIME_BUSY' : null,
    clientHarnessStrong ? 'CLIENT_HARNESS' : null,
  ].filter(Boolean);
  const nestedGcExplainsLoop = materialCandidates.length === 2
    && materialCandidates.includes('GC_PAUSE') && materialCandidates.includes('EVENT_LOOP_RUNTIME_BUSY')
    && gcTotalMs >= loopLagMs * 0.6;
  const nestedIoExplainsLoop = materialCandidates.length === 2
    && materialCandidates.includes('IO_CONTENTION') && materialCandidates.includes('EVENT_LOOP_RUNTIME_BUSY')
    && ioMaxMs >= loopLagMs * 0.6;
  if (materialCandidates.length > 1 && !nestedGcExplainsLoop && !nestedIoExplainsLoop) {
    conflicts.push(`MULTIPLE_MATERIAL_CAUSES_${materialCandidates.join('+')}`);
  }

  if (host.present && (host.cpuMaxPercent ?? 0) >= 95) associated.push('HOST_CPU_SATURATION_BACKGROUND');
  if (gcTotalMs > 0 && !gcDominant) associated.push('GC_ACTIVITY_BELOW_CAUSAL_THRESHOLD');
  if (memoryPeakDelta >= 64 * 1024 * 1024 && !memoryStrong) associated.push('PROCESS_MEMORY_GROWTH_WITHOUT_PROVEN_PRESSURE');
  if ((evidence.process.fsReadDelta ?? 0) > 0 || (evidence.process.fsWriteDelta ?? 0) > 0) associated.push('PROCESS_IO_ACTIVITY');

  if (!evidence.runtime.cpuWindow.available && eventLoopStrong) missing.push('RUNTIME_CPU_DELTA_WINDOW_MISSING');
  if (evidence.runtime.cpuWindow.available && !evidence.runtime.cpuWindow.exclusive && eventLoopStrong) conflicts.push('RUNTIME_CPU_WINDOW_SHARED_WITH_CONCURRENT_TRACES');
  if ((preServerDominant || postServerDominant) && evidence.client.eventLoopLagMaxMs === null && evidence.client.intervalDriftMaxMs === null) missing.push('CLIENT_EVENT_LOOP_TELEMETRY_MISSING');

  let classification = 'NO_SINGLE_CAUSE_PROVEN';
  if (dbDominant && eventLoopStrong) {
    classification = 'DB_NETWORK_VS_RUNTIME_UNRESOLVED';
    conflicts.push('PRISMA_PATH_AND_EVENT_LOOP_BOTH_MATERIAL');
  } else if (memoryStrong && gcDominant) {
    classification = 'MEMORY_VS_GC_UNRESOLVED';
    conflicts.push('MEMORY_PRESSURE_AND_GC_BOTH_MATERIAL');
  } else if (gcDominant && eventLoopStrong && gcTotalMs < loopLagMs * 0.6) {
    classification = 'GC_VS_RUNTIME_UNRESOLVED';
    conflicts.push('GC_DOES_NOT_EXPLAIN_MATERIAL_EVENT_LOOP_LAG');
  } else if (dbDominant && !eventLoopStrong && !gcDominant) {
    classification = 'DB_NETWORK_PATH_CORRELATED';
    rationale.push('Prisma path dominates server duration while runtime/GC signals remain below material thresholds.');
  } else if (gcDominant && (!eventLoopStrong || gcTotalMs >= loopLagMs * 0.6)) {
    classification = 'GC_PAUSE_CORRELATED';
    rationale.push('Exact GC pauses associated with the trace explain a material share of server duration/lag.');
  } else if (ioStrong && (!eventLoopStrong || ioMaxMs >= loopLagMs * 0.6)) {
    classification = 'IO_CONTENTION_CORRELATED';
    rationale.push('Correlated I/O span and host disk pressure jointly dominate the server delay.');
  } else if (memoryStrong && !gcDominant) {
    classification = 'MEMORY_PRESSURE_CORRELATED';
    rationale.push('Large process memory growth overlaps host memory/paging pressure without dominant GC.');
  } else if (cpuSchedulingStrong && evidence.runtime.cpuWindow.exclusive) {
    classification = 'CPU_PROCESS_SCHEDULING_CORRELATED';
    rationale.push('Event-loop lag overlaps low API CPU/wall under host CPU saturation and a material run queue.');
  } else if (runtimeBusyStrong && evidence.runtime.cpuWindow.exclusive && !dbDominant && !gcDominant && !ioStrong) {
    classification = 'EVENT_LOOP_RUNTIME_BUSY_CORRELATED';
    rationale.push('Event-loop lag overlaps high API CPU/wall without a dominant DB, GC, or I/O phase.');
  } else if (clientHarnessStrong) {
    classification = 'CLIENT_HARNESS_TIMEOUT_ARTIFACT';
    rationale.push(`${preServerDominant ? 'Pre-server' : 'Post-server'} client gap dominates while the server remains fast and client event-loop lag is material.`);
  } else if ((preServerDominant || postServerDominant) && serverFast) {
    classification = 'CLIENT_NETWORK_OR_HARNESS_UNRESOLVED';
    conflicts.push('CLIENT_NETWORK_GAP_PRESENT_BUT_CLIENT_STALL_NOT_PROVEN');
  } else if (eventLoopStrong && cpuRatio === null) {
    classification = 'RUNTIME_VS_SCHEDULING_UNRESOLVED';
    conflicts.push('EVENT_LOOP_LAG_WITHOUT_EXCLUSIVE_CPU_WALL_EVIDENCE');
  } else if (eventLoopStrong && !runtimeCpuHigh && !runtimeCpuLow) {
    classification = 'RUNTIME_VS_SCHEDULING_UNRESOLVED';
    conflicts.push('CPU_WALL_RATIO_NOT_DISCRIMINATING');
  } else if (runtimeCpuLow && eventLoopStrong && !hostSaturated) {
    classification = 'RUNTIME_VS_SCHEDULING_UNRESOLVED';
    conflicts.push('LOW_API_CPU_WITHOUT_SUFFICIENT_HOST_SCHEDULING_EVIDENCE');
  } else {
    rationale.push('No measured component uniquely explains the timeout under predeclared conservative thresholds.');
  }

  if (evidence.gc.pauseRecords === 0 && gcDominant) missing.push('EXACT_GC_PAUSE_RECORDS_MISSING');
  if (!runIntegrityPass) missing.push('RUN_EVIDENCE_INTEGRITY_FAILED');
  const unresolved = classification.includes('UNRESOLVED') || conflicts.length > 0;
  const sufficient = runIntegrityPass && CAUSAL_CLASSIFICATIONS.has(classification) && !unresolved && missing.length === 0;
  const signatureSubtype = classification === 'DB_NETWORK_PATH_CORRELATED'
    ? dbDominantComponents.join('+')
    : classification === 'CLIENT_HARNESS_TIMEOUT_ARTIFACT'
      ? [preServerDominant ? 'PRE_SERVER' : null, postServerDominant ? 'POST_SERVER' : null].filter(Boolean).join('+')
      : classification === 'EVENT_LOOP_RUNTIME_BUSY_CORRELATED'
        ? 'HIGH_EXCLUSIVE_API_CPU_WALL'
        : classification === 'CPU_PROCESS_SCHEDULING_CORRELATED'
          ? 'LOW_EXCLUSIVE_API_CPU_WALL+HOST_CPU_RUN_QUEUE'
          : classification === 'GC_PAUSE_CORRELATED'
            ? 'EXACT_TRACE_GC_PAUSES'
            : classification === 'MEMORY_PRESSURE_CORRELATED'
              ? 'PROCESS_GROWTH+HOST_MEMORY_PAGING'
              : classification === 'IO_CONTENTION_CORRELATED'
                ? 'CORRELATED_IO_SPAN+HOST_DISK_PRESSURE'
                : null;
  return {
    classification,
    signatureKey: sufficient && signatureSubtype ? `${classification}:${signatureSubtype}` : 'NO_SUFFICIENT_SIGNATURE',
    sufficientForRootCause: sufficient,
    rationale,
    associatedSignals: [...new Set(associated)],
    missingEvidence: [...new Set(missing)],
    conflictingSignals: [...new Set(conflicts)],
    thresholds: {
      eventLoopStrong, runtimeCpuHigh, runtimeCpuLow, hostSaturated, dbDominant,
      gcDominant, preServerDominant, postServerDominant, clientLoopStrong, memoryStrong, ioStrong,
    },
  };
}

const clientEvidence = await loadClientBatches(cli.root);
const custody = await loadCustody(cli.root, cli.custody);
const shortWindowAuthorization = await loadShortWindowAuthorization(cli.root);
const diagnosticPolicy = resolveDiagnosticPolicy(custody, shortWindowAuthorization);
for (const client of clientEvidence.records) {
  if (!client.traceId || !client.requestId) addError(`${client.id}: CLIENT_TRACE_OR_REQUEST_ID_MISSING`);
  else if (client.traceId !== client.requestId) addError(`${client.id}: CLIENT_REQUEST_ID_TRACE_ID_MISMATCH`);
  if (client.echoedTraceId && client.echoedTraceId !== client.traceId) addError(`${client.id}: ECHOED_TRACE_ID_MISMATCH`);
  if (client.echoedRequestId && client.echoedRequestId !== client.requestId) addError(`${client.id}: ECHOED_REQUEST_ID_MISMATCH`);
  if (client.faultInjected) addError(`${client.id}: FAULT_INJECTED_CLIENT_RECORD_NOT_ALLOWED`);
  if (client.clientTransport.present) {
    const transport = client.clientTransport;
    if (transport.contract !== 'agm-node-undici-client-transport-timeline.v1') addError(`${client.id}: CLIENT_TRANSPORT_CONTRACT_INVALID`);
    if (transport.traceId !== client.traceId || transport.requestId !== client.requestId) addError(`${client.id}: CLIENT_TRANSPORT_ID_MISMATCH`);
    if (transport.headerCorrelation.sameRequestAndTraceId !== true) addError(`${client.id}: CLIENT_TRANSPORT_REQUEST_TRACE_ID_MISMATCH`);
    if (!client.timedOut && client.status > 0 && (transport.headerCorrelation.traceIdMatched !== true || transport.headerCorrelation.requestIdMatched !== true)) {
      addError(`${client.id}: CLIENT_TRANSPORT_HEADER_CORRELATION_FAILED`);
    }
    const orderedTransportEpochs = ['clientStartedAt', 'requestCreateAt', 'bodySentAt', 'responseHeadersAt', 'trailersAt']
      .map((key) => ({ key, epoch: transport.epochMs[key] ?? isoEpoch(transport.timestamps[key]) }))
      .filter((item) => item.epoch !== null);
    for (let index = 1; index < orderedTransportEpochs.length; index += 1) {
      if (orderedTransportEpochs[index].epoch < orderedTransportEpochs[index - 1].epoch) addError(`${client.id}: CLIENT_TRANSPORT_TIMESTAMP_ORDER_INVALID`);
    }
    for (const key of ['clientStartedAt', 'requestCreateAt', 'bodySentAt', 'responseHeadersAt', 'trailersAt', 'errorAt']) {
      const isoValue = isoEpoch(transport.timestamps[key]);
      const numericValue = transport.epochMs[key];
      if (isoValue !== null && numericValue !== null && Math.abs(isoValue - numericValue) > 5) addError(`${client.id}: CLIENT_TRANSPORT_ISO_EPOCH_MISMATCH_${key}`);
    }
  } else if (diagnosticPolicy.authorizedShortWindow && client.official) {
    addError(`${client.id}: CLIENT_TRANSPORT_TIMELINE_MISSING_IN_SHORT_WINDOW`);
  }
}
const duplicateClientTraces = [...new Set(clientEvidence.records.map((record) => record.traceId).filter(Boolean).filter((traceId, index, all) => all.indexOf(traceId) !== index))];
for (const traceId of duplicateClientTraces) addError(`${traceId}: DUPLICATE_CLIENT_TRACE_ID`);

let serverPath = pathFromRoot(cli.root, cli.serverTelemetry);
if (!await exists(serverPath) && cli.serverTelemetry === 'server-telemetry.jsonl') {
  const compatiblePath = join(cli.root, 'server-correlated-telemetry.jsonl');
  if (await exists(compatiblePath)) {
    serverPath = compatiblePath;
    addWarning('SERVER_TELEMETRY_COMPATIBLE_FILENAME_USED: server-correlated-telemetry.jsonl');
  }
}
const telemetry = await loadJsonLines(serverPath, 'SERVER_TELEMETRY');
if (telemetry.some(serverFaultMarker)) addError('FAULT_INJECTED_SERVER_RECORDS_NOT_ALLOWED');
for (const entry of telemetry) {
  const hasRequestIdentity = entry.requestId !== undefined || entry.traceId !== undefined;
  if (hasRequestIdentity && (!entry.requestId || !entry.traceId)) addError('SERVER_REQUEST_OR_TRACE_ID_MISSING');
  else if (hasRequestIdentity && entry.requestId !== entry.traceId) addError(`${entry.traceId ?? entry.requestId}: SERVER_REQUEST_ID_TRACE_ID_MISMATCH`);
}
const serverIdentity = validateServerIdentity(telemetry, clientEvidence.records);
const runBinding = validateRunBinding(clientEvidence, custody, serverIdentity);
const oneWindowCustody = validateOneWindowCustody(
  cli.root, clientEvidence, telemetry, custody, shortWindowAuthorization, diagnosticPolicy, serverIdentity,
);
const host = await loadHostTelemetry(cli.root, cli.hostTelemetry, cli.hostTimezoneMetadata);
for (const error of host.errors) addWarning(error);
if (host.present && !host.samples.length) addWarning('HOST_TELEMETRY_PRESENT_BUT_NO_TIMESTAMPED_SAMPLES');
const processTelemetry = await loadProcessTelemetry(cli.root, cli.processTelemetry);
const runtimeSamples = telemetry.filter((entry) => entry.type === 'runtime.sample');

const officialClients = clientEvidence.records.filter((record) => record.official);
const clientPairingFailedIds = new Set();
for (const client of clientEvidence.records) {
  const traceRecords = recordsForTrace(telemetry, client.traceId);
  const local = [];
  const receive = exactlyOne(traceRecords, (entry) => entry.type === 'request.receive', 'REQUEST_RECEIVE', client.id, local);
  const summary = exactlyOne(traceRecords, (entry) => entry.type === 'request.summary', 'REQUEST_SUMMARY', client.id, local);
  const association = exactlyOne(traceRecords, (entry) => entry.type === 'request.runtime-association', 'RUNTIME_ASSOCIATION', client.id, local);
  const response = exactlyOne(traceRecords, (entry) => entry.type === 'response.finish' || entry.type === 'response.close', 'RESPONSE_TERMINAL', client.id, local);
  if (receive && summary && association) {
    const instances = new Set([receive.requestInstanceId, summary.requestInstanceId, association.requestInstanceId, response?.requestInstanceId]);
    if (instances.size !== 1 || instances.has(undefined) || instances.has(null)) local.push(`${client.id}: REQUEST_INSTANCE_PAIRING_FAILED`);
    for (const entry of [receive, summary, association]) {
      if (entry.requestId !== entry.traceId || entry.traceId !== client.traceId) local.push(`${client.id}: SERVER_REQUEST_ID_TRACE_ID_MISMATCH`);
    }
    if (receive.endpoint !== summary.endpoint) local.push(`${client.id}: SERVER_ENDPOINT_PAIRING_FAILED`);
    const clientStartEpoch = isoEpoch(client.clientStartedAt);
    const clientEndEpoch = isoEpoch(client.clientCompletedAt);
    const receiveEpoch = isoEpoch(receive.receivedAt);
    const responseEpoch = isoEpoch(summary.serverResponseAt);
    if (clientStartEpoch === null) local.push(`${client.id}: CLIENT_START_TIMESTAMP_MISSING`);
    if (clientEndEpoch === null) local.push(`${client.id}: CLIENT_COMPLETION_TIMESTAMP_MISSING`);
    if (receiveEpoch === null) local.push(`${client.id}: SERVER_RECEIVE_TIMESTAMP_MISSING`);
    if (responseEpoch === null) local.push(`${client.id}: SERVER_RESPONSE_TIMESTAMP_MISSING`);
    if (clientStartEpoch !== null && clientEndEpoch !== null && clientEndEpoch < clientStartEpoch) local.push(`${client.id}: CLIENT_TIMESTAMP_ORDER_INVALID`);
    if (clientStartEpoch !== null && receiveEpoch !== null && receiveEpoch < clientStartEpoch - 100) local.push(`${client.id}: CLIENT_SERVER_CLOCK_ORDER_INVALID`);
    if (receiveEpoch !== null && responseEpoch !== null && responseEpoch < receiveEpoch) local.push(`${client.id}: SERVER_TIMESTAMP_ORDER_INVALID`);
  }
  const spanKey = (entry) => [entry.kind, entry.operation, entry.model].map((value) => String(value ?? '')).join('|');
  const starts = traceRecords.filter((entry) => entry.type === 'span.start');
  const ends = traceRecords.filter((entry) => entry.type === 'span.end');
  const spanKeys = new Set([...starts.map(spanKey), ...ends.map(spanKey)]);
  for (const key of spanKeys) {
    const startCount = starts.filter((entry) => spanKey(entry) === key).length;
    const endCount = ends.filter((entry) => spanKey(entry) === key).length;
    if (startCount !== endCount) local.push(`${client.id}: SPAN_PAIRING_FAILED_${key}_${startCount}_${endCount}`);
  }
  if (local.length) clientPairingFailedIds.add(client.id);
  local.forEach(addError);
}

const runIntegrityBeforeRecords = integrityErrors.length === 0;
const failures = [];
const diagnosticEventSignatures = [];
const signatureClients = officialClients.filter((record) =>
  record.durationMs !== null && record.durationMs >= diagnosticPolicy.diagnosticThresholdMs
);
for (const client of signatureClients) {
  const traceRecords = recordsForTrace(telemetry, client.traceId);
  const pairingErrors = [];
  const receive = exactlyOne(traceRecords, (entry) => entry.type === 'request.receive', 'REQUEST_RECEIVE', client.id, pairingErrors);
  const summary = exactlyOne(traceRecords, (entry) => entry.type === 'request.summary', 'REQUEST_SUMMARY', client.id, pairingErrors);
  const association = exactlyOne(traceRecords, (entry) => entry.type === 'request.runtime-association', 'RUNTIME_ASSOCIATION', client.id, pairingErrors);
  const responseRecords = traceRecords.filter((entry) => entry.type === 'response.finish' || entry.type === 'response.close');
  if (responseRecords.length !== 1) pairingErrors.push(`${client.id}: RESPONSE_TERMINAL_COUNT_${responseRecords.length}`);
  const response = responseRecords[0] ?? null;
  const requestInstanceIds = [receive, summary, association, response].filter(Boolean).map((entry) => entry.requestInstanceId);
  if (requestInstanceIds.length && new Set(requestInstanceIds).size !== 1) pairingErrors.push(`${client.id}: REQUEST_INSTANCE_PAIRING_FAILED`);
  const spanStarts = traceRecords.filter((entry) => entry.type === 'span.start');
  const spans = traceRecords.filter((entry) => entry.type === 'span.end');
  if (spanStarts.length !== spans.length) pairingErrors.push(`${client.id}: SPAN_START_END_COUNT_MISMATCH_${spanStarts.length}_${spans.length}`);
  const prisma = spanSummary(spans, 'prisma.path');
  const outbound = spanSummary(spans, 'outbound.network');
  const socket = spanSummary(spans, 'socket.connect');
  const ioSpan = spanSummary(spans, 'io');
  const gcRecords = telemetry.filter((entry) => entry.type === 'gc.pause' && Array.isArray(entry.traceIds) && entry.traceIds.includes(client.traceId));
  const startEpoch = isoEpoch(client.clientStartedAt);
  const receiveEpoch = isoEpoch(receive?.receivedAt);
  const responseEpoch = isoEpoch(summary?.serverResponseAt ?? response?.completedAt);
  const clientEndEpoch = isoEpoch(client.clientCompletedAt);
  if (startEpoch === null) pairingErrors.push(`${client.id}: CLIENT_START_TIMESTAMP_MISSING`);
  if (receiveEpoch === null) pairingErrors.push(`${client.id}: SERVER_RECEIVE_TIMESTAMP_MISSING`);
  if (responseEpoch === null) pairingErrors.push(`${client.id}: SERVER_RESPONSE_TIMESTAMP_MISSING`);
  if (clientEndEpoch === null) pairingErrors.push(`${client.id}: CLIENT_COMPLETION_TIMESTAMP_MISSING`);
  const safeStart = startEpoch ?? 0;
  const safeEnd = Math.max(responseEpoch ?? safeStart, clientEndEpoch ?? safeStart);
  const hostWindow = summarizeHostWindow(host, receiveEpoch ?? safeStart, responseEpoch ?? safeEnd, serverIdentity.pid);
  const processWindow = summarizeProcessWindow(processTelemetry, receiveEpoch ?? safeStart, responseEpoch ?? safeEnd, serverIdentity.pid);
  const cpuWindow = runtimeCpuWindow(runtimeSamples, client.traceId, receiveEpoch ?? safeStart, responseEpoch ?? safeEnd);
  const clientTransport = buildClientTransportEvidence(client, receiveEpoch, responseEpoch, clientEndEpoch);
  const serverMs = finite(summary?.serverDurationMs);
  const clientMs = client.durationMs ?? (startEpoch !== null && clientEndEpoch !== null ? clientEndEpoch - startEpoch : null);
  const serverWallMs = receiveEpoch !== null && responseEpoch !== null ? responseEpoch - receiveEpoch : null;
  const preServerMs = startEpoch !== null && receiveEpoch !== null ? receiveEpoch - startEpoch : null;
  const postServerMs = responseEpoch !== null && clientEndEpoch !== null ? clientEndEpoch - responseEpoch : null;
  const closureErrorMs = clientMs !== null && preServerMs !== null && serverMs !== null && postServerMs !== null
    ? Math.abs(clientMs - (preServerMs + serverMs + postServerMs)) : null;
  if (serverWallMs !== null && serverMs !== null && Math.abs(serverWallMs - serverMs) > Math.max(100, serverMs * 0.1)) pairingErrors.push(`${client.id}: SERVER_WALL_MONOTONIC_DURATION_MISMATCH`);
  if (preServerMs !== null && preServerMs < -100) pairingErrors.push(`${client.id}: CLIENT_SERVER_CLOCK_ORDER_INVALID`);
  if (closureErrorMs !== null && closureErrorMs > Math.max(150, clientMs * 0.1)) pairingErrors.push(`${client.id}: END_TO_END_TIMELINE_CLOSURE_FAILED`);
  const memory = summary?.memory ?? {};
  const phases = summary?.phases ?? {};
  const processEvidence = summary?.process ?? {};
  const officialTimeoutFailure = client.officialTimeout && clientMs !== null && clientMs > cli.sloMs;
  const diagnosticEventType = officialTimeoutFailure
    ? 'OFFICIAL_TIMEOUT_OVER_SLO'
    : clientMs !== null && clientMs < cli.sloMs
      ? 'NEAR_MISS_BELOW_OFFICIAL_SLO'
      : 'DIAGNOSTIC_EVENT_NOT_ROOT_CAUSE_ELIGIBLE';
  const record = {
    id: client.id,
    source: { batch: basename(client.sourceFile), index: client.sourceIndex },
    phase: client.phase,
    iteration: client.iteration,
    layer: client.layer,
    naturalOfficialTimeout: officialTimeoutFailure,
    rootCauseEligibleOfficialTimeout: officialTimeoutFailure,
    diagnosticEvent: true,
    diagnosticNearMiss: diagnosticEventType === 'NEAR_MISS_BELOW_OFFICIAL_SLO',
    diagnosticEventType,
    diagnosticThresholdMs: diagnosticPolicy.diagnosticThresholdMs,
    traceId: client.traceId,
    requestId: client.requestId,
    endpoint: asText(receive?.endpoint ?? summary?.endpoint ?? client.endpoint),
    method: asText(receive?.method ?? summary?.method),
    status: client.status ?? finite(summary?.status),
    clientError: client.error,
    serverOutcome: asText(summary?.outcome ?? response?.outcome),
    timestamps: {
      clientStartedAt: client.clientStartedAt,
      serverReceivedAt: asText(receive?.receivedAt),
      serverResponseAt: asText(summary?.serverResponseAt ?? response?.completedAt),
      clientHeadersAt: client.clientHeadersAt,
      clientBodyAt: client.clientBodyAt,
      clientCompletedAt: client.clientCompletedAt,
    },
    durations: {
      clientMs: round(clientMs), clientToServerReceiveMs: round(preServerMs), serverMs: round(serverMs),
      serverWallMs: round(serverWallMs), serverResponseToClientCompleteMs: round(postServerMs),
      timelineClosureErrorMs: round(closureErrorMs),
    },
    serverPhases: {
      prismaPathMs: round(finite(phases.prismaPathMs)), outboundNetworkMs: round(finite(phases.outboundNetworkMs)),
      ioMs: round(finite(phases.ioMs)), runtimeBusyMs: round(finite(phases.runtimeBusyMs)),
      residualServerMs: round(finite(phases.residualServerMs)), sumMayOverlap: phases.sumMayOverlap === true,
    },
    prisma,
    network: { outboundHttp: outbound, socketConnect: socket },
    runtime: { association, cpuWindow },
    gc: {
      pauseRecords: gcRecords.length,
      pauseTotalMs: round(finite(association?.gcPauseTotalMs) ?? sum(gcRecords.map((entry) => entry.durationMs))),
      pauseMaxMs: round(finite(association?.gcPauseMaxMs) ?? maximum(gcRecords.map((entry) => entry.durationMs)) ?? 0),
      events: finite(association?.gcEvents) ?? gcRecords.length,
      exactPauses: gcRecords.map((entry) => ({ startedAt: entry.startedAt, completedAt: entry.completedAt, durationMs: round(finite(entry.durationMs)), gcKind: entry.gcKind })),
    },
    memory: {
      rssBefore: finite(memory.rssBefore), rssAfter: finite(memory.rssAfter), rssPeak: finite(memory.rssPeak),
      rssPeakDeltaBytes: finite(memory.rssPeak) !== null && finite(memory.rssBefore) !== null ? finite(memory.rssPeak) - finite(memory.rssBefore) : null,
      heapUsedBefore: finite(memory.heapUsedBefore), heapUsedAfter: finite(memory.heapUsedAfter), heapUsedPeak: finite(memory.heapUsedPeak),
      heapPeakDeltaBytes: finite(memory.heapUsedPeak) !== null && finite(memory.heapUsedBefore) !== null ? finite(memory.heapUsedPeak) - finite(memory.heapUsedBefore) : null,
      externalBefore: finite(memory.externalBefore), externalAfter: finite(memory.externalAfter), externalPeak: finite(memory.externalPeak),
      externalPeakDeltaBytes: finite(memory.externalPeak) !== null && finite(memory.externalBefore) !== null ? finite(memory.externalPeak) - finite(memory.externalBefore) : null,
    },
    io: {
      span: ioSpan,
      fsReadDelta: finite(processEvidence.fsReadDelta), fsWriteDelta: finite(processEvidence.fsWriteDelta),
      hostDiskQueueMax: hostWindow.diskQueueMax ?? null, hostDiskLatencyMaxMs: hostWindow.diskLatencyMaxMs ?? null,
      hostDiskBytesPerSecMax: hostWindow.diskBytesPerSecMax ?? null,
    },
    process: {
      cpuUserMicros: finite(processEvidence.cpuUserMicros), cpuSystemMicros: finite(processEvidence.cpuSystemMicros),
      voluntaryContextSwitchDelta: finite(processEvidence.voluntaryContextSwitchDelta),
      involuntaryContextSwitchDelta: finite(processEvidence.involuntaryContextSwitchDelta),
      fsReadDelta: finite(processEvidence.fsReadDelta), fsWriteDelta: finite(processEvidence.fsWriteDelta),
    },
    concurrentProcesses: processWindow,
    clientTransport,
    host: hostWindow,
    client: {
      eventLoopLagMaxMs: client.clientEventLoopLagMaxMs,
      intervalDriftMaxMs: client.clientIntervalDriftMaxMs,
    },
    pairingErrors,
  };
  record.classification = officialTimeoutFailure
    ? classifyFailure(record, cli.sloMs, runIntegrityBeforeRecords && pairingErrors.length === 0)
    : {
        classification: 'DIAGNOSTIC_EVENT_ONLY_NO_CAUSALITY_DECISION',
        signatureKey: `DIAGNOSTIC_EVENT:${clientTransport.diagnosticStageSignature}`,
        sufficientForRootCause: false,
        rationale: ['This natural >=2000 ms event is retained for phase localization but is not an eligible official >3000 ms timeout failure.'],
        associatedSignals: [],
        missingEvidence: clientTransport.missingEvents ?? [],
        conflictingSignals: [],
        thresholds: { diagnosticThresholdMs: diagnosticPolicy.diagnosticThresholdMs, officialBasicSloMs: cli.sloMs },
      };
  if (processWindow.backgroundCpuActivityObserved) {
    record.classification.associatedSignals = [...new Set([
      ...record.classification.associatedSignals,
      'CONCURRENT_BACKGROUND_PROCESS_CPU_ACTIVITY',
    ])];
  }
  diagnosticEventSignatures.push(record);
  if (officialTimeoutFailure) failures.push(record);
}

const diagnosticEventBatches = [...new Set(diagnosticEventSignatures.map((event) => event.source.batch))];
if (diagnosticPolicy.authorizedShortWindow) {
  const custodyDocument = custody.document ?? {};
  if (finite(custodyDocument.diagnosticEventsCaptured) !== diagnosticEventSignatures.length) addError('SHORT_WINDOW_DIAGNOSTIC_EVENT_COUNT_MISMATCH');
  if (finite(custodyDocument.diagnosticEventBatches) !== diagnosticEventBatches.length) addError('SHORT_WINDOW_DIAGNOSTIC_EVENT_BATCH_COUNT_MISMATCH');
  if (diagnosticEventSignatures.length > 0) {
    if (custodyDocument.stopReason !== 'DIAGNOSTIC_EVENT_CAPTURED') addError('SHORT_WINDOW_STOP_REASON_NOT_DIAGNOSTIC_EVENT_CAPTURED');
    const firstEventBatch = Math.min(...diagnosticEventBatches.map((name) => finite(name.match(/\d+/)?.[0])).filter((value) => value !== null));
    const lastCapturedBatch = Math.max(...clientEvidence.batches.map((batch) => finite(batch.file.match(/\d+/)?.[0])).filter((value) => value !== null));
    if (firstEventBatch !== lastCapturedBatch) addError('SHORT_WINDOW_BATCH_CAPTURED_AFTER_FIRST_DIAGNOSTIC_EVENT');
  } else {
    if (custodyDocument.stopReason !== 'MAX_BATCHES_REACHED') addError('SHORT_WINDOW_ZERO_EVENT_STOP_REASON_NOT_MAX_BATCHES');
    if (finite(custodyDocument.batchesCompleted) !== diagnosticPolicy.maxBatches) addError('SHORT_WINDOW_ZERO_EVENT_DID_NOT_REACH_AUTHORIZED_MAX');
  }
}

const sufficientFailures = failures.filter((failure) => failure.classification.sufficientForRootCause);
const signatures = [...new Set(sufficientFailures.map((failure) => failure.classification.signatureKey))];
const distinctFailureBatches = [...new Set(failures.map((failure) => failure.source.batch))];
const allFailuresSufficientAndSame = failures.length >= 3
  && distinctFailureBatches.length >= 3
  && sufficientFailures.length === failures.length
  && signatures.length === 1
  && failures.every((failure) => failure.classification.conflictingSignals.length === 0);
const rootCauseIdentified = integrityErrors.length === 0 && allFailuresSufficientAndSame;
const finalSignature = rootCauseIdentified ? signatures[0] : null;
const finalClassification = rootCauseIdentified ? sufficientFailures[0].classification.classification : null;

const assumptions = {
  cli: usage().split('\n'),
  clientBatchShapes: ['JSON array', 'requests[]', 'samples[]', 'cases[]', 'records[]', 'batch.requests[]'],
  officialMarkerRequired: true,
  timeoutMarkerRequired: true,
  sameRequestIdAndTraceIdRequired: true,
  runBinding: 'batch runId must match server runId; custody.json with the same runId is the required fallback for probe batches that omit runId',
  serverPairRequired: ['request.receive', 'request.summary', 'request.runtime-association', 'one response.finish|response.close'],
  faultInjectionAllowed: false,
  hostTelemetry: 'optional JSON/JSONL/Typeperf CSV; local CSV timestamps require timezone metadata or PDH bias',
  processTelemetry: 'optional process-telemetry.jsonl using agm-real-basic-process-sample.v1; intersected only with server receive-to-response windows; background context only and never a root cause by itself',
  diagnosticEvents: `natural official requests at or above ${diagnosticPolicy.diagnosticThresholdMs} ms are retained as diagnostic events, never relabeled as failures`,
  diagnosticTransportJoin: 'agm-node-undici-client-transport-timeline.v1 joined to server receive/response by identical traceId; missing events remain null and explicitly insufficient',
  cpuDecision: 'high lag + high exclusive API CPU/wall => runtime busy; high lag + low API CPU/wall + host CPU/run queue => process scheduling; host CPU alone => background only',
  prismaSemantics: 'Prisma path is engine queue + DB/wire + decode/callback total; material event-loop overlap remains unresolved',
  rootCauseGate: 'only explicit official timeouts with measured duration >3000 ms are eligible; at least three across three distinct batch episodes; every timeout has the same sufficient mechanism signature; no unresolved overlap; run integrity PASS',
  officialBasicSloMs: cli.sloMs,
  officialBasicSloUnchanged: true,
};

const analysis = {
  contract: 'agm-real-basic-timeout-analysis.v1',
  generatedAt: new Date().toISOString(),
  runDirectory: cli.root,
  assumptions,
  evidenceIntegrity: {
    status: integrityErrors.length === 0 ? 'PASS' : 'FAIL',
    errors: integrityErrors,
    warnings: integrityWarnings,
    serverIdentity: {
      runId: serverIdentity.runId, pid: serverIdentity.pid, processInstance: serverIdentity.processInstance,
      instrumentationContract: serverIdentity.status?.contract ?? null,
      prismaPatched: serverIdentity.status?.prismaPatched ?? null,
      gracefulFlush: serverIdentity.flush?.graceful ?? false,
    },
    runBinding,
    oneWindowCustody: {
      ...oneWindowCustody,
      status: oneWindowCustody.required
        ? integrityErrors.some((error) => /SHORT_WINDOW|SINGLE_CUSTODY_WINDOW/.test(error)) ? 'FAIL' : 'PASS'
        : 'NOT_APPLICABLE',
    },
    faultInjectedRecords: {
      client: clientEvidence.records.filter((record) => record.faultInjected).length,
      server: telemetry.filter(serverFaultMarker).length,
    },
    processTelemetry: {
      status: !processTelemetry.present ? 'NOT_CAPTURED' : processTelemetry.errors.length ? 'FAIL' : 'PASS',
      errors: processTelemetry.errors,
    },
    pairing: {
      clientRequests: clientEvidence.records.length,
      officialRequests: officialClients.length,
      complete: clientEvidence.records.length - clientPairingFailedIds.size,
      failedRequestIds: [...clientPairingFailedIds],
    },
  },
  inputs: {
    batchFiles: clientEvidence.batches,
    custody: custody.present ? { file: basename(custody.path), contract: custody.document?.contract ?? null, runId: custody.document?.runId ?? null } : { present: false },
    serverTelemetry: basename(serverPath),
    serverRecords: telemetry.length,
    hostTelemetry: host.present ? { file: basename(host.path), source: host.source, samples: host.samples.length, errors: host.errors } : { present: false },
    processTelemetry: processTelemetry.present
      ? { file: basename(processTelemetry.path), contract: 'agm-real-basic-process-sample.v1', samples: processTelemetry.samples.length, errors: processTelemetry.errors }
      : { present: false },
    shortWindowAuthorization: shortWindowAuthorization.present
      ? { file: basename(shortWindowAuthorization.path), ...diagnosticPolicy }
      : { present: false, diagnosticThresholdMs: diagnosticPolicy.diagnosticThresholdMs },
  },
  counts: {
    clientRecords: clientEvidence.records.length,
    officialRequests: officialClients.length,
    naturalOfficialTimeouts: failures.length,
    sufficientlyAttributedTimeouts: sufficientFailures.length,
    diagnosticEventsAtOrAboveThreshold: diagnosticEventSignatures.length,
    diagnosticNearMissesBelowOfficialSlo: diagnosticEventSignatures.filter((event) => event.diagnosticNearMiss).length,
    diagnosticEventBatches: diagnosticEventBatches.length,
  },
  diagnosticEventSignatures,
  failureSignatures: failures,
  rootCauseDecision: {
    verdict: rootCauseIdentified ? 'ROOT_CAUSE_IDENTIFIED' : 'NO_SINGLE_CAUSE_PROVEN',
    classification: finalClassification,
    signature: finalSignature,
    minimumNaturalFailuresRequired: 3,
    minimumDistinctFailureBatchesRequired: 3,
    observedNaturalFailures: failures.length,
    observedDistinctFailureBatches: distinctFailureBatches.length,
    allFailuresSufficientAndSame,
    unresolvedFailures: failures.filter((failure) => !failure.classification.sufficientForRootCause).map((failure) => failure.traceId),
    rationale: rootCauseIdentified
      ? `All ${failures.length} explicit official >3000 ms timeouts share sufficient mechanism signature ${finalSignature}.`
      : 'The run does not contain at least three integrity-clean explicit official >3000 ms timeouts across three distinct batch episodes with one identical sufficient mechanism signature and no unresolved overlap. Diagnostic near-misses are excluded from this decision.',
  },
  safety: {
    p9: 'STOPPED', killSwitch: 'ACTIVE', soakRestarted: false,
    officialBasicSloMs: cli.sloMs, officialBasicSloUnchanged: true,
    injectedFaultsAccepted: false,
  },
};

const markdownEscape = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const metric = (value) => Number.isFinite(value) ? value.toFixed(2) : 'n/a';
const markdown = [];
markdown.push('# Real Basic Timeout Failure Signatures', '');
markdown.push(`Generated: ${analysis.generatedAt}  `);
markdown.push(`Run ID: \`${markdownEscape(serverIdentity.runId ?? 'unverified')}\`  `);
markdown.push(`Evidence integrity: **${analysis.evidenceIntegrity.status}**  `);
markdown.push(`Verdict: **${analysis.rootCauseDecision.verdict}**${finalSignature ? ` / \`${finalSignature}\`` : ''}`, '');
markdown.push('## CLI and input assumptions', '');
markdown.push('```text', usage(), '```', '');
markdown.push('- Only explicitly marked official requests are analyzed.');
markdown.push('- Only explicit Timeout/Abort records are failure signatures; slow successful responses are not relabeled.');
markdown.push(`- Natural official requests >=${diagnosticPolicy.diagnosticThresholdMs} ms are diagnostic events. Near-misses remain explicitly non-failures and cannot enter the root-cause gate.`);
markdown.push('- `requestId` must equal `traceId` across client and server records.');
markdown.push('- Fault-control records are forbidden. The classifier never reads an expected/injected fault label.');
markdown.push('- Host CPU at 100% is background evidence unless high lag coincides with low API CPU/wall and a material processor queue.');
markdown.push('- Concurrent-process telemetry is intersected with server receive-to-response time only; it is background-interference context and cannot establish root cause by itself.');
markdown.push('- Prisma duration is a path total, not a claim of DB-engine-only latency. Prisma/runtime overlap remains unresolved.', '');
markdown.push('## Integrity gate', '');
markdown.push(`- Errors: ${integrityErrors.length ? integrityErrors.map((error) => `\`${markdownEscape(error)}\``).join(', ') : 'none'}`);
markdown.push(`- Warnings: ${integrityWarnings.length ? integrityWarnings.map((warning) => `\`${markdownEscape(warning)}\``).join(', ') : 'none'}`);
markdown.push(`- Natural official timeouts: ${failures.length}`);
markdown.push(`- Diagnostic events >=${diagnosticPolicy.diagnosticThresholdMs} ms: ${diagnosticEventSignatures.length} (${diagnosticEventSignatures.filter((event) => event.diagnosticNearMiss).length} below-SLO near-miss(es))`);
markdown.push(`- Sufficiently attributed: ${sufficientFailures.length}`, '');
markdown.push('## Diagnostic event signatures (not failures)', '');
markdown.push(`Threshold: ${diagnosticPolicy.diagnosticThresholdMs} ms. Official Basic SLO remains ${cli.sloMs} ms. Only rows marked root eligible can also appear in the failure matrix.`, '');
markdown.push('| traceId | type | endpoint | client ms | start→create | create/body→server receive | server receive→complete | server complete→headers/client complete | dominant diagnostic stage | root eligible |');
markdown.push('|---|---|---|---:|---:|---:|---:|---:|---|---|');
for (const event of diagnosticEventSignatures) {
  const joinEvidence = event.clientTransport.serverJoin ?? {};
  markdown.push(`| \`${markdownEscape(event.traceId)}\` | \`${event.diagnosticEventType}\` | ${markdownEscape(event.endpoint)} | ${metric(event.durations.clientMs)} | ${metric(joinEvidence.clientStartToRequestCreate)} | ${metric(joinEvidence.requestCreateToServerReceive)} / ${metric(joinEvidence.bodySentToServerReceive)} | ${metric(joinEvidence.serverReceiveToResponse)} | ${metric(joinEvidence.serverResponseToTransportHeaders)} / ${metric(event.durations.serverResponseToClientCompleteMs)} | \`${event.clientTransport.diagnosticStageSignature}\` | ${event.rootCauseEligibleOfficialTimeout ? 'yes' : 'no'} |`);
}
if (!diagnosticEventSignatures.length) markdown.push('| _none_ | | | | | | | | | no |');
markdown.push('');
for (const event of diagnosticEventSignatures) {
  markdown.push(`### Diagnostic event ${markdownEscape(event.traceId)}`, '');
  markdown.push(`- Event type: \`${event.diagnosticEventType}\`; duration=${metric(event.durations.clientMs)} ms; root-cause eligible=${event.rootCauseEligibleOfficialTimeout}.`);
  markdown.push(`- Joined transport segments: start→create=${metric(event.clientTransport.serverJoin?.clientStartToRequestCreate)} ms; create→receive=${metric(event.clientTransport.serverJoin?.requestCreateToServerReceive)} ms; body-sent→receive=${metric(event.clientTransport.serverJoin?.bodySentToServerReceive)} ms; server=${metric(event.clientTransport.serverJoin?.serverReceiveToResponse)} ms; server-complete→headers=${metric(event.clientTransport.serverJoin?.serverResponseToTransportHeaders)} ms; server-complete→client-complete=${metric(event.durations.serverResponseToClientCompleteMs)} ms.`);
  markdown.push(`- Transport sufficiency: ${event.clientTransport.transportSufficientForPhaseLocalization === true ? 'sufficient for phase localization' : markdownEscape(event.clientTransport.insufficiency ?? 'transport timeline not captured')}.`);
  const eventProcesses = event.concurrentProcesses.topRelevantProcesses.map((process) => `${markdownEscape(process.processName)}(pid=${process.pid}, observed-avg=${metric(process.observedOverlapWeightedCpuPercentOfOneCore)}%, max=${metric(process.maxCpuPercentOfOneCore)}%)`);
  markdown.push(`- Concurrent processes (context only): ${eventProcesses.length ? eventProcesses.join('; ') : 'none captured in the server window'}.`);
  if (!event.rootCauseEligibleOfficialTimeout) markdown.push('- Causality: `NOT EVALUATED — DIAGNOSTIC EVENT / NOT A FAILURE`.', '');
  else markdown.push('- Causality: evaluated only under the separate official-timeout root gate.', '');
}
markdown.push('## Failure signature matrix', '');
markdown.push('| traceId | phase | endpoint | client ms | server ms | Prisma max ms | event-loop lag ms | GC total ms | API CPU/wall | host CPU / queue | classification | sufficient |');
markdown.push('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|');
for (const failure of failures) {
  markdown.push(`| \`${markdownEscape(failure.traceId)}\` | ${markdownEscape(failure.phase)} | ${markdownEscape(failure.endpoint)} | ${metric(failure.durations.clientMs)} | ${metric(failure.durations.serverMs)} | ${metric(failure.prisma.maxMs)} | ${metric(failure.runtime.association?.eventLoopLagMaxMs)} | ${metric(failure.gc.pauseTotalMs)} | ${metric(failure.runtime.cpuWindow.cpuToWallRatio)} | ${metric(failure.host.cpuMaxPercent)} / ${metric(failure.host.processorQueueMax)} | \`${failure.classification.classification}\` | ${failure.classification.sufficientForRootCause ? 'yes' : 'no'} |`);
}
if (!failures.length) markdown.push('| _none_ | | | | | | | | | | `NO_SINGLE_CAUSE_PROVEN` | no |');
markdown.push('');
for (const failure of failures) {
  markdown.push(`### ${markdownEscape(failure.traceId)}`, '');
  markdown.push(`- Timeline: ${markdownEscape(failure.timestamps.clientStartedAt)} → ${markdownEscape(failure.timestamps.serverReceivedAt)} → ${markdownEscape(failure.timestamps.serverResponseAt)} → ${markdownEscape(failure.timestamps.clientCompletedAt)}`);
  markdown.push(`- Endpoint/status/outcome: \`${markdownEscape(failure.endpoint)}\` / ${markdownEscape(failure.status)} / \`${markdownEscape(failure.serverOutcome)}\``);
  markdown.push(`- Durations: client=${metric(failure.durations.clientMs)} ms; pre-server=${metric(failure.durations.clientToServerReceiveMs)} ms; server=${metric(failure.durations.serverMs)} ms; post-server=${metric(failure.durations.serverResponseToClientCompleteMs)} ms.`);
  markdown.push(`- Prisma/runtime/GC: Prisma max=${metric(failure.prisma.maxMs)} ms; lag=${metric(failure.runtime.association?.eventLoopLagMaxMs)} ms; GC total=${metric(failure.gc.pauseTotalMs)} ms.`);
  markdown.push(`- Memory/I/O/CPU: RSS peak delta=${metric(failure.memory.rssPeakDeltaBytes)} B; fsRead/fsWrite=${metric(failure.io.fsReadDelta)}/${metric(failure.io.fsWriteDelta)}; API CPU/wall=${metric(failure.runtime.cpuWindow.cpuToWallRatio)}; host CPU/queue=${metric(failure.host.cpuMaxPercent)}/${metric(failure.host.processorQueueMax)}.`);
  const relevantProcesses = failure.concurrentProcesses.topRelevantProcesses.map((process) =>
    `${markdownEscape(process.processName)}(pid=${process.pid}, api=${process.isApiProcess}, observed-avg=${metric(process.observedOverlapWeightedCpuPercentOfOneCore)}%, max=${metric(process.maxCpuPercentOfOneCore)}%)`
  );
  markdown.push(`- Concurrent processes (background context only): ${relevantProcesses.length ? relevantProcesses.join('; ') : 'none captured in the server window'}; samples=${failure.concurrentProcesses.intersectingSamples}; coverage=${metric(failure.concurrentProcesses.coverageRatio)}.`);
  markdown.push(`- Classification: \`${failure.classification.classification}\`; sufficient=${failure.classification.sufficientForRootCause}.`);
  markdown.push(`- Mechanism signature: \`${failure.classification.signatureKey}\`.`);
  if (failure.classification.rationale.length) markdown.push(`- Rationale: ${failure.classification.rationale.map(markdownEscape).join(' ')}`);
  if (failure.classification.associatedSignals.length) markdown.push(`- Associated signals: ${failure.classification.associatedSignals.map((value) => `\`${value}\``).join(', ')}.`);
  if (failure.classification.missingEvidence.length) markdown.push(`- Missing evidence: ${failure.classification.missingEvidence.map((value) => `\`${value}\``).join(', ')}.`);
  if (failure.classification.conflictingSignals.length) markdown.push(`- Conflicts: ${failure.classification.conflictingSignals.map((value) => `\`${value}\``).join(', ')}.`);
  markdown.push('');
}
markdown.push('## Root-cause gate', '');
markdown.push(analysis.rootCauseDecision.rationale, '');
markdown.push(`\`${analysis.rootCauseDecision.verdict}\``, '');
markdown.push('`P9 SOAK REMAINS STOPPED — KILL SWITCH ACTIVE — OFFICIAL BASIC SLO UNCHANGED`', '');

await writeFile(join(cli.root, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);
await writeFile(join(cli.root, 'FAILURE_SIGNATURES.md'), `${markdown.join('\n')}\n`);

console.log(`REAL BASIC TIMEOUT ANALYSIS — ${analysis.rootCauseDecision.verdict} (${failures.length} natural official timeout(s))`);
if (integrityErrors.length) {
  console.error(`EVIDENCE INTEGRITY — FAIL (${integrityErrors.length} issue(s))`);
  process.exitCode = 1;
}
