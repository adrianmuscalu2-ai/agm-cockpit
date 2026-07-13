export type AgentGovernanceStatus = 'active' | 'planned' | 'monitoring';

export type AgentGovernanceRecord = {
  id: string;
  code: string;
  nameKey: string;
  roleKey: string;
  responsibilitiesKey: string;
  ownerDepartmentId: string;
  status: AgentGovernanceStatus;
  lastValidationKey: string;
  lastActivityKey: string;
  reliabilityKey: string;
};

export const agentGovernanceRegistry: AgentGovernanceRecord[] = [
  {
    id: 'agent-codex',
    code: 'AGENT-CODEX',
    nameKey: 'agentRegistry.codex.name',
    roleKey: 'agentRegistry.codex.role',
    responsibilitiesKey: 'agentRegistry.codex.responsibilities',
    ownerDepartmentId: 'turn-command',
    status: 'active',
    lastValidationKey: 'agentRegistry.codex.validation',
    lastActivityKey: 'agentRegistry.codex.activity',
    reliabilityKey: 'agentRegistry.reliability.validated',
  },
  {
    id: 'agent-inspector',
    code: 'AGENT-INSPECTOR',
    nameKey: 'agentRegistry.inspector.name',
    roleKey: 'agentRegistry.inspector.role',
    responsibilitiesKey: 'agentRegistry.inspector.responsibilities',
    ownerDepartmentId: 'ai-agents',
    status: 'active',
    lastValidationKey: 'agentRegistry.inspector.validation',
    lastActivityKey: 'agentRegistry.inspector.activity',
    reliabilityKey: 'agentRegistry.reliability.validated',
  },
  {
    id: 'agent-mentor',
    code: 'AGENT-MENTOR',
    nameKey: 'agentRegistry.mentor.name',
    roleKey: 'agentRegistry.mentor.role',
    responsibilitiesKey: 'agentRegistry.mentor.responsibilities',
    ownerDepartmentId: 'product-roadmap',
    status: 'active',
    lastValidationKey: 'agentRegistry.mentor.validation',
    lastActivityKey: 'agentRegistry.mentor.activity',
    reliabilityKey: 'agentRegistry.reliability.validated',
  },
  {
    id: 'agent-legal',
    code: 'AGENT-LEGAL',
    nameKey: 'agentRegistry.legal.name',
    roleKey: 'agentRegistry.legal.role',
    responsibilitiesKey: 'agentRegistry.legal.responsibilities',
    ownerDepartmentId: 'security-legal',
    status: 'monitoring',
    lastValidationKey: 'agentRegistry.legal.validation',
    lastActivityKey: 'agentRegistry.legal.activity',
    reliabilityKey: 'agentRegistry.reliability.monitoring',
  },
  {
    id: 'agent-linguistic-ro-de',
    code: 'AG-011-011A',
    nameKey: 'agentRegistry.roDe.name',
    roleKey: 'agentRegistry.roDe.role',
    responsibilitiesKey: 'agentRegistry.roDe.responsibilities',
    ownerDepartmentId: 'ai-agents',
    status: 'planned',
    lastValidationKey: 'agentRegistry.roDe.validation',
    lastActivityKey: 'agentRegistry.roDe.activity',
    reliabilityKey: 'agentRegistry.reliability.planned',
  },
  {
    id: 'agent-linguistic-ro-en',
    code: 'AG-011-011B',
    nameKey: 'agentRegistry.roEn.name',
    roleKey: 'agentRegistry.roEn.role',
    responsibilitiesKey: 'agentRegistry.roEn.responsibilities',
    ownerDepartmentId: 'ai-agents',
    status: 'planned',
    lastValidationKey: 'agentRegistry.roEn.validation',
    lastActivityKey: 'agentRegistry.roEn.activity',
    reliabilityKey: 'agentRegistry.reliability.planned',
  },
  {
    id: 'agent-linguistic-de-en',
    code: 'AG-011-011C',
    nameKey: 'agentRegistry.deEn.name',
    roleKey: 'agentRegistry.deEn.role',
    responsibilitiesKey: 'agentRegistry.deEn.responsibilities',
    ownerDepartmentId: 'ai-agents',
    status: 'planned',
    lastValidationKey: 'agentRegistry.deEn.validation',
    lastActivityKey: 'agentRegistry.deEn.activity',
    reliabilityKey: 'agentRegistry.reliability.planned',
  },
];
