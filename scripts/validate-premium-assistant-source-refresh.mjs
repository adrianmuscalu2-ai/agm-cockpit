import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = 'AGM_LIBRARY/PHASE3/PREMIUM_ASSISTANT_SOURCE_REFRESH_20260912/REFRESH_MANIFEST.json';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const manifest = json(manifestPath);
const registry = json(registryPath);
const byId = new Map(registry.sources.map((source) => [source.sourceId, source]));

assert.equal(manifest.applied, true);
assert.equal(manifest.allowlist.expectedCount, 16);
assert.equal(manifest.policy.ttlSeconds, 604800);
assert.equal(manifest.policy.ttlExtendedWithoutVerification, false);
assert.equal(manifest.policy.exactByteIdentityRequiredForAutomaticCurrentness, true);
assert.equal(manifest.records.length, 16);
assert.deepEqual(manifest.counts, {
  total: 16,
  confirmedCurrent: 2,
  newVersionDetected: 12,
  freshnessUnknown: 2,
});
assert.equal(hashFile(registryPath), manifest.registry.afterSha256);

for (const record of manifest.records) {
  const source = byId.get(record.sourceId);
  assert.ok(source, 'Refresh record has no registry source: ' + record.sourceId);
  assert.equal(hashFile(record.canonicalPath), record.priorSha256);
  assert.ok(source.evidenceRefs.includes(manifestPath));
  assert.equal(source.freshness.lastFreshnessCheck, manifest.checkedAt);
  if (record.outcome === 'CONFIRMED_CURRENT') {
    assert.equal(record.observedSha256, record.priorSha256);
    assert.equal(source.freshness.currentStatus, 'CURRENT');
    assert.equal(source.freshness.reviewRequired, false);
    assert.equal(
      Date.parse(source.freshness.nextFreshnessCheck) - Date.parse(source.freshness.lastFreshnessCheck),
      manifest.policy.ttlSeconds * 1000,
    );
  } else if (record.outcome === 'NEW_VERSION_DETECTED') {
    assert.notEqual(record.observedSha256, record.priorSha256);
    assert.equal(hashFile(record.candidatePath), record.observedSha256);
    assert.equal(source.freshness.currentStatus, 'NEW_VERSION_DETECTED');
    assert.equal(source.freshness.reviewRequired, true);
  } else {
    assert.equal(record.outcome, 'FRESHNESS_UNKNOWN');
    assert.equal(source.freshness.currentStatus, 'FRESHNESS_UNKNOWN');
    assert.equal(source.freshness.reviewRequired, true);
  }
}

const approvedCurrent = registry.sources.filter((source) =>
  source.freshness?.currentStatus === 'CURRENT' && isApproved(source.authority?.reviewStatus));
assert.deepEqual(
  approvedCurrent.map((source) => source.sourceId).sort(),
  ['CS-DE-BFSTRMG', 'CS-DE-TOLL-COLLECT-RATES'],
);

console.log(JSON.stringify({
  contract: 'agm-premium-assistant-source-refresh-validation.v1',
  verdict: 'PASS',
  counts: manifest.counts,
  egressEligible: approvedCurrent.length,
  registrySha256: manifest.registry.afterSha256,
}));

function json(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
}

function isApproved(value = '') {
  const status = value.toUpperCase();
  const approved = status === 'APPROVED' || /(?:^|_)APPROVED(?:_|$)/.test(status);
  const restricted = /NOT_APPROVED|NOT_AUTHORIZED|NOT_PROMOTED|PENDING|DRAFT|REVOKED|DENIED|REJECTED|SUSPENDED|EXPIRED/.test(status);
  return approved && !restricted;
}
