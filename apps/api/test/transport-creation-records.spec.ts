import { recordTransportCreationAudit } from '../src/transports/transport-creation-records';

describe('transport creation records', () => {
  const ctx = {
    requestId: 'request-1',
    correlationId: 'correlation-1',
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['admin'],
  };
  const transport = {
    id: 'transport-1',
    transportNumber: 'AGM-2026-0001',
    currentLifecycleStateId: 'state-imported',
    currentLifecycleState: {
      code: 'imported',
      displayName: 'imported',
    },
  };

  it('preserves the creation audit identity and snapshot', async () => {
    const tx = {};
    const audit = {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    await expect(
      recordTransportCreationAudit({
        audit: audit as never,
        tx: tx as never,
        ctx,
        transport,
      }),
    ).resolves.toEqual({ id: 'audit-1' });

    expect(audit.create).toHaveBeenCalledWith(
      {
        actionCode: 'create-transport',
        entityType: 'TransportJob',
        entityId: 'transport-1',
        transportJobId: 'transport-1',
        reason: 'Transport created through business action API.',
        afterSnapshot: {
          id: 'transport-1',
          transportNumber: 'AGM-2026-0001',
          currentLifecycleStateId: 'state-imported',
          currentLifecycleState: {
            code: 'imported',
            displayName: 'imported',
          },
        },
      },
      ctx,
      tx,
    );
  });

  it('propagates the creation audit failure unchanged', async () => {
    const audit = {
      create: jest
        .fn()
        .mockRejectedValue(new Error('creation-audit-failed')),
    };

    await expect(
      recordTransportCreationAudit({
        audit: audit as never,
        tx: {} as never,
        ctx,
        transport,
      }),
    ).rejects.toThrow('creation-audit-failed');
  });
});
