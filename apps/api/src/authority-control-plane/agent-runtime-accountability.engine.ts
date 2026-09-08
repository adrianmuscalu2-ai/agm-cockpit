export const AGENT_ACCOUNTABILITY_CONTRACT = 'agent-runtime-accountability.v1';
export const INSPECTOR_FAILOVER_CONTRACT = 'inspector-failover.v1';

export type AgentAccountabilityStatus =
  | 'ACTIVE'
  | 'DEGRADED'
  | 'FAIL'
  | 'UNKNOWN / NO TELEMETRY'
  | 'NOT EXECUTABLE'
  | 'MANDATE NOT ASSIGNED'
  | 'STALE'
  | 'CONTROL COVERAGE LOST';

export type AccountabilitySignal = {
  id: string;
  status: string;
  occurredAt: Date;
  evidenceRef: string | null;
  outputRef: string | null;
};

export type AgentAccountabilityEvaluation = {
  executable: 'YES' | 'NO';
  mandate: 'PROVEN' | 'NOT PROVEN';
  validation: 'PROVEN' | 'NOT PROVEN';
  freshness: 'CURRENT' | 'STALE' | 'NO TELEMETRY';
  status: AgentAccountabilityStatus;
  reason: string;
};

export function evaluateAgentAccountability(input: {
  capabilityDeclared: boolean;
  runtimeAbsent: boolean;
  mandateId: string | null;
  execution: AccountabilitySignal | null;
  validation: AccountabilitySignal | null;
  freshnessWindowMs: number;
  controlCoverageLost?: boolean;
  now?: Date;
}): AgentAccountabilityEvaluation {
  const now = input.now ?? new Date();
  const mandate = input.mandateId ? 'PROVEN' : 'NOT PROVEN';
  const executionFresh = Boolean(input.execution && now.getTime() - input.execution.occurredAt.getTime() <= input.freshnessWindowMs);
  const executionProven = Boolean(input.execution?.evidenceRef && input.execution?.outputRef);
  const validationFresh = Boolean(input.validation && now.getTime() - input.validation.occurredAt.getTime() <= input.freshnessWindowMs);
  const validationAccepted = Boolean(input.validation && ['PASS', 'COMPLETED', 'ACTIVE'].includes(input.validation.status.toUpperCase()));
  const validationProven = Boolean(input.validation?.evidenceRef && input.validation?.outputRef && validationFresh && validationAccepted);
  const executable = input.capabilityDeclared && !input.runtimeAbsent && executionProven ? 'YES' : 'NO';
  const validation = validationProven ? 'PROVEN' : 'NOT PROVEN';
  const freshness = !input.execution ? 'NO TELEMETRY' : executionFresh ? 'CURRENT' : 'STALE';

  if (input.controlCoverageLost) return result(executable, mandate, validation, freshness, 'CONTROL COVERAGE LOST', 'No independent validator can control the current execution.');
  if (!input.capabilityDeclared || input.runtimeAbsent) return result('NO', mandate, validation, freshness, 'NOT EXECUTABLE', 'Executable capability is missing or the runtime probe confirmed ABSENT.');
  if (!input.mandateId) return result(executable, 'NOT PROVEN', validation, freshness, 'MANDATE NOT ASSIGNED', 'No active, unexpired AuthorityMandate exists for this identity.');
  if (!input.execution || !executionProven) return result('NO', mandate, validation, freshness, 'UNKNOWN / NO TELEMETRY', 'No persisted execution output and evidence exist; the identity is not declared ACTIVE.');
  if (['FAILED', 'FAIL', 'BLOCKED', 'ERROR'].includes(input.execution.status.toUpperCase())) return result(executable, mandate, validation, freshness, 'FAIL', `The latest persisted execution is ${input.execution.status.toUpperCase()}.`);
  if (!executionFresh) return result(executable, mandate, validation, 'STALE', 'STALE', 'The latest proven execution exceeds its freshness SLA.');
  if (!validationProven || (input.validation && input.validation.occurredAt < input.execution.occurredAt)) return result(executable, mandate, 'NOT PROVEN', freshness, 'DEGRADED', 'Execution is current, but no accepted independent validation exists after its result.');
  return result('YES', 'PROVEN', 'PROVEN', 'CURRENT', 'ACTIVE', 'Mandate, execution, output, evidence, freshness, and independent validation are current.');
}

export function evaluateInspectorFailover(input: {
  primary: AccountabilitySignal | null;
  secondary: AccountabilitySignal | null;
  transferObservedAt: Date | null;
  activeValidatorId: string | null;
  secondaryId: string;
  freshnessWindowMs: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const primaryUnavailable = !input.primary
    || ['DEGRADED', 'FAILED', 'FAIL', 'BLOCKED', 'NO_TELEMETRY', 'STALE'].includes(input.primary.status.toUpperCase())
    || now.getTime() - input.primary.occurredAt.getTime() > input.freshnessWindowMs;
  const secondaryCurrent = Boolean(
    input.secondary
      && ['COMPLETED', 'PASS', 'ACTIVE'].includes(input.secondary.status.toUpperCase())
      && input.secondary.evidenceRef
      && input.secondary.outputRef
      && now.getTime() - input.secondary.occurredAt.getTime() <= input.freshnessWindowMs,
  );
  const transferProven = Boolean(input.transferObservedAt && input.activeValidatorId === input.secondaryId);
  const pass = primaryUnavailable && secondaryCurrent && transferProven;
  return {
    primaryUnavailable,
    transferProven,
    secondaryValidationProven: secondaryCurrent,
    status: pass ? 'PASS' as const : 'FAIL' as const,
    controlCoverage: pass ? 'COMPLETE' as const : 'INCOMPLETE' as const,
    controlStatus: pass ? 'TRANSFERRED_TO_SECONDARY' as const : 'CONTROL COVERAGE LOST' as const,
  };
}

export function falseActiveCount(items: Array<{ status: AgentAccountabilityStatus; executable: string; mandate: string; validation: string; executionEvidenceRef: string | null }>) {
  return items.filter((item) => item.status === 'ACTIVE' && (item.executable !== 'YES' || item.mandate !== 'PROVEN' || item.validation !== 'PROVEN' || !item.executionEvidenceRef)).length;
}

export function evaluateAgentRuntimeVerdict(input: {
  controlSystemComplete: boolean;
  agents: Array<{ status: AgentAccountabilityStatus; executable: string; mandate: string; validation: string; executionEvidenceRef: string | null }>;
  inspectorFailover: 'PASS' | 'FAIL';
  controlCoverage: 'COMPLETE' | 'INCOMPLETE';
  overallOperationalState: 'PASS' | 'FAIL';
  falseActive: number;
  unexplainedDegraded: number;
}) {
  const controlSystem = input.controlSystemComplete && input.falseActive === 0 && input.unexplainedDegraded === 0 ? 'PASS' as const : 'FAIL' as const;
  const fleetAccountable = input.agents.length > 0 && input.agents.every((agent) => agent.status === 'ACTIVE'
    && agent.executable === 'YES'
    && agent.mandate === 'PROVEN'
    && agent.validation === 'PROVEN'
    && Boolean(agent.executionEvidenceRef));
  const agentAccountability = fleetAccountable ? 'PASS' as const : 'FAIL' as const;
  const finalAgentRuntimePass = controlSystem === 'PASS'
    && agentAccountability === 'PASS'
    && input.inspectorFailover === 'PASS'
    && input.controlCoverage === 'COMPLETE'
    && input.overallOperationalState === 'PASS'
    ? 'PASS' as const : 'FAIL' as const;
  return { controlSystem, agentAccountability, overallOperationalState: input.overallOperationalState, inspectorFailover: input.inspectorFailover, controlCoverage: input.controlCoverage, falseActive: input.falseActive, unexplainedDegraded: input.unexplainedDegraded, finalAgentRuntimePass };
}

function result(executable: 'YES' | 'NO', mandate: 'PROVEN' | 'NOT PROVEN', validation: 'PROVEN' | 'NOT PROVEN', freshness: 'CURRENT' | 'STALE' | 'NO TELEMETRY', status: AgentAccountabilityStatus, reason: string): AgentAccountabilityEvaluation {
  return { executable, mandate, validation, freshness, status, reason };
}
