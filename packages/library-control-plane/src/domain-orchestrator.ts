import type {
  AgmLibraryDomain,
  AgmLibrarySourceId,
  AuthorizedResolutionRecord,
  LibraryMandate,
  LibraryRequest,
  LibraryResolver,
  ResolverMatch,
} from './contracts';

export type PlannedResolver = { resolver: LibraryResolver; match: ResolverMatch };

export interface LibraryDomainOrchestrator {
  readonly id: string;
  readonly domain: AgmLibraryDomain;
  readonly eligibleSources: ReadonlySet<AgmLibrarySourceId>;
  register(resolver: LibraryResolver): void;
  plan(request: LibraryRequest): readonly PlannedResolver[];
  execute(request: LibraryRequest, mandate: LibraryMandate): Promise<readonly AuthorizedResolutionRecord[]>;
}

abstract class BaseLibraryOrchestrator implements LibraryDomainOrchestrator {
  readonly #resolvers = new Map<string, LibraryResolver>();

  protected constructor(
    readonly id: string,
    readonly domain: AgmLibraryDomain,
    readonly eligibleSources: ReadonlySet<AgmLibrarySourceId>,
  ) {}

  register(resolver: LibraryResolver) {
    if (!resolver.descriptor.supportedDomains.includes(this.domain)) throw new Error(`RESOLVER_DOMAIN_NOT_SUPPORTED:${resolver.descriptor.resolverId}:${this.domain}`);
    if (!this.eligibleSources.has(resolver.descriptor.source)) throw new Error(`SOURCE_NOT_ELIGIBLE:${resolver.descriptor.source}:${this.domain}`);
    if (this.#resolvers.has(resolver.descriptor.resolverId)) throw new Error(`DUPLICATE_RESOLVER:${resolver.descriptor.resolverId}`);
    this.#resolvers.set(resolver.descriptor.resolverId, resolver);
  }

  plan(request: LibraryRequest) {
    return [...this.#resolvers.values()]
      .map((resolver) => ({ resolver, match: resolver.match(request) }))
      .filter(({ match }) => match.eligible)
      .sort((left, right) => right.match.confidence - left.match.confidence || left.resolver.descriptor.resolverId.localeCompare(right.resolver.descriptor.resolverId));
  }

  async execute(request: LibraryRequest, mandate: LibraryMandate) {
    if (mandate.domain !== this.domain || mandate.orchestratorId !== this.id) throw new Error('MANDATE_SCOPE_MISMATCH');
    const results: AuthorizedResolutionRecord[] = [];
    for (const authorized of mandate.authorizedResolvers) {
      if (!authorized.authorization.authorityGranted || authorized.authorization.decision !== 'GRANTED') throw new Error(`UNAUTHORIZED_RESOLVER_IN_MANDATE:${authorized.resolverId}`);
      const resolver = this.#resolvers.get(authorized.resolverId);
      if (!resolver || resolver.descriptor.source !== authorized.source) throw new Error(`MANDATED_RESOLVER_NOT_REGISTERED:${authorized.resolverId}`);
      const raw = await resolver.resolve({ request, mandate, authorization: authorized.authorization, match: authorized.match });
      validateResolverResult(raw, authorized.resolverId);
      const allowed = new Set(authorized.authorization.allowedPayloadFields);
      const minimalAuthorizedPayload = Object.fromEntries(Object.entries(raw.minimalAuthorizedPayload).filter(([field]) => allowed.has(field)));
      results.push({ ...raw, minimalAuthorizedPayload, domain: this.domain, orchestratorId: this.id, resolverId: authorized.resolverId, source: authorized.source, authorization: authorized.authorization });
    }
    return results;
  }
}

function validateResolverResult(result: Awaited<ReturnType<LibraryResolver['resolve']>>, resolverId: string) {
  if (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) throw new Error(`INVALID_RESOLVER_CONFIDENCE:${resolverId}`);
  if (!result.deduplicationKey.trim()) throw new Error(`MISSING_DEDUPLICATION_KEY:${resolverId}`);
  if (result.ambiguity.ambiguous !== (result.status === 'AMBIGUOUS')) throw new Error(`AMBIGUITY_STATUS_MISMATCH:${resolverId}`);
  if (result.status === 'FOUND' && result.result.recordCount < 1) throw new Error(`FOUND_WITHOUT_RECORD:${resolverId}`);
  if (result.status === 'NO_DATA' && result.result.recordCount !== 0) throw new Error(`NO_DATA_WITH_RECORD:${resolverId}`);
}

const BASIC_SOURCES = new Set<AgmLibrarySourceId>([
  'CONVERSATION_HISTORY', 'PREVIOUS_TRANSLATIONS', 'OCR_ARCHIVE', 'AGM_CANONICAL_LIBRARY', 'PROFILE_PERMITTED_DATA', 'PROFILE_CONTACTS', 'AGM_SHARED_ARCHIVE',
]);
const PREMIUM_SOURCES = new Set<AgmLibrarySourceId>([
  ...BASIC_SOURCES, 'GMAIL', 'PERSONAL_CONTACTS', 'ANDROID_HANDOFF', 'PREMIUM_ACTIONS', 'PREMIUM_CONTEXT',
]);
const PROFILE_SOURCES = new Set<AgmLibrarySourceId>([
  'PROFILE_CONTACTS', 'PROFILE_PREFERENCES', 'PROFILE_CONFIGURATION', 'PROFILE_RELATIONSHIPS', 'AGM_SHARED_ARCHIVE',
]);
const CAR_MOVER_SOURCES = new Set<AgmLibrarySourceId>([
  'CAR_MOVER_TRANSPORTS', 'CAR_MOVER_OFFERS', 'CAR_MOVER_CLIENTS', 'CAR_MOVER_VEHICLES', 'CAR_MOVER_PLATFORMS',
  'CAR_MOVER_TRIP_HISTORY', 'CAR_MOVER_DOCUMENTS', 'CAR_MOVER_RATES', 'CAR_MOVER_EMPTY_KILOMETRES', 'CAR_MOVER_COSTS',
  'GMAIL', 'AGM_SHARED_ARCHIVE', 'PROFILE_PERMITTED_DATA', 'PROFILE_CONTACTS',
]);

export class BasicLibraryOrchestrator extends BaseLibraryOrchestrator {
  constructor() { super('agm.library.basic', 'BASIC', BASIC_SOURCES); }
}

export class PremiumLibraryOrchestrator extends BaseLibraryOrchestrator {
  constructor() { super('agm.library.premium', 'PREMIUM', PREMIUM_SOURCES); }
}

export class ProfileLibraryOrchestrator extends BaseLibraryOrchestrator {
  constructor() { super('agm.library.profile', 'PROFILE', PROFILE_SOURCES); }
}

export class CarMoverLibraryOrchestrator extends BaseLibraryOrchestrator {
  constructor() { super('agm.library.car-mover', 'CAR_MOVER', CAR_MOVER_SOURCES); }
}

export function createDomainOrchestrators() {
  return [new BasicLibraryOrchestrator(), new PremiumLibraryOrchestrator(), new ProfileLibraryOrchestrator(), new CarMoverLibraryOrchestrator()] as const;
}
