import { Injectable } from '@nestjs/common';
import type {
  CanonicalAuthorityDecision,
  CanonicalAuthorityRequest,
  CanonicalRuntimeState,
  CanonicalSource,
} from './canonical-authority.contract';
import { CanonicalAuthorityLoader } from './canonical-authority.loader';
import { CanonicalAuthorityRuntimeOverlay } from './canonical-authority.overlay';

@Injectable()
export class CanonicalAuthorityService {
  constructor(
    private readonly library: CanonicalAuthorityLoader,
    private readonly runtimeFreshness: CanonicalAuthorityRuntimeOverlay,
  ) {}

  evaluate(request: CanonicalAuthorityRequest): CanonicalAuthorityDecision {
    const source = this.library.source(request.sourceId);
    if (!source || !this.library.contains(request.domain, request.sourceId)) {
      return unknown(request, source, this.library, source ? 'SOURCE_NOT_IN_CANONICAL_DOMAIN_VIEW' : 'SOURCE_ID_NOT_IN_CANONICAL_REGISTRY');
    }
    const reasons: string[] = [];
    if (!request.scopeConfirmed) reasons.push('APPROVED_SOURCE_SCOPE_NOT_CONFIRMED_BY_CALLER');
    if (!source.authority.jurisdictions.map(normalizeJurisdiction).includes(normalizeJurisdiction(request.jurisdiction))) {
      reasons.push('JURISDICTION_OUTSIDE_APPROVED_AUTHORITY');
    }
    const at = validDate(request.evaluatedAt);
    const effectiveFrom = source.freshness?.effectiveFrom ?? source.effectiveDate;
    const effectiveUntil = source.freshness?.effectiveUntil ?? null;
    if (effectiveFrom && startOfUtcDay(at) < startOfUtcDay(validDate(effectiveFrom))) reasons.push('AUTHORITY_NOT_YET_EFFECTIVE');
    // effectiveUntil is an expiry boundary: on that calendar day the source is
    // already review-required and cannot authorize current runtime use.
    if (effectiveUntil && startOfUtcDay(at) >= startOfUtcDay(validDate(effectiveUntil))) {
      return decision(request, source, this.library, 'EXPIRED_REVIEW_REQUIRED', false, ['EFFECTIVE_UNTIL_REACHED_OR_PASSED']);
    }
    const runtimeOverlay = this.runtimeFreshness.get(source.sourceId);
    const scheduledCheck = source.freshness?.nextFreshnessCheck;
    if (!runtimeOverlay && scheduledCheck && !Number.isFinite(new Date(scheduledCheck).getTime())) {
      return decision(request, source, this.library, 'FRESHNESS_UNKNOWN', false, ['BEFORE_USE_FRESHNESS_CHECK_REQUIRED']);
    }
    const freshness = runtimeOverlay?.status
      ?? source.freshness?.currentStatus
      ?? 'CURRENT';
    if (freshness === 'NEW_VERSION_DETECTED' || freshness === 'SUPERSEDED_PENDING_REVIEW') {
      return decision(request, source, this.library, 'NEW_VERSION_DETECTED', false, ['SUCCESSOR_REVIEW_REQUIRED']);
    }
    if (freshness === 'EXPIRED_REVIEW_REQUIRED') {
      return decision(request, source, this.library, 'EXPIRED_REVIEW_REQUIRED', false, ['CANONICAL_FRESHNESS_MARKS_SOURCE_EXPIRED']);
    }
    if (['FRESHNESS_UNKNOWN', 'REVIEW_REQUIRED'].includes(freshness)) {
      return decision(request, source, this.library, 'FRESHNESS_UNKNOWN', false, ['CURRENTNESS_NOT_DEMONSTRATED']);
    }
    if (reasons.length) return decision(request, source, this.library, 'UNKNOWN_HUMAN_VERIFICATION', false, reasons);
    if (source.authority.authorityType === 'CONTEXTUAL') {
      return decision(request, source, this.library, 'CONTEXTUAL_ONLY', false, ['CONTEXTUAL_SOURCE_CANNOT_ESTABLISH_NORMATIVE_AUTHORITY']);
    }
    if (!['AUTHORITATIVE', 'AUTHORITATIVE_WITH_SCOPE'].includes(source.authority.authorityType)) {
      return decision(request, source, this.library, 'UNKNOWN_HUMAN_VERIFICATION', false, ['AUTHORITY_TYPE_NOT_APPROVED_FOR_NORMATIVE_USE']);
    }
    if (request.purpose === 'CONTEXTUAL') {
      return decision(request, source, this.library, 'CANONICAL_CURRENT', false, ['CALLER_REQUESTED_CONTEXTUAL_USE']);
    }
    return { ...decision(request, source, this.library, 'CANONICAL_CURRENT', true, []), usageDisposition: 'ALLOWED_WITHIN_APPROVED_SCOPE' };
  }

  evaluateMany(requests: readonly CanonicalAuthorityRequest[]) {
    const decisions = requests.map((request) => this.evaluate(request));
    return {
      decisions,
      allNormativelyUsable: decisions.length > 0 && decisions.every((item) => item.normativeAuthority),
      fallback: decisions.length > 0 && decisions.every((item) => item.normativeAuthority) ? null : 'UNKNOWN_HUMAN_VERIFICATION' as const,
      resolvedValue: null,
    };
  }
}

function decision(
  request: CanonicalAuthorityRequest,
  source: CanonicalSource,
  library: CanonicalAuthorityLoader,
  state: CanonicalRuntimeState,
  normativeAuthority: boolean,
  reasons: string[],
): CanonicalAuthorityDecision {
  return {
    sourceId: request.sourceId,
    domain: request.domain,
    state,
    normativeAuthority,
    usageDisposition: state === 'CONTEXTUAL_ONLY' ? 'CONTEXTUAL_ONLY' : 'UNKNOWN_HUMAN_VERIFICATION',
    resolvedValue: null,
    reasons,
    trace: buildTrace(source, request.domain, library),
  };
}

function unknown(request: CanonicalAuthorityRequest, source: CanonicalSource | undefined, library: CanonicalAuthorityLoader, reason: string) {
  return {
    sourceId: request.sourceId,
    domain: request.domain,
    state: 'UNKNOWN_HUMAN_VERIFICATION',
    normativeAuthority: false,
    usageDisposition: 'UNKNOWN_HUMAN_VERIFICATION',
    resolvedValue: null,
    reasons: [reason],
    trace: source ? buildTrace(source, request.domain, library) : null,
  } satisfies CanonicalAuthorityDecision;
}

function buildTrace(source: CanonicalSource, domain: CanonicalAuthorityRequest['domain'], library: CanonicalAuthorityLoader) {
  return {
    canonicalRegistry: library.registryPath,
    canonicalView: library.viewPath(domain),
    canonicalPath: source.canonicalPath,
    canonicalUri: source.canonicalUri,
    sha256: source.sha256,
    authorityType: source.authority.authorityType,
    issuingAuthority: source.authority.issuingBody,
    jurisdictions: [...source.authority.jurisdictions],
    effectiveFrom: source.freshness?.effectiveFrom ?? source.effectiveDate,
    effectiveUntil: source.freshness?.effectiveUntil ?? null,
    freshnessStatus: source.freshness?.currentStatus ?? 'CURRENT',
    provenance: { ...source.provenance },
    evidenceRefs: [...source.evidenceRefs],
    scopeLimitations: [...(source.freshness?.limitations ?? [])],
  };
}

function validDate(value: string) {
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new Error('CANONICAL_AUTHORITY_INVALID_EVALUATION_DATE');
  return result;
}
function startOfUtcDay(value: Date) { return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()); }
function normalizeJurisdiction(value: string) { return value.trim().toUpperCase(); }
