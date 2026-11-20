import { explicitRelatedEvents } from '../src/agmatcc-copilot/evidence-relations';
import { rankSemanticCandidates } from '../src/operational-event-store/operational-event-semantic-search.service';

describe('operational evidence relationships', () => {
  it('links explicit shared references without collapsing separate journal events', () => {
    const rows = [
      { eventId: 'incident-0001', payload: { mandateId: 'mandate-0001', detail: 'voice fault' } },
      { eventId: 'version-00002', payload: { mandateId: 'mandate-0001', revision: '90632af730bf' } },
      { eventId: 'unrelated-003', payload: { detail: 'voice fault at the same time' } },
    ];
    expect(explicitRelatedEvents(rows, ['incident-0001'], 4)).toEqual([{ row: rows[1], relations: [{ eventId: 'incident-0001', explicitReference: 'mandate-0001' }] }]);
    expect(rows).toHaveLength(3);
  });
  it('recovers a telemetry paraphrase through shared concepts, without the incident name', () => {
    const rows = [
      { eventId: 'technical-alpha-001', streamId: 'telemetry', eventType: 'health.failure', aggregateVersion: 1, recordedAt: new Date(), payload: { detail: 'heartbeat monitoring failure' } },
      { eventId: 'unrelated-002', streamId: 'finance', eventType: 'invoice', aggregateVersion: 1, recordedAt: new Date(), payload: { detail: 'invoice payment completed' } },
    ];
    const hits = rankSemanticCandidates(rows, 'telemetrie monitorizare problema', 2);
    expect(hits[0]?.eventId).toBe('technical-alpha-001');
    expect(hits[0]?.matchedConcepts).toContain('telemetry');
  });
});
