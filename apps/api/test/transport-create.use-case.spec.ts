import { executeTransportCreate } from '../src/transports/transport-create.use-case';

describe('transport create use case', () => {
  const ctx = {
    requestId: 'request-1',
    correlationId: 'correlation-1',
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['admin'],
  };

  function harness() {
    const count = jest.fn().mockResolvedValue(0);
    const create = jest.fn().mockResolvedValue({
      id: 'transport-1',
      transportNumber: 'AGM-2026-0001',
      currentLifecycleStateId: 'state-imported',
      currentLifecycleState: {
        code: 'imported',
        displayName: 'imported',
      },
    });
    const update = jest.fn().mockResolvedValue({ id: 'transport-1' });
    const getStateByCode = jest
      .fn()
      .mockResolvedValue({ id: 'state-imported', code: 'imported' });
    const createAudit = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const tx = { transportJob: { create, update } };
    const prisma = { transportJob: { count } };
    const lifecycle = { getStateByCode };
    const audit = { create: createAudit };

    return {
      tx,
      prisma,
      lifecycle,
      audit,
      count,
      create,
      update,
      getStateByCode,
      createAudit,
    };
  }

  it('preserves creation order, transaction propagation and response', async () => {
    const test = harness();

    await expect(
      executeTransportCreate({
        prisma: test.prisma as never,
        lifecycle: test.lifecycle as never,
        audit: test.audit as never,
        tx: test.tx as never,
        dto: {
          pickupAddressSnapshot: { city: 'Berlin' },
          deliveryAddressSnapshot: { city: 'Hamburg' },
        },
        ctx,
      }),
    ).resolves.toEqual({
      transportId: 'transport-1',
      transportNumber: 'AGM-2026-0001',
      currentState: 'imported',
      auditEventId: 'audit-1',
    });

    expect(test.getStateByCode).toHaveBeenCalledWith(
      'company-1',
      'imported',
      test.tx,
    );
    expect(test.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'transport-1' }),
      ctx,
      test.tx,
    );
    expect(test.update).toHaveBeenCalledWith({
      where: { id: 'transport-1' },
      data: { auditEventId: 'audit-1' },
    });
    expect(test.getStateByCode.mock.invocationCallOrder[0]).toBeLessThan(
      test.count.mock.invocationCallOrder[0],
    );
    expect(test.count.mock.invocationCallOrder[0]).toBeLessThan(
      test.create.mock.invocationCallOrder[0],
    );
    expect(test.create.mock.invocationCallOrder[0]).toBeLessThan(
      test.createAudit.mock.invocationCallOrder[0],
    );
    expect(test.createAudit.mock.invocationCallOrder[0]).toBeLessThan(
      test.update.mock.invocationCallOrder[0],
    );
  });

  it('stops before the audit link when creation audit fails', async () => {
    const test = harness();
    test.createAudit.mockRejectedValue(new Error('creation-audit-failed'));

    await expect(
      executeTransportCreate({
        prisma: test.prisma as never,
        lifecycle: test.lifecycle as never,
        audit: test.audit as never,
        tx: test.tx as never,
        dto: {
          pickupAddressSnapshot: { city: 'Berlin' },
          deliveryAddressSnapshot: { city: 'Hamburg' },
        },
        ctx,
      }),
    ).rejects.toThrow('creation-audit-failed');

    expect(test.update).not.toHaveBeenCalled();
  });
});
