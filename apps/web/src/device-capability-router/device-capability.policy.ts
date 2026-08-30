import type { DataSensitivity } from './device-capability.types';

const externallyBlocked = new Set<DataSensitivity>(['PERSONAL', 'DOCUMENT', 'CAR_MOVER', 'SECRET']);
const agmTransferConfirmationRequired = new Set<DataSensitivity>(['DOCUMENT', 'CAR_MOVER', 'SECRET']);

export function externalTransferAllowed(sensitivity: DataSensitivity, userConfirmed: boolean) {
  return userConfirmed && !externallyBlocked.has(sensitivity);
}

export function agmTransferAllowed(sensitivity: DataSensitivity, userConfirmed: boolean) {
  return !agmTransferConfirmationRequired.has(sensitivity) || userConfirmed;
}

export function requiresExternalConfirmation(sensitivity: DataSensitivity) {
  return !externallyBlocked.has(sensitivity);
}

export function sensitivityBlocksExternalTransfer(sensitivity: DataSensitivity) {
  return externallyBlocked.has(sensitivity);
}
