import { HttpException } from '@nestjs/common';
import type { RequestContext } from '../src/common/request-context';
import { GovernanceV2Controller } from '../src/governance-v2/governance-v2.controller';
import type { GovernanceV2RuntimeService } from '../src/governance-v2/governance-v2.runtime';

const user = { userId: 'human-1', companyId: 'company-1' } as RequestContext;

function controllerFor(overrides: Partial<GovernanceV2RuntimeService> = {}) {
  const governance = {
    resolveAuthenticatedActor: jest.fn().mockResolvedValue('actor-1'),
    readGovernanceActor: jest.fn().mockResolvedValue({ status: 'ACTIVE', roles: ['VALIDATOR'] }),
    listProposals: jest.fn().mockResolvedValue([{ proposal_id: 'proposal-1' }]),
    readProposal: jest.fn().mockResolvedValue({ proposal_id: 'proposal-1' }),
    searchRiskKnowledge: jest.fn().mockResolvedValue({ total: 0 }),
    searchRiskKnowledgeAssessments: jest.fn().mockResolvedValue([]),
    readRiskKnowledgeAssessment: jest.fn().mockResolvedValue({ assessment_id: 'assessment-1' }),
    ...overrides,
  } as unknown as GovernanceV2RuntimeService;
  return { controller: new GovernanceV2Controller(governance), governance };
}

describe('Governance V2 controller read boundary', () => {
  it('allows proposal reads for an active bound validator', async () => {
    const { controller, governance } = controllerFor();
    await expect(controller.list(user)).resolves.toMatchObject({ data: [{ proposal_id: 'proposal-1' }] });
    expect(governance.resolveAuthenticatedActor).toHaveBeenCalledWith({ type: 'HUMAN_USER', id: 'human-1', companyId: 'company-1' });
  });

  it('denies a bound human without approver or validator role', async () => {
    const { controller, governance } = controllerFor({
      readGovernanceActor: jest.fn().mockResolvedValue({ status: 'ACTIVE', roles: ['PROPOSER'] }),
    });
    await expect(controller.list(user)).rejects.toMatchObject({ status: 403 });
    expect(governance.listProposals).not.toHaveBeenCalled();
  });

  it('preserves persistence failures instead of reporting them as authorization denials', async () => {
    const { controller } = controllerFor({
      resolveAuthenticatedActor: jest.fn().mockRejectedValue(new Error('DATABASE_UNAVAILABLE')),
    });
    await expect(controller.list(user)).rejects.toThrow('DATABASE_UNAVAILABLE');
    await expect(controller.list(user)).rejects.not.toBeInstanceOf(HttpException);
  });

  it('validates search queries and returns read-only Risk & Knowledge results', async () => {
    const { controller, governance } = controllerFor();
    await expect(controller.searchRiskKnowledge('  ', user)).rejects.toMatchObject({ status: 400 });
    await expect(controller.searchRiskKnowledge(' deployment ', user)).resolves.toMatchObject({ data: { total: 0 } });
    expect(governance.searchRiskKnowledge).toHaveBeenCalledWith('deployment');
  });

  it('reads a Risk & Knowledge assessment only for an authorized human', async () => {
    const { controller, governance } = controllerFor();
    await expect(controller.readRiskKnowledgeAssessment('assessment-1', user)).resolves.toMatchObject({ data: { assessment_id: 'assessment-1' } });
    expect(governance.readRiskKnowledgeAssessment).toHaveBeenCalledWith('assessment-1');
  });
});
