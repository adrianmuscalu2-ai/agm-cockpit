import { assessAfterDepartureSituation, afterDeparturePolicies } from './after-departure.evaluator';

export const afterDepartureModule = {
  id: 'poc02-after-departure',
  version: '0.1.0',
  enabled: false,
  externalSideEffects: false,
  scenarios: Object.keys(afterDeparturePolicies),
  assess: assessAfterDepartureSituation,
} as const;

export type {
  AfterDepartureAssessment,
  AfterDepartureAssessmentInput,
  AfterDeparturePriority,
  AfterDepartureScenario,
  AfterDepartureState,
} from './after-departure.types';

export { assessAfterDepartureSituation, canTransitionAfterDeparture } from './after-departure.evaluator';

