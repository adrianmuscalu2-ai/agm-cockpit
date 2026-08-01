import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { preDepartureCopy, preDepartureLanguages } from '../src/pre-departure/pre-departure.i18n';
import { createPreDepartureSession, transitionPreDeparture } from '../src/pre-departure/pre-departure.machine';
import { renderPreDepartureShell } from '../src/pre-departure/pre-departure.shell';
import { preDepartureCore } from '../src/pre-departure/pre-departure.module';
import { createWebBuildDefinition } from '../web-build-definition.mjs';

assert.deepEqual([...preDepartureLanguages], ['ro', 'de', 'en']);
assert.equal(preDepartureCore.stateCount, 8);
assert.equal(preDepartureCore.transitionCount, 18);
assert.equal(preDepartureCore.externalSideEffects, false);

const initial = createPreDepartureSession();
assert.equal(initial.state, 'NOT_STARTED');

const started = transitionPreDeparture(initial, { type: 'START_SESSION' });
assert.equal(started.applied, true);
assert.equal(started.session.state, 'CONTEXT_SELECTION');

const inProgress = transitionPreDeparture(started.session, {
  type: 'SELECT_CONTEXT',
  contexts: ['local', 'adr'],
  applicableCheckIds: ['vehicle', 'driver', 'documents', 'tachograph', 'cargo', 'route', 'adr'],
});
assert.equal(inProgress.applied, true);
assert.equal(inProgress.session.state, 'IN_PROGRESS');

const ready = transitionPreDeparture(inProgress.session, { type: 'ANSWER_CONFIRMED', checkId: 'vehicle' });
assert.equal(ready.applied, true);
assert.equal(ready.session.state, 'IN_PROGRESS');

const shellRo = renderPreDepartureShell({
  language: 'ro',
  session: started.session,
  online: true,
  saved: false,
});
const shellDe = renderPreDepartureShell({
  language: 'de',
  session: started.session,
  online: true,
  saved: false,
});
const shellEn = renderPreDepartureShell({
  language: 'en',
  session: started.session,
  online: true,
  saved: false,
});

assert.ok(shellRo.includes(preDepartureCopy.ro.title));
assert.ok(shellDe.includes(preDepartureCopy.de.title));
assert.ok(shellEn.includes(preDepartureCopy.en.title));
assert.ok(shellRo.includes('data-pre-departure-language'));
assert.ok(shellRo.includes('data-pre-departure-action="start"'));
assert.ok(shellRo.includes(preDepartureCopy.ro.automaticSummaryHint));
assert.ok(shellRo.includes(preDepartureCopy.ro.stepsHint));
assert.ok(shellRo.includes('data-pre-departure-action="continue"'));
assert.ok(preDepartureCopy.ro.resetQuestion.includes('Înainte de plecare'));
assert.ok(preDepartureCopy.de.resetQuestion.includes('Vor der Abfahrt'));
assert.ok(preDepartureCopy.en.resetQuestion.includes('Before Departure'));

let completedSession = inProgress.session;
for (const checkId of completedSession.applicableCheckIds) {
  const answer = transitionPreDeparture(completedSession, { type: 'ANSWER_CONFIRMED', checkId });
  assert.equal(answer.applied, true);
  completedSession = answer.session;
}

const assessmentComplete = transitionPreDeparture(completedSession, { type: 'COMPLETE_ASSESSMENT' });
assert.equal(assessmentComplete.applied, true);
assert.equal(assessmentComplete.session.state, 'READY_TO_CONFIRM');

const reviewShell = renderPreDepartureShell({
  language: 'ro',
  session: assessmentComplete.session,
  online: true,
  saved: true,
});
assert.ok(reviewShell.includes(preDepartureCopy.ro.reviewTitle));
assert.ok(reviewShell.includes(preDepartureCopy.ro.reviewReady));
assert.ok(reviewShell.includes(preDepartureCopy.ro.confirmReady));
assert.ok(reviewShell.includes('7/7 · 100%'));

const confirmed = transitionPreDeparture(assessmentComplete.session, { type: 'CONFIRM_READY' });
assert.equal(confirmed.applied, true);
assert.equal(confirmed.session.state, 'CONFIRMED');

assert.equal(
  createWebBuildDefinition().build.rollupOptions.input.beforeDeparture,
  'before-departure.html',
);

console.log('E6.4-E6.6 validation checks passed.');
