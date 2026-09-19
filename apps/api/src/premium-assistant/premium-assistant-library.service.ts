import { createHash } from 'node:crypto';
import {
  AgmGlobalLibraryAuthority,
  createDomainOrchestrators,
  type LibraryAuthorizationDecision,
  type LibraryAuthorizationPort,
  type LibraryRequest,
  type LibraryResolver,
  type LibraryResolverResult,
  type ResolvedContextPackage,
} from '@agm/library-control-plane';
import type { RequestContext } from '../common/request-context';
import type { PermissionGuardianService } from '../permission-guardian/permission-guardian.service';
import type { TranslationService } from '../translation/translation.service';
import type { PremiumAssistantRequestDto } from './dto/premium-assistant-request.dto';
import type { AssistantSourceReference } from './premium-assistant.contract';
import {
  classifyGmailIntent,
  composeGmailAnswerForUser,
  gmailFailureCode,
  type PremiumAssistantGmailService,
} from './premium-assistant-gmail.service';
import type { SharedArchiveService } from '../shared-archive/shared-archive.service';
import { createPhase2cArchiveResolvers } from './shared-archive-library.resolver';

export const GMAIL_LIBRARY_RESOLVER_ID = 'premium.gmail.inbox.v1';
export const HISTORY_LIBRARY_RESOLVER_ID = 'agm.conversation-history.v1';

export type ConversationHistoryTurn = {
  role: 'user' | 'assistant';
  text: string;
  occurredAt?: string;
};

type GmailGuardianTrace = {
  decision: 'APPROVED' | 'DENIED' | 'NOT_PROVEN';
  authorityGranted: boolean;
  evidenceId: string;
  correlationId: string;
  reasonCode: string;
};

export class PremiumAssistantLibraryService {
  constructor(
    private readonly gmail?: PremiumAssistantGmailService,
    private readonly guardian?: PermissionGuardianService,
    private readonly translation?: TranslationService,
    private readonly now = () => new Date(),
    private readonly archive?: SharedArchiveService,
  ) {}

  async resolve(user: RequestContext, request: PremiumAssistantRequestDto): Promise<ResolvedContextPackage> {
    const fallbackRequestId = `assistant:${shortHash(`${user.companyId}:${user.userId}:${request.moduleId}:${request.confirmedText}`)}`;
    const requestId = user.requestId.trim() || fallbackRequestId;
    const correlationId = user.correlationId.trim() || requestId;
    const orchestrators = createDomainOrchestrators();
    const gmailResolver = new GmailLibraryResolver(this.gmail, this.translation, this.now);
    const historyResolver = new ConversationHistoryLibraryResolver(this.now);
    orchestrators[0].register(historyResolver);
    orchestrators[1].register(gmailResolver);
    orchestrators[1].register(historyResolver);
    for (const resolver of createPhase2cArchiveResolvers(this.archive, this.now)) {
      orchestrators[0].register(resolver);
      orchestrators[1].register(resolver);
    }
    const authority = new AgmGlobalLibraryAuthority(
      orchestrators,
      new PremiumAssistantLibraryAuthorization(user, request, this.gmail, this.guardian),
      undefined,
      () => this.now().toISOString(),
    );
    return authority.resolve({
      requestId,
      correlationId,
      surface: request.surface ?? 'BROWSER',
      activeDomain: 'PREMIUM',
      requestedDomains: ['PREMIUM'],
      identity: { tenantId: user.companyId, subjectId: user.userId, roles: user.roles },
      query: { text: request.confirmedText, language: request.language },
      sourceInputs: { CONVERSATION_HISTORY: request.history },
    });
  }
}

export class GmailLibraryResolver implements LibraryResolver {
  readonly descriptor = {
    resolverId: GMAIL_LIBRARY_RESOLVER_ID,
    source: 'GMAIL' as const,
    owner: 'AGM_AUTHENTICATED_GMAIL',
    supportedDomains: ['PREMIUM', 'CAR_MOVER'] as const,
    sensitivity: 'CREDENTIAL_BOUND' as const,
    authorizationAction: 'library:read:gmail',
  };

  constructor(
    private readonly gmail?: PremiumAssistantGmailService,
    private readonly translation?: TranslationService,
    private readonly now = () => new Date(),
  ) {}

  match(request: LibraryRequest) {
    const intent = classifyGmailIntent(request.query.text);
    return intent
      ? { eligible: true, confidence: 0.94, intent: intent.operation, subject: intent.gmailQuery || 'recent inbox' }
      : { eligible: false, confidence: 0, intent: 'NOT_GMAIL' };
  }

  async resolve(input: Parameters<LibraryResolver['resolve']>[0]): Promise<LibraryResolverResult> {
    const intent = classifyGmailIntent(input.request.query.text);
    const key = shortHash(`${input.request.identity.subjectId}:${input.request.query.text}`);
    if (!intent || !this.gmail) return unavailableResult(input.request, 'GMAIL_RESOLVER_NOT_CONFIGURED', key);
    try {
      const result = await this.gmail.retrieve(input.request.query.text);
      const answer = await composeGmailAnswerForUser(result, input.request.query.language, this.translation);
      const observedAt = this.now().toISOString();
      return {
        status: result.messages.length ? 'FOUND' : 'NO_DATA',
        identity: { subjectType: 'GMAIL_QUERY', subjectId: `gmail-query:${key}`, displayName: input.match.subject ?? 'Gmail' },
        query: { intent: result.intent.operation, normalizedText: normalize(input.request.query.text) },
        result: { summary: result.messages.length ? answer.text : 'GMAIL_NO_DATA', recordCount: result.messages.length },
        confidence: input.match.confidence,
        ambiguity: { ambiguous: false, candidateIds: [] },
        provenance: {
          sourceRecordId: `gmail-query:${key}`,
          owner: input.request.identity.subjectId,
          namespace: 'authenticated-private-mailbox',
          evidenceRefs: result.sources.map((source) => source.sourceId),
        },
        freshness: { status: 'CURRENT', observedAt, expiresAt: new Date(this.now().getTime() + 5 * 60_000).toISOString() },
        minimalAuthorizedPayload: {
          answerText: answer.text,
          operation: result.intent.operation,
          sources: result.sources,
          actionContext: result.actionContext ?? null,
          translation: answer.translation,
        },
        deduplicationKey: `gmail:${key}`,
      };
    } catch (error) {
      return unavailableResult(input.request, gmailFailureCode(error), key);
    }
  }
}

export class ConversationHistoryLibraryResolver implements LibraryResolver {
  readonly descriptor = {
    resolverId: HISTORY_LIBRARY_RESOLVER_ID,
    source: 'CONVERSATION_HISTORY' as const,
    owner: 'AGM_SESSION_HISTORY',
    supportedDomains: ['BASIC', 'PREMIUM', 'CAR_MOVER'] as const,
    sensitivity: 'PERSONAL' as const,
    authorizationAction: 'library:read:conversation-history',
  };

  constructor(private readonly now = () => new Date()) {}

  match(request: LibraryRequest) {
    const match = classifyConversationHistoryIntent(request.query.text);
    return { eligible: match.eligible, confidence: match.confidence, intent: match.intent, subject: match.subject };
  }

  async resolve(input: Parameters<LibraryResolver['resolve']>[0]): Promise<LibraryResolverResult> {
    const turns = validHistoryTurns(input.request.sourceInputs?.CONVERSATION_HISTORY);
    const selected = searchConversationHistory(input.request.query.text, turns, this.now());
    const key = shortHash(`${input.request.identity.subjectId}:${input.request.query.text}`);
    const observedAt = selected.map((entry) => entry.turn.occurredAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? this.now().toISOString();
    const answerText = selected.length ? composeHistoryAnswer(selected, input.request.query.language) : historyNoDataText(input.request.query.language);
    const sources = selected.map(({ turn, index }) => historySourceReference(turn, index, input.request.query.language, observedAt));
    return {
      status: selected.length ? 'FOUND' : 'NO_DATA',
      identity: { subjectType: 'CONVERSATION_HISTORY', subjectId: input.request.identity.subjectId, displayName: input.match.subject ?? 'Conversation history' },
      query: { intent: input.match.intent, normalizedText: normalize(input.request.query.text) },
      result: { summary: selected.length ? answerText : 'CONVERSATION_HISTORY_NO_DATA', recordCount: selected.length },
      confidence: selected.length ? Math.min(0.98, Math.max(input.match.confidence, selected[0]!.score / 10)) : 1,
      ambiguity: { ambiguous: false, candidateIds: [] },
      provenance: {
        sourceRecordId: `conversation-query:${key}`,
        owner: input.request.identity.subjectId,
        namespace: 'agm-session-conversation-history',
        evidenceRefs: selected.map(({ turn, index }) => `turn:${index}:${shortHash(turn.text)}`),
      },
      freshness: { status: selected.length ? 'CURRENT' : 'UNKNOWN', observedAt, expiresAt: null },
      minimalAuthorizedPayload: {
        answerText,
        turns: selected.map(({ turn }) => ({ role: turn.role, text: turn.text.slice(0, 480), ...(turn.occurredAt ? { occurredAt: turn.occurredAt } : {}) })),
        sources,
      },
      deduplicationKey: `conversation-history:${key}`,
    };
  }
}

class PremiumAssistantLibraryAuthorization implements LibraryAuthorizationPort {
  constructor(
    private readonly user: RequestContext,
    private readonly request: PremiumAssistantRequestDto,
    private readonly gmail?: PremiumAssistantGmailService,
    private readonly guardian?: PermissionGuardianService,
  ) {}

  async authorize(input: Parameters<LibraryAuthorizationPort['authorize']>[0]): Promise<LibraryAuthorizationDecision> {
    if (!this.user.roles.includes('PREMIUM_ACCESS')) return denied('PREMIUM_ENTITLEMENT_REQUIRED');
    if (input.source.source === 'CONVERSATION_HISTORY') return {
      decision: 'GRANTED', authorityGranted: true, reasonCode: 'SESSION_OWNER_AND_PREMIUM_AUTHORIZED',
      evidenceRef: `history:${this.user.requestId}`, allowedPayloadFields: ['answerText', 'turns', 'records', 'sources'],
    };
    if (['PREVIOUS_TRANSLATIONS', 'OCR_ARCHIVE', 'AGM_SHARED_ARCHIVE'].includes(input.source.source)) return {
      decision: 'GRANTED', authorityGranted: true, reasonCode: 'ARCHIVE_OWNER_AND_PREMIUM_AUTHORIZED',
      evidenceRef: `shared-archive:${this.user.requestId}:${input.source.source}`,
      allowedPayloadFields: ['answerText', 'records', 'sources'],
    };
    if (input.source.source !== 'GMAIL') return denied('SOURCE_NOT_AUTHORIZED');
    if (!this.gmail?.configured()) return denied('GMAIL_NOT_CONFIGURED');
    let guardian: GmailGuardianTrace | undefined;
    try {
      guardian = await this.guardian?.evaluate(this.user, {
        phase: 'EXECUTION', requestedCapability: 'GMAIL_READONLY', requestedPermissionOrScope: 'https://www.googleapis.com/auth/gmail.readonly',
        requestor: 'agm.global-library-authority.gmail', reason: `Authorize Gmail retrieval for ${input.match.intent}`, risk: 'MEDIUM',
        currentAuthority: 'AUTHORIZED', evidence: `pre-retrieval:${this.request.moduleId}:${input.match.intent}`,
      }) as GmailGuardianTrace | undefined;
    } catch {
      guardian = undefined;
    }
    if (!guardian?.authorityGranted) return {
      ...denied(guardian?.reasonCode ?? 'GUARDIAN_NOT_PROVEN'),
      evidenceRef: guardian?.evidenceId ?? `guardian:not-proven:${this.user.requestId}`,
      metadata: guardian ? guardianMetadata(guardian) : undefined,
    };
    return {
      decision: 'GRANTED', authorityGranted: true, reasonCode: guardian.reasonCode, evidenceRef: guardian.evidenceId,
      allowedPayloadFields: ['answerText', 'operation', 'sources', 'actionContext', 'translation'],
      metadata: guardianMetadata(guardian),
    };
  }
}

export function classifyConversationHistoryIntent(text: string) {
  const normalized = normalize(text);
  const words = new Set(normalized.match(/[a-z0-9]+/g) ?? []);
  const hasAny = (values: readonly string[]) => values.some((value) => words.has(value));
  const retrospective = hasAny(['discutat', 'stabilit', 'spus', 'vorbit', 'mentionat', 'discussed', 'agreed', 'said', 'mentioned', 'besprochen', 'vereinbart', 'gesagt']);
  const memory = hasAny(['istoric', 'history', 'conversatie', 'conversation', 'memorie', 'memory'])
    || (/\b(?:informatii|informatie|ce)\b/.test(normalized) && /\b(?:avem deja|stiam deja|already know|already have)\b/.test(normalized));
  const prior = /\b(?:ultima data|last time|gestern|ieri|yesterday|anterior|inainte|previously)\b/.test(normalized)
    && hasAny(['discutat', 'spus', 'vorbit', 'stabilit', 'discussed', 'said', 'talked', 'agreed', 'besprochen']);
  const eligible = retrospective || memory || prior;
  return {
    eligible,
    confidence: eligible ? (retrospective ? 0.94 : 0.87) : 0,
    intent: eligible ? (hasAny(['cand', 'when', 'wann']) ? 'HISTORY_TIME_LOOKUP' : 'HISTORY_RELEVANCE_SEARCH') : 'NOT_HISTORY',
    subject: extractHistorySubject(normalized),
  };
}

export function searchConversationHistory(query: string, turns: readonly ConversationHistoryTurn[], now = new Date()) {
  const normalizedQuery = normalize(query);
  const terms = significantTerms(query);
  const yesterday = /\b(?:ieri|yesterday|gestern)\b/.test(normalizedQuery);
  const latestOnly = /\b(?:ultima data|last time|letztes mal)\b/.test(normalizedQuery);
  const expectedDay = yesterday ? localDay(new Date(now.getTime() - 24 * 60 * 60_000)) : null;
  const ranked = turns.map((turn, index) => {
    if (expectedDay && (!turn.occurredAt || localDay(new Date(turn.occurredAt)) !== expectedDay)) return { turn, index, score: 0 };
    const haystack = new Set(stemmedWords(turn.text));
    const overlap = terms.filter((term) => haystack.has(term)).length;
    const score = overlap * 4 + (terms.length > 1 && overlap === terms.length ? 3 : 0) + ((index + 1) / Math.max(turns.length, 1));
    return { turn, index, score };
  }).filter((entry) => entry.score >= (terms.length ? 4 : 0.5)).sort((left, right) => right.score - left.score || right.index - left.index);
  if (!ranked.length) return [];
  const selectedIndexes = new Set<number>();
  for (const match of ranked.slice(0, latestOnly ? 1 : 2)) {
    selectedIndexes.add(match.index);
    if (match.turn.role === 'user' && turns[match.index + 1]?.role === 'assistant') selectedIndexes.add(match.index + 1);
    if (match.turn.role === 'assistant' && turns[match.index - 1]?.role === 'user') selectedIndexes.add(match.index - 1);
  }
  return [...selectedIndexes].sort((left, right) => left - right).slice(-4).map((index) => ({
    turn: turns[index]!, index, score: ranked.find((entry) => entry.index === index)?.score ?? ranked[0]!.score * 0.9,
  }));
}

export function guardianTraceFromPackage(value: ResolvedContextPackage): GmailGuardianTrace | undefined {
  const authorization = value.mandates.flatMap((mandate) => mandate.authorizedResolvers).find((resolver) => resolver.resolverId === GMAIL_LIBRARY_RESOLVER_ID)?.authorization;
  const denial = value.authorizationDenials.find((item) => item.resolverId === GMAIL_LIBRARY_RESOLVER_ID);
  const metadata = authorization?.metadata ?? denial?.metadata;
  if (!metadata?.guardianDecision || !metadata.guardianEvidenceId || !metadata.guardianCorrelationId) return undefined;
  return {
    decision: metadata.guardianDecision as GmailGuardianTrace['decision'], authorityGranted: Boolean(authorization?.authorityGranted),
    evidenceId: metadata.guardianEvidenceId, correlationId: metadata.guardianCorrelationId,
    reasonCode: authorization?.reasonCode ?? denial?.reasonCode ?? 'AUTHORIZED',
  };
}

function unavailableResult(request: LibraryRequest, code: string, key: string): LibraryResolverResult {
  const observedAt = new Date().toISOString();
  return {
    status: 'UNAVAILABLE',
    identity: { subjectType: 'GMAIL_QUERY', subjectId: `gmail-query:${key}`, displayName: 'Gmail' },
    query: { intent: 'GMAIL_RETRIEVAL', normalizedText: normalize(request.query.text) },
    result: { summary: code, recordCount: 0 }, confidence: 1,
    ambiguity: { ambiguous: false, candidateIds: [] },
    provenance: { sourceRecordId: `gmail-query:${key}`, owner: request.identity.subjectId, namespace: 'authenticated-private-mailbox', evidenceRefs: [] },
    freshness: { status: 'UNKNOWN', observedAt, expiresAt: null }, minimalAuthorizedPayload: {}, deduplicationKey: `gmail:${key}`,
  };
}

function denied(reasonCode: string): LibraryAuthorizationDecision {
  return { decision: 'NOT_PROVEN', authorityGranted: false, reasonCode, evidenceRef: `authorization:${reasonCode}`, allowedPayloadFields: [] };
}

function guardianMetadata(guardian: GmailGuardianTrace) {
  return { guardianDecision: guardian.decision, guardianEvidenceId: guardian.evidenceId, guardianCorrelationId: guardian.correlationId };
}

function validHistoryTurns(value: unknown): ConversationHistoryTurn[] {
  if (!Array.isArray(value)) return [];
  return value.filter((turn): turn is ConversationHistoryTurn => Boolean(turn) && typeof turn === 'object'
    && ((turn as ConversationHistoryTurn).role === 'user' || (turn as ConversationHistoryTurn).role === 'assistant')
    && typeof (turn as ConversationHistoryTurn).text === 'string')
    .map((turn) => ({ role: turn.role, text: turn.text.trim().slice(0, 4_000), ...(validIso(turn.occurredAt) ? { occurredAt: turn.occurredAt } : {}) }))
    .filter((turn) => turn.text)
    .slice(-20);
}

function significantTerms(value: string) {
  const stop = new Set(['ce', 'am', 'ai', 'a', 'despre', 'ultima', 'data', 'cand', 'discutat', 'stabilit', 'spus', 'vorbit', 'ieri', 'informatii', 'informatie', 'avem', 'deja', 'problema', 'asta', 'the', 'what', 'did', 'we', 'about', 'last', 'time', 'when', 'yesterday', 'already', 'have', 'said', 'discussed']);
  return [...new Set(stemmedWords(value).filter((word) => word.length >= 3 && !stop.has(word)))];
}

function stemmedWords(value: string) {
  return (normalize(value).match(/[a-z0-9]+/g) ?? []).map((word) => word.replace(/(?:ului|elor|ile|ul|ua|ei)$/i, '')).filter(Boolean);
}

function extractHistorySubject(value: string) {
  const match = /\b(?:despre|about|uber)\s+(.+?)(?:[?!.]|$)/.exec(value);
  return match?.[1]?.trim().slice(0, 120) || 'relevant conversation';
}

function composeHistoryAnswer(selected: readonly { turn: ConversationHistoryTurn; index: number; score: number }[], language: string) {
  const newest = selected.at(-1)!;
  const snippets = selected.slice(-2).map(({ turn }) => turn.text.replace(/\s+/g, ' ').trim().slice(0, 320));
  const when = newest.turn.occurredAt ? new Intl.DateTimeFormat(language === 'ro' ? 'ro-RO' : language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(newest.turn.occurredAt)) : '';
  if (language === 'ro') return `Am găsit conversația relevantă${when ? ` din ${when}` : ''}: ${snippets.join(' ')}`;
  if (language === 'de') return `Ich habe das relevante Gespräch${when ? ` vom ${when}` : ''} gefunden: ${snippets.join(' ')}`;
  return `I found the relevant conversation${when ? ` from ${when}` : ''}: ${snippets.join(' ')}`;
}

export function historyNoDataText(language: string) {
  if (language === 'ro') return 'Am verificat istoricul conversației, dar nu am găsit informația cerută.';
  if (language === 'de') return 'Ich habe den Gesprächsverlauf geprüft, aber die angefragte Information nicht gefunden.';
  return 'I checked the conversation history but did not find the requested information.';
}

export function gmailNoDataText(language: string) {
  if (language === 'ro') return 'Am verificat Gmail, dar nu am găsit niciun mesaj care să corespundă cererii.';
  if (language === 'de') return 'Ich habe Gmail geprüft, aber keine passende Nachricht gefunden.';
  return 'I checked Gmail but did not find a message matching the request.';
}

function historySourceReference(turn: ConversationHistoryTurn, index: number, language: string, observedAt: string): AssistantSourceReference {
  const id = shortHash(`${index}:${turn.role}:${turn.text}`);
  return {
    sourceId: `AGM-HISTORY-${id}`, title: 'AGM conversation history', origin: 'AGM session history',
    urlOrIdentifier: `agm:conversation-turn:${id}`, timestamp: turn.occurredAt ?? null, domain: ['CONVERSATION_HISTORY'], language,
    confidence: 0.95, originType: 'AGM_INTERNAL', retrievalType: 'LIBRARY',
    freshness: { status: 'CURRENT', checkedAt: observedAt, expiresAt: null, ttlSeconds: 0 },
    provenance: { canonicalPath: null, sha256: shortHash(turn.text), authorityType: 'AUTHENTICATED_SESSION_OWNER', reviewStatus: 'SESSION_OBSERVATION' },
  };
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function localDay(value: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

function shortHash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
