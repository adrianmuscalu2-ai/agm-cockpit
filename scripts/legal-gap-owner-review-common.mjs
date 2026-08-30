import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const ROOT = resolve(process.cwd());
export const PREPARED_AT = '2026-08-30T18:00:00.000Z';
export const BASELINE = Object.freeze({
  registry: {
    path: 'AGM_LIBRARY/REGISTRY/canonical-sources.json',
    count: 841,
    sha256: '462db7f3a72204010972aa605901783997feff9ada7aac760ab03b358b2cd076',
  },
  routingTollView: {
    path: 'AGM_LIBRARY/VIEWS/routing-toll.view.json',
    count: 289,
    sha256: '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0',
  },
  legislationSafetyView: {
    path: 'AGM_LIBRARY/VIEWS/legislation-safety.view.json',
    count: 44,
    sha256: '2db4f2b915e256f013bc4ed59188d810230a33c335333ec8cf364c6f1284dac1',
  },
});

export function absolute(relativePath) {
  return resolve(ROOT, relativePath);
}

export function sha256(relativePath) {
  return createHash('sha256').update(readFileSync(absolute(relativePath))).digest('hex');
}

export function readJson(relativePath) {
  return JSON.parse(readFileSync(absolute(relativePath), 'utf8'));
}

export function writeJson(relativePath, value) {
  const path = absolute(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function writeText(relativePath, value) {
  const path = absolute(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

export function verifyProtectedBaseline() {
  const registry = readJson(BASELINE.registry.path);
  const routing = readJson(BASELINE.routingTollView.path);
  const legislation = readJson(BASELINE.legislationSafetyView.path);
  const actual = {
    registry: { count: registry.sources.length, sha256: sha256(BASELINE.registry.path) },
    routingTollView: { count: routing.sourceCount, sha256: sha256(BASELINE.routingTollView.path) },
    legislationSafetyView: { count: legislation.sourceCount, sha256: sha256(BASELINE.legislationSafetyView.path) },
  };
  for (const key of Object.keys(actual)) {
    if (actual[key].count !== BASELINE[key].count || actual[key].sha256 !== BASELINE[key].sha256) {
      throw new Error(`PROTECTED_BASELINE_CHANGED:${key}:${JSON.stringify(actual[key])}`);
    }
  }
  return actual;
}

export function evidenceRecord(spec) {
  if (!spec.path) {
    return { ...spec, sizeBytes: null, sha256: null, localValidation: 'NOT_CAPTURED' };
  }
  if (!existsSync(absolute(spec.path))) throw new Error(`EVIDENCE_MISSING:${spec.path}`);
  const bytes = readFileSync(absolute(spec.path));
  const isPdf = spec.mediaType === 'application/pdf';
  const structural = isPdf
    ? bytes.subarray(0, 5).toString('ascii') === '%PDF-' && bytes.subarray(Math.max(0, bytes.length - 2048)).includes(Buffer.from('%%EOF'))
    : bytes.length > 0;
  const blockedPage = !isPdf && /(cf-chl|challenge-platform|just a moment.{0,160}cloudflare|attention required.{0,160}cloudflare|incapsula incident|support id:)/is.test(bytes.toString('utf8'));
  return {
    ...spec,
    sizeBytes: statSync(absolute(spec.path)).size,
    sha256: sha256(spec.path),
    localValidation: structural && !blockedPage ? 'PASS' : blockedPage ? 'FAIL_BLOCK_PAGE' : 'FAIL_STRUCTURE',
  };
}

export function freshness({ effectiveFrom = null, effectiveUntil = null, version, nextFreshnessCheck = '2026-09-30', currentStatus = 'CURRENT', reviewRequired = false, limitations = [] }) {
  return {
    policyVersion: 'agm-source-freshness.v1',
    effectiveFrom,
    effectiveUntil,
    version,
    capturedAt: PREPARED_AT,
    lastFreshnessCheck: PREPARED_AT,
    nextFreshnessCheck,
    currentStatus,
    supersedes: [],
    supersededBy: [],
    reviewRequired,
    usageFallback: reviewRequired ? 'UNKNOWN_HUMAN_VERIFICATION' : 'USE_ONLY_WITHIN_APPROVED_SCOPE_AND_DEMONSTRATED_PERIOD',
    limitations,
  };
}

export function guardrails() {
  return {
    registryMutation: 'NONE',
    viewMutation: 'NONE',
    authorityPromotion: 'NONE',
    runtimeProduction: 'NO_CHANGE',
    atomicApply: 'NOT_EXECUTED',
    commitPush: 'NOT_EXECUTED',
  };
}
