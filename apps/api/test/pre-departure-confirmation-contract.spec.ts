import {
  PRE_DEPARTURE_CONFIRMATION_CONTRACT_VERSION,
  validatePreDepartureConfirmation,
} from '../src/pre-departure-contract/pre-departure-confirmation-contract';

const confirmation = {
  contractVersion: PRE_DEPARTURE_CONFIRMATION_CONTRACT_VERSION,
  expectedServerRevision: 3,
  actorLabel: 'Test Driver',
  confirmedAt: '2026-07-26T05:00:00.000Z',
  statementVersion: 'pre-departure-confirmation-v1',
};

describe('Pre-departure confirmation contract v1', () => {
  it('accepts explicit operational confirmation', () => {
    expect(validatePreDepartureConfirmation(confirmation).valid).toBe(true);
  });

  it('rejects an anonymous confirmation', () => {
    expect(validatePreDepartureConfirmation({ ...confirmation, actorLabel: ' ' }).valid).toBe(false);
  });

  it('requires optimistic concurrency', () => {
    expect(validatePreDepartureConfirmation({ ...confirmation, expectedServerRevision: -1 }).valid).toBe(false);
  });
});
