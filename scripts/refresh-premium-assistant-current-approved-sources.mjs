import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const registryRelativePath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const evidenceRelativeRoot = 'AGM_LIBRARY/PHASE3/PREMIUM_ASSISTANT_SOURCE_REFRESH_20260912';
const manifestRelativePath = evidenceRelativeRoot + '/REFRESH_MANIFEST.json';
const registryPath = resolve(root, registryRelativePath);
const evidenceRoot = resolve(root, evidenceRelativeRoot);
const candidateRoot = resolve(evidenceRoot, 'CANDIDATES');
const expectedCount = 16;
const ttlSeconds = 7 * 24 * 60 * 60;
const maximumBytes = 12 * 1024 * 1024;
const apply = process.argv.includes('--apply');
const expectedHashArgument = process.argv.find((value) => value.startsWith('--expected-registry-sha256='));
const expectedRegistrySha256 = expectedHashArgument?.split('=', 2)[1];

if (apply && !expectedRegistrySha256) throw new Error('EXPECTED_REGISTRY_SHA256_REQUIRED_FOR_APPLY');

const bytes = readFileSync(registryPath);
const beforeSha256 = sha256(bytes);
if (expectedRegistrySha256 && beforeSha256 !== expectedRegistrySha256) {
  throw new Error('REGISTRY_BASELINE_MISMATCH:' + beforeSha256);
}

const registry = JSON.parse(bytes.toString('utf8'));
const sources = registry.sources.filter((source) => isCurrent(source) && isApproved(source.authority?.reviewStatus));
assert.equal(sources.length, expectedCount, 'The controlled refresh allowlist must contain exactly 16 sources.');
for (const source of sources) validateSource(source);

const checkedAt = new Date();
const checkedAtIso = checkedAt.toISOString();
const nextFreshnessCheck = new Date(checkedAt.getTime() + ttlSeconds * 1000).toISOString();
const records = await concurrentMap(sources, 4, refreshSource);

const bySourceId = new Map(records.map((record) => [record.sourceId, record]));
if (apply) {
  mkdirSync(candidateRoot, { recursive: true });
  for (const record of records) {
    if (record.observedBytes && record.outcome === 'NEW_VERSION_DETECTED') {
      writeFileSync(resolve(root, record.candidatePath), record.observedBytes);
    }
  }
  for (const source of registry.sources) {
    const record = bySourceId.get(source.sourceId);
    if (!record) continue;
    const evidenceRefs = new Set([...(source.evidenceRefs ?? []), manifestRelativePath]);
    source.evidenceRefs = [...evidenceRefs];
    source.freshness = {
      ...(source.freshness ?? {}),
      capturedAt: source.freshness?.capturedAt ?? (source.sourceDate ? source.sourceDate + 'T00:00:00.000Z' : null),
      lastFreshnessCheck: checkedAtIso,
      nextFreshnessCheck: record.outcome === 'CONFIRMED_CURRENT'
        ? nextFreshnessCheck
        : source.freshness?.nextFreshnessCheck ?? null,
      currentStatus: record.outcome === 'CONFIRMED_CURRENT' ? 'CURRENT' : record.outcome,
      reviewRequired: record.outcome !== 'CONFIRMED_CURRENT',
      usageFallback: record.outcome === 'CONFIRMED_CURRENT'
        ? 'ALLOWED_WITHIN_APPROVED_SCOPE'
        : 'UNKNOWN_HUMAN_VERIFICATION',
      limitations: refreshLimitations(source.freshness?.limitations, record),
    };
  }
  registry.registryVersion = incrementPatch(registry.registryVersion);
  registry.generatedAt = checkedAtIso;
  const nextRegistry = Buffer.from(JSON.stringify(registry, null, 2) + '\n', 'utf8');
  writeFileSync(registryPath, nextRegistry);
}

const afterSha256 = apply ? sha256(readFileSync(registryPath)) : beforeSha256;
const publicRecords = records.map(({ observedBytes, ...record }) => record);
const counts = {
  total: records.length,
  confirmedCurrent: records.filter((record) => record.outcome === 'CONFIRMED_CURRENT').length,
  newVersionDetected: records.filter((record) => record.outcome === 'NEW_VERSION_DETECTED').length,
  freshnessUnknown: records.filter((record) => record.outcome === 'FRESHNESS_UNKNOWN').length,
};
const manifest = {
  schemaVersion: 'agm-premium-assistant-controlled-source-refresh.v1',
  checkedAt: checkedAtIso,
  applied: apply,
  allowlist: {
    sourceStatus: 'CURRENT',
    reviewStatus: 'APPROVED_WITHOUT_PENDING_OR_RESTRICTED_MARKERS',
    expectedCount,
  },
  policy: {
    ttlSeconds,
    ttlExtendedWithoutVerification: false,
    exactByteIdentityRequiredForAutomaticCurrentness: true,
    changedContentRequiresReview: true,
    failedCheckIsFailClosed: true,
  },
  registry: {
    path: registryRelativePath,
    beforeSha256,
    afterSha256,
    count: registry.sources.length,
  },
  counts,
  verdict: counts.freshnessUnknown > 0
    ? 'PARTIAL_FRESHNESS_UNKNOWN'
    : counts.newVersionDetected > 0
      ? 'REVIEW_REQUIRED_NEW_VERSION_DETECTED'
      : 'PASS_ALL_CONFIRMED_CURRENT',
  records: publicRecords,
};

if (apply) {
  mkdirSync(dirname(resolve(root, manifestRelativePath)), { recursive: true });
  writeFileSync(resolve(root, manifestRelativePath), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

console.log(JSON.stringify(manifest, null, 2));

async function refreshSource(source) {
  const priorPath = resolve(root, source.canonicalPath);
  const priorBytes = readFileSync(priorPath);
  const priorSha256 = sha256(priorBytes);
  if (priorSha256 !== source.sha256) throw new Error('SOURCE_BASELINE_HASH_MISMATCH:' + source.sourceId);
  const record = {
    sourceId: source.sourceId,
    requestedUrl: source.canonicalUri,
    canonicalPath: source.canonicalPath,
    priorSha256,
    priorBytes: priorBytes.length,
    checkedAt: checkedAtIso,
    httpStatus: null,
    finalUrl: null,
    mediaType: null,
    etag: null,
    lastModified: null,
    observedSha256: null,
    observedByteSize: null,
    outcome: 'FRESHNESS_UNKNOWN',
    candidatePath: null,
    failureReason: null,
    observedBytes: null,
  };
  try {
    const response = await fetch(source.canonicalUri, {
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/pdf,application/json,text/plain;q=0.9,*/*;q=0.1',
        'User-Agent': 'AGM-Controlled-Canonical-Refresh/1.0',
      },
      signal: AbortSignal.timeout(45_000),
    });
    record.httpStatus = response.status;
    record.finalUrl = response.url;
    record.mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim() ?? null;
    record.etag = response.headers.get('etag');
    record.lastModified = response.headers.get('last-modified');
    if (!response.ok) throw new Error('HTTP_' + response.status);
    if (!record.finalUrl?.startsWith('https://')) throw new Error('FINAL_URL_NOT_HTTPS');
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > maximumBytes) throw new Error('CONTENT_LENGTH_EXCEEDS_LIMIT');
    const observedBytes = Buffer.from(await response.arrayBuffer());
    if (observedBytes.length === 0 || observedBytes.length > maximumBytes) throw new Error('RESPONSE_SIZE_INVALID');
    record.observedSha256 = sha256(observedBytes);
    record.observedByteSize = observedBytes.length;
    if (record.observedSha256 === priorSha256) {
      record.outcome = 'CONFIRMED_CURRENT';
    } else {
      record.outcome = 'NEW_VERSION_DETECTED';
      const extension = safeExtension(source.canonicalPath, record.mediaType);
      record.candidatePath = evidenceRelativeRoot + '/CANDIDATES/' + safeName(source.sourceId) + '.observed' + extension;
      record.observedBytes = observedBytes;
    }
  } catch (error) {
    record.outcome = 'FRESHNESS_UNKNOWN';
    record.failureReason = error instanceof Error ? error.message : String(error);
  }
  return record;
}

function validateSource(source) {
  assert.match(source.sourceId, /^[A-Za-z0-9._-]+$/);
  assert.match(source.sha256, /^[a-f0-9]{64}$/i);
  const url = new URL(source.canonicalUri);
  assert.equal(url.protocol, 'https:');
  const canonicalRoot = resolve(root, 'AGM_LIBRARY');
  const target = resolve(root, source.canonicalPath);
  const contained = relative(canonicalRoot, target);
  assert.ok(contained && !contained.startsWith('..') && !isAbsolute(contained), 'Canonical path escapes AGM_LIBRARY.');
  assert.ok(existsSync(target), 'Canonical artifact is missing: ' + source.sourceId);
}

function isCurrent(source) {
  return source.freshness?.currentStatus
    ? source.freshness.currentStatus === 'CURRENT'
    : source.status === 'CURRENT';
}

function isApproved(value = '') {
  const status = value.toUpperCase();
  const approved = status === 'APPROVED' || /(?:^|_)APPROVED(?:_|$)/.test(status);
  const restricted = /NOT_APPROVED|NOT_AUTHORIZED|NOT_PROMOTED|PENDING|DRAFT|REVOKED|DENIED|REJECTED|SUSPENDED|EXPIRED/.test(status);
  return approved && !restricted;
}

function refreshLimitations(existing = [], record) {
  const values = new Set(existing ?? []);
  for (const value of [...values]) {
    if (String(value).startsWith('Controlled refresh ')) values.delete(value);
  }
  if (record.outcome === 'NEW_VERSION_DETECTED') {
    values.add('Controlled refresh detected changed bytes; Product Owner review is required before reuse.');
  }
  if (record.outcome === 'FRESHNESS_UNKNOWN') {
    values.add('Controlled refresh could not confirm currentness; source reuse remains blocked.');
  }
  return [...values];
}

function incrementPatch(value = '1.0.0') {
  const match = String(value).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error('REGISTRY_VERSION_INVALID:' + value);
  return match[1] + '.' + match[2] + '.' + (Number(match[3]) + 1);
}

function safeExtension(path, mediaType) {
  const current = extname(path).toLowerCase();
  if (['.html', '.htm', '.pdf', '.json', '.txt'].includes(current)) return current;
  if (mediaType === 'application/pdf') return '.pdf';
  if (mediaType === 'application/json') return '.json';
  if (mediaType === 'text/plain') return '.txt';
  return '.html';
}

function safeName(value) {
  return basename(value).replace(/[^A-Za-z0-9._-]/g, '_');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function concurrentMap(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
