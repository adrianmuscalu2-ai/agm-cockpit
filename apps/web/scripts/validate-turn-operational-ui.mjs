import { readFileSync } from 'node:fs';

const view = readFileSync(new URL('../src/premium-governance/premium-governance.view.ts', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../src/premium-governance/premium-governance.runtime.ts', import.meta.url), 'utf8');

for (const forbidden of ['agm-orbit', 'NOT EVALUATED', 'NOT EXPOSED']) {
  if (view.includes(forbidden) || runtime.includes(forbidden)) throw new Error(`TURN_OPERATIONAL_UI_FORBIDDEN:${forbidden}`);
}
for (const required of ['Runtime', 'Current state / health', 'Last heartbeat', 'Last activity', 'Freshness', 'Current function', 'Dependencies', 'Evidence/source', 'Why', 'Required action']) {
  if (!runtime.includes(required)) throw new Error(`TURN_OPERATIONAL_UI_MISSING:${required}`);
}
for (const required of ['data-premium-spatial-stage', 'data-turn-page="premium"', 'data-turn-page="investigate"']) {
  if (!view.includes(required)) throw new Error(`TURN_SPATIAL_UI_MISSING:${required}`);
}
for (const required of ['data-premium-spatial-node', 'incidentQualification', 'rootCauseClassification', 'pipeline.eventStore']) {
  if (!runtime.includes(required)) throw new Error(`TURN_OPERATIONAL_PIPELINE_MISSING:${required}`);
}
if (!runtime.includes('Registry-ul nu este folosit ca fallback')) throw new Error('TURN_OPERATIONAL_UI_MISSING_NO_FALLBACK_CONTRACT');
console.log('TURN operational UI contract validated');
