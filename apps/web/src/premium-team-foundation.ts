import { renderPremiumShell } from './premium-shell';

type PremiumTeamTranslator = (key: string) => string;

type PremiumAgent = {
  id: string;
  marker: string;
  nameKey: string;
  roleKey: string;
};

const premiumAgents: PremiumAgent[] = [
  { id: 'mentor', marker: 'ME', nameKey: 'premium.team.agent.mentor.name', roleKey: 'premium.team.agent.mentor.role' },
  { id: 'atlas', marker: 'AT', nameKey: 'premium.team.agent.atlas.name', roleKey: 'premium.team.agent.atlas.role' },
  {
    id: 'inspector',
    marker: 'IN',
    nameKey: 'premium.team.agent.inspector.name',
    roleKey: 'premium.team.agent.inspector.role',
  },
  {
    id: 'transport',
    marker: 'TR',
    nameKey: 'premium.team.agent.transport.name',
    roleKey: 'premium.team.agent.transport.role',
  },
  {
    id: 'load-safety',
    marker: 'LS',
    nameKey: 'premium.team.agent.loadSafety.name',
    roleKey: 'premium.team.agent.loadSafety.role',
  },
  {
    id: 'communication',
    marker: 'CM',
    nameKey: 'premium.team.agent.communication.name',
    roleKey: 'premium.team.agent.communication.role',
  },
  {
    id: 'documents',
    marker: 'DO',
    nameKey: 'premium.team.agent.documents.name',
    roleKey: 'premium.team.agent.documents.role',
  },
  { id: 'journal', marker: 'JR', nameKey: 'premium.team.agent.journal.name', roleKey: 'premium.team.agent.journal.role' },
];

export function renderPremiumTeamFoundation(
  translate: PremiumTeamTranslator,
  escapeHtml: (value: string) => string,
) {
  const agents = premiumAgents
    .map(
      (agent) => `
        <article class="premium-team-agent premium-team-agent-preparing" aria-labelledby="premium-agent-${agent.id}">
          <span class="premium-team-marker" aria-hidden="true">${agent.marker}</span>
          <div class="premium-team-agent-content">
            <h2 id="premium-agent-${agent.id}">${escapeHtml(translate(agent.nameKey))}</h2>
            <p>${escapeHtml(translate(agent.roleKey))}</p>
            <span class="premium-team-state">
              <span class="premium-team-state-dot" aria-hidden="true"></span>
              ${escapeHtml(translate('premium.team.status.preparing'))}
            </span>
          </div>
        </article>
      `,
    )
    .join('');

  return renderPremiumShell({
    viewClass: 'premium-team-view',
    labelledBy: 'premium-team-title',
    brandHref: '/premium',
    brandModule: 'premium',
    brandAriaLabel: escapeHtml(translate('premium.team.backToPremium')),
    navigation: `
      <nav class="premium-team-navigation" aria-label="${escapeHtml(translate('premium.team.navigationLabel'))}">
        <a href="/premium" data-module="premium" class="premium-back">${escapeHtml(translate('premium.team.backToPremium'))}</a>
        <a href="/" data-module="home" class="premium-back">${escapeHtml(translate('premium.backToBasic'))}</a>
      </nav>
    `,
    content: `
      <div class="premium-team-intro">
        <span>${escapeHtml(translate('premium.team.eyebrow'))}</span>
        <h1 id="premium-team-title">${escapeHtml(translate('premium.team.title'))}</h1>
        <p>${escapeHtml(translate('premium.team.description'))}</p>
      </div>

      <div class="premium-team-legend" aria-label="${escapeHtml(translate('premium.team.legendLabel'))}">
        <span class="premium-team-legend-preparing"><i aria-hidden="true"></i>${escapeHtml(translate('premium.team.status.preparing'))}</span>
        <span class="premium-team-legend-available"><i aria-hidden="true"></i>${escapeHtml(translate('premium.team.status.available'))}</span>
        <span class="premium-team-legend-active"><i aria-hidden="true"></i>${escapeHtml(translate('premium.team.status.active'))}</span>
      </div>

      <div class="premium-team-grid" aria-label="${escapeHtml(translate('premium.team.agentsLabel'))}">
        ${agents}
      </div>
    `,
    footer: `
      <a href="/premium" data-module="premium" class="premium-back">${escapeHtml(translate('premium.team.backToPremium'))}</a>
      <a href="/" data-module="home" class="premium-back">${escapeHtml(translate('premium.backToBasic'))}</a>
    `,
  });
}
