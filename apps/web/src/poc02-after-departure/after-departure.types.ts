export type AfterDepartureScenario =
  | 'road-control'
  | 'incident'
  | 'breakdown'
  | 'fatigue'
  | 'cargo'
  | 'route'
  | 'weather'
  | 'language';

export type AfterDeparturePriority = 'P0' | 'P1' | 'P2' | 'P3';

export type AfterDepartureState =
  | 'NEW'
  | 'UNSAFE_TO_INTERACT'
  | 'EMERGENCY'
  | 'NEEDS_FACTS'
  | 'ASSESSED'
  | 'AWAITING_CONFIRMATION'
  | 'ESCALATED'
  | 'SAFE_TO_CONTINUE'
  | 'CLOSED';

export type AfterDepartureFactValue = string | number | boolean;

export type AfterDepartureFacts = Readonly<Record<string, AfterDepartureFactValue | undefined>>;

export type AfterDepartureAssessmentInput = {
  scenario: AfterDepartureScenario;
  safeToInteract: boolean;
  immediateDanger: boolean;
  facts?: AfterDepartureFacts;
  externalActionRequested?: boolean;
};

export type AfterDepartureAssessment = {
  scenario: AfterDepartureScenario;
  state: AfterDepartureState;
  priority: AfterDeparturePriority;
  knownFacts: Readonly<Record<string, AfterDepartureFactValue>>;
  missingFacts: readonly string[];
  immediateActions: readonly string[];
  escalation: readonly string[];
  confirmationRequired: boolean;
  canContinue: boolean;
  prohibitedActions: readonly string[];
  limitations: readonly string[];
};

export type AfterDepartureScenarioPolicy = {
  priority: AfterDeparturePriority;
  requiredFacts: readonly string[];
  immediateActions: readonly string[];
  escalation: readonly string[];
  prohibitedActions: readonly string[];
};

