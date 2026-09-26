import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = (await readFile(new URL('../.github/workflows/production-browser-certification-only.yml', import.meta.url), 'utf8'))
  .replace(/\r\n/g, '\n');

assert.match(workflow, /^on:\n  workflow_dispatch:\s*$/m);
assert.doesNotMatch(workflow, /^\s{2}(push|schedule|workflow_run|repository_dispatch):/m);
assert.match(workflow, /permissions:\n  actions: read\n  contents: read\n  deployments: read/);
assert.doesNotMatch(workflow, /^\s+environment:\s*Production\s*$/m);
assert.doesNotMatch(workflow, /id-token:\s*write|packages:\s*write|contents:\s*write|deployments:\s*write/);

const usedActions = [...workflow.matchAll(/^\s+(?:- )?uses:\s*(\S+)\s*$/gm)].map((match) => match[1]);
assert.deepEqual([...new Set(usedActions)].sort(), [
  'actions/checkout@v5',
  'actions/download-artifact@v4',
  'actions/setup-node@v5',
  'actions/upload-artifact@v4',
  'pnpm/action-setup@v5',
].sort());

for (const forbidden of [
  /docker\/build-push-action/,
  /docker\/login-action/,
  /\b(?:ssh|scp|rsync|systemctl|kubectl)\b/,
  /\bdocker\s+(?:build|pull|run|restart|compose)\b/,
  /curl[^\n]*(?:-X|--request)\s*(?:POST|PUT|PATCH|DELETE)/i,
  /publish:operational-linguists/,
  /inspector-failover\/exercise/,
  /actions\/deploy-pages/,
]) assert.doesNotMatch(workflow, forbidden);

for (const required of [
  '895451b11a46c3f73fc572a3e6831a9a356c312f',
  'sha256:09143af3de9d817bae66b2a630f510b3c51e6eef6363945a01459715d5b01082',
  'sha256:cf9b5a12e5687ddcc19e77ffbaea5aa453457935f1c3d5e4d142068b0ce56746',
  'node scripts/validate-turn-operational-truth-browser.mjs',
  'node scripts/validate-agent-accountability-browser.mjs',
  'node scripts/validate-operational-linguists-v1-browser.mjs',
  'node scripts/validate-turn-responsive-brand-browser.mjs',
  'NO BUILD',
  'NO PUBLISH',
  'NO DEPLOY',
  'NO RESTART',
  'NO PRODUCTION MUTATION',
]) assert.ok(workflow.includes(required), `Missing certification boundary: ${required}`);

const preflights = workflow.match(/pnpm rescue:browser-preflight/g) ?? [];
assert.equal(preflights.length, 4, 'Every Browser validator must have its own preflight.');

console.log(JSON.stringify({
  status: 'PASS',
  trigger: 'workflow_dispatch only',
  permissions: ['actions:read', 'contents:read', 'deployments:read'],
  productionCredentials: false,
  mutationCapabilities: false,
  browserValidators: 4,
}));
