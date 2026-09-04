import { authenticatedApiFetch } from './authenticated-api';

export type BasicFeatureId = 'basic.transport-document' | 'basic.tachograph' | 'basic.dashboard-text' | 'basic.dashboard-warning' | 'basic.legislation' | 'basic.cargo-safety' | 'basic.ocr-workspace';

export function reportBasicFeature(input: { featureId: BasicFeatureId; outcome: 'SUCCESS' | 'UNCERTAIN' | 'FAILED' | 'NO_TEXT'; durationMs: number; confidence?: number; resultStatus?: string }) {
  void authenticatedApiFetch('/operations/turn/feature-telemetry', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), keepalive: true,
  }).catch(() => undefined);
}

export function featureOutcome(status: string) {
  return status === 'uncertain' ? 'UNCERTAIN' as const : 'SUCCESS' as const;
}
