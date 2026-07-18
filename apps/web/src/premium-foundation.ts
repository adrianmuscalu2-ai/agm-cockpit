import { renderPremiumShell } from './premium-shell';

type PremiumTranslator = (key: string) => string;

type PremiumModule = {
  id: string;
  marker: string;
  titleKey: string;
  descriptionKey: string;
};

const premiumModules: PremiumModule[] = [
  {
    id: 'ai-friend',
    marker: 'AI',
    titleKey: 'premium.module.aiFriend.title',
    descriptionKey: 'premium.module.aiFriend.description',
  },
  {
    id: 'transport-assistant',
    marker: 'TR',
    titleKey: 'premium.module.transport.title',
    descriptionKey: 'premium.module.transport.description',
  },
  {
    id: 'load-safety',
    marker: 'LS',
    titleKey: 'premium.module.loadSafety.title',
    descriptionKey: 'premium.module.loadSafety.description',
  },
  {
    id: 'smart-communication',
    marker: 'CM',
    titleKey: 'premium.module.communication.title',
    descriptionKey: 'premium.module.communication.description',
  },
  {
    id: 'driver-journal',
    marker: 'JR',
    titleKey: 'premium.module.journal.title',
    descriptionKey: 'premium.module.journal.description',
  },
];

export function renderPremiumFoundation(translate: PremiumTranslator, escapeHtml: (value: string) => string) {
  const modules = premiumModules
    .map(
      (module) => `
        <article class="premium-module" aria-labelledby="premium-${module.id}-title">
          <span class="premium-module-marker" aria-hidden="true">${module.marker}</span>
          <div class="premium-module-content">
            <h2 id="premium-${module.id}-title">${escapeHtml(translate(module.titleKey))}</h2>
            <p>${escapeHtml(translate(module.descriptionKey))}</p>
            <span class="premium-module-status">${escapeHtml(translate('premium.module.unavailable'))}</span>
          </div>
        </article>
      `,
    )
    .join('');

  return renderPremiumShell({
    viewClass: 'premium-view',
    labelledBy: 'premium-title',
    brandHref: '/',
    brandModule: 'home',
    brandAriaLabel: escapeHtml(translate('premium.backToBasic')),
    navigation: `<a href="/" data-module="home" class="premium-back">${escapeHtml(translate('premium.backToBasic'))}</a>`,
    content: `
      <div class="premium-intro">
        <span>${escapeHtml(translate('premium.eyebrow'))}</span>
        <h1 id="premium-title">${escapeHtml(translate('premium.title'))}</h1>
        <p>${escapeHtml(translate('premium.description'))}</p>
        <a href="/premium/team" data-module="premiumTeam" class="premium-team-entry">
          <strong>${escapeHtml(translate('premium.team.entryTitle'))}</strong>
          <span>${escapeHtml(translate('premium.team.entryDescription'))}</span>
        </a>
      </div>

      <div class="premium-modules" aria-label="${escapeHtml(translate('premium.modulesLabel'))}">
        ${modules}
      </div>
    `,
    footer: `
      <a href="/" data-module="home" class="premium-back premium-back-footer">
        ${escapeHtml(translate('premium.backToBasic'))}
      </a>
    `,
  });
}
