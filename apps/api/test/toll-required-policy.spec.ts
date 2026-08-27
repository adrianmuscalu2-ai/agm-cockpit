import type { RequestContext } from '../src/common/request-context';
import { LiveAdapterService } from '../src/live-adapters/live-adapter.service';

const context: RequestContext = {
  companyId: 'company-1',
  userId: 'owner-1',
  roles: ['OWNER', 'PREMIUM_ACCESS'],
  requestId: 'request-1',
  correlationId: 'correlation-1',
};

describe('Conditional TollGuru boundary', () => {
  it('does not touch persistence or a provider when tollRequired is false', async () => {
    const prisma = { liveAdapterCache: { findUnique: jest.fn() } };
    const tollGuru = { adapterId: 'live.toll.tollguru', providerId: 'tollguru', category: 'TOLL', priority: 10, configured: () => true, fetch: jest.fn() };
    const pilot = { record: jest.fn().mockResolvedValue({}) };
    const service = new LiveAdapterService(
      prisma as never,
      {} as never,
      { category: 'GEOCODING' } as never,
      { category: 'GEOCODING' } as never,
      { category: 'ROUTE' } as never,
      { category: 'ROUTE' } as never,
      { category: 'TRAFFIC' } as never,
      tollGuru as never,
      { category: 'TRANSIT' } as never,
      pilot as never,
    );

    const result = await service.resolve('TOLL', {
      routeReference: 'route-without-tolls',
      origin: { latitude: 48.1, longitude: 11.5 },
      destination: { latitude: 48.2, longitude: 11.6 },
      tollRequired: false,
    }, context);

    expect(result).toMatchObject({ mode: 'SKIPPED', status: 'HEALTHY', warning: 'TOLL_NOT_REQUIRED_PROVIDER_NOT_CALLED' });
    expect(tollGuru.fetch).not.toHaveBeenCalled();
    expect(prisma.liveAdapterCache.findUnique).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(pilot.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'TOLL_CALL_SKIPPED', outcome: 'NOT_REQUIRED' }), context);
  });

  it('rejects an unreasoned toll request before provider evaluation', async () => {
    const tollGuru = { adapterId: 'live.toll.tollguru', providerId: 'tollguru', category: 'TOLL', priority: 10, configured: () => true, fetch: jest.fn() };
    const service = new LiveAdapterService(
      { liveAdapterCache: { findUnique: jest.fn() } } as never,
      {} as never,
      { category: 'GEOCODING' } as never,
      { category: 'GEOCODING' } as never,
      { category: 'ROUTE' } as never,
      { category: 'ROUTE' } as never,
      { category: 'TRAFFIC' } as never,
      tollGuru as never,
      { category: 'TRANSIT' } as never,
      { record: jest.fn().mockResolvedValue({}) } as never,
    );

    const result = await service.resolve('TOLL', {
      routeReference: 'route-missing-reason',
      origin: { latitude: 48.1, longitude: 11.5 },
      destination: { latitude: 48.2, longitude: 11.6 },
      tollRequired: true,
    }, context);

    expect(result.warning).toBe('TOLL_REASON_REQUIRED_PROVIDER_NOT_CALLED');
    expect(tollGuru.fetch).not.toHaveBeenCalled();
  });
});
