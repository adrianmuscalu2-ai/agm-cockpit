import {
  recordPreDepartureInOperationalContext,
  recordPreDepartureReset,
} from '../premium-operational-context/pre-departure.integration';
import type { PreDepartureSession } from './pre-departure.types';

export type PreDepartureJourneyFacade = {
  handoff(storage: Storage, session: PreDepartureSession, online: boolean): ReturnType<
    typeof recordPreDepartureInOperationalContext
  >;
  reset(storage: Storage): ReturnType<typeof recordPreDepartureReset>;
};

export function createPreDepartureJourneyFacade(
  implementation: PreDepartureJourneyFacade = {
    handoff: recordPreDepartureInOperationalContext,
    reset: recordPreDepartureReset,
  },
): PreDepartureJourneyFacade {
  return implementation;
}
