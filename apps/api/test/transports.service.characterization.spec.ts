import { BadRequestException, NotFoundException } from '@nestjs/common';

import { TransportsService } from '../src/transports/transports.service';

describe('TransportsService characterization', () => {
  const context = {
    requestId: 'request-1',
    correlationId: 'correlation-1',
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['admin'],
  };

  function createHarness(currentLifecycleState = 'imported', archivedAt: Date | null = null) {
    const tx = {
      transportJob: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'transport-1',
          companyId: context.companyId,
          currentLifecycleStateId: 'state-imported',
          currentLifecycleState: {
            code: currentLifecycleState,
            displayName: currentLifecycleState,
          },
          isArchived: Boolean(archivedAt),
        }),
        create: jest.fn().mockResolvedValue({
          id: 'transport-created',
          transportNumber: 'AGM-2026-0001',
          currentLifecycleStateId: 'state-imported',
          currentLifecycleState: {
            code: 'imported',
            displayName: 'imported',
          },
        }),
        update: jest.fn().mockResolvedValue({
          id: 'transport-1',
          currentLifecycleState: {
            code: 'accepted',
            displayName: 'accepted',
          },
        }),
      },
      transportJobStateHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
        findMany: jest.fn().mockResolvedValue([
          { businessAction: 'complete-delivery' },
          { businessAction: 'submit-documents' },
        ]),
      },
      financialLedger: {
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
      },
      auditEvent: {
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
      transportJob: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([{ id: 'transport-1' }]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'transport-1',
          companyId: context.companyId,
        }),
      },
      financialLedger: { count: jest.fn().mockResolvedValue(0) },
    };
    const lifecycle = {
      getStateByCode: jest.fn().mockResolvedValue({ id: 'state-accepted', code: 'accepted' }),
    };
    const audit = {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    const validationReports = {
      create: jest.fn().mockResolvedValue({
        validationReportId: 'validation-1',
        overallResult: 'passed',
      }),
    };

    return {
      service: new TransportsService(
        prisma as never,
        lifecycle as never,
        audit as never,
        validationReports as never,
      ),
      prisma,
      lifecycle,
      audit,
      validationReports,
      tx,
    };
  }

  it('preserves the accepted transition transaction boundary and audit trail', async () => {
    const harness = createHarness();

    const result = await harness.service.accept('transport-1', {}, context);

    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(harness.lifecycle.getStateByCode).toHaveBeenCalled();
    expect(harness.validationReports.create).toHaveBeenCalled();
    expect(harness.audit.create).toHaveBeenCalled();
    expect(harness.tx.transportJobStateHistory.create).toHaveBeenCalled();
    expect(harness.tx.transportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'transport-1' },
        data: expect.objectContaining({ currentLifecycleStateId: 'state-accepted' }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        transportId: 'transport-1',
        currentState: 'accepted',
      }),
    );
  });

  it('rejects an invalid accept transition before state mutation', async () => {
    const harness = createHarness('accepted');
    harness.validationReports.create.mockResolvedValue({
      validationReportId: 'validation-invalid',
      overallResult: 'failed',
    });

    await expect(harness.service.accept('transport-1', {}, context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(harness.tx.transportJobStateHistory.create).not.toHaveBeenCalled();
    expect(harness.tx.transportJob.update).not.toHaveBeenCalled();
  });

  it('rejects archived transports before state mutation', async () => {
    const harness = createHarness('imported', new Date('2026-07-28T00:00:00.000Z'));

    await expect(harness.service.accept('transport-1', {}, context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(harness.tx.transportJobStateHistory.create).not.toHaveBeenCalled();
    expect(harness.tx.transportJob.update).not.toHaveBeenCalled();
  });

  const lifecycleMatrix = [
    ['accept', 'imported', 'accepted', 'accept'],
    ['arrivePickup', 'accepted', 'at_pickup', 'arrive-pickup'],
    ['completePickup', 'at_pickup', 'pickup_completed', 'complete-pickup'],
    ['startMission', 'pickup_completed', 'in_transport', 'start-mission'],
    ['arriveDelivery', 'in_transport', 'at_delivery', 'arrive-delivery'],
    ['completeDelivery', 'at_delivery', 'delivery_completed', 'complete-delivery'],
    ['submitDocuments', 'delivery_completed', 'documents_submitted', 'submit-documents'],
    ['closeTransport', 'paid', 'closed', 'close-transport'],
    ['archiveTransport', 'closed', 'archived', 'archive-transport'],
  ] as const;

  it.each(lifecycleMatrix)(
    'characterizes %s from %s to %s',
    async (method, fromState, toState, businessAction) => {
      const harness = createHarness(fromState);
      harness.lifecycle.getStateByCode.mockResolvedValue({ id: `state-${toState}`, code: toState });
      harness.tx.transportJob.update.mockResolvedValue({
        id: 'transport-1',
        currentLifecycleState: { code: toState, displayName: toState },
      });

      const result = await harness.service[method]('transport-1', {}, context);

      expect(result).toEqual(expect.objectContaining({
        transportId: 'transport-1',
        previousState: fromState,
        currentState: toState,
        stateHistoryId: 'history-1',
        auditEventId: 'audit-1',
      }));
      expect(harness.tx.transportJobStateHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ businessAction }),
      });
      if (method === 'archiveTransport') {
        expect(harness.tx.transportJob.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ isArchived: true }) }),
        );
      }
    },
  );

  it('characterizes payment ledger identity and audit references', async () => {
    const harness = createHarness('documents_submitted');
    harness.lifecycle.getStateByCode.mockResolvedValue({ id: 'state-paid', code: 'paid' });
    harness.tx.transportJob.update.mockResolvedValue({
      id: 'transport-1',
      currentLifecycleState: { code: 'paid', displayName: 'paid' },
    });

    const result = await harness.service.registerPayment(
      'transport-1',
      { amount: '125', currencyCode: 'EUR', description: 'Paid' },
      context,
    );

    expect(result).toEqual(expect.objectContaining({
      currentState: 'paid',
      financialLedgerEntryId: 'ledger-1',
      ledgerNumber: expect.stringMatching(/^AGM-FIN-\d{4}-0001$/),
    }));
    expect(harness.tx.financialLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transportJobId: 'transport-1',
        validationReportId: 'validation-1',
        auditEventId: 'audit-1',
      }),
    });
  });

  it('characterizes tenant-scoped transport listing and ordering', async () => {
    const harness = createHarness();
    const transports = [
      { id: 'transport-2', companyId: context.companyId },
      { id: 'transport-1', companyId: context.companyId },
    ];
    harness.prisma.transportJob.findMany.mockResolvedValue(transports);

    await expect(harness.service.list(context)).resolves.toBe(transports);
    expect(harness.prisma.transportJob.findMany).toHaveBeenCalledWith({
      where: { companyId: context.companyId },
      orderBy: { createdAt: 'desc' },
      include: { currentLifecycleState: true },
    });
  });

  it('characterizes tenant-scoped transport detail relations', async () => {
    const harness = createHarness();
    const transport = {
      id: 'transport-1',
      companyId: context.companyId,
      currentLifecycleState: { code: 'accepted' },
    };
    harness.prisma.transportJob.findFirst.mockResolvedValue(transport);

    await expect(harness.service.get('transport-1', context)).resolves.toBe(transport);
    expect(harness.prisma.transportJob.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'transport-1',
        companyId: context.companyId,
      },
      include: {
        currentLifecycleState: true,
        stateHistory: { orderBy: { transitionedAt: 'asc' } },
        validationReports: { orderBy: { createdAt: 'asc' } },
        auditEvents: { orderBy: { occurredAt: 'asc' } },
        financialLedger: { orderBy: { occurredAt: 'asc' } },
      },
    });
  });

  it('preserves NotFound for a missing tenant-scoped transport detail', async () => {
    const harness = createHarness();
    harness.prisma.transportJob.findFirst.mockResolvedValue(null);

    await expect(harness.service.get('missing', context)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('characterizes transport creation payload, audit identity and follow-up update', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T10:15:00.000Z'));
    const harness = createHarness();
    harness.prisma.transportJob.count.mockResolvedValue(2);
    harness.tx.transportJob.create.mockResolvedValue({
      id: 'transport-created',
      transportNumber: 'AGM-2026-0003',
      currentLifecycleStateId: 'state-accepted',
      currentLifecycleState: {
        code: 'imported',
        displayName: 'imported',
      },
    });

    try {
      const result = await harness.service.create(
        {
          pickupAddressSnapshot: { city: 'Berlin' },
          deliveryAddressSnapshot: { city: 'Hamburg' },
          plannedPickupFrom: '2026-08-01T08:00:00.000Z',
          plannedPickupTo: '2026-08-01T10:00:00.000Z',
          plannedDeliveryAt: '2026-08-01T16:00:00.000Z',
          paymentAmount: '950.00',
        },
        context,
      );

      expect(harness.lifecycle.getStateByCode).toHaveBeenCalledWith(
        context.companyId,
        'imported',
        harness.tx,
      );
      expect(harness.tx.transportJob.create).toHaveBeenCalledWith({
        data: {
          companyId: context.companyId,
          transportNumber: 'AGM-2026-0003',
          currentLifecycleStateId: 'state-accepted',
          pickupAddressSnapshot: { city: 'Berlin' },
          deliveryAddressSnapshot: { city: 'Hamburg' },
          plannedPickupFrom: new Date('2026-08-01T08:00:00.000Z'),
          plannedPickupTo: new Date('2026-08-01T10:00:00.000Z'),
          plannedDeliveryAt: new Date('2026-08-01T16:00:00.000Z'),
          paymentAmount: '950.00',
          currencyCode: 'EUR',
          createdByUserId: context.userId,
        },
        include: { currentLifecycleState: true },
      });
      expect(harness.audit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actionCode: 'create-transport',
          entityType: 'TransportJob',
          entityId: 'transport-created',
          transportJobId: 'transport-created',
          reason: 'Transport created through business action API.',
          afterSnapshot: expect.objectContaining({
            id: 'transport-created',
            transportNumber: 'AGM-2026-0003',
          }),
        }),
        context,
        harness.tx,
      );
      expect(harness.tx.transportJob.update).toHaveBeenCalledWith({
        where: { id: 'transport-created' },
        data: { auditEventId: 'audit-1' },
      });
      expect(result).toEqual({
        transportId: 'transport-created',
        transportNumber: 'AGM-2026-0003',
        currentState: 'imported',
        auditEventId: 'audit-1',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('characterizes the shared company-scoped transport and ledger numbering formats', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T10:15:00.000Z'));
    const createHarnessInstance = createHarness();
    createHarnessInstance.prisma.transportJob.count.mockResolvedValue(41);
    createHarnessInstance.tx.transportJob.create.mockResolvedValue({
      id: 'transport-created',
      transportNumber: 'AGM-2026-0042',
      currentLifecycleStateId: 'state-imported',
      currentLifecycleState: {
        code: 'imported',
        displayName: 'imported',
      },
    });
    const paymentHarness = createHarness('documents_submitted');
    paymentHarness.prisma.financialLedger.count.mockResolvedValue(41);
    paymentHarness.lifecycle.getStateByCode.mockResolvedValue({
      id: 'state-paid',
      code: 'paid',
    });
    paymentHarness.tx.transportJob.update.mockResolvedValue({
      id: 'transport-1',
      currentLifecycleState: { code: 'paid', displayName: 'paid' },
    });

    try {
      const created = await createHarnessInstance.service.create(
        {
          pickupAddressSnapshot: { city: 'Berlin' },
          deliveryAddressSnapshot: { city: 'Hamburg' },
        },
        context,
      );
      const paid = await paymentHarness.service.registerPayment(
        'transport-1',
        { amount: '125', currencyCode: 'EUR' },
        context,
      );

      expect(createHarnessInstance.prisma.transportJob.count).toHaveBeenCalledWith({
        where: { companyId: context.companyId },
      });
      expect(paymentHarness.prisma.financialLedger.count).toHaveBeenCalledWith({
        where: { companyId: context.companyId },
      });
      expect(createHarnessInstance.tx.transportJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ transportNumber: 'AGM-2026-0042' }),
        }),
      );
      expect(created.transportNumber).toBe('AGM-2026-0042');
      expect(paid).toEqual(
        expect.objectContaining({ ledgerNumber: 'AGM-FIN-2026-0042' }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('propagates transport numbering failure before transport creation', async () => {
    const harness = createHarness();
    harness.prisma.transportJob.count.mockRejectedValue(new Error('transport-count-failed'));

    await expect(
      harness.service.create(
        {
          pickupAddressSnapshot: { city: 'Berlin' },
          deliveryAddressSnapshot: { city: 'Hamburg' },
        },
        context,
      ),
    ).rejects.toThrow('transport-count-failed');

    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(harness.tx.transportJob.create).not.toHaveBeenCalled();
    expect(harness.audit.create).not.toHaveBeenCalled();
  });

  it('propagates a transport-number collision before audit and follow-up update', async () => {
    const harness = createHarness();
    harness.tx.transportJob.create.mockRejectedValue(new Error('transport-number-collision'));

    await expect(
      harness.service.create(
        {
          pickupAddressSnapshot: { city: 'Berlin' },
          deliveryAddressSnapshot: { city: 'Hamburg' },
        },
        context,
      ),
    ).rejects.toThrow('transport-number-collision');

    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(harness.audit.create).not.toHaveBeenCalled();
    expect(harness.tx.transportJob.update).not.toHaveBeenCalled();
  });

  it('characterizes company-scoped ledger numbering and the complete payment payload', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T10:15:00.000Z'));
    const harness = createHarness('documents_submitted');
    harness.prisma.financialLedger.count.mockResolvedValue(41);
    harness.lifecycle.getStateByCode.mockResolvedValue({ id: 'state-paid', code: 'paid' });
    harness.tx.transportJob.update.mockResolvedValue({
      id: 'transport-1',
      currentLifecycleState: { code: 'paid', displayName: 'paid' },
    });

    try {
      const result = await harness.service.registerPayment(
        'transport-1',
        {
          amount: '125.50',
          currencyCode: 'EUR',
          occurredAt: '2026-07-20T08:30:00.000Z',
          description: 'Invoice settled',
        },
        context,
      );

      expect(harness.prisma.financialLedger.count).toHaveBeenCalledWith({
        where: { companyId: context.companyId },
      });
      expect(harness.tx.financialLedger.create).toHaveBeenCalledWith({
        data: {
          companyId: context.companyId,
          transportJobId: 'transport-1',
          ledgerNumber: 'AGM-FIN-2026-0042',
          entryType: 'payment',
          amount: '125.50',
          currencyCode: 'EUR',
          occurredAt: new Date('2026-07-20T08:30:00.000Z'),
          recordedByUserId: context.userId,
          description: 'Invoice settled',
          validationReportId: 'validation-1',
          auditEventId: 'audit-1',
        },
      });
      expect(result).toEqual(
        expect.objectContaining({
          financialLedgerEntryId: 'ledger-1',
          ledgerNumber: 'AGM-FIN-2026-0042',
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses the existing payment defaults for timestamp and description', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T10:15:00.000Z'));
    const harness = createHarness('documents_submitted');
    harness.lifecycle.getStateByCode.mockResolvedValue({ id: 'state-paid', code: 'paid' });
    harness.tx.transportJob.update.mockResolvedValue({
      id: 'transport-1',
      currentLifecycleState: { code: 'paid', displayName: 'paid' },
    });

    try {
      await harness.service.registerPayment(
        'transport-1',
        { amount: '125', currencyCode: 'EUR' },
        context,
      );

      expect(harness.tx.financialLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          occurredAt: new Date('2026-07-29T10:15:00.000Z'),
          description: 'Payment registered.',
        }),
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it.each(['0', '-1'])(
    'rejects non-positive payment amount %s before history, ledger and state mutation',
    async (amount) => {
      const harness = createHarness('documents_submitted');

      await expect(
        harness.service.registerPayment(
          'transport-1',
          { amount, currencyCode: 'EUR' },
          context,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(harness.validationReports.create).toHaveBeenCalledWith(
        expect.objectContaining({
          overallResult: 'failed',
          executedChecks: expect.arrayContaining([
            expect.objectContaining({
              code: 'PAYMENT_AMOUNT_POSITIVE',
              status: 'failed',
              message: 'Payment amount must be greater than zero.',
            }),
          ]),
        }),
        context,
        harness.tx,
      );
      expect(harness.tx.transportJobStateHistory.create).not.toHaveBeenCalled();
      expect(harness.tx.financialLedger.create).not.toHaveBeenCalled();
      expect(harness.tx.transportJob.update).not.toHaveBeenCalled();
    },
  );

  it('propagates ledger numbering failure inside the transition boundary', async () => {
    const harness = createHarness('documents_submitted');
    harness.prisma.financialLedger.count.mockRejectedValue(new Error('ledger-count-failed'));

    await expect(
      harness.service.registerPayment(
        'transport-1',
        { amount: '125', currencyCode: 'EUR' },
        context,
      ),
    ).rejects.toThrow('ledger-count-failed');

    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(harness.tx.transportJobStateHistory.create).toHaveBeenCalledTimes(1);
    expect(harness.tx.financialLedger.create).not.toHaveBeenCalled();
    expect(harness.tx.transportJob.update).not.toHaveBeenCalled();
  });

  it('propagates a ledger-number collision before transport state mutation', async () => {
    const harness = createHarness('documents_submitted');
    harness.tx.financialLedger.create.mockRejectedValue(new Error('ledger-number-collision'));

    await expect(
      harness.service.registerPayment(
        'transport-1',
        { amount: '125', currencyCode: 'EUR' },
        context,
      ),
    ).rejects.toThrow('ledger-number-collision');

    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(harness.tx.transportJobStateHistory.create).toHaveBeenCalledTimes(1);
    expect(harness.tx.financialLedger.create).toHaveBeenCalledTimes(1);
    expect(harness.tx.transportJob.update).not.toHaveBeenCalled();
  });

  it('preserves the structured validation error payload', async () => {
    const harness = createHarness('accepted');
    harness.validationReports.create.mockResolvedValue({
      validationReportId: 'validation-failed',
      overallResult: 'failed',
    });

    const error = await harness.service.accept('transport-1', {}, context).catch((caught) => caught);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual(expect.objectContaining({
      code: 'ACCEPT_TRANSPORT_VALIDATION_FAILED',
      auditEventId: 'audit-1',
      validationReport: expect.objectContaining({ validationReportId: 'validation-failed' }),
    }));
  });

  it('rejects a missing transport without history or state mutation', async () => {
    const harness = createHarness();
    harness.tx.transportJob.findFirst.mockResolvedValue(null);
    await expect(harness.service.accept('missing', {}, context)).rejects.toBeInstanceOf(NotFoundException);
    expect(harness.tx.transportJobStateHistory.create).not.toHaveBeenCalled();
    expect(harness.tx.transportJob.update).not.toHaveBeenCalled();
  });

  it('propagates a transactional history failure before transport mutation', async () => {
    const harness = createHarness();
    harness.tx.transportJobStateHistory.create.mockRejectedValue(new Error('history-write-failed'));
    await expect(harness.service.accept('transport-1', {}, context)).rejects.toThrow('history-write-failed');
    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(harness.tx.transportJob.update).not.toHaveBeenCalled();
  });

  it('does not apply the same lifecycle transition twice', async () => {
    const harness = createHarness();
    harness.tx.transportJob.findFirst
      .mockResolvedValueOnce(await harness.tx.transportJob.findFirst())
      .mockResolvedValueOnce({
        id: 'transport-1',
        companyId: context.companyId,
        currentLifecycleStateId: 'state-accepted',
        currentLifecycleState: { code: 'accepted', displayName: 'accepted' },
        isArchived: false,
      });

    await harness.service.accept('transport-1', {}, context);
    await expect(harness.service.accept('transport-1', {}, context)).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.tx.transportJobStateHistory.create).toHaveBeenCalledTimes(1);
    expect(harness.tx.transportJob.update).toHaveBeenCalledTimes(1);
  });
});
