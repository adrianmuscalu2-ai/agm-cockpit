import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyProtectedBaseline } from './legal-gap-owner-review-common.mjs';

const root = resolve(process.cwd());
const packageRoots = [
  resolve(root, 'AGM_LIBRARY/PHASE3/LEGAL_003_OWNER_REVIEW'),
  resolve(root, 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW'),
];

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'EVIDENCE' ? [] : files(path);
    return entry.name === 'VALIDATION_EVIDENCE.json' ? [] : [path];
  });
}

function snapshot() {
  return Object.fromEntries(packageRoots.flatMap(files).sort().map((path) => [
    relative(root, path).replaceAll('\\', '/'),
    createHash('sha256').update(readFileSync(path)).digest('hex'),
  ]));
}

const baselineBefore = verifyProtectedBaseline();
const before = snapshot();
for (const script of ['scripts/build-legal-003-owner-review.mjs', 'scripts/build-legal-005-owner-review.mjs']) {
  const run = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`REBUILD_FAILED:${script}:${run.stderr}`);
}
const after = snapshot();
const baselineAfter = verifyProtectedBaseline();
const keysEqual = JSON.stringify(Object.keys(before)) === JSON.stringify(Object.keys(after));
const changed = Object.keys(before).filter((key) => before[key] !== after[key]);
const result = keysEqual && changed.length === 0 && JSON.stringify(baselineBefore) === JSON.stringify(baselineAfter) ? 'PASS' : 'FAIL';

console.log(JSON.stringify({ validator:'LEGAL_GAPS_OWNER_REVIEW_IDEMPOTENCE', result, comparedFiles:Object.keys(before).length, changed, protectedBaselineBefore:baselineBefore, protectedBaselineAfter:baselineAfter }, null, 2));
if (result !== 'PASS') process.exit(1);
