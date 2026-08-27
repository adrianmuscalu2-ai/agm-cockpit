import { createHash } from 'node:crypto';

export const OPPORTUNITY_CONTRACT_VERSION = 'opportunity-intelligence.v1';
export const UNKNOWN = 'UNKNOWN';
export const NEEDS_CONFIRMATION = 'NEEDS_CONFIRMATION';
export const DEFAULT_FRESHNESS_MINUTES = 60;

export type RawOpportunity = {
  platform?: string; sourceOpportunityId?: string; platformReference?: string;
  pickupLocation?: string; deliveryLocation?: string;
  pickupWindowStart?: string; pickupWindowEnd?: string; deliveryWindowStart?: string; deliveryWindowEnd?: string;
  priceAmount?: number; currencyCode?: string; declaredKm?: number;
  vehicleType?: string; vin?: string; registration?: string;
  conditions?: string[]; notes?: string; sourceTimestamp: string;
};

export type NormalizedOpportunityValue = {
  platform: string; sourceOpportunityId: string;
  pickupLocation: { label: string; state: 'KNOWN'|'UNKNOWN'|'NEEDS_CONFIRMATION' };
  deliveryLocation: { label: string; state: 'KNOWN'|'UNKNOWN'|'NEEDS_CONFIRMATION' };
  pickupWindowStart?: Date; pickupWindowEnd?: Date; deliveryWindowStart?: Date; deliveryWindowEnd?: Date;
  priceAmount?: number; currencyCode?: string; declaredKm?: number;
  vehicle: { vehicleType: string; vin: string; registration: string };
  conditions: string[]; notes?: string; sourceTimestamp: Date; freshnessStatus: 'FRESH'|'STALE';
  fieldConfidence: Record<string, number>; inputHash: string; correlationKey: string;
};

export type RouteInput = {
  distanceKm: number; durationMinutes: number; distanceToPickupKm: number;
  repositionKm?: number; repositionMinutes?: number; availableGapMinutes?: number;
  mobilityModes?: string[]; tolls?: Array<{ label: string; amount?: number; currencyCode?: string }>;
  restrictions?: string[]; finalHomeDistanceKm?: number; sources: string[]; assumptions?: string[];
  confidence: number; warnings?: string[]; validForMinutes?: number;
};

export type CostInput = {
  fuel?: number; train?: number; bus?: number; taxi?: number; tolls?: number;
  accommodation?: number; otherReposition?: number; assumptions?: string[]; validForMinutes?: number;
};

export function normalizeOpportunity(raw: RawOpportunity, now = new Date()): NormalizedOpportunityValue {
  const sourceTimestamp = validDate(raw.sourceTimestamp);
  const freshnessStatus = now.getTime() - sourceTimestamp.getTime() <= DEFAULT_FRESHNESS_MINUTES * 60_000 ? 'FRESH' : 'STALE';
  const pickup = normalizeText(raw.pickupLocation, true);
  const delivery = normalizeText(raw.deliveryLocation, true);
  const sourceOpportunityId = normalizeText(raw.sourceOpportunityId ?? raw.platformReference, false).value;
  const canonical = {
    pickup: pickup.value.toLowerCase(), delivery: delivery.value.toLowerCase(),
    pickupWindowStart: raw.pickupWindowStart ?? UNKNOWN, priceAmount: raw.priceAmount ?? UNKNOWN,
    currencyCode: raw.currencyCode?.toUpperCase() ?? UNKNOWN,
    vehicleType: raw.vehicleType?.trim().toLowerCase() ?? UNKNOWN,
  };
  return {
    platform: raw.platform?.trim() || UNKNOWN, sourceOpportunityId,
    pickupLocation: { label: pickup.value, state: pickup.state },
    deliveryLocation: { label: delivery.value, state: delivery.state },
    pickupWindowStart: optionalDate(raw.pickupWindowStart), pickupWindowEnd: optionalDate(raw.pickupWindowEnd),
    deliveryWindowStart: optionalDate(raw.deliveryWindowStart), deliveryWindowEnd: optionalDate(raw.deliveryWindowEnd),
    priceAmount: finite(raw.priceAmount), currencyCode: raw.currencyCode?.trim().toUpperCase() || undefined,
    declaredKm: finite(raw.declaredKm),
    vehicle: { vehicleType: raw.vehicleType?.trim() || UNKNOWN, vin: raw.vin?.trim() || UNKNOWN, registration: raw.registration?.trim() || UNKNOWN },
    conditions: raw.conditions?.map((value) => value.trim()).filter(Boolean) ?? [], notes: raw.notes?.trim() || undefined,
    sourceTimestamp, freshnessStatus,
    fieldConfidence: {
      pickupLocation: pickup.state === 'KNOWN' ? 100 : 0, deliveryLocation: delivery.state === 'KNOWN' ? 100 : 0,
      priceAmount: raw.priceAmount === undefined ? 0 : 100, vehicleType: raw.vehicleType ? 100 : 0,
    },
    inputHash: hash(raw), correlationKey: hash(canonical),
  };
}

export function assessRoute(input: RouteInput) {
  const repositionKm = Math.max(0, input.repositionKm ?? input.distanceToPickupKm);
  const repositionMinutes = Math.max(0, input.repositionMinutes ?? Math.round(repositionKm * 1.2));
  const feasible = input.availableGapMinutes === undefined || repositionMinutes <= input.availableGapMinutes;
  return {
    distanceKm: positive(input.distanceKm), durationMinutes: positive(input.durationMinutes),
    distanceToPickupKm: Math.max(0, input.distanceToPickupKm), repositionKm, repositionMinutes,
    mobilityModes: input.mobilityModes?.length ? input.mobilityModes : ['ROAD'], tolls: input.tolls ?? [], restrictions: input.restrictions ?? [],
    finalHomeDistanceKm: input.finalHomeDistanceKm, feasible, sources: input.sources,
    assumptions: input.assumptions ?? [], confidence: clamp(input.confidence),
    calculation: { temporalRule: 'repositionMinutes <= availableGapMinutes', availableGapMinutes: input.availableGapMinutes ?? UNKNOWN },
    warnings: [...(input.warnings ?? []), ...(feasible ? [] : ['TEMPORAL_CHAIN_IMPOSSIBLE'])],
    validForMinutes: input.validForMinutes ?? 30, inputHash: hash(input),
  };
}

export function assessCost(opportunity: Pick<NormalizedOpportunityValue, 'priceAmount'|'currencyCode'>, route: ReturnType<typeof assessRoute>, input: CostInput) {
  const revenue = opportunity.priceAmount ?? 0;
  const fuel = money(input.fuel); const train = money(input.train); const bus = money(input.bus); const taxi = money(input.taxi);
  const tolls = money(input.tolls); const accommodation = money(input.accommodation); const otherReposition = money(input.otherReposition);
  const totalCost = round(fuel + train + bus + taxi + tolls + accommodation + otherReposition);
  const grossProfit = round(revenue - totalCost);
  const totalKm = Math.max(1, route.distanceKm + route.repositionKm);
  const totalMinutes = route.durationMinutes + route.repositionMinutes;
  return {
    currencyCode: opportunity.currencyCode ?? UNKNOWN, estimatedRevenue: revenue, estimatedFuel: fuel, estimatedTrain: train,
    estimatedBus: bus, estimatedTaxi: taxi, estimatedTolls: tolls, estimatedAccommodation: accommodation,
    estimatedOtherReposition: otherReposition, estimatedTotalCost: totalCost, estimatedGrossProfit: grossProfit,
    estimatedProfitPerKm: round4(grossProfit / totalKm), estimatedProfitPerHour: round4(grossProfit / Math.max(totalMinutes / 60, 1 / 60)),
    totalMinutes, emptyKm: route.repositionKm,
    financialRisk: opportunity.priceAmount === undefined ? 'HIGH' : grossProfit < 0 ? 'HIGH' : grossProfit < revenue * .15 ? 'MEDIUM' : 'LOW',
    sensitivity: { fuelPlus10PercentProfit: round(grossProfit - fuel * .1) }, assumptions: input.assumptions ?? [],
    validForMinutes: input.validForMinutes ?? 30, inputHash: hash({ opportunity, route, input }),
  };
}

export function aggregateChain(segments: Array<{ opportunityId: string; route: ReturnType<typeof assessRoute>; cost: ReturnType<typeof assessCost> }>) {
  if (!segments.length || segments.length > 3) throw new Error('OPPORTUNITY_CHAIN_LENGTH_INVALID');
  const estimatedRevenue = sum(segments.map((item) => item.cost.estimatedRevenue));
  const estimatedTotalCost = sum(segments.map((item) => item.cost.estimatedTotalCost));
  const estimatedGrossProfit = round(estimatedRevenue - estimatedTotalCost);
  const totalKm = sum(segments.map((item) => item.route.distanceKm + item.route.repositionKm));
  const totalMinutes = sum(segments.map((item) => item.cost.totalMinutes));
  const emptyKm = sum(segments.map((item) => item.cost.emptyKm));
  return {
    opportunityIds: segments.map((item) => item.opportunityId), feasible: segments.every((item) => item.route.feasible),
    metrics: { estimatedRevenue, estimatedTotalCost, estimatedGrossProfit, estimatedProfitPerKm: round4(estimatedGrossProfit / Math.max(totalKm, 1)), estimatedProfitPerHour: round4(estimatedGrossProfit / Math.max(totalMinutes / 60, 1 / 60)), totalKm, totalMinutes, emptyKm, finalHomeDistanceKm: segments.at(-1)?.route.finalHomeDistanceKm ?? UNKNOWN },
    inputHash: hash(segments.map((item) => ({ opportunityId: item.opportunityId, route: item.route.inputHash, cost: item.cost.inputHash }))),
  };
}

export function judgeChain(chain: ReturnType<typeof aggregateChain>, freshnessStatus: 'FRESH'|'STALE') {
  const metrics = chain.metrics;
  let classification: 'RECOMMENDED'|'ACCEPTABLE'|'WEAK'|'REJECT';
  if (!chain.feasible || metrics.estimatedGrossProfit <= 0) classification = 'REJECT';
  else if (metrics.estimatedProfitPerHour >= 25 && metrics.estimatedProfitPerKm >= .5) classification = 'RECOMMENDED';
  else if (metrics.estimatedProfitPerHour >= 10 && metrics.estimatedProfitPerKm >= .2) classification = 'ACCEPTABLE';
  else classification = 'WEAK';
  return {
    classification, reasons: [chain.feasible ? 'TEMPORALLY_FEASIBLE' : 'TEMPORALLY_IMPOSSIBLE', `ESTIMATED_PROFIT_${metrics.estimatedGrossProfit}`],
    advantages: [metrics.emptyKm <= 50 ? 'LOW_EMPTY_KM' : 'CHAIN_CONTINUITY', metrics.finalHomeDistanceKm !== UNKNOWN ? 'HOME_PROXIMITY_KNOWN' : 'HOME_PROXIMITY_UNKNOWN'],
    risks: [...(freshnessStatus === 'STALE' ? ['STALE_RECALCULATION_REQUIRED'] : []), ...(classification === 'REJECT' ? ['COMMERCIAL_OR_TEMPORAL_RISK'] : [])],
    confidence: freshnessStatus === 'STALE' ? 50 : chain.feasible ? 85 : 95, freshnessStatus,
    assumptions: ['ESTIMATES_ONLY_NOT_ACCOUNTING'], inputHash: hash({ chain: chain.inputHash, freshnessStatus, classification }),
  };
}

export function opportunityCopilotProjection(verdicts: Array<{ classification: string; freshnessStatus: string; chain: { metrics: Record<string, unknown>; opportunityIds: string[] } }>) {
  const ranked = [...verdicts].sort((a, b) => Number(b.chain.metrics.estimatedGrossProfit ?? 0) - Number(a.chain.metrics.estimatedGrossProfit ?? 0));
  return {
    variantCount: ranked.length,
    variants: ranked.map((item, index) => ({ rank: index + 1, classification: item.classification, freshnessStatus: item.freshnessStatus, opportunityCount: item.chain.opportunityIds.length, estimatedProfit: item.chain.metrics.estimatedGrossProfit, emptyKm: item.chain.metrics.emptyKm, finalHomeDistanceKm: item.chain.metrics.finalHomeDistanceKm, recalculationRequired: item.freshnessStatus === 'STALE' })),
    recommendation: ranked.find((item) => item.classification === 'RECOMMENDED' && item.freshnessStatus === 'FRESH') ? 'BEST_FRESH_RECOMMENDED_VARIANT' : 'HUMAN_REVIEW_REQUIRED',
    canAcceptAutomatically: false,
  };
}

export function hash(value: unknown) { return createHash('sha256').update(stableStringify(value)).digest('hex'); }
function normalizeText(value: string | undefined, confirmation: boolean) { const clean = value?.trim(); return clean ? { value: clean, state: 'KNOWN' as const } : { value: confirmation ? NEEDS_CONFIRMATION : UNKNOWN, state: confirmation ? 'NEEDS_CONFIRMATION' as const : 'UNKNOWN' as const }; }
function optionalDate(value?: string) { return value ? validDate(value) : undefined; }
function validDate(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new Error('OPPORTUNITY_DATE_INVALID'); return date; }
function finite(value?: number) { return Number.isFinite(value) ? value : undefined; }
function positive(value: number) { if (!Number.isFinite(value) || value <= 0) throw new Error('OPPORTUNITY_ROUTE_VALUE_INVALID'); return Math.round(value); }
function clamp(value: number) { return Math.min(100, Math.max(0, Math.round(value))); }
function money(value?: number) { return round(Math.max(0, value ?? 0)); }
function round(value: number) { return Math.round(value * 100) / 100; }
function round4(value: number) { return Math.round(value * 10_000) / 10_000; }
function sum(values: number[]) { return round(values.reduce((total, value) => total + value, 0)); }
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
