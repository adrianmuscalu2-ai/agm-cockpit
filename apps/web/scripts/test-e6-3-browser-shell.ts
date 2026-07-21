import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createPreDepartureSession,
  transitionPreDeparture,
} from '../src/pre-departure/pre-departure.machine';
import { renderPreDepartureShell } from '../src/pre-departure/pre-departure.shell';
import {
  applyPreDepartureAnswer,
  completePreDepartureAssessment,
} from '../src/pre-departure/pre-departure.controller';

const htmlEntry = readFileSync(new URL('../before-departure.html', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.mjs', import.meta.url), 'utf8');
const premiumSource = readFileSync(new URL('../src/premium-foundation.ts', import.meta.url), 'utf8');
const controllerSource = readFileSync(new URL('../src/pre-departure/pre-departure.controller.ts', import.meta.url), 'utf8');

assert.ok(htmlEntry.includes('id="before-departure-app"'));
assert.ok(htmlEntry.includes('/src/pre-departure/pre-departure.entry.ts'));
assert.equal(mainSource.includes('href="/before-departure.html"'), false);
assert.equal(mainSource.includes('data-e6-entry="before-departure"'), false);
assert.ok(viteConfig.includes("beforeDeparture: 'before-departure.html'"));
assert.ok(premiumSource.includes('before-departure'));
assert.ok(controllerSource.includes("root.addEventListener('click'"));
assert.ok(controllerSource.includes("root.addEventListener('change'"));
assert.ok(controllerSource.includes("target.closest<HTMLButtonElement>('button')"));

const initialHtml = renderPreDepartureShell(createPreDepartureSession());
assert.ok(initialHtml.includes('data-e6-entry="before-departure"'));
assert.ok(initialHtml.includes('data-before-departure-state>NOT_STARTED'));
assert.ok(initialHtml.includes('data-before-departure-start'));
assert.equal(initialHtml.match(/data-before-departure-start/g)?.length, 1);
assert.ok(initialHtml.includes('data-pre-departure-action="start" data-before-departure-start'));
assert.ok(initialHtml.includes('class="pre-departure-agm-topbar"'));
assert.ok(initialHtml.includes('src="/images/images/logo1.png"'));
assert.ok(initialHtml.includes('href="/premium"'));
assert.ok(initialHtml.includes('nu transmite date'));
assert.ok(initialHtml.includes('E6.6'));

const started = transitionPreDeparture(createPreDepartureSession(), { type: 'START_SESSION' });
assert.equal(started.transitionId, 'E6-T01');
const startedHtml = renderPreDepartureShell(started.session);
assert.ok(startedHtml.includes('data-before-departure-state>CONTEXT_SELECTION'));
assert.equal(startedHtml.includes('data-before-departure-start'), false);
assert.ok(startedHtml.includes('E6.4'));

const selected = transitionPreDeparture(started.session, {
  type: 'SELECT_CONTEXT',
  contexts: ['local'],
  applicableCheckIds: ['vehicle', 'driver'],
});
assert.equal(selected.applied, true);
const withProblem = applyPreDepartureAnswer(selected.session, 'vehicle', 'problem', 'ro');
const withSecondAnswer = applyPreDepartureAnswer(withProblem.session, 'driver', 'confirmed', 'ro');
const blocked = completePreDepartureAssessment(withSecondAnswer.session);
assert.equal(blocked.session.state, 'BLOCKED');
const repaired = applyPreDepartureAnswer(blocked.session, 'vehicle', 'confirmed', 'ro');
assert.equal(repaired.applied, true);
assert.equal(repaired.transitionId, 'E6-T12');
assert.equal(repaired.session.state, 'READY_TO_CONFIRM');
const reopened = applyPreDepartureAnswer(repaired.session, 'driver', 'problem', 'ro');
assert.equal(reopened.applied, true);
assert.equal(reopened.transitionId, 'E6-T14');
assert.equal(reopened.session.state, 'NEEDS_ATTENTION');

const naSession = applyPreDepartureAnswer(selected.session, 'vehicle', 'na', 'ro');
const naHtml = renderPreDepartureShell(naSession.session);
assert.ok(naHtml.includes('Neaplicabil'));
assert.equal(naHtml.includes('Not applicable for this context'), false);

const cleanFirst = applyPreDepartureAnswer(selected.session, 'vehicle', 'confirmed', 'ro');
const cleanSecond = applyPreDepartureAnswer(cleanFirst.session, 'driver', 'confirmed', 'ro');
const confirmed = completePreDepartureAssessment(cleanSecond.session);
assert.equal(confirmed.applied, true);
assert.equal(confirmed.transitionId, 'E6-T15');
assert.equal(confirmed.session.state, 'CONFIRMED');

console.log('E6.3 Browser navigation and shell tests passed.');
