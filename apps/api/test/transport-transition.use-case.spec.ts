import { NotFoundException } from '@nestjs/common';

import { executeTransportTransition } from '../src/transports/transport-transition.use-case';
import { getTransportTransitionPolicy } from '../src/transports/transport-transition.policy';

describe('transport transition use case', () => {
  const ctx = {
    requestId: 'request-1',
    correlationId: 'correlation-1',
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['admin'],
  };

  function harness(state = 'imported') {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'transport-1',
      transportNumber: 'AGM-2026-0001',
      currentLifecycleStateId: `state-${state}`,
      currentLifecycleState: { code: state, displayName: state },
      isArchived: false,
    });
    const update = jest.fn().mockResolvedValue({
      id: 'transport-1',
      currentLifecycleState: {
        code: 'accepted',
        displayName: 'accepted',
      },
    });
    const createHistory = jest.fn().mockResolvedValue({ id: 'history-1' });
    const createValidation = jest.fn().mockResolvedValue({
      validationReportId: 'validation-1',
      overallResult: 'passed',
    });
    const createAudit = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const getStateByCode = jest
      .fn()
      .mockResolvedValue({ id: 'state-accepted', code: 'accepted' });
    const tx = {
      transportJob: { findFirst, update },
      transportJobStateHistory: { create: createHistory },
    };

    return {
      tx,
      findFirst,
      update,
      createHistory,
      createValidation,
      createAudit,
      getStateByCode,
      lifecycle: { getStateByCode },
      audit: { create: createAudit },
      validationReports: { create: createValidation },
    };
  }

  it('preserves the successful transition order and result', async () => {
    const test = harness();

    await expect(
      executeTransportTransition({
        lifecycle: test.lifecycle as never,
        audit: test.audit as never,
        validationReports: test.validationReports as never,
        tx: test.tx as never,
        id: 'transport-1',
        ctx,
        definition: getTransportTransitionPolicy('accept'),
      }),
    ).resolves.toEqual({
      ok: true,
      transportId: 'transport-1',
      previousState: 'imported',
      currentState: 'accepted',
      validationReport: {
        validationReportId: 'validation-1',
        overallResult: 'passed',
      },
      stateHistoryId: 'history-1',
      auditEventId: 'audit-1',
    });

    expect(test.findFirst).toHaveBeenCalledWith({
      where: { id: 'transport-1', companyId: 'company-1' },
      include: { currentLifecycleState: true },
    });
    expect(test.createValidation.mock.invocationCallOrder[0]).toBeLessThan(
      test.createAudit.mock.invocationCallOrder[0],
    );
    expect(test.createAudit.mock.invocationCallOrder[0]).toBeLessThan(
      test.getStateByCode.mock.invocationCallOrder[0],
    );
    expect(test.getStateByCode.mock.invocationCallOrder[0]).toBeLessThan(
      test.createHistory.mock.invocationCallOrder[0],
    );
    expect(test.createHistory.mock.invocationCallOrder[0]).toBeLessThan(
      test.update.mock.invocationCallOrder[0],
    );
  });

  it('returns the failed validation result before history and update', async () => {
    const test = harness('accepted');
    test.createValidation.mockResolvedValue({
      validationReportId: 'validation-failed',
      overallResult: 'failed',
    });

    await expect(
      executeTransportTransition({
        lifecycle: test.lifecycle as never,
        audit: test.audit as never,
        validationReports: test.validationReports as never,
        tx: test.tx as never,
        id: 'transport-1',
        ctx,
        definition: getTransportTransitionPolicy('accept'),
      }),
    ).resolves.toEqual({
      ok: false,
      validationReport: {
        validationReportId: 'validation-failed',
        overallResult: 'failed',
      },
      auditEventId: 'audit-1',
    });

    expect(test.getStateByCode).not.toHaveBeenCalled();
    expect(test.createHistory).not.toHaveBeenCalled();
    expect(test.update).not.toHaveBeenCalled();
  });

  it('preserves NotFound before validation and mutation', async () => {
    const test = harness();
    test.findFirst.mockResolvedValue(null);

    await expect(
      executeTransportTransition({
        lifecycle: test.lifecycle as never,
        audit: test.audit as never,
        validationReports: test.validationReports as never,
        tx: test.tx as never,
        id: 'missing',
        ctx,
        definition: getTransportTransitionPolicy('accept'),
      }),
    ).rejects.toEqual(new NotFoundException('Transport not found.'));

    expect(test.createValidation).not.toHaveBeenCalled();
    expect(test.createAudit).not.toHaveBeenCalled();
    expect(test.update).not.toHaveBeenCalled();
  });
});
