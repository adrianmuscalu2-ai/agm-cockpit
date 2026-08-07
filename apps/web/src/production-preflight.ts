import { createIncident, transitionIncident, updateIncident, type IncidentDraft, type OperationalIncident } from './incident-journal';
import { activateIncidentRoute, incidentRoutingRegistry } from './incident-routing.registry';

export const productionPreflightContract = {
  version: 'agm-production-preflight.v1', incidentId: 'AGM-OPS-PRODUCTION-ACCESS', routeId: 'production-access',
} as const;

export type PreflightStatus = 'PASS' | 'FAIL' | 'NOT CONFIGURED';
export type PreflightCheckId = 'ssh-identity' | 'ssh-agent' | 'ssh-connectivity' | 'ssh-authentication' | 'console-rescue' | 'production-api' | 'guardian-telemetry' | 'recovery-procedure';
export type ProductionPreflightCheck = { id: PreflightCheckId; status: PreflightStatus; checkedAt: string; safeDetail: string };
export type ProductionPreflightSnapshot = { contract: typeof productionPreflightContract.version; environment: 'production'; checkedAt: string; overallStatus: 'READY' | 'ATTENTION'; checks: ProductionPreflightCheck[] };

let latestProductionPreflightSnapshot: ProductionPreflightSnapshot | undefined;

export function currentProductionPreflightSnapshot() {
  return latestProductionPreflightSnapshot;
}

export function evaluateProductionPreflight(checks: ProductionPreflightCheck[], checkedAt: string): ProductionPreflightSnapshot {
  return { contract: productionPreflightContract.version, environment: 'production', checkedAt, overallStatus: checks.every((check) => check.status === 'PASS') ? 'READY' : 'ATTENTION', checks };
}

export function renderProductionPreflight(snapshot?: ProductionPreflightSnapshot) {
  snapshot ??= latestProductionPreflightSnapshot;
  if (!snapshot) return `<section class="production-preflight" id="production-preflight"><header><strong>Production Access Preflight</strong><span>NOT REPORTED</span></header><p>Nu există încă un raport runtime importat. Starea Production nu este dedusă.</p></section>`;
  return `<section class="production-preflight" id="production-preflight"><header><strong>Production Access Preflight</strong><span>${snapshot.overallStatus}</span></header><p>Ultima verificare: ${new Date(snapshot.checkedAt).toLocaleString()}</p><div>${snapshot.checks.map((check) => `<article class="${check.status === 'PASS' ? 'configured' : 'attention'}"><strong>${check.id}</strong><span>${check.status}</span><p>${escapeHtml(check.safeDetail)}</p></article>`).join('')}</div>${renderActivations()}</section>`;
}

let pollTimer: number | undefined;
function apiBaseUrl() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
  const configured = typeof env?.VITE_AGM_API_BASE_URL === 'string' ? env.VITE_AGM_API_BASE_URL.trim() : '';
  return (configured || (env?.DEV ? '/api/v1' : '')).replace(/\/$/, '');
}

export function bindProductionPreflight(onSnapshot: (snapshot: ProductionPreflightSnapshot) => void) {
  const root = document.querySelector<HTMLElement>('#production-preflight');
  if (!root) return;
  const refresh = async () => {
    const base = apiBaseUrl();
    if (!base) return;
    try {
      const response = await fetch(`${base}/operations/production-preflight`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('PREFLIGHT_UNAVAILABLE');
      const snapshot = ((await response.json()) as { data?: ProductionPreflightSnapshot }).data;
      if (!snapshot || snapshot.contract !== productionPreflightContract.version) throw new Error('PREFLIGHT_INVALID');
      latestProductionPreflightSnapshot = snapshot;
      root.outerHTML = renderProductionPreflight(snapshot);
      onSnapshot(snapshot);
    } catch {
      root.querySelector('span')!.textContent = 'TELEMETRY UNAVAILABLE';
    }
  };
  void refresh();
  if (pollTimer !== undefined) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => void refresh(), 30_000);
}

function renderActivations() {
  const route = incidentRoutingRegistry.find((item) => item.id === productionPreflightContract.routeId)!;
  return `<details><summary>Routing și activări</summary><ul>${activateIncidentRoute(route).map((item) => `<li>${escapeHtml(item.agentId)} · ${item.role} · ${item.status}</li>`).join('')}</ul><p>${escapeHtml(route.privilegedAction)}</p></details>`;
}

function draft(snapshot: ProductionPreflightSnapshot): IncidentDraft {
  const failed = snapshot.checks.filter((check) => check.status !== 'PASS');
  return {
    id: productionPreflightContract.incidentId, occurredAt: snapshot.checkedAt, module: 'OPS-004 / Production Access Preflight', environments: ['API', 'Cloudflare'], category: 'infrastructure', severity: 'critical',
    symptom: failed.length ? `${failed.length} controale Production necesită atenție.` : 'Toate controalele Production Access au revenit la PASS.',
    reproduction: failed.map((check) => `${check.id}: ${check.status} (${check.safeDetail})`).join('; '), cause: failed.length ? 'Accesul operațional sau mecanismul de recuperare este incomplet.' : '',
    attemptedSolutions: 'Routing automat către Release & Operations, Backend & Infrastructure, Secret Guardian și Inspector.', appliedSolution: failed.length ? '' : 'Preflight-ul runtime confirmă restaurarea accesului și a serviciilor.',
    owner: 'release-operations / executor: backend-infrastructure / guardian: secret-credentials-guardian / validator: agent-inspector', fixedInVersion: '', tests: failed.length ? '' : 'Production Access Preflight: READY.', humanValidation: '',
    preventiveMeasure: 'Executarea automată a preflight-ului înaintea fiecărei ferestre și periodic.', status: failed.length ? 'new' : 'ready-test', relatedIncidentIds: [], reusableSolution: false,
  };
}

export function reconcileProductionPreflightIncident(incidents: OperationalIncident[], snapshot: ProductionPreflightSnapshot, now = new Date(snapshot.checkedAt)) {
  const existing = incidents.find((item) => item.id === productionPreflightContract.incidentId);
  const actor = 'Production Preflight / automatic routing';
  if (snapshot.overallStatus === 'ATTENTION') {
    if (!existing) return [createIncident(draft(snapshot), actor, now), ...incidents];
    if (!['validated', 'archived', 'ready-test'].includes(existing.status)) return incidents;
    const reopened = transitionIncident(existing, 'reopened', actor, 'Preflight-ul a detectat din nou o condiție Production neconformă.', now);
    return incidents.map((item) => item.id === existing.id ? reopened : item);
  }
  if (!existing || ['validated', 'archived'].includes(existing.status)) return incidents;
  const restoredDraft = { ...draft(snapshot), status: 'validated' as const, humanValidation: 'Validare operațională automată autorizată: Production Preflight curent 8/8 PASS.' };
  const restored = updateIncident(existing, restoredDraft, actor, 'Production Preflight curent confirmă 8/8 PASS; incidentul a fost închis automat.', now);
  return incidents.map((item) => item.id === existing.id ? restored : item);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}
