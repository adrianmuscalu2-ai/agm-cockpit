import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CanonicalAuthorityLoader } from '../canonical-authority/canonical-authority.loader';
import type { CanonicalSource } from '../canonical-authority/canonical-authority.contract';
import type { AssistantSourceReference, AssistantSourceTrace } from './premium-assistant.contract';

const LIBRARY_CACHE_TTL_MS = 15 * 60_000;
const LIVE_CACHE_TTL_MS = 60_000;
const TRACE_TTL_MS = 30 * 60_000;
export const MAX_EGRESS_SOURCES = 6;
export const MAX_EGRESS_CHARS_PER_SOURCE = 900;
const MAX_INDEXED_SOURCE_BYTES = 768 * 1024;
const TEXT_SOURCE_EXTENSIONS = new Set(['.html', '.htm', '.md', '.txt', '.json', '.csv', '.tsv']);

type IndexedSource = { source: CanonicalSource; reference: AssistantSourceReference; terms: Set<string>; dedupKey: string; content: string };
type CachedAnswer = { text: string; kind: 'answer' | 'clarification'; sources: AssistantSourceReference[]; expiresAtMs: number };
type StoredTrace = { trace: AssistantSourceTrace; ownerCompanyId: string; expiresAtMs: number };

@Injectable()
export class PremiumAssistantKnowledgeService {
  private readonly index: IndexedSource[];
  private readonly answerCache = new Map<string, CachedAnswer>();
  private readonly traces = new Map<string, StoredTrace>();
  private readonly invalidated = new Map<string, { reason: string; invalidatedAt: string }>();

  constructor(private readonly library: CanonicalAuthorityLoader) {
    this.index = deduplicate(this.library.sources().filter(isCurrentApprovedSource).map((source) => this.indexSource(source)));
  }

  resolve(question: string, language: string, liveIntent: boolean, now = new Date()) {
    this.prune(now.getTime());
    const queryTerms = semanticTerms(question);
    const rankedEntries = this.index
      .filter((entry) => !this.invalidated.has(entry.source.sourceId))
      .map((entry) => ({ entry, score: semanticScore(queryTerms, entry.terms, language, entry.reference.language) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.entry.source.sourceId.localeCompare(right.entry.source.sourceId))
      .slice(0, MAX_EGRESS_SOURCES);
    const ranked = rankedEntries.map((item) => refreshReference(item.entry.reference, now));
    const allCurrent = ranked.length > 0 && ranked.every((source) => source.freshness.status === 'CURRENT');
    const alwaysLive = /(?:^|[^a-z0-9])(weather|wetter|meteo|vreme|traffic|verkehr|trafic|price|preis|pret|opening|geoffnet|deschis)/i.test(normalize(question));
    const expiredMatch = ranked.some((source) => ['STALE', 'EXPIRED', 'INVALIDATED'].includes(source.freshness.status));
    return {
      sources: ranked,
      requiresLiveSearch: alwaysLive || expiredMatch || (liveIntent && !allCurrent),
      context: rankedEntries.map((item, index) => {
        const source = ranked[index]!;
        const excerpt = relevantExcerpt(item.entry.content, queryTerms);
        if (!excerpt || source.freshness.status !== 'CURRENT') return null;
        return {
          sourceId: source.sourceId,
          title: redactSensitiveContent(source.title),
          origin: redactSensitiveContent(source.origin),
          domain: source.domain,
          language: source.language,
          confidence: source.confidence,
          freshnessStatus: source.freshness.status,
          reviewStatus: source.provenance.reviewStatus,
          excerpt,
        };
      }).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    };
  }

  cacheKey(input: { companyId: string; moduleId: string; language: string; question: string; contextRefs: readonly string[] }) {
    return createHash('sha256').update(JSON.stringify({ ...input, question: normalize(input.question) })).digest('hex');
  }

  cachedAnswer(key: string, now = new Date()) {
    this.prune(now.getTime());
    const cached = this.answerCache.get(key);
    if (!cached) return null;
    return { ...cached, sources: cached.sources.map((source) => ({ ...source, retrievalType: 'CACHE' as const })) };
  }

  storeAnswer(key: string, value: Omit<CachedAnswer, 'expiresAtMs'>, now = new Date()) {
    const sourceExpiry = value.sources.map((source) => Date.parse(source.freshness.expiresAt ?? '')).filter(Number.isFinite);
    const policyTtl = value.sources.some((source) => source.retrievalType === 'LIVE') ? LIVE_CACHE_TTL_MS : LIBRARY_CACHE_TTL_MS;
    const expiresAtMs = Math.min(now.getTime() + policyTtl, ...sourceExpiry.filter((timestamp) => timestamp > now.getTime()));
    this.answerCache.set(key, { ...value, expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : now.getTime() + policyTtl });
  }

  createTrace(sources: readonly AssistantSourceReference[], status: AssistantSourceTrace['status'], ownerCompanyId: string, now = new Date()) {
    const unique = deduplicateReferences(sources);
    const trace: AssistantSourceTrace = {
      traceId: randomUUID(),
      status,
      generatedAt: now.toISOString(),
      counts: {
        total: unique.length,
        library: unique.filter((source) => source.retrievalType === 'LIBRARY').length,
        live: unique.filter((source) => source.retrievalType === 'LIVE').length,
        cache: unique.filter((source) => source.retrievalType === 'CACHE').length,
      },
      sources: unique,
    };
    this.traces.set(trace.traceId, { trace, ownerCompanyId, expiresAtMs: now.getTime() + TRACE_TTL_MS });
    return trace;
  }

  trace(traceId: string, ownerCompanyId: string, now = new Date()) {
    this.prune(now.getTime());
    const stored = this.traces.get(traceId);
    if (!stored || stored.ownerCompanyId !== ownerCompanyId) throw new NotFoundException('Assistant source trace expired or unavailable.');
    return stored.trace;
  }

  invalidate(sourceId: string, reason: string, now = new Date()) {
    if (!this.library.source(sourceId)) throw new NotFoundException('Canonical source not found.');
    this.invalidated.set(sourceId, { reason, invalidatedAt: now.toISOString() });
    for (const [key, cached] of this.answerCache) if (cached.sources.some((source) => source.sourceId === sourceId)) this.answerCache.delete(key);
    return { sourceId, status: 'INVALIDATED' as const, reason, invalidatedAt: now.toISOString() };
  }

  refresh(sourceId: string, now = new Date()) {
    const source = this.library.source(sourceId);
    if (!source) throw new NotFoundException('Canonical source not found.');
    const next = this.indexSource(source);
    const index = this.index.findIndex((entry) => entry.source.sourceId === sourceId);
    if (index >= 0) this.index[index] = next; else this.index.push(next);
    this.invalidated.delete(sourceId);
    return { sourceId, status: refreshReference(next.reference, now).freshness.status, refreshedAt: now.toISOString() };
  }

  stats() {
    return { canonicalSources: this.library.sources().length, semanticEntries: this.index.length, cachedAnswers: this.answerCache.size, activeTraces: this.traces.size, invalidatedSources: this.invalidated.size };
  }

  private indexSource(source: CanonicalSource): IndexedSource {
    const libraryPath = source.canonicalPath.startsWith('AGM_LIBRARY/') || source.canonicalPath.startsWith('AGM_LIBRARY' + String.fromCharCode(92));
    const originType = libraryPath || source.canonicalUri ? 'DOCUMENT_LIBRARY' as const : 'AGM_INTERNAL' as const;
    const domains = [
      this.library.contains('ROUTING_TOLL', source.sourceId) ? 'ROUTING_TOLL' : null,
      this.library.contains('LEGISLATION_SAFETY', source.sourceId) ? 'LEGISLATION_SAFETY' : null,
    ].filter((value): value is string => Boolean(value));
    const language = inferLanguage(source);
    const reference: AssistantSourceReference = {
      sourceId: source.sourceId,
      title: basename(source.canonicalPath, extname(source.canonicalPath)) || source.authority.issuingBody || source.version || source.sourceId,
      origin: source.authority.issuingBody ?? (originType === 'AGM_INTERNAL' ? 'AGM' : 'Canonical library'),
      urlOrIdentifier: source.canonicalUri ?? source.canonicalPath,
      timestamp: source.freshness?.lastFreshnessCheck ?? source.freshness?.capturedAt ?? source.sourceDate,
      domain: domains.length ? domains : ['GENERAL'],
      language,
      confidence: confidence(source),
      originType,
      retrievalType: 'LIBRARY',
      freshness: sourceFreshness(source, originType, new Date()),
      provenance: { canonicalPath: source.canonicalPath, sha256: source.sha256, authorityType: source.authority.authorityType, reviewStatus: source.authority.reviewStatus },
    };
    const content = this.readApprovedTextSource(source);
    const semanticText = [source.sourceId, source.version, source.authority.issuingBody, source.authority.jurisdictions.join(' '), domains.join(' '), source.canonicalPath, source.canonicalUri, content].filter(Boolean).join(' ');
    return { source, reference, terms: semanticTerms(semanticText), dedupKey: source.sha256 || normalize(source.canonicalUri ?? source.sourceId), content };
  }

  private readApprovedTextSource(source: CanonicalSource) {
    if (!isCurrentApprovedSource(source) || !source.canonicalPath.replace(/\\/g, '/').startsWith('AGM_LIBRARY/')) return '';
    if (!TEXT_SOURCE_EXTENSIONS.has(extname(source.canonicalPath).toLowerCase())) return '';
    const workspaceRoot = this.library.workspaceRoot;
    if (!workspaceRoot || typeof this.library.absolutePath !== 'function') return '';
    const libraryRoot = resolve(workspaceRoot, 'AGM_LIBRARY');
    const target = this.library.absolutePath(source.canonicalPath);
    const containedPath = relative(libraryRoot, target);
    if (!containedPath || containedPath.startsWith('..') || isAbsolute(containedPath) || !existsSync(target)) return '';
    try {
      if (!statSync(target).isFile()) return '';
      const bytes = readFileSync(target).subarray(0, MAX_INDEXED_SOURCE_BYTES);
      return sourceText(bytes.toString('utf8'), extname(source.canonicalPath).toLowerCase());
    } catch {
      return '';
    }
  }

  private prune(nowMs: number) {
    for (const [key, value] of this.answerCache) if (value.expiresAtMs <= nowMs) this.answerCache.delete(key);
    for (const [key, value] of this.traces) if (value.expiresAtMs <= nowMs) this.traces.delete(key);
  }
}

export function liveSourceReference(input: { url: string; title?: string; observedAt: Date }): AssistantSourceReference {
  const host = safeHost(input.url);
  return {
    sourceId: `WEB-${createHash('sha256').update(input.url).digest('hex').slice(0, 20)}`,
    title: input.title?.trim() || host || 'Web source',
    origin: host || 'Public web',
    urlOrIdentifier: input.url,
    timestamp: input.observedAt.toISOString(),
    domain: ['WEB'],
    language: 'und',
    confidence: 0.7,
    originType: 'WEB',
    retrievalType: 'LIVE',
    freshness: { status: 'CURRENT', checkedAt: input.observedAt.toISOString(), expiresAt: new Date(input.observedAt.getTime() + LIVE_CACHE_TTL_MS).toISOString(), ttlSeconds: LIVE_CACHE_TTL_MS / 1000 },
    provenance: { canonicalPath: null, sha256: null, authorityType: 'EXTERNAL_WEB', reviewStatus: 'LIVE_PROVIDER_OBSERVATION' },
  };
}

function refreshReference(reference: AssistantSourceReference, now: Date): AssistantSourceReference {
  const expiresAtMs = Date.parse(reference.freshness.expiresAt ?? '');
  if (reference.freshness.status === 'INVALIDATED' || !Number.isFinite(expiresAtMs) || expiresAtMs > now.getTime()) return reference;
  return { ...reference, freshness: { ...reference.freshness, status: 'EXPIRED', ttlSeconds: 0 } };
}

function sourceFreshness(source: CanonicalSource, originType: AssistantSourceReference['originType'], now: Date): AssistantSourceReference['freshness'] {
  const checkedAt = source.freshness?.lastFreshnessCheck ?? source.freshness?.capturedAt ?? (source.sourceDate ? `${source.sourceDate}T00:00:00.000Z` : null);
  const explicitExpiry = source.freshness?.nextFreshnessCheck ?? source.freshness?.effectiveUntil;
  const policyTtlMs = originType === 'AGM_INTERNAL' ? 30 * 86_400_000 : 7 * 86_400_000;
  const checkedAtMs = Date.parse(checkedAt ?? '');
  const expiresAtMs = explicitExpiry ? Date.parse(explicitExpiry) : Number.isFinite(checkedAtMs) ? checkedAtMs + policyTtlMs : NaN;
  const registryCurrent = isRegistryCurrent(source);
  const expired = Number.isFinite(expiresAtMs) && expiresAtMs <= now.getTime();
  return {
    status: expired ? 'EXPIRED' : registryCurrent ? 'CURRENT' : 'UNKNOWN',
    checkedAt,
    expiresAt: Number.isFinite(expiresAtMs) ? new Date(expiresAtMs).toISOString() : null,
    ttlSeconds: Number.isFinite(expiresAtMs) ? Math.max(0, Math.floor((expiresAtMs - now.getTime()) / 1000)) : 0,
  };
}

function deduplicate(entries: IndexedSource[]) {
  const unique = new Map<string, IndexedSource>();
  for (const entry of entries) {
    const existing = unique.get(entry.dedupKey);
    if (!existing) unique.set(entry.dedupKey, entry);
    else for (const term of entry.terms) existing.terms.add(term);
  }
  return [...unique.values()];
}

function deduplicateReferences(sources: readonly AssistantSourceReference[]) {
  const keys = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.originType}:${normalize(source.urlOrIdentifier ?? source.sourceId)}`;
    return keys.has(key) ? false : (keys.add(key), true);
  });
}

function semanticScore(query: Set<string>, source: Set<string>, requestedLanguage: string, sourceLanguage: string) {
  let score = 0;
  for (const term of query) if (source.has(term)) score += term.length > 6 ? 4 : 2;
  if (sourceLanguage === requestedLanguage) score += 1;
  return score;
}

function relevantExcerpt(content: string, query: Set<string>) {
  if (!content) return '';
  const candidates = content.split(/(?:\r?\n){1,}|(?<=[.!?])\s+/).map((value) => value.trim()).filter((value) => value.length >= 24);
  const ranked = candidates
    .map((value, index) => ({ value, index, score: semanticScore(query, semanticTerms(value), '', '') }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 4)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.value);
  return redactSensitiveContent(ranked.join(' ')).slice(0, MAX_EGRESS_CHARS_PER_SOURCE).trim();
}

function sourceText(value: string, extension: string) {
  const withoutExecutableHtml = extension === '.html' || extension === '.htm'
    ? value
      .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
    : value;
  return decodeHtmlEntities(withoutExecutableHtml).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d{1,6});/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

export function redactSensitiveContent(value: string) {
  return value
    .replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/gi, '[REDACTED_SECRET]')
    .replace(/\b(?:sk|rk|pk|ghp|gho|github_pat)[-_][A-Za-z0-9_-]{16,}\b/g, '[REDACTED_SECRET]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password|passwd|authorization|bearer)\b\s*[:=]\s*["']?[^\s,"';]{6,}/gi, '$1=[REDACTED_SECRET]')
    .replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/gi, '[REDACTED_IBAN]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]')
    .replace(/(?:\+\d{1,3}[ .()-]*)?(?:\d[ .()-]*){7,14}\d\b/g, '[REDACTED_PHONE]')
    .replace(/\s+/g, ' ')
    .trim();
}

export type AssistantKnowledgeEgress = {
  sourceId: string;
  title: string;
  origin: string;
  domain: string[];
  language: string;
  confidence: number;
  freshnessStatus: string;
  reviewStatus: string;
  excerpt: string;
};

export function prepareKnowledgeEgress(context: readonly AssistantKnowledgeEgress[]) {
  return context
    .filter((item) => item.freshnessStatus === 'CURRENT' && isApprovedReviewStatus(item.reviewStatus))
    .slice(0, MAX_EGRESS_SOURCES)
    .map((item) => ({
      sourceId: redactSensitiveContent(item.sourceId),
      title: redactSensitiveContent(item.title),
      origin: redactSensitiveContent(item.origin),
      domain: item.domain.slice(0, 8).map(redactSensitiveContent),
      language: redactSensitiveContent(item.language),
      confidence: item.confidence,
      freshnessStatus: 'CURRENT' as const,
      reviewStatus: redactSensitiveContent(item.reviewStatus),
      excerpt: redactSensitiveContent(item.excerpt).slice(0, MAX_EGRESS_CHARS_PER_SOURCE).trim(),
    }))
    .filter((item) => item.excerpt.length > 0);
}

function semanticTerms(value: string) {
  const aliases: Record<string, string[]> = {
    tacho: ['tachograph', 'tachograf', 'tahograf'], tachograph: ['tacho', 'tachograf', 'tahograf'], tachograf: ['tacho', 'tachograph', 'tahograf'], tahograf: ['tacho', 'tachograph', 'tachograf'],
    germania: ['germany', 'deutschland', 'de'], germany: ['germania', 'deutschland', 'de'], deutschland: ['germania', 'germany', 'de'],
    camion: ['truck', 'lkw', 'hgv'], truck: ['camion', 'lkw', 'hgv'], lkw: ['camion', 'truck', 'hgv'],
    taxa: ['toll', 'maut', 'vignette'], toll: ['taxa', 'maut', 'vignette'], maut: ['taxa', 'toll', 'vignette'],
    bord: ['dashboard', 'warning', 'martor'], martor: ['dashboard', 'warning', 'bord'],
  };
  const terms = normalize(value).split(/[^a-z0-9]+/).filter((term) => term.length >= 2);
  const expanded = new Set(terms);
  for (const term of terms) for (const alias of aliases[term] ?? []) expanded.add(alias);
  return expanded;
}

function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function safeHost(url: string) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
function confidence(source: CanonicalSource) { return source.authority.authorityType === 'AUTHORITATIVE' ? 0.98 : source.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE' ? 0.92 : source.authority.authorityType === 'CONTEXTUAL' ? 0.75 : 0.6; }
function inferLanguage(source: CanonicalSource) {
  const value = `${source.canonicalPath} ${source.canonicalUri ?? ''}`.toLowerCase();
  const match = value.match(/(?:^|[._/-])(ro|de|en|fr|nl|ru|pl|tr|sq|it|es|sv)(?:[._/-]|$)/);
  if (match?.[1]) return match[1];
  const jurisdiction = source.authority.jurisdictions[0]?.toLowerCase();
  return jurisdiction && jurisdiction.length === 2 ? jurisdiction : 'und';
}

export function isCurrentApprovedSource(source: CanonicalSource) {
  return isRegistryCurrent(source) && isApprovedReviewStatus(source.authority.reviewStatus);
}

function isRegistryCurrent(source: CanonicalSource) {
  return source.freshness?.currentStatus
    ? source.freshness.currentStatus === 'CURRENT'
    : source.status === 'CURRENT';
}

export function isApprovedReviewStatus(value: string) {
  const reviewStatus = value.toUpperCase();
  const approved = reviewStatus === 'APPROVED' || /(?:^|_)APPROVED(?:_|$)/.test(reviewStatus);
  const restricted = /NOT_APPROVED|NOT_AUTHORIZED|NOT_PROMOTED|PENDING|DRAFT|REVOKED|DENIED|REJECTED|SUSPENDED|EXPIRED/.test(reviewStatus);
  return approved && !restricted;
}
