import { TurnFunctionalOverviewService } from '../src/turn-operational-truth/turn-functional-overview.service';
import { premiumNetworkSeed } from '../src/authority-control-plane/premium-network.seed';

function delegate(counts: number[] = [], latest: unknown = null) {
  return {
    count: jest.fn().mockImplementation(() => Promise.resolve(counts.shift() ?? 0)),
    findFirst: jest.fn().mockResolvedValue(latest),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
  };
}

function fixture() {
  const observedAt = new Date('2026-09-04T12:00:00.000Z');
  const prisma = {
    communicationConversation: delegate([3, 1]),
    communicationMessage: delegate([0], { statusUpdatedAt: observedAt }),
    gmailPilotTelemetry: { findUnique: jest.fn().mockResolvedValue({ state: 'HEALTHY', backlog: 0, updatedAt: observedAt }) },
    preDepartureSession: delegate([4, 0], { updatedAt: observedAt }),
    operationalEvent: delegate([8], { occurredAt: observedAt }),
    carMoverJob: delegate([5, 2, 3], { updatedAt: observedAt }),
    carMoverPlatformOffer: delegate([0]),
    carMoverInvoice: delegate([0]),
    incidentReport: delegate([0]),
    normalizedOpportunity: delegate([2, 0]),
    opportunityVerdict: delegate([2]),
    opportunityHumanDecision: delegate([1]),
    opportunityJobLink: delegate([1]),
    opportunityAgentTelemetry: { findMany: jest.fn().mockResolvedValue([{ health: 'HEALTHY', freshnessStatus: 'FRESH', backlog: 0, lastRunAt: observedAt }]) },
    liveAdapterTelemetry: { findMany: jest.fn().mockResolvedValue([{ status: 'HEALTHY', lastAttemptAt: observedAt, lastSuccessAt: observedAt, errorCount: 0 }]) },
    agentRuntimeEvent: delegate([6, 0], { occurredAt: observedAt }),
    componentHeartbeat: { findMany: jest.fn().mockResolvedValue([{ reportedStatus: 'ONLINE', lastSeenAt: observedAt, lastFailureAt: null }]) },
    premiumNetworkRegistryEntry: { findMany: jest.fn().mockResolvedValue(premiumNetworkSeed.map((item) => ({ canonicalId: item.canonicalId }))) },
    providerUsageEvent: {
      count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0),
      findFirst: jest.fn().mockResolvedValue(null),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
  };
  const translation = { functionalHealth: jest.fn().mockResolvedValue({ status: 'available', provider: 'openai', functional: true }) };
  return { service: new TurnFunctionalOverviewService(prisma as never, translation as never), prisma };
}

describe('TurnFunctionalOverviewService', () => {
  it('separates real zero activity, static references and legitimate local UNKNOWN', async () => {
    const { service } = fixture();
    const overview = await service.snapshot(new Date('2026-09-04T12:02:00.000Z'));
    const byId = new Map(overview.zones.map((zone) => [zone.id, zone]));

    expect(byId.get('basic.translator')).toMatchObject({ status: 'OPERATIONAL', source: { kind: 'RUNTIME' } });
    expect(byId.get('basic.email')).toMatchObject({ status: 'OBSERVED', source: { kind: 'EVENT_STORE' } });
    expect(byId.get('premium.voice')).toMatchObject({ status: 'NO_ACTIVITY', legitimateUnknown: false });
    expect(byId.get('basic.ocr-workspace')).toMatchObject({ status: 'NO_ACTIVITY', legitimateUnknown: false, source: { kind: 'EVENT_STORE' }, evidence: { contentCaptured: false } });
    expect(overview.summary.capabilityMissing).toBe(0);
    expect(byId.get('basic.load-safety-knowledge')).toMatchObject({ status: 'STATIC_REFERENCE', evidence: { runtimeClaim: false } });
    expect(overview.zones.filter((zone) => zone.tier === 'BASIC')).toHaveLength(10);
    expect(overview.zones.filter((zone) => zone.tier === 'PREMIUM')).toHaveLength(13);
    expect(overview.summary.totalZones).toBe(23);
    expect(overview.summary.unresolvedUnknown).toBe(0);
    expect(overview.verdict).toMatchObject({
      turnFunctionalCompleteness: 'FAIL',
      productOwnerAcceptance: 'NOT_GRANTED',
      finalProductionPass: 'RETRACTED',
    });
  });

  it('turns real backlog and failure evidence into an actionable ATTENTION state', async () => {
    const { service, prisma } = fixture();
    prisma.communicationMessage.count.mockReset().mockResolvedValue(2);
    prisma.gmailPilotTelemetry.findUnique.mockResolvedValue({ state: 'DEGRADED', backlog: 4, updatedAt: new Date('2026-09-04T12:00:00.000Z') });

    const overview = await service.snapshot(new Date('2026-09-04T12:02:00.000Z'));
    expect(overview.zones.find((zone) => zone.id === 'basic.email')).toMatchObject({
      status: 'ATTENTION',
      evidence: { failedMessages: 2, gmailBacklog: 4 },
      action: { href: '/email' },
    });
  });

  it('fails functional completeness when a canonical identity is absent from the persistent registry', async () => {
    const { service, prisma } = fixture();
    prisma.premiumNetworkRegistryEntry.findMany.mockResolvedValue([{ canonicalId: 'agm.human.product-owner' }]);

    const overview = await service.snapshot(new Date('2026-09-04T12:02:00.000Z'));
    expect(overview.summary.capabilityMissing).toBeGreaterThan(0);
    expect(overview.verdict.turnFunctionalCompleteness).toBe('FAIL');
    expect(overview.zones.find((zone) => zone.id === 'premium.team')).toMatchObject({ status: 'ATTENTION' });
  });

  it('records Basic execution metadata without OCR content', async () => {
    const { service, prisma } = fixture();
    prisma.providerUsageEvent.create.mockResolvedValue({ id: 'event-1', occurredAt: new Date('2026-09-04T12:00:00.000Z') });
    await service.recordBasicFeature({ featureId: 'basic.tachograph', outcome: 'UNCERTAIN', durationMs: 12, confidence: 41, resultStatus: 'uncertain' }, { companyId: 'company-1', userId: 'user-1', roles: [], requestId: 'request-1', correlationId: 'correlation-1' });
    expect(prisma.providerUsageEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ adapterId: 'basic.tachograph', outcome: 'UNCERTAIN', metrics: { resultStatus: 'uncertain', confidence: 41, contentCaptured: false } }) });
    expect(JSON.stringify(prisma.providerUsageEvent.create.mock.calls[0])).not.toMatch(/ocrText|image|bodyText|raw/i);
  });
});
