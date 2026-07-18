import { renderPremiumFoundation } from './premium-foundation';
import { premiumCopilotModule } from './premium-copilot/premium-copilot.module';
import { premiumContextAnalysisModule } from './premium-context-analysis/premium-context-analysis.module';
import { premiumLinguisticAgentsModule } from './premium-linguistic-agents/premium-linguistic-agents.module';
import { proactiveRecommendationsModule } from './premium-proactive-recommendations/proactive-recommendations.module';
import { isPremiumView, type PremiumViewName } from './premium-routes';
import { renderPremiumTeamFoundation } from './premium-team-foundation';

type PremiumTranslator = (key: string) => string;
type HtmlEscaper = (value: string) => string;

export const premiumApplicationModules = {
  copilot: premiumCopilotModule,
  contextAnalysis: premiumContextAnalysisModule,
  linguisticAgents: premiumLinguisticAgentsModule,
  proactiveRecommendations: proactiveRecommendationsModule,
} as const;

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
