export const AGENT_RUNTIME_LIFECYCLES = ['STARTED', 'WORKING', 'COMPLETED', 'FAILED', 'BLOCKED'] as const;
export type AgentRuntimeLifecycle = typeof AGENT_RUNTIME_LIFECYCLES[number];

export type AgentRuntimeEventInput = {
  eventId: string;
  mandateId: string;
  agentId: string;
  dossierId: string;
  lifecycle: AgentRuntimeLifecycle;
  sequence: number;
  occurredAt: string;
  evidenceRef: string;
  outputRef?: string;
  evidenceHash?: string;
  detail: string;
};
