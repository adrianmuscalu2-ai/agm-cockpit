import {
  createCanonicalOperationalLinguist,
  OPERATIONAL_LINGUIST_V1_LANGUAGES,
  type OperationalLinguistV1Evidence,
} from '@agm/shared';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { auditCanonicalOperationalLinguist } from '../apps/web/src/premium-linguistic-agents/operational-linguist-v1.resource-audit';

export type OperationalLinguistPublisherMode = 'audit' | 'activate' | 'heartbeat';

export function deterministicOperationalLinguistAudit() {
  return OPERATIONAL_LINGUIST_V1_LANGUAGES.map((language) => {
    const audit = auditCanonicalOperationalLinguist(language);
    const resourceEvidenceDigest = `sha256:${createHash('sha256').update(audit.resourceEvidenceCanonical).digest('hex')}`;
    if (resourceEvidenceDigest !== audit.resources.catalogDigest) throw new Error(`Canonical catalog digest mismatch for ${language}.`);
    return {
      componentId: audit.componentId,
      language: audit.language,
      operationalState: audit.operationalState,
      resources: audit.resources,
      errors: audit.errors,
      resourceEvidenceDigest,
    };
  });
}

export function createPublicationEvidence(
  registration: { registrationId: string; authorityEpoch: number },
  observedAt: string,
): OperationalLinguistV1Evidence[] {
  return deterministicOperationalLinguistAudit().map((audit) => {
    const definition = createCanonicalOperationalLinguist(audit.language);
    return {
      schemaVersion: definition.schemaVersion,
      baselineVersion: definition.baselineVersion,
      baselineDigest: definition.baselineDigest,
      componentId: definition.componentId,
      language: definition.language,
      operationalState: audit.operationalState,
      observedAt,
      publisher: { registrationId: registration.registrationId, authorityEpoch: registration.authorityEpoch, sequence: 1 },
      resources: audit.resources,
      errors: audit.errors,
    };
  });
}

export async function runOperationalLinguistPublisher(
  mode: OperationalLinguistPublisherMode,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const audit = deterministicOperationalLinguistAudit();
  if (audit.some((entry) => entry.operationalState !== 'ONLINE' || entry.errors.count !== 0)) {
    throw new Error('Canonical operational linguistic resource audit failed.');
  }
  if (mode === 'audit') return { mode, audit };

  const apiOrigin = required(environment, 'AGM_API_ORIGIN').replace(/\/$/, '');
  const token = await githubOidcToken(environment);
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' };
  const registration = await jsonRequest<{ data: { registrationId: string; authorityEpoch: number; writerId: string; writerVersion: string; buildRevision: string; expiresAt: string; baselineStatus: string } }>(
    `${apiOrigin}/api/v1/operations/turn/operational-linguists/publishers`,
    { method: 'POST', headers },
  );
  const evidence = createPublicationEvidence(registration.data, new Date().toISOString());
  const receipts = mode === 'activate'
    ? [(await jsonRequest<{ data: unknown }>(`${apiOrigin}/api/v1/operations/turn/operational-linguists/activation`, { method: 'POST', headers, body: JSON.stringify({ evidence }) })).data]
    : await Promise.all(evidence.map(async (item) => (await jsonRequest<{ data: unknown }>(`${apiOrigin}/api/v1/operations/turn/operational-linguists/heartbeats`, { method: 'POST', headers, body: JSON.stringify(item) })).data));
  return {
    mode,
    publisher: {
      registrationId: registration.data.registrationId,
      authorityEpoch: registration.data.authorityEpoch,
      writerId: registration.data.writerId,
      writerVersion: registration.data.writerVersion,
      buildRevision: registration.data.buildRevision,
      expiresAt: registration.data.expiresAt,
      baselineStatus: registration.data.baselineStatus,
    },
    audit,
    receipts,
  };
}

async function githubOidcToken(environment: NodeJS.ProcessEnv) {
  const requestUrl = required(environment, 'ACTIONS_ID_TOKEN_REQUEST_URL');
  const requestToken = required(environment, 'ACTIONS_ID_TOKEN_REQUEST_TOKEN');
  const separator = requestUrl.includes('?') ? '&' : '?';
  const response = await fetch(`${requestUrl}${separator}audience=${encodeURIComponent('agm:production-machine-provisioning')}`, {
    headers: { Authorization: `bearer ${requestToken}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`GitHub OIDC token request failed with HTTP ${response.status}.`);
  const body = await response.json() as { value?: unknown };
  if (typeof body.value !== 'string' || !body.value) throw new Error('GitHub OIDC token response is invalid.');
  process.stdout.write(`::add-mask::${body.value}\n`);
  return body.value;
}

async function jsonRequest<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null) as T | { message?: unknown } | null;
  if (!response.ok) throw new Error(`Operational linguist V1 API rejected the request with HTTP ${response.status}: ${safeMessage(body)}`);
  return body as T;
}

function safeMessage(value: unknown) {
  if (!value || typeof value !== 'object') return 'NO_SAFE_ERROR_BODY';
  const message = (value as { message?: unknown }).message;
  return typeof message === 'string' && /^[A-Z0-9_ .:-]{1,160}$/i.test(message) ? message : 'REDACTED_ERROR';
}

function required(environment: NodeJS.ProcessEnv, name: string) {
  const value = environment[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  const mode = (process.argv[2] ?? 'audit') as OperationalLinguistPublisherMode;
  if (!['audit', 'activate', 'heartbeat'].includes(mode)) throw new Error('Mode must be audit, activate, or heartbeat.');
  const result = await runOperationalLinguistPublisher(mode);
  const evidencePath = process.env.AGM_OPERATIONAL_LINGUIST_EVIDENCE_PATH;
  if (evidencePath) {
    mkdirSync(dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Operational linguist publisher failed.'}\n`);
  process.exitCode = 1;
});
