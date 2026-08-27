export const P9_INTERNAL_WORKLOAD = 'READ_ONLY_LEASE_COMMIT' as const;

export type InternalPilotOperationResult = Readonly<{
  operationId: string; startedAt: string; finishedAt: string; latencyMs: number;
  outcome: 'SUCCESS' | 'TIMEOUT' | 'OPERATION_ERROR'; errorCode: string | null;
  workerId: string; dossierId: string; fence: number; identityVerified: boolean;
  operationTimestamp: string; cleanupState: 'PENDING_WINDOW_CLEANUP' | 'ATTESTED';
}>;
export type InternalPilotMetrics = Readonly<{
  planned: number; started: number; completed: number; successes: number; errors: number;
  timeouts: number; p50Ms: number | null; p95Ms: number | null; maximumMs: number | null;
}>;
export type OperationIdentity = Readonly<{ workerId: string; dossierId: string; fence: number; identityVerified: boolean }>;
export type InternalPilotOperation = (operationId: string, signal: AbortSignal) => Promise<OperationIdentity>;
export type InternalPilotContract = Readonly<{
  executionId: string; workload: typeof P9_INTERNAL_WORKLOAD; operationCount: number;
  cadenceMs: number; timeoutMs: number; maximumWindowMs: number;
}>;
export type KillSwitchReconciliation = Readonly<{
  persistent: { state: 'ACTIVE'; source: 'P9_PILOT_POLICY'; sourcePath: string };
  temporaryPilotConfiguration: { killSwitchActive: boolean; semantic: 'AUTHORIZED_WINDOW_ADMISSION_CONFIGURATION' };
  cleanupCertification: { pass: boolean; semantic: 'ADMISSION_PROVIDER_AND_WORKERS_STOPPED' };
  effectiveFinalState: 'ACTIVE'; contradictionResolved: true;
}>;

export function reconcileKillSwitchEvidence(policy: { killSwitchDefault: unknown }, runner: { pilotAfter?: { killSwitchActive?: unknown }; cleanup?: { killSwitchCertified?: unknown; workersAfter?: unknown; workersBefore?: unknown; attestations?: unknown } }): KillSwitchReconciliation {
  if (policy.killSwitchDefault !== 'ACTIVE') throw new Error('P9_PERSISTENT_KILL_SWITCH_NOT_ACTIVE');
  if (!runner.cleanup || runner.cleanup.killSwitchCertified !== true || runner.cleanup.workersAfter !== 0) throw new Error('P9_CLEANUP_CERTIFICATION_INVALID');
  if (typeof runner.pilotAfter?.killSwitchActive !== 'boolean') throw new Error('P9_TEMPORARY_KILL_SWITCH_STATE_MISSING');
  return Object.freeze({
    persistent: { state: 'ACTIVE' as const, source: 'P9_PILOT_POLICY' as const, sourcePath: 'config/copilot-v1.2/p9-pilot-policy.json' },
    temporaryPilotConfiguration: { killSwitchActive: runner.pilotAfter.killSwitchActive, semantic: 'AUTHORIZED_WINDOW_ADMISSION_CONFIGURATION' as const },
    cleanupCertification: { pass: true, semantic: 'ADMISSION_PROVIDER_AND_WORKERS_STOPPED' as const },
    effectiveFinalState: 'ACTIVE', contradictionResolved: true,
  });
}

export function validateInternalPilotContract(value: InternalPilotContract) {
  if (!value || ['executionId', 'workload', 'operationCount', 'cadenceMs', 'timeoutMs', 'maximumWindowMs'].some((key) => (value as unknown as Record<string, unknown>)[key] === undefined || (value as unknown as Record<string, unknown>)[key] === null)) throw new Error('P9_REQUIRED_PARAMETER_MISSING');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,127}$/.test(value.executionId)) throw new Error('EXECUTION_ID_INVALID');
  if (value.workload !== P9_INTERNAL_WORKLOAD) throw new Error('WORKLOAD_NOT_AUTHORIZED');
  if (!Number.isInteger(value.operationCount) || value.operationCount < 1 || value.operationCount > 100) throw new Error('OPERATION_COUNT_INVALID');
  if (!Number.isInteger(value.cadenceMs) || value.cadenceMs < 0 || value.cadenceMs > 60_000) throw new Error('CADENCE_INVALID');
  if (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 1 || value.timeoutMs > 60_000) throw new Error('TIMEOUT_INVALID');
  if (!Number.isInteger(value.maximumWindowMs) || value.maximumWindowMs < value.timeoutMs) throw new Error('MAXIMUM_WINDOW_INVALID');
  const required = value.operationCount * value.timeoutMs + Math.max(0, value.operationCount - 1) * value.cadenceMs;
  if (value.maximumWindowMs < required) throw new Error('MAXIMUM_WINDOW_BELOW_CONTRACT_BOUND');
  return true;
}

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error('PERCENTILE_OUT_OF_RANGE');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p / 100 * sorted.length) - 1)] ?? null;
}

export function summarizeInternalOperations(results: InternalPilotOperationResult[], planned = results.length): InternalPilotMetrics {
  const latencies = results.map((item) => item.latencyMs);
  return Object.freeze({ planned, started: results.length, completed: results.length,
    successes: results.filter((item) => item.outcome === 'SUCCESS').length,
    errors: results.filter((item) => item.outcome !== 'SUCCESS').length,
    timeouts: results.filter((item) => item.outcome === 'TIMEOUT').length,
    p50Ms: percentile(latencies, 50), p95Ms: percentile(latencies, 95), maximumMs: latencies.length ? Math.max(...latencies) : null });
}

export function assertOperationIdentity(actual: OperationIdentity, expected: Omit<OperationIdentity, 'identityVerified'>) {
  if (!actual || actual.identityVerified !== true || actual.workerId !== expected.workerId || actual.dossierId !== expected.dossierId || actual.fence !== expected.fence) throw new Error('P9_OPERATION_IDENTITY_MISMATCH');
  return true;
}

export async function executeInternalPilotWorkload(contract: InternalPilotContract, operation: InternalPilotOperation, expectedIdentity: Omit<OperationIdentity, 'identityVerified'>, clock = () => new Date(), sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))) {
  validateInternalPilotContract(contract);
  const windowStarted = Date.now(); const results: InternalPilotOperationResult[] = [];
  for (let index = 0; index < contract.operationCount; index += 1) {
    if (Date.now() - windowStarted >= contract.maximumWindowMs) throw new Error('P9_MAXIMUM_WINDOW_EXCEEDED');
    if (index > 0) await sleep(contract.cadenceMs);
    const operationId = `${contract.executionId}-op-${String(index + 1).padStart(3, '0')}`;
    const started = clock(); const controller = new AbortController();
    let rejectTimeout: ((reason: Error) => void) | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => { rejectTimeout = reject; });
    const timer = setTimeout(() => { controller.abort(); rejectTimeout?.(Object.assign(new Error('timeout'), { name: 'AbortError' })); }, contract.timeoutMs);
    try {
      const identity = await Promise.race([operation(operationId, controller.signal), timeoutPromise]); assertOperationIdentity(identity, expectedIdentity); const finished = clock();
      results.push(Object.freeze({ operationId, startedAt: started.toISOString(), finishedAt: finished.toISOString(), latencyMs: Math.max(0, finished.getTime() - started.getTime()), outcome: 'SUCCESS', errorCode: null, ...identity, operationTimestamp: started.toISOString(), cleanupState: 'PENDING_WINDOW_CLEANUP' }));
    } catch (error) {
      const finished = clock(); const timeout = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
      results.push(Object.freeze({ operationId, startedAt: started.toISOString(), finishedAt: finished.toISOString(), latencyMs: Math.max(0, finished.getTime() - started.getTime()), outcome: timeout ? 'TIMEOUT' : 'OPERATION_ERROR', errorCode: timeout ? 'P9_OPERATION_TIMEOUT' : 'P9_OPERATION_ERROR', ...expectedIdentity, identityVerified: false, operationTimestamp: started.toISOString(), cleanupState: 'PENDING_WINDOW_CLEANUP' }));
    } finally { clearTimeout(timer); }
  }
  return { results, metrics: summarizeInternalOperations(results, contract.operationCount) };
}
