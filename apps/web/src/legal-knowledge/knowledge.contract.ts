export type KnowledgeStatus =
  | 'draft'
  | 'domain-reviewed'
  | 'legal-reviewed'
  | 'qa-reviewed'
  | 'published';

export type KnowledgeSource = {
  id: string;
  title: string;
  url: string;
  official: true;
  reachable: boolean;
  checkedAt: string;
  reviewDueAt: string;
};

export type KnowledgeValidation = {
  domainReviewed: boolean;
  legalReviewed: boolean;
  qaReviewed: boolean;
  domainValidator?: string;
  legalValidator?: string;
  qaValidator?: string;
  domainReviewedAt?: string;
  legalReviewedAt?: string;
  qaReviewedAt?: string;
  holdReasons: readonly string[];
  contradictions: readonly string[];
};

export type KnowledgeHistoryEntry = {
  version: string;
  changedAt: string;
  author: string;
  summary: string;
};

export type KnowledgeItem = {
  id: string;
  topic: string;
  legalRule: string;
  practicalExplanation: string;
  examples: readonly string[];
  commonMistakes: readonly string[];
  sourceReferences: readonly {
    sourceId: string;
    locator: string;
  }[];
  jurisdiction: string;
  verifiedAt: string;
  reviewDueAt: string;
};

export type KnowledgePackage = {
  id: string;
  domain: string;
  title: string;
  jurisdiction: string;
  verifiedAt: string;
  reviewDueAt: string;
  version: string;
  status: KnowledgeStatus;
  sources: readonly KnowledgeSource[];
  items: readonly KnowledgeItem[];
  history: readonly KnowledgeHistoryEntry[];
  validation: KnowledgeValidation;
};

export function isKnowledgePackagePublishable(
  knowledgePackage: KnowledgePackage,
  now = new Date(),
): boolean {
  const validation = knowledgePackage.validation;
  const sourceIds = new Set(knowledgePackage.sources.map((source) => source.id));
  const itemIds = new Set(knowledgePackage.items.map((item) => item.id));
  const packageReviewIsCurrent = new Date(knowledgePackage.reviewDueAt).getTime() >= now.getTime();
  const sourcesAreCurrent = knowledgePackage.sources.every((source) =>
    source.official
    && source.reachable
    && isValidHttpUrl(source.url)
    && isValidReviewDate(source.checkedAt)
    && new Date(source.checkedAt).getTime() <= now.getTime()
    && new Date(source.checkedAt).getTime() <= new Date(source.reviewDueAt).getTime()
    && new Date(source.reviewDueAt).getTime() >= now.getTime());
  const itemsAreCurrentAndTraceable = knowledgePackage.items.every((item) =>
    new Date(item.reviewDueAt).getTime() >= now.getTime()
    && item.sourceReferences.length > 0
    && item.sourceReferences.every((reference) => sourceIds.has(reference.sourceId) && reference.locator.trim().length > 0)
    && hasPublishableVisualReference(item));
  const validationDatesAreNotFuture = [
    validation.domainReviewedAt,
    validation.legalReviewedAt,
    validation.qaReviewedAt,
  ].every((value) => value !== undefined && new Date(value).getTime() <= now.getTime());

  return knowledgePackage.status === 'published'
    && validation.domainReviewed
    && validation.legalReviewed
    && validation.qaReviewed
    && isNonBlank(validation.domainValidator)
    && isNonBlank(validation.legalValidator)
    && isNonBlank(validation.qaValidator)
    && isValidReviewDate(validation.domainReviewedAt)
    && isValidReviewDate(validation.legalReviewedAt)
    && isValidReviewDate(validation.qaReviewedAt)
    && validationDatesAreNotFuture
    && validation.holdReasons.length === 0
    && validation.contradictions.length === 0
    && packageReviewIsCurrent
    && sourceIds.size === knowledgePackage.sources.length
    && itemIds.size === knowledgePackage.items.length
    && sourcesAreCurrent
    && itemsAreCurrentAndTraceable;
}

function hasPublishableVisualReference(item: KnowledgeItem): boolean {
  if (!('visualReference' in item)) return true;
  const visualReference = item.visualReference;
  const fields = visualReference as Record<string, unknown>;
  return typeof visualReference === 'object'
    && visualReference !== null
    && 'assetStatus' in visualReference
    && visualReference.assetStatus === 'verified'
    && hasNonBlankVisualField(visualReference, 'assetId')
    && hasNonBlankVisualField(visualReference, 'assetPath')
    && hasNonBlankVisualField(visualReference, 'sha256')
    && hasNonBlankVisualField(visualReference, 'sourceId')
    && hasNonBlankVisualField(visualReference, 'locator')
    && hasNonBlankVisualField(visualReference, 'authorOrOrganization')
    && hasNonBlankVisualField(visualReference, 'rightsHolder')
    && hasNonBlankVisualField(visualReference, 'rightsRecord')
    && hasNonBlankVisualField(visualReference, 'licenseType')
    && hasNonBlankVisualField(visualReference, 'officialSourceUrl')
    && hasNonBlankVisualField(visualReference, 'licenseVerifiedAt')
    && hasNonBlankVisualField(visualReference, 'provenanceValidator')
    && hasNonBlankVisualField(visualReference, 'visualQaValidator')
    && isValidReviewDate(String(fields.licenseVerifiedAt))
    && isValidProvenanceUri(String(fields.officialSourceUrl))
    && typeof fields.attributionRequired === 'boolean'
    && (fields.attributionRequired !== true || hasNonBlankVisualField(visualReference, 'attributionText'));
}

function isValidProvenanceUri(value: string): boolean {
  return isValidHttpUrl(value) || /^repo:\/[^\s]+$/.test(value);
}

function hasNonBlankVisualField(value: object, field: string): boolean {
  return field in value && typeof (value as Record<string, unknown>)[field] === 'string'
    && String((value as Record<string, unknown>)[field]).trim().length > 0;
}

function isNonBlank(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidReviewDate(value: string | undefined): value is string {
  if (!isNonBlank(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
