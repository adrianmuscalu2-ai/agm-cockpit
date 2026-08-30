import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fileSha = (relative) => sha(readFileSync(path.join(root, relative)));
const execute = (script, args = []) => {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${script} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
};

const before = { registry: fileSha(registryPath), routingTollView: fileSha(viewPath) };
const applyFirstOutput = execute('scripts/apply-routing-toll-001-final-atomic.mjs', ['--product-owner-authorized']);
const applySecondOutput = execute('scripts/apply-routing-toll-001-final-atomic.mjs', ['--product-owner-authorized']);
const closureFirstOutput = execute('scripts/test-routing-toll-001-final-atomic-closure-readonly.mjs');
const closureSecondOutput = execute('scripts/test-routing-toll-001-final-atomic-closure-readonly.mjs');
const freshnessFirstOutput = execute('scripts/validate-source-freshness-alert-rule.mjs');
const freshnessSecondOutput = execute('scripts/validate-source-freshness-alert-rule.mjs');
const after = { registry: fileSha(registryPath), routingTollView: fileSha(viewPath) };

const applyFirst = JSON.parse(applyFirstOutput);
const applySecond = JSON.parse(applySecondOutput);
const protectedPass = JSON.stringify(before) === JSON.stringify(after)
  && after.registry === '462db7f3a72204010972aa605901783997feff9ada7aac760ab03b358b2cd076'
  && after.routingTollView === '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0';
const applyPass = applyFirst.status === 'ALREADY_APPLIED_IDEMPOTENT_PASS'
  && applySecond.status === 'ALREADY_APPLIED_IDEMPOTENT_PASS'
  && applyFirst.operationsReexecuted === 0
  && applySecond.operationsReexecuted === 0
  && sha(applyFirstOutput) === sha(applySecondOutput);
const closurePass = sha(closureFirstOutput) === sha(closureSecondOutput);
const freshnessPass = sha(freshnessFirstOutput) === sha(freshnessSecondOutput);

const report = {
  validator: 'ROUTING-TOLL-001_FINAL_ATOMIC_CLOSURE_IDEMPOTENCE',
  verdict: applyPass && closurePass && freshnessPass && protectedPass ? 'PASS' : 'FAIL',
  applyIdempotence: { status: applyPass ? 'PASS' : 'FAIL', operationsReexecuted: 0, firstSha256: sha(applyFirstOutput), secondSha256: sha(applySecondOutput) },
  closureValidatorIdempotence: { status: closurePass ? 'PASS' : 'FAIL', firstSha256: sha(closureFirstOutput), secondSha256: sha(closureSecondOutput) },
  freshnessValidatorIdempotence: { status: freshnessPass ? 'PASS' : 'FAIL', firstSha256: sha(freshnessFirstOutput), secondSha256: sha(freshnessSecondOutput) },
  protectedAppliedState: { status: protectedPass ? 'PASS' : 'FAIL', before, after },
};
console.log(JSON.stringify(report, null, 2));
if (report.verdict !== 'PASS') process.exitCode = 1;
