export type TurnFunctionalZoneStatus = 'OPERATIONAL' | 'ATTENTION' | 'NO_ACTIVITY' | 'STATIC_REFERENCE' | 'UNKNOWN_LEGITIMATE';

export type TurnFunctionalZone = {
  id: string;
  tier: 'BASIC' | 'PREMIUM';
  title: string;
  status: TurnFunctionalZoneStatus;
  information: string;
  source: { kind: string; label: string; observedAt: string | null };
  evidence: Record<string, string | number | boolean | null>;
  action: { label: string; href: string };
  missing: string | null;
  implementation: string | null;
  legitimateUnknown: boolean;
  unknownReason: string | null;
};

export type TurnFunctionalOverview = {
  contractVersion: string;
  generatedAt: string;
  verdict: {
    turnFunctionalCompleteness: 'FAIL' | 'READY_FOR_PRODUCT_OWNER_REVIEW';
    productOwnerAcceptance: 'NOT_GRANTED';
    finalProductionPass: 'RETRACTED';
  };
  summary: {
    totalZones: number;
    operational: number;
    attention: number;
    noActivity: number;
    staticReference: number;
    legitimateUnknown: number;
    unresolvedUnknown: number;
  };
  zones: TurnFunctionalZone[];
};

type StoredAdminSession = { accessToken?: string };

function apiBaseUrl() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const configured = env?.VITE_AGM_API_BASE_URL?.trim().replace(/\/$/, '');
  return configured || (env?.DEV ? 'http://127.0.0.1:3000/api/v1' : '/api/v1');
}

export async function fetchTurnFunctionalOverview(accessToken: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`${apiBaseUrl()}/operations/turn/functional-overview`, {
    cache: 'no-store',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({})) as { data?: TurnFunctionalOverview; message?: string };
  if (!response.ok || !payload.data) throw new Error(payload.message || `TURN_FUNCTIONAL_OVERVIEW_HTTP_${response.status}`);
  return payload.data;
}

export async function bindTurnFunctionalOverview(fetcher: typeof fetch = fetch, storage: Storage = window.localStorage) {
  const root = document.querySelector<HTMLElement>('[data-turn-functional-overview]');
  if (!root) return;
  const session = readSession(storage);
  if (!session?.accessToken) {
    renderUnavailable(root, 'AUTH REQUIRED · Deblochează Owner Access pentru proiecția funcțională.');
    return;
  }
  try {
    const overview = await fetchTurnFunctionalOverview(session.accessToken, fetcher);
    renderOverview(root, overview);
  } catch (error) {
    renderUnavailable(root, error instanceof Error ? error.message : 'Sursa funcțională nu este disponibilă.');
  }
}

function readSession(storage: Storage): StoredAdminSession | null {
  try {
    return JSON.parse(storage.getItem('agm.admin.session') ?? 'null') as StoredAdminSession | null;
  } catch {
    return null;
  }
}

function renderOverview(root: HTMLElement, overview: TurnFunctionalOverview) {
  root.dataset.functionalContract = overview.contractVersion;
  root.dataset.functionalVerdict = overview.verdict.turnFunctionalCompleteness;
  root.setAttribute('aria-busy', 'false');
  const summary = root.querySelector<HTMLElement>('[data-functional-summary]');
  const zones = root.querySelector<HTMLElement>('[data-functional-zones]');
  if (summary) summary.innerHTML = `
    <article><small>Zone reale</small><strong>${overview.summary.totalZones}</strong></article>
    <article><small>Operaționale</small><strong>${overview.summary.operational}</strong></article>
    <article><small>Necesită acțiune</small><strong>${overview.summary.attention}</strong></article>
    <article><small>Fără activitate</small><strong>${overview.summary.noActivity}</strong></article>
    <article><small>UNKNOWN legitim</small><strong>${overview.summary.legitimateUnknown}</strong></article>
    <article><small>UNKNOWN nerezolvat</small><strong>${overview.summary.unresolvedUnknown}</strong></article>`;
  if (zones) zones.innerHTML = (['BASIC', 'PREMIUM'] as const).map((tier) => `
    <section class="turn-functional-tier" data-functional-tier="${tier}">
      <header><h3>${tier}</h3><span>${overview.zones.filter((zone) => zone.tier === tier).length} zone</span></header>
      <div class="turn-functional-grid">${overview.zones.filter((zone) => zone.tier === tier).map(renderZone).join('')}</div>
    </section>`).join('');
  const verdict = root.querySelector<HTMLElement>('[data-functional-verdict]');
  if (verdict) verdict.textContent = `${overview.verdict.turnFunctionalCompleteness} · PRODUCT OWNER ACCEPTANCE ${overview.verdict.productOwnerAcceptance} · FINAL_PRODUCTION_PASS ${overview.verdict.finalProductionPass}`;
  const timestamp = root.querySelector<HTMLElement>('[data-functional-generated-at]');
  if (timestamp) timestamp.textContent = `Proiecție generată: ${new Date(overview.generatedAt).toLocaleString('ro-RO')}`;
}

function renderZone(zone: TurnFunctionalZone) {
  const evidence = Object.entries(zone.evidence).map(([key, value]) => `<span><b>${escapeHtml(key)}</b>: ${escapeHtml(String(value))}</span>`).join('');
  return `<article class="turn-functional-zone status-${zone.status.toLowerCase().replaceAll('_', '-')}" data-functional-zone="${escapeHtml(zone.id)}" data-functional-status="${zone.status}">
    <header><h4>${escapeHtml(zone.title)}</h4><strong>${escapeHtml(zone.status)}</strong></header>
    <p>${escapeHtml(zone.information)}</p>
    <dl>
      <div><dt>Sursa reală</dt><dd>${escapeHtml(zone.source.kind)} · ${escapeHtml(zone.source.label)}${zone.source.observedAt ? ` · ${escapeHtml(new Date(zone.source.observedAt).toLocaleString('ro-RO'))}` : ''}</dd></div>
      <div><dt>Dovadă</dt><dd class="turn-functional-evidence">${evidence || 'Fără câmpuri raportate'}</dd></div>
      <div><dt>Ce lipsește</dt><dd>${escapeHtml(zone.missing ?? 'Nimic raportat de sursa curentă.')}</dd></div>
      <div><dt>Implementare / limită</dt><dd>${escapeHtml(zone.implementation ?? zone.unknownReason ?? 'Nu este necesară o remediere curentă.')}</dd></div>
    </dl>
    <a class="operation-action" href="${escapeHtml(zone.action.href)}">${escapeHtml(zone.action.label)}</a>
  </article>`;
}

function renderUnavailable(root: HTMLElement, reason: string) {
  root.dataset.functionalVerdict = 'DATA_UNAVAILABLE';
  root.setAttribute('aria-busy', 'false');
  const zones = root.querySelector<HTMLElement>('[data-functional-zones]');
  if (zones) zones.innerHTML = `<p class="turn-functional-unavailable"><strong>DATA UNAVAILABLE</strong> · ${escapeHtml(reason)} Nicio stare funcțională nu este dedusă.</p>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}
