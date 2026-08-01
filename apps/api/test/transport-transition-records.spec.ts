import {
  recordTransportTransitionAudit,
  recordTransportTransitionHistory,
} from '../src/transports/transport-transition-records';

describe('transport transition records', () => {
  const ctx = {
    requestId: 'request-1',
    correlationId: 'correlation-1',
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['admin'],
  };
  const definition = {
    businessAction: 'accept',
    reason: 'Approved',
  };

  it('records the existing successful audit payload in the supplied transaction', async () => {
    const tx = {};
    const audit = {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const result = await recordTransportTransitionAudit({
      audit: audit as never,
      tx: tx as never,
      ctx,
      definition,
      transportId: 'transport-1',
      beforeSnapshot: { id: 'transport-1', currentLifecycleStateId: 'state-imported' },
      validationReportId: 'validation-1',
      hasFailedMandatoryCheck: false,
    });

    expect(result).toEqual({ id: 'audit-1' });
    expect(audit.create).toHaveBeenCalledWith(
      {
        actionCode: 'accept',
        entityType: 'TransportJob',
        entityId: 'transport-1',
        transportJobId: 'transport-1',
        reason: 'Approved',
        beforeSnapshot: {
          id: 'transport-1',
          currentLifecycleStateId: 'state-imported',
        },
        validationReportId: 'validation-1',
      },
      ctx,
      tx,
    );
  });

  it.each([
    [false, 'accept completed by authorized user.'],
    [true, 'accept validation failed.'],
  ])('preserves the default audit reason when failed=%s', async (failed, expectedReason) => {
    const audit = {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    await recordTransportTransitionAudit({
      audit: audit as never,
      tx: {} as never,
      ctx,
      definition: { businessAction: 'accept' },
      transportId: 'transport-1',
      beforeSnapshot: { id: 'transport-1' },
      validationReportId: 'validation-1',
      hasFailedMandatoryCheck: failed,
    });

    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expectedReason }),
      ctx,
      expect.anything(),
    );
  });

  it('records the existing history identity in the supplied transaction', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'history-1' });
    const tx = {
      transportJobStateHistory: { create },
    };

    const result = await recordTransportTransitionHistory({
      tx: tx as never,
      ctx,
      definition,
      transportId: 'transport-1',
      fromLifecycleStateId: 'state-imported',
      toLifecycleStateId: 'state-accepted',
      validationReportId: 'validation-1',
      auditEventId: 'audit-1',
    });

    expect(result).toEqual({ id: 'history-1' });
    expect(create).toHaveBeenCalledWith({
      data: {
        companyId: 'company-1',
        transportJobId: 'transport-1',
        fromLifecycleStateId: 'state-imported',
        toLifecycleStateId: 'state-accepted',
        businessAction: 'accept',
        transitionReason: 'Approved',
        transitionedByUserId: 'user-1',
        validationReportId: 'validation-1',
        relatedAuditEventId: 'audit-1',
      },
    });
  });
});
