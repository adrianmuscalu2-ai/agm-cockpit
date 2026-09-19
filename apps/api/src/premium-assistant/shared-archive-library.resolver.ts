import { createHash } from 'node:crypto';
import type {
  AgmLibrarySourceId,
  LibraryRequest,
  LibraryResolver,
  LibraryResolverResult,
} from '@agm/library-control-plane';
import type { SharedArchiveService } from '../shared-archive/shared-archive.service';
import type { SharedArchiveCategory } from '../shared-archive/shared-archive.policy';
import type { AssistantSourceReference } from './premium-assistant.contract';

export const OCR_ARCHIVE_RESOLVER_ID = 'agm.ocr-archive.phase2c.v1';
export const TRANSLATION_ARCHIVE_RESOLVER_ID = 'agm.previous-translations.phase2c.v1';
export const PERSISTENT_HISTORY_RESOLVER_ID = 'agm.persistent-conversation-history.phase2c.v1';
export const SHARED_ARCHIVE_RESOLVER_ID = 'agm.shared-archive.phase2c.v1';

type ArchiveResolverDefinition = {
  resolverId: string;
  source: AgmLibrarySourceId;
  category?: SharedArchiveCategory;
  owner: string;
  intent: (text: string) => { eligible: boolean; confidence: number; intent: string; subject?: string };
};

export class SharedArchiveLibraryResolver implements LibraryResolver {
  readonly descriptor;

  constructor(
    private readonly definition: ArchiveResolverDefinition,
    private readonly archive?: SharedArchiveService,
    private readonly now = () => new Date(),
  ) {
    this.descriptor = {
      resolverId: definition.resolverId,
      source: definition.source,
      owner: definition.owner,
      supportedDomains: ['BASIC', 'PREMIUM'] as const,
      sensitivity: 'PERSONAL' as const,
      authorizationAction: `library:read:${definition.source.toLowerCase()}`,
    };
  }

  match(request: LibraryRequest) {
    const match = this.definition.intent(request.query.text);
    const hinted = request.query.intentHints?.includes(this.definition.source)
      || (this.definition.source === 'AGM_SHARED_ARCHIVE' && request.query.intentHints?.includes('AGM_SHARED_ARCHIVE'));
    return !match.eligible && hinted
      ? { eligible: true, confidence: 0.82, intent: `${this.definition.source}_HINTED_SEARCH`, subject: match.subject }
      : match;
  }

  async resolve(input: Parameters<LibraryResolver['resolve']>[0]): Promise<LibraryResolverResult> {
    const key = hash(`${this.definition.resolverId}:${input.request.identity.subjectId}:${input.request.query.text}`);
    if (!this.archive) return unavailable(input.request, input.match.intent, key, this.definition);
    const range = temporalRange(input.request.query.text, this.now());
    const records = await this.archive.query(contextFrom(input.request), {
      query: input.match.subject ?? input.request.query.text,
      ...(this.definition.category ? { category: this.definition.category } : {}),
      requestSurface: input.request.surface === 'ANDROID' ? 'ANDROID' : 'BROWSER',
      ...range,
    });
    const selected = records.slice(0, 4);
    const answerText = selected.length
      ? composeArchiveAnswer(selected, input.request.query.language, this.definition.category)
      : archiveNoDataText(input.request.query.language, this.definition.category);
    const observedAt = selected[0]?.observedAt ?? this.now().toISOString();
    return {
      status: selected.length ? 'FOUND' : 'NO_DATA',
      identity: {
        subjectType: this.definition.source,
        subjectId: selected[0]?.id ?? null,
        displayName: input.match.subject ?? this.definition.category ?? 'AGM shared archive',
      },
      query: { intent: input.match.intent, normalizedText: normalize(input.request.query.text) },
      result: { summary: selected.length ? answerText : 'SHARED_ARCHIVE_NO_DATA', recordCount: selected.length },
      confidence: selected.length ? input.match.confidence : 1,
      ambiguity: { ambiguous: false, candidateIds: [] },
      provenance: {
        sourceRecordId: `archive-query:${key}`,
        owner: input.request.identity.subjectId,
        namespace: 'agm-user-approved-shared-archive',
        evidenceRefs: selected.map((record) => `archive:${record.id}`),
      },
      freshness: { status: selected.length ? 'CURRENT' : 'UNKNOWN', observedAt, expiresAt: null },
      minimalAuthorizedPayload: {
        answerText,
        records: selected.map((record) => ({
          id: record.id,
          category: record.category,
          namespace: record.namespace,
          title: record.title,
          payload: record.payload,
          observedAt: record.observedAt,
          sourceSurface: record.sourceSurface,
        })),
        sources: selected.map((record) => archiveSource(record, input.request.query.language)),
      },
      deduplicationKey: `${this.definition.source.toLowerCase()}:${key}`,
    };
  }
}

export function createPhase2cArchiveResolvers(archive?: SharedArchiveService, now = () => new Date()) {
  return [
    new SharedArchiveLibraryResolver({
      resolverId: OCR_ARCHIVE_RESOLVER_ID,
      source: 'OCR_ARCHIVE',
      category: 'OCR',
      owner: 'AGM_USER_APPROVED_OCR_ARCHIVE',
      intent: classifyOcrArchiveIntent,
    }, archive, now),
    new SharedArchiveLibraryResolver({
      resolverId: TRANSLATION_ARCHIVE_RESOLVER_ID,
      source: 'PREVIOUS_TRANSLATIONS',
      category: 'TRANSLATION',
      owner: 'AGM_USER_APPROVED_TRANSLATION_ARCHIVE',
      intent: classifyTranslationArchiveIntent,
    }, archive, now),
    new SharedArchiveLibraryResolver({
      resolverId: PERSISTENT_HISTORY_RESOLVER_ID,
      source: 'CONVERSATION_HISTORY',
      category: 'CONVERSATION',
      owner: 'AGM_USER_APPROVED_CONVERSATION_ARCHIVE',
      intent: classifyPersistentHistoryIntent,
    }, archive, now),
    new SharedArchiveLibraryResolver({
      resolverId: SHARED_ARCHIVE_RESOLVER_ID,
      source: 'AGM_SHARED_ARCHIVE',
      owner: 'AGM_USER_APPROVED_SHARED_ARCHIVE',
      intent: classifySharedArchiveIntent,
    }, archive, now),
  ] as const;
}

export function classifyOcrArchiveIntent(text: string) {
  const value = normalize(text);
  const eligible = /\b(?:scanat|scanare|ocr|fotografiat|document(?:ul|e|ele)?|act|imagine|scanned|scan|documents?|photo)\b/.test(value)
    && /\b(?:ce|care|gaseste|cauta|arata|despre|what|which|find|show|about)\b/.test(value);
  return classification(eligible, eligible ? 0.95 : 0, 'OCR_ARCHIVE_SEARCH', archiveSubject(value));
}

export function classifyTranslationArchiveIntent(text: string) {
  const value = normalize(text);
  const eligible = /\b(?:traducere|tradus|traducerea|tradusesem|translation|translated|ubersetzung|uebersetzung)\b/.test(value)
    && /\b(?:foloseste|ultima|gaseste|arata|ieri|client|use|last|find|show|yesterday|kunde)\b/.test(value);
  return classification(eligible, eligible ? 0.96 : 0, 'PREVIOUS_TRANSLATION_SEARCH', archiveSubject(value));
}

export function classifyPersistentHistoryIntent(text: string) {
  const value = normalize(text);
  const eligible = /\b(?:arhivat|arhiva|persistenta|salvat|pastrat|archived|archive|saved|stored)\b/.test(value)
    && /\b(?:discutie|conversatie|istoric|discutat|conversation|history|discussed)\b/.test(value);
  return classification(eligible, eligible ? 0.93 : 0, 'PERSISTENT_HISTORY_SEARCH', archiveSubject(value));
}

export function classifySharedArchiveIntent(text: string) {
  const value = normalize(text);
  const explicitArchive = /\b(?:biblioteca|arhiva|arhivat|salvat|pastrat|library|archive|saved|stored)\b/.test(value);
  const accumulatedKnowledge = /\b(?:informatii|informatie|date|ce)\b/.test(value)
    && /\b(?:avem deja|stim deja|exista deja|already have|already know|stored)\b/.test(value);
  const eligible = explicitArchive || accumulatedKnowledge;
  return classification(eligible, eligible ? 0.88 : 0, 'SHARED_ARCHIVE_SEARCH', archiveSubject(value));
}

export function archiveNoDataText(language: string, category?: SharedArchiveCategory) {
  const label = category === 'OCR' ? 'documentele OCR arhivate' : category === 'TRANSLATION' ? 'traducerile arhivate' : category === 'CONVERSATION' ? 'conversațiile arhivate' : 'arhiva AGM';
  if (language === 'ro') return `Am verificat ${label}, dar nu am găsit informația cerută.`;
  if (language === 'de') return 'Ich habe das freigegebene AGM-Archiv geprüft, aber die angefragte Information nicht gefunden.';
  return 'I checked the user-approved AGM archive but did not find the requested information.';
}

function composeArchiveAnswer(records: readonly ArchiveRecord[], language: string, category?: SharedArchiveCategory) {
  const snippets = records.slice(0, 3).map((record) => summarizeRecord(record)).filter(Boolean);
  if (language === 'ro') {
    const label = category === 'OCR' ? 'documentul OCR' : category === 'TRANSLATION' ? 'traducerea' : category === 'CONVERSATION' ? 'conversația arhivată' : 'informația arhivată';
    return `Am găsit ${label}: ${snippets.join(' ')}`;
  }
  if (language === 'de') return `Ich habe den freigegebenen Archiveintrag gefunden: ${snippets.join(' ')}`;
  return `I found the user-approved archive record: ${snippets.join(' ')}`;
}

function summarizeRecord(record: ArchiveRecord) {
  const payload = record.payload && typeof record.payload === 'object' && !Array.isArray(record.payload) ? record.payload as Record<string, unknown> : {};
  const text = ['translatedText', 'extractedText', 'summary', 'content', 'text', 'sourceText']
    .map((field) => payload[field]).find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return `${record.title}${text ? ` — ${text.replace(/\s+/g, ' ').trim().slice(0, 420)}` : ''}`;
}

function archiveSource(record: ArchiveRecord, language: string): AssistantSourceReference {
  return {
    sourceId: `AGM-ARCHIVE-${record.id}`,
    title: record.title,
    origin: 'AGM user-approved shared archive',
    urlOrIdentifier: `agm:shared-archive:${record.id}`,
    timestamp: record.observedAt,
    domain: [record.category],
    language,
    confidence: 0.96,
    originType: 'DOCUMENT_LIBRARY',
    retrievalType: 'LIBRARY',
    freshness: { status: 'CURRENT', checkedAt: new Date().toISOString(), expiresAt: null, ttlSeconds: 0 },
    provenance: { canonicalPath: record.namespace, sha256: hash(JSON.stringify(record.payload)), authorityType: 'AUTHENTICATED_USER_APPROVAL', reviewStatus: 'USER_APPROVED_PERSISTENT' },
  };
}

function unavailable(request: LibraryRequest, intent: string, key: string, definition: ArchiveResolverDefinition): LibraryResolverResult {
  const observedAt = new Date().toISOString();
  return {
    status: 'UNAVAILABLE',
    identity: { subjectType: definition.source, subjectId: null, displayName: definition.category ?? 'AGM shared archive' },
    query: { intent, normalizedText: normalize(request.query.text) },
    result: { summary: 'SHARED_ARCHIVE_RESOLVER_NOT_CONFIGURED', recordCount: 0 },
    confidence: 1,
    ambiguity: { ambiguous: false, candidateIds: [] },
    provenance: { sourceRecordId: `archive-query:${key}`, owner: request.identity.subjectId, namespace: 'agm-user-approved-shared-archive', evidenceRefs: [] },
    freshness: { status: 'UNKNOWN', observedAt, expiresAt: null },
    minimalAuthorizedPayload: {},
    deduplicationKey: `${definition.source.toLowerCase()}:${key}`,
  };
}

function contextFrom(request: LibraryRequest) {
  return {
    requestId: request.requestId,
    correlationId: request.correlationId,
    userId: request.identity.subjectId,
    companyId: request.identity.tenantId,
    roles: [...request.identity.roles],
  };
}

function temporalRange(text: string, now: Date) {
  if (!/\b(?:ieri|yesterday|gestern)\b/.test(normalize(text))) return {};
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function archiveSubject(value: string) {
  const stripped = value
    .replace(/\b(?:foloseste|gaseste|cauta|arata|ce|care|am|ai|despre|in|din|pe|la|ultima|ultimul|ieri|traducerea|traducere|tradus|documentul|document|scanat|scanare|ocr|arhiva|biblioteca|informatii|informatie|avem|deja|use|find|show|what|which|about|last|yesterday|translation|translated|document|scanned|archive|library|already|have)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || undefined;
}

function classification(eligible: boolean, confidence: number, intent: string, subject?: string) {
  return { eligible, confidence, intent, ...(subject ? { subject } : {}) };
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

type ArchiveRecord = Awaited<ReturnType<SharedArchiveService['query']>>[number];
