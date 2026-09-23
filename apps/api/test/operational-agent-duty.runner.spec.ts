import { canonicalLinguisticResourceCounts, formatLinguisticResourceEvidence } from '@agm/shared';
import { OperationalAgentDutyRunner } from '../src/authority-control-plane/operational-agent-duty.runner';
import type { PrismaService } from '../src/prisma/prisma.service';

describe('OperationalAgentDutyRunner linguistic recovery', () => {
  it('reads active V1 typed state and its server receipt without consulting legacy lastDetail', async () => {
    const counts = canonicalLinguisticResourceCounts();
    const componentHeartbeatFind = jest.fn();
    const state = {
      baselineId: 'baseline-v1', componentId: 'premium-linguist-it', language: 'it', operationalState: 'ONLINE',
      authorityScope: 'premium.linguistic.it', mandateId: 'mandate-it', mandateVersion: 1,
      currentEvidenceId: 'evidence-v1', observedAt: new Date('2026-09-19T04:02:30.000Z'), authorityEpoch: 3, sequence: 7,
      contractVersion: 'agm.linguistic-resource-counts.v1', contractDigest: 'sha256:8c2207d91a261c69af17eca9746867c14c603dcc0edc061d74c88330ceb721b1',
      catalogDigest: 'sha256:5cf389fc2f2e60ff9d9a0dd6acd008ee370b07065e85e41f53f95610e260ea25',
      appCount: counts.app, operationalCount: counts.operational, carMoverCount: counts.carMover, premiumCount: counts.premium, totalCount: counts.total, errorCount: 0,
      currentEvidence: { publisher: { writerId: 'agm.operational-linguist.workflow-auditor', writerVersion: '1.0.0', buildRevision: 'a'.repeat(40) } },
    };
    const runner = new OperationalAgentDutyRunner({
      operationalLinguistBaseline: { findUnique: jest.fn(async () => ({ id: 'baseline-v1', status: 'ACTIVE' })) },
      operationalLinguistState: { findUnique: jest.fn(async () => state) },
      operationalLinguistReceipt: { findUnique: jest.fn(async () => ({ id: 'receipt-v1', outcome: 'ACCEPTED', reasonCode: 'CANONICAL_EVIDENCE_PERSISTED' })) },
      componentHeartbeat: { findUnique: componentHeartbeatFind },
    } as unknown as PrismaService, {} as never, {} as never);

    const result = await (runner as unknown as { linguisticDuty(agentId: string, companyId: string, now: Date): Promise<{ passed: boolean; evidenceReferences: string[]; checks: Record<string, unknown> }> }).linguisticDuty(
      'premium-linguist-it', '11111111-1111-1111-1111-111111111111', new Date('2026-09-19T04:03:00.000Z'),
    );

    expect(result).toMatchObject({ passed: true, checks: { persistence: 'OPERATIONAL_LINGUIST_V1', receiptAccepted: true, authorityEpoch: 3, sequence: 7 } });
    expect(result.evidenceReferences).toEqual(['OperationalLinguistEvidence:evidence-v1', 'OperationalLinguistReceipt:receipt-v1']);
    expect(componentHeartbeatFind).not.toHaveBeenCalled();
  });

  it('accepts current validated catalog evidence and clears a stale failure reason', async () => {
    const counts = canonicalLinguisticResourceCounts();
    const heartbeat = {
      id: 'heartbeat-id',
      reportedStatus: 'ONLINE',
      lastFailureReason: 'I18N_RESOURCE_VALIDATION_FAILED',
      lastDetail: formatLinguisticResourceEvidence({ language: 'it', counts, errors: 0, journalStatus: 'PERSISTED' }),
      lastSeenAt: new Date('2026-09-19T04:02:30.000Z'),
    };
    const update = jest.fn(async () => ({ ...heartbeat, lastFailureReason: null }));
    const runner = new OperationalAgentDutyRunner({ componentHeartbeat: { findUnique: jest.fn(async () => heartbeat), update }, operationalLinguistBaseline: { findUnique: jest.fn(async () => null) } } as unknown as PrismaService, {} as never, {} as never);

    const result = await (runner as unknown as { linguisticDuty(agentId: string, companyId: string, now: Date): Promise<{ passed: boolean; checks: Record<string, unknown> }> }).linguisticDuty(
      'premium-linguist-it',
      '11111111-1111-1111-1111-111111111111',
      new Date('2026-09-19T04:03:00.000Z'),
    );

    expect(result).toMatchObject({ passed: true, checks: { resourceCountProven: true, resourceCounts: counts, contractVersionMatches: true, contractDigestMatches: true, componentsMatchCanonical: true, totalMatchesComponents: true, errorsZero: true, staleFailureReasonCleared: true } });
    expect(update).toHaveBeenCalledWith({
      where: { companyId_componentId: { companyId: '11111111-1111-1111-1111-111111111111', componentId: 'premium-linguist-it' } },
      data: { lastFailureReason: null },
    });
  });

  it('rejects internally inconsistent catalog counts even when the publisher reports zero errors', async () => {
    const counts = canonicalLinguisticResourceCounts();
    const validDetail = formatLinguisticResourceEvidence({ language: 'it', counts, errors: 0, journalStatus: 'PERSISTED' });
    const heartbeat = {
      id: 'heartbeat-id',
      reportedStatus: 'ONLINE',
      lastFailureReason: null,
      lastDetail: validDetail.replace(`total=${counts.total}`, `total=${counts.total - 1}`),
      lastSeenAt: new Date('2026-09-19T04:02:30.000Z'),
    };
    const runner = new OperationalAgentDutyRunner({ componentHeartbeat: { findUnique: jest.fn(async () => heartbeat), update: jest.fn() }, operationalLinguistBaseline: { findUnique: jest.fn(async () => null) } } as unknown as PrismaService, {} as never, {} as never);

    const result = await (runner as unknown as { linguisticDuty(agentId: string, companyId: string, now: Date): Promise<{ passed: boolean; reason: string | null; checks: Record<string, unknown> }> }).linguisticDuty(
      'premium-linguist-it',
      '11111111-1111-1111-1111-111111111111',
      new Date('2026-09-19T04:03:00.000Z'),
    );

    expect(result).toMatchObject({ passed: false, reason: 'LINGUISTIC_CATALOG_VALIDATION_FAILED', checks: { resourceCountProven: false, componentsMatchCanonical: true, totalMatchesComponents: false, errorsZero: true } });
  });
});
