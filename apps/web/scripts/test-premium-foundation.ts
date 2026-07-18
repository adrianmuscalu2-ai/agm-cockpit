import assert from 'node:assert/strict';

import { premiumAgents } from '../src/premium-agents';
import { premiumAgentStateDefinition } from '../src/premium-agent-states';
import {
  premiumApplicationModules,
  renderPremiumView,
  usesPremiumLayout,
} from '../src/premium-app';
import { premiumCopilotBoundaries } from '../src/premium-copilot/premium-copilot.contract';
import { premiumCopilotModule } from '../src/premium-copilot/premium-copilot.module';
import { transitionPremiumCopilot } from '../src/premium-copilot/premium-copilot.workflow';
import { premiumLinguisticBoundaries } from '../src/premium-linguistic-agents/premium-linguistic-agents.contract';
import { premiumLinguisticAgents } from '../src/premium-linguistic-agents/premium-linguistic-agents.registry';
import { premiumLinguisticAgentsModule } from '../src/premium-linguistic-agents/premium-linguistic-agents.module';
import {
  isPremiumView,
  premiumRouteForView,
  premiumViewFromRoute,
} from '../src/premium-routes';

const translate = (key: string) => key;
const escapeHtml = (value: string) => value;

const premiumHtml = renderPremiumView('premium', translate, escapeHtml);
const teamHtml = renderPremiumView('premiumTeam', translate, escapeHtml);

assert.equal(premiumRouteForView('premium'), '/premium');
assert.equal(premiumRouteForView('premiumTeam'), '/premium/team');
assert.equal(premiumViewFromRoute('/premium'), 'premium');
assert.equal(premiumViewFromRoute('/premium/team'), 'premiumTeam');
assert.equal(premiumViewFromRoute('/'), undefined);
assert.equal(isPremiumView('premium'), true);
assert.equal(isPremiumView('premiumTeam'), true);
assert.equal(isPremiumView('home'), false);
assert.equal(usesPremiumLayout('premium'), true);
assert.equal(usesPremiumLayout('premiumTeam'), true);
assert.equal(usesPremiumLayout('home'), false);

assert.ok(premiumHtml?.includes('href="/premium/team"'));
assert.ok(premiumHtml?.includes('href="/"'));
assert.ok(teamHtml?.includes('href="/premium"'));
assert.ok(teamHtml?.includes('href="/"'));
assert.equal(renderPremiumView('home', translate, escapeHtml), undefined);

assert.equal(premiumAgents.length, 8);
assert.deepEqual(
  premiumAgents.map((agent) => agent.id),
  ['mentor', 'atlas', 'inspector', 'transport', 'load-safety', 'communication', 'documents', 'journal'],
);
assert.ok(premiumAgents.every((agent) => agent.state === 'preparing'));
assert.equal(
  premiumAgentStateDefinition('preparing').translationKey,
  'premium.team.status.preparing',
);
assert.equal(
  teamHtml?.match(/class="premium-team-agent premium-team-agent-preparing"/g)?.length,
  premiumAgents.length,
);
assert.equal(teamHtml?.includes('premium-team-agent-available'), false);
assert.equal(teamHtml?.includes('premium-team-agent-active'), false);

const mission = {
  id: 'validation-mission',
  capability: 'prepare-translation' as const,
  userRequest: 'Tradu în germană.',
  proposedAction: 'Pregătește traducerea în limba germană.',
};
assert.equal(premiumApplicationModules.copilot, premiumCopilotModule);

const disabledState = premiumApplicationModules.copilot.initialState;
const blockedMission = transitionPremiumCopilot(disabledState, {
  type: 'prepare-mission',
  mission,
});
const validationState = transitionPremiumCopilot(disabledState, {
  type: 'enable-for-validation',
});
const preparedState = transitionPremiumCopilot(validationState, {
  type: 'prepare-mission',
  mission,
});
const prematureApproval = transitionPremiumCopilot(preparedState, {
  type: 'approve',
});
const confirmationState = transitionPremiumCopilot(preparedState, {
  type: 'request-confirmation',
});
const approvedState = transitionPremiumCopilot(confirmationState, {
  type: 'approve',
});

assert.equal(premiumCopilotModule.enabled, false);
assert.deepEqual(premiumCopilotModule.capabilities, []);
assert.equal(premiumCopilotBoundaries.listensContinuously, false);
assert.equal(premiumCopilotBoundaries.performsExternalCalls, false);
assert.equal(premiumCopilotBoundaries.storesConversation, false);
assert.equal(blockedMission.status, 'disabled');
assert.equal(validationState.status, 'idle');
assert.equal(preparedState.status, 'preparing');
assert.equal(prematureApproval.status, 'preparing');
assert.equal(confirmationState.status, 'awaiting-confirmation');
assert.equal(approvedState.status, 'approved');

assert.equal(
  premiumApplicationModules.linguisticAgents,
  premiumLinguisticAgentsModule,
);
assert.equal(premiumLinguisticAgentsModule.enabled, false);
assert.deepEqual(
  premiumLinguisticAgents.map((agent) => agent.language),
  ['ro', 'de', 'en'],
);
assert.ok(premiumLinguisticAgents.every((agent) => agent.enabled === false));
assert.ok(
  premiumLinguisticAgents.every((agent) => agent.status === 'preparing'),
);
assert.ok(
  premiumLinguisticAgents.every((agent) => agent.capabilities.length === 0),
);
assert.equal(premiumLinguisticBoundaries.changesBasicCorrection, false);
assert.equal(premiumLinguisticBoundaries.changesBasicTranslation, false);
assert.equal(premiumLinguisticBoundaries.appliesHiddenCorrections, false);
assert.equal(premiumLinguisticBoundaries.requiresUserConfirmation, true);
assert.equal(premiumLinguisticBoundaries.performsExternalCalls, false);
assert.equal(premiumLinguisticBoundaries.storesText, false);

console.log('Premium foundation tests: PASS');
