import {
  nextLedgerNumber,
  nextTransportNumber,
} from '../src/transports/transport-numbering';

describe('transport numbering', () => {
  it('preserves company-scoped count + 1 transport numbering', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T10:15:00.000Z'));
    const count = jest.fn().mockResolvedValue(41);
    const prisma = {
      transportJob: { count },
    };

    try {
      await expect(
        nextTransportNumber(prisma as never, 'company-1'),
      ).resolves.toBe('AGM-2026-0042');
      expect(count).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves company-scoped count + 1 ledger numbering', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T10:15:00.000Z'));
    const count = jest.fn().mockResolvedValue(41);
    const prisma = {
      financialLedger: { count },
    };

    try {
      await expect(
        nextLedgerNumber(prisma as never, 'company-1'),
      ).resolves.toBe('AGM-FIN-2026-0042');
      expect(count).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    ['transport', nextTransportNumber, { transportJob: { count: jest.fn() } }],
    ['ledger', nextLedgerNumber, { financialLedger: { count: jest.fn() } }],
  ])('propagates %s count failure', async (_name, generate, prisma) => {
    const count =
      'transportJob' in prisma
        ? prisma.transportJob.count
        : prisma.financialLedger.count;
    count.mockRejectedValue(new Error('count-failed'));

    await expect(generate(prisma as never, 'company-1')).rejects.toThrow(
      'count-failed',
    );
  });
});
