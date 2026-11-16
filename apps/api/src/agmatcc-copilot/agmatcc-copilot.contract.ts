export const AGMATCC_COPILOT_CONTRACT = {
  version: 'agmatcc-copilot.isolated.v1',
  candidateModel: 'gpt-6-luna',
  endpoint: 'https://api.openai.com/v1/responses',
  timeoutMs: 12_000,
  maxQuestionChars: 2_000,
  maxEvidenceItems: 12,
  maxEvidenceChars: 12_000,
  maxToolCalls: 2,
  // Conservative long-context standard rates for local budget accounting.
  inputUsdPerMillion: 0.2,
  outputUsdPerMillion: 0.75,
} as const;

export type CopilotOutcome = 'PASS' | 'FAIL' | 'BLOCKED' | 'UNKNOWN';
export type CopilotEvidence = { sourceRef: string; observedAt: string; content: string };
export type CopilotUsage = { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
export type ProviderExecution = NonNullable<import('@agm/shared').AcpmEvent['providerExecution']>;
export type CopilotAnswer = {
  contractVersion: typeof AGMATCC_COPILOT_CONTRACT.version;
  model: typeof AGMATCC_COPILOT_CONTRACT.candidateModel;
  provider: 'simulated' | 'openai' | 'disabled';
  providerExecutions: ProviderExecution[];
  executionId: string;
  testMandateId: string;
  status: CopilotOutcome;
  answer: string;
  evidenceRefs: string[];
  usage: CopilotUsage;
  accounting?: { unconfirmedCalls: number; reservedUsd: number };
  timing: { totalMs: number; timeToFirstResponseMs: number };
};

export type CopilotToolCall = {
  id: string;
  name: 'search_operational_events' | 'read_agent_runtime_events' | 'search_incidents';
  arguments: { query?: string; mandateId?: string | null; limit?: number };
};

export type ProviderTurn =
  | { kind: 'tool_calls'; calls: CopilotToolCall[]; timeToFirstResponseMs: number; usage: CopilotUsage; providerExecution?:ProviderExecution }
  | { kind: 'final'; output: { status: CopilotOutcome; answer: string; evidenceRefs: string[] }; timeToFirstResponseMs: number; usage: CopilotUsage; providerExecution?:ProviderExecution };

export type ProviderMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string };
