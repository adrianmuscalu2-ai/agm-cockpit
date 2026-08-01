import { buildCloseTransportChecks } from '../src/transports/transport-close-checks';

describe('transport close checks', () => {
  function harness(options: {
    actions?: string[];
    ledgerCount?: number;
    auditCount?: number;
  } = {}) {
    const findMany = jest.fn().mockResolvedValue(
      (options.actions ?? [
        'complete-delivery',
        'submit-documents',
      ]).map((businessAction) => ({ businessAction })),
    );
    const ledgerCount = jest.fn().mockResolvedValue(options.ledgerCount ?? 1);
    const auditCount = jest.fn().mockResolvedValue(options.auditCount ?? 1);
    const tx = {
      transportJobStateHistory: { findMany },
      financialLedger: { count: ledgerCount },
      auditEvent: { count: auditCount },
    };

    return { tx, findMany, ledgerCount, auditCount };
  }

  it('preserves successful close checks and transactional queries', async () => {
    const test = harness();

    const checks = await buildCloseTransportChecks(
      test.tx as never,
      'transport-1',
    );

    expect(test.findMany).toHaveBeenCalledWith({
      where: { transportJobId: 'transport-1' },
      select: { businessAction: true },
    });
    expect(test.ledgerCount).toHaveBeenCalledWith({
      where: { transportJobId: 'transport-1', entryType: 'payment' },
    });
    expect(test.auditCount).toHaveBeenCalledWith({
      where: { transportJobId: 'transport-1' },
    });
    expect(checks.map(({ code, status }) => [code, status])).toEqual([
      ['DELIVERY_INSPECTION_COMPLETED', 'passed'],
      ['REQUIRED_DOCUMENTS_SUBMITTED', 'passed'],
      ['MANDATORY_EVIDENCE_PRESENT', 'not_applicable'],
      ['NO_UNRESOLVED_INCIDENTS', 'not_applicable'],
      ['FINANCIAL_LEDGER_RECONCILED', 'passed'],
      ['REQUIRED_AUDIT_RECORDS_CREATED', 'passed'],
      ['AI_RECOMMENDATIONS_REVIEWED', 'not_applicable'],
      ['HUMAN_APPROVALS_COMPLETED', 'not_applicable'],
    ]);
    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'mandatory',
          durationMs: 1,
          executedAt: expect.any(String),
        }),
      ]),
    );
  });

  it('preserves missing prerequisite failures and messages', async () => {
    const test = harness({ actions: [], ledgerCount: 0, auditCount: 0 });

    const checks = await buildCloseTransportChecks(
      test.tx as never,
      'transport-1',
    );

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DELIVERY_INSPECTION_COMPLETED',
          status: 'failed',
          message: 'Delivery inspection is missing.',
        }),
        expect.objectContaining({
          code: 'REQUIRED_DOCUMENTS_SUBMITTED',
          status: 'failed',
          message: 'Required documents are not submitted.',
        }),
        expect.objectContaining({
          code: 'FINANCIAL_LEDGER_RECONCILED',
          status: 'failed',
          message: 'Payment ledger entry is missing.',
        }),
        expect.objectContaining({
          code: 'REQUIRED_AUDIT_RECORDS_CREATED',
          status: 'failed',
          message: 'Audit records are missing.',
        }),
      ]),
    );
  });

  it('propagates a transactional prerequisite read failure unchanged', async () => {
    const test = harness();
    test.ledgerCount.mockRejectedValue(new Error('ledger-count-failed'));

    await expect(
      buildCloseTransportChecks(test.tx as never, 'transport-1'),
    ).rejects.toThrow('ledger-count-failed');

    expect(test.auditCount).not.toHaveBeenCalled();
  });
});
