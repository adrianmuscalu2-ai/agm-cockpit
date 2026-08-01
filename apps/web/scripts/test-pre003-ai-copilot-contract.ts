import assert from 'node:assert/strict';

import { premiumCopilotBoundaries } from '../src/premium-copilot/premium-copilot.contract';
import { premiumCopilotModule } from '../src/premium-copilot/premium-copilot.module';
import { transitionPremiumCopilot } from '../src/premium-copilot/premium-copilot.workflow';

assert.equal(premiumCopilotModule.enabled, false);
assert.deepEqual(premiumCopilotModule.capabilities, []);
assert.deepEqual(premiumCopilotBoundaries, {
  requiresUserActivation: true,
  requiresConfirmationBeforeAction: true,
  listensContinuously: false,
  performsExternalCalls: false,
  storesConversation: false,
  providesBindingLegalAdvice: false,
});

const mission = {
  id: 'copilot-operation-1',
  capability: 'answer-operational-question' as const,
  userRequest: 'Care este următorul pas validat?',
  proposedAction: 'Pregătește un răspuns orientativ din contextul validat.',
  contextRefs: ['trip-context:trip-1@4'],
  usesPersonalData: false as const,
  producesExternalEffect: false as const,
};
const permit = {
  id: 'permit-1',
  operationId: mission.id,
  moduleId: 'ai-copilot' as const,
  capability: mission.capability,
  policyId: 'copilot-policy',
  policyVersion: 'copilot-policy@1.0.0',
  risk: 'sensitive' as const,
  issuedAt: '2026-08-01T09:59:00.000Z',
  expiresAt: '2026-08-01T10:01:00.000Z',
  singleUse: true as const,
  status: 'issued' as const,
};
const now = new Date('2026-08-01T10:00:00.000Z');

const disabled = premiumCopilotModule.initialState;
assert.equal(transitionPremiumCopilot(disabled, { type: 'prepare-mission', mission }).status, 'disabled');
const idle = transitionPremiumCopilot(disabled, { type: 'enable-for-validation' });
const preparing = transitionPremiumCopilot(idle, { type: 'prepare-mission', mission });
const waiting = transitionPremiumCopilot(preparing, { type: 'request-confirmation' });
assert.equal(waiting.status, 'awaiting-confirmation');

const wrongPermit = { ...permit, operationId: 'other-operation' };
assert.equal(transitionPremiumCopilot(waiting, {
  type: 'approve', permit: wrongPermit, policyVersion: permit.policyVersion, now,
}).status, 'awaiting-confirmation');
const expiredPermit = { ...permit, expiresAt: '2026-08-01T09:59:59.999Z' };
assert.equal(transitionPremiumCopilot(waiting, {
  type: 'approve', permit: expiredPermit, policyVersion: permit.policyVersion, now,
}).status, 'awaiting-confirmation');

const approved = transitionPremiumCopilot(waiting, {
  type: 'approve', permit, policyVersion: permit.policyVersion, now,
});
assert.equal(approved.status, 'approved');
assert.equal(approved.consumedPermit?.status, 'consumed');

const unsafeMission = { ...mission, producesExternalEffect: true as const };
assert.equal(transitionPremiumCopilot(idle, { type: 'prepare-mission', mission: unsafeMission }).status, 'idle');

console.log('PRE-003 AI Copilot contract: PASS');
