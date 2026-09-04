import { fetchTurnOperationalTruth, operationalTruthIsPass, type OperationalTruthStep, type TurnOperationalTruth } from './turn-operational-truth';

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

let pollTimer: number | undefined;
export const turnAgentLivePollIntervalMs = 5_000;
const seen = new Set<string>();
const history: TurnAgentRuntimeEvent[] = [];
const pendingVisualEvents: TurnAgentRuntimeEvent[] = [];
let visualTimer: number | undefined;
let currentRuntimeEvent: TurnAgentRuntimeEvent | undefined;

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
    <header><div><span class="turn-kicker">MACHINE IDENTITY → CREDENTIAL → TOKEN → ACP → TELEMETRY → EVENTSTORE/API → TURN → UI</span><h3>Adevăr operațional autentificat</h3></div><div class="turn-live-actions"><strong data-live-connection>CONNECTING</strong><button type="button" data-live-refresh>Reîncarcă starea</button></div></header>
    <p data-live-current>Nicio dovadă M2M încărcată.</p>
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
      row.dataset.lastRuntimeLifecycle = event.lifecycle;
      row.dataset.lastRuntimeMandate = event.mandateId;
      row.dataset.lastRuntimeAt = event.recordedAt;
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
  const truth = await fetchTurnOperationalTruth(fetcher);
  if (truth.latestEvent) applyTurnAgentRuntimeEvents([truth.latestEvent as TurnAgentRuntimeEvent]);
  renderOperationalTruth(root, truth);
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
  pollTimer = window.setInterval(run, turnAgentLivePollIntervalMs);
  const trigger = document.querySelector<HTMLButtonElement>('[data-live-refresh]');
  trigger?.addEventListener('click', () => {
    trigger.disabled = true;
    const connection = document.querySelector<HTMLElement>('[data-live-connection]');
    if (connection) connection.textContent = 'REFRESHING';
    void poll(fetcher).catch(() => {
      if (connection) connection.textContent = 'REFRESH FAILED';
    }).finally(() => { trigger.disabled = false; });
  }, { once: true });
}

function renderOperationalTruth(root: HTMLElement, truth: TurnOperationalTruth) {
  const pass = operationalTruthIsPass(truth);
  root.dataset.turnAgentLive = pass ? 'pass' : truth.overallStatus.toLowerCase().replace('_', '-');
  root.dataset.falseGreen = String(truth.falseGreen);
  root.dataset.unexplainedDegraded = String(truth.unexplainedDegraded);
  const connection = root.querySelector<HTMLElement>('[data-live-connection]');
  if (connection) connection.textContent = `${truth.authStatus} · ${truth.telemetryStatus}`;
  const current = root.querySelector<HTMLElement>('[data-live-current]');
  if (current) current.textContent = `${truth.reason} · ${truth.observedAt ? new Date(truth.observedAt).toLocaleString() : 'fără observație autenticată'}`;
  const steps: Array<[string, OperationalTruthStep]> = [
    ['MACHINE IDENTITY', truth.chain.machineIdentity],
    ['CREDENTIAL', truth.chain.credential],
    ['TOKEN', truth.chain.token],
    ['AUTHENTICATED ACP READ', truth.chain.authenticatedAcpRead],
    ['TELEMETRY', truth.chain.telemetry],
    ['EVENTSTORE', truth.chain.eventStore],
    ['API', truth.chain.api],
    ['TURN', truth.chain.turn],
    ['UI', { ...truth.chain.ui, status: pass ? 'PASS' : truth.chain.ui.status, ref: `${truth.contractVersion}@${truth.generatedAt}` }],
  ];
  const list = root.querySelector<HTMLElement>('[data-live-events]');
  if (list) list.innerHTML = steps.map(([label, step]) => {
    const evidence = step.ref ?? step.eventId ?? step.requestId ?? step.responseDigest ?? step.observedAt ?? step.recordedAt ?? step.scope ?? step.contract ?? step.route ?? 'NO LIVE EVIDENCE';
    const tone = ['PASS', 'VERIFIED', 'PERSISTED', 'EVIDENCE AVAILABLE', 'READY FOR LIVE RENDER'].includes(step.status) ? 'operational' : truth.overallStatus === 'DEGRADED' ? 'degraded' : 'failed';
    return `<li class="${tone}" data-operational-step="${escapeHtml(label.toLowerCase().replace(/\s+/g, '-'))}"><strong>${escapeHtml(step.status)}</strong><span>${escapeHtml(label)}</span><small>${escapeHtml(step.source ?? truth.reason)}</small><code>${escapeHtml(evidence)}</code></li>`;
  }).join('');
}
