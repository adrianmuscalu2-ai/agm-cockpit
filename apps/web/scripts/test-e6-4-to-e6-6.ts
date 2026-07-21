import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { preDepartureCopy, preDepartureLanguages } from '../src/pre-departure/pre-departure.i18n';
import { createPreDepartureSession, transitionPreDeparture } from '../src/pre-departure/pre-departure.machine';
import { renderPreDepartureShell } from '../src/pre-departure/pre-departure.shell';
import { preDepartureCore } from '../src/pre-departure/pre-departure.module';

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

const viteConfig = readFileSync(new URL('../vite.config.mjs', import.meta.url), 'utf8');
assert.ok(viteConfig.includes("beforeDeparture: 'before-departure.html'"));

console.log('E6.4-E6.6 validation checks passed.');
