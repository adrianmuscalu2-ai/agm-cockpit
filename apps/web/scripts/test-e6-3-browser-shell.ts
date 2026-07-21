import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createPreDepartureSession,
  transitionPreDeparture,
} from '../src/pre-departure/pre-departure.machine';
import { renderPreDepartureShell } from '../src/pre-departure/pre-departure.shell';

const htmlEntry = readFileSync(new URL('../before-departure.html', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.mjs', import.meta.url), 'utf8');
const premiumSource = readFileSync(new URL('../src/premium-app.ts', import.meta.url), 'utf8');

assert.ok(htmlEntry.includes('id="before-departure-app"'));
assert.ok(htmlEntry.includes('/src/pre-departure/pre-departure.entry.ts'));
assert.ok(mainSource.includes('href="/before-departure.html"'));
assert.ok(mainSource.includes('data-e6-entry="before-departure"'));
assert.ok(viteConfig.includes("beforeDeparture: 'before-departure.html'"));
assert.equal(premiumSource.includes('before-departure'), false);

const initialHtml = renderPreDepartureShell(createPreDepartureSession());
assert.ok(initialHtml.includes('data-e6-entry="before-departure"'));
assert.ok(initialHtml.includes('data-before-departure-state>NOT_STARTED'));
assert.ok(initialHtml.includes('data-before-departure-start'));
assert.ok(initialHtml.includes('nu transmite date'));
assert.ok(initialHtml.includes('E6.6'));

const started = transitionPreDeparture(createPreDepartureSession(), { type: 'START_SESSION' });
assert.equal(started.transitionId, 'E6-T01');
const startedHtml = renderPreDepartureShell(started.session);
assert.ok(startedHtml.includes('data-before-departure-state>CONTEXT_SELECTION'));
assert.equal(startedHtml.includes('data-before-departure-start'), false);
assert.ok(startedHtml.includes('E6.4'));

console.log('E6.3 Browser navigation and shell tests passed.');
