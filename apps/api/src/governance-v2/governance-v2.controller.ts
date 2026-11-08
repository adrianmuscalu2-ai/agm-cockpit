import { Body, Controller, Get, Headers, HttpException, HttpStatus, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import type { RequestContext } from '../common/request-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentMachine } from '../machine-auth/current-machine.decorator';
import type { MachineRequestContext } from '../machine-auth/machine-auth.contract';
import { MachineJwtAuthGuard } from '../machine-auth/machine-jwt-auth.guard';
import type { GovernanceProposal } from './governance-v2.contract';
import { GovernanceV2RuntimeService } from './governance-v2.runtime';

const DENIALS: Record<string, HttpStatus> = {
  GOVERNANCE_IDENTITY_NOT_BOUND: HttpStatus.FORBIDDEN,
  GOVERNANCE_SCOPE_MISSING: HttpStatus.FORBIDDEN,
  GOVERNANCE_ACTOR_UNAUTHORIZED: HttpStatus.FORBIDDEN,
  PROPOSAL_SELF_APPROVAL_DENIED: HttpStatus.FORBIDDEN,
  PROPOSAL_SELF_VALIDATION_DENIED: HttpStatus.FORBIDDEN,
  PROPOSAL_NOT_FOUND: HttpStatus.NOT_FOUND,
  PROPOSAL_INVALID_TRANSITION: HttpStatus.CONFLICT,
  PROPOSAL_CONTRACT_INCOMPLETE: HttpStatus.BAD_REQUEST,
  CANDIDATE_DIGEST_MISMATCH: HttpStatus.BAD_REQUEST,
  GOVERNANCE_SEARCH_QUERY_INVALID: HttpStatus.BAD_REQUEST,
};

function mapError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  const code = error instanceof Error ? error.message : 'GOVERNANCE_ERROR';
  const status = DENIALS[code];
  if (!status) throw error;
  throw new HttpException({ code }, status);
}

interface ProposeBody {
  proposalId: string; semanticTitle: string; description: string; scope: string; proposalType: string;
  candidateRef: string; candidateDigest: string; baseRevision: string;
  affectedComponents?: string[]; affectedFacts?: string[]; evidenceRefs?: string[]; riskAssessmentRefs?: string[];
  impactStudyRef?: string; dependencyGraphRef?: string; snapshotRef?: string; pcrRefs?: string[]; cscRefs?: string[];
}

interface DecisionBody { decision: 'ACCEPTED_FOR_CHANGE_CONTROL' | 'REJECTED'; evidenceRefs?: string[] }

/**
 * Governance V2 HTTP boundary. Only the canonical Atlas machine identity may
 * hold `governance:propose`; decisions require a separately bound human
 * approver. Runtime activation and independent validation remain separate gates.
 */
@Controller('governance-v2')
export class GovernanceV2Controller {
  constructor(private readonly governance: GovernanceV2RuntimeService) {}

  @Post('proposals')
  @UseGuards(MachineJwtAuthGuard)
  async propose(@Body() body: ProposeBody, @CurrentMachine() machine: MachineRequestContext) {
    try {
      const proposerId = await this.governance.resolveAuthenticatedActor({ type: 'MACHINE_IDENTITY', id: machine.machineIdentityId, companyId: machine.companyId, scopes: machine.scopes }, 'propose');
      const now = new Date().toISOString();
      const proposal: GovernanceProposal = {
        proposalId: body.proposalId, semanticTitle: body.semanticTitle, description: body.description, scope: body.scope,
        proposalType: body.proposalType, proposerId, createdAt: now, updatedAt: now, candidateRef: body.candidateRef,
        candidateDigest: body.candidateDigest, baseRevision: body.baseRevision, affectedComponents: body.affectedComponents ?? [],
        affectedFacts: body.affectedFacts ?? [], correlationId: machine.correlationId, status: 'DRAFT', evidenceRefs: body.evidenceRefs ?? [],
        riskAssessmentRefs: body.riskAssessmentRefs ?? [], impactStudyRef: body.impactStudyRef ?? '', dependencyGraphRef: body.dependencyGraphRef ?? '',
        snapshotRef: body.snapshotRef ?? '', pcrRefs: body.pcrRefs ?? [], cscRefs: body.cscRefs ?? [],
      } as GovernanceProposal;
      return responseEnvelope(await this.governance.createProposal(proposal), machine.requestId);
    } catch (error) { mapError(error); }
  }

  @Post('proposals/:id/decision')
  @UseGuards(JwtAuthGuard)
  async decide(@Param('id') id: string, @Body() body: DecisionBody, @CurrentUser() user: RequestContext, @Headers('x-request-id') header?: string) {
    if (body?.decision !== 'ACCEPTED_FOR_CHANGE_CONTROL' && body?.decision !== 'REJECTED') throw new HttpException({ code: 'GOVERNANCE_DECISION_INVALID' }, HttpStatus.BAD_REQUEST);
    try {
      const actorId = await this.governance.resolveAuthenticatedActor({ type: 'HUMAN_USER', id: user.userId, companyId: user.companyId });
      return responseEnvelope(await this.governance.decideProposal(id, body.decision, actorId, body.evidenceRefs ?? []), requestIdFromHeader(header));
    } catch (error) { mapError(error); }
  }

  @Get('proposals')
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: RequestContext, @Headers('x-request-id') header?: string) {
    try {
      await this.requireBoundHuman(user);
      return responseEnvelope(await this.governance.listProposals(), requestIdFromHeader(header));
    } catch (error) { mapError(error); }
  }

  @Get('proposals/:id')
  @UseGuards(JwtAuthGuard)
  async read(@Param('id') id: string, @CurrentUser() user: RequestContext, @Headers('x-request-id') header?: string) {
    try {
      await this.requireBoundHuman(user);
      const proposal = await this.governance.readProposal(id);
      if (!proposal) throw new NotFoundException('PROPOSAL_NOT_FOUND');
      return responseEnvelope(proposal, requestIdFromHeader(header));
    } catch (error) { mapError(error); }
  }

  @Get('risk-knowledge/search')
  @UseGuards(JwtAuthGuard)
  async searchRiskKnowledge(@Query('q') query: string, @CurrentUser() user: RequestContext, @Headers('x-request-id') header?: string) {
    try {
      await this.requireBoundHuman(user);
      return responseEnvelope(await this.governance.searchRiskKnowledge(this.searchQuery(query)), requestIdFromHeader(header));
    } catch (error) { mapError(error); }
  }

  @Get('risk-knowledge/assessments')
  @UseGuards(JwtAuthGuard)
  async searchRiskKnowledgeAssessments(@Query('q') query: string, @CurrentUser() user: RequestContext, @Headers('x-request-id') header?: string) {
    try {
      await this.requireBoundHuman(user);
      return responseEnvelope(await this.governance.searchRiskKnowledgeAssessments(this.searchQuery(query)), requestIdFromHeader(header));
    } catch (error) { mapError(error); }
  }

  @Get('risk-knowledge/assessments/:id')
  @UseGuards(JwtAuthGuard)
  async readRiskKnowledgeAssessment(@Param('id') id: string, @CurrentUser() user: RequestContext, @Headers('x-request-id') header?: string) {
    try {
      await this.requireBoundHuman(user);
      const assessment = await this.governance.readRiskKnowledgeAssessment(id);
      if (!assessment) throw new NotFoundException('RISK_ASSESSMENT_NOT_FOUND');
      return responseEnvelope(assessment, requestIdFromHeader(header));
    } catch (error) { mapError(error); }
  }

  private async requireBoundHuman(user: RequestContext) {
    const actorId = await this.governance.resolveAuthenticatedActor({ type: 'HUMAN_USER', id: user.userId, companyId: user.companyId });
    const actor = await this.governance.readGovernanceActor(actorId) as { status?: string; roles?: unknown } | null;
    const roles = Array.isArray(actor?.roles) ? actor.roles : [];
    if (actor?.status !== 'ACTIVE' || !roles.some((role) => role === 'APPROVER' || role === 'VALIDATOR')) {
      throw new Error('GOVERNANCE_ACTOR_UNAUTHORIZED');
    }
  }

  private searchQuery(query: string) {
    const normalized = query?.trim();
    if (!normalized || normalized.length < 2 || normalized.length > 200) throw new Error('GOVERNANCE_SEARCH_QUERY_INVALID');
    return normalized;
  }
}
