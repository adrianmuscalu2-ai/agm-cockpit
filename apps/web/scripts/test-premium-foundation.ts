import assert from 'node:assert/strict';

import { premiumAgents } from '../src/premium-agents';
import { premiumAgentStateDefinition } from '../src/premium-agent-states';
import {
  premiumApplicationModules,
  renderPremiumView,
  usesPremiumLayout,
} from '../src/premium-app';
import { aiGovernanceBoundaries } from '../src/premium-ai-governance/ai-governance.contract';
import { authorizeAiOperation } from '../src/premium-ai-governance/ai-governance.authorization';
import { aiGovernanceInspectorPolicy, inspectorRequirementForRisk } from '../src/premium-ai-governance/ai-governance.inspector';
import { initialAiGovernanceKillSwitch } from '../src/premium-ai-governance/ai-governance.kill-switch';
import { aiGovernanceModule } from '../src/premium-ai-governance/ai-governance.module';
import { isAiGovernancePermitValid, transitionAiGovernancePermit } from '../src/premium-ai-governance/ai-governance.permit';
import { aiGovernancePolicies, isValidAiGovernancePolicyVersion } from '../src/premium-ai-governance/ai-governance.policy';
import { governedAiModules } from '../src/premium-ai-governance/ai-governance.registry';
import { premiumCopilotBoundaries } from '../src/premium-copilot/premium-copilot.contract';
import { premiumCopilotModule } from '../src/premium-copilot/premium-copilot.module';
import { transitionPremiumCopilot } from '../src/premium-copilot/premium-copilot.workflow';
import { premiumContextAnalysisBoundaries } from '../src/premium-context-analysis/premium-context-analysis.contract';
import { premiumContextAnalysisModule } from '../src/premium-context-analysis/premium-context-analysis.module';
import { transitionPremiumContextAnalysis } from '../src/premium-context-analysis/premium-context-analysis.workflow';
import { proactiveRecommendationBoundaries } from '../src/premium-proactive-recommendations/proactive-recommendations.contract';
import { inspectProactiveRecommendation } from '../src/premium-proactive-recommendations/proactive-recommendations.inspector-policy';
import { proactiveRecommendationsModule } from '../src/premium-proactive-recommendations/proactive-recommendations.module';
import { transitionProactiveRecommendation } from '../src/premium-proactive-recommendations/proactive-recommendations.workflow';
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

assert.equal(
  premiumApplicationModules.contextAnalysis,
  premiumContextAnalysisModule,
);
assert.equal(premiumContextAnalysisModule.enabled, false);
assert.deepEqual(premiumContextAnalysisModule.analyzers, []);
assert.equal(premiumContextAnalysisBoundaries.changesBasicData, false);
assert.equal(premiumContextAnalysisBoundaries.changesSourceContent, false);
assert.equal(
  premiumContextAnalysisBoundaries.producesAutomaticDecisions,
  false,
);
assert.equal(premiumContextAnalysisBoundaries.performsExternalCalls, false);
assert.equal(premiumContextAnalysisBoundaries.storesContent, false);

const contextRequest = {
  id: 'context-validation',
  source: 'operational-question' as const,
  content: 'Care este următorul pas?',
  language: 'ro' as const,
};
const disabledContextState = premiumContextAnalysisModule.initialState;
const blockedContextAnalysis = transitionPremiumContextAnalysis(
  disabledContextState,
  { type: 'start-analysis', request: contextRequest },
);
const contextValidationState = transitionPremiumContextAnalysis(
  disabledContextState,
  { type: 'enable-for-validation' },
);
const analyzingContextState = transitionPremiumContextAnalysis(
  contextValidationState,
  { type: 'start-analysis', request: contextRequest },
);
const prematureContextConfirmation = transitionPremiumContextAnalysis(
  analyzingContextState,
  { type: 'confirm' },
);
const proposedContextState = transitionPremiumContextAnalysis(
  analyzingContextState,
  {
    type: 'propose-findings',
    findings: [
      {
        id: 'finding-validation',
        summary: 'Constatare pentru validarea fluxului.',
        confidence: 0.8,
        requiresUserConfirmation: true,
      },
    ],
  },
);
const confirmedContextState = transitionPremiumContextAnalysis(
  proposedContextState,
  { type: 'confirm' },
);

assert.equal(blockedContextAnalysis.status, 'disabled');
assert.equal(contextValidationState.status, 'idle');
assert.equal(analyzingContextState.status, 'analyzing');
assert.equal(prematureContextConfirmation.status, 'analyzing');
assert.equal(proposedContextState.status, 'awaiting-confirmation');
assert.equal(confirmedContextState.status, 'confirmed');

assert.equal(
  premiumApplicationModules.proactiveRecommendations,
  proactiveRecommendationsModule,
);
assert.equal(proactiveRecommendationsModule.enabled, false);
assert.deepEqual(proactiveRecommendationsModule.generators, []);
assert.equal(proactiveRecommendationsModule.inspector, undefined);
assert.equal(proactiveRecommendationsModule.audit, undefined);
assert.equal(proactiveRecommendationBoundaries.displaysRecommendations, false);
assert.equal(proactiveRecommendationBoundaries.generatesAutomatically, false);
assert.equal(proactiveRecommendationBoundaries.executesActions, false);
assert.equal(proactiveRecommendationBoundaries.storesRecommendations, false);
assert.equal(proactiveRecommendationBoundaries.monitorsContinuously, false);
assert.equal(proactiveRecommendationBoundaries.performsExternalCalls, false);

const recommendation = {
  id: 'recommendation-validation',
  category: 'ambiguous-text' as const,
  observedContext: 'Text cu posibilă ambiguitate.',
  proposedRecommendation: 'Verifică textul înainte de trimitere.',
  reason: 'A fost identificată o formulare neclară.',
  source: {
    type: 'validated-rule' as const,
    id: 'ambiguous-text-rule',
    version: '1.0.0',
  },
  confidence: 0.82,
  sensitivity: 'standard' as const,
  ruleVersion: 'ambiguous-text@1.0.0',
  createdAt: '2026-07-18T10:00:00.000Z',
  expiresAt: '2026-07-18T11:00:00.000Z',
};
const inspectorDecision = inspectProactiveRecommendation(
  recommendation,
  new Date('2026-07-18T10:30:00.000Z'),
);
const createdRecommendationState = {
  status: 'created' as const,
  recommendation,
};
const prematureAcceptance = transitionProactiveRecommendation(
  createdRecommendationState,
  { type: 'accept' },
);
const waitingInspectorState = transitionProactiveRecommendation(
  createdRecommendationState,
  { type: 'submit-to-inspector' },
);
const approvedRecommendationState = transitionProactiveRecommendation(
  waitingInspectorState,
  { type: 'record-inspector-decision', decision: inspectorDecision },
);
const acceptedRecommendationState = transitionProactiveRecommendation(
  approvedRecommendationState,
  { type: 'accept' },
);
const blockedRecommendation = {
  ...recommendation,
  source: { ...recommendation.source, id: '' },
};

assert.equal(inspectorDecision.outcome, 'approved');
assert.equal(prematureAcceptance.status, 'created');
assert.equal(waitingInspectorState.status, 'waiting-inspector');
assert.equal(approvedRecommendationState.status, 'approved');
assert.equal(acceptedRecommendationState.status, 'accepted');
assert.deepEqual(
  inspectProactiveRecommendation(
    blockedRecommendation,
    new Date('2026-07-18T10:30:00.000Z'),
  ),
  { outcome: 'blocked', reason: 'missing-source' },
);

assert.equal(premiumApplicationModules.aiGovernance, aiGovernanceModule);
assert.equal(aiGovernanceModule.enabled, false);
assert.equal(aiGovernanceBoundaries.issuesPermits, false);
assert.equal(aiGovernanceBoundaries.executesOperations, false);
assert.equal(aiGovernanceBoundaries.performsExternalCalls, false);
assert.equal(aiGovernanceBoundaries.storesOperationalData, false);
assert.equal(initialAiGovernanceKillSwitch.engaged, true);
assert.equal(initialAiGovernanceKillSwitch.reason, 'foundation-disabled');
assert.equal(governedAiModules.length, 4);
assert.equal(new Set(governedAiModules.map((module) => module.id)).size, 4);
assert.ok(governedAiModules.every((module) => module.enabled === false));
assert.equal(aiGovernancePolicies.length, governedAiModules.length);
assert.ok(aiGovernancePolicies.every((policy) => policy.enabled === false));
assert.ok(
  aiGovernancePolicies.every((policy) =>
    isValidAiGovernancePolicyVersion(policy.version),
  ),
);
assert.ok(
  aiGovernancePolicies.every((policy) => policy.retention === 'none'),
);
assert.ok(
  governedAiModules.every((module) =>
    aiGovernancePolicies.some(
      (policy) =>
        policy.id === module.policyId && policy.moduleId === module.id,
    ),
  ),
);
assert.equal(aiGovernanceInspectorPolicy.canConfirmForUser, false);
assert.equal(
  inspectorRequirementForRisk({ level: 'low', reasons: [] }),
  'not-required',
);
assert.equal(
  inspectorRequirementForRisk({ level: 'sensitive', reasons: [] }),
  'required',
);
assert.equal(
  inspectorRequirementForRisk({ level: 'prohibited', reasons: [] }),
  'blocked',
);

const authorizationOperation = {
  id: 'authorization-validation',
  moduleId: 'ai-copilot' as const,
  capability: 'prepare-translation',
  purpose: 'Validarea motorului fără execuție.',
  usesPersonalData: false,
  producesExternalEffect: false,
};
const authorizationPolicy = {
  ...aiGovernancePolicies[0],
  enabled: true,
};
const authorizationRegistration = {
  ...governedAiModules[0],
  enabled: true,
};
const disengagedKillSwitch = {
  ...initialAiGovernanceKillSwitch,
  engaged: false,
};
const authorizationNow = new Date('2026-07-19T10:00:00.000Z');
const authorizationBase = {
  operation: authorizationOperation,
  risk: { level: 'sensitive' as const, reasons: ['validation'] },
  registration: authorizationRegistration,
  policy: authorizationPolicy,
  permitTtlMs: 60_000,
  now: authorizationNow,
  createPermitId: () => 'permit-validation',
};
const killSwitchDenial = authorizeAiOperation({
  ...authorizationBase,
  killSwitch: initialAiGovernanceKillSwitch,
});
const inspectorDenial = authorizeAiOperation({
  ...authorizationBase,
  killSwitch: disengagedKillSwitch,
});
const userConfirmationDenial = authorizeAiOperation({
  ...authorizationBase,
  killSwitch: disengagedKillSwitch,
  inspectorConfirmation: {
    operationId: authorizationOperation.id,
    policyVersion: authorizationPolicy.version,
    outcome: 'approved',
    confirmedAt: authorizationNow.toISOString(),
  },
});
const prohibitedRiskDenial = authorizeAiOperation({
  ...authorizationBase,
  risk: { level: 'prohibited', reasons: ['forbidden-operation'] },
  killSwitch: disengagedKillSwitch,
});
const missingPolicyDenial = authorizeAiOperation({
  ...authorizationBase,
  policy: undefined,
  killSwitch: disengagedKillSwitch,
});
const personalDataDenial = authorizeAiOperation({
  ...authorizationBase,
  operation: { ...authorizationOperation, usesPersonalData: true },
  killSwitch: disengagedKillSwitch,
});
const permittedAuthorization = authorizeAiOperation({
  ...authorizationBase,
  killSwitch: disengagedKillSwitch,
  inspectorConfirmation: {
    operationId: authorizationOperation.id,
    policyVersion: authorizationPolicy.version,
    outcome: 'approved',
    confirmedAt: authorizationNow.toISOString(),
  },
  userConfirmation: {
    operationId: authorizationOperation.id,
    confirmed: true,
    confirmedAt: authorizationNow.toISOString(),
  },
});

assert.equal(aiGovernanceModule.authorizationEngine.enabled, false);
assert.deepEqual(killSwitchDenial, {
  outcome: 'denied',
  reason: 'kill-switch-engaged',
});
assert.deepEqual(inspectorDenial, {
  outcome: 'denied',
  reason: 'inspector-confirmation-required',
});
assert.deepEqual(userConfirmationDenial, {
  outcome: 'denied',
  reason: 'user-confirmation-required',
});
assert.deepEqual(prohibitedRiskDenial, {
  outcome: 'denied',
  reason: 'risk-prohibited',
});
assert.deepEqual(missingPolicyDenial, {
  outcome: 'denied',
  reason: 'policy-missing',
});
assert.deepEqual(personalDataDenial, {
  outcome: 'denied',
  reason: 'personal-data-not-allowed',
});
assert.equal(permittedAuthorization.outcome, 'permitted');
if (permittedAuthorization.outcome === 'permitted') {
  assert.equal(permittedAuthorization.permit.singleUse, true);
  assert.equal(permittedAuthorization.permit.status, 'issued');
  assert.equal(
    isAiGovernancePermitValid(
      permittedAuthorization.permit,
      authorizationPolicy.version,
      authorizationNow,
    ),
    true,
  );
  assert.equal(
    isAiGovernancePermitValid(
      permittedAuthorization.permit,
      'copilot-policy@2.0.0',
      authorizationNow,
    ),
    false,
  );
  assert.equal(
    isAiGovernancePermitValid(
      permittedAuthorization.permit,
      authorizationPolicy.version,
      new Date('2026-07-19T10:02:00.000Z'),
    ),
    false,
  );
  const consumedPermit = transitionAiGovernancePermit(
    permittedAuthorization.permit,
    {
      type: 'consume',
    },
  );
  assert.equal(
    consumedPermit.status,
    'consumed',
  );
  assert.equal(
    transitionAiGovernancePermit(consumedPermit, { type: 'consume' }).status,
    'consumed',
  );
}

console.log('Premium foundation tests: PASS');
