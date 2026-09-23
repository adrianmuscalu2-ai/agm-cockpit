import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = (await readFile(new URL('../.github/workflows/production-release.yml', import.meta.url), 'utf8'))
  .replace(/\r\n/g, '\n');

function job(id) {
  const marker = `  ${id}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing workflow job: ${id}`);
  const next = workflow.slice(start + marker.length).search(/^  [a-z0-9-]+:\s*$/m);
  return next === -1
    ? workflow.slice(start)
    : workflow.slice(start, start + marker.length + next);
}

function ordered(source, labels) {
  let cursor = -1;
  for (const label of labels) {
    const next = source.indexOf(label);
    assert.ok(next > cursor, `Expected ordered workflow stage: ${label}`);
    cursor = next;
  }
}

const deploy = job('deploy');
const deploymentHealth = job('deployment-health');
const certification = job('post-deploy-certification');
const browser = job('production-agent-runtime-browser');

assert.match(deploy, /needs: \[publish, publish-web\]/);
assert.match(deploy, /environment: Production/);
assert.match(deploy, /DEPLOYMENT=PASS/);
assert.match(deploy, /CERTIFICATION=PENDING/);
assert.doesNotMatch(deploy, /Activate Operational Linguistic Baseline V1 atomically/);
assert.doesNotMatch(deploy, /Verify canonical M2M lifecycle in Production/);
assert.doesNotMatch(deploy, /FINAL_PRODUCTION_PASS/);

assert.match(deploymentHealth, /needs: deploy/);
assert.match(deploymentHealth, /validate-production-deployment-health\.mjs/);

assert.match(certification, /needs: deployment-health/);
assert.match(certification, /environment: Production/);
ordered(certification, [
  'Activate Operational Linguistic Baseline V1 atomically',
  'Verify TURN operational truth after canonical activation',
  'Verify canonical M2M lifecycle in Production',
  'Persist Production agent runtime evidence',
  'Publish current Production preflight automatically',
  'Record post-deploy certification result',
]);
assert.match(certification, /id-token: write/);
assert.match(certification, /AGM_API_ORIGIN: https:\/\/api\.agmcockpit\.com/);
assert.match(certification, /publish:operational-linguists-v1:activate/);
assert.doesNotMatch(certification, /PRODUCTION_TURN_ADMIN_PIN/);
assert.match(certification, /CERTIFICATION=PASS/);

assert.match(browser, /needs: \[deployment-health, post-deploy-certification\]/);
assert.match(browser, /if: \$\{\{ always\(\) && needs\.deployment-health\.result == 'success' \}\}/);
ordered(browser, [
  'Validate live Production operational truth after soak',
  'Download certification accountability evidence',
  'Validate Production TURN with real Production snapshot',
  'Validate Production TURN responsive matrix and canonical branding',
  'Report complete post-deploy certification truth',
]);
assert.match(browser, /CERTIFICATION_JOB: \$\{\{ needs\.post-deploy-certification\.result \}\}/);
assert.match(browser, /FINAL_PRODUCTION_PASS=PASS/);

console.log(JSON.stringify({
  status: 'PASS',
  phases: ['deploy', 'deployment-health', 'post-deploy-certification', 'production-agent-runtime-browser'],
  deploymentTruthSeparated: true,
  browserRunsAfterCertificationFailure: true,
}));
