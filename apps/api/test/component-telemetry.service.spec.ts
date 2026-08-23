import { BadRequestException } from '@nestjs/common';
import { ComponentTelemetryService } from '../src/component-telemetry/component-telemetry.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const ctx = { companyId: '11111111-1111-1111-1111-111111111111', userId: '22222222-2222-2222-2222-222222222222', roles: ['company_owner'], requestId: 'request', correlationId: 'correlation' };

describe('ComponentTelemetryService', () => {
  it('classifies current, degraded, stale, and missing heartbeats without fabricating health', () => {
    const service = new ComponentTelemetryService({} as PrismaService);
    const checkedAt = new Date('2026-08-23T12:02:00.000Z');
    const current = service.snapshotFrom({
      componentId: 'android', reportedStatus: 'ONLINE', lastSeenAt: new Date('2026-08-23T12:01:30.000Z'),
      lastSuccessAt: new Date('2026-08-23T12:01:30.000Z'), lastFailureAt: null, lastFailureReason: null, lastDetail: 'foreground',
    }, checkedAt);
    expect(current.status).toBe('ONLINE');
    expect(current.freshness).toBe('LIVE');

    const degraded = service.snapshotFrom({
      componentId: 'android', reportedStatus: 'DEGRADED', lastSeenAt: new Date('2026-08-23T12:01:30.000Z'),
      lastSuccessAt: null, lastFailureAt: new Date('2026-08-23T12:01:30.000Z'), lastFailureReason: 'CLIENT_CHECK_FAILED', lastDetail: null,
    }, checkedAt);
    expect(degraded.status).toBe('DEGRADED');
    expect(degraded.reason).toBe('CLIENT_CHECK_FAILED');
    expect(degraded.lastFailureReason).toBe('CLIENT_CHECK_FAILED');

    const stale = service.snapshotFrom({
      componentId: 'android', reportedStatus: 'ONLINE', lastSeenAt: new Date('2026-08-23T12:00:00.000Z'),
      lastSuccessAt: new Date('2026-08-23T12:00:00.000Z'), lastFailureAt: null, lastFailureReason: null, lastDetail: null,
    }, checkedAt);
    expect(stale.status).toBe('OFFLINE');
    expect(stale.reason).toBe('HEARTBEAT_STALE');

    expect(service.snapshotFrom(null, checkedAt, 'android').status).toBe('UNKNOWN');
  });

  it('persists tenant-bound Android heartbeat and rejects unsupported components', async () => {
    const upsert = jest.fn(async (input) => ({
      componentId: input.create.componentId,
      reportedStatus: input.create.reportedStatus,
      lastSeenAt: input.create.lastSeenAt,
      lastSuccessAt: input.create.lastSuccessAt,
      lastFailureAt: input.create.lastFailureAt,
      lastFailureReason: input.create.lastFailureReason,
      lastDetail: input.create.lastDetail,
    }));
    const service = new ComponentTelemetryService({ componentHeartbeat: { upsert } } as unknown as PrismaService);
    const result = await service.heartbeat('android', { status: 'ONLINE', reason: 'HEARTBEAT_RECEIVED' }, ctx);
    expect(result.status).toBe('ONLINE');
    expect(upsert.mock.calls[0][0].where.companyId_componentId).toEqual({ companyId: ctx.companyId, componentId: 'android' });
    await expect(service.health('unregistered-component', ctx)).rejects.toBeInstanceOf(BadRequestException);
  });
});
