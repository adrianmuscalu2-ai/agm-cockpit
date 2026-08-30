import type {
  AlertLedgerEntry,
  AlertReminderPolicy,
  SourceAlertEvent,
  SourceAlertType,
  SourceFreshnessEvaluation,
  SourceFreshnessObservation,
  SourceFreshnessRecord,
  SourceFreshnessStatus,
  SourceUsageDisposition,
} from './source-freshness.contract';

const DAY_MS = 86_400_000;
const EXPIRY_THRESHOLDS = [0, 1, 7, 14, 30] as const;
const STATUS_SEVERITY: Record<SourceFreshnessStatus, number> = {
  CURRENT: 0,
  EXPIRY_WARNING: 1,
  REVIEW_REQUIRED: 2,
  FRESHNESS_UNKNOWN: 3,
  EXPIRED_REVIEW_REQUIRED: 4,
  NEW_VERSION_DETECTED: 5,
  SUPERSEDED_PENDING_REVIEW: 6,
};

export function evaluateSourceFreshness(
  source: SourceFreshnessRecord,
  observation: SourceFreshnessObservation,
  ledger: readonly AlertLedgerEntry[] = [],
  reminderPolicy: AlertReminderPolicy = {},
): SourceFreshnessEvaluation {
  validateSource(source);
  const checkedAt = validDate(observation.checkedAt, 'checkedAt');
  const alerts: SourceAlertEvent[] = [];
  // An unresolved review state is sticky. Only a separate Product Owner apply
  // may clear it by updating the persisted record; a later scheduler run cannot.
  let status: SourceFreshnessStatus = source.reviewRequired ? source.currentStatus : 'CURRENT';

  if (source.effectiveFrom && calendarDayDifference(source.effectiveFrom, checkedAt) > 0) {
    status = 'REVIEW_REQUIRED';
  }

  if (source.effectiveUntil) {
    const daysUntilExpiry = calendarDayDifference(source.effectiveUntil, checkedAt);
    if (daysUntilExpiry <= 0) {
      status = moreSevere(status, 'EXPIRED_REVIEW_REQUIRED');
      addAlert(alerts, source, ledger, reminderPolicy, checkedAt, {
        alertType: daysUntilExpiry === 0 ? 'EXPIRY_DAY' : 'EXPIRED',
        status: 'EXPIRED_REVIEW_REQUIRED',
        effectiveVersionOrDate: source.effectiveUntil,
        condition: daysUntilExpiry === 0
          ? `Applicability expiry boundary ${source.effectiveUntil} has been reached; historical evidence is retained.`
          : `Applicability ended on ${source.effectiveUntil}; historical evidence is retained.`,
        impact: 'The source cannot establish a current value at or after its approved expiry boundary.',
        requiredProductOwnerAction: 'Review replacement evidence; keep dependent output UNKNOWN / HUMAN VERIFICATION until approved.',
      });
    } else if (daysUntilExpiry <= 30) {
      status = moreSevere(status, 'EXPIRY_WARNING');
      const threshold = expiryThreshold(daysUntilExpiry);
      if (threshold !== null) {
        const alertType = expiryAlertType(threshold);
        addAlert(alerts, source, ledger, reminderPolicy, checkedAt, {
          alertType,
          status: 'EXPIRY_WARNING',
          effectiveVersionOrDate: source.effectiveUntil,
          condition: threshold === 0
            ? `Applicability reaches its inclusive final day ${source.effectiveUntil}.`
            : `Applicability expires in ${daysUntilExpiry} calendar day(s), at threshold ${threshold}.`,
          impact: 'A replacement or explicit freshness decision may be required before current use can continue.',
          requiredProductOwnerAction: 'Review freshness/replacement evidence before the applicability window ends.',
        });
      }
    }
  }

  const freshnessDue = Boolean(
    source.nextFreshnessCheck
      && calendarDayDifference(source.nextFreshnessCheck, checkedAt) <= 0,
  );
  const freshnessFailed = observation.checkOutcome === 'FAILED'
    || (freshnessDue && observation.checkOutcome !== 'CONFIRMED_CURRENT');
  if (freshnessFailed && status !== 'EXPIRED_REVIEW_REQUIRED') {
    status = moreSevere(status, 'FRESHNESS_UNKNOWN');
    addAlert(alerts, source, ledger, reminderPolicy, checkedAt, {
      alertType: 'FRESHNESS_UNKNOWN',
      status: 'FRESHNESS_UNKNOWN',
      effectiveVersionOrDate: source.version ?? source.lastFreshnessCheck ?? source.capturedAt,
      condition: observation.checkFailureReason
        ?? (freshnessDue ? `Freshness check due ${source.nextFreshnessCheck} did not confirm currentness.` : 'Relevant freshness check failed.'),
      impact: 'Currentness cannot be demonstrated; a toll or rule value must not default to zero or PASS.',
      requiredProductOwnerAction: 'Review official evidence and decide whether to retain, replace, defer, or reject the source.',
    });
  }

  if (observation.manualReviewRequested) {
    status = moreSevere(status, 'REVIEW_REQUIRED');
  }

  let candidateReview: SourceFreshnessEvaluation['candidateReview'];
  if (observation.detectedCandidate) {
    status = observation.detectedCandidate.supersessionClaimed
      ? 'SUPERSEDED_PENDING_REVIEW'
      : 'NEW_VERSION_DETECTED';
    candidateReview = {
      currentSourceId: source.sourceId,
      candidate: observation.detectedCandidate,
      comparisonStatus: 'PENDING_PRODUCT_OWNER_REVIEW',
      automaticPromotion: false,
    };
    addAlert(alerts, source, ledger, reminderPolicy, checkedAt, {
      alertType: observation.detectedCandidate.supersessionClaimed
        ? 'SUPERSEDED_PENDING_REVIEW'
        : 'NEW_VERSION_DETECTED',
      status,
      effectiveVersionOrDate: candidateIdentity(observation.detectedCandidate),
      condition: `A distinct official candidate was detected: ${candidateIdentity(observation.detectedCandidate)}.`,
      impact: 'The candidate may supersede or modify the current source, but no authority or tariff change is automatic.',
      requiredProductOwnerAction: 'Review the candidate evidence and explicitly APPROVE, REJECT, or DEFER it.',
      detectedCandidate: observation.detectedCandidate,
    });
  }

  const reviewRequired = status !== 'CURRENT';
  const updatedSource: SourceFreshnessRecord = {
    ...source,
    lastFreshnessCheck: observation.checkOutcome === 'NOT_RUN' ? source.lastFreshnessCheck : observation.checkedAt,
    currentStatus: status,
    reviewRequired,
    supersededBy: [...source.supersededBy],
  };

  return {
    source: updatedSource,
    status,
    reviewRequired,
    usageDisposition: usageDisposition(status),
    resolvedValue: null,
    alerts,
    candidateReview,
    guardrails: {
      registryMutation: 'NONE',
      routingTollViewMutation: 'NONE',
      authorityPromotion: 'NONE',
      tariffMutation: 'NONE',
      productionDataMutation: 'NONE',
    },
  };
}

function addAlert(
  alerts: SourceAlertEvent[],
  source: SourceFreshnessRecord,
  ledger: readonly AlertLedgerEntry[],
  reminderPolicy: AlertReminderPolicy,
  checkedAt: Date,
  event: Omit<SourceAlertEvent, 'sourceId' | 'dedupKey'>,
) {
  const dedupKey = sourceAlertDedupKey(source.sourceId, event.alertType, event.effectiveVersionOrDate);
  if (!shouldSendAlert(dedupKey, event.status, checkedAt, ledger, reminderPolicy)) return;
  alerts.push({ ...event, sourceId: source.sourceId, dedupKey });
}

export function sourceAlertDedupKey(sourceId: string, alertType: SourceAlertType, effectiveVersionOrDate: string) {
  return `${sourceId}|${alertType}|${effectiveVersionOrDate}`;
}

export function shouldSendAlert(
  dedupKey: string,
  status: SourceFreshnessStatus,
  now: Date,
  ledger: readonly AlertLedgerEntry[],
  reminderPolicy: AlertReminderPolicy = {},
) {
  const previous = [...ledger].reverse().find((entry) => entry.dedupKey === dedupKey);
  if (!previous) return true;
  if (STATUS_SEVERITY[status] > STATUS_SEVERITY[previous.status]) return true;
  if (previous.acknowledgedAt || !reminderPolicy.resendAfterDays) return false;
  return now.getTime() - validDate(previous.sentAt, 'sentAt').getTime()
    >= reminderPolicy.resendAfterDays * DAY_MS;
}

function usageDisposition(status: SourceFreshnessStatus): SourceUsageDisposition {
  if (status === 'CURRENT') return 'ALLOWED_WITHIN_APPROVED_SCOPE';
  if (status === 'EXPIRY_WARNING') return 'ALLOWED_WITHIN_APPROVED_SCOPE_EXPIRY_WARNING';
  return 'UNKNOWN_HUMAN_VERIFICATION';
}

function expiryThreshold(daysUntilExpiry: number): 0 | 1 | 7 | 14 | 30 | null {
  return EXPIRY_THRESHOLDS.find((threshold) => daysUntilExpiry <= threshold) ?? null;
}

function expiryAlertType(threshold: 0 | 1 | 7 | 14 | 30): SourceAlertType {
  if (threshold === 0) return 'EXPIRY_DAY';
  if (threshold === 1) return 'EXPIRY_1_DAY';
  return `EXPIRY_${threshold}_DAYS` as SourceAlertType;
}

function candidateIdentity(candidate: NonNullable<SourceFreshnessObservation['detectedCandidate']>) {
  return candidate.version ?? candidate.effectiveFrom ?? candidate.sha256 ?? candidate.officialUrl;
}

function moreSevere(left: SourceFreshnessStatus, right: SourceFreshnessStatus) {
  return STATUS_SEVERITY[right] > STATUS_SEVERITY[left] ? right : left;
}

function calendarDayDifference(dateOnlyOrTimestamp: string, comparedWith: Date) {
  const target = utcDay(validDate(dateOnlyOrTimestamp, 'source date'));
  const actual = utcDay(comparedWith);
  return Math.round((target - actual) / DAY_MS);
}

function utcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function validDate(value: string, field: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`SOURCE_FRESHNESS_INVALID_${field.toUpperCase().replace(/\W/g, '_')}`);
  return date;
}

function validateSource(source: SourceFreshnessRecord) {
  if (!source.sourceId || !source.officialUrl || !source.sha256 || !/^[a-f0-9]{64}$/i.test(source.sha256)) {
    throw new Error('SOURCE_FRESHNESS_INVALID_SOURCE');
  }
}
