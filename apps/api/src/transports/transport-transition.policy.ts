export interface TransportTransitionPolicy {
  businessAction: string;
  validationType: string;
  fromStateCodes: readonly string[];
  toStateCode: string;
  successCheckCode: string;
  successMessage: string;
  failureErrorCode: string;
  failureMessage: string;
}

export type TransportTransitionCommand =
  | 'accept'
  | 'arrivePickup'
  | 'completePickup'
  | 'startMission'
  | 'arriveDelivery'
  | 'completeDelivery'
  | 'submitDocuments'
  | 'registerPayment'
  | 'closeTransport'
  | 'archiveTransport';

export const TRANSPORT_TRANSITION_POLICIES = {
  accept: {
    businessAction: 'accept',
    validationType: 'AcceptTransport',
    fromStateCodes: ['imported'],
    toStateCode: 'accepted',
    successCheckCode: 'TRANSPORT_CAN_BE_ACCEPTED',
    successMessage: 'Transport can be accepted by the authorized user.',
    failureErrorCode: 'ACCEPT_TRANSPORT_VALIDATION_FAILED',
    failureMessage: 'Transport cannot be accepted because mandatory validations failed.',
  },
  arrivePickup: {
    businessAction: 'arrive-pickup',
    validationType: 'ArrivePickup',
    fromStateCodes: ['accepted'],
    toStateCode: 'at_pickup',
    successCheckCode: 'TRANSPORT_CAN_ARRIVE_PICKUP',
    successMessage: 'Transport can be marked as arrived at pickup.',
    failureErrorCode: 'ARRIVE_PICKUP_VALIDATION_FAILED',
    failureMessage: 'Transport cannot arrive at pickup because mandatory validations failed.',
  },
  completePickup: {
    businessAction: 'complete-pickup',
    validationType: 'CompletePickup',
    fromStateCodes: ['at_pickup'],
    toStateCode: 'pickup_completed',
    successCheckCode: 'PICKUP_CAN_BE_COMPLETED',
    successMessage: 'Pickup can be completed.',
    failureErrorCode: 'COMPLETE_PICKUP_VALIDATION_FAILED',
    failureMessage: 'Pickup cannot be completed because mandatory validations failed.',
  },
  startMission: {
    businessAction: 'start-mission',
    validationType: 'StartMission',
    fromStateCodes: ['pickup_completed'],
    toStateCode: 'in_transport',
    successCheckCode: 'MISSION_CAN_START',
    successMessage: 'Mission can start because pickup is completed.',
    failureErrorCode: 'START_MISSION_VALIDATION_FAILED',
    failureMessage: 'Mission cannot start because mandatory validations failed.',
  },
  arriveDelivery: {
    businessAction: 'arrive-delivery',
    validationType: 'ArriveDelivery',
    fromStateCodes: ['in_transport'],
    toStateCode: 'at_delivery',
    successCheckCode: 'TRANSPORT_CAN_ARRIVE_DELIVERY',
    successMessage: 'Transport can be marked as arrived at delivery.',
    failureErrorCode: 'ARRIVE_DELIVERY_VALIDATION_FAILED',
    failureMessage: 'Transport cannot arrive at delivery because mandatory validations failed.',
  },
  completeDelivery: {
    businessAction: 'complete-delivery',
    validationType: 'CompleteDelivery',
    fromStateCodes: ['at_delivery'],
    toStateCode: 'delivery_completed',
    successCheckCode: 'DELIVERY_CAN_BE_COMPLETED',
    successMessage: 'Delivery can be completed.',
    failureErrorCode: 'COMPLETE_DELIVERY_VALIDATION_FAILED',
    failureMessage: 'Delivery cannot be completed because mandatory validations failed.',
  },
  submitDocuments: {
    businessAction: 'submit-documents',
    validationType: 'SubmitDocuments',
    fromStateCodes: ['delivery_completed'],
    toStateCode: 'documents_submitted',
    successCheckCode: 'DOCUMENTS_CAN_BE_SUBMITTED',
    successMessage: 'Required transport documents can be submitted.',
    failureErrorCode: 'SUBMIT_DOCUMENTS_VALIDATION_FAILED',
    failureMessage: 'Documents cannot be submitted because mandatory validations failed.',
  },
  registerPayment: {
    businessAction: 'register-payment',
    validationType: 'RegisterPayment',
    fromStateCodes: ['documents_submitted'],
    toStateCode: 'paid',
    successCheckCode: 'PAYMENT_CAN_BE_REGISTERED',
    successMessage: 'Payment can be registered.',
    failureErrorCode: 'REGISTER_PAYMENT_VALIDATION_FAILED',
    failureMessage: 'Payment cannot be registered because mandatory validations failed.',
  },
  closeTransport: {
    businessAction: 'close-transport',
    validationType: 'CloseTransport',
    fromStateCodes: ['paid'],
    toStateCode: 'closed',
    successCheckCode: 'TRANSPORT_CAN_BE_CLOSED',
    successMessage: 'Transport can be closed.',
    failureErrorCode: 'TRANSPORT_CLOSURE_VALIDATION_FAILED',
    failureMessage: 'Transport cannot be closed because mandatory validations failed.',
  },
  archiveTransport: {
    businessAction: 'archive-transport',
    validationType: 'ArchiveTransport',
    fromStateCodes: ['closed'],
    toStateCode: 'archived',
    successCheckCode: 'TRANSPORT_CAN_BE_ARCHIVED',
    successMessage: 'Transport can be archived.',
    failureErrorCode: 'ARCHIVE_TRANSPORT_VALIDATION_FAILED',
    failureMessage: 'Transport cannot be archived because mandatory validations failed.',
  },
} as const satisfies Record<TransportTransitionCommand, TransportTransitionPolicy>;

export function getTransportTransitionPolicy(
  command: TransportTransitionCommand,
): TransportTransitionPolicy {
  return TRANSPORT_TRANSITION_POLICIES[command];
}
