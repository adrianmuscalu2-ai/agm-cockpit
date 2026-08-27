import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const STATUS = 'INSTRUMENTATION LIFECYCLE STATIC GATE \u2014 OWNER REVIEW';
const MANIFEST = 'SHA256SUMS.json';
const MANIFEST_CONTRACT = 'agm-instrumentation-lifecycle-closure-evidence-hashes.v1';
const OVERHEAD_CONTRACT = 'agm-instrumentation-lifecycle-observer-overhead.v1';
const OVERHEAD_CONTRACT_V2 = 'agm-instrumentation-lifecycle-observer-overhead.v2';
const INVENTORY_CONTRACT = 'agm-instrumentation-lifecycle-process-inventory.v1';
const INVENTORY_CONTRACT_V2 = 'agm-instrumentation-lifecycle-process-inventory.v2';
const PROCESS_CONTRACT = 'agm-real-basic-process-sample.v1';
const REQUIRED_SOURCE_PATHS = [
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

function parseArguments(argv) {
  const options = { evidenceRoot: null, workspace: process.cwd(), output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--') && options.evidenceRoot === null) options.evidenceRoot = value;
    else if (value === '--workspace') options.workspace = argv[++index];
    else if (value === '--output') options.output = argv[++index];
    else throw new Error(`ARGUMENT_UNEXPECTED:${value}`);
  }
  if (!options.evidenceRoot) throw new Error('FROZEN_EVIDENCE_ROOT_REQUIRED');
  if (!options.output) throw new Error('STATIC_GATE_OUTPUT_REQUIRED');
  return options;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const finite = (value) => typeof value === 'number' && Number.isFinite(value)
  ? value
  : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : null;
const epoch = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value) return null;
  const precise = value.match(/^(.*:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/);
  if (precise) {
    const wholeSecond = Date.parse(`${precise[1]}${precise[3]}`);
    if (Number.isFinite(wholeSecond)) {
      const fractionalMilliseconds = precise[2] ? Number(`0.${precise[2]}`) * 1000 : 0;
      return wholeSecond + fractionalMilliseconds;
    }
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const round = (value, digits = 3) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const normalizedRelativePath = (value) => typeof value === 'string'
  && value.length > 0
  && !isAbsolute(value)
  && !value.includes('\\')
  && !value.includes('\0')
  && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
const isWithin = (parent, candidate) => {
  const rel = relative(resolve(parent), resolve(candidate));
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
};

async function loadJson(path, findings, label) {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  } catch (error) {
    findings.push({ code: 'EVIDENCE_JSON_UNREADABLE', detail: { label, error: error instanceof Error ? error.message : String(error) } });
    return null;
  }
}

async function loadJsonLines(path, findings, label) {
  try {
    const records = [];
    const invalidLines = [];
    const text = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
    text.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      try { records.push(JSON.parse(line)); }
      catch { invalidLines.push(index + 1); }
    });
    if (invalidLines.length) findings.push({ code: 'EVIDENCE_JSONL_INVALID', detail: { label, invalidLines } });
    return records;
  } catch (error) {
    findings.push({ code: 'EVIDENCE_JSONL_UNREADABLE', detail: { label, error: error instanceof Error ? error.message : String(error) } });
    return [];
  }
}

async function collectFiles(root, findings, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (directory === root && entry.name === MANIFEST) continue;
    const full = resolve(directory, entry.name);
    const info = await lstat(full);
    if (info.isSymbolicLink()) {
      findings.push({ code: 'MANIFEST_FILESYSTEM_LINK_REJECTED', detail: relative(root, full).replaceAll('\\', '/') });
      continue;
    }
    if (info.isDirectory()) files.push(...await collectFiles(root, findings, full));
    else if (info.isFile()) files.push(full);
    else findings.push({ code: 'MANIFEST_NONREGULAR_FILE_REJECTED', detail: relative(root, full).replaceAll('\\', '/') });
  }
  return files;
}

async function verifyManifest(root, findings) {
  const manifestPath = resolve(root, MANIFEST);
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8').replace(/^\uFEFF/, ''));
  if (manifest.contract !== MANIFEST_CONTRACT || manifest.immutableAfterHash !== true || epoch(manifest.generatedAt) === null) {
    findings.push({ code: 'MANIFEST_CONTRACT_INVALID' });
  }
  const entries = Array.isArray(manifest.files) ? manifest.files : [];
  const entryPaths = entries.map((entry) => entry?.file);
  const pathsValid = entries.length > 0 && entries.every((entry) => normalizedRelativePath(entry?.file)
    && Number.isSafeInteger(entry?.bytes) && entry.bytes >= 0
    && typeof entry?.sha256 === 'string' && /^[0-9a-f]{64}$/.test(entry.sha256));
  if (!pathsValid) findings.push({ code: 'MANIFEST_ENTRY_INVALID' });
  if (new Set(entryPaths).size !== entryPaths.length) findings.push({ code: 'MANIFEST_ENTRY_DUPLICATE' });
  if (entryPaths.some((value, index) => index > 0 && String(entryPaths[index - 1]) > String(value))) {
    findings.push({ code: 'MANIFEST_ENTRIES_NOT_SORTED' });
  }

  const actualPaths = (await collectFiles(root, findings))
    .map((path) => relative(root, path).replaceAll('\\', '/'))
    .sort();
  const declaredPaths = [...entryPaths].sort();
  const fileSetMatches = JSON.stringify(actualPaths) === JSON.stringify(declaredPaths);
  if (!fileSetMatches) findings.push({ code: 'MANIFEST_FILESET_MISMATCH', detail: { declared: declaredPaths, actual: actualPaths } });

  let matched = 0;
  for (const entry of entries) {
    if (!normalizedRelativePath(entry?.file)) continue;
    const path = resolve(root, ...entry.file.split('/'));
    if (!isWithin(root, path)) {
      findings.push({ code: 'MANIFEST_PATH_ESCAPE', detail: entry.file });
      continue;
    }
    try {
      const canonicalRoot = await realpath(root);
      const canonicalFile = await realpath(path);
      if (!isWithin(canonicalRoot, canonicalFile)) {
        findings.push({ code: 'MANIFEST_PATH_ESCAPE', detail: entry.file });
        continue;
      }
      const info = await stat(path);
      const bytes = await readFile(path);
      const actual = { bytes: info.size, sha256: sha256(bytes) };
      if (actual.bytes !== entry.bytes || actual.sha256 !== entry.sha256) {
        findings.push({ code: 'MANIFEST_HASH_MISMATCH', detail: { file: entry.file, expected: { bytes: entry.bytes, sha256: entry.sha256 }, actual } });
      } else matched += 1;
    } catch (error) {
      findings.push({ code: 'MANIFEST_FILE_UNREADABLE', detail: { file: entry.file, error: error instanceof Error ? error.message : String(error) } });
    }
  }
  return {
    contract: manifest.contract ?? null,
    immutableAfterHash: manifest.immutableAfterHash === true,
    generatedAt: manifest.generatedAt ?? null,
    manifestSha256: sha256(manifestBytes),
    declaredFiles: entries.length,
    matchedFiles: matched,
    exactFileSet: fileSetMatches,
    verified: pathsValid && fileSetMatches && matched === entries.length,
  };
}

function addFinding(findings, code, detail = undefined) {
  findings.push(detail === undefined ? { code } : { code, detail });
}

function evaluateOverhead({ overhead, client, hostLifecycle, processLifecycle, managedRoots }, findings) {
  const runId = client?.runId ?? null;
  const start = epoch(client?.window?.actualStartedAt);
  const end = epoch(client?.window?.completedAt);
  const capturedStart = epoch(overhead?.capturedAtStart);
  const capturedEnd = epoch(overhead?.capturedAtEnd);
  const declaredStart = epoch(overhead?.windowStartedAt);
  const declaredEnd = epoch(overhead?.windowCompletedAt);
  const startOffsetMs = capturedStart === null || start === null ? null : capturedStart - start;
  const endOffsetMs = capturedEnd === null || end === null ? null : capturedEnd - end;
  const measurementWallSeconds = capturedStart === null || capturedEnd === null ? null : (capturedEnd - capturedStart) / 1000;
  const formalSeconds = start === null || end === null ? null : (end - start) / 1000;
  const clientObservedDurationMs = finite(client?.window?.observedDurationMs);
  const rows = Array.isArray(overhead?.processes) ? overhead.processes : [];
  const byRole = new Map();
  for (const row of rows) {
    const role = String(row?.role ?? '').toUpperCase();
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role).push(row);
  }
  const roots = new Map((Array.isArray(managedRoots?.managedRoots) ? managedRoots.managedRoots : []).map((row) => [String(row.role), row]));
  const hostRows = byRole.get('HOST_SAMPLER') ?? [];
  const processRows = byRole.get('PROCESS_SAMPLER') ?? [];

  const v2 = overhead?.contract === OVERHEAD_CONTRACT_V2;
  if (![OVERHEAD_CONTRACT, OVERHEAD_CONTRACT_V2].includes(overhead?.contract)) addFinding(findings, 'OVERHEAD_CONTRACT_INVALID', overhead?.contract ?? null);
  if (!runId || overhead?.runId !== runId) addFinding(findings, 'OVERHEAD_RUN_BINDING_INVALID', { expected: runId, actual: overhead?.runId ?? null });
  if (v2 && overhead?.windowId !== runId) addFinding(findings, 'OVERHEAD_WINDOW_ID_BINDING_INVALID', overhead?.windowId ?? null);
  if (declaredStart !== start || declaredEnd !== end) addFinding(findings, 'OVERHEAD_DECLARED_WINDOW_BINDING_INVALID');
  const exactWindowReferenceMs = v2 ? clientObservedDurationMs : formalSeconds === null ? null : formalSeconds * 1000;
  if (exactWindowReferenceMs === null || finite(overhead?.exactWindowSeconds) === null
    || Math.abs((overhead.exactWindowSeconds * 1000) - exactWindowReferenceMs) > 0.001) {
    addFinding(findings, 'OVERHEAD_EXACT_WINDOW_DURATION_INVALID', {
      reference: v2 ? 'CLIENT_MONOTONIC_OBSERVED_DURATION_MS' : 'LEGACY_WALL_CLOCK_DURATION_MS',
      referenceMs: exactWindowReferenceMs,
      wallClockMs: formalSeconds === null ? null : formalSeconds * 1000,
      clientObservedDurationMs,
      declaredSeconds: overhead?.exactWindowSeconds ?? null,
    });
  }
  if (startOffsetMs === null || endOffsetMs === null || Math.abs(startOffsetMs) > (v2 ? 250 : 1)
    || (v2 ? endOffsetMs < 0 || endOffsetMs > 250 : Math.abs(endOffsetMs) > 1)) {
    addFinding(findings, 'OVERHEAD_MEASUREMENT_BOUNDARY_INVALID', { startOffsetMs: round(startOffsetMs, 6), endOffsetMs: round(endOffsetMs, 6) });
  }
  if (measurementWallSeconds === null || finite(overhead?.wallSeconds) === null || Math.abs(measurementWallSeconds - overhead.wallSeconds) > 0.001) {
    addFinding(findings, 'OVERHEAD_MEASUREMENT_WALL_INVALID', { measured: measurementWallSeconds, declared: overhead?.wallSeconds ?? null });
  }
  if (v2) {
    const v2Bound = overhead?.boundary?.contract === 'agm-instrumentation-lifecycle-sampler-boundary.v1'
      && epoch(overhead?.boundary?.clientCompletedAt) === end
      && epoch(overhead?.formalWindow?.declaredStartedAt) === start
      && epoch(overhead?.formalWindow?.declaredCompletedAt) === end
      && epoch(overhead?.formalWindow?.cpuSnapshotStartedAt) === capturedStart
      && epoch(overhead?.formalWindow?.cpuSnapshotCompletedAt) === capturedEnd
      && epoch(overhead?.finalizationTail?.startedAt) === capturedEnd
      && epoch(overhead?.finalizationTail?.completedAt) !== null
      && finite(overhead?.finalizationTail?.wallSeconds) !== null;
    if (!v2Bound) addFinding(findings, 'OVERHEAD_V2_BOUNDARY_OR_TAIL_INVALID');
  }
  if (hostRows.length !== 1 || processRows.length !== 1) addFinding(findings, 'OVERHEAD_ROLE_CARDINALITY_INVALID', { host: hostRows.length, process: processRows.length });

  const derivations = [];
  for (const [role, selected, lifecycle] of [
    ['HOST_SAMPLER', hostRows[0], hostLifecycle],
    ['PROCESS_SAMPLER', processRows[0], processLifecycle],
  ]) {
    if (!selected) continue;
    const expectedPid = finite(lifecycle?.samplerPid) ?? finite(roots.get(role)?.pid);
    const pidBound = finite(selected.pid) === expectedPid && expectedPid !== null;
    const delta = finite(selected.cpuSecondsDelta);
    const derivedOneCore = delta === null || finite(overhead?.wallSeconds) === null ? null : (delta / overhead.wallSeconds) * 100;
    const declaredOneCore = finite(selected.cpuPercentOfOneCore);
    const consistent = delta !== null && delta >= 0 && declaredOneCore !== null && Math.abs(derivedOneCore - declaredOneCore) <= 0.001;
    derivations.push({ role, pid: finite(selected.pid), expectedPid, pidBound, cpuSecondsDelta: delta, declaredOneCore, derivedOneCore: round(derivedOneCore, 6), consistent });
    if (!pidBound) addFinding(findings, 'OVERHEAD_PID_BINDING_INVALID', { role, expectedPid, actual: selected.pid ?? null });
    if (!consistent) addFinding(findings, 'OVERHEAD_DERIVATION_INVALID', { role, delta, declaredOneCore, derivedOneCore });
  }
  return {
    contract: overhead?.contract ?? null,
    schema: v2 ? 'V2_BOUNDARY_TAIL' : 'V1_LEGACY',
    runId: overhead?.runId ?? null,
    declaredWindowBound: declaredStart === start && declaredEnd === end,
    formalSeconds: round(formalSeconds, 6),
    exactWindowSeconds: finite(overhead?.exactWindowSeconds),
    exactWindowReference: v2 ? 'CLIENT_MONOTONIC_OBSERVED_DURATION_MS' : 'LEGACY_WALL_CLOCK_DURATION_MS',
    clientObservedDurationMs,
    wallClockDurationMs: round(formalSeconds === null ? null : formalSeconds * 1000, 6),
    clockDomainSkewMs: round(formalSeconds === null || clientObservedDurationMs === null ? null : (formalSeconds * 1000) - clientObservedDurationMs, 6),
    measurementWallSeconds: round(measurementWallSeconds, 6),
    declaredWallSeconds: finite(overhead?.wallSeconds),
    measurementStartOffsetMs: round(startOffsetMs, 6),
    measurementEndOffsetMs: round(endOffsetMs, 6),
    samplerDerivations: derivations,
  };
}

function evaluateProcessFinal({ records, lifecycle, client, managedRoots }, findings) {
  const runId = client?.runId ?? null;
  const start = epoch(client?.window?.actualStartedAt);
  const end = epoch(client?.window?.completedAt);
  const boundarySchema = lifecycle?.boundarySignalRequired === true
    || records.some((row) => ['READINESS_BASELINE', 'FORMAL_BASELINE', 'MEASUREMENT_FINAL'].includes(row?.sampleKind));
  const measurements = records.filter((row) => row?.sampleKind === (boundarySchema ? 'MEASUREMENT_FINAL' : 'MEASUREMENT'));
  const formalBaselines = boundarySchema ? records.filter((row) => row?.sampleKind === 'FORMAL_BASELINE') : [];
  const formalBaseline = boundarySchema && formalBaselines.length === 1 ? formalBaselines[0] : null;
  if (boundarySchema && formalBaselines.length !== 1) addFinding(findings, 'PROCESS_FORMAL_BASELINE_CARDINALITY_INVALID', formalBaselines.length);
  const final = measurements.length === 1 ? measurements[0] : null;
  if (measurements.length !== 1) addFinding(findings, 'PROCESS_FINAL_CARDINALITY_INVALID', measurements.length);
  const roots = new Map((Array.isArray(managedRoots?.managedRoots) ? managedRoots.managedRoots : []).map((row) => [String(row.role), row]));
  const expectedPid = finite(lifecycle?.samplerPid) ?? finite(roots.get('PROCESS_SAMPLER')?.pid);
  if (final && (final.contract !== PROCESS_CONTRACT || final.runId !== runId || finite(final.samplerPid) !== expectedPid)) {
    addFinding(findings, 'PROCESS_FINAL_IDENTITY_INVALID');
  }
  const explicitWindowBound = boundarySchema
    ? formalBaseline !== null && final !== null
      && epoch(formalBaseline.scheduledAt) === epoch(client?.window?.scheduledStartAt)
      && epoch(final.scheduledAt) === end
      && epoch(lifecycle?.boundaryClientCompletedAt) === end
      && finite(lifecycle?.boundaryFinalSequence) === finite(final.sequence)
      && epoch(lifecycle?.measurementBaselineAt) === epoch(formalBaseline.captureStartedAt)
      && epoch(lifecycle?.measurementFinalAt) === epoch(final.captureStartedAt)
      && epoch(lifecycle?.measurementFinalCompletedAt) === epoch(final.captureCompletedAt)
    : final?.windowId === runId
      && epoch(final?.formalWindowStartedAt) === start
      && epoch(final?.formalWindowCompletedAt) === end;
  if (!explicitWindowBound) addFinding(findings, 'PROCESS_FINAL_EXACT_BINDING_MISSING');
  const baseline = epoch(lifecycle?.measurementBaselineAt) ?? epoch(formalBaseline?.captureStartedAt) ?? epoch(final?.windowStartedAt);
  const captureStart = epoch(final?.captureStartedAt);
  const captureEnd = epoch(final?.captureCompletedAt);
  const baselineOffsetMs = baseline === null || start === null ? null : baseline - start;
  const captureStartOffsetMs = captureStart === null || end === null ? null : captureStart - end;
  const captureEndOffsetMs = captureEnd === null || end === null ? null : captureEnd - end;
  const derivedStartCadenceSeconds = baseline === null || captureStart === null ? null : (captureStart - baseline) / 1000;
  const cadenceSeconds = boundarySchema
    ? finite(final?.cadenceSeconds) ?? finite(lifecycle?.measurementCadenceSeconds) ?? derivedStartCadenceSeconds
    : baseline === null || captureEnd === null ? null : (captureEnd - baseline) / 1000;
  if (baselineOffsetMs === null || Math.abs(baselineOffsetMs) > (boundarySchema ? 1000 : 1)) addFinding(findings, 'PROCESS_BASELINE_BOUNDARY_MISALIGNED', round(baselineOffsetMs, 6));
  if ((boundarySchema ? captureStartOffsetMs === null || captureStartOffsetMs < 0 || captureStartOffsetMs > 1000 : captureEndOffsetMs === null || Math.abs(captureEndOffsetMs) > 1)) {
    addFinding(findings, 'PROCESS_FINAL_BOUNDARY_MISALIGNED', { captureStartOffsetMs: round(captureStartOffsetMs, 6), captureEndOffsetMs: round(captureEndOffsetMs, 6) });
  }
  if (cadenceSeconds === null || Math.abs(cadenceSeconds - 150) > (boundarySchema ? 1 : 0.001)) addFinding(findings, 'PROCESS_CADENCE_INVALID', round(cadenceSeconds, 6));
  if (boundarySchema && derivedStartCadenceSeconds !== null && Math.abs(cadenceSeconds - derivedStartCadenceSeconds) > 0.001) {
    addFinding(findings, 'PROCESS_CADENCE_DERIVATION_INVALID', { declared: cadenceSeconds, derived: derivedStartCadenceSeconds });
  }
  return {
    schema: boundarySchema ? 'BOUNDARY_V2' : 'LEGACY',
    measurements: measurements.length,
    explicitWindowBound,
    expectedPid,
    baselineAt: baseline === null ? null : new Date(baseline).toISOString(),
    baselineOffsetMs: round(baselineOffsetMs, 6),
    captureStartedAt: captureStart === null ? null : new Date(captureStart).toISOString(),
    captureStartOffsetMs: round(captureStartOffsetMs, 6),
    captureCompletedAt: captureEnd === null ? null : new Date(captureEnd).toISOString(),
    captureEndOffsetMs: round(captureEndOffsetMs, 6),
    cadenceSeconds: round(cadenceSeconds, 6),
    derivedStartCadenceSeconds: round(derivedStartCadenceSeconds, 6),
    finalizationTailMs: captureStart === null || captureEnd === null ? null : round(captureEnd - captureStart, 6),
  };
}

function evaluateInventories({ inventories, managedRoots, runId, knownBackground }, findings) {
  const earliestRoot = Math.min(...(Array.isArray(managedRoots?.managedRoots) ? managedRoots.managedRoots : [])
    .map((row) => epoch(row.startTimeUtc)).filter(Number.isFinite));
  const temporalReevaluations = [];
  const phases = [];
  const expectedPrior = new Map([
    ['BEFORE_WINDOW', null],
    ['BEFORE_SHUTDOWN', 'managed-process-tree-before-window.json'],
    ['AFTER_SHUTDOWN', 'managed-process-tree-before-shutdown.json'],
  ]);
  for (const item of inventories) {
    const document = item.document ?? {};
    const hasRunBinding = Object.prototype.hasOwnProperty.call(document, 'runId');
    const hasPhaseBinding = Object.prototype.hasOwnProperty.call(document, 'capturePhase');
    if (![INVENTORY_CONTRACT, INVENTORY_CONTRACT_V2].includes(document.contract)) addFinding(findings, 'INVENTORY_CONTRACT_INVALID', item.phase);
    if (document.contract === INVENTORY_CONTRACT_V2 && document.identityContract !== 'agm-instrumentation-sanitized-process-identity.v2') {
      addFinding(findings, 'INVENTORY_IDENTITY_CONTRACT_INVALID', item.phase);
    }
    if (!hasRunBinding) addFinding(findings, 'INVENTORY_RUN_BINDING_MISSING', item.phase);
    else if (document.runId !== runId) addFinding(findings, 'INVENTORY_RUN_BINDING_INVALID', item.phase);
    if (!hasPhaseBinding) addFinding(findings, 'INVENTORY_PHASE_BINDING_MISSING', item.phase);
    else if (document.capturePhase !== item.phase) addFinding(findings, 'INVENTORY_PHASE_BINDING_INVALID', item.phase);
    const priorName = typeof document?.trackedClosure?.priorInventorySource === 'string'
      ? basename(document.trackedClosure.priorInventorySource)
      : null;
    if (expectedPrior.get(item.phase) !== priorName) addFinding(findings, 'INVENTORY_CHAIN_BINDING_INVALID', { phase: item.phase, expected: expectedPrior.get(item.phase), actual: priorName });
    const descendants = Array.isArray(document?.trackedClosure?.descendantMatches) ? document.trackedClosure.descendantMatches : [];
    for (const descendant of descendants) {
      const created = epoch(descendant.creationAt);
      if (Number.isFinite(earliestRoot) && created !== null && created < earliestRoot) {
        const reevaluation = {
          phase: item.phase,
          pid: finite(descendant.pid),
          parentPid: finite(descendant.parentPid),
          imageName: descendant.imageName ?? null,
          creationAt: descendant.creationAt ?? null,
          rawLineage: descendant.lineage ?? null,
          earliestManagedRootAt: new Date(earliestRoot).toISOString(),
          predatesEarliestManagedRootSeconds: round((earliestRoot - created) / 1000, 3),
          derivedClassification: 'TEMPORALLY_IMPOSSIBLE_DESCENDANT / STALE_PARENT_PID_OR_PID_REUSE',
          excludedFromDerivedLiveDescendantCount: true,
          rawEvidencePreserved: true,
        };
        temporalReevaluations.push(reevaluation);
        addFinding(findings, 'TEMPORALLY_IMPOSSIBLE_DESCENDANT', reevaluation);
      }
    }
    phases.push({
      phase: item.phase,
      queryStatus: document.queryStatus ?? null,
      coverageStatus: document.coverageStatus ?? null,
      runBindingPresent: hasRunBinding,
      phaseBindingPresent: hasPhaseBinding,
      priorInventoryName: priorName,
      rawTrackedComplete: document?.trackedClosure?.complete ?? null,
      rawDescendants: descendants.length,
      unclassifiedUnavailable: finite(document?.knownProtectedBackground?.unclassifiedUnavailableCount),
    });
  }

  const preShutdown = inventories.find((item) => item.phase === 'BEFORE_SHUTDOWN')?.document ?? {};
  const taskSchedulerPid = finite(knownBackground?.source?.taskScheduler?.servicePid);
  const unresolved = (Array.isArray(preShutdown.candidateCommandLinesUnavailable) ? preShutdown.candidateCommandLinesUnavailable : [])
    .find((row) => finite(row.pid) === 29020);
  let pid29020 = { present: false };
  if (unresolved) {
    pid29020 = {
      present: true,
      pid: 29020,
      parentPid: finite(unresolved.parentPid),
      imageName: unresolved.imageName ?? null,
      parentMatchesRecordedTaskScheduler: finite(unresolved.parentPid) === taskSchedulerPid,
      creationAt: unresolved.creationAt ?? null,
      creationEpochMs: finite(unresolved.creationEpochMs),
      executablePathSha256: unresolved.executablePathSha256 ?? null,
      commandLineSha256: unresolved.commandLineSha256 ?? null,
      identityStrength: unresolved.identityStrength ?? null,
      identitySha256: unresolved.identitySha256 ?? null,
      derivedClassification: 'TASK_SCHEDULER_CHILD_POWERSHELL / UNRESOLVED',
      exactCommandOrScriptProven: false,
      rawFailurePreserved: true,
    };
    addFinding(findings, 'EPHEMERAL_POWERSHELL_IDENTITY_INSUFFICIENT', pid29020);
  }
  return { phases, temporalReevaluations, pid29020 };
}

async function evaluateSourceFreeze({ sourceSignatures, replacementChecks, workspace }, findings) {
  const entries = Array.isArray(sourceSignatures?.files) ? sourceSignatures.files : [];
  const paths = entries.map((row) => row?.path);
  const unique = new Set(paths).size === paths.length;
  const requiredSetExact = JSON.stringify([...paths].sort()) === JSON.stringify(REQUIRED_SOURCE_PATHS);
  if (sourceSignatures?.contract !== 'agm-instrumentation-lifecycle-source-signatures.v1' || !unique || !requiredSetExact) {
    addFinding(findings, 'SOURCE_FREEZE_CONTRACT_OR_FILESET_INVALID');
  }
  const current = [];
  for (const entry of entries) {
    if (!normalizedRelativePath(entry?.path) || !/^[0-9a-f]{64}$/.test(String(entry?.sha256 ?? '')) || !Number.isSafeInteger(entry?.bytes)) {
      addFinding(findings, 'SOURCE_FREEZE_ENTRY_INVALID', entry?.path ?? null);
      continue;
    }
    const path = resolve(workspace, ...entry.path.split('/'));
    if (!isWithin(workspace, path)) {
      addFinding(findings, 'SOURCE_FREEZE_PATH_ESCAPE', entry.path);
      continue;
    }
    try {
      const bytes = await readFile(path);
      current.push({ path: entry.path, recordedBytes: entry.bytes, currentBytes: bytes.length, recordedSha256: entry.sha256, currentSha256: sha256(bytes), matchesRecorded: bytes.length === entry.bytes && sha256(bytes) === entry.sha256 });
    } catch (error) {
      current.push({ path: entry.path, matchesRecorded: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const byPath = new Map(entries.map((row) => [row.path, row]));
  const replacementRunner = replacementChecks?.sourceFreeze?.runnerSha256 ?? null;
  const replacementAnalyzer = replacementChecks?.sourceFreeze?.analyzerSha256 ?? null;
  const replacementBindings = {
    runner: replacementRunner !== null && replacementRunner === byPath.get('scripts/Invoke-InstrumentationLifecycleClosure.ps1')?.sha256,
    analyzer: replacementAnalyzer !== null && replacementAnalyzer === byPath.get('scripts/analyze-instrumentation-lifecycle-cycle.mjs')?.sha256,
  };
  if (!replacementBindings.runner || !replacementBindings.analyzer) addFinding(findings, 'SOURCE_FREEZE_REPLACEMENT_BINDING_INVALID', replacementBindings);
  return {
    contract: sourceSignatures?.contract ?? null,
    recordedFiles: entries.length,
    uniquePaths: unique,
    requiredFileSetExact: requiredSetExact,
    replacementBindings,
    currentWorkspaceObservationOnly: true,
    currentMatchesRecorded: current.filter((row) => row.matchesRecorded).length,
    currentDiffersFromRecorded: current.filter((row) => !row.matchesRecorded).map((row) => row.path),
    files: current,
  };
}

export async function validateStaticGate({ evidenceRoot, workspace, output }) {
  const frozenRoot = resolve(evidenceRoot);
  const workspaceRoot = resolve(workspace);
  const outputPath = resolve(output);
  if (isWithin(frozenRoot, outputPath)) throw new Error('STATIC_GATE_OUTPUT_MUST_BE_OUTSIDE_FROZEN_EVIDENCE');
  const findings = [];
  const manifest = await verifyManifest(frozenRoot, findings);
  const names = {
    client: 'client-timeline.json',
    custody: 'custody.json',
    overhead: 'observer-overhead.json',
    hostLifecycle: 'host-sampler-lifecycle.json',
    processLifecycle: 'process-sampler-lifecycle.json',
    managedRoots: 'managed-process-roots.json',
    sourceSignatures: 'source-signatures.json',
    replacementChecks: 'replacement-validation-checks.json',
    knownBackground: 'known-protected-background.json',
    preflight: 'process-inventory-before.json',
  };
  const documents = {};
  for (const [key, name] of Object.entries(names)) documents[key] = await loadJson(resolve(frozenRoot, name), findings, name);
  const processRecords = await loadJsonLines(resolve(frozenRoot, 'process-telemetry.jsonl'), findings, 'process-telemetry.jsonl');
  const inventoryFiles = [
    { phase: 'BEFORE_WINDOW', name: 'managed-process-tree-before-window.json' },
    { phase: 'BEFORE_SHUTDOWN', name: 'managed-process-tree-before-shutdown.json' },
    { phase: 'AFTER_SHUTDOWN', name: 'process-inventory-after.json' },
  ];
  const inventories = [];
  for (const item of inventoryFiles) inventories.push({ ...item, document: await loadJson(resolve(frozenRoot, item.name), findings, item.name) });

  const canonicalRunId = documents.client?.runId ?? documents.custody?.runId ?? null;
  const runIds = [
    documents.client?.runId,
    documents.custody?.runId,
    documents.overhead?.runId,
    documents.hostLifecycle?.runId,
    documents.processLifecycle?.runId,
    documents.managedRoots?.runId,
    documents.replacementChecks?.runId,
  ].filter(Boolean);
  if (!canonicalRunId || runIds.some((value) => value !== canonicalRunId)) addFinding(findings, 'RUN_ID_CONSENSUS_INVALID', runIds);

  const completeCoverageStatuses = new Set(['COMPLETE_FOR_CANDIDATE_IMAGES', 'COMPLETE_WITH_IDENTITY_BOUND_KNOWN_PROTECTED_BACKGROUND']);
  const preflightValid = documents.preflight?.contract === 'agm-instrumentation-lifecycle-process-inventory.v2'
    && documents.preflight?.identityContract === 'agm-instrumentation-sanitized-process-identity.v2'
    && documents.preflight?.runId === canonicalRunId
    && documents.preflight?.capturePhase === 'PREFLIGHT'
    && documents.preflight?.queryStatus === 'SUCCESS'
    && completeCoverageStatuses.has(documents.preflight?.coverageStatus)
    && finite(documents.preflight?.queryAttempts) >= 1
    && finite(documents.preflight?.knownProtectedBackground?.unclassifiedUnavailableCount) === 0
    && finite(documents.preflight?.matchCounts?.p9) === 0
    && finite(documents.preflight?.matchCounts?.observer) === 0
    && documents.preflight?.trafficGenerated === false
    && finite(documents.preflight?.processChanges) === 0;
  if (!preflightValid) addFinding(findings, 'PREFLIGHT_PROCESS_INVENTORY_INVALID');

  const context = { ...documents, client: documents.client, managedRoots: documents.managedRoots };
  const overhead = evaluateOverhead(context, findings);
  const processFinal = evaluateProcessFinal({ records: processRecords, lifecycle: documents.processLifecycle, client: documents.client, managedRoots: documents.managedRoots }, findings);
  const inventory = evaluateInventories({ inventories, managedRoots: documents.managedRoots, runId: canonicalRunId, knownBackground: documents.knownBackground }, findings);
  const sourceFreeze = await evaluateSourceFreeze({ sourceSignatures: documents.sourceSignatures, replacementChecks: documents.replacementChecks, workspace: workspaceRoot }, findings);

  const shutdown = await loadJson(resolve(frozenRoot, 'shutdown.json'), findings, 'shutdown.json');
  const completedAt = epoch(documents.client?.window?.completedAt);
  let samplerBoundaryReport;
  if (shutdown?.contract === 'agm-instrumentation-lifecycle-shutdown.v2') {
    const boundary = await loadJson(resolve(frozenRoot, 'client-boundary.json'), findings, 'client-boundary.json');
    const release = await loadJson(resolve(frozenRoot, 'sampler-release.json'), findings, 'sampler-release.json');
    const hostAck = await loadJson(resolve(frozenRoot, 'host-boundary-ready.json'), findings, 'host-boundary-ready.json');
    const processAck = await loadJson(resolve(frozenRoot, 'process-boundary-ready.json'), findings, 'process-boundary-ready.json');
    const roots = new Map((documents.managedRoots?.managedRoots ?? []).map((row) => [String(row.role), row]));
    const preShutdown = inventories.find((item) => item.phase === 'BEFORE_SHUTDOWN')?.document ?? {};
    const finalInventory = inventories.find((item) => item.phase === 'AFTER_SHUTDOWN')?.document ?? {};
    const finalPath = resolve(frozenRoot, 'process-inventory-after.json');
    const finalBytes = await readFile(finalPath).catch(() => null);
    const managedRootRows = Array.isArray(documents.managedRoots?.managedRoots) ? documents.managedRoots.managedRoots : [];
    const managedRootRoles = managedRootRows.map((row) => String(row?.role ?? '')).sort();
    const managedRootsValid = documents.managedRoots?.contract === 'agm-instrumentation-lifecycle-managed-process-roots.v2'
      && documents.managedRoots?.runId === canonicalRunId
      && documents.managedRoots?.identity === 'PID_CREATION_EPOCH_MS_IMAGE_EXECUTABLE_PATH_SHA256_COMMAND_LINE_SHA256'
      && documents.managedRoots?.identityHashAlgorithm === 'SHA256'
      && documents.managedRoots?.rawExecutablePathsRecorded === false && documents.managedRoots?.rawCommandLinesRecorded === false
      && JSON.stringify(managedRootRoles) === JSON.stringify(['API', 'CLIENT', 'HOST_SAMPLER', 'PROCESS_SAMPLER'])
      && managedRootRows.every((row) => Number.isSafeInteger(finite(row?.pid)) && Number.isSafeInteger(finite(row?.parentPid))
        && Math.trunc(epoch(row?.creationAt)) === finite(row?.creationEpochMs)
        && Math.abs(epoch(row?.startTimeUtc) - finite(row?.creationEpochMs)) <= 2000
        && typeof row?.imageName === 'string' && /^[0-9a-f]{64}$/.test(String(row?.executablePathSha256 ?? ''))
        && /^[0-9a-f]{64}$/.test(String(row?.commandLineSha256 ?? '')) && row?.identityStrength === 'FULL_CURRENT'
        && row?.identityEvidence === 'INITIAL_MANAGED_ROOT_SNAPSHOT'
        && row?.identitySha256 === sha256(Buffer.from(`${row.pid}|${row.creationEpochMs}|${row.imageName.toLowerCase()}|${row.executablePathSha256}|${row.commandLineSha256}`, 'utf8')));
    const logicalBoundaryOffsetMs = epoch(boundary?.clientCompletedAt) - completedAt;
    const publicationOffsetMs = epoch(boundary?.requestedAt) - completedAt;
    const processFormalRows = processRecords.filter((row) => row?.sampleKind === 'FORMAL_BASELINE');
    const processFinalRows = processRecords.filter((row) => row?.sampleKind === 'MEASUREMENT_FINAL');
    const processFormalRow = processFormalRows.length === 1 ? processFormalRows[0] : null;
    const processFinalRow = processFinalRows.length === 1 ? processFinalRows[0] : null;
    const processAckBaselineStartedAt = epoch(processAck?.measurement?.baseline?.captureStartedAt);
    const processAckFinalStartedAt = epoch(processAck?.measurement?.final?.captureStartedAt);
    const processAckCadenceSeconds = finite(processAck?.measurement?.cadenceSeconds);
    const processAckExpectedSeconds = finite(processAck?.measurement?.expectedDurationSeconds);
    const processAckDeviationSeconds = finite(processAck?.measurement?.cadenceDeviationSeconds);
    const processAckDerivedSeconds = Number.isFinite(processAckBaselineStartedAt) && Number.isFinite(processAckFinalStartedAt)
      ? (processAckFinalStartedAt - processAckBaselineStartedAt) / 1000
      : null;
    const processAckCadenceValid = [processAckCadenceSeconds, processAckExpectedSeconds, processAckDeviationSeconds, processAckDerivedSeconds].every(Number.isFinite)
      && Math.abs(processAckCadenceSeconds - processAckDerivedSeconds) <= 0.001
      && Math.abs(processAckDeviationSeconds - (processAckDerivedSeconds - processAckExpectedSeconds)) <= 0.001
      && Math.abs(processAckDeviationSeconds) <= 1;
    const commonAckValid = (ack, role, expectedRoot) => ack?.contract === 'agm-real-basic-sampler-boundary-ready.v1'
      && ack.role === role && ack.runId === canonicalRunId && finite(ack.samplerPid) === finite(expectedRoot?.pid)
      && epoch(ack.samplerStartTimeUtc) === epoch(expectedRoot?.startTimeUtc)
      && ack.boundary?.contract === boundary?.contract
      && epoch(ack.boundary?.requestedAt) === epoch(boundary?.requestedAt)
      && epoch(ack.boundary?.clientCompletedAt) === completedAt
      && epoch(ack.boundary?.observedAt) >= epoch(boundary?.requestedAt)
      && epoch(ack.readyAt) >= epoch(ack.boundary?.observedAt)
      && ack.periodicSamplingStopped === true && ack.quiescentUntilRelease === true;
    const processAckValid = commonAckValid(processAck, 'PROCESS', roots.get('PROCESS_SAMPLER'))
      && processAck?.measurement?.baseline?.sampleKind === 'FORMAL_BASELINE'
      && processAck?.measurement?.final?.sampleKind === 'MEASUREMENT_FINAL'
      && processAck?.measurement?.snapshotSemantics === 'NON_ATOMIC_PROCESS_ENUMERATION_START_TO_START_DENOMINATOR'
      && processAckExpectedSeconds === 150 && processAckCadenceValid
      && epoch(processAck?.measurement?.baseline?.scheduledAt) === epoch(documents.client?.window?.scheduledStartAt)
      && epoch(processAck?.measurement?.final?.scheduledAt) === completedAt
      && processFormalRow !== null && processFinalRow !== null
      && finite(processAck?.measurement?.baseline?.sequence) === finite(processFormalRow.sequence)
      && processAckBaselineStartedAt === epoch(processFormalRow.captureStartedAt)
      && epoch(processAck?.measurement?.baseline?.captureCompletedAt) === epoch(processFormalRow.captureCompletedAt)
      && finite(processAck?.measurement?.final?.sequence) === finite(processFinalRow.sequence)
      && processAckFinalStartedAt === epoch(processFinalRow.captureStartedAt)
      && epoch(processAck?.measurement?.final?.captureCompletedAt) === epoch(processFinalRow.captureCompletedAt);
    const lifecycleProtocolValid = [documents.hostLifecycle, documents.processLifecycle].every((lifecycle) => lifecycle?.boundarySignalRequired === true
      && lifecycle.releaseSignalRequired === true
      && epoch(lifecycle.boundaryRequestedAt) === epoch(boundary?.requestedAt)
      && epoch(lifecycle.boundaryClientCompletedAt) === completedAt
      && epoch(lifecycle.releaseRequestedAt) === epoch(release?.requestedAt)
      && epoch(lifecycle.releaseObservedAt) >= epoch(release?.requestedAt)
      && lifecycle.stopReason === 'STOP_SIGNAL' && lifecycle.graceful === true && finite(lifecycle.exitCode) === 0);
    const shutdownRows = Array.isArray(shutdown?.processes) ? shutdown.processes : [];
    const shutdownRoles = shutdownRows.map((row) => String(row?.role ?? '')).sort();
    const shutdownValid = shutdown?.runId === canonicalRunId && shutdown?.windowId === canonicalRunId
      && shutdown?.forcedStopUsed === false && Array.isArray(shutdown?.forcedProcessIds) && shutdown.forcedProcessIds.length === 0
      && Array.isArray(shutdown?.cleanupErrors) && shutdown.cleanupErrors.length === 0
      && Array.isArray(shutdown?.exactKnownPidsAliveAfter) && shutdown.exactKnownPidsAliveAfter.length === 0
      && finite(shutdown?.orphans) === 0 && shutdown?.diagnosticPortReleased === true
      && JSON.stringify(shutdownRoles) === JSON.stringify(['API', 'CLIENT', 'HOST_SAMPLER', 'PROCESS_SAMPLER'])
      && shutdownRows.every((row) => row?.graceful === true && row?.forcedStopUsed === false && row?.aliveAfter === false
        && finite(row?.exitCode) === 0 && finite(row?.actualProcessExitCode) === 0);
    const finalClosureValid = finalInventory?.contract === INVENTORY_CONTRACT_V2
      && finalInventory?.identityContract === 'agm-instrumentation-sanitized-process-identity.v2'
      && finalInventory?.runId === canonicalRunId && finalInventory?.capturePhase === 'AFTER_SHUTDOWN'
      && finalInventory?.queryStatus === 'SUCCESS'
      && ['COMPLETE_FOR_CANDIDATE_IMAGES', 'COMPLETE_WITH_IDENTITY_BOUND_KNOWN_PROTECTED_BACKGROUND'].includes(finalInventory?.coverageStatus)
      && Array.isArray(finalInventory?.candidateCommandLinesUnavailable) && finalInventory.candidateCommandLinesUnavailable.length === 0
      && finite(finalInventory?.knownProtectedBackground?.unclassifiedUnavailableCount) === 0
      && finite(finalInventory?.matchCounts?.p9) === 0 && finite(finalInventory?.matchCounts?.observer) === 0
      && finalInventory?.trackedClosure?.complete === true && finite(finalInventory?.trackedClosure?.currentTrackedMatches) === 0
      && basename(String(finalInventory?.trackedClosure?.priorInventorySource ?? '')) === 'managed-process-tree-before-shutdown.json';
    const protocolValid = managedRootsValid && shutdown?.runId === canonicalRunId && shutdown?.windowId === canonicalRunId
      && boundary?.contract === 'agm-instrumentation-lifecycle-sampler-boundary.v1'
      && boundary.runId === canonicalRunId && boundary.windowId === canonicalRunId
      && finite(boundary.clientPid) === finite(documents.client?.clientPid)
      && boundary.reason === 'CLIENT_WINDOW_COMPLETED'
      && logicalBoundaryOffsetMs === 0 && publicationOffsetMs >= 0 && publicationOffsetMs <= 250
      && commonAckValid(hostAck, 'HOST', roots.get('HOST_SAMPLER'))
      && hostAck?.finalSample?.sampleKind === 'BOUNDARY_FINAL'
      && epoch(hostAck?.finalSample?.scheduledAt) === completedAt
      && processAckValid && lifecycleProtocolValid
      && epoch(preShutdown.captureStartedAt) >= Math.max(epoch(hostAck?.readyAt), epoch(processAck?.readyAt))
      && release?.contract === 'agm-instrumentation-lifecycle-sampler-release.v1' && release.runId === canonicalRunId
      && epoch(release?.boundaryRequestedAt) === epoch(boundary?.requestedAt)
      && epoch(release?.boundaryClientCompletedAt) === completedAt
      && epoch(release.requestedAt) >= epoch(preShutdown.capturedAt)
      && epoch(shutdown.boundarySignalCreatedAt) === epoch(boundary.requestedAt)
      && epoch(shutdown.releaseSignalCreatedAt) === epoch(release.requestedAt)
      && epoch(shutdown?.boundaryAcknowledgements?.host?.readyAt) === epoch(hostAck?.readyAt)
      && epoch(shutdown?.boundaryAcknowledgements?.process?.readyAt) === epoch(processAck?.readyAt)
      && shutdownValid && finalClosureValid
      && shutdown.finalInventory?.contract === INVENTORY_CONTRACT_V2
      && shutdown.finalInventory?.runId === canonicalRunId && shutdown.finalInventory?.capturePhase === 'AFTER_SHUTDOWN'
      && finalInventory.runId === canonicalRunId && finalInventory.capturePhase === 'AFTER_SHUTDOWN'
      && basename(String(shutdown.finalInventory?.evidence?.path ?? '')) === 'process-inventory-after.json'
      && finalBytes !== null
      && finite(shutdown.finalInventory?.evidence?.bytes) === finalBytes.byteLength
      && shutdown.finalInventory?.evidence?.sha256 === sha256(finalBytes);
    if (!protocolValid) addFinding(findings, 'SAMPLER_BOUNDARY_RELEASE_PROTOCOL_INVALID');
    samplerBoundaryReport = {
      schema: 'SHUTDOWN_V2_TWO_PHASE',
      clientCompletedAt: boundary?.clientCompletedAt ?? null,
      boundaryRequestedAt: boundary?.requestedAt ?? null,
      logicalBoundaryOffsetMs: round(logicalBoundaryOffsetMs, 6),
      publicationOffsetMs: round(publicationOffsetMs, 6),
      releaseRequestedAt: release?.requestedAt ?? null,
      protocolValid,
    };
  } else if (shutdown?.contract === 'agm-instrumentation-lifecycle-shutdown.v1') {
    const stopAt = epoch(shutdown?.stopSignalCreatedAt);
    const stopOffsetMs = completedAt === null || stopAt === null ? null : stopAt - completedAt;
    if (stopOffsetMs === null || Math.abs(stopOffsetMs) > 1) addFinding(findings, 'SAMPLER_STOP_BOUNDARY_NOT_EXACT', round(stopOffsetMs, 6));
    samplerBoundaryReport = { schema: 'SHUTDOWN_V1_LEGACY', clientCompletedAt: documents.client?.window?.completedAt ?? null, stopSignalCreatedAt: shutdown?.stopSignalCreatedAt ?? null, stopSignalOffsetMs: round(stopOffsetMs, 6) };
  } else {
    addFinding(findings, 'SHUTDOWN_CONTRACT_INVALID', shutdown?.contract ?? null);
    samplerBoundaryReport = { schema: 'SHUTDOWN_INVALID', contract: shutdown?.contract ?? null, protocolValid: false };
  }

  const report = {
    contract: 'agm-instrumentation-lifecycle-static-gate-report.v1',
    generatedAt: new Date().toISOString(),
    status: STATUS,
    decisionAuthority: 'PRODUCT_OWNER',
    ownerReviewOnly: true,
    runId: canonicalRunId,
    frozenEvidence: { directory: basename(frozenRoot), rawEvidenceModified: false, manifest },
    sourceFreeze,
    observerOverhead: overhead,
    processFinal,
    processInventory: inventory,
    canonicalInventoryPair: {
      before: { name: 'process-inventory-before.json', present: documents.preflight !== null, valid: preflightValid },
      after: {
        name: 'process-inventory-after.json',
        present: inventories.find((item) => item.phase === 'AFTER_SHUTDOWN')?.document !== null,
      },
      valid: preflightValid && inventories.find((item) => item.phase === 'AFTER_SHUTDOWN')?.document !== null,
    },
    samplerBoundary: samplerBoundaryReport,
    evidenceAssessment: { findings: findings.length, declarationAuthorityRetainedByOwner: true },
    findings,
    attributionBoundary: { rootCauseProvenByThisGate: false, causalClaim: 'NONE' },
    nextGate: STATUS,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  return { report, outputPath };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = parseArguments(process.argv.slice(2));
  const result = await validateStaticGate(args);
  console.log(`${STATUS} / ${result.outputPath}`);
  if (result.report.findings.length) process.exitCode = 2;
}
