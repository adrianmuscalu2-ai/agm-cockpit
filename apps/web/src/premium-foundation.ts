import { renderPremiumShell } from './premium-shell';
import type { BasicLanguageCode } from './language-registry';
import { copilotEnabled } from './premium-copilot/copilot.contract';
import { renderCopilot } from './premium-copilot/copilot.view';

type PremiumTranslator = (key: string) => string;

const approvedUserWorkspaces = [
  { title: 'Pre-Departure', href: '/before-departure.html' },
  { title: 'Journey Operations Workspace', href: '/after-departure.html' },
  { title: 'AGM Car Mover', href: '/car-mover', module: 'carMover' },
  { title: 'Vorbește cu AGM', href: '/premium/voice', module: 'premiumVoice' },
] as const;

export function renderPremiumFoundation(translate: PremiumTranslator, escapeHtml: (value: string) => string, language:BasicLanguageCode='ro') {
  if(typeof window!=='undefined'&&copilotEnabled(window.localStorage))return renderCopilot(language,escapeHtml);
  const workspaces = approvedUserWorkspaces.map((workspace) => `
    <article class="premium-module premium-user-workspace">
      <div class="premium-module-content">
        <h2>${escapeHtml(workspace.title)}</h2>
        <a class="premium-module-action" href="${workspace.href}"${'module' in workspace ? ` data-module="${workspace.module}"` : ''}>${escapeHtml(translate('premium.module.open'))}</a>
      </div>
    </article>
  `).join('');

  return renderPremiumShell({
    viewClass: 'premium-view', labelledBy: 'premium-title', brandHref: '/', brandModule: 'home',
    brandAriaLabel: escapeHtml(translate('premium.backToBasic')),
    navigation: `<a href="/" data-module="home" class="premium-back">${escapeHtml(translate('premium.backToBasic'))}</a>`,
    content: `<div class="premium-intro"><span>${escapeHtml(translate('premium.eyebrow'))}</span><h1 id="premium-title">${escapeHtml(translate('premium.title'))}</h1><p>${escapeHtml(translate('premium.description'))}</p></div><section class="premium-modules premium-user-workspaces" aria-label="Premium operational workspaces">${workspaces}</section>`,
    footer: `<a href="/" data-module="home" class="premium-back premium-back-footer">${escapeHtml(translate('premium.backToBasic'))}</a>`,
  });
}
