import assert from 'node:assert/strict';
import {
  createPreDepartureSession,
  transitionPreDeparture,
} from '../src/pre-departure/pre-departure.machine';
import { preDepartureCore } from '../src/pre-departure/pre-departure.module';
import type {
  PreDepartureAnswer,
  PreDepartureSession,
  PreDepartureTransitionId,
} from '../src/pre-departure/pre-departure.types';

const checks = ['vehicle', 'driver'];
const observed = new Set<PreDepartureTransitionId>();

const apply = (
  session: PreDepartureSession,
  event: Parameters<typeof transitionPreDeparture>[1],
  expected: PreDepartureTransitionId,
) => {
  const result = transitionPreDeparture(session, event);
  assert.equal(result.applied, true, result.reason);
  assert.equal(result.transitionId, expected);
  observed.add(expected);
  return result.session;
};

const sessionWith = (
  state: PreDepartureSession['state'],
  answers: Record<string, PreDepartureAnswer | undefined>,
): PreDepartureSession => ({
  state,
  contexts: ['local'],
  applicableCheckIds: checks,
  answers,
});

assert.equal(preDepartureCore.externalSideEffects, false);
assert.equal(preDepartureCore.stateCount, 8);
assert.equal(preDepartureCore.eventCount, 11);
assert.equal(preDepartureCore.transitionCount, 18);

const initial = createPreDepartureSession();
const selecting = apply(initial, { type: 'START_SESSION' }, 'E6-T01');
const inProgress = apply(
  selecting,
  { type: 'SELECT_CONTEXT', contexts: ['local'], applicableCheckIds: checks },
  'E6-T02',
);
const oneConfirmed = apply(
  inProgress,
  { type: 'ANSWER_CONFIRMED', checkId: 'vehicle' },
  'E6-T03',
);
assert.equal(inProgress.answers.vehicle, undefined);
assert.notEqual(oneConfirmed, inProgress);
assert.notEqual(oneConfirmed.answers, inProgress.answers);
const needsAttention = apply(
  oneConfirmed,
  { type: 'ANSWER_PROBLEM', checkId: 'driver', note: 'fatigue' },
  'E6-T04',
);
const stillNeedsAttention = apply(
  needsAttention,
  { type: 'EDIT_ANSWER', checkId: 'vehicle', answer: { status: 'confirmed' } },
  'E6-T05',
);
const backToProgress = apply(
  stillNeedsAttention,
  { type: 'EDIT_ANSWER', checkId: 'driver' },
  'E6-T06',
);
const completedAnswers = apply(
  backToProgress,
  { type: 'ANSWER_CONFIRMED', checkId: 'driver' },
  'E6-T03',
);
const ready = apply(completedAnswers, { type: 'COMPLETE_ASSESSMENT' }, 'E6-T07');

const completeProblem = sessionWith('NEEDS_ATTENTION', {
  vehicle: { status: 'confirmed' },
  driver: { status: 'problem' },
});
const blocked = apply(completeProblem, { type: 'COMPLETE_ASSESSMENT' }, 'E6-T09');
const backToAttention = apply(
  blocked,
  { type: 'EDIT_ANSWER', checkId: 'driver', answer: { status: 'problem' } },
  'E6-T10',
);
assert.equal(backToAttention.state, 'NEEDS_ATTENTION');
const blockedMissing = sessionWith('BLOCKED', {
  vehicle: { status: 'confirmed' },
  driver: { status: 'problem' },
});
const backToIncomplete = apply(blockedMissing, { type: 'EDIT_ANSWER', checkId: 'driver' }, 'E6-T11');
assert.equal(backToIncomplete.state, 'IN_PROGRESS');
const unblockedReady = apply(
  blocked,
  { type: 'EDIT_ANSWER', checkId: 'driver', answer: { status: 'confirmed' } },
  'E6-T12',
);
assert.equal(unblockedReady.state, 'READY_TO_CONFIRM');

const editedIncomplete = apply(ready, { type: 'EDIT_ANSWER', checkId: 'driver' }, 'E6-T13');
assert.equal(editedIncomplete.state, 'IN_PROGRESS');
const editedProblem = apply(
  ready,
  { type: 'EDIT_ANSWER', checkId: 'driver', answer: { status: 'problem' } },
  'E6-T14',
);
assert.equal(editedProblem.state, 'NEEDS_ATTENTION');
const confirmed = apply(ready, { type: 'CONFIRM_READY' }, 'E6-T15');
const closed = apply(confirmed, { type: 'CLOSE_SESSION' }, 'E6-T16');
const reset = apply(closed, { type: 'RESET_CONFIRMED' }, 'E6-T17');
assert.deepEqual(reset, initial);
const restored = apply(reset, { type: 'RESTORE_SESSION', session: ready }, 'E6-T18');
assert.deepEqual(restored, { ...ready, confirmation: undefined });
assert.notEqual(restored.answers, ready.answers);

const repairedDirectly = apply(
  completeProblem,
  { type: 'EDIT_ANSWER', checkId: 'driver', answer: { status: 'confirmed' } },
  'E6-T19',
);
assert.equal(repairedDirectly.state, 'READY_TO_CONFIRM');

const invalidFromClosed = transitionPreDeparture(closed, { type: 'CONFIRM_READY' });
assert.equal(invalidFromClosed.applied, false);
assert.equal(invalidFromClosed.session, closed);

const invalidNotApplicable = transitionPreDeparture(inProgress, {
  type: 'ANSWER_NOT_APPLICABLE_WITH_REASON',
  checkId: 'vehicle',
  reason: '   ',
});
assert.equal(invalidNotApplicable.applied, false);

const invalidCheck = transitionPreDeparture(inProgress, {
  type: 'ANSWER_CONFIRMED',
  checkId: 'unknown',
});
assert.equal(invalidCheck.applied, false);

const invalidRestore = transitionPreDeparture(initial, {
  type: 'RESTORE_SESSION',
  session: { ...ready, state: 'CLOSED' },
});
assert.equal(invalidRestore.applied, false);

const inconsistentRestore = transitionPreDeparture(initial, {
  type: 'RESTORE_SESSION',
  session: { ...ready, state: 'BLOCKED' },
});
assert.equal(inconsistentRestore.applied, false);

const invalidEditedAnswer = transitionPreDeparture(completeProblem, {
  type: 'EDIT_ANSWER',
  checkId: 'driver',
  answer: { status: 'not-applicable', reason: '   ' },
});
assert.equal(invalidEditedAnswer.applied, false);

const invalidRuntimeContext = transitionPreDeparture(selecting, {
  type: 'SELECT_CONTEXT',
  contexts: ['unsupported' as never],
  applicableCheckIds: checks,
});
assert.equal(invalidRuntimeContext.applied, false);

const invalidRuntimeAnswer = transitionPreDeparture(completeProblem, {
  type: 'EDIT_ANSWER',
  checkId: 'driver',
  answer: { status: 'unknown' } as never,
});
assert.equal(invalidRuntimeAnswer.applied, false);

const resetBeforeStart = transitionPreDeparture(initial, { type: 'RESET_CONFIRMED' });
assert.equal(resetBeforeStart.applied, false);

const invalidProblemInProgress = transitionPreDeparture(
  sessionWith('IN_PROGRESS', {
    vehicle: { status: 'confirmed' },
    driver: { status: 'problem' },
  }),
  { type: 'COMPLETE_ASSESSMENT' },
);
assert.equal(invalidProblemInProgress.applied, false);

assert.equal(observed.size, 18);
for (let index = 1; index <= 19; index += 1) {
  if (index === 8) continue;
  const id = `E6-T${String(index).padStart(2, '0')}` as PreDepartureTransitionId;
  assert.equal(observed.has(id), true, `${id} was not covered`);
}

console.log('E6.2 pre-departure core: 18/18 canonical transitions passed.');
