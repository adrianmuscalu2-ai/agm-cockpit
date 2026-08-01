import type {
  AiGovernanceInspectorConfirmation,
  AiGovernanceUserConfirmation,
} from './ai-governance.confirmation';
import type { AiGovernanceOperation } from './ai-governance.contract';
import type { AiGovernanceKillSwitch } from './ai-governance.kill-switch';
import type { AiGovernancePolicy } from './ai-governance.policy';
import type { GovernedAiModuleRegistration } from './ai-governance.registry';
import type { AiGovernanceRiskClassification } from './ai-governance.risk';
import { isProhibitedAiRisk } from './ai-governance.risk';

export type AiAuthorizationDenialReason =
  | 'kill-switch-engaged'
  | 'module-not-registered'
  | 'module-disabled'
  | 'policy-missing'
  | 'policy-disabled'
  | 'policy-module-mismatch'
  | 'risk-exceeds-policy'
  | 'risk-prohibited'
  | 'inspector-confirmation-required'
  | 'inspector-confirmation-invalid'
  | 'user-confirmation-required'
  | 'user-confirmation-invalid'
  | 'personal-data-not-allowed'
  | 'external-effect-not-allowed'
  | 'invalid-permit-id'
  | 'invalid-permit-ttl';

export type AiAuthorizationValidationInput = {
  operation: AiGovernanceOperation;
  risk: AiGovernanceRiskClassification;
  now: Date;
  killSwitch: AiGovernanceKillSwitch;
  registration?: GovernedAiModuleRegistration;
  policy?: AiGovernancePolicy;
  inspectorConfirmation?: AiGovernanceInspectorConfirmation;
  userConfirmation?: AiGovernanceUserConfirmation;
};

export const maximumAiConfirmationAgeMs = 5 * 60_000;

export function validateAiAuthorization(
  input: AiAuthorizationValidationInput,
): AiAuthorizationDenialReason | undefined {
  const {
    operation,
    risk,
    now,
    killSwitch,
    registration,
    policy,
    inspectorConfirmation,
    userConfirmation,
  } = input;

  if (killSwitch.engaged) return 'kill-switch-engaged';
  if (!registration) return 'module-not-registered';
  if (!registration.enabled) return 'module-disabled';
  if (!policy) return 'policy-missing';
  if (!policy.enabled) return 'policy-disabled';
  if (
    policy.moduleId !== operation.moduleId ||
    registration.policyId !== policy.id
  ) {
    return 'policy-module-mismatch';
  }
  if (isProhibitedAiRisk(risk)) return 'risk-prohibited';
  if (riskRank(risk.level) > riskRank(policy.maximumRisk)) {
    return 'risk-exceeds-policy';
  }
  if (operation.usesPersonalData) return 'personal-data-not-allowed';
  if (operation.producesExternalEffect) return 'external-effect-not-allowed';

  if (policy.requiresInspector) {
    if (!inspectorConfirmation) return 'inspector-confirmation-required';
    if (
      inspectorConfirmation.operationId !== operation.id ||
      inspectorConfirmation.policyVersion !== policy.version ||
      !isValidPastTimestamp(inspectorConfirmation.confirmedAt, now)
    ) {
      return 'inspector-confirmation-invalid';
    }
  }

  if (policy.requiresUserConfirmation) {
    if (!userConfirmation) return 'user-confirmation-required';
    if (
      userConfirmation.operationId !== operation.id ||
      !isValidPastTimestamp(userConfirmation.confirmedAt, now)
    ) {
      return 'user-confirmation-invalid';
    }
  }

  return undefined;
}

function riskRank(level: AiGovernanceRiskClassification['level']) {
  return ['low', 'moderate', 'sensitive', 'prohibited'].indexOf(level);
}

function isValidPastTimestamp(value: string, now: Date) {
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    timestamp <= now.getTime() &&
    now.getTime() - timestamp <= maximumAiConfirmationAgeMs
  );
}
