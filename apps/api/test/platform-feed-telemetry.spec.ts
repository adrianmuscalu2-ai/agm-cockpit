import type { RequestContext } from '../src/common/request-context';
import { LiveAdapterService } from '../src/live-adapters/live-adapter.service';
import { hash } from '../src/opportunity-intelligence/opportunity-intelligence.engine';

const context: RequestContext = {
  companyId: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  roles: ['OWNER', 'PREMIUM_ACCESS'],
  requestId: 'request-1',
  correlationId: 'correlation-1',
};

function serviceFixture() {
  const prisma = {
    liveMobilitySnapshot: { create: jest.fn().mockResolvedValue({ id: 'snapshot-1' }) },
    liveAdapterTelemetry: { upsert: jest.fn().mockResolvedValue({}) },
    agentRuntimeEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const opportunities = { intake: jest.fn().mockResolvedValue({ normalizedOpportunityId: 'opportunity-1' }) };
  const inertProvider = { category: 'GEOCODING', providerId: 'unused', configured: () => false };
  const service = new LiveAdapterService(
    prisma as never,
    opportunities as never,
    inertProvider as never,
    inertProvider as never,
    inertProvider as never,
    inertProvider as never,
    inertProvider as never,
    inertProvider as never,
    inertProvider as never,
  );
  return { prisma, opportunities, service };
}

function feed() {
  const normalizedFields = { pickupLocation: 'Berlin', deliveryLocation: 'Paris', priceAmount: 900, currencyCode: 'EUR' };
  return {
    sourcePlatform: 'real-platform',
    sourceOpportunityId: 'source-1',
    rawReference: 'platform://source-1',
    normalizedFields,
    sourceTimestamp: '2026-09-05T08:00:00.000Z',
    validUntil: '2099-09-05T09:00:00.000Z',
    confidence: 90,
    dedupFingerprint: hash({ platform: 'real-platform', id: 'source-1', fields: normalizedFields }),
  };
}

describe('Platform feed operational telemetry', () => {
  it('records a real successful ingestion observation', async () => {
    const { prisma, opportunities, service } = serviceFixture();

    await expect(service.ingestPlatformFeed(feed(), context)).resolves.toMatchObject({ snapshotId: 'snapshot-1' });

    expect(opportunities.intake).toHaveBeenCalledTimes(1);
    expect(prisma.liveAdapterTelemetry.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ category: 'PLATFORM_FEED', providerId: 'real-platform', status: 'HEALTHY', requestCount: 1, errorCount: 0 }),
      update: expect.objectContaining({ providerId: 'real-platform', status: 'HEALTHY' }),
    }));
    expect(prisma.agentRuntimeEvent.create.mock.calls.map(([input]) => input.data.lifecycle)).toEqual(['STARTED', 'COMPLETED']);
    expect(prisma.agentRuntimeEvent.create.mock.calls.every(([input]) => input.data.agentId === 'premium.adapters.platform-feed')).toBe(true);
  });

  it('records the exact real ingestion failure instead of leaving UNKNOWN telemetry', async () => {
    const { prisma, opportunities, service } = serviceFixture();
    const invalid = { ...feed(), dedupFingerprint: 'invalid' };

    await expect(service.ingestPlatformFeed(invalid, context)).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });

    expect(opportunities.intake).not.toHaveBeenCalled();
    expect(prisma.liveAdapterTelemetry.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ category: 'PLATFORM_FEED', status: 'UNAVAILABLE', lastErrorCode: 'MALFORMED_RESPONSE' }),
      update: expect.objectContaining({ status: 'UNAVAILABLE', lastErrorCode: 'MALFORMED_RESPONSE' }),
    }));
    expect(prisma.agentRuntimeEvent.create.mock.calls.map(([input]) => input.data.lifecycle)).toEqual(['STARTED', 'FAILED']);
  });
});
