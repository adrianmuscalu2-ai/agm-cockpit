import { OperationalAgentDutyRunner } from '../src/authority-control-plane/operational-agent-duty.runner';
import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';
import { qualifyOperationalIncident } from '../src/authority-control-plane/operational-incident-evaluator';
import type { PrismaService } from '../src/prisma/prisma.service';

const companyId = '00000000-0000-0000-0000-000000000010';
const observedAt = new Date('2026-09-27T12:00:30.000Z');
const ctx = {
  companyId,
  userId: '00000000-0000-0000-0000-000000000001',
  roles: ['PRODUCT_OWNER'],
  requestId: '00000000-0000-4000-a000-000000000010',
  correlationId: '00000000-0000-4000-a000-000000000011',
};

describe('Chief Monitoring Inspector BASIC runtime', () => {
  it('persists a real, idempotent AgentRuntimeEvent without consulting ComponentHeartbeat', async () => {
    let persistedRuntime: Record<string, unknown> | null = null;
    const runtimeCreate = jest.fn(async ({ data }) => {
      persistedRuntime = { ...data };
      return persistedRuntime;
    });
    const journalCreate = jest.fn(async ({ data }) => ({ ...data }));
    const componentHeartbeatFind = jest.fn();
    const prisma = {
      authorityMandate: { findMany: jest.fn().mockResolvedValue([
        { id: 'mandate-cmi', agentId: 'chief-monitoring-inspector', version: 1, issuedAt: observedAt },
        { id: 'mandate-worker', agentId: 'basic-worker', version: 1, issuedAt: observedAt },
      ]) },
      agentRuntimeEvent: { findMany: jest.fn().mockResolvedValue([
        { eventId: '00000000-0000-4000-a000-000000000020', agentId: 'basic-worker', mandateId: 'mandate-worker', lifecycle: 'COMPLETED', occurredAt: new Date('2026-09-27T12:00:10.000Z') },
      ]) },
      authorityAuditJournal: { findMany: jest.fn().mockImplementation(async ({ where }) => where.eventType === 'AGENT_ACCOUNTABILITY_VALIDATED'
        ? [{ eventId: '00000000-0000-4000-a000-000000000021', actorId: 'validator', outcome: 'PASS', occurredAt: new Date('2026-09-27T12:00:11.000Z'), safeMetadata: { executionEventId: '00000000-0000-4000-a000-000000000020' } }]
        : []) },
      componentHeartbeat: { findUnique: componentHeartbeatFind },
      $transaction: jest.fn(async (callback) => callback({
        agentRuntimeEvent: { findUnique: jest.fn(async () => persistedRuntime), create: runtimeCreate },
        authorityAuditJournal: { create: journalCreate },
      })),
    };
    const runner = new OperationalAgentDutyRunner(prisma as unknown as PrismaService, {} as never, {} as never);
    const mandate = { id: 'mandate-cmi', agentId: 'chief-monitoring-inspector' };

    const first = await runner.executeChiefMonitoringInspector(ctx, mandate, 'run-1', observedAt);
    const second = await runner.executeChiefMonitoringInspector(ctx, mandate, 'run-2', observedAt);

    expect(first).toMatchObject({ agentId: 'chief-monitoring-inspector', mandateId: 'mandate-cmi', passed: true, result: 'COMPLETED' });
    expect(second.executionEventId).toBe(first.executionEventId);
    expect(runtimeCreate).toHaveBeenCalledTimes(1);
    expect(journalCreate).toHaveBeenCalledTimes(1);
    expect(componentHeartbeatFind).not.toHaveBeenCalled();
    expect(JSON.stringify(runtimeCreate.mock.calls[0][0])).not.toContain('ComponentHeartbeat');
  });

  it('records a FAILED finding for an unvalidated runtime failure', async () => {
    const prisma = {
      authorityMandate: { findMany: jest.fn().mockResolvedValue([{ id: 'mandate-cmi', agentId: 'chief-monitoring-inspector', version: 1, issuedAt: observedAt }]) },
      agentRuntimeEvent: { findMany: jest.fn().mockResolvedValue([
        { eventId: '00000000-0000-4000-a000-000000000030', agentId: 'basic-worker', mandateId: 'mandate-worker', lifecycle: 'FAILED', occurredAt: new Date('2026-09-27T12:00:10.000Z') },
      ]) },
      authorityAuditJournal: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (callback) => callback({
        agentRuntimeEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }) => ({ ...data })) },
        authorityAuditJournal: { create: jest.fn(async ({ data }) => ({ ...data })) },
      })),
    };
    const runner = new OperationalAgentDutyRunner(prisma as unknown as PrismaService, {} as never, {} as never);

    const result = await runner.executeChiefMonitoringInspector(ctx, { id: 'mandate-cmi', agentId: 'chief-monitoring-inspector' }, 'run-failure', observedAt);

    expect(result).toMatchObject({ passed: false, result: 'FAILED', reason: 'CMI_UNVALIDATED_RUNTIME_FAILURE_DETECTED' });
    expect(result.checks).toMatchObject({ unvalidatedFailures: 1, componentHeartbeatAuthority: 'FORBIDDEN', incidentAuthority: 'AUTHORITY_CONTROL_PLANE' });
  });

  it('uses the existing Authority Control Plane incident lifecycle for failure, recovery and dedupe', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = {
      authorityAuditJournal: {
        create: jest.fn(async ({ data }) => {
          const event = { ...data, occurredAt: data.occurredAt ?? observedAt };
          created.push(event);
          return event;
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new AuthorityControlPlaneService(prisma as never, {} as never, {} as never, {} as never);
    const reconcile = (service as unknown as {
      reconcileOperationalIncidents(context: typeof ctx, evaluations: unknown[], journals: unknown[]): Promise<{ events: unknown[] }>;
    }).reconcileOperationalIncidents.bind(service);
    const failed = qualifyOperationalIncident({
      canonicalId: 'chief-monitoring-inspector', status: 'FAIL', runtimeMode: 'CONTINUOUS_COMPONENT', runtimePresence: 'PRESENT',
      workloadState: 'VALIDATED', dependencyState: 'FAIL', dependencyFailures: ['CMI_UNVALIDATED_RUNTIME_FAILURE_DETECTED'],
      reason: 'CMI_UNVALIDATED_RUNTIME_FAILURE_DETECTED', evidenceReference: 'AgentRuntimeEvent:failed-cmi', evaluatedAt: observedAt,
    });
    await reconcile(ctx, [{ canonicalId: 'chief-monitoring-inspector', scopeId: 'basic.monitoring', qualification: failed }], []);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ eventType: 'OPERATIONAL_INCIDENT_OPENED', actorId: 'turn.operational-incident-evaluator' });

    const recoveredAt = new Date(observedAt.getTime() + 60_000);
    const recovered = qualifyOperationalIncident({
      canonicalId: 'chief-monitoring-inspector', status: 'PASS', runtimeMode: 'CONTINUOUS_COMPONENT', runtimePresence: 'PRESENT',
      workloadState: 'VALIDATED', dependencyState: 'PASS', dependencyFailures: [], reason: null,
      evidenceReference: 'AgentRuntimeEvent:recovered-cmi', evaluatedAt: recoveredAt,
    });
    await reconcile(ctx, [{ canonicalId: 'chief-monitoring-inspector', scopeId: 'basic.monitoring', qualification: recovered }], [created[0]]);
    expect(created).toHaveLength(2);
    expect(created[1]).toMatchObject({ eventType: 'OPERATIONAL_INCIDENT_RESOLVED', actorId: 'turn.operational-incident-evaluator' });

    await reconcile(ctx, [{ canonicalId: 'chief-monitoring-inspector', scopeId: 'basic.monitoring', qualification: recovered }], [created[1], created[0]]);
    expect(created).toHaveLength(2);
  });
});
