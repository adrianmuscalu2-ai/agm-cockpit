import { authorizeDutyExecution, recordDutyReceipt, roleContractFor } from './agent-accountability';
import { authenticatedApiFetch, resolveApiUrl } from './authenticated-api';
import type { OperationalIncident } from './incident-journal';

export type IncidentTruthState = 'ACTIVE INCIDENT' | 'NO ACTIVE INCIDENTS' | 'UNKNOWN / NOT CHECKED' | 'INCIDENT DATA UNAVAILABLE';
export type IncidentTruth = {
  state: IncidentTruthState;
  attemptedAt: string | null;
  checkedAt: string | null;
  checkedBy: string;
  source: string[];
  coverage: 'NONE' | 'PARTIAL' | 'COMPLETE';
  result: number | null;
  freshness: 'CURRENT' | 'STALE' | 'UNKNOWN';
  failure: string | null;
};

export function evaluateIncidentTruth(input: {
  attemptedAt?: string;
  checkedAt?: string;
  checkedBy?: string;
  source?: string[];
  coverage?: 'NONE' | 'PARTIAL' | 'COMPLETE';
  activeRecords?: number;
  failure?: string;
  now?: Date;
}): IncidentTruth {
  const source = input.source ?? [];
  const coverage = input.coverage ?? 'NONE';
  if (!input.attemptedAt) return { state: 'UNKNOWN / NOT CHECKED', attemptedAt: null, checkedAt: null, checkedBy: input.checkedBy ?? 'monitor-incidents', source, coverage: 'NONE', result: null, freshness: 'UNKNOWN', failure: null };
  if (input.failure) return { state: 'INCIDENT DATA UNAVAILABLE', attemptedAt: input.attemptedAt, checkedAt: input.checkedAt ?? null, checkedBy: input.checkedBy ?? 'monitor-incidents', source, coverage, result: null, freshness: 'UNKNOWN', failure: input.failure };
  if (!input.checkedAt || coverage !== 'COMPLETE' || input.activeRecords === undefined) return { state: 'UNKNOWN / NOT CHECKED', attemptedAt: input.attemptedAt, checkedAt: input.checkedAt ?? null, checkedBy: input.checkedBy ?? 'monitor-incidents', source, coverage, result: input.activeRecords ?? null, freshness: 'UNKNOWN', failure: null };
  const freshness = (input.now ?? new Date()).getTime() - Date.parse(input.checkedAt) <= 90_000 ? 'CURRENT' : 'STALE';
  if (freshness === 'STALE') return { state: 'UNKNOWN / NOT CHECKED', attemptedAt: input.attemptedAt, checkedAt: input.checkedAt, checkedBy: input.checkedBy ?? 'monitor-incidents', source, coverage, result: input.activeRecords, freshness, failure: null };
  return { state: input.activeRecords > 0 ? 'ACTIVE INCIDENT' : 'NO ACTIVE INCIDENTS', attemptedAt: input.attemptedAt, checkedAt: input.checkedAt, checkedBy: input.checkedBy ?? 'monitor-incidents', source, coverage, result: input.activeRecords, freshness, failure: null };
}

export const uncheckedIncidentTruth = evaluateIncidentTruth({});

function updateIncidentTruthDom(truth: IncidentTruth) {
  document.querySelectorAll<HTMLElement>('[data-incident-truth-state]').forEach((node) => { node.textContent = truth.state; });
  document.querySelectorAll<HTMLElement>('[data-incident-truth-checked-at]').forEach((node) => { node.textContent = truth.checkedAt ? new Date(truth.checkedAt).toLocaleString() : '—'; });
  document.querySelectorAll<HTMLElement>('[data-incident-truth-checked-by]').forEach((node) => { node.textContent = truth.checkedBy; });
  document.querySelectorAll<HTMLElement>('[data-incident-truth-source]').forEach((node) => { node.textContent = truth.source.join(', ') || 'NONE'; });
  document.querySelectorAll<HTMLElement>('[data-incident-truth-coverage]').forEach((node) => { node.textContent = truth.coverage; });
  document.querySelectorAll<HTMLElement>('[data-incident-truth-result]').forEach((node) => { node.textContent = truth.result === null ? 'UNKNOWN' : String(truth.result); });
  document.querySelectorAll<HTMLElement>('[data-incident-truth-freshness]').forEach((node) => { node.textContent = truth.freshness; });
  document.querySelectorAll<HTMLElement>('[data-incident-truth-failure]').forEach((node) => { node.textContent = truth.failure ?? 'NONE'; });
}

export function renderIncidentTruthDetails() {
  return `<dl class="incident-truth-details"><div><dt>State</dt><dd data-incident-truth-state>UNKNOWN / NOT CHECKED</dd></div><div><dt>Checked at</dt><dd data-incident-truth-checked-at>—</dd></div><div><dt>Checked by</dt><dd data-incident-truth-checked-by>monitor-incidents</dd></div><div><dt>Source</dt><dd data-incident-truth-source>NONE</dd></div><div><dt>Coverage</dt><dd data-incident-truth-coverage>NONE</dd></div><div><dt>Result</dt><dd data-incident-truth-result>UNKNOWN</dd></div><div><dt>Freshness</dt><dd data-incident-truth-freshness>UNKNOWN</dd></div><div><dt>Failure / escalation</dt><dd data-incident-truth-failure>NONE</dd></div></dl>`;
}

export async function checkIncidentTruth(localIncidents: OperationalIncident[], fetcher: typeof fetch = authenticatedApiFetch as typeof fetch, now = new Date()) {
  const attemptedAt = now.toISOString();
  try {
    const response = await fetcher(resolveApiUrl('/incidents'), { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`INCIDENT_SOURCE_HTTP_${response.status}`);
    const payload = await response.json() as { data?: unknown[] } | unknown[];
    const remote = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : null;
    if (!remote) throw new Error('INCIDENT_SOURCE_INVALID_PAYLOAD');
    const localActive = localIncidents.filter((incident) => !['validated', 'archived'].includes(incident.status)).length;
    const remoteActive = remote.filter((record) => record && typeof record === 'object' && !['resolved', 'validated', 'archived'].includes(String((record as { status?: unknown }).status ?? '').toLocaleLowerCase())).length;
    return evaluateIncidentTruth({ attemptedAt, checkedAt: new Date().toISOString(), checkedBy: 'monitor-incidents', source: ['Incident Journal local', 'API-006 /incidents'], coverage: 'COMPLETE', activeRecords: localActive + remoteActive });
  } catch (error) {
    return evaluateIncidentTruth({ attemptedAt, checkedAt: new Date().toISOString(), checkedBy: 'monitor-incidents', source: ['Incident Journal local', 'API-006 /incidents'], coverage: 'PARTIAL', failure: error instanceof Error ? error.message : 'INCIDENT_SOURCE_FAILURE' });
  }
}

let currentIncidentTruth: IncidentTruth = uncheckedIncidentTruth;
let incidentTruthAutoStarted = false;

let activeIncidentTruthRun: (() => Promise<void>) | undefined;
let incidentTruthRecheckBound = false;
export function publishIncidentTruth(truth: IncidentTruth) {
  currentIncidentTruth = truth;
  authorizeDutyExecution('monitor-incidents', 'PERIODIC_CHECK', ['observe', 'verify', 'record', ...(truth.state === 'INCIDENT DATA UNAVAILABLE' ? ['escalate'] : [])]);
  updateIncidentTruthDom(truth);
  const contract = roleContractFor('monitor-incidents')!;
  const completedAt = truth.checkedAt ?? truth.attemptedAt ?? new Date().toISOString();
  recordDutyReceipt({
    agentId: 'monitor-incidents', roleContractVersion: contract.roleContractVersion,
    mandateId: `incident-truth:${truth.attemptedAt ?? 'not-attempted'}`, trigger: 'PERIODIC_CHECK',
    startedAt: truth.attemptedAt ?? completedAt, completedAt, source: truth.source.length ? truth.source : ['NONE'],
    coverage: truth.coverage, result: truth.state === 'INCIDENT DATA UNAVAILABLE' ? 'FAIL' : truth.state === 'UNKNOWN / NOT CHECKED' ? 'UNKNOWN' : 'PASS',
    evidenceRef: `runtime:incident-truth:${truth.attemptedAt ?? 'not-attempted'}`, freshness: truth.freshness,
    openResponsibility: truth.state === 'INCIDENT DATA UNAVAILABLE' ? 'Restore incident source access and repeat the check.' : truth.state === 'UNKNOWN / NOT CHECKED' ? 'Execute the incident check.' : 'NONE',
    escalation: truth.state === 'INCIDENT DATA UNAVAILABLE' ? 'SOURCE OWNER' : 'NONE', validator: 'chief-monitoring-inspector', executedActions: ['observe', 'verify', 'record', ...(truth.state === 'INCIDENT DATA UNAVAILABLE' ? ['escalate'] : [])],
  });
  window.dispatchEvent(new CustomEvent('agm:incident-truth', { detail: truth }));
}

export function bindIncidentTruthMonitor(localIncidents: OperationalIncident[], fetcher: typeof fetch = authenticatedApiFetch as typeof fetch) {

  updateIncidentTruthDom(currentIncidentTruth);
  const run = async () => publishIncidentTruth(await checkIncidentTruth(localIncidents, fetcher));
  activeIncidentTruthRun = run;
  if (!incidentTruthAutoStarted) {
    incidentTruthAutoStarted = true;
    void activeIncidentTruthRun();
  }
  if (!incidentTruthRecheckBound) {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-incident-truth-recheck]')) void activeIncidentTruthRun?.();
    });
    incidentTruthRecheckBound = true;
  }
}
