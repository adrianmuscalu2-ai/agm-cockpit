import type { PremiumAgentState } from './premium-agent-states';

export type PremiumAgent = {
  id: string;
  marker: string;
  nameKey: string;
  roleKey: string;
  state: PremiumAgentState;
};

export const premiumAgents: readonly PremiumAgent[] = [
  {
    id: 'mentor',
    marker: 'ME',
    nameKey: 'premium.team.agent.mentor.name',
    roleKey: 'premium.team.agent.mentor.role',
    state: 'preparing',
  },
  {
    id: 'atlas',
    marker: 'AT',
    nameKey: 'premium.team.agent.atlas.name',
    roleKey: 'premium.team.agent.atlas.role',
    state: 'preparing',
  },
  {
    id: 'inspector',
    marker: 'IN',
    nameKey: 'premium.team.agent.inspector.name',
    roleKey: 'premium.team.agent.inspector.role',
    state: 'preparing',
  },
  {
    id: 'transport',
    marker: 'TR',
    nameKey: 'premium.team.agent.transport.name',
    roleKey: 'premium.team.agent.transport.role',
    state: 'preparing',
  },
  {
    id: 'load-safety',
    marker: 'LS',
    nameKey: 'premium.team.agent.loadSafety.name',
    roleKey: 'premium.team.agent.loadSafety.role',
    state: 'preparing',
  },
  {
    id: 'communication',
    marker: 'CM',
    nameKey: 'premium.team.agent.communication.name',
    roleKey: 'premium.team.agent.communication.role',
    state: 'preparing',
  },
  {
    id: 'documents',
    marker: 'DO',
    nameKey: 'premium.team.agent.documents.name',
    roleKey: 'premium.team.agent.documents.role',
    state: 'preparing',
  },
  {
    id: 'journal',
    marker: 'JR',
    nameKey: 'premium.team.agent.journal.name',
    roleKey: 'premium.team.agent.journal.role',
    state: 'preparing',
  },
];
