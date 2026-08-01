import { buildTransportTransitionChecks } from '../src/transports/transport-transition-checks';
import { getTransportTransitionPolicy } from '../src/transports/transport-transition.policy';

describe('transport transition checks', () => {
  function transport(state: string, isArchived = false) {
    return {
      id: 'transport-1',
      isArchived,
      currentLifecycleState: {
        code: state,
        displayName: state,
      },
    };
  }

  it('builds the existing successful mandatory checks', () => {
    const checks = buildTransportTransitionChecks(
      transport('imported'),
      getTransportTransitionPolicy('accept'),
    );

    expect(checks).toEqual([
      expect.objectContaining({
        code: 'TRANSPORT_NOT_ARCHIVED',
        severity: 'mandatory',
        status: 'passed',
        message: 'Transport is not archived.',
      }),
      expect.objectContaining({
        code: 'CURRENT_STATE_ALLOWED',
        severity: 'mandatory',
        status: 'passed',
        message: 'Current state imported is valid for accept.',
        details: {
          expectedStates: ['imported'],
          actualState: 'imported',
        },
      }),
      expect.objectContaining({
        code: 'TRANSPORT_CAN_BE_ACCEPTED',
        severity: 'mandatory',
        status: 'passed',
        message: 'Transport can be accepted by the authorized user.',
        relatedEntityType: 'TransportJob',
        relatedEntityId: 'transport-1',
      }),
    ]);
  });

  it('preserves invalid-state failure and omits the success check', () => {
    const checks = buildTransportTransitionChecks(
      transport('accepted'),
      getTransportTransitionPolicy('accept'),
    );

    expect(checks.map((check) => [check.code, check.status])).toEqual([
      ['TRANSPORT_NOT_ARCHIVED', 'passed'],
      ['CURRENT_STATE_ALLOWED', 'failed'],
    ]);
    expect(checks[1]).toEqual(
      expect.objectContaining({
        message: 'Current state accepted is not valid for accept.',
        details: {
          expectedStates: ['imported'],
          actualState: 'accepted',
        },
      }),
    );
  });

  it('preserves archived failure and omits the success check', () => {
    const checks = buildTransportTransitionChecks(
      transport('imported', true),
      getTransportTransitionPolicy('accept'),
    );

    expect(checks.map((check) => [check.code, check.status])).toEqual([
      ['TRANSPORT_NOT_ARCHIVED', 'failed'],
      ['CURRENT_STATE_ALLOWED', 'passed'],
    ]);
    expect(checks[0].message).toBe('Archived transports cannot be changed.');
  });
});
