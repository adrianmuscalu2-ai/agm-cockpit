import type { PremiumLifecycleState } from './trip-context.types';

export const lifecycleMappingVersion = 'premium-transportjob-map.v1' as const;

export type LifecycleMappingEntry = {
  premiumState: PremiumLifecycleState;
  acceptedTransportJobStates: readonly string[];
  preferredTransportJobState: string;
  relation: 'exact' | 'compatible' | 'requires-business-action';
};

export const premiumTransportJobLifecycleMap: readonly LifecycleMappingEntry[] = [
  { premiumState: 'DRAFT', acceptedTransportJobStates: ['imported', 'accepted'], preferredTransportJobState: 'imported', relation: 'compatible' },
  { premiumState: 'PRE_DEPARTURE_IN_PROGRESS', acceptedTransportJobStates: ['accepted', 'at_pickup'], preferredTransportJobState: 'at_pickup', relation: 'compatible' },
  { premiumState: 'READY_WITH_WARNINGS', acceptedTransportJobStates: ['at_pickup'], preferredTransportJobState: 'at_pickup', relation: 'requires-business-action' },
  { premiumState: 'READY_CONFIRMED', acceptedTransportJobStates: ['at_pickup'], preferredTransportJobState: 'at_pickup', relation: 'requires-business-action' },
  { premiumState: 'TRIP_ACTIVE', acceptedTransportJobStates: ['pickup_completed', 'in_transport'], preferredTransportJobState: 'in_transport', relation: 'compatible' },
  { premiumState: 'ARRIVAL_RECORDED', acceptedTransportJobStates: ['at_delivery'], preferredTransportJobState: 'at_delivery', relation: 'compatible' },
  { premiumState: 'POST_TRIP_IN_PROGRESS', acceptedTransportJobStates: ['delivery_completed', 'documents_submitted'], preferredTransportJobState: 'documents_submitted', relation: 'compatible' },
  { premiumState: 'COMPLETED', acceptedTransportJobStates: ['closed'], preferredTransportJobState: 'closed', relation: 'requires-business-action' },
  { premiumState: 'ARCHIVED', acceptedTransportJobStates: ['archived'], preferredTransportJobState: 'archived', relation: 'exact' },
] as const;

export function mappingForPremiumState(state: PremiumLifecycleState) {
  return premiumTransportJobLifecycleMap.find((entry) => entry.premiumState === state);
}

export function transportJobStateSupportsPremiumState(
  premiumState: PremiumLifecycleState,
  transportJobState: string,
) {
  const normalized = transportJobState
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLocaleLowerCase();
  return Boolean(mappingForPremiumState(premiumState)?.acceptedTransportJobStates.includes(normalized));
}
