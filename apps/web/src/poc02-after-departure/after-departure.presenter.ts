import { afterDeparturePolicies } from './after-departure.evaluator';
import { afterDepartureCopy, type AfterDepartureLanguage } from './after-departure.i18n';
import { localizeAssessmentContent } from './after-departure.operational-i18n';
import { canTransitionAfterDeparture } from './after-departure.evaluator';
import type {
  AfterDepartureAssessment,
  AfterDepartureScenario,
  AfterDepartureState,
} from './after-departure.types';

export const afterDepartureStateCatalog: readonly AfterDepartureState[] = [
  'NEW',
  'UNSAFE_TO_INTERACT',
  'EMERGENCY',
  'NEEDS_FACTS',
  'ASSESSED',
  'AWAITING_CONFIRMATION',
  'ESCALATED',
  'SAFE_TO_CONTINUE',
  'CLOSED',
];

export function scenarioOptions(language: AfterDepartureLanguage) {
  const copy = afterDepartureCopy[language];
  return (Object.keys(afterDeparturePolicies) as AfterDepartureScenario[]).map((value) => ({
    value,
    label: copy.scenarios[value],
  }));
}

export function requiredFactsForScenario(scenario: AfterDepartureScenario) {
  return afterDeparturePolicies[scenario].requiredFacts;
}

export function presentAssessment(
  assessment: AfterDepartureAssessment,
  language: AfterDepartureLanguage,
) {
  const copy = afterDepartureCopy[language];
  const localized = localizeAssessmentContent(assessment, language);
  return {
    state: assessment.state,
    stateLabel: copy.states[assessment.state],
    priority: assessment.priority,
    actions: localized.actions.slice(0, 3),
    missingFacts: localized.missingFacts,
    escalation: localized.escalation,
    prohibitedActions: localized.prohibited,
    limitations: localized.limitations,
    confirmationRequired: assessment.confirmationRequired,
    canContinue: assessment.canContinue,
    externalEffectExecuted: false as const,
  };
}

export function transitionAssessment(
  assessment: AfterDepartureAssessment,
  nextState: AfterDepartureState,
) {
  if (!canTransitionAfterDeparture(assessment.state, nextState)) {
    return assessment;
  }
  return {
    ...assessment,
    state: nextState,
    confirmationRequired: nextState === 'AWAITING_CONFIRMATION',
    canContinue: nextState === 'SAFE_TO_CONTINUE',
  };
}
