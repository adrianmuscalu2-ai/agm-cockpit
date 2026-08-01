import { NotFoundException } from '@nestjs/common';

import {
  getTransport,
  getTransportForTransition,
  listTransports,
} from '../src/transports/transport-read.repository';

describe('transport read repository', () => {
  const ctx = {
    requestId: 'request-1',
    correlationId: 'correlation-1',
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['admin'],
  };

  it('preserves tenant-scoped list ordering and lifecycle include', async () => {
    const transports = [{ id: 'transport-2' }, { id: 'transport-1' }];
    const findMany = jest.fn().mockResolvedValue(transports);

    await expect(
      listTransports({ transportJob: { findMany } } as never, ctx),
    ).resolves.toBe(transports);
    expect(findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1' },
      orderBy: { createdAt: 'desc' },
      include: { currentLifecycleState: true },
    });
  });

  it('preserves tenant-scoped detail relations and ordering', async () => {
    const transport = { id: 'transport-1', companyId: 'company-1' };
    const findFirst = jest.fn().mockResolvedValue(transport);

    await expect(
      getTransport(
        { transportJob: { findFirst } } as never,
        'transport-1',
        ctx,
      ),
    ).resolves.toBe(transport);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'transport-1',
        companyId: 'company-1',
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

  it('preserves NotFound for missing tenant-scoped detail', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      getTransport(
        { transportJob: { findFirst } } as never,
        'missing',
        ctx,
      ),
    ).rejects.toEqual(new NotFoundException('Transport not found.'));
  });

  it('preserves the tenant-scoped transactional transition read', async () => {
    const transport = {
      id: 'transport-1',
      currentLifecycleState: { code: 'imported' },
    };
    const findFirst = jest.fn().mockResolvedValue(transport);

    await expect(
      getTransportForTransition(
        { transportJob: { findFirst } } as never,
        'transport-1',
        ctx,
      ),
    ).resolves.toBe(transport);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'transport-1',
        companyId: 'company-1',
      },
      include: { currentLifecycleState: true },
    });
  });

  it('returns null for a missing transactional transition read', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      getTransportForTransition(
        { transportJob: { findFirst } } as never,
        'missing',
        ctx,
      ),
    ).resolves.toBeNull();
  });

  it('propagates a transactional transition read failure unchanged', async () => {
    const findFirst = jest
      .fn()
      .mockRejectedValue(new Error('transition-read-failed'));

    await expect(
      getTransportForTransition(
        { transportJob: { findFirst } } as never,
        'transport-1',
        ctx,
      ),
    ).rejects.toThrow('transition-read-failed');
  });
});
