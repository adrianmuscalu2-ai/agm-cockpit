import type { ControlledExternalAdapter } from './external-capability.executor';
import { sanitizeExternalValue } from './external-capability.policy';
import { SlackAllowlistedContextQuery, type SlackContextQueryTarget } from './slack-allowlisted-context-query';

export type SlackGroundedSource = Readonly<{
  channelName: string;
  channelId: string;
  receiptId: string;
  excerpts: readonly string[];
}>;

export type SlackGroundedConversationResult = Readonly<{
  status: 'GROUNDED' | 'FALLBACK' | 'DENIED';
  answer: string;
  usesSlackContext: boolean;
  reason: string;
  sources: readonly SlackGroundedSource[];
  auditReceiptIds: readonly string[];
}>;

const STOP_WORDS = new Set(['care', 'este', 'sunt', 'despre', 'pentru', 'din', 'the', 'what', 'about', 'with']);

export class SlackContextGroundedConversation {
  private readonly contextQuery = new SlackAllowlistedContextQuery();

  revoke(): void { this.contextQuery.revoke(); }

  async answer(input: Readonly<{
    question: string;
    targets: readonly SlackContextQueryTarget[];
    actorId: string;
    tenantId?: string;
    workspaceId?: string;
    queryId?: string;
  }>, adapter: ControlledExternalAdapter): Promise<SlackGroundedConversationResult> {
    const selectionTerm = selectGroundingTerm(input.question);
    if (!selectionTerm) return this.fallback('QUESTION_HAS_NO_GROUNDING_TERM');
    const result = await this.contextQuery.execute({
      queryId: input.queryId ?? crypto.randomUUID(), query: selectionTerm, targets: input.targets,
      actorId: input.actorId, tenantId: input.tenantId, workspaceId: input.workspaceId,
    }, adapter);
    if (result.status === 'DENIED') {
      return Object.freeze({ status: 'DENIED', answer: 'Accesul la contextul Slack solicitat este refuzat.', usesSlackContext: false, reason: result.reason, sources: Object.freeze([]), auditReceiptIds: Object.freeze(result.receipts.map((receipt) => receipt.receiptId)) });
    }

    const sources = result.matches.flatMap((match, index) => match.excerpts.length === 0 ? [] : [Object.freeze({
      channelName: match.channelName, channelId: match.channelId,
      receiptId: result.receipts[index]?.receiptId ?? '', excerpts: Object.freeze([...match.excerpts]),
    })]);
    if (sources.length === 0) return this.fallback('NO_RELEVANT_SLACK_CONTEXT', result.receipts.map((receipt) => receipt.receiptId));

    const supportedLines = sources.flatMap((source) => source.excerpts.map((excerpt) => `- ${excerpt}`));
    const answer = `Răspuns bazat pe context Slack allowlisted:\n${supportedLines.join('\n')}`;
    return sanitizeExternalValue(Object.freeze({ status: 'GROUNDED', answer, usesSlackContext: true, reason: 'SLACK_CONTEXT_SUPPORTED', sources: Object.freeze(sources), auditReceiptIds: Object.freeze(result.receipts.map((receipt) => receipt.receiptId)) })) as SlackGroundedConversationResult;
  }

  private fallback(reason: string, auditReceiptIds: readonly string[] = []): SlackGroundedConversationResult {
    return Object.freeze({ status: 'FALLBACK', answer: 'Nu am găsit context Slack relevant și verificabil pentru această întrebare.', usesSlackContext: false, reason, sources: Object.freeze([]), auditReceiptIds: Object.freeze([...auditReceiptIds]) });
  }
}

function selectGroundingTerm(question: string): string | undefined {
  const terms = question.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return [...terms].reverse().find((term) => term.length >= 4 && !STOP_WORDS.has(term));
}
