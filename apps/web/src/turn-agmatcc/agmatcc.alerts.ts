import type { TurnOperationalTruth } from '../turn-operational-truth';

export type TccAlertClass = 'OPERATIONAL_EVENT' | 'WARNING' | 'JUSTIFIED_BLOCK';

export type TccBackendAlert = {
  alertClass: TccAlertClass;
  message: string;
  source: string;
  observedAt: string | null;
  ref: string | null;
};

export const TCC_ALERT_SOURCE = 'backend:GET /operations/turn/operational-truth';

/** Pure projection of the live backend snapshot; it never invents alerts and never marks anything certified. */
export function deriveTccAlerts(truth: TurnOperationalTruth): TccBackendAlert[] {
  const alerts: TccBackendAlert[] = [];
  const push = (alertClass: TccAlertClass, message: string, observedAt: string | null, ref: string | null = null) =>
    alerts.push({ alertClass, message, source: TCC_ALERT_SOURCE, observedAt: observedAt ?? truth.generatedAt, ref });

  if (truth.latestEvent) {
    const event = truth.latestEvent;
    push('OPERATIONAL_EVENT', `${event.agentId} · ${event.lifecycle} · seq ${event.sequence} · ${event.detail}`, event.recordedAt, event.eventId);
  }
  if (truth.overallStatus !== 'PASS') push('WARNING', `Stare operațională ${truth.overallStatus}: ${truth.reason}`, truth.observedAt);
  if (truth.accessProof.status !== 'CURRENT') push('WARNING', `Dovada de acces ACP: ${truth.accessProof.status} (fereastră ${truth.accessProof.freshnessWindowSeconds}s)`, truth.accessProof.observedAt);
  if (truth.telemetryStatus !== 'LIVE TELEMETRY') push('WARNING', `Telemetrie: ${truth.telemetryStatus}`, truth.observedAt);
  if (truth.falseGreen > 0) push('WARNING', `${truth.falseGreen} indicatori fals-verzi detectați`, truth.observedAt);

  const guardian = truth.androidActionLayer?.guardianPermissionControl;
  if (guardian?.status === 'FAIL') push('JUSTIFIED_BLOCK', `Guardian a refuzat: ${guardian.name} (blocaj preventiv legitim)`, guardian.observedAt, guardian.evidenceId);
  else if (guardian && guardian.status !== 'PASS') push('WARNING', `Guardian: ${guardian.name} ${guardian.status}`, guardian.observedAt, guardian.evidenceId);
  return alerts;
}
