import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reconcileSecretTelemetryIncident, renderSecretMetadata, secretTelemetryContract, type SecretTelemetrySnapshot } from '../src/secret-telemetry';

const root = resolve(import.meta.dirname, '..', '..', '..');
const safe = (overallStatus: 'CONFIGURED' | 'ATTENTION', status: 'CONFIGURED' | 'MISSING' | 'INVALID', checkedAt: string): SecretTelemetrySnapshot => ({
  contract: secretTelemetryContract.version, guardian: secretTelemetryContract.guardianId, monitor: secretTelemetryContract.monitorId,
  overallStatus, checkedAt,
  secrets: [{ id: 'translation-provider', status, provider: 'OpenAI', dependentService: 'Translator', environment: 'controlled-test', lastValidatedAt: checkedAt, incidentId: status === 'CONFIGURED' ? null : secretTelemetryContract.incidentId }],
});

const configured = safe('CONFIGURED', 'CONFIGURED', '2026-08-05T08:00:00.000Z');
const missing = safe('ATTENTION', 'MISSING', '2026-08-05T08:01:00.000Z');
const restored = safe('CONFIGURED', 'CONFIGURED', '2026-08-05T08:02:00.000Z');

let incidents = reconcileSecretTelemetryIncident([], configured);
assert.equal(incidents.length, 0, 'A valid state must not create an incident.');
incidents = reconcileSecretTelemetryIncident(incidents, missing);
assert.equal(incidents[0]?.id, secretTelemetryContract.incidentId);
assert.equal(incidents[0]?.status, 'new');
incidents = reconcileSecretTelemetryIncident(incidents, restored);
assert.equal(incidents[0]?.status, 'validated');
incidents = reconcileSecretTelemetryIncident(incidents, missing, new Date('2026-08-05T08:03:00.000Z'));
assert.equal(incidents[0]?.status, 'reopened');

const rendered = renderSecretMetadata(missing);
assert.match(rendered, /MISSING/);
assert.doesNotMatch(rendered, /OPENAI_API_KEY|JWT_SECRET|DATABASE_URL|AGM_TURN_ADMIN_PIN_HASH/);

const registry = readFileSync(resolve(root, 'apps/web/src/agent-governance.registry.ts'), 'utf8');
const monitoring = readFileSync(resolve(root, 'apps/web/src/monitoring-department.ts'), 'utf8');
const operations = readFileSync(resolve(root, 'config/operations-health.json'), 'utf8');
const main = readFileSync(resolve(root, 'apps/web/src/main.ts'), 'utf8');
assert.match(registry, /secret-credentials-guardian/);
assert.match(monitoring, /renderSecretTelemetryPanel/);
assert.match(operations, /security\/secrets\/health/);
assert.match(main, /reconcileSecretTelemetryIncident/);
console.log('Secret Guardian telemetry and incident reconciliation: PASS');
