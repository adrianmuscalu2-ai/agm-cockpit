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
    authorityAuditJournal: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    agentRuntimeEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    componentHeartbeat: { findUnique: jest.fn().mockResolvedValue(null) },
    authorityMandate: { findFirst: jest.fn().mockResolvedValue(null) },
    ...overrides,
  };
  return { prisma, tx, service: new TurnOperationalTruthService(prisma as never) };
}

function evidenceFixture(accessAt: Date, dutyAt: Date) {
  const accessEventId = '50000000-0000-4000-8000-000000000001';
  const dutyEventId = '60000000-0000-4000-8000-000000000001';
  const acpMandateId = '70000000-0000-4000-8000-000000000001';
  const validatorMandateId = '80000000-0000-4000-8000-000000000001';
  const responseDigest = 'a'.repeat(64);
  const outputRef = `sha256:${'b'.repeat(64)}`;
  const metadata = {
    requestId: machine.requestId,
    correlationId: machine.correlationId,
    runtimeEventId: accessEventId,
    machineIdentityId: machine.machineIdentityId,
    credentialId: machine.credentialId,
    subject: machine.subject,
    scopes: machine.scopes,
    route: `/api/v1/m2m/authority-control-plane/companies/${companyId}/network-registry`,
    responseDigest,
    registryNodeCount: 28,
    authContract: 'm2m-client-credentials.v1',
  };
  const accessRuntimeEvent = {
    eventId: accessEventId,
    mandateId: `m2m-acp-read:${machine.correlationId}`,
    agentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
    dossierId: machine.requestId,
    lifecycle: 'COMPLETED',
    sequence: 1,
    occurredAt: accessAt,
    recordedAt: accessAt,
    evidenceRef: `${TURN_OPERATIONAL_TRUTH_CONTRACT.evidencePrefix}${machine.requestId}`,
    outputRef: null,
    evidenceHash: responseDigest,
    detail: 'Authenticated release access proof.',
  };
  const runtimeEvent = {
    eventId: dutyEventId,
    mandateId: acpMandateId,
    agentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
    dossierId: 'critical-continuous-test',
    lifecycle: 'COMPLETED',
    sequence: 1,
    occurredAt: dutyAt,
    recordedAt: dutyAt,
    evidenceRef: 'AuthorityAuditJournal:90000000-0000-4000-8000-000000000001',
    outputRef,
    evidenceHash: 'b'.repeat(64),
    detail: 'Periodic authority graph duty completed.',
  };
  const validation = {
    eventId: 'a0000000-0000-4000-8000-000000000001',
    eventType: 'AGENT_ACCOUNTABILITY_VALIDATED',
    actorId: 'premium.architecture-inspector',
    mandateId: validatorMandateId,
    outcome: 'PASS',
    occurredAt: new Date(dutyAt.getTime() + 1),
    safeMetadata: {
      agentId: runtimeEvent.agentId,
      targetMandateId: acpMandateId,
      executionEventId: dutyEventId,
      executionEvidenceRef: runtimeEvent.evidenceRef,
      executionOutputRef: outputRef,
      validatorId: 'premium.architecture-inspector',
      validatorMandateId,
      result: 'PASS',
    },
  };
  return {
    metadata,
    accessRuntimeEvent,
    runtimeEvent,
    validation,
    acpMandate: { id: acpMandateId, agentId: runtimeEvent.agentId },
    validatorMandate: { id: validatorMandateId, agentId: validation.actorId },
    heartbeat: {
      reportedStatus: 'ONLINE',
      lastSeenAt: dutyAt,
      lastDetail: JSON.stringify({ requestId: machine.requestId, runtimeEventId: accessEventId, responseDigest }),
    },
  };
}

function runtimePrisma(accessAt: Date, dutyAt: Date) {
  const fixture = evidenceFixture(accessAt, dutyAt);
  return {
    fixture,
    overrides: {
      authorityAuditJournal: {
        findFirst: jest.fn().mockResolvedValue({ occurredAt: accessAt, safeMetadata: fixture.metadata }),
        findMany: jest.fn().mockResolvedValue([fixture.validation]),
      },
      agentRuntimeEvent: {
        findFirst: jest.fn().mockImplementation(({ where }: { where: { eventId?: string } }) => Promise.resolve(where.eventId ? fixture.accessRuntimeEvent : fixture.runtimeEvent)),
      },
      componentHeartbeat: { findUnique: jest.fn().mockResolvedValue(fixture.heartbeat) },
      authorityMandate: {
        findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) => Promise.resolve(where.id ? fixture.validatorMandate : fixture.acpMandate)),
      },
    },
  };
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
    expect(tx.authorityAuditJournal.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: TURN_OPERATIONAL_TRUTH_CONTRACT.authenticatedReadEventType, actorType: 'MACHINE', outcome: 'PASS' }) });
    expect(tx.agentRuntimeEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventId: result.runtimeEventId, lifecycle: 'COMPLETED', evidenceRef: result.evidenceRef }) });
    expect(tx.componentHeartbeat.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not grant green without persistent runtime or authenticated access evidence', async () => {
    const { service } = prismaFor();
    await expect(service.snapshot(new Date('2026-09-04T12:00:00.000Z'))).resolves.toMatchObject({
      overallStatus: 'NO_TELEMETRY',
      reason: 'M2M_ACCESS_PROOF_CORRELATION_MISSING',
      falseGreen: 0,
      accessProof: { status: 'MISSING' },
    });
  });

  it('uses the current periodic duty for PASS while keeping an old release access proof explicitly STALE', async () => {
    const now = new Date('2026-09-04T12:00:00.000Z');
    const { fixture, overrides } = runtimePrisma(new Date('2026-09-04T08:00:00.000Z'), new Date('2026-09-04T11:59:30.000Z'));
    const { service } = prismaFor(overrides);
    await expect(service.snapshot(now)).resolves.toMatchObject({
      contractVersion: 'turn-operational-truth.v2',
      overallStatus: 'PASS',
      reason: 'ACP_PERIODIC_DUTY_CURRENT',
      observedAt: fixture.runtimeEvent.occurredAt.toISOString(),
      freshness: 'LIVE',
      telemetryStatus: 'LIVE TELEMETRY',
      accessProof: { status: 'STALE', role: 'HISTORICAL_RELEASE_ACCESS_PROOF_NOT_RUNTIME_FRESHNESS' },
      authorityControlPlane: { status: 'PASS', statusSource: 'ACTIVE_MANDATE_AGENT_RUNTIME_EVENT_INDEPENDENT_VALIDATION_COMPONENT_HEARTBEAT' },
      chain: { telemetry: { status: 'PASS' }, eventStore: { status: 'PERSISTED', eventId: fixture.runtimeEvent.eventId }, turn: { status: 'EVIDENCE AVAILABLE' } },
      latestEvent: { eventId: fixture.runtimeEvent.eventId, mandateId: fixture.acpMandate.id, lifecycle: 'COMPLETED' },
    });
  });

  it('degrades when the periodic duty and its validation exceed the 90 second SLA', async () => {
    const now = new Date('2026-09-04T12:00:00.000Z');
    const { overrides } = runtimePrisma(new Date('2026-09-04T11:59:00.000Z'), new Date('2026-09-04T11:55:00.000Z'));
    const { service } = prismaFor(overrides);
    await expect(service.snapshot(now)).resolves.toMatchObject({
      overallStatus: 'DEGRADED',
      reason: 'ACP_PERIODIC_DUTY_STALE',
      freshness: 'STALE',
      telemetryStatus: 'STALE TELEMETRY',
      falseGreen: 0,
    });
  });

  it('does not treat an authenticated M2M release read as periodic duty execution', async () => {
    const now = new Date('2026-09-04T12:00:00.000Z');
    const { fixture } = runtimePrisma(new Date('2026-09-04T11:59:30.000Z'), new Date('2026-09-04T11:59:30.000Z'));
    const { service } = prismaFor({
      authorityAuditJournal: { findFirst: jest.fn().mockResolvedValue({ occurredAt: now, safeMetadata: fixture.metadata }), findMany: jest.fn().mockResolvedValue([]) },
      agentRuntimeEvent: { findFirst: jest.fn().mockResolvedValue(fixture.accessRuntimeEvent) },
      componentHeartbeat: { findUnique: jest.fn().mockResolvedValue(fixture.heartbeat) },
      authorityMandate: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.snapshot(now)).resolves.toMatchObject({ overallStatus: 'DEGRADED', reason: 'ACP_ACTIVE_MANDATE_MISSING', falseGreen: 0 });
  });
});
