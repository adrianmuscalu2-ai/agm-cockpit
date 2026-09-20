import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/production-release.yml';
const workflow = readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n');

const workflowLines = workflow.split('\n');
const sshInvocations = [];
for (let index = 0; index < workflowLines.length; index += 1) {
  const firstLine = workflowLines[index].trim();
  const invocation = firstLine.match(/(?:^|\|\s*)(ssh|scp)(?=\s)/);
  if (!invocation) continue;

  const startLine = index + 1;
  const commandLines = [firstLine];
  while (/\\\s*$/.test(workflowLines[index])) {
    index += 1;
    commandLines.push(workflowLines[index].trim());
  }
  sshInvocations.push({ command: commandLines.join('\n'), protocol: invocation[1], startLine });
}

assert.equal(/appleboy\/(?:ssh|scp)-action/.test(workflow), false, 'Dynamic appleboy SSH/SCP actions must not be used.');
assert.match(workflow, /command -v ssh >\/dev\/null/);
assert.match(workflow, /command -v scp >\/dev\/null/);
assert.match(workflow, /ssh-keyscan -T 15 -H "\$PRODUCTION_HOST"/);
assert.ok(sshInvocations.length > 0, 'At least one Production SSH/SCP invocation must be present.');
for (const { command, protocol, startLine } of sshInvocations) {
  const location = `${protocol.toUpperCase()} invocation at workflow line ${startLine}`;
  assert.match(command, /(?:^|\s)-o\s+BatchMode=yes(?:\s|$)/, `${location} must disable interactive authentication.`);
  assert.match(command, /(?:^|\s)-o\s+IdentitiesOnly=yes(?:\s|$)/, `${location} must offer only the dedicated Production key.`);
  assert.match(command, /(?:^|\s)-o\s+StrictHostKeyChecking=yes(?:\s|$)/, `${location} must require strict host-key checking.`);
  assert.match(command, /UserKnownHostsFile=/, `${location} must use the isolated known_hosts file.`);
}
assert.equal((workflow.match(/AGM_REMOTE_DEPLOY/g) ?? []).length, 2, 'The deployment heredoc must be closed exactly once.');
assert.equal((workflow.match(/AGM_REMOTE_PREFLIGHT/g) ?? []).length, 2, 'The preflight heredoc must be closed exactly once.');
assert.match(workflow, /- name: Remove ephemeral OpenSSH material[\s\S]*?if: \$\{\{ always\(\) \}\}/);
assert.match(workflow, /rm -f -- "\$AGM_SSH_KEY_FILE"/);
assert.match(workflow, /rm -f -- "\$AGM_SSH_KNOWN_HOSTS_FILE"/);

const deployJob = workflow.indexOf('\n  deploy:\n');
const stage = workflow.indexOf('- name: Prepare isolated OpenSSH transport');
const deploy = workflow.indexOf('- name: Deploy approved digest');
const deploymentCleanup = workflow.indexOf('- name: Remove deployment OpenSSH material');
const deploymentHealth = workflow.indexOf('\n  deployment-health:\n');
const certificationJob = workflow.indexOf('\n  post-deploy-certification:\n');
const certificationStage = workflow.indexOf('- name: Prepare isolated OpenSSH transport for certification evidence');
const preflight = workflow.indexOf('- name: Publish current Production preflight');
const cleanup = workflow.indexOf('- name: Remove ephemeral OpenSSH material');
assert.ok(
  deployJob >= 0 && deployJob < stage && stage < deploy && deploy < deploymentCleanup
    && deploymentCleanup < deploymentHealth && deploymentHealth < certificationJob
    && certificationJob < certificationStage && certificationStage < preflight && preflight < cleanup,
  'OpenSSH stage/deploy/deployment-health/certification/preflight/cleanup order is invalid.',
);
assert.match(workflow, /deployment-health:\n[\s\S]*?needs: deploy/);
assert.match(workflow, /post-deploy-certification:\n[\s\S]*?needs: deployment-health/);
const remoteDeployMatch = workflow.match(/cat <<'AGM_REMOTE_DEPLOY'[\s\S]*?\r?\n\s*AGM_REMOTE_DEPLOY\r?\n/);
assert.ok(remoteDeployMatch, 'The remote Production deployment body must be present.');
const remoteDeploy = remoteDeployMatch[0];
assert.match(remoteDeploy, /run-permission-guardian-production-negative\.cjs/);
assert.equal(/\|\s*jq\b/.test(remoteDeploy), false, 'The remote Production host must not require optional jq for Guardian validation.');

console.log(JSON.stringify({
  contract: 'agm-production-openssh-transport.v1',
  verdict: 'PASS',
  dynamicRuntimeDownloads: 0,
  sshScpInvocations: sshInvocations.length,
  securedInvocations: sshInvocations.length,
  ephemeralCleanup: true,
}));
