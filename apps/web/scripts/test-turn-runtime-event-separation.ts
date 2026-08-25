import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/turn-agent-live-state.ts', import.meta.url), 'utf8');

assert.match(source, /row\.dataset\.lastRuntimeLifecycle = event\.lifecycle/);
assert.match(source, /row\.dataset\.lastRuntimeMandate = event\.mandateId/);
assert.doesNotMatch(source, /row\.classList\.add\(tone\(event\.lifecycle\)\)/, 'A terminal mandate result must not overwrite canonical agent availability.');
assert.doesNotMatch(source, /status\.textContent = event\.lifecycle/, 'Last-run lifecycle must remain separate from registry status.');

console.log('TURN runtime event / agent availability separation: PASS');
