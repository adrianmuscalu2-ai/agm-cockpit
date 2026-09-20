import { canonicalLinguisticResourceCounts } from '@agm/shared';
import { createPremiumLinguisticHeartbeatDetail } from '../../web/src/premium-linguistic-agents/premium-linguistic-heartbeat.evidence';
import { OperationalAgentDutyRunner } from '../src/authority-control-plane/operational-agent-duty.runner';
import type { PrismaService } from '../src/prisma/prisma.service';

describe('OperationalAgentDutyRunner linguistic recovery', () => {
  it('accepts current validated catalog evidence and clears a stale failure reason', async () => {
    const counts = canonicalLinguisticResourceCounts();
    const heartbeat = {
      id: 'heartbeat-id',
      reportedStatus: 'ONLINE',
      lastFailureReason: 'I18N_RESOURCE_VALIDATION_FAILED',
      lastDetail: createPremiumLinguisticHeartbeatDetail({ language: 'it', counts, errors: [], journalStatus: 'PERSISTED' }),
      lastSeenAt: new Date('2026-09-19T04:02:30.000Z'),
    };
    const update = jest.fn(async () => ({ ...heartbeat, lastFailureReason: null }));
    const runner = new OperationalAgentDutyRunner({ componentHeartbeat: { findUnique: jest.fn(async () => heartbeat), update } } as unknown as PrismaService, {} as never, {} as never);

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
    const validDetail = createPremiumLinguisticHeartbeatDetail({ language: 'it', counts, errors: [], journalStatus: 'PERSISTED' });
    const heartbeat = {
      id: 'heartbeat-id',
      reportedStatus: 'ONLINE',
      lastFailureReason: null,
      lastDetail: validDetail.replace(`total=${counts.total}`, `total=${counts.total - 1}`),
      lastSeenAt: new Date('2026-09-19T04:02:30.000Z'),
    };
    const runner = new OperationalAgentDutyRunner({ componentHeartbeat: { findUnique: jest.fn(async () => heartbeat), update: jest.fn() } } as unknown as PrismaService, {} as never, {} as never);

    const result = await (runner as unknown as { linguisticDuty(agentId: string, companyId: string, now: Date): Promise<{ passed: boolean; reason: string | null; checks: Record<string, unknown> }> }).linguisticDuty(
      'premium-linguist-it',
      '11111111-1111-1111-1111-111111111111',
      new Date('2026-09-19T04:03:00.000Z'),
    );

    expect(result).toMatchObject({ passed: false, reason: 'LINGUISTIC_CATALOG_VALIDATION_FAILED', checks: { resourceCountProven: false, componentsMatchCanonical: true, totalMatchesComponents: false, errorsZero: true } });
  });
});
