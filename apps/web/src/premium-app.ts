import { renderPremiumFoundation } from './premium-foundation';
import './premium-load-safety/load-safety.controller';
import { loadSafetyModule } from './premium-load-safety/load-safety.module';
import { renderLoadSafetyView } from './premium-load-safety/load-safety.view';
import { aiGovernanceModule } from './premium-ai-governance/ai-governance.module';
import { premiumCopilotModule } from './premium-copilot/premium-copilot.module';
import { premiumContextAnalysisModule } from './premium-context-analysis/premium-context-analysis.module';
import { premiumLinguisticAgentsModule } from './premium-linguistic-agents/premium-linguistic-agents.module';
import { proactiveRecommendationsModule } from './premium-proactive-recommendations/proactive-recommendations.module';
import { isPremiumView, type PremiumViewName } from './premium-routes';
import { renderPremiumTeamFoundation } from './premium-team-foundation';
import { renderCommunicationView } from './premium-communications/communication.view';
import { premiumVoiceShellModule } from './premium-voice-shell/premium-voice-shell.module';
import { renderPremiumAssistantView } from './premium-voice-shell/premium-assistant.view';
import type { BasicLanguageCode } from './language-registry';
import { renderCarMoverView } from './car-mover/car-mover.view';
import { renderCarMoverLanding } from './car-mover/car-mover.landing';

type PremiumTranslator = (key: string) => string;
type HtmlEscaper = (value: string) => string;

export const premiumApplicationModules = {
  aiGovernance: aiGovernanceModule,
  copilot: premiumCopilotModule,
  contextAnalysis: premiumContextAnalysisModule,
  linguisticAgents: premiumLinguisticAgentsModule,
  loadSafety: loadSafetyModule,
  proactiveRecommendations: proactiveRecommendationsModule,
  voiceShell: premiumVoiceShellModule,
} as const;

export function renderPremiumView(
  view: string,
  translate: PremiumTranslator,
  escapeHtml: HtmlEscaper,
  language: BasicLanguageCode = 'ro',
): string | undefined {
  if (view === 'premium') {
    return renderPremiumFoundation(translate, escapeHtml, language);
  }

  if (view === 'premiumTeam') {
    return renderPremiumTeamFoundation(translate, escapeHtml);
  }

  if (view === 'premiumLoadSafety') {
    return renderLoadSafetyView(translate, escapeHtml);
  }

  if (view === 'premiumCommunications') return renderCommunicationView();
  if (view === 'premiumVoice') return renderPremiumAssistantView(language, escapeHtml);
  if (view === 'carMover') return renderCarMoverLanding(language);
  if (view === 'carMoverMenu') return renderCarMoverView(language);

  return undefined;
}

export function premiumStatusKey(view: PremiumViewName) {
  if (view === 'premium') return 'premium.status';
  if (view === 'premiumTeam') return 'premium.team.status';
  if (view === 'premiumCommunications') return 'premium.status';
  if (view === 'premiumVoice') return 'premium.status';
  if (view === 'carMover' || view === 'carMoverMenu') return 'premium.status';
  return 'premium.loadSafety.status.ready';
}

export function usesPremiumLayout(view: string) {
  return isPremiumView(view);
}
