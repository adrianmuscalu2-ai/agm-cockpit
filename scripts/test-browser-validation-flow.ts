import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const agents = read('AGENTS.md');
const runbook = read('deploy/operations/BROWSER_VALIDATION_RUNBOOK.md');

for (const field of [
  'Browser Plugin Status',
  'Integrated Browser Control Status',
  'Browser Session Status',
  'Target Page Status',
]) {
  assert.ok(agents.includes(field), `AGENTS.md missing ${field}`);
  assert.ok(runbook.includes(field), `Runbook missing ${field}`);
}

for (const requirement of [
  'AGM unattended Playwright + Chromium runner',
  'An ordinary Chrome window is not a controlled audit session',
  'resume the interrupted audit automatically',
  'HOLD is permitted only when the recovery sequence has been exhausted',
  'pnpm audit:wave1-browser',
]) {
  assert.ok(runbook.includes(requirement), `Runbook missing requirement: ${requirement}`);
}

assert.match(agents, /Continue automatically after recovery PASS/i);
assert.match(runbook, /restart, update, or reinstall/i);
assert.match(runbook, /navigation and capture/i);

console.log('AGM Browser validation permanent flow contract: PASS');
