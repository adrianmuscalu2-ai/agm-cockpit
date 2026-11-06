import { OperationalEventSemanticSearchService, rankSemanticCandidates, SEMANTIC_SCAN_LIMIT } from '../src/operational-event-store/operational-event-semantic-search.service';

const at = new Date('2026-11-06T10:00:00Z');
const candidates = [
  { eventId: 'e1', streamId: 's1', eventType: 'trip.delay_reported', aggregateVersion: 3, recordedAt: at, payload: { note: 'Camion ratat la vama, intarziere 2h' } },
  { eventId: 'e2', streamId: 's2', eventType: 'trip.toll_paid', aggregateVersion: 1, recordedAt: at, payload: { note: 'taxa rovinieta achitata' } },
  { eventId: 'e3', streamId: 's3', eventType: 'trip.started', aggregateVersion: 0, recordedAt: at, payload: {} },
];

describe('operational event semantic search', () => {
  it('ranks by concept, not only by shared words, and cites the source event', () => {
    const hits = rankSemanticCandidates(candidates, 'asteptare camion la vama', 10);
    expect(hits[0]?.eventId).toBe('e1');
    expect(hits[0]?.source).toBe('operational-event:s1@3');
    expect(hits[0]?.matchedConcepts.length).toBeGreaterThan(0);
    expect(hits.find((hit) => hit.eventId === 'e2')).toBeUndefined();
  });

  it('returns nothing for an unrelated query', () => {
    expect(rankSemanticCandidates(candidates, 'zzqx', 10)).toEqual([]);
  });

  it('scopes the database read to the caller company and reports coverage', async () => {
    const findMany = jest.fn().mockResolvedValue([{ eventId: 'e1', eventType: 'trip.delay_reported', aggregateVersion: 3, recordedAt: at, payload: { note: 'intarziere camion' }, stream: { streamId: 's1' } }]);
    const count = jest.fn().mockResolvedValue(5000);
    const service = new OperationalEventSemanticSearchService({ operationalEvent: { findMany, count } } as never);
    const result = await service.search('intarziere', 5, { companyId: 'company-a' } as never);
    expect(findMany.mock.calls[0][0].where).toEqual({ companyId: 'company-a' });
    expect(count.mock.calls[0][0].where).toEqual({ companyId: 'company-a' });
    expect(findMany.mock.calls[0][0].take).toBe(SEMANTIC_SCAN_LIMIT);
    expect(result.coverage).toEqual({ total: 5000, scanned: 1, complete: false });
    expect(result.hits).toHaveLength(1);
  });
});
