import { isTurnAdminSessionError, turnAdminAuthenticatedFetch } from './admin-auth';

export type RuntimeAgentAccountability = {
  identity: string;
  responsibility: string;
  executable: 'YES' | 'NO';
  mandate: 'PROVEN' | 'NOT PROVEN';
  mandateId: string | null;
  trigger: string;
  executionCondition: string;
  lastExecution: string | null;
  lastResult: string;
  outputRef: string | null;
  executionEvidenceRef: string | null;
  validation: 'PROVEN' | 'NOT PROVEN';
  validator: string;
  validationEvidenceRef: string | null;
  lastValidation: string | null;
  freshness: 'CURRENT' | 'STALE' | 'NO TELEMETRY';
  status: string;
  reason: string;
  openResponsibilities: string[];
  failover: 'PROVEN' | 'NOT PROVEN';
};

export type AgentRuntimeAccountabilitySnapshot = {
  contractVersion: string;
  generatedAt: string;
  agents: RuntimeAgentAccountability[];
  inspector: {
    primaryInspector: string;
    primaryStatus: string;
    secondaryInspector: string;
    secondaryStatus: string;
    activeValidator: string | null;
    mandateTransferred: boolean;
    transferReason: string | null;
    transferredAt: string | null;
    lastValidation: string | null;
    transferEvidenceRef: string | null;
    status: 'PASS' | 'FAIL';
    controlStatus: string;
  };
  incidents: { open: number; inspectorFailureIncident: string | null; controlCoverageIncident: string | null };
  verdict: {
    agentAccountability: 'PASS' | 'FAIL';
    inspectorFailover: 'PASS' | 'FAIL';
    controlCoverage: 'COMPLETE' | 'INCOMPLETE';
    falseActive: number;
    unexplainedDegraded: number;
    finalAgentRuntimePass: 'PASS' | 'FAIL';
  };
};

const esc = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
const time = (value: string | null) => value ? new Date(value).toLocaleString() : 'NO TELEMETRY';
const evidence = (value: string | null) => value ? `<code>${esc(value)}</code>` : 'NOT PROVEN';
const tone = (value: string) => value === 'PASS' || value === 'ACTIVE' || value === 'COMPLETE' || value === 'PROVEN' || value === 'YES' ? 'pass' : value === 'DEGRADED' || value === 'STALE' ? 'warn' : 'fail';

export function renderAgentRuntimeAccountability() {
  return `<section class="turn-agent-runtime-accountability" id="turn-agent-runtime-accountability" aria-labelledby="turn-agent-runtime-accountability-title"><header><div><span class="turn-kicker">TURN - OPERATIONAL AGENT TRUTH</span><h2 id="turn-agent-runtime-accountability-title">Agent Runtime & Inspector Failover</h2><p>ACTIVE requires mandate, execution, output, persistent evidence, current independent validation, and freshness.</p></div><span class="protocol-status">EVIDENCE-DERIVED</span></header><div data-agent-runtime-state role="status">UNKNOWN / NO TELEMETRY - loading protected operational evidence.</div></section>`;
}

export function renderAgentRuntimeSnapshot(snapshot: AgentRuntimeAccountabilitySnapshot) {
  const v = snapshot.verdict;
  const i = snapshot.inspector;
  const verdicts = [
    ['AGENT ACCOUNTABILITY', v.agentAccountability],
    ['INSPECTOR FAILOVER', v.inspectorFailover],
    ['CONTROL COVERAGE', v.controlCoverage],
    ['FALSE ACTIVE', String(v.falseActive)],
    ['UNEXPLAINED DEGRADED', String(v.unexplainedDegraded)],
    ['FINAL AGENT RUNTIME PASS', v.finalAgentRuntimePass],
  ].map(([label, value]) => `<div class="agent-runtime-verdict"><span>${esc(label)}</span><strong data-tone="${tone(value)}">${esc(value)}</strong></div>`).join('');
  const rows = snapshot.agents.map((agent) => `<tr data-runtime-agent="${esc(agent.identity)}" data-runtime-status="${esc(agent.status)}"><td><code>${esc(agent.identity)}</code><small>${esc(agent.responsibility)}</small></td><td data-tone="${tone(agent.executable)}">${esc(agent.executable)}</td><td data-tone="${tone(agent.mandate)}">${esc(agent.mandate)}${agent.mandateId ? `<small>${esc(agent.mandateId)}</small>` : ''}</td><td>${esc(agent.trigger)}<small>${esc(agent.executionCondition)}</small></td><td>${esc(time(agent.lastExecution))}<small>${esc(agent.lastResult)}</small></td><td>${evidence(agent.outputRef)}<small>${evidence(agent.executionEvidenceRef)}</small></td><td data-tone="${tone(agent.validation)}">${esc(agent.validator)}<small>${esc(agent.validation)} - ${esc(time(agent.lastValidation))}</small></td><td data-tone="${tone(agent.freshness)}">${esc(agent.freshness)}</td><td data-tone="${tone(agent.status)}"><strong>${esc(agent.status)}</strong><small>${esc(agent.reason)}</small></td><td data-tone="${tone(agent.failover)}">${esc(agent.failover)}</td><td>${esc(agent.openResponsibilities.join('; ') || 'NONE')}</td></tr>`).join('');
  return `<div class="agent-runtime-verdicts">${verdicts}</div><div class="agent-inspector-failover" data-inspector-failover="${esc(i.status)}"><h3>Inspector control chain</h3><dl><div><dt>Primary</dt><dd>${esc(i.primaryInspector)} - ${esc(i.primaryStatus)}</dd></div><div><dt>Secondary / validator</dt><dd>${esc(i.secondaryInspector)} - ${esc(i.secondaryStatus)} / ${esc(i.activeValidator ?? 'NONE')}</dd></div><div><dt>Mandate transfer</dt><dd>${i.mandateTransferred ? 'PROVEN' : 'NOT PROVEN'} - ${esc(i.transferReason ?? 'NO REASON')} - ${esc(time(i.transferredAt))}</dd></div><div><dt>Last validation</dt><dd>${esc(time(i.lastValidation))} - ${evidence(i.transferEvidenceRef)}</dd></div><div><dt>Coverage / incident</dt><dd>${esc(i.controlStatus)} - ${esc(snapshot.incidents.controlCoverageIncident ?? snapshot.incidents.inspectorFailureIncident ?? 'NO INCIDENT')}</dd></div></dl></div><div class="turn-accountability-table-wrap"><table><thead><tr><th>Identity / mandate</th><th>Executable</th><th>Mandate</th><th>Trigger / frequency</th><th>Last execution / result</th><th>Output / evidence</th><th>Validator</th><th>Freshness</th><th>Status</th><th>Failover</th><th>Open responsibility</th></tr></thead><tbody>${rows}</tbody></table></div><p class="agent-runtime-generated">Contract ${esc(snapshot.contractVersion)} - generated ${esc(time(snapshot.generatedAt))} - open incidents ${esc(snapshot.incidents.open)}</p>`;
}

export async function fetchAgentRuntimeAccountability(fetcher: typeof fetch = turnAdminAuthenticatedFetch as typeof fetch) {
  const response = await fetcher('/operations/turn/agent-accountability', { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`AGENT_RUNTIME_ACCOUNTABILITY_HTTP_${response.status}`);
  const payload = await response.json() as { data?: AgentRuntimeAccountabilitySnapshot };
  if (!payload.data) throw new Error('AGENT_RUNTIME_ACCOUNTABILITY_INVALID_RESPONSE');
  return payload.data;
}

export async function bindAgentRuntimeAccountability(fetcher: typeof fetch = turnAdminAuthenticatedFetch as typeof fetch) {
  if (!document.querySelector('[data-agent-runtime-state]')) return;
  try {
    const snapshot = await fetchAgentRuntimeAccountability(fetcher);
    const currentTarget = document.querySelector<HTMLElement>('[data-agent-runtime-state]');
    if (currentTarget) currentTarget.innerHTML = renderAgentRuntimeSnapshot(snapshot);
  } catch (error) {
    const authRequired = isTurnAdminSessionError(error);
    const currentTarget = document.querySelector<HTMLElement>('[data-agent-runtime-state]');
    if (currentTarget) currentTarget.innerHTML = `<div class="agent-runtime-unavailable" data-tone="fail"><strong>UNKNOWN / NO TELEMETRY</strong><p>${authRequired ? 'Administrator validation is required to read protected operational evidence.' : 'The operational evidence endpoint is unavailable; no ACTIVE or PASS state is inferred.'}</p></div>`;
  }
}
