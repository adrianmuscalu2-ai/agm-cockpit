import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CONSOLIDATED_PRE_APPLY';
const builder = 'scripts/build-routing-toll-001-final-consolidated-pre-apply.mjs';
const validator = 'scripts/test-routing-toll-001-final-consolidated-pre-apply-readonly.mjs';
const freshnessValidator = 'scripts/validate-source-freshness-alert-rule.mjs';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const packageFiles = [
  'CH_VIGNETTE_RECAPTURE_MANIFEST.json',
  'FINAL_ATOMIC_CHANGESET.json',
  'EXACT_ATOMIC_APPLY_IMPACT.json',
  'FINAL_PRE_APPLY_PACKAGE.json',
  'FINAL_PRE_APPLY_REPORT.md',
];

const sha = (value) => createHash('sha256').update(value).digest('hex');
const read = (relative) => readFileSync(path.join(root, relative));
const fileSha = (relative) => sha(read(relative));
const snapshot = () => Object.fromEntries(packageFiles.map((name) => [name, fileSha(`${outputRoot}/${name}`)]));
const execute = (script) => {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${script} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
};

const protectedBefore = { registry: fileSha(registryPath), routingTollView: fileSha(viewPath) };
execute(builder);
const packageFirst = snapshot();
execute(builder);
const packageSecond = snapshot();
const validatorFirst = sha(execute(validator));
const validatorSecond = sha(execute(validator));
const freshnessFirst = sha(execute(freshnessValidator));
const freshnessSecond = sha(execute(freshnessValidator));
const protectedAfter = { registry: fileSha(registryPath), routingTollView: fileSha(viewPath) };

const packagePass = JSON.stringify(packageFirst) === JSON.stringify(packageSecond);
const validatorPass = validatorFirst === validatorSecond;
const freshnessPass = freshnessFirst === freshnessSecond;
const protectedPass = JSON.stringify(protectedBefore) === JSON.stringify(protectedAfter)
  && protectedAfter.registry === 'f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d'
  && protectedAfter.routingTollView === '001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997';

const report = {
  validator: 'ROUTING-TOLL-001_FINAL_CONSOLIDATED_IDEMPOTENCE',
  verdict: packagePass && validatorPass && freshnessPass && protectedPass ? 'PASS' : 'FAIL',
  packageRegeneration: { status: packagePass ? 'PASS' : 'FAIL', first: packageFirst, second: packageSecond },
  finalReadOnlyValidator: { status: validatorPass ? 'PASS' : 'FAIL', firstSha256: validatorFirst, secondSha256: validatorSecond },
  freshnessReadOnlyValidator: { status: freshnessPass ? 'PASS' : 'FAIL', firstSha256: freshnessFirst, secondSha256: freshnessSecond },
  protectedFiles: { status: protectedPass ? 'PASS' : 'FAIL', before: protectedBefore, after: protectedAfter },
};
console.log(JSON.stringify(report, null, 2));
if (report.verdict !== 'PASS') process.exitCode = 1;
