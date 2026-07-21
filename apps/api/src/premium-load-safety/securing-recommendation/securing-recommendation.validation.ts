import type {
  ExplainedObservation,
  SecuringRecommendation,
  SecuringRecommendationInput,
} from './securing-recommendation.types';

const certaintyValues = new Set(['observed', 'probable', 'undetermined']);
const sourceValues = new Set(['visual', 'user-declared', 'general-practice']);

export function parseRecommendationInput(value: string | undefined): SecuringRecommendationInput {
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Recommendation input must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Recommendation input must be an object.');
  }
  const input = parsed as Record<string, unknown>;
  return {
    totalWeightKg: optionalPositiveNumber(input.totalWeightKg, 200_000),
    cargoType: optionalText(input.cargoType, 120),
    approximateDimensions: optionalText(input.approximateDimensions, 160),
    vehicleType: optionalText(input.vehicleType, 120),
    availableStraps: optionalInteger(input.availableStraps, 100),
    declaredLcDan: optionalPositiveNumber(input.declaredLcDan, 50_000),
    declaredStfDan: optionalPositiveNumber(input.declaredStfDan, 10_000),
    antiSlipMats: optionalChoice(input.antiSlipMats),
    edgeProtectors: optionalChoice(input.edgeProtectors),
    stops: optionalChoice(input.stops),
  };
}

export function parseSecuringRecommendation(value: string | undefined): SecuringRecommendation | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<SecuringRecommendation>;
    if (
      !parsed.visibleStraps ||
      !isNullableNonNegativeInteger(parsed.visibleStraps.estimatedCount) ||
      !isNullableNonNegativeInteger(parsed.visibleStraps.recommendedCount) ||
      !isObservations(parsed.visibleStraps.observations) ||
      !isObservations(parsed.recommendations) ||
      !isObservations(parsed.lcStf) ||
      !isObservations(parsed.additionalElements) ||
      !isStringArray(parsed.missingData)
    ) {
      return undefined;
    }
    const recommendation = parsed as SecuringRecommendation;
    const visibleObservations = recommendation.visibleStraps.observations.map(cleanObservation);
    const visuallyGroundedCount = visibleObservations.some(
      (observation) =>
        observation.certainty === 'observed' &&
        observation.sources.includes('visual') &&
        !observation.sources.includes('user-declared') &&
        !mentionsDeclaredData(observation),
    );
    return {
      visibleStraps: {
        estimatedCount: visuallyGroundedCount
          ? recommendation.visibleStraps.estimatedCount
          : null,
        recommendedCount: recommendation.visibleStraps.recommendedCount,
        observations: visibleObservations,
      },
      recommendations: recommendation.recommendations.map(cleanObservation),
      lcStf: recommendation.lcStf.map(cleanObservation),
      additionalElements: recommendation.additionalElements.map(cleanObservation),
      missingData: recommendation.missingData.map(cleanText).filter(Boolean),
    };
  } catch {
    return undefined;
  }
}

function cleanObservation(value: ExplainedObservation): ExplainedObservation {
  const sources = [...new Set(value.sources)];
  const certainty =
    value.certainty === 'observed' && !sources.includes('visual')
      ? 'probable'
      : value.certainty;
  return {
    id: value.id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80),
    conclusion: cleanText(value.conclusion),
    certainty,
    sources,
    explanation: cleanText(value.explanation),
  };
}

function mentionsDeclaredData(value: ExplainedObservation) {
  return /declar|provided|entered|angegeben|eingetragen/i.test(
    `${value.conclusion} ${value.explanation}`,
  );
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 700);
}

function isObservations(value: unknown): value is ExplainedObservation[] {
  return (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.conclusion === 'string' &&
        typeof item.explanation === 'string' &&
        certaintyValues.has(item.certainty) &&
        Array.isArray(item.sources) &&
        item.sources.length > 0 &&
        item.sources.every((source: unknown) => sourceValues.has(source as string)),
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 20 && value.every((item) => typeof item === 'string');
}

function isNullableNonNegativeInteger(value: unknown) {
  return value === null || (Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100);
}

function optionalPositiveNumber(value: unknown, maximum: number) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > maximum) throw new Error('Invalid numeric recommendation input.');
  return parsed;
}

function optionalInteger(value: unknown, maximum: number) {
  const parsed = optionalPositiveNumber(value, maximum);
  if (parsed === undefined) return undefined;
  if (!Number.isInteger(parsed)) throw new Error('Expected an integer recommendation input.');
  return parsed;
}

function optionalText(value: unknown, maximum: number) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('Invalid text recommendation input.');
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > maximum) throw new Error('Invalid text recommendation input.');
  return normalized;
}

function optionalChoice(value: unknown): 'yes' | 'no' | 'unknown' | undefined {
  return value === 'yes' || value === 'no' || value === 'unknown' ? value : undefined;
}
