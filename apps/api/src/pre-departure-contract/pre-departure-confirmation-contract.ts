export const PRE_DEPARTURE_CONFIRMATION_CONTRACT_VERSION = '1.0.0' as const;

export type PreDepartureConfirmationRequest = {
  contractVersion: typeof PRE_DEPARTURE_CONFIRMATION_CONTRACT_VERSION;
  expectedServerRevision: number;
  actorLabel: string;
  confirmedAt: string;
  statementVersion: 'pre-departure-confirmation-v1';
};

export function validatePreDepartureConfirmation(value: unknown) {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false as const, errors: ['Confirmation must be an object.'] };
  }
  const confirmation = value as Record<string, unknown>;
  if (confirmation.contractVersion !== PRE_DEPARTURE_CONFIRMATION_CONTRACT_VERSION) errors.push('Unsupported contractVersion.');
  if (!Number.isInteger(confirmation.expectedServerRevision) || Number(confirmation.expectedServerRevision) < 0) {
    errors.push('expectedServerRevision must be a non-negative integer.');
  }
  if (typeof confirmation.actorLabel !== 'string' || !confirmation.actorLabel.trim() || confirmation.actorLabel.length > 120) {
    errors.push('actorLabel is required and limited to 120 characters.');
  }
  if (typeof confirmation.confirmedAt !== 'string' || !Number.isFinite(Date.parse(confirmation.confirmedAt))) {
    errors.push('confirmedAt must be an ISO-8601 timestamp.');
  }
  if (confirmation.statementVersion !== 'pre-departure-confirmation-v1') errors.push('Unsupported statementVersion.');
  return errors.length
    ? { valid: false as const, errors }
    : { valid: true as const, value: confirmation as PreDepartureConfirmationRequest };
}
