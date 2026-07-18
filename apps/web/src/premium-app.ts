import { renderPremiumFoundation } from './premium-foundation';
import { isPremiumView, type PremiumViewName } from './premium-routes';
import { renderPremiumTeamFoundation } from './premium-team-foundation';

type PremiumTranslator = (key: string) => string;
type HtmlEscaper = (value: string) => string;

export function renderPremiumView(
  view: string,
  translate: PremiumTranslator,
  escapeHtml: HtmlEscaper,
): string | undefined {
  if (view === 'premium') {
    return renderPremiumFoundation(translate, escapeHtml);
  }

  if (view === 'premiumTeam') {
    return renderPremiumTeamFoundation(translate, escapeHtml);
  }

  return undefined;
}

export function premiumStatusKey(view: PremiumViewName) {
  return view === 'premium' ? 'premium.status' : 'premium.team.status';
}

export function usesPremiumLayout(view: string) {
  return isPremiumView(view);
}
