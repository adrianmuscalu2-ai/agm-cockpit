import { Injectable, Optional } from '@nestjs/common';
import {
  AgmGlobalLibraryAuthority,
  createDomainOrchestrators,
  type LibraryAuthorizationDecision,
  type LibraryAuthorizationPort,
  type LibraryRequest,
  type ResolvedContextPackage,
} from '@agm/library-control-plane';
import type { RequestContext } from '../common/request-context';
import { PermissionGuardianService } from '../permission-guardian/permission-guardian.service';
import {
  ConversationHistoryLibraryResolver,
  GmailLibraryResolver,
} from '../premium-assistant/premium-assistant-library.service';
import { PremiumAssistantGmailService } from '../premium-assistant/premium-assistant-gmail.service';
import { createPhase2cArchiveResolvers } from '../premium-assistant/shared-archive-library.resolver';
import { SharedArchiveService } from '../shared-archive/shared-archive.service';
import { TranslationService } from '../translation/translation.service';
import type { CarMoverLibraryRequestDto } from './dto/car-mover-library-request.dto';
import { PrismaCarMoverLibraryRepository } from './car-mover-library.repository';
import {
  createCarMoverDatabaseResolvers,
  planCarMoverDomains,
  ProfileContextBridgeResolver,
} from './car-mover-library.resolvers';

type GmailGuardianTrace = {
  decision: 'APPROVED' | 'DENIED' | 'NOT_PROVEN';
  authorityGranted: boolean;
  evidenceId: string;
  correlationId: string;
  reasonCode: string;
};

@Injectable()
export class CarMoverLibraryService {
  private readonly now = () => new Date();

  constructor(
    private readonly repository: PrismaCarMoverLibraryRepository,
    @Optional() private readonly gmail?: PremiumAssistantGmailService,
    @Optional() private readonly guardian?: PermissionGuardianService,
    @Optional() private readonly translation?: TranslationService,
    @Optional() private readonly archive?: SharedArchiveService,
  ) {}

  async resolve(user: RequestContext, dto: CarMoverLibraryRequestDto): Promise<ResolvedContextPackage> {
    const plan = planCarMoverDomains(dto.query);
    if (hasAuthorizedProfileContext(dto.profileContext)) {
      if (!plan.domains.includes('PROFILE')) plan.domains.push('PROFILE');
      if (!plan.intentHints.includes('PROFILE_CONTACTS')) plan.intentHints.push('PROFILE_CONTACTS');
    }
    const orchestrators = createDomainOrchestrators();
    for (const resolver of createCarMoverDatabaseResolvers(this.repository, this.now)) orchestrators[3].register(resolver);

    const history = new ConversationHistoryLibraryResolver(this.now);
    orchestrators[0].register(history);
    for (const resolver of createPhase2cArchiveResolvers(this.archive, this.now)) orchestrators[0].register(resolver);
    orchestrators[1].register(new GmailLibraryResolver(this.gmail, this.translation, this.now));
    orchestrators[2].register(new ProfileContextBridgeResolver());

    const requestId = user.requestId.trim() || `car-mover-library:${digest(dto.query)}`;
    const request: LibraryRequest = {
      requestId,
      correlationId: user.correlationId.trim() || requestId,
      surface: dto.surface,
      activeDomain: 'CAR_MOVER',
      requestedDomains: plan.domains,
      identity: { tenantId: user.companyId, subjectId: user.userId, roles: user.roles },
      query: { text: dto.query, language: dto.language, intentHints: plan.intentHints },
      sourceInputs: {
        CONVERSATION_HISTORY: dto.history,
        ...(dto.profileContext ? { PROFILE_CONTACTS: dto.profileContext } : {}),
        ...(dto.jobId ? { PREMIUM_CONTEXT: { jobId: dto.jobId } } : {}),
      },
    };
    return new AgmGlobalLibraryAuthority(
      orchestrators,
      new CarMoverLibraryAuthorization(user, dto, this.gmail, this.guardian),
      undefined,
      () => this.now().toISOString(),
    ).resolve(request);
  }
}

class CarMoverLibraryAuthorization implements LibraryAuthorizationPort {
  constructor(
    private readonly user: RequestContext,
    private readonly dto: CarMoverLibraryRequestDto,
    private readonly gmail?: PremiumAssistantGmailService,
    private readonly guardian?: PermissionGuardianService,
  ) {}

  async authorize(input: Parameters<LibraryAuthorizationPort['authorize']>[0]): Promise<LibraryAuthorizationDecision> {
    if (!this.user.roles.includes('PREMIUM_ACCESS')) return denied('PREMIUM_ENTITLEMENT_REQUIRED');
    if (input.source.source.startsWith('CAR_MOVER_')) return granted('CAR_MOVER_TENANT_PREMIUM_AUTHORIZED', [
      'answerText', 'records', 'sources', 'conflicts',
    ], `car-mover:${this.user.companyId}:${input.source.source}:${this.user.requestId}`);
    if (input.source.source === 'CONVERSATION_HISTORY') return granted(
      'SESSION_OR_USER_APPROVED_HISTORY_AUTHORIZED', ['answerText', 'turns', 'records', 'sources'], `history:${this.user.requestId}`,
    );
    if (['PREVIOUS_TRANSLATIONS', 'OCR_ARCHIVE', 'AGM_SHARED_ARCHIVE'].includes(input.source.source)) return granted(
      'SHARED_ARCHIVE_OWNER_AUTHORIZED', ['answerText', 'records', 'sources'], `archive:${this.user.requestId}:${input.source.source}`,
    );
    if (input.source.source === 'PROFILE_CONTACTS') {
      if (!hasAuthorizedProfileContext(this.dto.profileContext)) return denied('PROFILE_CONTEXT_MANDATE_NOT_PROVEN');
      return granted('PROFILE_PHASE2A_CONTEXT_AUTHORIZED', ['contactCommand'], `profile-context:${this.user.requestId}`);
    }
    if (input.source.source !== 'GMAIL') return denied('SOURCE_NOT_AUTHORIZED');
    if (!this.gmail?.configured()) return denied('GMAIL_NOT_CONFIGURED');
    let trace: GmailGuardianTrace | undefined;
    try {
      trace = await this.guardian?.evaluate(this.user, {
        phase: 'EXECUTION', requestedCapability: 'GMAIL_READONLY', requestedPermissionOrScope: 'https://www.googleapis.com/auth/gmail.readonly',
        requestor: 'agm.global-library-authority.car-mover.gmail', reason: `Authorize Gmail retrieval for ${input.match.intent}`, risk: 'MEDIUM',
        currentAuthority: 'AUTHORIZED', evidence: `car-mover-library:${this.user.requestId}`,
      }) as GmailGuardianTrace | undefined;
    } catch {
      trace = undefined;
    }
    if (!trace?.authorityGranted) return {
      ...denied(trace?.reasonCode ?? 'GUARDIAN_NOT_PROVEN'),
      evidenceRef: trace?.evidenceId ?? `guardian:not-proven:${this.user.requestId}`,
      ...(trace ? { metadata: guardianMetadata(trace) } : {}),
    };
    return {
      ...granted(trace.reasonCode, ['answerText', 'operation', 'sources', 'actionContext', 'translation'], trace.evidenceId),
      metadata: guardianMetadata(trace),
    };
  }
}

function hasAuthorizedProfileContext(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ResolvedContextPackage>;
  return typeof candidate.contractVersion === 'string'
    && (candidate.contexts?.some((context) => context.contributingSources.includes('PROFILE_CONTACTS'))
      || candidate.clarifications?.some((item) => item.resolverId === 'agm.profile.personal-contacts.v1')) === true;
}

function granted(reasonCode: string, allowedPayloadFields: readonly string[], evidenceRef: string): LibraryAuthorizationDecision {
  return { decision: 'GRANTED', authorityGranted: true, reasonCode, evidenceRef, allowedPayloadFields };
}

function denied(reasonCode: string): LibraryAuthorizationDecision {
  return { decision: 'NOT_PROVEN', authorityGranted: false, reasonCode, evidenceRef: `authorization:${reasonCode}`, allowedPayloadFields: [] };
}

function guardianMetadata(trace: GmailGuardianTrace) {
  return { guardianDecision: trace.decision, guardianEvidenceId: trace.evidenceId, guardianCorrelationId: trace.correlationId };
}

function digest(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16);
}
