import type { CanonicalSource } from '../src/canonical-authority/canonical-authority.contract';
import type { CanonicalAuthorityLoader } from '../src/canonical-authority/canonical-authority.loader';
import { CanonicalAuthorityLoader as RealCanonicalAuthorityLoader } from '../src/canonical-authority/canonical-authority.loader';
import { PremiumAssistantKnowledgeService } from '../src/premium-assistant/premium-assistant-knowledge.service';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';

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

function knowledge(sources: CanonicalSource[]) {
  const byId = new Map(sources.map((item) => [item.sourceId, item]));
  const loader = {
    sources: () => sources,
    source: (id: string) => byId.get(id),
    contains: (_domain: string, id: string) => id.includes('TACHO') || id.includes('LEGAL'),
  } as unknown as CanonicalAuthorityLoader;
  return new PremiumAssistantKnowledgeService(loader);
}

describe('Premium Assistant canonical knowledge reuse', () => {
  it('loads the real 862-entry canonical registry and reuses its tacho metadata', () => {
    const loader = new RealCanonicalAuthorityLoader(new ConfigService({ AGM_CANONICAL_LIBRARY_ROOT: resolve(__dirname, '..', '..', '..') }));
    const service = new PremiumAssistantKnowledgeService(loader);
    expect(service.stats().canonicalSources).toBe(862);
    expect(service.stats().semanticEntries).toBeGreaterThan(0);
    expect(service.resolve('tahograf Germania camion', 'ro', false, NOW).sources.some((item) => item.sourceId.includes('TACHO'))).toBe(true);
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
});
