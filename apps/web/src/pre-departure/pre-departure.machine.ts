import type {
  PreDepartureAnswer,
  PreDepartureContext,
  PreDepartureEvent,
  PreDepartureSession,
  PreDepartureState,
  PreDepartureTransitionId,
  PreDepartureTransitionResult,
} from './pre-departure.types';

const restorableStates: readonly PreDepartureState[] = [
  'IN_PROGRESS',
  'NEEDS_ATTENTION',
  'BLOCKED',
  'READY_TO_CONFIRM',
];

const validContexts: readonly PreDepartureContext[] = [
  'local',
  'long-distance',
  'adr',
  'night',
  'adverse-weather',
];

export const createPreDepartureSession = (): PreDepartureSession => ({
  state: 'NOT_STARTED',
  contexts: [],
  applicableCheckIds: [],
  answers: {},
});

const unchanged = (session: PreDepartureSession, reason: string): PreDepartureTransitionResult => ({
  session,
  applied: false,
  reason,
});

const applied = (
  session: PreDepartureSession,
  transitionId: PreDepartureTransitionId,
): PreDepartureTransitionResult => ({ session, transitionId, applied: true });

const withState = (
  session: PreDepartureSession,
  state: PreDepartureState,
): PreDepartureSession => ({ ...session, state });

const normalizeIds = (ids: readonly string[]) => [
  ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
];

const isValidAnswer = (answer: PreDepartureAnswer) => {
  if (answer.status === 'confirmed') return true;
  if (answer.status === 'problem') {
    return answer.note === undefined || typeof answer.note === 'string';
  }
  return (
    answer.status === 'not-applicable' &&
    typeof answer.reason === 'string' &&
    answer.reason.trim().length > 0
  );
};

const answerFor = (
  event: Extract<
    PreDepartureEvent,
    | { type: 'ANSWER_CONFIRMED' }
    | { type: 'ANSWER_PROBLEM' }
    | { type: 'ANSWER_NOT_APPLICABLE_WITH_REASON' }
  >,
): PreDepartureAnswer | undefined => {
  if (event.type === 'ANSWER_CONFIRMED') return { status: 'confirmed' };
  if (event.type === 'ANSWER_PROBLEM') {
    const note = event.note?.trim();
    return note ? { status: 'problem', note } : { status: 'problem' };
  }
  const reason = event.reason.trim();
  return reason ? { status: 'not-applicable', reason } : undefined;
};

const updateAnswer = (
  session: PreDepartureSession,
  checkId: string,
  answer: PreDepartureAnswer | undefined,
): PreDepartureSession | undefined => {
  if (!session.applicableCheckIds.includes(checkId)) return undefined;
  if (answer && !isValidAnswer(answer)) return undefined;
  const answers = { ...session.answers };
  if (answer) answers[checkId] = answer;
  else delete answers[checkId];
  return { ...session, answers };
};

const progress = (session: PreDepartureSession) => {
  const answers = session.applicableCheckIds.map((id) => session.answers[id]);
  return {
    hasProblems: answers.some((answer) => answer?.status === 'problem'),
    hasIncomplete: answers.some((answer) => answer === undefined),
  };
};

const validRestore = (session: PreDepartureSession) => {
  if (
    !restorableStates.includes(session.state) ||
    session.contexts.length === 0 ||
    new Set(session.contexts).size !== session.contexts.length ||
    !session.contexts.every((context) => validContexts.includes(context)) ||
    session.applicableCheckIds.length === 0 ||
    normalizeIds(session.applicableCheckIds).length !== session.applicableCheckIds.length ||
    !Object.entries(session.answers).every(
      ([id, answer]) =>
        session.applicableCheckIds.includes(id) && (!answer || isValidAnswer(answer)),
    )
  ) {
    return false;
  }

  const status = progress(session);
  if (session.state === 'IN_PROGRESS') return !status.hasProblems;
  if (session.state === 'NEEDS_ATTENTION') return status.hasProblems;
  if (session.state === 'BLOCKED') return status.hasProblems && !status.hasIncomplete;
  return !status.hasProblems && !status.hasIncomplete;
};

const transitionFromInProgress = (
  session: PreDepartureSession,
  event: PreDepartureEvent,
): PreDepartureTransitionResult | undefined => {
  if (
    event.type === 'ANSWER_CONFIRMED' ||
    event.type === 'ANSWER_PROBLEM' ||
    event.type === 'ANSWER_NOT_APPLICABLE_WITH_REASON'
  ) {
    const answer = answerFor(event);
    if (!answer) return unchanged(session, 'A reason is required for not-applicable answers.');
    const next = updateAnswer(session, event.checkId, answer);
    if (!next) return unchanged(session, 'The check is not applicable to this session.');
    return event.type === 'ANSWER_PROBLEM'
      ? applied(withState(next, 'NEEDS_ATTENTION'), 'E6-T04')
      : applied(next, 'E6-T03');
  }

  if (event.type === 'COMPLETE_ASSESSMENT') {
    const status = progress(session);
    if (status.hasIncomplete) return unchanged(session, 'Applicable checks remain incomplete.');
    if (status.hasProblems) {
      return unchanged(session, 'A session with problems must be in NEEDS_ATTENTION.');
    }
    return applied(withState(session, 'READY_TO_CONFIRM'), 'E6-T07');
  }
  return undefined;
};

const transitionFromNeedsAttention = (
  session: PreDepartureSession,
  event: PreDepartureEvent,
): PreDepartureTransitionResult | undefined => {
  if (
    event.type === 'ANSWER_CONFIRMED' ||
    event.type === 'ANSWER_PROBLEM' ||
    event.type === 'ANSWER_NOT_APPLICABLE_WITH_REASON' ||
    event.type === 'EDIT_ANSWER'
  ) {
    const answer = event.type === 'EDIT_ANSWER' ? event.answer : answerFor(event);
    if (event.type === 'ANSWER_NOT_APPLICABLE_WITH_REASON' && !answer) {
      return unchanged(session, 'A reason is required for not-applicable answers.');
    }
    const next = updateAnswer(session, event.checkId, answer);
    if (!next) return unchanged(session, 'The check is not applicable to this session.');
    const status = progress(next);
    if (status.hasProblems) return applied(next, 'E6-T05');
    if (status.hasIncomplete) return applied(withState(next, 'IN_PROGRESS'), 'E6-T06');
    return applied(withState(next, 'READY_TO_CONFIRM'), 'E6-T19');
  }

  if (event.type === 'COMPLETE_ASSESSMENT') {
    const status = progress(session);
    return status.hasProblems && !status.hasIncomplete
      ? applied(withState(session, 'BLOCKED'), 'E6-T09')
      : unchanged(session, 'The assessment is not complete with an unresolved problem.');
  }
  return undefined;
};

const transitionFromBlocked = (
  session: PreDepartureSession,
  event: PreDepartureEvent,
): PreDepartureTransitionResult | undefined => {
  if (event.type !== 'EDIT_ANSWER') return undefined;
  const next = updateAnswer(session, event.checkId, event.answer);
  if (!next) return unchanged(session, 'The check is not applicable to this session.');
  const status = progress(next);
  if (status.hasProblems) return applied(withState(next, 'NEEDS_ATTENTION'), 'E6-T10');
  if (status.hasIncomplete) return applied(withState(next, 'IN_PROGRESS'), 'E6-T11');
  return applied(withState(next, 'READY_TO_CONFIRM'), 'E6-T12');
};

const transitionFromReady = (
  session: PreDepartureSession,
  event: PreDepartureEvent,
): PreDepartureTransitionResult | undefined => {
  if (event.type === 'CONFIRM_READY') {
    return applied(withState(session, 'CONFIRMED'), 'E6-T15');
  }
  if (event.type !== 'EDIT_ANSWER') return undefined;
  const next = updateAnswer(session, event.checkId, event.answer);
  if (!next) return unchanged(session, 'The check is not applicable to this session.');
  const status = progress(next);
  if (status.hasProblems) return applied(withState(next, 'NEEDS_ATTENTION'), 'E6-T14');
  if (status.hasIncomplete) return applied(withState(next, 'IN_PROGRESS'), 'E6-T13');
  return unchanged(session, 'The edit does not change the ready state.');
};

export function transitionPreDeparture(
  session: PreDepartureSession,
  event: PreDepartureEvent,
): PreDepartureTransitionResult {
  if (event.type === 'RESET_CONFIRMED' && session.state !== 'NOT_STARTED') {
    return applied(createPreDepartureSession(), 'E6-T17');
  }

  if (session.state === 'NOT_STARTED') {
    if (event.type === 'START_SESSION') {
      return applied(withState(session, 'CONTEXT_SELECTION'), 'E6-T01');
    }
    if (event.type === 'RESTORE_SESSION' && validRestore(event.session)) {
      return applied(
        {
          ...event.session,
          contexts: [...event.session.contexts],
          applicableCheckIds: [...event.session.applicableCheckIds],
          answers: { ...event.session.answers },
        },
        'E6-T18',
      );
    }
  }

  if (session.state === 'CONTEXT_SELECTION' && event.type === 'SELECT_CONTEXT') {
    const contexts = [...new Set(event.contexts)];
    const applicableCheckIds = normalizeIds(event.applicableCheckIds);
    if (
      contexts.length === 0 ||
      !contexts.every((context) => validContexts.includes(context)) ||
      applicableCheckIds.length === 0
    ) {
      return unchanged(session, 'At least one context and one applicable check are required.');
    }
    return applied(
      { state: 'IN_PROGRESS', contexts, applicableCheckIds, answers: {} },
      'E6-T02',
    );
  }

  const specialized =
    (session.state === 'IN_PROGRESS' && transitionFromInProgress(session, event)) ||
    (session.state === 'NEEDS_ATTENTION' && transitionFromNeedsAttention(session, event)) ||
    (session.state === 'BLOCKED' && transitionFromBlocked(session, event)) ||
    (session.state === 'READY_TO_CONFIRM' && transitionFromReady(session, event));
  if (specialized) return specialized;

  if (session.state === 'CONFIRMED' && event.type === 'CLOSE_SESSION') {
    return applied(withState(session, 'CLOSED'), 'E6-T16');
  }

  return unchanged(session, `Event ${event.type} is not permitted from ${session.state}.`);
}
