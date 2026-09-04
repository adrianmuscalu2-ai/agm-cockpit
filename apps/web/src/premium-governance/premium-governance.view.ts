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
    <section class="turn-authority-control-plane" id="turn-authority-control-plane" aria-labelledby="turn-authority-control-plane-title">
      <header class="premium-governance-heading">
        <span>TURN · ADMINISTRATIVE OPERATIONS</span>
        <h2 id="turn-authority-control-plane-title">AGM Authority Control Plane</h2>
        <p>Panou operațional din heartbeat, lifecycle, event stores, authority leases și dependency telemetry. Registry-ul furnizează numai identitatea.</p>
      </header>
      <section class="agm-network-hero" data-authority-dashboard aria-live="polite" aria-busy="true">
        <header class="agm-operational-header"><div><small>Authority evaluator</small><strong data-control-status>SE ÎNCARCĂ</strong></div><p data-network-message>Se citesc sursele reale autorizate…</p><button type="button" data-run-operational-inspections>Rulează inspectorii reali</button></header>
        <footer class="agm-network-summary">
          <div><small>Executive authority</small><strong data-active-authorities>—</strong></div>
          <div><small>Operational identities</small><strong data-node-count>—</strong></div>
          <div><small>Authority conflicts</small><strong data-conflict-count>—</strong></div>
          <div><small>Opportunity Intelligence</small><strong data-opportunity-gate>NEEVALUAT</strong></div>
        </footer>
        <div class="agm-authority-detail" data-authority-detail></div>
      </section>

      <section id="turn-premium-network" aria-labelledby="turn-premium-network-title">
        <header class="premium-governance-heading">
          <span>TURN · PREMIUM OPERATIONAL NODES</span>
          <h2 id="turn-premium-network-title">Premium: runtime și capabilități reale</h2>
          <p>Pentru fiecare identitate: prezență runtime, sănătate, activitate, freshness, sursă, dependențe, motiv și acțiune. Lipsa implementării rămâne vizibilă.</p>
        </header>
        <section class="premium-network-detail" data-agent-network-detail aria-live="polite" aria-busy="true">
          <div class="premium-network-toolbar"><span data-network-contract>Contract: —</span><span>Verde = evidență reală curentă · Portocaliu = degradat/stale · Roșu = failed/absent · Gri = neobservat</span></div>
          <div class="premium-network-departments" data-network-departments></div>
          <p class="agm-network-message" data-network-message>Se încarcă registrul canonic…</p>
        </section>
      </section>
    </section>`;
}
