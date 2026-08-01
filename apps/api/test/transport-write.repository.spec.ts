import {
  createTransportRecord,
  linkTransportAuditEvent,
  updateTransportAfterTransition,
} from '../src/transports/transport-write.repository';

describe('transport write repository', () => {
  const ctx = {
    requestId: 'request-1',
    correlationId: 'correlation-1',
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['admin'],
  };

  it('preserves the complete transport creation payload and include', async () => {
    const transport = { id: 'transport-1' };
    const create = jest.fn().mockResolvedValue(transport);

    await expect(
      createTransportRecord({
        tx: { transportJob: { create } } as never,
        dto: {
          pickupAddressSnapshot: { city: 'Berlin' },
          deliveryAddressSnapshot: { city: 'Hamburg' },
          plannedPickupFrom: '2026-08-01T08:00:00.000Z',
          plannedPickupTo: '2026-08-01T10:00:00.000Z',
          plannedDeliveryAt: '2026-08-01T16:00:00.000Z',
          paymentAmount: '950.00',
          currencyCode: 'USD',
        },
        ctx,
        transportNumber: 'AGM-2026-0003',
        initialLifecycleStateId: 'state-imported',
      }),
    ).resolves.toBe(transport);

    expect(create).toHaveBeenCalledWith({
      data: {
        companyId: 'company-1',
        transportNumber: 'AGM-2026-0003',
        currentLifecycleStateId: 'state-imported',
        pickupAddressSnapshot: { city: 'Berlin' },
        deliveryAddressSnapshot: { city: 'Hamburg' },
        plannedPickupFrom: new Date('2026-08-01T08:00:00.000Z'),
        plannedPickupTo: new Date('2026-08-01T10:00:00.000Z'),
        plannedDeliveryAt: new Date('2026-08-01T16:00:00.000Z'),
        paymentAmount: '950.00',
        currencyCode: 'USD',
        createdByUserId: 'user-1',
      },
      include: { currentLifecycleState: true },
    });
  });

  it('preserves optional values and the EUR currency default', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'transport-1' });

    await createTransportRecord({
      tx: { transportJob: { create } } as never,
      dto: {
        pickupAddressSnapshot: { city: 'Berlin' },
        deliveryAddressSnapshot: { city: 'Hamburg' },
      },
      ctx,
      transportNumber: 'AGM-2026-0001',
      initialLifecycleStateId: 'state-imported',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        plannedPickupFrom: undefined,
        plannedPickupTo: undefined,
        plannedDeliveryAt: undefined,
        paymentAmount: undefined,
        currencyCode: 'EUR',
      }),
      include: { currentLifecycleState: true },
    });
  });

  it('propagates the Prisma write failure unchanged', async () => {
    const create = jest
      .fn()
      .mockRejectedValue(new Error('transport-number-collision'));

    await expect(
      createTransportRecord({
        tx: { transportJob: { create } } as never,
        dto: {
          pickupAddressSnapshot: { city: 'Berlin' },
          deliveryAddressSnapshot: { city: 'Hamburg' },
        },
        ctx,
        transportNumber: 'AGM-2026-0001',
        initialLifecycleStateId: 'state-imported',
      }),
    ).rejects.toThrow('transport-number-collision');
  });

  it('preserves the audit-event link update', async () => {
    const updated = { id: 'transport-1', auditEventId: 'audit-1' };
    const update = jest.fn().mockResolvedValue(updated);

    await expect(
      linkTransportAuditEvent({
        tx: { transportJob: { update } } as never,
        transportId: 'transport-1',
        auditEventId: 'audit-1',
      }),
    ).resolves.toBe(updated);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'transport-1' },
      data: { auditEventId: 'audit-1' },
    });
  });

  it('propagates an audit-event link failure unchanged', async () => {
    const update = jest
      .fn()
      .mockRejectedValue(new Error('audit-link-write-failed'));

    await expect(
      linkTransportAuditEvent({
        tx: { transportJob: { update } } as never,
        transportId: 'transport-1',
        auditEventId: 'audit-1',
      }),
    ).rejects.toThrow('audit-link-write-failed');
  });

  it('preserves the complete final transition update', async () => {
    const updated = {
      id: 'transport-1',
      currentLifecycleState: { code: 'accepted' },
    };
    const update = jest.fn().mockResolvedValue(updated);

    await expect(
      updateTransportAfterTransition({
        tx: { transportJob: { update } } as never,
        transportId: 'transport-1',
        targetLifecycleStateId: 'state-accepted',
        validationReportId: 'validation-1',
        auditEventId: 'audit-1',
        updatedByUserId: 'user-1',
      }),
    ).resolves.toBe(updated);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'transport-1' },
      data: {
        currentLifecycleStateId: 'state-accepted',
        validationReportId: 'validation-1',
        auditEventId: 'audit-1',
        updatedByUserId: 'user-1',
      },
      include: { currentLifecycleState: true },
    });
  });

  it('preserves the archive mutation in the final transition update', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'transport-1' });

    await updateTransportAfterTransition({
      tx: { transportJob: { update } } as never,
      transportId: 'transport-1',
      targetLifecycleStateId: 'state-archived',
      validationReportId: 'validation-1',
      auditEventId: 'audit-1',
      updatedByUserId: 'user-1',
      updateTransport: { isArchived: true },
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'transport-1' },
      data: expect.objectContaining({ isArchived: true }),
      include: { currentLifecycleState: true },
    });
  });

  it('propagates a final transition update failure unchanged', async () => {
    const update = jest
      .fn()
      .mockRejectedValue(new Error('transition-update-failed'));

    await expect(
      updateTransportAfterTransition({
        tx: { transportJob: { update } } as never,
        transportId: 'transport-1',
        targetLifecycleStateId: 'state-accepted',
        validationReportId: 'validation-1',
        auditEventId: 'audit-1',
        updatedByUserId: 'user-1',
      }),
    ).rejects.toThrow('transition-update-failed');
  });
});
