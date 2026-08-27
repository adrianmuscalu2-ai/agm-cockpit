import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateStaticGate } from '../validate-instrumentation-lifecycle-static-gate.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const validatorStatus = 'INSTRUMENTATION LIFECYCLE STATIC GATE \u2014 OWNER REVIEW';
const runId = 'fixture-p9-off-150s';
const start = '2026-08-14T00:00:00.000Z';
const end = '2026-08-14T00:02:30.000Z';
const requiredSources = [
  'apps/api/src/http-application.ts',
  'apps/api/src/main.ts',
  'apps/api/src/prisma/prisma.service.ts',
  'scripts/Get-InstrumentationLifecycleProcessInventory.ps1',
  'scripts/Invoke-InstrumentationLifecycleClosure.ps1',
  'scripts/Invoke-RealBasicTimeoutInvestigation.ps1',
  'scripts/Sample-RealBasicHost.ps1',
  'scripts/Sample-RealBasicProcesses.ps1',
  'scripts/analyze-instrumentation-lifecycle-cycle.mjs',
  'scripts/hash-instrumentation-lifecycle-evidence.mjs',
  'scripts/instrumentation-lifecycle-probe.mjs',
  'scripts/server-correlated-diagnostic-preload.cjs',
].sort();

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, json(value));
}

async function collect(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (directory === root && entry.name === 'SHA256SUMS.json') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(root, path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function freeze(root) {
  const files = [];
  for (const path of (await collect(root)).sort()) {
    const bytes = await readFile(path);
    files.push({ file: relative(root, path).replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes) });
  }
  await writeJson(join(root, 'SHA256SUMS.json'), {
    contract: 'agm-instrumentation-lifecycle-closure-evidence-hashes.v1',
    generatedAt: '2026-08-14T00:03:00.000Z',
    immutableAfterHash: true,
    files,
  });
}

async function makeFixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'agm-static-gate-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const evidence = join(base, 'frozen');
  const workspace = join(base, 'workspace');
  const output = join(base, 'static', 'report.json');
  await mkdir(evidence, { recursive: true });
  const sourceEntries = [];
  for (const path of requiredSources) {
    const bytes = Buffer.from(`fixture:${path}\n`);
    const full = join(workspace, ...path.split('/'));
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes);
    sourceEntries.push({ path, bytes: bytes.length, sha256: hash(bytes), lastWriteAt: '2026-08-13T00:00:00.000Z' });
  }
  const bySource = new Map(sourceEntries.map((entry) => [entry.path, entry]));
  await writeJson(join(evidence, 'client-timeline.json'), {
    contract: 'agm-instrumentation-lifecycle-client-timeline.v1', runId, clientPid: 104,
    window: { scheduledStartAt: start, actualStartedAt: start, completedAt: end, observedDurationMs: 150000 },
  });
  await writeJson(join(evidence, 'custody.json'), { contract: 'fixture-custody', runId });
  await writeJson(join(evidence, 'observer-overhead.json'), {
    contract: 'agm-instrumentation-lifecycle-observer-overhead.v1', runId,
    windowStartedAt: start, windowCompletedAt: end, exactWindowSeconds: 150,
    capturedAtStart: start, capturedAtEnd: end, wallSeconds: 150,
    processes: [
      { role: 'HOST_SAMPLER', pid: 102, cpuSecondsDelta: 1, cpuPercentOfOneCore: 0.667 },
      { role: 'PROCESS_SAMPLER', pid: 103, cpuSecondsDelta: 2, cpuPercentOfOneCore: 1.333 },
    ],
  });
  await writeJson(join(evidence, 'host-sampler-lifecycle.json'), { contract: 'agm-real-basic-sampler-lifecycle.v1', runId, samplerPid: 102 });
  await writeJson(join(evidence, 'process-sampler-lifecycle.json'), { contract: 'agm-real-basic-sampler-lifecycle.v1', runId, samplerPid: 103, measurementBaselineAt: start });
  await writeJson(join(evidence, 'managed-process-roots.json'), {
    contract: 'agm-instrumentation-lifecycle-managed-process-roots.v1', runId,
    managedRoots: [
      { role: 'API', pid: 101, startTimeUtc: '2026-08-13T23:59:00.000Z' },
      { role: 'HOST_SAMPLER', pid: 102, startTimeUtc: '2026-08-13T23:59:10.000Z' },
      { role: 'PROCESS_SAMPLER', pid: 103, startTimeUtc: '2026-08-13T23:59:10.000Z' },
      { role: 'CLIENT', pid: 104, startTimeUtc: '2026-08-13T23:59:20.000Z' },
    ],
  });
  await writeJson(join(evidence, 'source-signatures.json'), { contract: 'agm-instrumentation-lifecycle-source-signatures.v1', files: sourceEntries });
  await writeJson(join(evidence, 'replacement-validation-checks.json'), {
    contract: 'agm-instrumentation-lifecycle-replacement-validation-checks.v1', runId,
    sourceFreeze: {
      runnerSha256: bySource.get('scripts/Invoke-InstrumentationLifecycleClosure.ps1').sha256,
      analyzerSha256: bySource.get('scripts/analyze-instrumentation-lifecycle-cycle.mjs').sha256,
    },
  });
  await writeJson(join(evidence, 'known-protected-background.json'), {
    contract: 'agm-instrumentation-known-protected-background.v1',
    source: { taskScheduler: { servicePid: 1596 } },
  });
  await writeJson(join(evidence, 'process-inventory-before.json'), {
    contract: 'agm-instrumentation-lifecycle-process-inventory.v2',
    identityContract: 'agm-instrumentation-sanitized-process-identity.v2',
    runId,
    capturePhase: 'PREFLIGHT',
    queryStatus: 'SUCCESS',
    queryAttempts: 1,
    coverageStatus: 'COMPLETE_FOR_CANDIDATE_IMAGES',
    knownProtectedBackground: { unclassifiedUnavailableCount: 0 },
    matchCounts: { p9: 0, observer: 0 },
    trafficGenerated: false,
    processChanges: 0,
  });
  const inventory = (phase, prior = null) => ({
    contract: 'agm-instrumentation-lifecycle-process-inventory.v1', runId, capturePhase: phase,
    queryStatus: 'SUCCESS', coverageStatus: 'COMPLETE_FOR_CANDIDATE_IMAGES', candidateCommandLinesUnavailable: [],
    knownProtectedBackground: { unclassifiedUnavailableCount: 0 },
    trackedClosure: { priorInventorySource: prior, descendantMatches: [], complete: phase === 'AFTER_SHUTDOWN' },
  });
  await writeJson(join(evidence, 'managed-process-tree-before-window.json'), inventory('BEFORE_WINDOW'));
  await writeJson(join(evidence, 'managed-process-tree-before-shutdown.json'), inventory('BEFORE_SHUTDOWN', 'managed-process-tree-before-window.json'));
  await writeJson(join(evidence, 'process-inventory-after.json'), inventory('AFTER_SHUTDOWN', 'managed-process-tree-before-shutdown.json'));
  await writeFile(join(evidence, 'process-telemetry.jsonl'), `${JSON.stringify({
    contract: 'agm-real-basic-process-sample.v1', runId, samplerPid: 103, sequence: 1,
    sampleKind: 'MEASUREMENT', windowId: runId, formalWindowStartedAt: start, formalWindowCompletedAt: end,
    windowStartedAt: start, captureStartedAt: end, captureCompletedAt: end, wallSeconds: 150,
  })}\n`);
  await writeJson(join(evidence, 'shutdown.json'), { contract: 'agm-instrumentation-lifecycle-shutdown.v1', stopSignalCreatedAt: end });
  await freeze(evidence);
  return { base, evidence, evidenceRoot: evidence, workspace, output };
}

async function upgradeFixtureToBoundaryV2(fixture) {
  const at = (offsetMs) => new Date(Date.parse(start) + offsetMs).toISOString();
  const afterEnd = (offsetMs) => new Date(Date.parse(end) + offsetMs).toISOString();
  const client = JSON.parse(await readFile(join(fixture.evidence, 'client-timeline.json'), 'utf8'));
  client.window.observedDurationMs = 150000.75;
  const schedulingRawSamples = Array.from({ length: 1500 }, (_, index) => ({
    sequence: index + 1,
    windowStartedAt: at(index * 100),
    sampledAt: at((index + 1) * 100),
    expectedIntervalMs: 100,
    observedIntervalMs: 100,
    driftMs: 0,
  }));
  client.clientRuntime = {
    scheduling: {
      contract: 'agm-client-scheduling-temporal-coverage.v1',
      coverageBasis: 'CONTIGUOUS_OBSERVED_INTERVALS_PLUS_EXPLICIT_BOUNDARY_EXCLUSIONS',
      allowedExclusions: ['BOUNDARY_HEAD_BEFORE_FIRST_INTERVAL', 'BOUNDARY_TAIL_AFTER_LAST_COMPLETE_INTERVAL', 'CLOCK_DOMAIN_ROUNDING_SKEW'],
      intervalMs: 100,
      samples: 1500,
      expectedSamples: 1500,
      rawSampleRatio: 1,
      coalescedTimerSlots: 0,
      observedCoveredMs: 150000,
      boundaryHeadExcludedMs: 0,
      boundaryTailExcludedMs: 0,
      clockDomainRoundingExcludedMs: 0.75,
      accountedCoverageMs: 150000.75,
      accountedCoverageRatio: 1,
      rawSamples: schedulingRawSamples,
    },
  };
  await writeJson(join(fixture.evidence, 'client-timeline.json'), client);
  const rootSeed = [
    ['API', 101, 900, 'node.exe', -60000],
    ['HOST_SAMPLER', 102, 901, 'powershell.exe', -50000],
    ['PROCESS_SAMPLER', 103, 901, 'powershell.exe', -50000],
    ['CLIENT', 104, 901, 'node.exe', -40000],
  ];
  const roots = rootSeed.map(([role, pid, parentPid, imageName, offset]) => {
    const creationAt = at(offset);
    const startTimeUtc = at(offset + 750);
    const creationEpochMs = Date.parse(creationAt);
    const executablePathSha256 = hash(Buffer.from(`exe:${role}`));
    const commandLineSha256 = hash(Buffer.from(`cmd:${role}`));
    const identitySha256 = hash(Buffer.from(`${pid}|${creationEpochMs}|${imageName.toLowerCase()}|${executablePathSha256}|${commandLineSha256}`));
    return {
      role, pid, parentPid, startTimeUtc, creationAt, creationEpochMs, imageName,
      executablePathSha256, commandLineSha256, identityStrength: 'FULL_CURRENT', identitySha256,
      identityEvidence: 'INITIAL_MANAGED_ROOT_SNAPSHOT',
    };
  });
  await writeJson(join(fixture.evidence, 'managed-process-roots.json'), {
    contract: 'agm-instrumentation-lifecycle-managed-process-roots.v2', runId, capturedAt: at(-30000),
    managedRoots: roots,
    identity: 'PID_CREATION_EPOCH_MS_IMAGE_EXECUTABLE_PATH_SHA256_COMMAND_LINE_SHA256',
    identityHashAlgorithm: 'SHA256', rawExecutablePathsRecorded: false, rawCommandLinesRecorded: false,
    descendantModel: 'IDENTITY_AND_TEMPORALLY_VALIDATED_WINDOWS_PARENT_PROCESS_ID_LINEAGE',
  });

  const boundaryRequestedAt = afterEnd(50);
  const releaseRequestedAt = afterEnd(230);
  const boundary = {
    contract: 'agm-instrumentation-lifecycle-sampler-boundary.v1', runId, windowId: runId, clientPid: 104,
    reason: 'CLIENT_WINDOW_COMPLETED', requestedAt: boundaryRequestedAt, clientCompletedAt: end,
  };
  const hostAck = {
    contract: 'agm-real-basic-sampler-boundary-ready.v1', role: 'HOST', runId, samplerPid: 102,
    samplerStartTimeUtc: roots.find((row) => row.role === 'HOST_SAMPLER').startTimeUtc,
    boundary: { contract: boundary.contract, requestedAt: boundaryRequestedAt, clientCompletedAt: end, observedAt: afterEnd(100) },
    readyAt: afterEnd(140), periodicSamplingStopped: true, quiescentUntilRelease: true,
    finalSample: { sequence: 2, sampleKind: 'BOUNDARY_FINAL', scheduledAt: end, captureStartedAt: afterEnd(100), captureCompletedAt: afterEnd(130), captureDurationMs: 30 },
  };
  const processAck = {
    contract: 'agm-real-basic-sampler-boundary-ready.v1', role: 'PROCESS', runId, samplerPid: 103,
    samplerStartTimeUtc: roots.find((row) => row.role === 'PROCESS_SAMPLER').startTimeUtc,
    boundary: { contract: boundary.contract, requestedAt: boundaryRequestedAt, clientCompletedAt: end, observedAt: afterEnd(110) },
    readyAt: afterEnd(150), periodicSamplingStopped: true, quiescentUntilRelease: true,
    measurement: {
      expectedDurationSeconds: 150,
      baseline: { sequence: 2, sampleKind: 'FORMAL_BASELINE', scheduledAt: start, captureStartedAt: start, captureCompletedAt: at(10), captureDurationMs: 10 },
      final: { sequence: 3, sampleKind: 'MEASUREMENT_FINAL', scheduledAt: end, captureStartedAt: end, captureCompletedAt: afterEnd(10), captureDurationMs: 10 },
      cadenceSeconds: 150, cadenceDeviationSeconds: 0,
      snapshotSemantics: 'NON_ATOMIC_PROCESS_ENUMERATION_START_TO_START_DENOMINATOR',
    },
  };
  const release = {
    contract: 'agm-instrumentation-lifecycle-sampler-release.v1', runId, requestedAt: releaseRequestedAt,
    reason: 'PRE_SHUTDOWN_INVENTORY_CAPTURED_AFTER_BOUNDARY_ACK',
    boundaryRequestedAt, boundaryClientCompletedAt: end,
  };
  await writeJson(join(fixture.evidence, 'client-boundary.json'), boundary);
  await writeJson(join(fixture.evidence, 'host-boundary-ready.json'), hostAck);
  await writeJson(join(fixture.evidence, 'process-boundary-ready.json'), processAck);
  await writeJson(join(fixture.evidence, 'sampler-release.json'), release);

  const lifecycle = (role, pid, root, finalSequence, extra = {}) => ({
    contract: 'agm-real-basic-sampler-lifecycle.v1', role, runId, samplerPid: pid,
    samplerStartTimeUtc: root.startTimeUtc, parentPid: root.parentPid, parentStartTimeUtc: at(-70000),
    apiPid: 101, apiStartTimeUtc: roots.find((row) => row.role === 'API').startTimeUtc,
    startedAt: root.startTimeUtc, completedAt: afterEnd(250), sampleIntervalSeconds: role === 'HOST' ? 5 : 150,
    samplesWritten: role === 'HOST' ? 2 : 3, boundarySignalRequired: true,
    boundaryRequestedAt, boundaryClientCompletedAt: end, boundaryObservedAt: role === 'HOST' ? afterEnd(100) : afterEnd(110),
    boundaryReadyAt: role === 'HOST' ? afterEnd(140) : afterEnd(150), boundaryFinalSequence: finalSequence,
    releaseSignalRequired: true, releaseRequestedAt, releaseObservedAt: afterEnd(240), stopReason: 'STOP_SIGNAL',
    graceful: true, exitCode: 0, error: null, ...extra,
  });
  await writeJson(join(fixture.evidence, 'host-sampler-lifecycle.json'), lifecycle('HOST', 102, roots[1], 2));
  await writeJson(join(fixture.evidence, 'process-sampler-lifecycle.json'), lifecycle('PROCESS', 103, roots[2], 3, {
    startSignalRequired: true, startSignalObservedAt: at(-100), startSignalDurationSeconds: 150, startSignalWindowId: runId,
    measurementBaselineAt: start, measurementBaselineCompletedAt: at(10),
    measurementFinalAt: end, measurementFinalCompletedAt: afterEnd(10), measurementCadenceSeconds: 150,
  }));
  const processRows = [
    { sequence: 1, sampleKind: 'READINESS_BASELINE', scheduledAt: null, windowStartedAt: at(-1000), captureStartedAt: at(-1000), captureCompletedAt: at(-990), cadenceSeconds: null },
    { sequence: 2, sampleKind: 'FORMAL_BASELINE', scheduledAt: start, windowStartedAt: start, captureStartedAt: start, captureCompletedAt: at(10), cadenceSeconds: null },
    { sequence: 3, sampleKind: 'MEASUREMENT_FINAL', scheduledAt: end, windowStartedAt: start, captureStartedAt: end, captureCompletedAt: afterEnd(10), cadenceSeconds: 150, topCpuProcesses: [{ pid: 101, processStartTimeUtc: roots[0].startTimeUtc, processName: 'node', cpuPercentOfOneCore: 1 }] },
  ].map((row) => ({
    contract: 'agm-real-basic-process-sample.v1', runId, samplerPid: 103, captureDurationMs: 10,
    snapshotSemantics: 'NON_ATOMIC_PROCESS_ENUMERATION_START_TO_START_DENOMINATOR', ...row,
  }));
  await writeFile(join(fixture.evidence, 'process-telemetry.jsonl'), `${processRows.map((row) => JSON.stringify(row)).join('\n')}\n`);

  await writeJson(join(fixture.evidence, 'observer-overhead.json'), {
    contract: 'agm-instrumentation-lifecycle-observer-overhead.v2', runId, windowId: runId,
    windowStartedAt: start, windowCompletedAt: end, exactWindowSeconds: 150.00075,
    capturedAtStart: start, capturedAtEnd: boundaryRequestedAt, wallSeconds: 150.05,
    boundary: { contract: boundary.contract, clientCompletedAt: end },
    formalWindow: { declaredStartedAt: start, declaredCompletedAt: end, cpuSnapshotStartedAt: start, cpuSnapshotCompletedAt: boundaryRequestedAt },
    finalizationTail: { startedAt: boundaryRequestedAt, completedAt: afterEnd(250), wallSeconds: 0.2 },
    processes: [
      { role: 'HOST_SAMPLER', pid: 102, cpuSecondsDelta: 1, cpuPercentOfOneCore: 0.666445 },
      { role: 'PROCESS_SAMPLER', pid: 103, cpuSecondsDelta: 2, cpuPercentOfOneCore: 1.332889 },
    ],
  });

  const inventory = (phase, prior, captureStartedAt, capturedAt, liveRoots) => ({
    contract: 'agm-instrumentation-lifecycle-process-inventory.v2', identityContract: 'agm-instrumentation-sanitized-process-identity.v2',
    runId, capturePhase: phase, captureStartedAt, capturedAt, queryStatus: 'SUCCESS',
    coverageStatus: 'COMPLETE_FOR_CANDIDATE_IMAGES', candidateCommandLinesUnavailable: [],
    knownProtectedBackground: { unclassifiedUnavailableCount: 0, identityBoundCount: 0 },
    matchCounts: { p9: 0, observer: phase === 'AFTER_SHUTDOWN' ? 0 : 2 }, matches: [],
    trackedClosure: {
      requested: true, rootsRequested: 4, priorInventorySource: prior, priorDescendantIdentities: 0,
      rootIdentityMatches: liveRoots, descendantMatches: [], pidReuseCollisions: [], lineageRejected: [],
      unverifiedDescendantCandidates: [], priorProofFailures: [], currentTrackedMatches: liveRoots.length,
      complete: phase === 'AFTER_SHUTDOWN',
    },
  });
  const rootMatch = (role) => ({ ...roots.find((row) => row.role === role) });
  await writeJson(join(fixture.evidence, 'managed-process-tree-before-window.json'), inventory('BEFORE_WINDOW', null, at(-20000), at(-19990), roots.map((row) => ({ ...row }))));
  await writeJson(join(fixture.evidence, 'managed-process-tree-before-shutdown.json'), inventory('BEFORE_SHUTDOWN', 'managed-process-tree-before-window.json', afterEnd(180), afterEnd(200), ['API', 'HOST_SAMPLER', 'PROCESS_SAMPLER'].map(rootMatch)));
  const finalInventory = inventory('AFTER_SHUTDOWN', 'managed-process-tree-before-shutdown.json', afterEnd(260), afterEnd(280), []);
  await writeJson(join(fixture.evidence, 'process-inventory-after.json'), finalInventory);
  const finalBytes = await readFile(join(fixture.evidence, 'process-inventory-after.json'));
  await writeJson(join(fixture.evidence, 'shutdown.json'), {
    contract: 'agm-instrumentation-lifecycle-shutdown.v2', runId, windowId: runId, capturedAt: afterEnd(300),
    boundarySignalCreatedAt: boundaryRequestedAt, releaseSignalCreatedAt: releaseRequestedAt, boundary,
    boundaryAcknowledgements: { host: hostAck, process: processAck }, forcedStopUsed: false, forcedProcessIds: [],
    cleanupErrors: [], exactKnownPidsAliveAfter: [], exactKnownIdentitiesAliveAfter: [], orphans: 0,
    diagnosticPortReleased: true,
    processes: [
      ['HOST_SAMPLER', 102], ['PROCESS_SAMPLER', 103], ['CLIENT', 104], ['API', 101],
    ].map(([role, pid]) => ({ role, pid, graceful: true, forcedStopUsed: false, aliveAfter: false, exitCode: 0, actualProcessExitCode: 0 })),
    finalInventory: {
      contract: finalInventory.contract, runId, capturePhase: 'AFTER_SHUTDOWN', queryStatus: 'SUCCESS',
      coverageStatus: finalInventory.coverageStatus, trackedClosureComplete: true, currentTrackedMatches: 0,
      p9Matches: 0, observerMatches: 0,
      evidence: { path: 'process-inventory-after.json', bytes: finalBytes.byteLength, sha256: hash(finalBytes) },
    },
  });
  await freeze(fixture.evidence);
}

async function mutateFixtureJson(fixture, name, mutate) {
  const path = join(fixture.evidence, name);
  const value = JSON.parse(await readFile(path, 'utf8'));
  mutate(value);
  await writeJson(path, value);
  await freeze(fixture.evidence);
}

const codes = (report) => report.findings.map((finding) => finding.code);

test('valid synthetic evidence remains owner-review-only with no findings', async (t) => {
  const fixture = await makeFixture(t);
  const { report } = await validateStaticGate(fixture);
  assert.equal(report.status, validatorStatus);
  assert.equal(report.nextGate, validatorStatus);
  assert.equal(report.decisionAuthority, 'PRODUCT_OWNER');
  assert.equal(/\b(?:PASS|CLOSED)\b/.test(`${report.status} ${report.nextGate}`), false);
  assert.equal(report.frozenEvidence.manifest.verified, true);
  assert.deepEqual(report.findings, []);
});

test('canonical before and after inventories are both mandatory', async (t) => {
  const fixture = await makeFixture(t);
  await rm(join(fixture.evidence, 'process-inventory-before.json'));
  await freeze(fixture.evidence);
  const { report } = await validateStaticGate(fixture);
  assert.ok(codes(report).includes('EVIDENCE_JSON_UNREADABLE'));
  assert.ok(codes(report).includes('PREFLIGHT_PROCESS_INVENTORY_INVALID'));
  assert.equal(report.canonicalInventoryPair.valid, false);
});

test('invalid canonical preflight schema fails the static gate', async (t) => {
  const fixture = await makeFixture(t);
  await mutateFixtureJson(fixture, 'process-inventory-before.json', (value) => {
    value.capturePhase = 'BEFORE_WINDOW';
    value.queryAttempts = 'invalid';
  });
  const { report } = await validateStaticGate(fixture);
  assert.ok(codes(report).includes('PREFLIGHT_PROCESS_INVENTORY_INVALID'));
  assert.equal(report.canonicalInventoryPair.before.valid, false);
});

test('valid synthetic v2 boundary protocol remains owner-review-only with no findings', async (t) => {
  const fixture = await makeFixture(t);
  await upgradeFixtureToBoundaryV2(fixture);
  const { report } = await validateStaticGate(fixture);
  assert.equal(report.status, validatorStatus);
  assert.deepEqual(report.findings, []);
  assert.equal(report.frozenEvidence.manifest.verified, true);
  assert.equal(report.observerOverhead.schema, 'V2_BOUNDARY_TAIL');
  assert.equal(report.observerOverhead.exactWindowReference, 'CLIENT_MONOTONIC_OBSERVED_DURATION_MS');
  assert.equal(report.observerOverhead.clientObservedDurationMs, 150000.75);
  assert.equal(report.observerOverhead.wallClockDurationMs, 150000);
  assert.equal(report.observerOverhead.clockDomainSkewMs, -0.75);
  assert.equal(report.processFinal.schema, 'BOUNDARY_V2');
  assert.equal(report.samplerBoundary.protocolValid, true);
});

test('future analyzer accepts v2 monotonic duration and producer-compatible root timing', async (t) => {
  const fixture = await makeFixture(t);
  await upgradeFixtureToBoundaryV2(fixture);
  const output = join(fixture.base, 'analysis-v2.json');
  const analyzer = spawnSync(process.execPath, [join(repository, 'scripts', 'analyze-instrumentation-lifecycle-cycle.mjs'), fixture.evidence, output], { encoding: 'utf8' });
  assert.equal(analyzer.status, 2);
  const analysis = JSON.parse(await readFile(output, 'utf8'));
  const issueCodes = analysis.issues.map((issue) => issue.code);
  assert.equal(issueCodes.includes('OBSERVER_OVERHEAD_EXACT_WINDOW_DURATION_INVALID'), false);
  assert.equal(issueCodes.includes('MANAGED_PROCESS_ROOT_IDENTITIES_INVALID'), false);
  assert.equal(analysis.lifecycle.observerOverhead.exactWindowDurationBound, true);
  assert.equal(analysis.lifecycle.observerOverhead.exactWindowReferenceMs, 150000.75);
  assert.equal(analysis.lifecycle.observerOverhead.clockDomainSkewMs, -0.75);
  assert.equal(analysis.lifecycle.managedRoots.valid, true);
});

test('analyzer proves full scheduling coverage with explicit boundary accounting', async (t) => {
  const fixture = await makeFixture(t);
  await upgradeFixtureToBoundaryV2(fixture);
  const output = join(fixture.base, 'analysis-scheduling.json');
  spawnSync(process.execPath, [join(repository, 'scripts', 'analyze-instrumentation-lifecycle-cycle.mjs'), fixture.evidence, output], { encoding: 'utf8' });
  const analysis = JSON.parse(await readFile(output, 'utf8'));
  const issueCodes = analysis.issues.map((issue) => issue.code);
  assert.equal(issueCodes.includes('CLIENT_SCHEDULING_WINDOW_COVERAGE_INCOMPLETE'), false);
  assert.equal(issueCodes.includes('CLIENT_SCHEDULING_DECLARED_DERIVATION_MISMATCH'), false);
  assert.equal(analysis.clientScheduling.accountedCoverageRatio, 1);
  assert.equal(analysis.clientScheduling.rawSampleRatio, 1);
});

test('analyzer rejects false scheduling coverage declarations', async (t) => {
  const fixture = await makeFixture(t);
  await upgradeFixtureToBoundaryV2(fixture);
  const clientPath = join(fixture.evidence, 'client-timeline.json');
  const client = JSON.parse(await readFile(clientPath, 'utf8'));
  client.clientRuntime.scheduling.accountedCoverageRatio = 0.5;
  await writeJson(clientPath, client);
  const output = join(fixture.base, 'analysis-scheduling-invalid.json');
  spawnSync(process.execPath, [join(repository, 'scripts', 'analyze-instrumentation-lifecycle-cycle.mjs'), fixture.evidence, output], { encoding: 'utf8' });
  const analysis = JSON.parse(await readFile(output, 'utf8'));
  assert.ok(analysis.issues.some((issue) => issue.code === 'CLIENT_SCHEDULING_DECLARED_DERIVATION_MISMATCH'
    && issue.detail?.field === 'accountedCoverageRatio'));
});

for (const [name, file, mutate, expected] of [
  ['monotonic duration mutation', 'observer-overhead.json', (value) => { value.exactWindowSeconds += 0.01; }, 'OVERHEAD_EXACT_WINDOW_DURATION_INVALID'],
  ['managed-root start-time tolerance violation', 'managed-process-roots.json', (value) => {
    value.managedRoots[0].startTimeUtc = new Date(value.managedRoots[0].creationEpochMs + 2001).toISOString();
  }, 'SAMPLER_BOUNDARY_RELEASE_PROTOCOL_INVALID'],
  ['boundary run binding mutation', 'client-boundary.json', (value) => { value.runId = 'other'; }, 'SAMPLER_BOUNDARY_RELEASE_PROTOCOL_INVALID'],
  ['process acknowledgment duration mutation', 'process-boundary-ready.json', (value) => { value.measurement.expectedDurationSeconds = 149; }, 'SAMPLER_BOUNDARY_RELEASE_PROTOCOL_INVALID'],
  ['release boundary binding mutation', 'sampler-release.json', (value) => { value.boundaryRequestedAt = start; }, 'SAMPLER_BOUNDARY_RELEASE_PROTOCOL_INVALID'],
  ['final inventory digest mutation', 'shutdown.json', (value) => { value.finalInventory.evidence.sha256 = '0'.repeat(64); }, 'SAMPLER_BOUNDARY_RELEASE_PROTOCOL_INVALID'],
]) {
  test(`v2 static gate detects ${name}`, async (t) => {
    const fixture = await makeFixture(t);
    await upgradeFixtureToBoundaryV2(fixture);
    await mutateFixtureJson(fixture, file, mutate);
    const { report } = await validateStaticGate(fixture);
    assert.ok(codes(report).includes(expected));
  });
}

test('static gate rejects an unknown shutdown contract instead of treating it as legacy', async (t) => {
  const fixture = await makeFixture(t);
  await mutateFixtureJson(fixture, 'shutdown.json', (value) => { value.contract = 'unknown'; });
  const { report } = await validateStaticGate(fixture);
  assert.ok(codes(report).includes('SHUTDOWN_CONTRACT_INVALID'));
  assert.equal(report.samplerBoundary.schema, 'SHUTDOWN_INVALID');
});

test('refuses any output inside frozen evidence', async (t) => {
  const fixture = await makeFixture(t);
  await assert.rejects(validateStaticGate({ ...fixture, output: join(fixture.evidence, 'report.json') }), /STATIC_GATE_OUTPUT_MUST_BE_OUTSIDE_FROZEN_EVIDENCE/);
});

test('detects byte tampering without rebaselining manifest', async (t) => {
  const fixture = await makeFixture(t);
  await writeFile(join(fixture.evidence, 'shutdown.json'), '{}\n');
  const { report } = await validateStaticGate(fixture);
  assert.ok(codes(report).includes('MANIFEST_HASH_MISMATCH'));
});

test('strictly rejects a manifest contract mutation', async (t) => {
  const fixture = await makeFixture(t);
  const path = join(fixture.evidence, 'SHA256SUMS.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.contract = 'wrong';
  await writeJson(path, manifest);
  const { report } = await validateStaticGate(fixture);
  assert.ok(codes(report).includes('MANIFEST_CONTRACT_INVALID'));
});

test('strictly rejects duplicate and traversal manifest entries', async (t) => {
  const fixture = await makeFixture(t);
  const path = join(fixture.evidence, 'SHA256SUMS.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.files.push({ ...manifest.files[0] }, { file: '../escape', bytes: 0, sha256: '0'.repeat(64) });
  await writeJson(path, manifest);
  const { report } = await validateStaticGate(fixture);
  assert.ok(codes(report).includes('MANIFEST_ENTRY_INVALID'));
  assert.ok(codes(report).includes('MANIFEST_ENTRY_DUPLICATE'));
});

for (const [name, mutate, expected] of [
  ['overhead contract', (value) => { value.contract = 'wrong'; }, 'OVERHEAD_CONTRACT_INVALID'],
  ['overhead runId', (value) => { value.runId = 'other'; }, 'OVERHEAD_RUN_BINDING_INVALID'],
  ['overhead declared window', (value) => { value.windowCompletedAt = '2026-08-14T00:02:30.001Z'; }, 'OVERHEAD_DECLARED_WINDOW_BINDING_INVALID'],
  ['overhead CPU derivation', (value) => { value.processes[0].cpuPercentOfOneCore = 99; }, 'OVERHEAD_DERIVATION_INVALID'],
]) {
  test(`detects ${name} violation`, async (t) => {
    const fixture = await makeFixture(t);
    const path = join(fixture.evidence, 'observer-overhead.json');
    const value = JSON.parse(await readFile(path, 'utf8'));
    mutate(value);
    await writeJson(path, value);
    await freeze(fixture.evidence);
    const { report } = await validateStaticGate(fixture);
    assert.ok(codes(report).includes(expected));
  });
}

test('requires exact process-final window binding and boundary cadence', async (t) => {
  const fixture = await makeFixture(t);
  const path = join(fixture.evidence, 'process-telemetry.jsonl');
  const row = JSON.parse((await readFile(path, 'utf8')).trim());
  delete row.windowId;
  row.captureStartedAt = '2026-08-14T00:02:31.000Z';
  row.captureCompletedAt = '2026-08-14T00:02:31.000Z';
  await writeFile(path, `${JSON.stringify(row)}\n`);
  const lifecyclePath = join(fixture.evidence, 'process-sampler-lifecycle.json');
  const lifecycle = JSON.parse(await readFile(lifecyclePath, 'utf8'));
  lifecycle.measurementBaselineAt = '2026-08-14T00:00:00.100Z';
  await writeJson(lifecyclePath, lifecycle);
  await freeze(fixture.evidence);
  const { report } = await validateStaticGate(fixture);
  assert.ok(codes(report).includes('PROCESS_FINAL_EXACT_BINDING_MISSING'));
  assert.ok(codes(report).includes('PROCESS_BASELINE_BOUNDARY_MISALIGNED'));
  assert.ok(codes(report).includes('PROCESS_FINAL_BOUNDARY_MISALIGNED'));
  assert.ok(codes(report).includes('PROCESS_CADENCE_INVALID'));
});

test('rejects temporal lineage impossible before managed roots while preserving raw evidence', async (t) => {
  const fixture = await makeFixture(t);
  const path = join(fixture.evidence, 'managed-process-tree-before-window.json');
  const value = JSON.parse(await readFile(path, 'utf8'));
  value.trackedClosure.descendantMatches.push({ pid: 500, parentPid: 101, imageName: 'msedge.exe', creationAt: '2026-08-13T20:00:00.000Z', lineage: 'CURRENT_PARENT_CHAIN' });
  value.trackedClosure.complete = false;
  await writeJson(path, value);
  await freeze(fixture.evidence);
  const { report } = await validateStaticGate(fixture);
  const finding = report.findings.find((item) => item.code === 'TEMPORALLY_IMPOSSIBLE_DESCENDANT');
  assert.equal(finding.detail.derivedClassification, 'TEMPORALLY_IMPOSSIBLE_DESCENDANT / STALE_PARENT_PID_OR_PID_REUSE');
  assert.equal(finding.detail.rawEvidencePreserved, true);
});

test('keeps PID 29020 unresolved when immutable identity evidence is absent', async (t) => {
  const fixture = await makeFixture(t);
  const path = join(fixture.evidence, 'managed-process-tree-before-shutdown.json');
  const value = JSON.parse(await readFile(path, 'utf8'));
  value.candidateCommandLinesUnavailable.push({ pid: 29020, parentPid: 1596, imageName: 'powershell.exe' });
  value.knownProtectedBackground.unclassifiedUnavailableCount = 1;
  await writeJson(path, value);
  await freeze(fixture.evidence);
  const { report } = await validateStaticGate(fixture);
  assert.equal(report.processInventory.pid29020.derivedClassification, 'TASK_SCHEDULER_CHILD_POWERSHELL / UNRESOLVED');
  assert.equal(report.processInventory.pid29020.exactCommandOrScriptProven, false);
  assert.ok(codes(report).includes('EPHEMERAL_POWERSHELL_IDENTITY_INSUFFICIENT'));
});

test('source freeze rejects an incomplete required set and records current files only as observation', async (t) => {
  const fixture = await makeFixture(t);
  const path = join(fixture.evidence, 'source-signatures.json');
  const value = JSON.parse(await readFile(path, 'utf8'));
  value.files.pop();
  await writeJson(path, value);
  await freeze(fixture.evidence);
  const { report } = await validateStaticGate(fixture);
  assert.ok(codes(report).includes('SOURCE_FREEZE_CONTRACT_OR_FILESET_INVALID'));
  assert.equal(report.sourceFreeze.currentWorkspaceObservationOnly, true);
});

test('frozen replacement fixture yields exact unresolved and temporal findings without changing raw files', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'agm-frozen-replacement-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const source = join(repository, 'evidence', 'governance', 'copilot-v1.2', 'p9', 'instrumentation-lifecycle-closure', '20260814T111028Z-p9-off-150s-replacement');
  const evidence = join(base, 'frozen-copy');
  await cp(source, evidence, { recursive: true });
  const manifestBefore = await readFile(join(evidence, 'SHA256SUMS.json'));
  const { report } = await validateStaticGate({ evidenceRoot: evidence, workspace: repository, output: join(base, 'out', 'report.json') });
  const manifestAfter = await readFile(join(evidence, 'SHA256SUMS.json'));
  assert.deepEqual(manifestAfter, manifestBefore);
  assert.equal(report.frozenEvidence.manifest.verified, true);
  assert.equal(report.processInventory.pid29020.derivedClassification, 'TASK_SCHEDULER_CHILD_POWERSHELL / UNRESOLVED');
  assert.ok(Math.abs(report.processFinal.baselineOffsetMs - 11488.6067) < 0.001);
  assert.ok(Math.abs(report.processFinal.captureStartOffsetMs - 11567.0803) < 0.001);
  assert.ok(Math.abs(report.processFinal.captureEndOffsetMs - 22286.6559) < 0.001);
  assert.ok(Math.abs(report.processFinal.cadenceSeconds - 160.801049) < 0.000001);
  assert.ok(Math.abs(report.observerOverhead.measurementStartOffsetMs - (-501.2333)) < 0.001);
  assert.ok(Math.abs(report.observerOverhead.measurementEndOffsetMs - 22464.6114) < 0.001);
  const temporal = report.processInventory.temporalReevaluations;
  assert.equal(temporal.length, 3);
  assert.deepEqual([...new Set(temporal.map((row) => row.pid))].sort((a, b) => a - b), [13464, 27892]);
  assert.equal(report.status, validatorStatus);
});

test('hash generator refuses to overwrite an existing manifest and strict verify rejects contract tamper', async (t) => {
  const fixture = await makeFixture(t);
  const script = join(repository, 'scripts', 'hash-instrumentation-lifecycle-evidence.mjs');
  const before = await readFile(join(fixture.evidence, 'SHA256SUMS.json'));
  const generate = spawnSync(process.execPath, [script, fixture.evidence], { encoding: 'utf8' });
  assert.notEqual(generate.status, 0);
  assert.deepEqual(await readFile(join(fixture.evidence, 'SHA256SUMS.json')), before);
  const manifestPath = join(fixture.evidence, 'SHA256SUMS.json');
  const manifest = JSON.parse(before.toString('utf8'));
  manifest.contract = 'wrong';
  await writeJson(manifestPath, manifest);
  const verify = spawnSync(process.execPath, [script, fixture.evidence, '--verify'], { encoding: 'utf8' });
  assert.notEqual(verify.status, 0);
  assert.match(`${verify.stdout}\n${verify.stderr}`, /EVIDENCE_MANIFEST_CONTRACT_INVALID/);
});

test('future analyzer emits the new exact-boundary and temporal findings on a frozen copy only', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'agm-analyzer-static-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const source = join(repository, 'evidence', 'governance', 'copilot-v1.2', 'p9', 'instrumentation-lifecycle-closure', '20260814T111028Z-p9-off-150s-replacement');
  const evidence = join(base, 'frozen-copy');
  await cp(source, evidence, { recursive: true });
  await rm(join(evidence, 'instrumentation-lifecycle-analysis.json'));
  const output = join(evidence, 'analysis-static-test.json');
  const analyzer = spawnSync(process.execPath, [join(repository, 'scripts', 'analyze-instrumentation-lifecycle-cycle.mjs'), evidence, output], { encoding: 'utf8' });
  assert.equal(analyzer.status, 2);
  const analysis = JSON.parse(await readFile(output, 'utf8'));
  const issueCodes = analysis.issues.map((issue) => issue.code);
  assert.ok(issueCodes.includes('PROCESS_FINAL_EXACT_WINDOW_BINDING_MISSING'));
  assert.ok(issueCodes.includes('OBSERVER_OVERHEAD_EXACT_MEASUREMENT_BOUNDARY_INVALID'));
  assert.ok(issueCodes.includes('TEMPORALLY_IMPOSSIBLE_DESCENDANT'));
  assert.equal(analysis.nextGate, 'INSTRUMENTATION LIFECYCLE CLOSURE \u2014 OWNER REVIEW');
});

test('current identity contract fails closed when CreationDate is unavailable', async () => {
  const inventory = await readFile(join(repository, 'scripts', 'Get-InstrumentationLifecycleProcessInventory.ps1'), 'utf8');
  assert.match(inventory, /reason = 'CREATION_DATE_UNAVAILABLE'/);
  assert.match(inventory, /if \(\$resolved\.reason -eq 'CREATION_DATE_MISMATCH'\) \{ \$pidReuseCollisions\.Add\(\$record\) \} else \{/);
  assert.match(inventory, /complete = \(\$currentTrackedMatches -eq 0 -and \$orderedUnverified\.Count -eq 0 -and \$orderedPriorFailures\.Count -eq 0\)/);
  assert.match(inventory, /capturePhase = if \(\$Phase\)/);
  assert.doesNotMatch(inventory, /Sort-Object\s+pid\s+-Unique/);
});

test('current client and closure runner encode the exact two-phase boundary protocol', async () => {
  const client = await readFile(join(repository, 'scripts', 'instrumentation-lifecycle-probe.mjs'), 'utf8');
  const runner = await readFile(join(repository, 'scripts', 'Invoke-InstrumentationLifecycleClosure.ps1'), 'utf8');
  assert.ok(client.indexOf('await publishJsonAtomic(configuration.boundarySignal, boundaryEvidence)') >= 0);
  assert.ok(client.indexOf('await publishJsonAtomic(configuration.boundarySignal, boundaryEvidence)') < client.indexOf("type: 'window.complete'"));
  assert.match(client, /rename\(temporaryPath, path\)/);
  assert.match(runner, /measurement\.baseline\.scheduledAt\)\.ToUnixTimeMilliseconds\(\) -ne \$scheduledStart\.ToUnixTimeMilliseconds\(\)/);
  const ack = runner.indexOf("throw 'SAMPLER_BOUNDARY_ACK_TIMEOUT'");
  const inventory = runner.indexOf("-Phase 'BEFORE_SHUTDOWN'", ack);
  const release = runner.indexOf("reason = 'PRE_SHUTDOWN_INVENTORY_CAPTURED_AFTER_BOUNDARY_ACK'", inventory);
  assert.ok(ack >= 0 && inventory > ack && release > inventory);
  assert.match(runner, /contract = 'agm-instrumentation-lifecycle-shutdown\.v3'[\s\S]*?runId = \$runId[\s\S]*?windowId = \$runId/);
});

test('current samplers encode absolute cadence, formal baseline, boundary final, quiescence, and release', async () => {
  const host = await readFile(join(repository, 'scripts', 'Sample-RealBasicHost.ps1'), 'utf8');
  const processes = await readFile(join(repository, 'scripts', 'Sample-RealBasicProcesses.ps1'), 'utf8');
  const generic = await readFile(join(repository, 'scripts', 'Invoke-RealBasicTimeoutInvestigation.ps1'), 'utf8');
  assert.match(host, /ABSOLUTE_MONOTONIC_NO_CATCH_UP_BURST/);
  assert.match(host, /SampleKind 'BOUNDARY_FINAL'/);
  assert.ok(host.indexOf("SampleKind 'BOUNDARY_FINAL'") < host.indexOf('$releaseResult = Wait-ForReleaseSignal'));
  assert.match(processes, /SampleKind 'READINESS_BASELINE'/);
  assert.match(processes, /SampleKind 'FORMAL_BASELINE'/);
  assert.match(processes, /SampleKind 'MEASUREMENT_FINAL'/);
  assert.match(processes, /NON_ATOMIC_PROCESS_ENUMERATION_START_TO_START_DENOMINATOR/);
  assert.match(processes, /Convert-CadenceSecondsEvidenceValue \$CadenceSeconds/);
  assert.doesNotMatch(processes, /\$CadenceSeconds\.Value|\$ScheduledAt\.Value/);
  assert.ok(processes.indexOf("SampleKind 'MEASUREMENT_FINAL'") < processes.indexOf('$releaseResult = Wait-ForReleaseSignal'));
  assert.match(generic, /\$expectedScheduledGapSeconds = 5 \* \(1 \+ \[int\]\$tail\[1\]\.missedSlots\)/);
  assert.match(generic, /samplerStartTimeUtc -ne \$hostSampler\.StartTime/);
  assert.match(generic, /GENERIC_SAMPLER_BOUNDARY_ACK_INVALID/);
});

test('current runner enforces canonical preflight before any window admission', async () => {
  const runner = await readFile(join(repository, 'scripts', 'Invoke-InstrumentationLifecycleClosure.ps1'), 'utf8');
  const canonical = runner.indexOf("'process-inventory-before.json'");
  const filenameGate = runner.indexOf("throw 'PREFLIGHT_CANONICAL_FILENAME_REQUIRED'");
  const schemaGate = runner.indexOf("throw 'PREFLIGHT_PROCESS_SCHEMA_INVALID'");
  const firstRuntimeLaunch = runner.indexOf('Start-Process', schemaGate);
  assert.ok(canonical >= 0 && filenameGate > canonical && schemaGate > filenameGate);
  assert.ok(firstRuntimeLaunch > schemaGate);
  assert.match(runner, /capturePhase -ne 'PREFLIGHT'/);
  assert.match(runner, /identityContract -ne 'agm-instrumentation-sanitized-process-identity\.v2'/);
});

test('scheduling coverage is temporal and preserves raw coalesced-slot evidence', async () => {
  const client = await readFile(join(repository, 'scripts', 'instrumentation-lifecycle-probe.mjs'), 'utf8');
  const analyzer = await readFile(join(repository, 'scripts', 'analyze-instrumentation-lifecycle-cycle.mjs'), 'utf8');
  for (const source of [client, analyzer]) {
    assert.match(source, /agm-client-scheduling-temporal-coverage\.v1/);
    assert.match(source, /CONTIGUOUS_OBSERVED_INTERVALS_PLUS_EXPLICIT_BOUNDARY_EXCLUSIONS/);
    assert.match(source, /BOUNDARY_HEAD_BEFORE_FIRST_INTERVAL/);
    assert.match(source, /BOUNDARY_TAIL_AFTER_LAST_COMPLETE_INTERVAL/);
    assert.match(source, /CLOCK_DOMAIN_ROUNDING_SKEW/);
    assert.match(source, /coalescedTimerSlots/);
    assert.match(source, /accountedCoverageRatio/);
  }
  assert.match(analyzer, /CLIENT_SCHEDULING_WINDOW_COVERAGE_INCOMPLETE/);
  assert.match(analyzer, /CLIENT_SCHEDULING_DECLARED_DERIVATION_MISMATCH/);
});

test('preventive nullable audit permits only guarded environment item Value access', async () => {
  const files = [
    'Invoke-InstrumentationLifecycleClosure.ps1',
    'Invoke-RealBasicTimeoutInvestigation.ps1',
    'Sample-RealBasicHost.ps1',
    'Sample-RealBasicProcesses.ps1',
    'Get-InstrumentationLifecycleProcessInventory.ps1',
  ];
  const findings = [];
  for (const name of files) {
    const source = await readFile(join(repository, 'scripts', name), 'utf8');
    source.split(/\r?\n/).forEach((line, index) => {
      if (/\.Value\b/.test(line) && !/if \(\$null -ne \$environmentItem\) \{ \$environmentItem\.Value \}/.test(line)) {
        findings.push(`${name}:${index + 1}:${line.trim()}`);
      }
    });
  }
  assert.deepEqual(findings, []);
});

test('current analyzer and static validator consume v2 identity, cadence, sidecars, and final inventory', async () => {
  const analyzer = await readFile(join(repository, 'scripts', 'analyze-instrumentation-lifecycle-cycle.mjs'), 'utf8');
  const validator = await readFile(join(repository, 'scripts', 'validate-instrumentation-lifecycle-static-gate.mjs'), 'utf8');
  for (const token of ['client-boundary.json', 'sampler-release.json', 'host-boundary-ready.json', 'process-boundary-ready.json', 'process-inventory-after.json']) {
    assert.ok(analyzer.includes(token), `analyzer missing ${token}`);
    assert.ok(validator.includes(token), `validator missing ${token}`);
  }
  for (const token of ['FORMAL_BASELINE', 'MEASUREMENT_FINAL', 'expectedDurationSeconds', 'snapshotSemantics', 'capturePhase', 'CREATION_DATE_UNAVAILABLE']) {
    assert.ok(token === 'CREATION_DATE_UNAVAILABLE' || analyzer.includes(token), `analyzer missing ${token}`);
  }
  assert.match(analyzer, /shutdown\.runId === runId[\s\S]*?shutdown\.windowId === runId/);
  assert.match(validator, /managedRootsValid[\s\S]*?shutdownValid[\s\S]*?finalClosureValid/);
});
