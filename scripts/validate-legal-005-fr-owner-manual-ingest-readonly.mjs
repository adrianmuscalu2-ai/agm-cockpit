import { readJson, verifyProtectedBaseline } from './legal-gap-owner-review-common.mjs';
import { validateFranceOwnerIngest } from './legal-005-fr-owner-ingest-common.mjs';

const OUT = 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW';
const manifest = readJson(`${OUT}/OWNER_MANUAL_INGEST_MANIFEST.json`);
const baselineBefore = verifyProtectedBaseline();
const artifacts = validateFranceOwnerIngest(manifest, OUT);
const missing = artifacts.filter((item) => item.result === 'MISSING');
const failed = artifacts.filter((item) => item.result === 'FAIL');
const passed = artifacts.filter((item) => item.result === 'PASS');
const baselineAfter = verifyProtectedBaseline();
const protectedBaselineUnchanged = JSON.stringify(baselineBefore) === JSON.stringify(baselineAfter);

let result = 'PASS';
let blocker = null;
if (failed.length || !protectedBaselineUnchanged) {
  result = 'FAIL';
  blocker = failed.length ? 'FR_OWNER_MANUAL_INGEST_VALIDATION_FAILED' : 'PROTECTED_BASELINE_CHANGED';
} else if (missing.length) {
  result = passed.length ? 'PARTIAL_PASS_EXPECTED_FILES_MISSING' : 'BLOCKED_EXPECTED_FILES_MISSING';
  blocker = 'FR_OWNER_MANUAL_INGEST_REQUIRED';
}

console.log(JSON.stringify({
  validator: 'LEGAL-005_FR_OWNER_MANUAL_INGEST_READ_ONLY',
  result,
  blocker,
  resolved: passed.map((item) => item.sourceId),
  artifacts,
  missing: missing.map((item) => {
    const metadata = manifest.artifacts.find((artifact) => artifact.sourceId === item.sourceId);
    return { sourceId: item.sourceId, filename: item.filename, officialPageUrl: metadata.officialPageUrl };
  }),
  protectedBaselineUnchanged,
  registryMutation: 'NONE',
  viewMutation: 'NONE',
  authorityPromotion: 'NONE',
}, null, 2));

if (result === 'FAIL') process.exit(1);
