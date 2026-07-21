export type PreDepartureState =
  | 'NOT_STARTED'
  | 'CONTEXT_SELECTION'
  | 'IN_PROGRESS'
  | 'NEEDS_ATTENTION'
  | 'BLOCKED'
  | 'READY_TO_CONFIRM'
  | 'CONFIRMED'
  | 'CLOSED';

export type PreDepartureContext =
  | 'local'
  | 'long-distance'
  | 'adr'
  | 'night'
  | 'adverse-weather';

export type PreDepartureCheckId =
  | 'vehicle'
  | 'driver'
  | 'documents'
  | 'tachograph'
  | 'cargo'
  | 'route'
  | 'adr'
  | 'weather';

export type PreDepartureAnswer =
  | { status: 'confirmed' }
  | { status: 'problem'; note?: string }
  | { status: 'not-applicable'; reason: string };

export type PreDepartureSession = {
  readonly state: PreDepartureState;
  readonly contexts: readonly PreDepartureContext[];
  readonly applicableCheckIds: readonly string[];
  readonly answers: Readonly<Record<string, PreDepartureAnswer | undefined>>;
  readonly language?: 'ro' | 'de' | 'en';
};

export type PreDepartureEvent =
  | { type: 'START_SESSION' }
  | {
      type: 'SELECT_CONTEXT';
      contexts: readonly PreDepartureContext[];
      applicableCheckIds: readonly string[];
    }
  | { type: 'ANSWER_CONFIRMED'; checkId: string }
  | { type: 'ANSWER_PROBLEM'; checkId: string; note?: string }
  | { type: 'ANSWER_NOT_APPLICABLE_WITH_REASON'; checkId: string; reason: string }
  | { type: 'EDIT_ANSWER'; checkId: string; answer?: PreDepartureAnswer }
  | { type: 'COMPLETE_ASSESSMENT' }
  | { type: 'CONFIRM_READY' }
  | { type: 'CLOSE_SESSION' }
  | { type: 'RESET_CONFIRMED' }
  | { type: 'RESTORE_SESSION'; session: PreDepartureSession };

export type PreDepartureTransitionId =
  | 'E6-T01'
  | 'E6-T02'
  | 'E6-T03'
  | 'E6-T04'
  | 'E6-T05'
  | 'E6-T06'
  | 'E6-T07'
  | 'E6-T09'
  | 'E6-T10'
  | 'E6-T11'
  | 'E6-T12'
  | 'E6-T13'
  | 'E6-T14'
  | 'E6-T15'
  | 'E6-T16'
  | 'E6-T17'
  | 'E6-T18'
  | 'E6-T19';

export type PreDepartureTransitionResult = {
  readonly session: PreDepartureSession;
  readonly applied: boolean;
  readonly transitionId?: PreDepartureTransitionId;
  readonly reason?: string;
};
