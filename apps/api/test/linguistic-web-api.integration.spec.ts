import {
  canonicalLinguisticResourceCounts,
  createCanonicalOperationalLinguist,
  LINGUISTIC_RESOURCE_CONTRACT_CANONICAL,
  LINGUISTIC_RESOURCE_CONTRACT_DIGEST,
} from '@agm/shared';
import { createHash } from 'node:crypto';
import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';
import {
  OperationalAgentDutyRunner,
  type OperationalAgentDutyResult,
} from '../src/authority-control-plane/operational-agent-duty.runner';
import type { RequestContext } from '../src/common/request-context';

const companyId = '11111111-1111-1111-1111-111111111111';
const targets = [
  { agentId: 'premium-linguist-it', language: 'it' },
  { agentId: 'premium-linguist-es', language: 'es' },
  { agentId: 'premium-linguist-sv', language: 'sv' },
] as const;
const ctx: RequestContext = {
  companyId,
  userId: '22222222-2222-2222-2222-222222222222',
  roles: ['PRODUCT_OWNER'],
  requestId: 'request-linguistic-contract',
  correlationId: 'correlation-linguistic-contract',
};

type IndependentValidator = {
  validateOperationalDutyResults(
    context: RequestContext,
    executions: readonly OperationalAgentDutyResult[],
    validatorMandate: { id: string },
    runId: string,
  ): Promise<Array<{ agentId: string; validationEventId: string }>>;
};

type V1State = ReturnType<typeof v1State>;

function v1State(language: 'it' | 'es' | 'sv', overrides: Partial<Record<string, unknown>> = {}) {
  const definition = createCanonicalOperationalLinguist(language);
  return {
    id: `state-${definition.componentId}`,
    baselineId: 'baseline-v1', componentId: definition.componentId, language, operationalState: 'ONLINE',
    authorityScope: definition.authorityScope, mandateId: `mandate-${definition.componentId}`, mandateVersion: 1,
    currentEvidenceId: `evidence-${definition.componentId}`, observedAt: new Date(), authorityEpoch: 3, sequence: 7,
    contractVersion: definition.resourceContractVersion, contractDigest: definition.resourceContractDigest,
    catalogDigest: definition.resourceCatalogDigest,
    appCount: definition.resourceCounts.app, operationalCount: definition.resourceCounts.operational,
    carMoverCount: definition.resourceCounts.carMover, premiumCount: definition.resourceCounts.premium,
    totalCount: definition.resourceCounts.total, errorCount: 0,
    currentEvidence: { publisher: { writerId: 'agm.operational-linguist.workflow-auditor', writerVersion: '1.0.0', buildRevision: 'a'.repeat(40) } },
    ...overrides,
  };
}

function runtimeHarness(states: ReadonlyMap<string, V1State>) {
  const authorityAuditJournalCreate = jest.fn(async ({ data }) => ({ ...data }));
  const agentRuntimeEventCreate = jest.fn(async ({ data }) => ({ ...data }));
  const legacyHeartbeatFind = jest.fn();
  const prisma = {
    operationalLinguistBaseline: { findUnique: jest.fn(async () => ({ id: 'baseline-v1', status: 'ACTIVE' })) },
    operationalLinguistState: {
      findUnique: jest.fn(async ({ where }) => states.get(where.companyId_componentId.componentId) ?? null),
    },
    operationalLinguistReceipt: { findUnique: jest.fn(async ({ where }) => ({ id: `receipt-${where.evidenceId}`, outcome: 'ACCEPTED', reasonCode: 'CANONICAL_EVIDENCE_PERSISTED' })) },
    componentHeartbeat: { findUnique: legacyHeartbeatFind, update: jest.fn() },
    authorityAuditJournal: { create: authorityAuditJournalCreate },
    agentRuntimeEvent: { create: agentRuntimeEventCreate },
  };
  const runner = new OperationalAgentDutyRunner(prisma as never, {} as never, {} as never);
  const service = new AuthorityControlPlaneService(prisma as never, {} as never, {} as never, runner);
  return {
    runner,
    validator: service as unknown as IndependentValidator,
    authorityAuditJournalCreate,
    agentRuntimeEventCreate,
    legacyHeartbeatFind,
  };
}

describe('canonical linguistic Web to API contract', () => {
  it('derives one versioned contract digest and completes all real Web payload duties with independent PASS receipts', async () => {
    const expectedDigest = `sha256:${createHash('sha256').update(LINGUISTIC_RESOURCE_CONTRACT_CANONICAL).digest('hex')}`;
    expect(LINGUISTIC_RESOURCE_CONTRACT_DIGEST).toBe(expectedDigest);

    const states = new Map(targets.map(({ agentId, language }) => [agentId, v1State(language)]));
    const harness = runtimeHarness(states);
    const mandates = targets.map(({ agentId }) => ({ id: `mandate-${agentId}`, agentId }));

    const executions = await harness.runner.execute(
      ctx,
      mandates,
      'integration-valid-web-payload',
      new Set(targets.map(({ agentId }) => agentId)),
    );
    const validations = await harness.validator.validateOperationalDutyResults(
      ctx,
      executions,
      { id: 'mandate-premium-architecture-inspector' },
      'integration-valid-web-payload',
    );

    expect(executions).toHaveLength(targets.length);
    expect(executions.every((execution) => execution.passed && execution.result === 'COMPLETED')).toBe(true);
    expect(validations.map(({ agentId }) => agentId).sort()).toEqual(targets.map(({ agentId }) => agentId).sort());
    const dutyReceipts = harness.authorityAuditJournalCreate.mock.calls
      .map(([input]) => input.data)
      .filter((data) => data.eventType === 'AGENT_OPERATIONAL_DUTY_COMPLETED');
    const validationReceipts = harness.authorityAuditJournalCreate.mock.calls
      .map(([input]) => input.data)
      .filter((data) => data.eventType === 'AGENT_ACCOUNTABILITY_VALIDATED');
    expect(dutyReceipts).toHaveLength(targets.length);
    expect(validationReceipts).toHaveLength(targets.length);
    expect(validationReceipts.every((receipt) => receipt.outcome === 'PASS')).toBe(true);
    expect(harness.agentRuntimeEventCreate.mock.calls.every(([input]) => input.data.lifecycle === 'COMPLETED')).toBe(true);
    expect(harness.legacyHeartbeatFind).not.toHaveBeenCalled();
  });

  it('rejects intentionally corrupted persisted V1 state and omits independent validation', async () => {
    const counts = canonicalLinguisticResourceCounts();
    const harness = runtimeHarness(new Map([['premium-linguist-it', v1State('it', { totalCount: counts.total - 1 })]]));
    const executions = await harness.runner.execute(
      ctx,
      [{ id: 'mandate-premium-linguist-it', agentId: 'premium-linguist-it' }],
      'integration-invalid-web-payload',
      new Set(['premium-linguist-it']),
    );
    const validations = await harness.validator.validateOperationalDutyResults(
      ctx,
      executions,
      { id: 'mandate-premium-architecture-inspector' },
      'integration-invalid-web-payload',
    );

    expect(executions).toMatchObject([{
      passed: false,
      result: 'FAILED',
      reason: 'LINGUISTIC_V1_CANONICAL_STATE_INVALID',
      checks: { persistence: 'OPERATIONAL_LINGUIST_V1', resourceCountProven: false, totalMatchesComponents: false, errorsZero: true },
    }]);
    expect(validations).toEqual([]);
    expect(harness.authorityAuditJournalCreate.mock.calls.map(([input]) => input.data.eventType)).toEqual([
      'AGENT_OPERATIONAL_DUTY_FAILED',
    ]);
    expect(harness.agentRuntimeEventCreate.mock.calls[0][0].data.lifecycle).toBe('FAILED');
    expect(harness.legacyHeartbeatFind).not.toHaveBeenCalled();
  });
});
