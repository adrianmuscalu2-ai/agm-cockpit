import assert from 'node:assert/strict';

import {
  authorizeAiOperation,
  maximumAiPermitTtlMs,
} from '../src/premium-ai-governance/ai-governance.authorization';
import { createAiAuthorizationAuditEntry } from '../src/premium-ai-governance/ai-governance.authorization-audit';
import { aiGovernanceModule } from '../src/premium-ai-governance/ai-governance.module';
import { initialAiGovernanceKillSwitch } from '../src/premium-ai-governance/ai-governance.kill-switch';
import { isAiGovernancePermitValidForOperation } from '../src/premium-ai-governance/ai-governance.permit';
import { aiGovernancePolicies } from '../src/premium-ai-governance/ai-governance.policy';
import { governedAiModules } from '../src/premium-ai-governance/ai-governance.registry';

assert.equal(aiGovernanceModule.enabled, false);
assert.equal(aiGovernanceModule.authorizationEngine.enabled, false);
assert.equal(initialAiGovernanceKillSwitch.engaged, true);
assert.equal(governedAiModules.length, 4);
assert.equal(governedAiModules.filter(({ enabled }) => enabled).map(({ id }) => id).join(','), 'professional-linguistic-agents');
assert.ok(aiGovernancePolicies.every(({ enabled, requiresInspector, requiresUserConfirmation, retention }) =>
  !enabled && requiresInspector && requiresUserConfirmation && retention === 'none'));

const now = new Date('2026-08-01T10:00:00.000Z');
const operation = {
  id: 'operation-1',
  moduleId: 'ai-copilot' as const,
  capability: 'prepare-advice',
  purpose: 'Contract validation only',
  usesPersonalData: false,
  producesExternalEffect: false,
};
const policy = { ...aiGovernancePolicies[0], enabled: true };
const registration = { ...governedAiModules[0], enabled: true };
const killSwitch = { ...initialAiGovernanceKillSwitch, engaged: false };
const confirmation = {
  inspectorConfirmation: {
    operationId: operation.id,
    policyVersion: policy.version,
    outcome: 'approved' as const,
    confirmedAt: now.toISOString(),
  },
  userConfirmation: {
    operationId: operation.id,
    confirmed: true as const,
    confirmedAt: now.toISOString(),
  },
};
const base = {
  operation,
  risk: { level: 'sensitive' as const, reasons: ['validation'] },
  registration,
  policy,
  killSwitch,
  now,
  createPermitId: () => 'permit-1',
  ...confirmation,
};

assert.deepEqual(authorizeAiOperation({ ...base, permitTtlMs: maximumAiPermitTtlMs + 1 }), {
  outcome: 'denied', reason: 'invalid-permit-ttl',
});
assert.deepEqual(authorizeAiOperation({
  ...base,
  permitTtlMs: 60_000,
  userConfirmation: { ...confirmation.userConfirmation, confirmedAt: '2026-08-01T09:54:59.999Z' },
}), { outcome: 'denied', reason: 'user-confirmation-invalid' });

const permitted = authorizeAiOperation({ ...base, permitTtlMs: 60_000 });
assert.equal(permitted.outcome, 'permitted');
if (permitted.outcome === 'permitted') {
  assert.equal(isAiGovernancePermitValidForOperation(permitted.permit, operation, policy.version, now), true);
  assert.equal(isAiGovernancePermitValidForOperation(
    permitted.permit,
    { ...operation, id: 'operation-2' },
    policy.version,
    now,
  ), false);
}

for (const [result, expected] of [
  [{ outcome: 'denied', reason: 'kill-switch-engaged' }, 'kill-switch-blocked'],
  [{ outcome: 'denied', reason: 'inspector-confirmation-required' }, 'inspector-blocked'],
  [{ outcome: 'denied', reason: 'policy-disabled' }, 'policy-blocked'],
] as const) {
  const audit = createAiAuthorizationAuditEntry({
    id: `audit-${expected}`,
    occurredAt: now.toISOString(),
    operation,
    policy,
    risk: base.risk,
    result,
  });
  assert.equal(audit.outcome, expected);
  assert.equal(audit.containsPersonalContent, false);
}

console.log('PRE-002 AI Governance contract: PASS');
