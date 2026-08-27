import { ForbiddenException } from '@nestjs/common';
import type { RequestContext } from '../src/common/request-context';
import { PilotOperationsService } from '../src/pilot-operations/pilot-operations.service';

const context: RequestContext = {
  companyId: 'company-1',
  userId: 'owner-1',
  roles: ['OWNER', 'PREMIUM_ACCESS'],
  requestId: 'request-1',
  correlationId: 'correlation-1',
};

const activation = {
  id: 'activation-1',
  companyId: context.companyId,
  providerId: 'tomtom',
  state: 'ACTIVE',
  credentialReference: 'guardian:dpapi:live-provider-pilot:tomtom',
  allowedUserId: context.userId,
  pilotStartAt: new Date(Date.now() - 60_000),
  pilotEndAt: new Date(Date.now() + 60_000),
  dailyRequestLimit: 2,
  anomalyAlertPercent: 80,
  dailyCostAlertMicros: 5_000_000,
  estimatedUnitCostMicros: null,
  costBasis: 'REQUEST_COUNT_ONLY_PENDING_PROVIDER_BILLING',
};

describe('Controlled provider pilot guardrails', () => {
  it('PILOT-01 permits only the allowlisted owner while the lease window is active', async () => {
    const prisma = {
      providerPilotActivation: { findUnique: jest.fn().mockResolvedValue(activation) },
      providerUsageEvent: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new PilotOperationsService(prisma as never);
    await expect(service.eligibility('tomtom', context)).resolves.toMatchObject({ allowed: true, reason: 'ACTIVE', used: 0 });
    await expect(service.eligibility('tomtom', { ...context, userId: 'external-user' })).resolves.toMatchObject({ allowed: false, reason: 'PILOT_USER_SCOPE_DENIED' });
  });

  it('PILOT-02 blocks external calls at the daily request boundary', async () => {
    const prisma = {
      providerPilotActivation: { findUnique: jest.fn().mockResolvedValue(activation) },
      providerUsageEvent: { count: jest.fn().mockResolvedValue(2) },
    };
    await expect(new PilotOperationsService(prisma as never).eligibility('tomtom', context)).resolves.toMatchObject({ allowed: false, reason: 'PILOT_DAILY_REQUEST_LIMIT' });
  });

  it('PILOT-03 refuses activation without a Guardian credential reference', async () => {
    const prisma = { providerPilotActivation: { findUnique: jest.fn().mockResolvedValue({ ...activation, credentialReference: null }) } };
    await expect(new PilotOperationsService(prisma as never).setState('tomtom', 'ACTIVE', undefined, context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PILOT-04 keeps provider cost unknown until estimate or billing evidence exists', async () => {
    const occurredAt = new Date();
    const prisma = {
      providerPilotActivation: { findMany: jest.fn().mockResolvedValue([activation]) },
      providerUsageEvent: { findMany: jest.fn().mockResolvedValue([
        { providerId: 'tomtom', eventType: 'PROVIDER_REQUEST', occurredAt, latencyMs: 80, userId: context.userId, estimatedCostMicros: null, actualCostMicros: null, cacheHit: false, coalesced: false, recalculation: false, fallbackActivation: false, timeout: false, rateLimited: false, outcome: 'SUCCESS', stale: false },
        { providerId: 'tomtom', eventType: 'CACHE_HIT', occurredAt, latencyMs: null, userId: context.userId, estimatedCostMicros: null, actualCostMicros: null, cacheHit: true, coalesced: false, recalculation: false, fallbackActivation: false, timeout: false, rateLimited: false, outcome: 'HIT', stale: false },
      ]) },
      gmailPilotTelemetry: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const report = await new PilotOperationsService(prisma as never).report(context);
    expect(report.providers[0]).toMatchObject({ requestsTotal: 1, estimatedCostMicros: null, actualCostMicros: null, cacheHitRateBps: 5000, averageLatencyMs: 80 });
  });

  it('PILOT-05 does not double-count Gmail messages during analysis', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const service = new PilotOperationsService({ gmailPilotTelemetry: { upsert } } as never);
    await service.recordGmailAnalysis(context, { processed: 14, relevant: 1, created: 1, duplicates: 0, parsingErrors: 0, backlog: 0 });
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty('messagesProcessed');
  });
});
