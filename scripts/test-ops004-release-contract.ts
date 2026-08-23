import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const compose = read('deploy/production/compose.production.yml');
const service = read('deploy/production/agm-production-api.service');
const lifecycle = read('deploy/production/API_LIFECYCLE_RUNBOOK.md');
const pre = read('deploy/production/PRE_CHANGE_CHECKLIST.md');
const post = read('deploy/production/POST_DEPLOYMENT_CHECKLIST.md');
const rollback = read('deploy/production/ROLLBACK_RUNBOOK.md');
const roles = read('deploy/production/OPERATIONAL_ROLES.md');
const environment = read('deploy/production/production.env.template');

assert.match(compose, /image:\s*"\$\{AGM_IMAGE:\?AGM_IMAGE must be set by Release & Operations\}"/);
assert.match(service, /EnvironmentFile=\/opt\/agm\/production\/release\.env/);
assert.match(service, /ExecStartPre=\/usr\/bin\/docker image inspect \$\{AGM_IMAGE\}/);
assert.ok(lifecycle.includes('/opt/agm/production/release.env'));
assert.match(rollback, /API image: `agm-api@sha256:[a-f0-9]{64}`/);
assert.doesNotMatch(compose, /^\s*build:/m);
assert.doesNotMatch(compose, /^\s{2}postgres:/m);
assert.doesNotMatch(compose, /^volumes:/m);
assert.match(compose, /"127\.0\.0\.1:3000:3000"/);
assert.match(compose, /external:\s*true/);
assert.match(compose, /name:\s*app_default/);
assert.match(compose, /no-new-privileges:true/);

for (const name of ['POSTGRES_PASSWORD', 'JWT_SECRET', 'OPENAI_API_KEY', 'AGM_TURN_ADMIN_PIN_HASH']) {
  assert.match(environment, new RegExp(`^${name}=<REDACTED_REQUIRED`, 'm'));
}
assert.doesNotMatch(environment, /^\w*(?:PASSWORD|SECRET|API_KEY)=([^<\r\n].*)$/m);

for (const requirement of ['Separate deployment/routing mandate', 'Independent Validator', 'Rollback Responsible', 'STOP channel']) {
  assert.ok(pre.includes(requirement), `Missing pre-change requirement: ${requirement}`);
}
assert.match(pre, /unchecked mandatory item is an automatic NO-GO/i);
assert.match(roles, /No role may approve and independently validate the same action/);
assert.match(roles, /does not authorize deployment/i);
assert.match(rollback, /without deleting its volume/);
assert.match(rollback, /exactly one approved origin/);
for (const check of ['health/live', 'health/ready', 'Backup', 'restore rehearsal', 'zero failed or partial']) {
  assert.ok(post.toLowerCase().includes(check.toLowerCase()), `Missing post-deployment check: ${check}`);
}

console.log('OPS-004 release, deployment and rollback contract: PASS');
