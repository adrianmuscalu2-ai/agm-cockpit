import { GITHUB_ACTIONS_PROVISIONING_CONTRACT } from '../src/machine-auth/github-actions-oidc.contract';
import { TURN_OPERATIONAL_TRUTH_CONTRACT } from '../src/turn-operational-truth/turn-operational-truth.contract';
import { TurnOperationalTruthService } from '../src/turn-operational-truth/turn-operational-truth.service';

const companyId = GITHUB_ACTIONS_PROVISIONING_CONTRACT.companyId;
const machine = {
  requestId: '10000000-0000-4000-8000-000000000001',
  correlationId: '20000000-0000-4000-8000-000000000001',
  companyId,
  subject: 'production-release-1-1',
  machineIdentityId: '30000000-0000-4000-8000-000000000001',
  credentialId: '40000000-0000-4000-8000-000000000001',
  scopes: ['acp:read'],
};

function prismaFor(overrides: Record<string, unknown> = {}) {
  const tx = {
    authorityAuditJournal: { create: jest.fn().mockResolvedValue({}) },
    agentRuntimeEvent: { create: jest.fn().mockResolvedValue({}) },
    componentHeartbeat: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    authorityAuditJournal: { findFirst: jest.fn().mockResolvedValue(null) },
    agentRuntimeEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    componentHeartbeat: { findUnique: jest.fn().mockResolvedValue(null) },
    ...overrides,
  };
  return { prisma, tx, service: new TurnOperationalTruthService(prisma as never) };
}

describe('TurnOperationalTruthService', () => {
  it('persists only a real authenticated ACP read as one correlated transaction', async () => {
    const { service, prisma, tx } = prismaFor();
    const result = await service.recordAuthenticatedAcpRead({
      machine,
      route: `/api/v1/m2m/authority-control-plane/companies/${companyId}/network-registry`,
      responseBody: { data: [{ canonicalId: 'agm.authority.control-plane' }] },
      registryNodeCount: 1,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.authorityAuditJournal.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      companyId,
      eventType: TURN_OPERATIONAL_TRUTH_CONTRACT.authenticatedReadEventType,
      actorType: 'MACHINE',
      actorId: machine.subject,
      outcome: 'PASS',
      correlationId: machine.correlationId,
    }) });
    expect(tx.agentRuntimeEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      eventId: result.runtimeEventId,
      agentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
      lifecycle: 'COMPLETED',
      evidenceRef: result.evidenceRef,
      evidenceHash: result.responseDigest,
    }) });
    expect(tx.componentHeartbeat.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId_componentId: { companyId, componentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId } },
    }));
  });

  it('does not grant green without an authenticated machine audit event', async () => {
    const { service } = prismaFor();
    const snapshot = await service.snapshot(new Date('2026-09-04T12:00:00.000Z'));
    expect(snapshot).toMatchObject({
      overallStatus: 'NO_TELEMETRY',
      authStatus: 'AUTH REQUIRED',
      telemetryStatus: 'NO TELEMETRY',
      falseGreen: 0,
      unexplainedDegraded: 0,
    });
  });

  it('returns PASS only when audit, telemetry and EventStore are correlated and fresh', async () => {
    const occurredAt = new Date('2026-09-04T12:00:00.000Z');
    const runtimeEventId = '50000000-0000-4000-8000-000000000001';
    const responseDigest = 'a'.repeat(64);
    const metadata = {
      requestId: machine.requestId,
      correlationId: machine.correlationId,
      runtimeEventId,
      machineIdentityId: machine.machineIdentityId,
      credentialId: machine.credentialId,
      subject: machine.subject,
      scopes: machine.scopes,
      route: `/api/v1/m2m/authority-control-plane/companies/${companyId}/network-registry`,
      responseDigest,
      registryNodeCount: 31,
      authContract: 'm2m-client-credentials.v1',
    };
    const runtimeEvent = {
      eventId: runtimeEventId,
      mandateId: `m2m-acp-read:${machine.correlationId}`,
      agentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
      dossierId: machine.requestId,
      lifecycle: 'COMPLETED',
      sequence: 1,
      occurredAt,
      recordedAt: occurredAt,
      evidenceRef: `${TURN_OPERATIONAL_TRUTH_CONTRACT.evidencePrefix}${machine.requestId}`,
      evidenceHash: responseDigest,
      detail: 'real observation',
    };
    const { service } = prismaFor({
      authorityAuditJournal: { findFirst: jest.fn().mockResolvedValue({ occurredAt, safeMetadata: metadata }) },
      agentRuntimeEvent: { findFirst: jest.fn().mockResolvedValue(runtimeEvent) },
      componentHeartbeat: { findUnique: jest.fn().mockResolvedValue({
        lastSeenAt: occurredAt,
        lastDetail: JSON.stringify({ requestId: machine.requestId, runtimeEventId, responseDigest }),
      }) },
    });

    const snapshot = await service.snapshot(new Date('2026-09-04T12:01:00.000Z'));
    expect(snapshot).toMatchObject({
      overallStatus: 'PASS',
      reason: 'AUTHENTICATED_M2M_ACP_READ_LIVE',
      authStatus: 'M2M AUTHENTICATED',
      telemetryStatus: 'LIVE TELEMETRY',
      freshness: 'LIVE',
      chain: {
        machineIdentity: { status: 'VERIFIED' },
        credential: { status: 'VERIFIED' },
        token: { status: 'VERIFIED', scope: 'acp:read' },
        authenticatedAcpRead: { status: 'PASS', registryNodeCount: 31 },
        telemetry: { status: 'PASS' },
        eventStore: { status: 'PERSISTED', eventId: runtimeEventId },
        api: { status: 'PASS', responseDigest },
        turn: { status: 'EVIDENCE AVAILABLE', eventId: runtimeEventId },
        ui: { status: 'READY FOR LIVE RENDER' },
      },
    });
  });

  it('makes stale authenticated telemetry explicitly DEGRADED with a reason', async () => {
    const occurredAt = new Date('2026-09-04T11:00:00.000Z');
    const runtimeEventId = '50000000-0000-4000-8000-000000000001';
    const responseDigest = 'b'.repeat(64);
    const metadata = {
      requestId: machine.requestId,
      correlationId: machine.correlationId,
      runtimeEventId,
      machineIdentityId: machine.machineIdentityId,
      credentialId: machine.credentialId,
      subject: machine.subject,
      scopes: machine.scopes,
      route: '/api/v1/m2m/authority-control-plane/companies/x/network-registry',
      responseDigest,
      registryNodeCount: 1,
      authContract: 'm2m-client-credentials.v1',
    };
    const { service } = prismaFor({
      authorityAuditJournal: { findFirst: jest.fn().mockResolvedValue({ occurredAt, safeMetadata: metadata }) },
      agentRuntimeEvent: { findFirst: jest.fn().mockResolvedValue({
        eventId: runtimeEventId, mandateId: 'm', agentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
        dossierId: machine.requestId, lifecycle: 'COMPLETED', sequence: 1, occurredAt, recordedAt: occurredAt,
        evidenceRef: `${TURN_OPERATIONAL_TRUTH_CONTRACT.evidencePrefix}${machine.requestId}`, evidenceHash: responseDigest, detail: 'real',
      }) },
      componentHeartbeat: { findUnique: jest.fn().mockResolvedValue({
        lastSeenAt: occurredAt,
        lastDetail: JSON.stringify({ requestId: machine.requestId, runtimeEventId, responseDigest }),
      }) },
    });

    const snapshot = await service.snapshot(new Date('2026-09-04T12:00:00.000Z'));
    expect(snapshot).toMatchObject({
      overallStatus: 'DEGRADED',
      reason: 'AUTHENTICATED_M2M_ACP_READ_STALE',
      authStatus: 'M2M AUTHENTICATED',
      telemetryStatus: 'STALE TELEMETRY',
      unexplainedDegraded: 0,
    });
  });
});
