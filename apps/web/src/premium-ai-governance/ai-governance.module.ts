import { aiGovernanceBoundaries } from './ai-governance.contract';
import { initialAiGovernanceKillSwitch } from './ai-governance.kill-switch';
import { aiGovernancePolicies } from './ai-governance.policy';
import { governedAiModules } from './ai-governance.registry';

export const aiGovernanceModule = {
  id: 'ai-governance',
  enabled: false,
  modules: governedAiModules,
  policies: aiGovernancePolicies,
  killSwitch: initialAiGovernanceKillSwitch,
  boundaries: aiGovernanceBoundaries,
} as const;
