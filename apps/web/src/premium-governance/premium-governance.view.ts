import { renderPremiumShell } from '../premium-shell';

type Translate = (key: string) => string;
type Escape = (value: string) => string;

const workspaces = [
  { titleKey: 'premium.module.beforeDeparture.title', href: '/before-departure.html' },
  { titleKey: 'premium.module.afterDeparture.title', href: '/after-departure.html' },
  { title: 'AGM Car Mover', href: '/car-mover', module: 'carMover' },
  { titleKey: 'premium.module.aiFriend.title', href: '/premium/voice', module: 'premiumVoice' },
] as const;

export function renderPremiumUserDashboard(translate: Translate, escapeHtml: Escape) {
  const workspaceCards = workspaces.map((workspace) => `
    <article class="premium-module premium-user-workspace">
      <div class="premium-module-content">
        <h2>${escapeHtml('titleKey' in workspace ? translate(workspace.titleKey) : workspace.title)}</h2>
        <a class="premium-module-action" href="${workspace.href}"${'module' in workspace ? ` data-module="${workspace.module}"` : ''}>${escapeHtml(translate('premium.module.open'))}</a>
      </div>
    </article>
  `).join('');

  return renderPremiumShell({
    viewClass: 'premium-governance-view premium-user-dashboard',
    labelledBy: 'premium-dashboard-title',
    brandHref: '/',
    brandModule: 'home',
    brandAriaLabel: escapeHtml(translate('premium.backToBasic')),
    navigation: `<nav class="premium-governance-nav"><a href="/" data-module="home" class="premium-back">${escapeHtml(translate('premium.backToBasic'))}</a><a href="/premium/copilot" data-module="premiumCopilot" class="premium-back">AGM Copilot</a></nav>`,
    content: `
      <header class="premium-governance-heading">
        <span>AGM PREMIUM</span>
        <h1 id="premium-dashboard-title">${escapeHtml(translate('premium.title'))}</h1>
        <p>${escapeHtml(translate('premium.description'))}</p>
      </header>
      <section class="premium-modules premium-user-workspaces" aria-label="${escapeHtml(translate('premium.modulesLabel'))}">${workspaceCards}</section>
    `,
    footer: `<a href="/" data-module="home" class="premium-back premium-back-footer">${escapeHtml(translate('premium.backToBasic'))}</a>`,
  });
}

export function renderTurnAuthorityControlPlane() {
  return `
    <div class="turn-authority-control-plane turn-premium-operational-panel" id="turn-authority-control-plane" data-premium-operational-panel data-turn-page-container hidden>
    <section class="turn-spatial-page turn-premium-spatial-page" data-turn-page="premium" hidden aria-labelledby="turn-authority-control-plane-title">
      <header class="premium-governance-heading">
        <span>PAGINA 2 · TURN PREMIUM · REAL AGENT NETWORK</span>
        <h2 id="turn-authority-control-plane-title">Premium operational space</h2>
        <p>Poziția și culoarea fiecărui nod sunt o proiecție interactivă a telemetriei canonice. Click pe agent pentru runtime, cauză, dovadă și acțiune.</p>
      </header>
      <section class="agm-network-hero" data-authority-dashboard aria-live="polite" aria-busy="true">
        <section class="turn-approved-orbital-panel premium" data-premium-operational-orbit data-orbital-source="PENDING_REAL_SOURCE" aria-labelledby="turn-premium-orbit-title">
          <header>
            <div><span>TURN · APPROVED VISUAL SOURCE</span><h3 id="turn-premium-orbit-title">AGM TURN PREMIUM AGENT CONTROL PANEL</h3><p>Panoul orbital aprobat este recuperat ca proiecție interactivă a telemetriei canonice; panoul operațional existent rămâne integral mai jos.</p></div>
            <p class="turn-orbital-legend"><strong>Criteriu vizual:</strong> verde = PASS, portocaliu = DEGRADED, roșu = FAIL, albastru = STANDBY, gri = NO TELEMETRY. Identitatea vine din registry; culoarea vine exclusiv din runtime/evidence.</p>
          </header>
          <nav class="turn-orbital-criteria" data-premium-orbital-criteria aria-label="Criteriul de colorare al agenților">
            <button type="button" data-premium-orbital-criterion="operational" aria-selected="true">Stare operațională</button>
            <button type="button" data-premium-orbital-criterion="telemetry" aria-selected="false">Telemetrie</button>
            <button type="button" data-premium-orbital-criterion="procedural" aria-selected="false">Procedural</button>
            <button type="button" data-premium-orbital-criterion="component" aria-selected="false">Componentă / dependențe</button>
            <button type="button" data-premium-orbital-criterion="incidents" aria-selected="false">Incidente</button>
            <button type="button" data-premium-orbital-criterion="freshness" aria-selected="false">Freshness</button>
          </nav>
          <p class="turn-orbital-criterion-message" data-premium-orbital-criterion-message>Se încarcă evaluatorul operațional real…</p>
          <div class="turn-approved-orbital-stage premium" data-premium-orbital-stage aria-busy="true"><p>Se citește telemetria operațională autorizată…</p></div>
          <section class="turn-orbital-criterion-maps" data-premium-orbital-criterion-maps aria-label="Hărți planetare pe criterii"></section>
          <aside class="turn-approved-orbital-selection" data-premium-orbital-selection><p>Selectează o planetă Premium pentru runtime, heartbeat, motiv și acțiune.</p></aside>
        </section>
        <header class="agm-operational-header"><div><small>Authority evaluator</small><strong data-control-status>SE ÎNCARCĂ</strong></div><p data-network-message>Se citesc sursele reale autorizate…</p><button type="button" data-run-operational-inspections>Rulează inspectorii reali</button></header>
        <footer class="agm-network-summary" data-operational-summary>
          <div><small>Total agents</small><strong data-node-count>—</strong></div>
          <div><small>Runtime observed</small><strong data-runtime-running>—</strong></div>
          <div><small>Runtime absent / unseen</small><strong data-runtime-not-running>—</strong></div>
          <div><small>Healthy</small><strong data-health-healthy>—</strong></div>
          <div><small>Degraded</small><strong data-health-degraded>—</strong></div>
          <div><small>Failed</small><strong data-health-failed>—</strong></div>
          <div><small>Unknown / no telemetry</small><strong data-health-unknown>—</strong></div>
          <div><small>Standby / idle</small><strong data-health-standby>—</strong></div>
          <div><small>Executive authority</small><strong data-active-authorities>—</strong></div>
          <div><small>Authority conflicts</small><strong data-conflict-count>—</strong></div>
          <div><small>Opportunity Intelligence</small><strong data-opportunity-gate>NEEVALUAT</strong></div>
        </footer>
        <div class="turn-spatial-stage turn-premium-stage" data-premium-spatial-stage aria-busy="true"></div>
        <aside class="turn-spatial-selection" data-premium-spatial-selection><p>Selectează un agent Premium.</p></aside>
        <nav class="turn-spatial-actions"><button type="button" data-open-turn-page="incidents">Vezi calificarea incidentelor</button><button type="button" data-open-turn-page="investigate">Deschide drill-down complet</button></nav>
      </section>
    </section>

      <section class="turn-premium-drilldown" data-turn-page="investigate" hidden id="turn-premium-network" aria-labelledby="turn-premium-network-title">
        <header class="premium-governance-heading">
          <span>DRILL-DOWN · AUTHORITY + 28 OPERATIONAL NODES</span>
          <h2 id="turn-premium-network-title">Premium evidence and runtime detail</h2>
          <p>Detaliul complet rămâne disponibil pentru investigație; nu ocupă suprafața principală de comandă.</p>
        </header>
        <section class="agm-authority-detail" data-authority-detail></section>
        <section class="premium-network-detail" data-agent-network-detail aria-live="polite" aria-busy="true">
          <div class="premium-network-toolbar"><span data-network-contract>Contract: —</span><span>Verde = evidență reală curentă · Portocaliu = degradat/stale · Roșu = failed/absent · Gri = neobservat</span></div>
          <div class="premium-network-departments" data-network-departments></div>
          <p class="agm-network-message" data-network-message>Se încarcă exclusiv telemetria operațională autorizată…</p>
        </section>
      </section>
    </div>`;
}
