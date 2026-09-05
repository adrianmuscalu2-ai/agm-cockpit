import { AuthorityControlPlaneService, RUNTIME_CAPABILITY_REQUIREMENTS } from '../src/authority-control-plane/authority-control-plane.service';

function runtimeProvider(name: string, methods: string[], extra: Record<string, unknown> = {}) {
  const instance: Record<string, unknown> = { ...extra };
  Object.defineProperty(instance, 'constructor', { value: { name } });
  for (const method of methods) instance[method] = jest.fn();
  return instance;
}

describe('TURN runtime capability probe', () => {
  it('persists an actual provider/method/dependency observation for all 22 internal capabilities', async () => {
    const instances = [
      runtimeProvider('AuthorityControlPlaneService', ['inspectOperationalCapabilities', 'issueLease', 'handoff', 'executeRecovery']),
      runtimeProvider('OpportunityIntelligenceService', ['intake', 'analyze', 'copilot']),
      runtimeProvider('LiveAdapterService', ['resolve', 'ingestPlatformFeed']),
      runtimeProvider('CarMoverService', ['create', 'transition', 'recordFinance']),
      runtimeProvider('IncidentsService', ['create', 'resolve']),
      runtimeProvider('EvidenceService', ['create', 'get']),
      ...['GEOCODING', 'ROUTE', 'TRAFFIC', 'TOLL', 'TRANSIT'].map((category) => runtimeProvider(`${category}Provider`, [], { category, providerId: `real-${category.toLowerCase()}`, configured: () => true })),
    ];
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      company: { findMany: jest.fn().mockResolvedValue([{ id: '00000000-0000-0000-0000-000000000001' }]) },
      $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
      componentHeartbeat: { upsert },
    };
    const discovery = { getProviders: () => instances.map((instance) => ({ instance })) };
    const service = new AuthorityControlPlaneService(prisma as never, {} as never, discovery as never);

    await service.onApplicationBootstrap();
    service.onApplicationShutdown();

    expect(prisma.company.findMany).toHaveBeenCalledWith({ where: { isActive: true }, select: { id: true } });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(Object.keys(RUNTIME_CAPABILITY_REQUIREMENTS).length);
    expect(upsert.mock.calls.every(([input]) => input.create.reportedStatus === 'ONLINE' && input.create.lastDetail.includes('turn-runtime-capability-probe.v1'))).toBe(true);
  });

  it('records a missing executable provider as DEGRADED evidence instead of inferring runtime', async () => {
    const instances = [
      runtimeProvider('AuthorityControlPlaneService', ['inspectOperationalCapabilities', 'issueLease', 'handoff', 'executeRecovery']),
      runtimeProvider('OpportunityIntelligenceService', ['intake', 'analyze', 'copilot']),
      runtimeProvider('LiveAdapterService', ['resolve', 'ingestPlatformFeed']),
      runtimeProvider('CarMoverService', ['create', 'transition', 'recordFinance']),
      runtimeProvider('IncidentsService', ['create', 'resolve']),
    ];
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]), componentHeartbeat: { upsert } };
    const discovery = { getProviders: () => instances.map((instance) => ({ instance })) };
    const service = new AuthorityControlPlaneService(prisma as never, {} as never, discovery as never);

    await (service as unknown as { recordRuntimeCapabilityProbes(companyId: string): Promise<void> }).recordRuntimeCapabilityProbes('00000000-0000-0000-0000-000000000001');

    const evidenceProbe = upsert.mock.calls.map(([input]) => input).find((input) => input.create.componentId === 'premium.car-mover.evidence-service');
    expect(evidenceProbe.create.reportedStatus).toBe('DEGRADED');
    expect(evidenceProbe.create.lastFailureReason).toBe('RUNTIME_PROVIDER_NOT_LOADED:EvidenceService');
  });
});
