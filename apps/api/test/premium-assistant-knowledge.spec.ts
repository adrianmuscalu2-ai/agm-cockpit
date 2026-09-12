import type { CanonicalSource } from '../src/canonical-authority/canonical-authority.contract';
import type { CanonicalAuthorityLoader } from '../src/canonical-authority/canonical-authority.loader';
import { CanonicalAuthorityLoader as RealCanonicalAuthorityLoader } from '../src/canonical-authority/canonical-authority.loader';
import {
  isApprovedReviewStatus,
  MAX_EGRESS_CHARS_PER_SOURCE,
  MAX_EGRESS_SOURCES,
  prepareKnowledgeEgress,
  PremiumAssistantKnowledgeService,
  redactSensitiveContent,
} from '../src/premium-assistant/premium-assistant-knowledge.service';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const NOW = new Date('2026-09-12T12:00:00.000Z');

function source(id: string, overrides: Partial<CanonicalSource> = {}): CanonicalSource {
  return {
    sourceId: id,
    canonicalPath: `AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/${id}.v1.md`,
    canonicalUri: null,
    sha256: `sha-${id}`,
    sourceDate: '2026-09-10',
    effectiveDate: '2026-09-10',
    version: 'v1',
    status: 'CURRENT',
    authority: {
      issuingBody: 'AGM Library',
      authorityType: 'AUTHORITATIVE',
      jurisdictions: ['de'],
      reviewStatus: 'APPROVED',
      humanReviewRequired: false,
    },
    provenance: { capturedBy: 'test' },
    evidenceRefs: [],
    supersedes: [],
    supersededBy: [],
    freshness: {
      capturedAt: '2026-09-10T00:00:00.000Z',
      lastFreshnessCheck: '2026-09-10T00:00:00.000Z',
      nextFreshnessCheck: '2026-10-10T00:00:00.000Z',
      currentStatus: 'CURRENT',
    },
    ...overrides,
  };
}

function knowledge(sources: CanonicalSource[], workspaceRoot?: string) {
  const byId = new Map(sources.map((item) => [item.sourceId, item]));
  const loader = {
    workspaceRoot,
    sources: () => sources,
    source: (id: string) => byId.get(id),
    contains: (_domain: string, id: string) => id.includes('TACHO') || id.includes('LEGAL'),
    absolutePath: (path: string) => resolve(workspaceRoot ?? '', path),
  } as unknown as CanonicalAuthorityLoader;
  return new PremiumAssistantKnowledgeService(loader);
}

describe('Premium Assistant canonical knowledge reuse', () => {
  it('loads the real registry and indexes only the two approved sources confirmed by controlled refresh', () => {
    const loader = new RealCanonicalAuthorityLoader(new ConfigService({ AGM_CANONICAL_LIBRARY_ROOT: resolve(__dirname, '..', '..', '..') }));
    const service = new PremiumAssistantKnowledgeService(loader);
    expect(service.stats().canonicalSources).toBe(862);
    expect(service.stats().semanticEntries).toBe(2);
    const result = service.resolve('toll camion Germania Toll Collect', 'ro', false, NOW);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.context.length).toBeGreaterThan(0);
    expect(result.context.every((item) => item.freshnessStatus === 'CURRENT')).toBe(true);
    expect(result.sources.every((item) => isApprovedReviewStatus(item.provenance.reviewStatus))).toBe(true);
  });

  it('serves a current AGM Library match without redundant live search', () => {
    const service = knowledge([source('CS-AGM-TACHO-CHANGE-MAP-V1')]);
    const result = service.resolve('Ce trebuie să știu despre tahograf pentru camion în Germania?', 'ro', false, NOW);
    expect(result.requiresLiveSearch).toBe(false);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      sourceId: 'CS-AGM-TACHO-CHANGE-MAP-V1',
      originType: 'DOCUMENT_LIBRARY',
      retrievalType: 'LIBRARY',
      freshness: { status: 'CURRENT' },
      confidence: 0.98,
    });
  });

  it('extracts only a relevant, redacted, bounded fragment from an approved current AGM text source', () => {
    const root = mkdtempSync(join(tmpdir(), 'agm-knowledge-'));
    try {
      const item = source('CS-AGM-TACHO-CONTENT', { canonicalPath: 'AGM_LIBRARY/TEST/CS-AGM-TACHO-CONTENT.html' });
      const target = resolve(root, item.canonicalPath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, '<html><script>api_key=sk-script_12345678901234567890</script><body>Tahograf Germania: verifică timpii de conducere. Contact driver@example.com sau +49 151 23456789. Alte informații generale.</body></html>');
      const result = knowledge([item], root).resolve('Ce verific la tahograf în Germania?', 'ro', false, NOW);
      expect(result.context).toHaveLength(1);
      expect(result.context[0]?.excerpt).toContain('Tahograf Germania');
      expect(result.context[0]?.excerpt.length).toBeLessThanOrEqual(MAX_EGRESS_CHARS_PER_SOURCE);
      expect(result.context[0]?.excerpt).toContain('[REDACTED_EMAIL]');
      expect(result.context[0]?.excerpt).toContain('[REDACTED_PHONE]');
      expect(result.context[0]?.excerpt).not.toContain('sk-script_');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires a live source for intrinsically live questions', () => {
    const service = knowledge([source('CS-AGM-WEATHER-GUIDE')]);
    expect(service.resolve('Care este vremea acum?', 'ro', false, NOW).requiresLiveSearch).toBe(true);
  });

  it('returns at most six deduplicated sources even when 5+ sources match', () => {
    const items = Array.from({ length: 8 }, (_, index) => source(`CS-LEGAL-TRANSPORT-${index + 1}`));
    items.push(source('CS-LEGAL-TRANSPORT-DUPLICATE', { sha256: items[0].sha256 }));
    const result = knowledge(items).resolve('transport legal', 'ro', false, NOW);
    expect(result.sources).toHaveLength(6);
    expect(new Set(result.sources.map((item) => item.urlOrIdentifier)).size).toBe(6);
  });

  it('serves a repeated answer from cache and expires it at the explicit library TTL', () => {
    const service = knowledge([source('CS-AGM-TACHO-CACHE')]);
    const resolved = service.resolve('tahograf', 'ro', false, NOW);
    const key = service.cacheKey({ companyId: 'tenant-1', moduleId: 'cockpit', language: 'ro', question: 'Tahograf', contextRefs: [] });
    service.storeAnswer(key, { text: 'Răspuns validat.', kind: 'answer', sources: resolved.sources }, NOW);
    expect(service.cachedAnswer(key, new Date(NOW.getTime() + 1_000))?.sources[0]?.retrievalType).toBe('CACHE');
    expect(service.cachedAnswer(key, new Date(NOW.getTime() + 15 * 60_000 + 1))).toBeNull();
  });

  it('keeps source traces inside the authenticated tenant boundary', () => {
    const service = knowledge([source('CS-AGM-TACHO-TRACE')]);
    const resolved = service.resolve('tahograf', 'ro', false, NOW);
    const trace = service.createTrace(resolved.sources, 'LIBRARY_ONLY', 'tenant-1', NOW);
    expect(service.trace(trace.traceId, 'tenant-1', NOW).traceId).toBe(trace.traceId);
    expect(() => service.trace(trace.traceId, 'tenant-2', NOW)).toThrow('Assistant source trace expired or unavailable.');
  });

  it('invalidates dependent cache entries and supports controlled refresh', () => {
    const item = source('CS-AGM-TACHO-REFRESH');
    const service = knowledge([item]);
    const resolved = service.resolve('tahograf', 'ro', false, NOW);
    const key = service.cacheKey({ companyId: 'tenant-1', moduleId: 'cockpit', language: 'ro', question: 'tahograf', contextRefs: [] });
    service.storeAnswer(key, { text: 'Cached', kind: 'answer', sources: resolved.sources }, NOW);
    expect(service.invalidate(item.sourceId, 'new-version-detected', NOW).status).toBe('INVALIDATED');
    expect(service.cachedAnswer(key, NOW)).toBeNull();
    expect(service.resolve('tahograf', 'ro', false, NOW).sources).toHaveLength(0);
    expect(service.refresh(item.sourceId, NOW).status).toBe('CURRENT');
    expect(service.resolve('tahograf', 'ro', false, NOW).sources).toHaveLength(1);
  });

  it('marks an expired canonical match for refresh/live verification', () => {
    const expired = source('CS-AGM-TACHO-EXPIRED', { freshness: {
      capturedAt: '2025-01-01T00:00:00.000Z',
      lastFreshnessCheck: '2025-01-01T00:00:00.000Z',
      nextFreshnessCheck: '2025-02-01T00:00:00.000Z',
      currentStatus: 'CURRENT',
    } });
    const result = knowledge([expired]).resolve('tahograf', 'ro', false, NOW);
    expect(result.sources[0]?.freshness.status).toBe('EXPIRED');
    expect(result.requiresLiveSearch).toBe(true);
  });

  it('rejects approval states that are pending, not authorized, not promoted, draft, or explicitly unapproved', () => {
    expect(isApprovedReviewStatus('APPROVED')).toBe(true);
    expect(isApprovedReviewStatus('PRODUCT_OWNER_APPROVED_2026_08_30_WITH_EXACT_SCOPE')).toBe(true);
    expect(isApprovedReviewStatus('HUMAN_APPROVED_INTEGRITY_VERIFIED_PENDING_REGISTRY_APPLY_AUTHORIZATION')).toBe(false);
    expect(isApprovedReviewStatus('PRODUCT_OWNER_APPROVED_WITH_EXACT_SCOPE_ATOMIC_APPLY_NOT_AUTHORIZED')).toBe(false);
    expect(isApprovedReviewStatus('PRODUCT_OWNER_APPROVED_WITH_EXACT_SCOPE_PRE_APPLY_NOT_PROMOTED')).toBe(false);
    expect(isApprovedReviewStatus('DRAFT_NOT_APPROVED')).toBe(false);
    expect(isApprovedReviewStatus('APPROVED_THEN_REVOKED')).toBe(false);
    expect(isApprovedReviewStatus('APPROVED_BUT_SUSPENDED')).toBe(false);
  });

  it('does not let legacy status CURRENT override a blocking freshness state', () => {
    const blocked = source('CS-APPROVED-BUT-CHANGED', {
      status: 'CURRENT',
      freshness: {
        capturedAt: '2026-09-10T00:00:00.000Z',
        lastFreshnessCheck: '2026-09-12T00:00:00.000Z',
        nextFreshnessCheck: '2026-09-19T00:00:00.000Z',
        currentStatus: 'NEW_VERSION_DETECTED',
        reviewRequired: true,
      },
    });
    expect(knowledge([blocked]).stats().semanticEntries).toBe(0);
  });

  it('redacts structured secrets and personal data before egress', () => {
    const redacted = redactSensitiveContent('Email driver@example.com phone +49 151 23456789 api_key=sk-test_12345678901234567890 IP 192.168.1.10');
    expect(redacted).toContain('[REDACTED_EMAIL]');
    expect(redacted).toContain('[REDACTED_PHONE]');
    expect(redacted).toContain('[REDACTED_SECRET]');
    expect(redacted).toContain('[REDACTED_IP]');
    expect(redacted).not.toContain('driver@example.com');
    expect(redacted).not.toContain('23456789');
  });

  it('enforces CURRENT/APPROVED, six sources, 900 characters and redaction again at the provider boundary', () => {
    const approved = Array.from({ length: 8 }, (_, index) => ({
      sourceId: 'source-' + index,
      title: 'Contact driver' + index + '@example.com',
      origin: 'AGM',
      domain: ['ROUTING_TOLL'],
      language: 'ro',
      confidence: 0.98,
      freshnessStatus: 'CURRENT',
      reviewStatus: 'APPROVED',
      excerpt: 'api_key=sk-test_12345678901234567890 ' + 'informație '.repeat(150),
    }));
    const rejected = [
      { ...approved[0]!, sourceId: 'expired', freshnessStatus: 'EXPIRED' },
      { ...approved[0]!, sourceId: 'pending', reviewStatus: 'HUMAN_APPROVED_PENDING' },
    ];
    const result = prepareKnowledgeEgress([...approved, ...rejected]);
    expect(result).toHaveLength(MAX_EGRESS_SOURCES);
    expect(result.every((item) => item.excerpt.length <= MAX_EGRESS_CHARS_PER_SOURCE)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('driver0@example.com');
    expect(JSON.stringify(result)).not.toContain('sk-test_');
    expect(result.some((item) => item.sourceId === 'expired' || item.sourceId === 'pending')).toBe(false);
  });
});
