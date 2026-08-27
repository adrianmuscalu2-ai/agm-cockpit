export type SoakThresholds = {
  approvalState: string; hostCpuPercent: { stopAtOrAbove: number }; runnerCpuPercentOfOneCore: { stopAtOrAbove: number };
  eventLoopDelayMs: { p95Maximum: number; absoluteMaximum: number }; basic: { availabilityPercentMinimum: number; p95MsMaximum: number; maximumMs: number };
  operations: { errorsMaximum: number; timeoutsMaximum: number; workersRemainingMaximum: number }; telemetry: { missingSamplesAllowed: number; staleSamplesAllowed: number };
};
export type SoakWindowFixture = {
  host: { cpuMaximumPercent: number; processorQueueMaximum: number; logicalCpuCount: number };
  runner: { cpuMaximumPercentOfOneCore: number; eventLoopP95Ms: number; eventLoopMaximumMs: number };
  endpoints: Array<{ id: string; samples: number; failures: number; timeouts: number; p95Ms: number; maximumMs: number }>;
  workers: Array<{ workerId: string; operations: number; errors: number; timeouts: number; identityVerified: boolean; cleanupAttested: boolean }>;
  basic: { availabilityPercent: number; p95Ms: number; maximumMs: number };
  final: { workersRemaining: number; p9: 'STOPPED'; killSwitch: 'ACTIVE'; trafficAllowed: false };
  telemetry: { missingSamples: number; staleSamples: number };
};
export function evaluateSoakWindow(f: SoakWindowFixture, t: SoakThresholds) {
  const failures: string[] = [];
  if (t.approvalState !== 'APPROVED') failures.push('THRESHOLDS_NOT_OWNER_APPROVED');
  if (f.host.cpuMaximumPercent >= t.hostCpuPercent.stopAtOrAbove) failures.push('HOST_CPU_THRESHOLD');
  if (f.host.processorQueueMaximum > f.host.logicalCpuCount) failures.push('PROCESSOR_QUEUE_THRESHOLD');
  if (f.runner.cpuMaximumPercentOfOneCore >= t.runnerCpuPercentOfOneCore.stopAtOrAbove) failures.push('RUNNER_CPU_THRESHOLD');
  if (f.runner.eventLoopP95Ms > t.eventLoopDelayMs.p95Maximum || f.runner.eventLoopMaximumMs > t.eventLoopDelayMs.absoluteMaximum) failures.push('EVENT_LOOP_THRESHOLD');
  if (f.basic.availabilityPercent < t.basic.availabilityPercentMinimum || f.basic.p95Ms > t.basic.p95MsMaximum || f.basic.maximumMs > t.basic.maximumMs) failures.push('BASIC_SLO');
  if (f.endpoints.some((e) => e.samples < 1 || e.failures || e.timeouts || e.p95Ms > t.basic.p95MsMaximum || e.maximumMs > t.basic.maximumMs)) failures.push('ENDPOINT_CONTRACT');
  if (f.workers.some((w) => !w.identityVerified || !w.cleanupAttested || w.errors || w.timeouts || w.operations < 1)) failures.push('WORKER_CONTRACT');
  if (f.final.workersRemaining > t.operations.workersRemainingMaximum || f.final.p9 !== 'STOPPED' || f.final.killSwitch !== 'ACTIVE' || f.final.trafficAllowed !== false) failures.push('FINAL_CONTAINMENT');
  if (f.telemetry.missingSamples > t.telemetry.missingSamplesAllowed || f.telemetry.staleSamples > t.telemetry.staleSamplesAllowed) failures.push('TELEMETRY_INCOMPLETE');
  return { pass: failures.length === 0, failures, resultSource: 'EXPLICIT_SOAK_WINDOW_CONTRACT', rawLastExitCodeUsed: false };
}
