import { createIncident, transitionIncident, updateIncident, type IncidentDraft, type OperationalIncident } from './incident-journal';
import { apiBaseUrl } from './authenticated-api';

export const secretTelemetryContract = {
  version: 'secret-telemetry.v1', guardianId: 'secret-credentials-guardian',
  monitorId: 'monitor-security', incidentId: 'AGM-SEC-SECRET-TELEMETRY',
} as const;

export type SecretMetadataStatus = 'CONFIGURED' | 'MISSING' | 'INVALID' | 'ROTATION REQUIRED';
export type SecretMetadata = { id: string; status: SecretMetadataStatus; provider: string; dependentService: string; environment: string; lastValidatedAt: string; incidentId: string | null };
export type SecretTelemetrySnapshot = { contract: typeof secretTelemetryContract.version; guardian: typeof secretTelemetryContract.guardianId; monitor: typeof secretTelemetryContract.monitorId; overallStatus: 'CONFIGURED' | 'ATTENTION'; checkedAt: string; secrets: SecretMetadata[] };

let pollTimer: number | undefined;
let refreshPromise: Promise<void> | undefined;
let latestSnapshot: SecretTelemetrySnapshot | undefined;
export const secretTelemetryPollIntervalMs = 60_000;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}

export function renderSecretTelemetryPanel() {
  return `<section class="secret-telemetry" data-secret-telemetry aria-live="polite"><header><strong>Secret &amp; Credentials Guardian</strong><span data-secret-overall>CHECKING</span></header><p>Telemetrie sigură: sunt afișate exclusiv metadate; valorile secretelor nu sunt transferate în Browser.</p><div data-secret-items><p>Se verifică sursa canonică…</p></div></section>`;
}

export function renderSecretMetadata(snapshot: SecretTelemetrySnapshot) {
  return snapshot.secrets.map((item) => `<article class="secret-metadata-item ${item.status === 'CONFIGURED' ? 'configured' : 'attention'}"><strong>${escapeHtml(item.id)}</strong><span>${escapeHtml(item.status)}</span><dl><div><dt>Furnizor</dt><dd>${escapeHtml(item.provider)}</dd></div><div><dt>Serviciu dependent</dt><dd>${escapeHtml(item.dependentService)}</dd></div><div><dt>Mediu</dt><dd>${escapeHtml(item.environment)}</dd></div><div><dt>Ultima validare</dt><dd>${escapeHtml(new Date(item.lastValidatedAt).toLocaleString())}</dd></div><div><dt>Incident asociat</dt><dd>${item.incidentId ? `<a href="#incident-${escapeHtml(item.incidentId)}">${escapeHtml(item.incidentId)}</a>` : 'Niciunul'}</dd></div></dl></article>`).join('');
}

function incidentDraft(snapshot: SecretTelemetrySnapshot): IncidentDraft {
  const affected = snapshot.secrets.filter((item) => item.status !== 'CONFIGURED');
  return {
    id: secretTelemetryContract.incidentId, occurredAt: snapshot.checkedAt, module: 'Secret & Credentials Guardian', environments: ['API'], category: 'security',
    symptom: affected.length ? `Telemetria sigură raportează ${affected.length} referințe de secret care necesită atenție.` : 'Referințele secretelor sunt validate prin telemetria sigură.',
    severity: 'major', reproduction: 'Verificare automată prin contractul secret-telemetry.v1; valorile nu sunt transferate.',
    cause: affected.map((item) => `${item.id}: ${item.status}`).join('; '), attemptedSolutions: 'Secret & Credentials Guardian validează referințele în mediul protejat.',
    appliedSolution: affected.length ? '' : 'Referințele de configurare au revenit la starea CONFIGURED.', owner: 'Secret & Credentials Guardian / MON-012', fixedInVersion: '',
    tests: affected.length ? '' : 'Revenirea CONFIGURED a fost observată automat prin telemetrie.', humanValidation: '', preventiveMeasure: 'Validare periodică și rotație controlată fără expunerea valorilor.',
    status: affected.length ? 'new' : 'ready-test', relatedIncidentIds: [], reusableSolution: false,
  };
}

export function reconcileSecretTelemetryIncident(incidents: OperationalIncident[], snapshot: SecretTelemetrySnapshot, now = new Date(snapshot.checkedAt)) {
  const existing = incidents.find((item) => item.id === secretTelemetryContract.incidentId);
  const actor = 'Secret & Credentials Guardian / MON-012';
  if (snapshot.overallStatus === 'ATTENTION') {
    if (!existing) return [createIncident(incidentDraft(snapshot), actor, now), ...incidents];
    if (!['validated', 'archived', 'ready-test'].includes(existing.status)) return incidents;
    const reopened = transitionIncident(existing, 'reopened', actor, 'Telemetria a detectat din nou o referință care necesită atenție.', now);
    return incidents.map((item) => item.id === reopened.id ? reopened : item);
  }
  if (!existing || ['validated', 'archived'].includes(existing.status)) return incidents;
  const restoredDraft = { ...incidentDraft(snapshot), status: 'validated' as const, humanValidation: 'Validare operațională automată autorizată prin telemetria Guardian curentă.' };
  const restored = updateIncident(existing, restoredDraft, actor, 'Telemetria LIVE a confirmat toate referințele CONFIGURED; incidentul a fost închis automat.', now);
  return incidents.map((item) => item.id === restored.id ? restored : item);
}

export function bindSecretTelemetry(onSnapshot: (snapshot: SecretTelemetrySnapshot) => void) {
  if (!document.querySelector('[data-secret-telemetry]')) return;
  if (latestSnapshot) paintSnapshot(latestSnapshot);
  const refresh = async () => {
    if (refreshPromise) return refreshPromise;
    const base = apiBaseUrl();
    if (!base) return;
    refreshPromise = (async () => {
      const accessToken = readOwnerAccessToken(window.localStorage);
      if (!accessToken) {
        paintUnavailable('AUTH REQUIRED', 'Deblochează Owner Access pentru telemetria Guardian.');
        return;
      }
      try {
        const response = await fetch(`${base}/security/secrets/health`, { cache: 'no-store', headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` } });
        if (!response.ok) throw new Error('SECRET_TELEMETRY_UNAVAILABLE');
        const snapshot = ((await response.json()) as { data?: SecretTelemetrySnapshot }).data;
        if (!snapshot || snapshot.contract !== secretTelemetryContract.version) throw new Error('SECRET_TELEMETRY_INVALID');
        latestSnapshot = snapshot;
        onSnapshot(snapshot);
        paintSnapshot(snapshot);
      } catch {
        latestSnapshot = undefined;
        paintUnavailable('TELEMETRY UNAVAILABLE', 'Canalul de telemetrie nu răspunde. Nu se deduce starea secretelor.');
      }
    })().finally(() => { refreshPromise = undefined; });
    return refreshPromise;
  };
  void refresh();
  if (pollTimer !== undefined) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => void refresh(), secretTelemetryPollIntervalMs);
}

function paintSnapshot(snapshot: SecretTelemetrySnapshot) {
  document.querySelectorAll<HTMLElement>('[data-secret-telemetry]').forEach((panel) => {
    const overall = panel.querySelector<HTMLElement>('[data-secret-overall]');
    const items = panel.querySelector<HTMLElement>('[data-secret-items]');
    if (overall) overall.textContent = snapshot.overallStatus;
    if (items) items.innerHTML = renderSecretMetadata(snapshot);
  });
}

function paintUnavailable(status: string, detail: string) {
  document.querySelectorAll<HTMLElement>('[data-secret-telemetry]').forEach((panel) => {
    const overall = panel.querySelector<HTMLElement>('[data-secret-overall]');
    const items = panel.querySelector<HTMLElement>('[data-secret-items]');
    if (overall) overall.textContent = status;
    if (items) items.innerHTML = `<p>${detail}</p>`;
  });
}

function readOwnerAccessToken(storage: Storage) {
  try {
    const session = JSON.parse(storage.getItem('agm.admin.session') ?? 'null') as { accessToken?: string } | null;
    return session?.accessToken?.trim() || '';
  } catch {
    return '';
  }
}
