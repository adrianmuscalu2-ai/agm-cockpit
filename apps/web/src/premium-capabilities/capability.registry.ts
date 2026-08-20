import type { CapabilityId } from './capability.types';

export const AGMA_WAVE_2A_SLICE_1_FLAG = 'agm.wave2a.slice1.enabled';
export const AGMA_WAVE_2B_FLAG = 'agm.wave2b.enabled';
export const capabilityRegistry = new Map<CapabilityId, Readonly<{ adapterId: CapabilityId; externalEffect: true; confirmationPolicy: 'ACTION_BOUND'; permissionStrategy: 'NONE' }>>([
  ['OPEN_DIALER', { adapterId: 'OPEN_DIALER', externalEffect: true, confirmationPolicy: 'ACTION_BOUND', permissionStrategy: 'NONE' }],
  ['OPEN_MAPS', { adapterId: 'OPEN_MAPS', externalEffect: true, confirmationPolicy: 'ACTION_BOUND', permissionStrategy: 'NONE' }],
  ['SEND_EMAIL', { adapterId: 'SEND_EMAIL', externalEffect: true, confirmationPolicy: 'ACTION_BOUND', permissionStrategy: 'NONE' }],
  ['SEND_WHATSAPP', { adapterId: 'SEND_WHATSAPP', externalEffect: true, confirmationPolicy: 'ACTION_BOUND', permissionStrategy: 'NONE' }],
]);

export function slice1Enabled(storage: Pick<Storage, 'getItem'>) {
  return storage.getItem(AGMA_WAVE_2A_SLICE_1_FLAG) !== 'false';
}
export function wave2bEnabled(storage: Pick<Storage, 'getItem'>) { return storage.getItem(AGMA_WAVE_2B_FLAG) !== 'false'; }
