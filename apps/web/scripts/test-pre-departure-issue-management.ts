import assert from 'node:assert/strict';

import {
  hasCriticalPreDepartureBlocker,
  openPreDepartureIssue,
  openPreDepartureIssues,
  resolvePreDepartureIssue,
} from '../src/pre-departure/pre-departure.issue-management';
import { createPreDepartureSession, transitionPreDeparture } from '../src/pre-departure/pre-departure.machine';
import { renderPreDepartureShell } from '../src/pre-departure/pre-departure.shell';

let session = transitionPreDeparture(createPreDepartureSession(), { type: 'START_SESSION' }).session;
session = transitionPreDeparture(session, {
  type: 'SELECT_CONTEXT',
  contexts: ['local'],
  applicableCheckIds: ['vehicle'],
}).session;

const opened = openPreDepartureIssue(session, {
  checkId: 'vehicle',
  description: 'Anvelopă deteriorată',
  severity: 'critical',
  issueId: 'issue-1',
  now: '2026-07-26T04:00:00.000Z',
});
assert.equal(opened.applied, true);
assert.equal(opened.session.state, 'NEEDS_ATTENTION');
assert.equal(openPreDepartureIssues(opened.session).length, 1);
assert.equal(hasCriticalPreDepartureBlocker(opened.session), true);
const issueShell = renderPreDepartureShell({
  language: 'ro',
  session: opened.session,
  online: false,
  saved: true,
});
assert.ok(issueShell.includes('Registrul problemelor'));
assert.ok(issueShell.includes('Critică — plecare blocată'));
assert.ok(issueShell.includes('data-pre-departure-resolve-issue="issue-1"'));

const blocked = transitionPreDeparture(opened.session, { type: 'COMPLETE_ASSESSMENT' });
assert.equal(blocked.session.state, 'BLOCKED');
assert.equal(transitionPreDeparture(blocked.session, { type: 'CONFIRM_READY' }).applied, false);

const missingNote = resolvePreDepartureIssue(blocked.session, 'issue-1', '');
assert.equal(missingNote.applied, false);

const resolved = resolvePreDepartureIssue(
  blocked.session,
  'issue-1',
  'Anvelopa a fost înlocuită și reverificată.',
  '2026-07-26T04:30:00.000Z',
);
assert.equal(resolved.applied, true);
assert.equal(resolved.session.state, 'IN_PROGRESS');
assert.equal(openPreDepartureIssues(resolved.session).length, 0);
assert.equal(resolved.session.answers.vehicle, undefined);

console.log('Pre-departure issue management: PASS');
