import { authenticatedApiFetch } from '../authenticated-api';

type NodeStatus = 'PASS' | 'DEGRADED' | 'FAIL' | 'NO_TELEMETRY' | 'STANDBY';
type NetworkNode = {
  canonicalId: string; kind: string; module: string; ownerId: string; supervisorId: string | null; scope: string;
  lifecycleStatus: string; status: NodeStatus; statusLabel: string; statusSource: string; statusObservedAt: string | null;
  dependencyState: string; authorityState: { state: string; epoch?: number; fencingToken?: number; providerId?: string; expiresAt?: string };
  failoverState: string; telemetry: { lastSeenAt?: string; detail?: string } | null; lastRun: { lifecycle: string; occurredAt: string; detail: string } | null;
};
type Dashboard = {
  contractVersion: string; controlPlane: { status: NodeStatus; activeExecutiveAuthorities: number; conflicts: unknown[] };
  nodes: NetworkNode[]; departments: Array<{ module: string; nodeCount: number }>;
  opportunityIntelligence: { gate: string; reason: string };
};
type Envelope = { data?: Dashboard; message?: string | string[] };

export function bindPremiumGovernanceRuntime(turnAdminAccessToken?: string) {
  const dashboard = document.querySelector<HTMLElement>('[data-authority-dashboard]');
  const detail = document.querySelector<HTMLElement>('[data-agent-network-detail]');
  if (!dashboard && !detail) return;
  void load(turnAdminAccessToken).then((data) => {
    if (dashboard) renderHero(dashboard, data);
    if (detail) renderDetail(detail, data);
  }).catch((error) => {
    const root = dashboard ?? detail;
    if (!root) return;
    root.setAttribute('aria-busy', 'false');
    const message = root.querySelector<HTMLElement>('[data-network-message]');
    if (message) message.textContent = error instanceof Error ? error.message : 'Starea AGM nu este disponibilă.';
  });
}

async function load(turnAdminAccessToken?: string) {
  if (!turnAdminAccessToken) throw new Error('Authority Control Plane este disponibil numai după deblocarea administrativă Turn.');
  const response = await authenticatedApiFetch('/authority-control-plane/dashboard', {
    cache: 'no-store',
    headers: { 'X-AGM-Turn-Authorization': `Bearer ${turnAdminAccessToken}` },
  });
  const envelope = await response.json().catch(() => ({})) as Envelope;
  if (!response.ok || !envelope.data) throw new Error('Nu s-a putut încărca starea reală AGM. Aplicația rămâne funcțională; doar telemetria este indisponibilă.');
  return envelope.data;
}

function renderHero(root: HTMLElement, data: Dashboard) {
  const nodeHost = root.querySelector<HTMLElement>('[data-network-nodes]');
  const nodes = data.nodes.filter((node) => node.canonicalId !== 'agm.authority.control-plane');
  if (nodeHost) nodeHost.innerHTML = nodes.map((node, index) => {
    const governance = ['governance', 'security', 'architecture', 'release', 'operations', 'recovery'].includes(node.module);
    const ring = governance ? 31 : 47;
    const peers = nodes.filter((candidate) => (['governance', 'security', 'architecture', 'release', 'operations', 'recovery'].includes(candidate.module)) === governance);
    const peerIndex = peers.findIndex((candidate) => candidate.canonicalId === node.canonicalId);
    const angle = (peerIndex / Math.max(peers.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(angle) * ring;
    const y = 50 + Math.sin(angle) * ring;
    return `<article class="agm-network-node status-${statusClass(node.status)}" style="--node-x:${x.toFixed(2)}%;--node-y:${y.toFixed(2)}%;--node-order:${index}" title="${escapeHtml(node.canonicalId)}"><span aria-hidden="true">${node.kind === 'HUMAN_AUTHORITY' ? '◆' : '●'}</span><strong>${escapeHtml(shortName(node.canonicalId))}</strong><small>${escapeHtml(node.status.replace('_', ' '))}</small></article>`;
  }).join('');
  nodeHost?.querySelectorAll<HTMLElement>('.agm-network-node').forEach((element, index) => {
    const node = nodes[index];
    if (!node?.statusLabel || !node.statusSource) return;
    element.title = `${node.canonicalId} · ${node.statusSource}`;
    const label = element.querySelector<HTMLElement>('small');
    if (label) label.textContent = node.statusLabel;
  });
  setText(root, '[data-control-status]', data.controlPlane.status);
  const controlPlane = root.querySelector('.agm-control-plane-node');
  controlPlane?.classList.remove('status-pass', 'status-degraded', 'status-fail', 'status-no-telemetry', 'status-standby');
  controlPlane?.classList.add(`status-${statusClass(data.controlPlane.status)}`);
  setText(root, '[data-active-authorities]', String(data.controlPlane.activeExecutiveAuthorities));
  setText(root, '[data-node-count]', String(data.nodes.length));
  setText(root, '[data-conflict-count]', String(data.controlPlane.conflicts.length));
  setText(root, '[data-opportunity-gate]', data.opportunityIntelligence.gate);
  const message = root.querySelector<HTMLElement>('[data-network-message]');
  if (message) message.textContent = `Sursă: registru persistent AGM · ${data.contractVersion}`;
  root.setAttribute('aria-busy', 'false');
}

function renderDetail(root: HTMLElement, data: Dashboard) {
  setText(root, '[data-network-contract]', `Contract: ${data.contractVersion}`);
  const host = root.querySelector<HTMLElement>('[data-network-departments]');
  if (host) host.innerHTML = data.departments.map((department) => {
    const nodes = data.nodes.filter((node) => node.module === department.module);
    return `<section class="premium-network-department"><header><h2>${escapeHtml(department.module)}</h2><span>${nodes.length}</span></header><div class="premium-network-agent-grid">${nodes.map(renderAgent).join('')}</div></section>`;
  }).join('');
  const message = root.querySelector<HTMLElement>('[data-network-message]');
  if (message) message.textContent = 'Telemetria este observabilă și consultativă; nu acordă authority și nu blochează aplicația.';
  root.setAttribute('aria-busy', 'false');
}

function renderAgentLegacy(node: NetworkNode) {
  const lastRun = node.lastRun ? `${node.lastRun.lifecycle} · ${formatDate(node.lastRun.occurredAt)}` : 'NO TELEMETRY';
  const lastSeen = node.telemetry?.lastSeenAt ? formatDate(node.telemetry.lastSeenAt) : 'NO TELEMETRY';
  return `<article class="premium-network-agent status-${statusClass(node.status)}"><header><span class="network-status-dot" aria-hidden="true"></span><div><strong>${escapeHtml(node.canonicalId)}</strong><small>${escapeHtml(node.kind)}</small></div></header><dl><div><dt>Owner</dt><dd>${escapeHtml(node.ownerId)}</dd></div><div><dt>Supervisor</dt><dd>${escapeHtml(node.supervisorId ?? 'Human authority')}</dd></div><div><dt>Scope</dt><dd>${escapeHtml(node.scope)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(node.status.replace('_', ' '))}</dd></div><div><dt>Dependency</dt><dd>${escapeHtml(node.dependencyState)}</dd></div><div><dt>Authority</dt><dd>${escapeHtml(node.authorityState.state)}${node.authorityState.epoch ? ` · epoch ${node.authorityState.epoch}` : ''}</dd></div><div><dt>Failover</dt><dd>${escapeHtml(node.failoverState)}</dd></div><div><dt>Last telemetry</dt><dd>${escapeHtml(lastSeen)}</dd></div><div><dt>Last run</dt><dd>${escapeHtml(lastRun)}</dd></div></dl></article>`;
}

function renderAgent(node: NetworkNode) {
  if (!node.statusLabel || !node.statusSource) return renderAgentLegacy(node);
  const lastRun = node.lastRun ? `${node.lastRun.lifecycle} · ${formatDate(node.lastRun.occurredAt)}` : 'NO TELEMETRY';
  const lastSeen = node.telemetry?.lastSeenAt ? formatDate(node.telemetry.lastSeenAt) : 'NO TELEMETRY';
  const observedAt = node.statusObservedAt ? formatDate(node.statusObservedAt) : 'REGISTRY CURRENT';
  return `<article class="premium-network-agent status-${statusClass(node.status)}" data-canonical-agent-id="${escapeHtml(node.canonicalId)}" data-canonical-status="${escapeHtml(node.status)}"><header><span class="network-status-dot" aria-hidden="true"></span><div><strong>${escapeHtml(node.canonicalId)}</strong><small>${escapeHtml(node.kind)}</small></div></header><dl><div><dt>Owner</dt><dd>${escapeHtml(node.ownerId)}</dd></div><div><dt>Supervisor</dt><dd>${escapeHtml(node.supervisorId ?? 'Human authority')}</dd></div><div><dt>Scope</dt><dd>${escapeHtml(node.scope)}</dd></div><div><dt>Status canonic</dt><dd>${escapeHtml(node.statusLabel)} · ${escapeHtml(node.status)}</dd></div><div><dt>Sursă stare</dt><dd>${escapeHtml(node.statusSource)} · ${escapeHtml(observedAt)}</dd></div><div><dt>Registry lifecycle</dt><dd>${escapeHtml(node.lifecycleStatus)}</dd></div><div><dt>Dependency</dt><dd>${escapeHtml(node.dependencyState)}</dd></div><div><dt>Authority</dt><dd>${escapeHtml(node.authorityState.state)}${node.authorityState.epoch ? ` · epoch ${node.authorityState.epoch}` : ''}</dd></div><div><dt>Failover</dt><dd>${escapeHtml(node.failoverState)}</dd></div><div><dt>Last telemetry</dt><dd>${escapeHtml(lastSeen)}</dd></div><div><dt>Last run</dt><dd>${escapeHtml(lastRun)}</dd></div></dl></article>`;
}

function setText(root: HTMLElement, selector: string, value: string) { const element = root.querySelector<HTMLElement>(selector); if (element) element.textContent = value; }
function statusClass(status: string) { return status.toLowerCase().replace(/_/g, '-'); }
function shortName(id: string) { const parts = id.split('.'); return parts.slice(-2).join(' '); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character); }
