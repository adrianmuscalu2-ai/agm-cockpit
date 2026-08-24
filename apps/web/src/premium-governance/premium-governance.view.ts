import { renderPremiumShell } from '../premium-shell';

type Translate = (key: string) => string;
type Escape = (value: string) => string;

const workspaces = [
  { title: 'Pre-Departure', href: '/before-departure.html' },
  { title: 'Journey Operations Workspace', href: '/after-departure.html' },
  { title: 'AGM Car Mover', href: '/car-mover', module: 'carMover' },
  { title: 'Vorbește cu AGM', href: '/premium/voice', module: 'premiumVoice' },
] as const;

export function renderPremiumGovernanceDashboard(translate: Translate, escapeHtml: Escape) {
  const workspaceCards = workspaces.map((workspace) => `
    <article class="premium-module premium-user-workspace">
      <div class="premium-module-content">
        <h2>${escapeHtml(workspace.title)}</h2>
        <a class="premium-module-action" href="${workspace.href}"${'module' in workspace ? ` data-module="${workspace.module}"` : ''}>${escapeHtml(translate('premium.module.open'))}</a>
      </div>
    </article>
  `).join('');
  return renderPremiumShell({
    viewClass: 'premium-governance-view', labelledBy: 'premium-governance-title', brandHref: '/', brandModule: 'home',
    brandAriaLabel: escapeHtml(translate('premium.backToBasic')),
    navigation: `<nav class="premium-governance-nav"><a href="/" data-module="home" class="premium-back">${escapeHtml(translate('premium.backToBasic'))}</a><a href="/premium/network" data-module="premiumNetwork" class="premium-back">Agent Network</a><a href="/premium/copilot" data-module="premiumCopilot" class="premium-back">AGM Copilot</a></nav>`,
    content: `
      <header class="premium-governance-heading">
        <span>AGM PREMIUM</span><h1 id="premium-governance-title">Authority Control Plane</h1>
        <p>Rețea canonică, authority persistentă și telemetrie observabilă. Telemetria nu comandă și nu blochează aplicația.</p>
      </header>
      <section class="agm-network-hero" data-authority-dashboard aria-live="polite" aria-busy="true">
        <div class="agm-network-stage" data-network-stage>
          <div class="agm-orbit agm-orbit-outer" aria-hidden="true"></div><div class="agm-orbit agm-orbit-middle" aria-hidden="true"></div><div class="agm-orbit agm-orbit-inner" aria-hidden="true"></div>
          <article class="agm-control-plane-node status-no-telemetry"><small>AGM</small><strong>Authority<br>Control Plane</strong><span data-control-status>NO TELEMETRY</span></article>
          <div data-network-nodes></div>
        </div>
        <footer class="agm-network-summary">
          <div><small>Executive authority</small><strong data-active-authorities>—</strong></div>
          <div><small>Registered nodes</small><strong data-node-count>—</strong></div>
          <div><small>Authority conflicts</small><strong data-conflict-count>—</strong></div>
          <div><small>Opportunity Intelligence</small><strong data-opportunity-gate>NO-GO</strong></div>
        </footer>
        <p class="agm-network-message" data-network-message>Se încarcă starea AGM persistentă…</p>
      </section>
      <section class="premium-modules premium-user-workspaces" aria-label="Premium operational workspaces">${workspaceCards}</section>
    `,
    footer: `<a href="/" data-module="home" class="premium-back premium-back-footer">${escapeHtml(translate('premium.backToBasic'))}</a>`,
  });
}

export function renderPremiumNetworkDrilldown() {
  return renderPremiumShell({
    viewClass: 'premium-network-detail-view', labelledBy: 'premium-network-title', brandHref: '/premium', brandModule: 'premium', brandAriaLabel: 'AGM Premium',
    navigation: `<nav class="premium-governance-nav"><a href="/premium" data-module="premium" class="premium-back">Dashboard Premium</a><a href="/" data-module="home" class="premium-back">Basic</a></nav>`,
    content: `
      <header class="premium-governance-heading"><span>AGM PREMIUM</span><h1 id="premium-network-title">Agent Network</h1><p>Departamente, supervisori, dependency state, authority și ultima activitate din registrele AGM.</p></header>
      <section class="premium-network-detail" data-agent-network-detail aria-live="polite" aria-busy="true">
        <div class="premium-network-toolbar"><span data-network-contract>Contract: —</span><span>Legendă: <i class="legend-pass"></i> PASS / ACTIVE · <i class="legend-degraded"></i> DEGRADED / STALE · <i class="legend-fail"></i> FAIL / ACTION REQUIRED · <i class="legend-none"></i> NO TELEMETRY · <i class="legend-standby"></i> STANDBY / ADVISORY</span></div>
        <div class="premium-network-departments" data-network-departments></div>
        <p class="agm-network-message" data-network-message>Se încarcă registrul canonic…</p>
      </section>
    `,
    footer: `<a href="/premium" data-module="premium" class="premium-back">Dashboard Premium</a>`,
  });
}
