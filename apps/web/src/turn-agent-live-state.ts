export type TurnAgentLifecycle = 'STARTED' | 'WORKING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
export type TurnAgentRuntimeEvent = {
  eventId: string;
  mandateId: string;
  agentId: string;
  dossierId: string;
  lifecycle: TurnAgentLifecycle;
  sequence: number;
  occurredAt: string;
  recordedAt: string;
  evidenceRef: string;
  outputRef?: string | null;
  evidenceHash?: string | null;
  detail: string;
};

const tokenKey = 'agm.auth.accessToken';
let pollTimer: number | undefined;
let cursor: string | undefined;
const seen = new Set<string>();
const history: TurnAgentRuntimeEvent[] = [];
const pendingVisualEvents: TurnAgentRuntimeEvent[] = [];
let visualTimer: number | undefined;
let currentRuntimeEvent: TurnAgentRuntimeEvent | undefined;

function apiBaseUrl() {
  const configured = import.meta.env.VITE_AGM_API_BASE_URL?.trim().replace(/\/$/, '');
  return configured || (import.meta.env.DEV ? 'http://127.0.0.1:3000/api/v1' : '/api/v1');
}

function tone(lifecycle: TurnAgentLifecycle) {
  if (lifecycle === 'COMPLETED') return 'operational';
  if (lifecycle === 'FAILED') return 'failed';
  if (lifecycle === 'BLOCKED') return 'degraded';
  return 'monitoring';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}

export function renderTurnAgentLiveState() {
  return `<section class="turn-agent-live-state" data-turn-agent-live="loading" aria-live="polite" aria-atomic="false">
    <header><div><span class="turn-kicker">P3 → EVENTSTORE/API → TURN</span><h3>Execuție reală agenți</h3></div><strong data-live-connection>CONNECTING</strong></header>
    <p data-live-current>Nicio execuție runtime încărcată.</p>
    <ol data-live-events></ol>
  </section>`;
}

function renderHistory() {
  const root = document.querySelector<HTMLElement>('[data-turn-agent-live]');
  if (!root) return;
  history.sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt) || left.mandateId.localeCompare(right.mandateId) || left.sequence - right.sequence);
  const latestByAgent = new Map<string, TurnAgentRuntimeEvent>();
  history.forEach((event) => latestByAgent.set(event.agentId, event));
  const latest = currentRuntimeEvent ?? history.at(-1);
  root.dataset.turnAgentLive = latest ? 'live' : 'empty';
  const connection = root.querySelector<HTMLElement>('[data-live-connection]');
  if (connection) connection.textContent = latest ? 'LIVE · PERSISTENT' : 'LIVE · NO EVENTS';
  const current = root.querySelector<HTMLElement>('[data-live-current]');
  if (current) current.textContent = latest ? `${latest.agentId} · ${latest.lifecycle} · mandat ${latest.mandateId}` : 'Nicio execuție runtime persistentă înregistrată.';
  const list = root.querySelector<HTMLElement>('[data-live-events]');
  if (list) list.innerHTML = history.slice(-20).reverse().map((event) => `<li class="${tone(event.lifecycle)}" data-runtime-event-id="${escapeHtml(event.eventId)}"><strong>${escapeHtml(event.lifecycle)}</strong><span>${escapeHtml(event.agentId)} · ${escapeHtml(event.mandateId)}</span><time>${escapeHtml(new Date(event.occurredAt).toLocaleTimeString())}</time><small>${escapeHtml(event.detail)}</small><code>${escapeHtml(event.evidenceRef)}</code></li>`).join('');
  for (const [agentId, event] of latestByAgent) {
    document.querySelectorAll<HTMLElement>(`[data-live-agent-id="${CSS.escape(agentId)}"], [data-agent-row-id="${CSS.escape(agentId)}"]`).forEach((row) => {
      row.dataset.runtimeLifecycle = event.lifecycle;
      row.classList.remove('operational', 'failed', 'degraded', 'monitoring');
      row.classList.add(tone(event.lifecycle));
      const status = row.querySelector<HTMLElement>('[data-agent-live-status]') ?? row.querySelector<HTMLElement>('.turn-status');
      if (status) status.textContent = event.lifecycle;
    });
  }
}

function showNextPersistedEvent() {
  const event = pendingVisualEvents.shift();
  if (!event) { visualTimer = undefined; return; }
  currentRuntimeEvent = event;
  history.push(event);
  renderHistory();
  visualTimer = window.setTimeout(showNextPersistedEvent, 350);
}

export function applyTurnAgentRuntimeEvents(events: readonly TurnAgentRuntimeEvent[]) {
  const fresh = events.filter((event) => !seen.has(event.eventId)).sort((left, right) => left.mandateId.localeCompare(right.mandateId) || left.agentId.localeCompare(right.agentId) || left.sequence - right.sequence);
  fresh.forEach((event) => seen.add(event.eventId));
  if (!history.length && !pendingVisualEvents.length) {
    history.push(...fresh);
    currentRuntimeEvent = history.at(-1);
    renderHistory();
    return;
  }
  pendingVisualEvents.push(...fresh);
  if (visualTimer === undefined && pendingVisualEvents.length) showNextPersistedEvent();
}

async function poll(fetcher: typeof fetch) {
  const root = document.querySelector<HTMLElement>('[data-turn-agent-live]');
  if (!root) return;
  const token = sessionStorage.getItem(tokenKey);
  if (!token) {
    root.dataset.turnAgentLive = 'auth-required';
    const connection = root.querySelector<HTMLElement>('[data-live-connection]');
    if (connection) connection.textContent = 'AUTH REQUIRED';
    return;
  }
  const query = new URLSearchParams({ limit: '200' });
  if (cursor) query.set('after', cursor);
  const response = await fetcher(`${apiBaseUrl()}/agent-runtime-events?${query}`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`AGENT_RUNTIME_EVENTS_HTTP_${response.status}`);
  const payload = await response.json() as { data?: { events?: TurnAgentRuntimeEvent[]; cursor?: string | null } };
  applyTurnAgentRuntimeEvents(payload.data?.events ?? []);
  cursor = payload.data?.cursor ?? cursor;
}

export function bindTurnAgentLiveState(fetcher: typeof fetch = fetch) {
  if (pollTimer !== undefined) window.clearInterval(pollTimer);
  const run = () => void poll(fetcher).catch(() => {
    const root = document.querySelector<HTMLElement>('[data-turn-agent-live]');
    if (!root) return;
    root.dataset.turnAgentLive = 'unavailable';
    const connection = root.querySelector<HTMLElement>('[data-live-connection]');
    if (connection) connection.textContent = 'API UNAVAILABLE';
  });
  run();
  pollTimer = window.setInterval(run, 1000);
}
