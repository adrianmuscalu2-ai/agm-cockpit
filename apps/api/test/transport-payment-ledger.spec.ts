import { recordTransportPayment } from '../src/transports/transport-payment-ledger';

describe('transport payment ledger', () => {
  const ctx = {
    requestId: 'request-1',
    correlationId: 'correlation-1',
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['admin'],
  };

  it('writes the characterized payment payload using the supplied transaction', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'ledger-1' });
    const tx = { financialLedger: { create } };

    const result = await recordTransportPayment({
      tx: tx as never,
      ctx,
      dto: {
        amount: '125.50',
        currencyCode: 'EUR',
        occurredAt: '2026-07-20T08:30:00.000Z',
        description: 'Invoice settled',
      },
      transportId: 'transport-1',
      ledgerNumber: 'AGM-FIN-2026-0042',
      validationReportId: 'validation-1',
      auditEventId: 'audit-1',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        companyId: 'company-1',
        transportJobId: 'transport-1',
        ledgerNumber: 'AGM-FIN-2026-0042',
        entryType: 'payment',
        amount: '125.50',
        currencyCode: 'EUR',
        occurredAt: new Date('2026-07-20T08:30:00.000Z'),
        recordedByUserId: 'user-1',
        description: 'Invoice settled',
        validationReportId: 'validation-1',
        auditEventId: 'audit-1',
      },
    });
    expect(result).toEqual({
      financialLedgerEntryId: 'ledger-1',
      ledgerNumber: 'AGM-FIN-2026-0042',
    });
  });

  it('preserves timestamp and description defaults', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T10:15:00.000Z'));
    const create = jest.fn().mockResolvedValue({ id: 'ledger-1' });

    try {
      await recordTransportPayment({
        tx: { financialLedger: { create } } as never,
        ctx,
        dto: { amount: '125', currencyCode: 'EUR' },
        transportId: 'transport-1',
        ledgerNumber: 'AGM-FIN-2026-0001',
        validationReportId: 'validation-1',
        auditEventId: 'audit-1',
      });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          occurredAt: new Date('2026-07-29T10:15:00.000Z'),
          description: 'Payment registered.',
        }),
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('propagates ledger write failure to the owning transaction', async () => {
    const create = jest.fn().mockRejectedValue(new Error('ledger-number-collision'));

    await expect(
      recordTransportPayment({
        tx: { financialLedger: { create } } as never,
        ctx,
        dto: { amount: '125', currencyCode: 'EUR' },
        transportId: 'transport-1',
        ledgerNumber: 'AGM-FIN-2026-0001',
        validationReportId: 'validation-1',
        auditEventId: 'audit-1',
      }),
    ).rejects.toThrow('ledger-number-collision');
  });
});
