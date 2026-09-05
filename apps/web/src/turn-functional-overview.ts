export type TurnFunctionalZoneStatus = 'OPERATIONAL' | 'OBSERVED' | 'ATTENTION' | 'NO_ACTIVITY' | 'STATIC_REFERENCE' | 'CAPABILITY_MISSING' | 'UNKNOWN_LEGITIMATE';

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
    observed: number;
    attention: number;
    noActivity: number;
    staticReference: number;
    capabilityMissing: number;
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
  const basicZones = overview.zones.filter((zone) => zone.tier === 'BASIC');
  renderBasicSpatialModel(root, basicZones, overview);
  if (summary) summary.innerHTML = `
    <article><small>Zone reale</small><strong>${overview.summary.totalZones}</strong></article>
    <article><small>Operaționale</small><strong>${overview.summary.operational}</strong></article>
    <article><small>Activitate observată</small><strong>${overview.summary.observed}</strong></article>
    <article><small>Necesită acțiune</small><strong>${overview.summary.attention}</strong></article>
    <article><small>Fără activitate</small><strong>${overview.summary.noActivity}</strong></article>
    <article><small>Capabilități lipsă</small><strong>${overview.summary.capabilityMissing}</strong></article>
    <article><small>UNKNOWN legitim</small><strong>${overview.summary.legitimateUnknown}</strong></article>
    <article><small>UNKNOWN nerezolvat</small><strong>${overview.summary.unresolvedUnknown}</strong></article>`;
  if (zones) zones.innerHTML = (['BASIC', 'PREMIUM'] as const).map((tier) => `
    <section class="turn-functional-tier" data-functional-tier="${tier}">
      <header><h3>${tier}</h3><span>${overview.zones.filter((zone) => zone.tier === tier).length} zone</span></header>
      <div class="turn-functional-grid">${overview.zones.filter((zone) => zone.tier === tier).map(renderZone).join('')}</div>
    </section>`).join('');
  const verdict = root.querySelector<HTMLElement>('[data-functional-verdict]');
  if (verdict) verdict.textContent = `${basicOperationalVerdict(basicZones)} · PRODUCT OWNER ACCEPTANCE ${overview.verdict.productOwnerAcceptance}`;
  const timestamp = root.querySelector<HTMLElement>('[data-functional-generated-at]');
  if (timestamp) timestamp.textContent = `Proiecție generată: ${new Date(overview.generatedAt).toLocaleString('ro-RO')}`;
}

function renderBasicSpatialModel(root: HTMLElement, basicZones: TurnFunctionalZone[], overview: TurnFunctionalOverview) {
  root.querySelector<HTMLElement>('[data-basic-operational-orbit]')?.setAttribute('data-orbital-source', overview.contractVersion);
  const stage = root.querySelector<HTMLElement>('[data-basic-spatial-stage]');
  const orbitalStage = root.querySelector<HTMLElement>('[data-basic-orbital-stage]');
  const summary = root.querySelector<HTMLElement>('[data-basic-spatial-summary]');
  const selection = root.querySelector<HTMLElement>('[data-basic-spatial-selection]');
  const orbitalSelection = root.querySelector<HTMLElement>('[data-basic-orbital-selection]');
  const positions = spatialPositions(basicZones.length);
  const attention = basicZones.filter((zone) => ['ATTENTION', 'CAPABILITY_MISSING'].includes(zone.status)).length;
  const unknown = basicZones.filter((zone) => zone.status === 'UNKNOWN_LEGITIMATE').length;
  const observed = basicZones.filter((zone) => ['OPERATIONAL', 'OBSERVED', 'NO_ACTIVITY'].includes(zone.status)).length;
  if (summary) summary.innerHTML = `
    <article><small>Zone BASIC</small><strong>${basicZones.length}</strong></article>
    <article><small>Real observate</small><strong>${observed}</strong></article>
    <article><small>Acțiune necesară</small><strong>${attention}</strong></article>
    <article><small>UNKNOWN legitim</small><strong>${unknown}</strong></article>
    <article><small>Sursă</small><strong>${escapeHtml(overview.contractVersion)}</strong></article>`;
  if (!stage) return;
  const links = positions.map((position, index) => `<line x1="50" y1="50" x2="${position.x}" y2="${position.y}" data-basic-spatial-link="${escapeHtml(basicZones[index]?.id ?? '')}" />`).join('');
  stage.innerHTML = `
    <svg class="turn-spatial-links" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="27"></circle>${links}</svg>
    <div class="turn-spatial-core"><small>TURN BASIC</small><strong>${basicOperationalVerdict(basicZones)}</strong><span>${observed}/${basicZones.length} observate</span></div>
    ${basicZones.map((zone, index) => `<button type="button" class="turn-spatial-node status-${statusClass(zone.status)}" style="--node-x:${positions[index].x}%;--node-y:${positions[index].y}%" data-basic-spatial-node="${escapeHtml(zone.id)}" data-functional-status="${escapeHtml(zone.status)}" data-functional-source="${escapeHtml(zone.source.kind)}"><span aria-hidden="true"></span><strong>${escapeHtml(zone.title)}</strong><small>${escapeHtml(zone.status)}</small></button>`).join('')}`;
  stage.setAttribute('aria-busy', 'false');
  if (orbitalStage) {
    const planetPositions = orbitalPositions(basicZones.length);
    orbitalStage.innerHTML = `${renderOrbitalRings()}
      <div class="turn-approved-orbital-core status-model-live"><small>TURN BASIC</small><strong>LIVE MODEL</strong><span>${observed}/${basicZones.length} observate</span></div>
      ${basicZones.map((zone, index) => renderBasicOrbitalPlanet(zone, planetPositions[index], index)).join('')}`;
    orbitalStage.setAttribute('aria-busy', 'false');
  }
  const select = (zone: TurnFunctionalZone) => {
    stage.querySelectorAll<HTMLElement>('[data-basic-spatial-node]').forEach((node) => node.classList.toggle('selected', node.dataset.basicSpatialNode === zone.id));
    orbitalStage?.querySelectorAll<HTMLElement>('[data-basic-orbital-node]').forEach((node) => node.classList.toggle('selected', node.dataset.basicOrbitalNode === zone.id));
    if (selection) selection.innerHTML = renderSpatialZoneSelection(zone);
    if (orbitalSelection) orbitalSelection.innerHTML = renderSpatialZoneSelection(zone);
  };
  stage.querySelectorAll<HTMLButtonElement>('[data-basic-spatial-node]').forEach((button) => button.addEventListener('click', () => {
    const zone = basicZones.find((candidate) => candidate.id === button.dataset.basicSpatialNode);
    if (zone) select(zone);
  }));
  orbitalStage?.querySelectorAll<HTMLButtonElement>('[data-basic-orbital-node]').forEach((button) => button.addEventListener('click', () => {
    const zone = basicZones.find((candidate) => candidate.id === button.dataset.basicOrbitalNode);
    if (zone) select(zone);
  }));
  if (basicZones[0]) select(basicZones[0]);
}

function renderBasicOrbitalPlanet(zone: TurnFunctionalZone, position: { x: number; y: number }, index: number) {
  const observedAt = zone.source.observedAt ?? 'NO_REAL_OBSERVATION';
  return `<button type="button" class="turn-approved-orbital-node status-${statusClass(zone.status)}" style="--node-x:${position.x}%;--node-y:${position.y}%;--node-order:${index}" data-basic-orbital-node="${escapeHtml(zone.id)}" data-orbital-status="${escapeHtml(zone.status)}" data-orbital-evidence-source="${escapeHtml(zone.source.kind)}" data-orbital-observed-at="${escapeHtml(observedAt)}" title="${escapeHtml(`${zone.title} · ${zone.status} · ${zone.source.kind} · ${zone.source.label}`)}"><span class="turn-planet" aria-hidden="true"></span><small>${escapeHtml(zone.title)}</small></button>`;
}

function renderOrbitalRings() {
  return `<svg class="turn-approved-orbital-rings" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <ellipse cx="50" cy="50" rx="46" ry="18"></ellipse>
    <ellipse cx="50" cy="50" rx="40" ry="30" transform="rotate(25 50 50)"></ellipse>
    <ellipse cx="50" cy="50" rx="40" ry="30" transform="rotate(-25 50 50)"></ellipse>
    <ellipse cx="50" cy="50" rx="24" ry="38"></ellipse>
    <ellipse cx="50" cy="50" rx="34" ry="42"></ellipse>
  </svg>`;
}

function orbitalPositions(count: number) {
  const ringCounts = [0, 0, 0];
  for (let index = 0; index < count; index += 1) ringCounts[index % 3] += 1;
  const ringOffsets = [0, 0, 0];
  const radii = [{ x: 19, y: 16 }, { x: 32, y: 27 }, { x: 44, y: 37 }];
  return Array.from({ length: count }, (_, index) => {
    const ring = index % 3;
    const position = ringOffsets[ring]++;
    const angle = -Math.PI / 2 + (Math.PI * 2 * position) / Math.max(ringCounts[ring], 1) + ring * 0.28;
    return { x: 50 + Math.cos(angle) * radii[ring].x, y: 50 + Math.sin(angle) * radii[ring].y };
  });
}

function renderSpatialZoneSelection(zone: TurnFunctionalZone) {
  return `<header><div><small>${escapeHtml(zone.id)}</small><h3>${escapeHtml(zone.title)}</h3></div><strong class="status-${statusClass(zone.status)}">${escapeHtml(zone.status)}</strong></header>
    <p>${escapeHtml(zone.information)}</p>
    <dl>
      <div><dt>Sursă reală</dt><dd>${escapeHtml(zone.source.kind)} · ${escapeHtml(zone.source.label)} · ${zone.source.observedAt ? escapeHtml(new Date(zone.source.observedAt).toLocaleString('ro-RO')) : 'NO REAL OBSERVATION'}</dd></div>
      <div><dt>De ce / ce lipsește</dt><dd>${escapeHtml(zone.missing ?? zone.unknownReason ?? 'Nimic raportat de evaluator.')}</dd></div>
      <div><dt>Acțiune</dt><dd>${escapeHtml(zone.implementation ?? zone.action.label)}</dd></div>
    </dl><a class="operation-action" href="${escapeHtml(zone.action.href)}" data-open-turn-page="investigate">${escapeHtml(zone.action.label)}</a>`;
}

function spatialPositions(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(count, 1);
    return { x: 50 + Math.cos(angle) * 41, y: 50 + Math.sin(angle) * 37 };
  });
}

function basicOperationalVerdict(zones: TurnFunctionalZone[]) {
  if (zones.some((zone) => ['ATTENTION', 'CAPABILITY_MISSING'].includes(zone.status))) return 'ATTENTION';
  if (zones.some((zone) => zone.status === 'UNKNOWN_LEGITIMATE')) return 'UNKNOWN LEGITIMATE';
  return 'OPERATIONAL';
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
  const stage = root.querySelector<HTMLElement>('[data-basic-spatial-stage]');
  if (stage) stage.innerHTML = `<p class="turn-functional-unavailable"><strong>DATA UNAVAILABLE</strong> · ${escapeHtml(reason)} Niciun nod nu este derivat din registry.</p>`;
  const orbitalStage = root.querySelector<HTMLElement>('[data-basic-orbital-stage]');
  if (orbitalStage) {
    orbitalStage.innerHTML = `<p class="turn-functional-unavailable"><strong>DATA UNAVAILABLE</strong> · ${escapeHtml(reason)} Nu se fabrică planete din registry.</p>`;
    orbitalStage.setAttribute('aria-busy', 'false');
  }
  const verdict = root.querySelector<HTMLElement>('[data-functional-verdict]');
  if (verdict) verdict.textContent = 'DATA UNAVAILABLE';
}

function statusClass(status: string) {
  return status.toLowerCase().replace(/[_\s]+/g, '-');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}
