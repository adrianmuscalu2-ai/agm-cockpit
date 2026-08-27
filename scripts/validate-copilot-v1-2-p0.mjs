import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

const envelope = await readJson('config/copilot-v1.2/event-envelope.schema.json');
const catalog = await readJson('config/copilot-v1.2/state-reflection-catalog.v1.json');

const requiredEnvelopeFields = new Set(envelope.required ?? []);
for (const field of ['eventId', 'tenantId', 'sourceAuthority', 'aggregateRevision', 'sanitizedPayload', 'signature']) {
  if (!requiredEnvelopeFields.has(field)) throw new Error(`P0_EVENT_SCHEMA_MISSING_${field}`);
}

if (envelope.additionalProperties !== false) throw new Error('P0_EVENT_SCHEMA_NOT_FAIL_CLOSED');
if (!Array.isArray(catalog.states) || catalog.states.length === 0) throw new Error('P0_REFLECTION_CATALOG_EMPTY');

const eventTypes = new Set();
for (const state of catalog.states) {
  if (!state.eventType || !state.owner || !catalog.classes[state.class]) throw new Error('P0_INVALID_REFLECTION_ENTRY');
  if (eventTypes.has(state.eventType)) throw new Error(`P0_DUPLICATE_EVENT_TYPE_${state.eventType}`);
  eventTypes.add(state.eventType);
}

const secretState = catalog.states.find((state) => state.eventType === 'secret_path.status');
if (secretState?.payload !== 'ENUM_ONLY') throw new Error('P0_SECRET_STATUS_NOT_ENUM_ONLY');

for (const [name, slo] of Object.entries(catalog.classes)) {
  if (!(slo.p95Ms <= slo.p99Ms && slo.p99Ms <= slo.staleMs)) throw new Error(`P0_INVALID_SLO_${name}`);
}

console.log('AGM COPILOT V1.2 P0 CONTRACT VALIDATION — PASS');
console.log('P0 PROMOTION EVIDENCE — PASS / READY FOR OWNER DECISION');
