import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/production-release.yml';
const workflow = readFileSync(workflowPath, 'utf8');

assert.equal(/appleboy\/(?:ssh|scp)-action/.test(workflow), false, 'Dynamic appleboy SSH/SCP actions must not be used.');
assert.match(workflow, /command -v ssh >\/dev\/null/);
assert.match(workflow, /command -v scp >\/dev\/null/);
assert.match(workflow, /ssh-keyscan -T 15 -H "\$PRODUCTION_HOST"/);
assert.equal((workflow.match(/StrictHostKeyChecking=yes/g) ?? []).length, 4, 'Every SSH/SCP invocation must enforce the isolated known_hosts file.');
assert.equal((workflow.match(/UserKnownHostsFile=/g) ?? []).length, 4, 'Every SSH/SCP invocation must use the isolated known_hosts file.');
assert.equal((workflow.match(/BatchMode=yes/g) ?? []).length, 4, 'Interactive SSH authentication must stay disabled.');
assert.equal((workflow.match(/IdentitiesOnly=yes/g) ?? []).length, 4, 'Only the dedicated Production key may be offered.');
assert.equal((workflow.match(/AGM_REMOTE_DEPLOY/g) ?? []).length, 2, 'The deployment heredoc must be closed exactly once.');
assert.equal((workflow.match(/AGM_REMOTE_PREFLIGHT/g) ?? []).length, 2, 'The preflight heredoc must be closed exactly once.');
assert.match(workflow, /- name: Remove ephemeral OpenSSH material[\s\S]*?if: \$\{\{ always\(\) \}\}/);
assert.match(workflow, /rm -f -- "\$AGM_SSH_KEY_FILE"/);
assert.match(workflow, /rm -f -- "\$AGM_SSH_KNOWN_HOSTS_FILE"/);

const stage = workflow.indexOf('- name: Prepare isolated OpenSSH transport');
const deploy = workflow.indexOf('- name: Deploy approved digest');
const preflight = workflow.indexOf('- name: Publish current Production preflight');
const cleanup = workflow.indexOf('- name: Remove ephemeral OpenSSH material');
assert.ok(stage >= 0 && stage < deploy && deploy < preflight && preflight < cleanup, 'OpenSSH stage/deploy/preflight/cleanup order is invalid.');

console.log(JSON.stringify({
  contract: 'agm-production-openssh-transport.v1',
  verdict: 'PASS',
  dynamicRuntimeDownloads: 0,
  strictHostChecks: 4,
  ephemeralCleanup: true,
}));
