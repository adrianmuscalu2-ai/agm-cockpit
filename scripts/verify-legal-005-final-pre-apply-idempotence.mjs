import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputs = [
  'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY/PROJECTED_REGISTRY.json',
  'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY/PROJECTED_LEGISLATION_SAFETY_VIEW.json',
  'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY/PROJECTED_CHANGESET.json',
  'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY/CONSOLIDATED_AUTHORITY_TEMPORAL_REVIEW.json',
  'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY/FINAL_PRE_APPLY_PACKAGE.json',
  'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY/FINAL_PRE_APPLY_REPORT.md',
];
const protectedFiles = [
  'AGM_LIBRARY/REGISTRY/canonical-sources.json',
  'AGM_LIBRARY/VIEWS/legislation-safety.view.json',
  'AGM_LIBRARY/VIEWS/routing-toll.view.json',
];
const hash = (relative) => createHash('sha256').update(readFileSync(path.join(root, relative))).digest('hex');
const snapshot = (files) => Object.fromEntries(files.map((file) => [file, hash(file)]));
const runBuilder = () => {
  const run = spawnSync(process.execPath, ['scripts/build-legal-005-final-pre-apply.mjs'], { cwd:root, encoding:'utf8' });
  if (run.status !== 0) throw new Error(`BUILD_FAILED:${run.stderr || run.stdout}`);
};

const protectedBefore = snapshot(protectedFiles);
runBuilder();
const first = snapshot(outputs);
runBuilder();
const second = snapshot(outputs);
const protectedAfter = snapshot(protectedFiles);
const changed = outputs.filter((file) => first[file] !== second[file]);
const protectedChanged = protectedFiles.filter((file) => protectedBefore[file] !== protectedAfter[file]);
const result = changed.length === 0 && protectedChanged.length === 0 ? 'PASS' : 'FAIL';
console.log(JSON.stringify({
  validator:'LEGAL005_FINAL_PRE_APPLY_IDEMPOTENCE',
  result,
  comparedFiles:outputs.length,
  changed,
  deterministicRegeneration:changed.length === 0 ? 'PASS' : 'FAIL',
  protectedFilesChanged:protectedChanged,
  protectedBaselineBefore:protectedBefore,
  protectedBaselineAfter:protectedAfter,
}, null, 2));
if (result !== 'PASS') process.exit(1);
