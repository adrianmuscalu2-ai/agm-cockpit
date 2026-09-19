import type {
  AgmLibraryDomain,
  AuthorizedResolutionRecord,
  LibraryAuthorizationPort,
  LibraryControlTraceEvent,
  LibraryDomainClassifier,
  LibraryMandate,
  LibraryRequest,
  ResolvedContextItem,
  ResolvedContextPackage,
} from './contracts';
import { AGM_LIBRARY_CONTROL_PLANE_VERSION } from './contracts';
import type { LibraryDomainOrchestrator, PlannedResolver } from './domain-orchestrator';

export class OriginAwareDomainClassifier implements LibraryDomainClassifier {
  classify(request: LibraryRequest): readonly AgmLibraryDomain[] {
    const explicit = request.requestedDomains?.length ? request.requestedDomains : undefined;
    if (explicit) return uniqueDomains(explicit);
    if (request.surface === 'ANDROID' || request.surface === 'BROWSER') return request.activeDomain ? [request.activeDomain] : [];
    return [request.surface];
  }
}

export class AgmGlobalLibraryAuthority {
  readonly #orchestrators = new Map<AgmLibraryDomain, LibraryDomainOrchestrator>();

  constructor(
    orchestrators: readonly LibraryDomainOrchestrator[],
    private readonly authorization: LibraryAuthorizationPort,
    private readonly classifier: LibraryDomainClassifier = new OriginAwareDomainClassifier(),
    private readonly now = () => new Date().toISOString(),
  ) {
    for (const orchestrator of orchestrators) {
      if (this.#orchestrators.has(orchestrator.domain)) throw new Error(`DUPLICATE_DOMAIN_ORCHESTRATOR:${orchestrator.domain}`);
      this.#orchestrators.set(orchestrator.domain, orchestrator);
    }
  }

  registeredDomains() { return [...this.#orchestrators.keys()].sort(); }

  async resolve(request: LibraryRequest): Promise<ResolvedContextPackage> {
    validateRequest(request);
    const trace: LibraryControlTraceEvent[] = [];
    const emit = (event: Omit<LibraryControlTraceEvent, 'sequence'>) => trace.push({ sequence: trace.length + 1, ...event });
    emit({ stage: 'REQUEST_RECEIVED', outcome: request.surface });
    const domains = uniqueDomains(this.classifier.classify(request));
    emit({ stage: 'DOMAIN_CLASSIFIED', outcome: domains.length ? domains.join('+') : 'UNRESOLVED' });

    const mandates: LibraryMandate[] = [];
    const records: AuthorizedResolutionRecord[] = [];
    const authorizationDenials: ResolvedContextPackage['authorizationDenials'][number][] = [];
    const failures: ResolvedContextPackage['failures'][number][] = [];
    let eligibleCount = 0;

    for (const domain of domains) {
      const orchestrator = this.#orchestrators.get(domain);
      if (!orchestrator) {
        failures.push({ domain, resolverId: 'UNREGISTERED', reasonCode: 'DOMAIN_ORCHESTRATOR_NOT_REGISTERED' });
        continue;
      }
      const plan = orchestrator.plan(request);
      eligibleCount += plan.length;
      plan.forEach(({ resolver }) => emit({ stage: 'RESOLVER_ELIGIBLE', domain, resolverId: resolver.descriptor.resolverId, outcome: resolver.descriptor.source }));
      const authorized = await this.authorizePlan(request, domain, plan, emit, authorizationDenials);
      const mandate: LibraryMandate = {
        mandateId: `mandate:${request.requestId}:${domain.toLowerCase()}`,
        requestId: request.requestId,
        domain,
        orchestratorId: orchestrator.id,
        issuedAt: this.now(),
        policyVersion: AGM_LIBRARY_CONTROL_PLANE_VERSION,
        authorizedResolvers: authorized,
      };
      mandates.push(mandate);
      emit({ stage: 'MANDATE_ISSUED', domain, outcome: `AUTHORIZED_${authorized.length}` });
      try {
        authorized.forEach((item) => emit({ stage: 'RESOLVER_CALLED', domain, resolverId: item.resolverId, outcome: 'AUTHORIZED' }));
        const resolved = await orchestrator.execute(request, mandate);
        records.push(...resolved);
        resolved.forEach((item) => emit({ stage: 'RESULT_COLLECTED', domain, resolverId: item.resolverId, outcome: item.status }));
      } catch (error) {
        failures.push({ domain, resolverId: 'ORCHESTRATOR', reasonCode: error instanceof Error ? error.message : 'RESOLUTION_FAILED' });
      }
    }

    const ambiguous = records.filter((record) => record.status === 'AMBIGUOUS' || record.ambiguity.ambiguous);
    const found = records.filter((record) => record.status === 'FOUND');
    const { contexts, conflicts } = packageContexts(found);
    const allEligibleCompleted = eligibleCount > 0
      && records.length + authorizationDenials.length === eligibleCount
      && failures.length === 0;
    const status: ResolvedContextPackage['status'] = ambiguous.length
      ? 'CLARIFICATION_REQUIRED'
      : contexts.length
        ? 'CONTEXT_READY'
        : allEligibleCompleted && authorizationDenials.length === 0 && records.every((record) => record.status === 'NO_DATA')
          ? 'VERIFIED_NO_DATA'
          : 'BLOCKED';
    const dispatch = dispatchFor(status);
    emit({ stage: 'CONTEXT_PACKAGED', outcome: `${status}:CONTEXTS_${contexts.length}:CONFLICTS_${conflicts.length}` });
    emit({ stage: 'DISPATCH_DECIDED', outcome: dispatch.reason });
    return {
      contractVersion: AGM_LIBRARY_CONTROL_PLANE_VERSION,
      requestId: request.requestId,
      correlationId: request.correlationId,
      status,
      domains,
      mandates,
      contexts,
      conflicts,
      authorizationDenials,
      failures,
      dispatch,
      trace,
    };
  }

  private async authorizePlan(
    request: LibraryRequest,
    domain: AgmLibraryDomain,
    plan: readonly PlannedResolver[],
    emit: (event: Omit<LibraryControlTraceEvent, 'sequence'>) => void,
    denials: ResolvedContextPackage['authorizationDenials'][number][],
  ) {
    const authorized: LibraryMandate['authorizedResolvers'][number][] = [];
    for (const item of plan) {
      const decision = await this.authorization.authorize({ request, domain, source: item.resolver.descriptor, match: item.match });
      emit({ stage: 'AUTHORIZATION_EVALUATED', domain, resolverId: item.resolver.descriptor.resolverId, outcome: decision.decision });
      if (!decision.authorityGranted || decision.decision !== 'GRANTED') {
        denials.push({ domain, resolverId: item.resolver.descriptor.resolverId, reasonCode: decision.reasonCode, evidenceRef: decision.evidenceRef });
        continue;
      }
      authorized.push({ resolverId: item.resolver.descriptor.resolverId, source: item.resolver.descriptor.source, authorization: decision, match: item.match });
    }
    return authorized;
  }
}

export function assertGenericFallbackAuthorized(result: ResolvedContextPackage) {
  if (!result.dispatch.genericFallbackAllowed || result.status !== 'VERIFIED_NO_DATA') throw new Error(`GENERIC_FALLBACK_DENIED:${result.dispatch.reason}`);
  return result;
}

function validateRequest(request: LibraryRequest) {
  if (!request.requestId.trim() || !request.correlationId.trim()) throw new Error('LIBRARY_REQUEST_ID_REQUIRED');
  if (!request.identity.tenantId.trim() || !request.identity.subjectId.trim()) throw new Error('LIBRARY_IDENTITY_REQUIRED');
  if (!request.query.text.trim() || !request.query.language.trim()) throw new Error('LIBRARY_QUERY_REQUIRED');
}

function uniqueDomains(domains: readonly AgmLibraryDomain[]) {
  return [...new Set(domains)];
}

function dispatchFor(status: ResolvedContextPackage['status']): ResolvedContextPackage['dispatch'] {
  if (status === 'CONTEXT_READY') return { assistantAllowed: true, injectResolvedContext: true, genericFallbackAllowed: false, reason: 'RESOLVED_CONTEXT_REQUIRED' };
  if (status === 'VERIFIED_NO_DATA') return { assistantAllowed: true, injectResolvedContext: false, genericFallbackAllowed: true, reason: 'VERIFIED_NO_DATA' };
  if (status === 'CLARIFICATION_REQUIRED') return { assistantAllowed: false, injectResolvedContext: false, genericFallbackAllowed: false, reason: 'CLARIFICATION_REQUIRED' };
  return { assistantAllowed: false, injectResolvedContext: false, genericFallbackAllowed: false, reason: 'RESOLUTION_INCOMPLETE' };
}

function packageContexts(records: readonly AuthorizedResolutionRecord[]) {
  const grouped = new Map<string, AuthorizedResolutionRecord[]>();
  for (const record of records) grouped.set(record.deduplicationKey, [...(grouped.get(record.deduplicationKey) ?? []), record]);
  const contexts: ResolvedContextItem[] = [];
  const conflicts: ResolvedContextPackage['conflicts'][number][] = [];
  for (const [deduplicationKey, candidates] of grouped) {
    const ordered = [...candidates].sort(compareResolution);
    const selected = ordered[0]!;
    const selectedPayload = stableJson(selected.minimalAuthorizedPayload);
    const conflicting = ordered.slice(1).filter((candidate) => stableJson(candidate.minimalAuthorizedPayload) !== selectedPayload);
    if (conflicting.length) conflicts.push({ deduplicationKey, selectedResolverId: selected.resolverId, rejectedResolverIds: conflicting.map((candidate) => candidate.resolverId) });
    contexts.push({
      contextId: deduplicationKey,
      identity: selected.identity,
      summary: selected.result.summary,
      confidence: selected.confidence,
      provenance: ordered.map((candidate) => candidate.provenance),
      freshness: selected.freshness,
      minimalAuthorizedPayload: selected.minimalAuthorizedPayload,
      contributingSources: [...new Set(ordered.map((candidate) => candidate.source))],
    });
  }
  return { contexts, conflicts };
}

function compareResolution(left: AuthorizedResolutionRecord, right: AuthorizedResolutionRecord) {
  const freshness = freshnessRank(right.freshness.status) - freshnessRank(left.freshness.status);
  return freshness || right.confidence - left.confidence || left.resolverId.localeCompare(right.resolverId);
}

function freshnessRank(status: AuthorizedResolutionRecord['freshness']['status']) {
  return ({ CURRENT: 4, STALE: 3, UNKNOWN: 2, EXPIRED: 1 } as const)[status];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
