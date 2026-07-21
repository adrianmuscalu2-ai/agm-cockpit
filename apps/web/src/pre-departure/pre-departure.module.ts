import { createPreDepartureSession, transitionPreDeparture } from './pre-departure.machine';

export const preDepartureCore = Object.freeze({
  version: 'E6.2',
  externalSideEffects: false,
  stateCount: 8,
  eventCount: 11,
  transitionCount: 18,
  createSession: createPreDepartureSession,
  transition: transitionPreDeparture,
});

export type {
  PreDepartureAnswer,
  PreDepartureContext,
  PreDepartureEvent,
  PreDepartureSession,
  PreDepartureState,
  PreDepartureTransitionId,
  PreDepartureTransitionResult,
} from './pre-departure.types';
