export type AiReply = {
  answer: string; status: string; model: string; provider: string;
  executionId: string; testMandateId: string; evidenceRefs: string[];
  providerExecutions?: Array<{ source: string; executedModel: string | null; responseId: string | null; providerVersion: string | null }>;
};
type JournalResult = { status: 'SYNCED' | 'PENDING' | 'UNAVAILABLE' };
export function conversationDisplayText(text: string): string | null {
  const match = /^(AI_REQUEST|AI_RESPONSE|AI_FAILURE)\s+(.+)$/s.exec(text);
  if (!match) return null;
  try {
    const entry = JSON.parse(match[2]) as { question?: string; answer?: string; reason?: string };
    if (match[1] === 'AI_REQUEST' && typeof entry.question === 'string') return `Întrebare: ${entry.question}`;
    if (match[1] === 'AI_RESPONSE' && typeof entry.answer === 'string') return `Răspuns: ${entry.answer}`;
    if (match[1] === 'AI_FAILURE') return `Cererea AI nu a fost finalizată: ${entry.reason ?? 'cauză necunoscută'}`;
  } catch { /* Preserve unreadable records for audit. */ }
  return null;
}
export async function runAgmatccAiConversation(input: {
  question: string; requestId: string; origin?: 'voice' | 'typed';
  isCancelled?: () => boolean;
  fetcher: (path: string, init: RequestInit) => Promise<Response>;
  append: (text: string, provenance: 'typed' | 'voice-capture' | 'system') => Promise<JournalResult>;
}) {
  const request = await input.append(`AI_REQUEST ${JSON.stringify({ requestId: input.requestId, question: input.question, origin: input.origin ?? 'typed' })}`, input.origin === 'voice' ? 'voice-capture' : 'typed');
  if (request.status !== 'SYNCED') throw new Error('AGMATCC_AI_REQUEST_JOURNAL_NOT_SYNCED');
  let result: AiReply;
  try {
    if (input.isCancelled?.()) throw new Error('AGMATCC_AI_CANCELLED_BEFORE_PROVIDER');
    const response = await input.fetcher('/agmatcc-copilot/respond', {
      method: 'POST', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: input.question, language: 'ro', testMandateId: input.requestId }),
    });
    if (!response.ok) throw new Error(`ACPM_HTTP_${response.status}`);
    const envelope = await response.json() as { data?: AiReply };
    if (!envelope.data?.answer || !envelope.data.status || !envelope.data.executionId || !Array.isArray(envelope.data.evidenceRefs)) throw new Error('ACPM_RESPONSE_INVALID');
    result = envelope.data;
  } catch (error) {
    await input.append(`AI_FAILURE ${JSON.stringify({ requestId: input.requestId, reason: error instanceof Error ? error.message : 'UNKNOWN' })}`, 'system');
    throw error;
  }
  const journal = await input.append(`AI_RESPONSE ${JSON.stringify({ requestId: input.requestId, ...result })}`, 'system');
  const executedModel = result.providerExecutions?.filter(e => e.source === 'PROVIDER_RESPONSE').at(-1)?.executedModel ?? 'UNKNOWN';
  return { result, executedModel, journalStatus: journal.status };
}
