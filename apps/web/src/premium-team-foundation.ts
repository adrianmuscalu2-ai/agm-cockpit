import { premiumAgents } from './premium-agents';
import { premiumAgentStateDefinition } from './premium-agent-states';
import { renderPremiumShell } from './premium-shell';

type PremiumTeamTranslator = (key: string) => string;

export function renderPremiumTeamFoundation(
  translate: PremiumTeamTranslator,
  escapeHtml: (value: string) => string,
) {
  const agents = premiumAgents
    .map((agent) => {
      const state = premiumAgentStateDefinition(agent.state);

      return `
        <article class="premium-team-agent ${state.className}" aria-labelledby="premium-agent-${agent.id}">
          <span class="premium-team-marker" aria-hidden="true">${agent.marker}</span>
          <div class="premium-team-agent-content">
            <h2 id="premium-agent-${agent.id}">${escapeHtml(translate(agent.nameKey))}</h2>
            <p>${escapeHtml(translate(agent.roleKey))}</p>
            <span class="premium-team-state">
              <span class="premium-team-state-dot" aria-hidden="true"></span>
              ${escapeHtml(translate(state.translationKey))}
            </span>
          </div>
        </article>
      `;
    })
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
