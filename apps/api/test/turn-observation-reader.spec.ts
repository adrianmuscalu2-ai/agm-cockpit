import { TurnObservationReader, safeObservation } from '../src/agmatcc-copilot/turn-observation-reader';
import { UnauthorizedException } from '@nestjs/common';
import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';
import { OPERATIONAL_EVENT_RIGHTS } from '../src/operational-event-store/operational-event-access';
import { premiumNetworkSeed } from '../src/authority-control-plane/premium-network.seed';

const user = { userId: 'turn-admin-session', companyId: OPERATIONAL_EVENT_RIGHTS.turnAdminCompanyId, roles: ['TURN_ADMIN_SESSION'], requestId: 'test', correlationId: 'test' };

describe('TURN observation boundary', () => {
  it('rechecks the real session and rejects other tenants/roles before reading', async () => {
    const verify = jest.fn().mockRejectedValue(new UnauthorizedException('expired'));
    const dashboard = jest.fn();
    const reader = new TurnObservationReader({ requireOperationalAccess: verify } as never, { dashboard } as never, {} as never);
    expect((await reader.read('agents', '', user, 'Bearer synthetic'))[0].content).toContain('NOT_AUTHORIZED');
    expect(verify).toHaveBeenCalledWith('Bearer synthetic');
    await reader.read('agents', '', { ...user, companyId: 'other' }, 'Bearer synthetic');
    await reader.read('agents', '', { ...user, roles: ['PRODUCT_OWNER'] }, 'Bearer synthetic');
    expect(verify).toHaveBeenCalledTimes(1);
    expect(dashboard).not.toHaveBeenCalled();
  });

  it('distinguishes failed reads, absent records and unconnected sources', async () => {
    const dashboard = jest.fn().mockRejectedValue(new Error('database unavailable'));
    const reader = new TurnObservationReader({ requireOperationalAccess: jest.fn() } as never, { dashboard } as never, {} as never);
    expect((await reader.read('incidents', '', user))[0].content).toContain('UNAVAILABLE');
    dashboard.mockResolvedValue({ incidents: [], generatedAt: '2026-11-20', incidentPipeline: {} });
    expect((await reader.read('incidents', '', user))[0].content).toContain('NO_DATA');
    expect((await reader.read('arbitrary-private-table', '', user))[0].content).toContain('NOT_CONNECTED');
    expect(dashboard).toHaveBeenLastCalledWith(user, true);
  });

  it('excludes unrelated incidents for AGMaTCC and omits reconciliation counters', async () => {
    const dashboard = jest.fn().mockResolvedValue({ incidents: [{ canonicalId: 'chief-monitoring-inspector', rootCause: 'RUNTIME_FAILURE' }], generatedAt: '2026-11-20', incidentPipeline: { open: 0, opened: 0, resolved: 0, qualified: 0 } });
    const reader = new TurnObservationReader({ requireOperationalAccess: jest.fn() } as never, { dashboard } as never, {} as never);
    const result = await reader.read('incidents', 'AGMaTCC incidents', user);
    const summary = JSON.parse(result[0].content);
    expect(result).toHaveLength(1);
    expect(summary.state).toBe('NO_DATA');
    expect(summary.summary.requestedComponent).toBe('AGMaTCC');
    expect(summary.summary.totalUnfilteredRecords).toBe(1);
    for (const key of ['open', 'opened', 'resolved']) expect(summary.summary.pipeline).not.toHaveProperty(key);
    expect(JSON.stringify(result)).not.toContain('chief-monitoring-inspector');
    expect((await reader.read('incidents', 'all incidents', user))).toHaveLength(2);
    dashboard.mockResolvedValue({ incidents: [{ canonicalId: 'agmatcc', rootCause: 'speech capture' }], incidentPipeline: {} });
    expect((await reader.read('incidents', 'AGMaTCC', user))).toHaveLength(2);
  });

  it('scopes adapter restrictions without asserting human account permissions', async () => {
    const reader = new TurnObservationReader({ requireOperationalAccess: jest.fn() } as never, {} as never, {} as never);
    const result = JSON.parse((await reader.read('connections', '', user))[0].content);
    expect(result.accessScope).toBe('COPILOT_TURN_SESSION_ONLY');
    expect(result.humanAccountPermissions).toContain('NOT_INSPECTED');
    expect(result.restricted.acpm).toContain('NOT_AUTHORIZED');
  });

  it('redacts secret fields before serialization and preserves observation timestamps', () => {
    const serialized = JSON.stringify(safeObservation({ recordedAt: new Date('2026-11-20T00:00:00Z'), credential: 'SYNTHETIC_SECRET', detail: 'Bearer SYNTHETIC_TOKEN', status: 'STALE' }));
    expect(serialized).not.toContain('SYNTHETIC');
    expect(serialized).toContain('2026-11-20T00:00:00.000Z');
    expect(serialized).toContain('STALE');
  });

  it('executes actual dashboard/accountability projections without any Prisma write or provider probe', async () => {
    const forbidden = jest.fn((name: string) => { throw new Error(`Unexpected mutation/probe: ${name}`); });
    const prisma = new Proxy({}, { get: (_target, model: string) => new Proxy({}, { get: (_row, operation: string) => {
      if (operation === 'findMany') return async () => model === 'premiumNetworkRegistryEntry' ? premiumNetworkSeed.map(row => ({ ...row, lifecycleStatus: 'ACTIVE' })) : [];
      if (operation === 'findFirst' || operation === 'findUnique') return async () => null;
      if (operation === 'count') return async () => 0;
      return () => forbidden(`${model}.${operation}`);
    } }) });
    const authority = new AuthorityControlPlaneService(prisma as never, { snapshot: () => ({ overallStatus: 'CONFIGURED', checkedAt: new Date().toISOString(), secrets: [] }) } as never,
      { getProviders: () => forbidden('provider discovery') } as never, {} as never);
    const dashboard = await authority.dashboard(user, true);
    expect(dashboard.nodes.length).toBeGreaterThan(0);
    expect(dashboard.incidentPipeline.opened).toBe(0);
    expect(dashboard.incidentPipeline.resolved).toBe(0);
    const accountability = await authority.agentAccountability(user, true);
    expect(accountability.agents.length).toBeGreaterThan(0);
    expect(forbidden).not.toHaveBeenCalled();
    expect(accountability.operationalFleet.active).toBe(0);
  });
});
