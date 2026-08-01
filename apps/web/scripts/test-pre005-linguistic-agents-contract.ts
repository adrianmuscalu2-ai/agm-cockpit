import assert from 'node:assert/strict';

import { premiumLinguisticBoundaries } from '../src/premium-linguistic-agents/premium-linguistic-agents.contract';
import { premiumLinguisticAgentsModule } from '../src/premium-linguistic-agents/premium-linguistic-agents.module';
import { premiumLinguisticAgents } from '../src/premium-linguistic-agents/premium-linguistic-agents.registry';
import { transitionPremiumLinguisticWorkflow } from '../src/premium-linguistic-agents/premium-linguistic-agents.workflow';

assert.equal(premiumLinguisticAgentsModule.enabled, false);
assert.deepEqual(premiumLinguisticAgents.map(({ language }) => language), ['ro', 'de', 'en']);
assert.ok(premiumLinguisticAgents.every(({ enabled, status, capabilities }) =>
  !enabled && status === 'preparing' && capabilities.length === 0));
assert.deepEqual(premiumLinguisticBoundaries, {
  changesBasicCorrection: false,
  changesBasicTranslation: false,
  appliesHiddenCorrections: false,
  requiresUserConfirmation: true,
  performsExternalCalls: false,
  storesText: false,
});

const request = {
  id: 'request-1',
  language: 'de' as const,
  capability: 'suggest-contextual-correction' as const,
  sourceFingerprint: 'sha256:validation-only',
  protectedTerms: ['CMR', 'Ladungssicherung'],
};
const proposal = {
  id: 'proposal-1',
  requestId: request.id,
  language: request.language,
  changes: [{
    id: 'change-1',
    original: 'CMR für Ladungssicherung prüfen',
    replacement: 'CMR für die Ladungssicherung prüfen',
    explanation: 'Articol contextual adăugat; termenii operaționali sunt păstrați.',
    confidence: 0.94,
  }],
  requiresUserConfirmation: true as const,
};

const disabled = premiumLinguisticAgentsModule.initialState;
assert.equal(transitionPremiumLinguisticWorkflow(disabled, { type: 'prepare', request }).status, 'disabled');
const idle = transitionPremiumLinguisticWorkflow(disabled, { type: 'enable-for-validation' });
const preparing = transitionPremiumLinguisticWorkflow(idle, { type: 'prepare', request });
const waiting = transitionPremiumLinguisticWorkflow(preparing, { type: 'propose', proposal });
assert.equal(waiting.status, 'awaiting-confirmation');
assert.equal(transitionPremiumLinguisticWorkflow(waiting, { type: 'confirm' }).status, 'confirmed');

const hiddenApply = transitionPremiumLinguisticWorkflow(preparing, { type: 'confirm' });
assert.equal(hiddenApply.status, 'preparing');
const unsafeProposal = {
  ...proposal,
  changes: [{ ...proposal.changes[0], replacement: 'Dokument prüfen' }],
};
assert.equal(transitionPremiumLinguisticWorkflow(preparing, { type: 'propose', proposal: unsafeProposal }).status, 'preparing');

console.log('PRE-005 Professional Linguistic Agents contract: PASS');
