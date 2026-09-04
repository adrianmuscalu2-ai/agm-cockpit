import type { IncidentStatus } from './incident-journal';

export type StatusLightTone = 'green' | 'yellow' | 'red' | 'white';
export type StatusLight = { icon: '🟢' | '🟡' | '🔴' | '⚪'; tone: StatusLightTone; label: string };

const light = (icon: StatusLight['icon'], tone: StatusLightTone, label: string): StatusLight => ({ icon, tone, label });

export function agentStatusLight(status: string): StatusLight {
  if (status === 'ACTIVE' || status === 'AVAILABLE') return light('🟢', 'green', status);
  if (status === 'DEGRADED') return light('🟡', 'yellow', status);
  if (status === 'UNAVAILABLE') return light('🔴', 'red', status);
  return light('⚪', 'white', 'UNKNOWN');
}

export function targetStatusLight(status: string): StatusLight {
  if (status === 'HEALTHY' || status === 'READY') return light('🟢', 'green', status);
  if (status === 'DEGRADED' || status === 'PARTIAL') return light('🟡', 'yellow', status);
  if (status === 'OFFLINE' || status === 'INCIDENT') return light('🔴', 'red', status);
  if (status === 'NOT APPLICABLE') return light('⚪', 'white', 'NOT APPLICABLE');
  return light('⚪', 'white', 'UNKNOWN / NO TELEMETRY');
}

export function incidentStatusLight(status?: IncidentStatus): StatusLight {
  if (!status) return light('⚪', 'white', 'NONE');
  if (status === 'validated' || status === 'archived') return light('🟢', 'green', 'CLOSED');
  if (status === 'remediation' || status === 'ready-test') return light('🟡', 'yellow', 'REMEDIATION / RECOVERY');
  return light('🔴', 'red', 'OPEN / ACTIVE');
}

export function renderStatusLight(kind: 'agent' | 'target' | 'incident', status: string | undefined, extraClass = '') {
  const registryOrUnpolled = kind === 'agent'
    && ['operation-agent-status', 'turn-network-status'].includes(extraClass)
    && ['ACTIVE', 'DEGRADED'].includes(status ?? '');
  const effectiveStatus = registryOrUnpolled ? 'UNKNOWN' : status;
  const value = kind === 'agent'
    ? agentStatusLight(effectiveStatus ?? 'UNKNOWN')
    : kind === 'target'
      ? targetStatusLight(status ?? 'UNKNOWN')
      : incidentStatusLight(status as IncidentStatus | undefined);
  return `<span class="status-light status-light-${value.tone} ${extraClass}" data-status-kind="${kind}" role="status" aria-label="${kind}: ${value.label}"><span aria-hidden="true">${value.icon}</span> ${value.label}</span>`;
}

export function updateStatusLight(element: HTMLElement | null, kind: 'agent' | 'target', status: string) {
  if (!element) return;
  const value = kind === 'agent' ? agentStatusLight(status) : targetStatusLight(status);
  element.classList.remove('status-light-green', 'status-light-yellow', 'status-light-red', 'status-light-white');
  element.classList.add('status-light', `status-light-${value.tone}`);
  element.dataset.statusKind = kind;
  element.setAttribute('role', 'status');
  element.setAttribute('aria-label', `${kind}: ${value.label}`);
  element.textContent = `${value.icon} ${value.label}`;
}
