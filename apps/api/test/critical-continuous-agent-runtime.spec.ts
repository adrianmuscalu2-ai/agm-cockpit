import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';

const companyId = '00000000-0000-0000-0000-000000000010';
const criticalIds = ['agm.authority.control-plane', 'agm.guardian.secrets'];
const chiefMonitoringInspectorId = 'chief-monitoring-inspector';

describe('critical continuous agent runtime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-09T15:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('executes and independently validates both critical duties again after their 90-second freshness window', async () => {
    let eventSequence = 0;
    const authorityAuditCreate = jest.fn().mockImplementation(async ({ data }) => ({ ...data, eventId: data.eventId ?? `validation-${++eventSequence}` }));
    const activeMandates = [
      { id: 'mandate-acp', agentId: criticalIds[0], issuedAt: new Date() },
      { id: 'mandate-secrets', agentId: criticalIds[1], issuedAt: new Date() },
      { id: 'mandate-validator', agentId: 'premium.architecture-inspector', issuedAt: new Date() },
    ];
    const prisma = {
      company: { findMany: jest.fn().mockResolvedValue([{ id: companyId }]) },
      authorityMandate: {
        upsert: jest.fn().mockImplementation(async () => {
          const existing = activeMandates.find((mandate) => mandate.agentId === chiefMonitoringInspectorId);
          if (existing) return existing;
          const mandate = { id: 'mandate-cmi', agentId: chiefMonitoringInspectorId, issuedAt: new Date() };
          activeMandates.push(mandate);
          return mandate;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => activeMandates.filter((mandate) => where.agentId.in.includes(mandate.agentId))),
      },
      authorityAuditJournal: { create: authorityAuditCreate, findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
      componentHeartbeat: { upsert: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
    };
    const operationalDuties = {
      execute: jest.fn().mockImplementation(async (_ctx, mandates, runId, selectedIds) => criticalIds.map((agentId, index) => ({
        agentId,
        mandateId: mandates.find((mandate: { agentId: string }) => mandate.agentId === agentId).id,
        operation: agentId === criticalIds[0] ? 'authority graph evaluation' : 'redacted secret custody evaluation',
        passed: true,
        result: 'COMPLETED',
        reason: null,
        evidenceReferences: [`PersistentEvidence:${agentId}:${Date.now()}`],
        checks: { passed: true },
        executedAt: new Date(Date.now() + index).toISOString(),
        executionEventId: `execution-${agentId}-${Date.now()}`,
        evidenceRef: `AuthorityAuditJournal:execution-${agentId}-${Date.now()}`,
        outputRef: 'sha256:' + 'a'.repeat(64),
        selectedIds,
        runId,
      }))),
      executeChiefMonitoringInspector: jest.fn().mockImplementation(async (_ctx, mandate, runId) => ({
        agentId: chiefMonitoringInspectorId,
        mandateId: mandate.id,
        operation: 'Inspect current authority and runtime evidence',
        passed: true,
        result: 'COMPLETED',
        reason: null,
        evidenceReferences: [],
        checks: { componentHeartbeatAuthority: 'FORBIDDEN' },
        executedAt: new Date().toISOString(),
        executionEventId: `execution-${chiefMonitoringInspectorId}-${Date.now()}`,
        evidenceRef: `AuthorityAuditJournal:execution-${chiefMonitoringInspectorId}-${Date.now()}`,
        outputRef: 'sha256:' + 'b'.repeat(64),
        runId,
      })),
    };
    const discovery = { getProviders: () => [] };
    const service = new AuthorityControlPlaneService(prisma as never, {} as never, discovery as never, operationalDuties as never);
    const dashboard = jest.spyOn(service, 'dashboard').mockResolvedValue({} as never);

    await service.onApplicationBootstrap();
    expect(operationalDuties.execute).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(120_000);
    service.onApplicationShutdown();

    expect(operationalDuties.execute).toHaveBeenCalledTimes(3);
    expect(operationalDuties.executeChiefMonitoringInspector).toHaveBeenCalledTimes(3);
    for (const call of operationalDuties.execute.mock.calls) {
      expect(call[1].map((mandate: { agentId: string }) => mandate.agentId).sort()).toEqual(criticalIds.slice().sort());
      expect([...call[3]].sort()).toEqual(criticalIds.slice().sort());
    }
    expect(authorityAuditCreate).toHaveBeenCalledTimes(9);
    expect(authorityAuditCreate.mock.calls.every(([input]) => input.data.eventType === 'AGENT_ACCOUNTABILITY_VALIDATED'
      && input.data.actorId === 'premium.architecture-inspector'
      && input.data.mandateId === 'mandate-validator')).toBe(true);
    expect(dashboard).toHaveBeenCalledTimes(3);
  });
});
