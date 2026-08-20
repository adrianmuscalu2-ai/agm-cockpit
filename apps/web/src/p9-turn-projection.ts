export type P9TurnProjection = {
  contract: 'agm-turn-p9-operational-projection.v1';
  executionId: string;
  state: 'ACTIVE' | 'STOPPED';
  smoke: { passed: number; total: number; errors: number; timeouts: number };
  killSwitch: 'ACTIVE' | 'INACTIVE';
  rollback: 'READY' | 'NOT_READY';
  lastValidatedAt: string;
  source: { kind: 'OPERATIONAL_EVIDENCE'; runtime: string; smoke: string; policy: string };
};

const projectionUrl = '/operational/p9-turn-projection.json';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character,
  );
}

export function validateP9TurnProjection(value: unknown): P9TurnProjection {
  const projection = value as Partial<P9TurnProjection> | null;
  if (
    !projection || projection.contract !== 'agm-turn-p9-operational-projection.v1' ||
    projection.state !== 'ACTIVE' || projection.killSwitch !== 'ACTIVE' ||
    projection.rollback !== 'READY' || !projection.executionId || !projection.lastValidatedAt ||
    projection.smoke?.passed !== 5 || projection.smoke.total !== 5 ||
    projection.smoke.errors !== 0 || projection.smoke.timeouts !== 0 ||
    projection.source?.kind !== 'OPERATIONAL_EVIDENCE'
  ) throw new Error('P9_TURN_OPERATIONAL_PROJECTION_INVALID');
  return projection as P9TurnProjection;
}

export function renderP9TurnProjection() {
  return `<article class="turn-card p9-turn-card" id="turn-p9" data-p9-projection="loading">
    <header><div><span class="turn-kicker">AI · COPILOT CONTROL PLANE</span><strong>P9</strong></div><span class="turn-status watch" data-p9-field="state">SE ÎNCARCĂ</span></header>
    <p>Proiecție operațională read-only. Nu controlează activarea P9.</p>
    <dl class="p9-turn-grid">
      <div><dt>Smoke</dt><dd data-p9-field="smoke">—</dd></div>
      <div><dt>Kill Switch</dt><dd data-p9-field="killSwitch">—</dd></div>
      <div><dt>Rollback</dt><dd data-p9-field="rollback">—</dd></div>
      <div><dt>Erori / timeouturi</dt><dd data-p9-field="errors">—</dd></div>
      <div><dt>Ultima validare</dt><dd data-p9-field="validatedAt">—</dd></div>
      <div><dt>Execution ID</dt><dd data-p9-field="executionId">—</dd></div>
    </dl>
    <small data-p9-field="source">Sursa operațională se verifică…</small>
  </article>`;
}

function setField(card: HTMLElement, field: string, value: string) {
  const target = card.querySelector<HTMLElement>(`[data-p9-field="${field}"]`);
  if (target) target.textContent = value;
}

export function applyP9TurnProjection(card: HTMLElement, projection: P9TurnProjection) {
  card.dataset.p9Projection = 'live';
  setField(card, 'state', `P9 — ${projection.state}`);
  card.querySelector('[data-p9-field="state"]')?.classList.replace('watch', 'active');
  setField(card, 'smoke', `${projection.smoke.passed}/${projection.smoke.total} PASS`);
  setField(card, 'killSwitch', projection.killSwitch);
  setField(card, 'rollback', projection.rollback);
  setField(card, 'errors', `${projection.smoke.errors}/${projection.smoke.timeouts}`);
  setField(card, 'validatedAt', new Date(projection.lastValidatedAt).toLocaleString());
  setField(card, 'executionId', projection.executionId);
  setField(card, 'source', `Sursă: ${projection.source.kind} · runtime + smoke + policy`);
  card.title = [projection.source.runtime, projection.source.smoke, projection.source.policy].join('\n');
}

export async function bindP9TurnProjection(fetcher: typeof fetch = fetch) {
  const card = document.querySelector<HTMLElement>('[data-p9-projection]');
  if (!card) return;
  try {
    const response = await fetcher(projectionUrl, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`P9_TURN_PROJECTION_HTTP_${response.status}`);
    applyP9TurnProjection(card, validateP9TurnProjection(await response.json()));
  } catch {
    card.dataset.p9Projection = 'unavailable';
    setField(card, 'state', 'P9 — STARE INDISPONIBILĂ');
    setField(card, 'source', 'Sursa operațională nu poate fi verificată.');
  }
}
