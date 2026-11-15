import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AGMATCC_COPILOT_CONTRACT, type CopilotOutcome, type CopilotToolCall, type CopilotUsage, type ProviderMessage, type ProviderTurn } from './agmatcc-copilot.contract';

export interface AgmatccCopilotProvider {
  readonly model: typeof AGMATCC_COPILOT_CONTRACT.candidateModel;
  readonly provider: 'simulated' | 'openai';
  complete(messages: readonly ProviderMessage[], allowTools: boolean): Promise<ProviderTurn>;
}

export class CopilotProviderError extends ServiceUnavailableException {
  constructor(code: string, readonly usage?: CopilotUsage) { super(code); }
}

/** Deterministic, offline provider used by isolated tests and local demonstrations. */
@Injectable()
export class SimulatedAgmatccProvider implements AgmatccCopilotProvider {
  readonly model = AGMATCC_COPILOT_CONTRACT.candidateModel;
  readonly provider = 'simulated' as const;
  async complete(messages: readonly ProviderMessage[], allowTools: boolean): Promise<ProviderTurn> {
    const last = messages.at(-1)?.content ?? '';
    const question = messages.find((message) => message.role === 'user')?.content ?? '';
    if (allowTools && messages.length <= 2) {
      const query = extractQuestion(question);
      const normalized = query.toLocaleLowerCase('ro');
      const name = /incident|accident|avarie/.test(normalized) ? 'search_incidents' : /agent|orchestr|mandat|inspector/.test(normalized) ? 'read_agent_runtime_events' : 'search_operational_events';
      return {
        kind: 'tool_calls', timeToFirstResponseMs: 2, usage: estimateUsage(messages.map((item) => item.content).join(' '), ''),
        calls: [{ id: 'simulated-search-1', name, arguments: name === 'read_agent_runtime_events' ? { mandateId: null, limit: 20 } : { query, limit: 8 } }],
      };
    }
    const evidence = messages.filter((message) => message.role === 'tool').map((message) => safeParse(message.content)).flat();
    const facts = evidence.map(summarizeSimulatedEvidence).filter((item): item is { sourceRef: string; summary: string } => Boolean(item));
    const refs = facts.map((item) => item.sourceRef);
    const output = refs.length
      ? { status: 'PASS' as const, answer: `Demonstrație simulată (nu GPT live): ${facts.map((item) => `${item.summary} [${item.sourceRef}]`).join('; ')}.`, evidenceRefs: refs }
      : { status: 'UNKNOWN' as const, answer: 'Nu am găsit dovezi autorizate suficiente pentru a răspunde. Informația rămâne necunoscută.', evidenceRefs: [] };
    return { kind: 'final', output, timeToFirstResponseMs: 2, usage: estimateUsage(last, JSON.stringify(output)) };
  }
}

/** Candidate Responses API adapter. It is deliberately not selected by the application module. */
export class OpenAIResponsesAgmatccProvider implements AgmatccCopilotProvider {
  readonly model = AGMATCC_COPILOT_CONTRACT.candidateModel;
  readonly provider = 'openai' as const;
  constructor(private readonly apiKey: string, private readonly fetcher: typeof fetch = fetch) {
    if (!apiKey.trim()) throw new Error('ACPM_OPENAI_KEY_REQUIRED');
  }

  async complete(messages: readonly ProviderMessage[], allowTools: boolean): Promise<ProviderTurn> {
    const started = Date.now();
    const input: Array<Record<string, string>> = [];
    for (const { role, content, toolCallId } of messages) {
      if (role === 'tool') input.push({ type: 'function_call_output', call_id: toolCallId ?? '', output: content });
      else if (role === 'assistant' && content.startsWith('[{"id"')) {
        for (const call of safeCalls(content)) input.push({ type: 'function_call', call_id: call.id, name: call.name, arguments: JSON.stringify(call.arguments) });
      } else input.push({ role, content });
    }
    // Byte bound is conservative for tokenization; reserve covers input, tool schema and output.
    if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 100_000) throw new CopilotProviderError('ACPM_INPUT_LIMIT');
    let response: Response;
    try {
      response = await this.fetcher(AGMATCC_COPILOT_CONTRACT.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          input,
          reasoning: { effort: 'low' },
          max_output_tokens: 120,
          service_tier: 'default',
          store: false,
          text: { format: { type: 'json_schema', name: 'agmatcc_answer', strict: true, schema: ANSWER_SCHEMA } },
          ...(allowTools ? { tools: READ_ONLY_TOOL_DEFINITIONS, tool_choice: 'auto' } : {}),
        }),
        signal: AbortSignal.timeout(AGMATCC_COPILOT_CONTRACT.timeoutMs),
      });
    } catch {
      throw new CopilotProviderError('ACPM_PROVIDER_TIMEOUT_OR_NETWORK_ERROR');
    }
    if (!response.ok) throw new CopilotProviderError(`ACPM_PROVIDER_HTTP_${response.status}`);
    const payload = await response.json() as OpenAIResponse;
    const usage = { inputTokens: payload.usage?.input_tokens ?? 0, outputTokens: payload.usage?.output_tokens ?? 0, estimatedCostUsd: estimateCost(payload.usage?.input_tokens ?? 0, payload.usage?.output_tokens ?? 0) };
    if (!Number.isSafeInteger(payload.usage?.input_tokens) || !Number.isSafeInteger(payload.usage?.output_tokens) || usage.inputTokens < 0 || usage.outputTokens < 0) throw new CopilotProviderError('ACPM_USAGE_UNCONFIRMED');
    const calls = (payload.output ?? []).flatMap((item) => item.type === 'function_call' ? [{ id: item.call_id ?? item.id ?? '', name: item.name ?? '', arguments: parseArguments(item.arguments) }] : []);
    if (allowTools && calls.length) {
      return {
        kind: 'tool_calls', calls: calls as CopilotToolCall[],
        timeToFirstResponseMs: Date.now() - started, usage,
      };
    }
    const outputText = payload.output_text ?? (payload.output ?? []).flatMap((item) => item.content ?? []).map((item) => item.text ?? '').join('');
    let output: { status: CopilotOutcome; answer: string; evidenceRefs: string[] };
    try { output = JSON.parse(outputText) as typeof output; }
    catch { throw new CopilotProviderError('ACPM_PROVIDER_STRUCTURED_OUTPUT_INVALID', usage); }
    if (!output || typeof output !== 'object' || !['PASS', 'FAIL', 'BLOCKED', 'UNKNOWN'].includes(output.status) || typeof output.answer !== 'string' || !Array.isArray(output.evidenceRefs) || output.evidenceRefs.some(ref => typeof ref !== 'string')) {
      throw new CopilotProviderError('ACPM_PROVIDER_STRUCTURED_OUTPUT_INVALID', usage);
    }
    return { kind: 'final', output, timeToFirstResponseMs: Date.now() - started, usage };
  }
}

export const READ_ONLY_TOOL_DEFINITIONS = [
  { type: 'function', name: 'search_operational_events', description: 'Read tenant-scoped operational journal events relevant to a Romanian question. Read-only.', strict: true, parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 12 } }, required: ['query', 'limit'], additionalProperties: false } },
  { type: 'function', name: 'read_agent_runtime_events', description: 'Read tenant-scoped agent lifecycle events, optionally for one mandate. Read-only.', strict: true, parameters: { type: 'object', properties: { mandateId: { type: ['string', 'null'] }, limit: { type: 'integer', minimum: 1, maximum: 50 } }, required: ['mandateId', 'limit'], additionalProperties: false } },
  { type: 'function', name: 'search_incidents', description: 'Read tenant-scoped incident records relevant to a question. Read-only.', strict: true, parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 12 } }, required: ['query', 'limit'], additionalProperties: false } },
] as const;

export const ANSWER_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['PASS', 'FAIL', 'BLOCKED', 'UNKNOWN'] },
    answer: { type: 'string' },
    evidenceRefs: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'answer', 'evidenceRefs'],
} as const;

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ type?: string; id?: string; call_id?: string; name?: string; arguments?: string; content?: Array<{ text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export function estimateCost(inputTokens: number, outputTokens: number) {
  return Number(((inputTokens * AGMATCC_COPILOT_CONTRACT.inputUsdPerMillion + outputTokens * AGMATCC_COPILOT_CONTRACT.outputUsdPerMillion) / 1_000_000).toFixed(8));
}
function estimateUsage(input: string, output: string): CopilotUsage {
  const inputTokens = Math.ceil(input.length / 4); const outputTokens = Math.ceil(output.length / 4);
  return { inputTokens, outputTokens, estimatedCostUsd: estimateCost(inputTokens, outputTokens) };
}
function extractQuestion(value: string) {
  try { const parsed = JSON.parse(value) as { question?: string }; return (parsed.question ?? value).slice(0, 200); } catch { return value.slice(0, 200); }
}
function safeParse(value: string): Array<{ sourceRef?: string; content?: string }> {
  try { const parsed = JSON.parse(value) as unknown; return Array.isArray(parsed) ? parsed as Array<{ sourceRef?: string; content?: string }> : []; } catch { return []; }
}
function summarizeSimulatedEvidence(item: { sourceRef?: string; content?: string }): { sourceRef: string; summary: string } | null {
  if (!item.sourceRef) return null;
  const raw = (item.content ?? '').replace(/^<UNTRUSTED_OPERATIONAL_DATA>/, '').replace(/<\/UNTRUSTED_OPERATIONAL_DATA>$/, '');
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.agentId === 'string') return { sourceRef: item.sourceRef, summary: `Agent ${data.agentId}: lifecycle ${String(data.lifecycle ?? 'indisponibil')}, mandat ${String(data.mandateId ?? 'indisponibil')}` };
    if (typeof data.status === 'string' && typeof data.severity === 'string') return { sourceRef: item.sourceRef, summary: `Incidentul „${String(data.title ?? 'fără titlu')}” are status ${data.status} și severitate ${data.severity}` };
    if (typeof data.eventType === 'string') return { sourceRef: item.sourceRef, summary: `Evenimentul operațional este ${data.eventType}` };
  } catch { /* Evidence text is untrusted and is not repeated by the simulator. */ }
  return { sourceRef: item.sourceRef, summary: 'A fost citită o dovadă, fără rezumat sigur disponibil' };
}
function parseArguments(value: string | undefined) {
  if (!value) return {};
  try { const parsed = JSON.parse(value) as unknown; return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
}
function safeCalls(value: string) {
  try { const parsed = JSON.parse(value) as Array<{ id: string; name: string; arguments: unknown }>; return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
