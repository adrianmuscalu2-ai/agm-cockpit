import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  aggregateChain,
  assessCost,
  assessRoute,
  judgeChain,
  normalizeOpportunity,
  opportunityCopilotProjection,
} from '../src/opportunity-intelligence/opportunity-intelligence.engine';

const now = new Date('2026-08-24T12:00:00.000Z');
const baseRaw = {
  platform: 'TIMOCOM', sourceOpportunityId: 'O-100', pickupLocation: 'Berlin', deliveryLocation: 'Hamburg',
  pickupWindowStart: '2026-08-24T13:00:00.000Z', priceAmount: 500, currencyCode: 'eur', declaredKm: 290,
  vehicleType: 'Passenger car', sourceTimestamp: '2026-08-24T11:45:00.000Z',
};

function segment(id: string, revenue = 500, cost = 100, routeOverrides: Partial<Parameters<typeof assessRoute>[0]> = {}) {
  const route = assessRoute({ distanceKm: 200, durationMinutes: 180, distanceToPickupKm: 20, sources: ['test-map:v1'], confidence: 90, ...routeOverrides });
  const normalized = normalizeOpportunity({ ...baseRaw, sourceOpportunityId: id, priceAmount: revenue }, now);
  return { opportunityId: id, route, cost: assessCost(normalized, route, { fuel: cost, assumptions: ['TEST_ESTIMATE'] }) };
}

describe('Opportunity Intelligence mandatory core scenarios', () => {
  it('OI-01 normalizes a unique offer correctly', () => {
    const value = normalizeOpportunity(baseRaw, now);
    expect(value).toMatchObject({ platform: 'TIMOCOM', sourceOpportunityId: 'O-100', currencyCode: 'EUR', declaredKm: 290, freshnessStatus: 'FRESH' });
    expect(value.pickupLocation.label).toBe('Berlin');
  });

  it('OI-02 gives duplicate deliveries the same deterministic identity', () => {
    const first = normalizeOpportunity(baseRaw, now); const second = normalizeOpportunity(baseRaw, now);
    expect(second.inputHash).toBe(first.inputHash); expect(second.correlationKey).toBe(first.correlationKey);
  });

  it('OI-03 correlates the same commercial offer across two channels/source IDs', () => {
    const email = normalizeOpportunity(baseRaw, now);
    const whatsapp = normalizeOpportunity({ ...baseRaw, sourceOpportunityId: 'WA-OTHER-ID' }, now);
    expect(whatsapp.correlationKey).toBe(email.correlationKey);
  });

  it('OI-04 marks unknown information explicitly without invention', () => {
    const value = normalizeOpportunity({ sourceTimestamp: baseRaw.sourceTimestamp }, now);
    expect(value.sourceOpportunityId).toBe('UNKNOWN');
    expect(value.pickupLocation).toEqual({ label: 'NEEDS_CONFIRMATION', state: 'NEEDS_CONFIRMATION' });
    expect(value.vehicle.vin).toBe('UNKNOWN');
  });

  it('OI-05 never presents a stale offer verdict as fresh', () => {
    const old = normalizeOpportunity({ ...baseRaw, sourceTimestamp: '2026-08-24T08:00:00.000Z' }, now);
    const verdict = judgeChain(aggregateChain([segment('A')]), old.freshnessStatus);
    expect(verdict.freshnessStatus).toBe('STALE'); expect(verdict.risks).toContain('STALE_RECALCULATION_REQUIRED');
  });

  it('OI-06 analyzes one opportunity', () => {
    expect(aggregateChain([segment('A')]).opportunityIds).toEqual(['A']);
  });

  it('OI-07 analyzes a two-opportunity chain', () => {
    expect(aggregateChain([segment('A'), segment('B')]).opportunityIds).toHaveLength(2);
  });

  it('OI-08 analyzes a maximum three-opportunity chain', () => {
    expect(aggregateChain([segment('A'), segment('B'), segment('C')]).opportunityIds).toHaveLength(3);
    expect(() => aggregateChain([segment('A'), segment('B'), segment('C'), segment('D')])).toThrow('OPPORTUNITY_CHAIN_LENGTH_INVALID');
  });

  it('OI-09 rejects a temporally impossible chain', () => {
    const impossible = segment('B', 500, 100, { repositionMinutes: 120, availableGapMinutes: 30 });
    expect(judgeChain(aggregateChain([segment('A'), impossible]), 'FRESH').classification).toBe('REJECT');
  });

  it('OI-10 can retain a weak individual opportunity inside a strong chain', () => {
    const weak = segment('A', 100, 70, { distanceKm: 100, durationMinutes: 240, repositionKm: 50, repositionMinutes: 60 });
    const strong = segment('B', 500, 50, { distanceKm: 100, durationMinutes: 120, repositionKm: 0, repositionMinutes: 0 });
    expect(judgeChain(aggregateChain([weak]), 'FRESH').classification).toBe('WEAK');
    expect(judgeChain(aggregateChain([weak, strong]), 'FRESH').classification).toBe('RECOMMENDED');
  });

  it('OI-11 calculates and compares estimated profit per kilometre', () => {
    const low = aggregateChain([segment('A', 300, 200)]); const high = aggregateChain([segment('B', 500, 100)]);
    expect(high.metrics.estimatedProfitPerKm).toBeGreaterThan(low.metrics.estimatedProfitPerKm);
  });

  it('OI-12 calculates and compares estimated profit per hour', () => {
    const slow = aggregateChain([segment('A', 400, 100, { durationMinutes: 360 })]);
    const fast = aggregateChain([segment('B', 400, 100, { durationMinutes: 120 })]);
    expect(fast.metrics.estimatedProfitPerHour).toBeGreaterThan(slow.metrics.estimatedProfitPerHour);
  });

  it('OI-13 includes empty/repositioning kilometres', () => {
    expect(aggregateChain([segment('A', 500, 100, { repositionKm: 47 })]).metrics.emptyKm).toBe(47);
  });

  it('OI-14 preserves rail repositioning and its estimated cost', () => {
    const route = assessRoute({ distanceKm: 200, durationMinutes: 180, distanceToPickupKm: 20, mobilityModes: ['TRAIN', 'ROAD'], sources: ['rail:v1'], confidence: 80 });
    const cost = assessCost(normalizeOpportunity(baseRaw, now), route, { train: 42 });
    expect(route.mobilityModes).toContain('TRAIN'); expect(cost.estimatedTrain).toBe(42);
  });

  it('OI-15 has no Cost & Risk write path into real accounting', () => {
    const source = readFileSync(join(process.cwd(), 'src/opportunity-intelligence/opportunity-intelligence.service.ts'), 'utf8');
    expect(source).not.toMatch(/carMoverFinancialEntry\.(create|update|upsert)/);
    expect(source).not.toMatch(/carMoverInvoice\.(create|update|upsert)/);
  });

  it('OI-17 Judge analysis cannot create a Job', () => {
    const source = readFileSync(join(process.cwd(), 'src/opportunity-intelligence/opportunity-intelligence.service.ts'), 'utf8');
    const analyzeBody = source.slice(source.indexOf('async analyze('), source.indexOf('async planning('));
    expect(analyzeBody).not.toContain('this.carMover.create');
  });

  it('OI-18 Copilot is explanatory and cannot accept a Job', () => {
    const projection = opportunityCopilotProjection([{ classification: 'RECOMMENDED', freshnessStatus: 'FRESH', chain: { metrics: { estimatedGrossProfit: 286, emptyKm: 31, finalHomeDistanceKm: 42 }, opportunityIds: ['A'] } }]);
    expect(projection.canAcceptAutomatically).toBe(false);
  });
});
