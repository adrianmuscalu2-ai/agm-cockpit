import {
  getTransportTransitionPolicy,
  TRANSPORT_TRANSITION_POLICIES,
} from '../src/transports/transport-transition.policy';

describe('transport transition policy', () => {
  it('declares exactly the ten lifecycle commands', () => {
    expect(Object.keys(TRANSPORT_TRANSITION_POLICIES)).toEqual([
      'accept',
      'arrivePickup',
      'completePickup',
      'startMission',
      'arriveDelivery',
      'completeDelivery',
      'submitDocuments',
      'registerPayment',
      'closeTransport',
      'archiveTransport',
    ]);
  });

  it('preserves the canonical lifecycle chain', () => {
    expect(
      Object.values(TRANSPORT_TRANSITION_POLICIES).map((policy) => [
        policy.fromStateCodes[0],
        policy.toStateCode,
        policy.businessAction,
      ]),
    ).toEqual([
      ['imported', 'accepted', 'accept'],
      ['accepted', 'at_pickup', 'arrive-pickup'],
      ['at_pickup', 'pickup_completed', 'complete-pickup'],
      ['pickup_completed', 'in_transport', 'start-mission'],
      ['in_transport', 'at_delivery', 'arrive-delivery'],
      ['at_delivery', 'delivery_completed', 'complete-delivery'],
      ['delivery_completed', 'documents_submitted', 'submit-documents'],
      ['documents_submitted', 'paid', 'register-payment'],
      ['paid', 'closed', 'close-transport'],
      ['closed', 'archived', 'archive-transport'],
    ]);
  });

  it('returns the existing error contract for a command', () => {
    expect(getTransportTransitionPolicy('registerPayment')).toEqual(
      expect.objectContaining({
        validationType: 'RegisterPayment',
        failureErrorCode: 'REGISTER_PAYMENT_VALIDATION_FAILED',
        failureMessage: 'Payment cannot be registered because mandatory validations failed.',
      }),
    );
  });
});
