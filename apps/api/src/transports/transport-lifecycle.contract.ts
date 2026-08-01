import {
  TRANSPORT_TRANSITION_POLICIES,
  TransportTransitionCommand,
} from './transport-transition.policy';

export const TRANSPORT_LIFECYCLE_CONTRACT = {
  id: 'API-004',
  version: 'transports-lifecycle.v1',
  initialStateCode: 'imported',
  terminalStateCode: 'archived',
  commands: [
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
  ] as const satisfies readonly TransportTransitionCommand[],
  tenantKey: 'companyId',
  protectedRecords: [
    'validationReport',
    'auditEvent',
    'stateHistory',
    'financialLedger',
  ] as const,
} as const;

export function getCanonicalLifecycleChain() {
  return TRANSPORT_LIFECYCLE_CONTRACT.commands.map((command) => {
    const policy = TRANSPORT_TRANSITION_POLICIES[command];
    return {
      command,
      businessAction: policy.businessAction,
      from: policy.fromStateCodes[0],
      to: policy.toStateCode,
    };
  });
}

