import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorityControlPlaneService } from '../authority-control-plane/authority-control-plane.service';
import { CarMoverService } from '../car-mover/car-mover.service';
import { AuditService } from '../audit/audit.service';
import type { AnalyzeOpportunityDto, AuthorityProofDto, DecideOpportunityDto, IntakeOpportunityDto } from './opportunity-intelligence.dto';
import { aggregateChain, assessCost, assessRoute, hash, judgeChain, normalizeOpportunity, OPPORTUNITY_CONTRACT_VERSION, opportunityCopilotProjection, type NormalizedOpportunityValue } from './opportunity-intelligence.engine';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const REQUIRED_ROLE = 'PREMIUM_ACCESS';

@Injectable()
export class OpportunityIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authority: AuthorityControlPlaneService,
    private readonly carMover: CarMoverService,
    private readonly audit: AuditService,
  ) {}

  async intake(dto: IntakeOpportunityDto, ctx: RequestContext) {
    this.authorize(ctx);
    const started = Date.now();
    const raw = this.raw(dto);
    const normalized = normalizeOpportunity(raw);
    const existingRequest = await this.prisma.opportunityIntakeRecord.findUnique({ where: { companyId_idempotencyKey: { companyId: ctx.companyId, idempotencyKey: dto.idempotencyKey } } });
    if (existingRequest) {
      if (existingRequest.inputHash !== normalized.inputHash) throw new ConflictException('OPPORTUNITY_IDEMPOTENCY_REUSE_MISMATCH');
      await Promise.all([
        this.telemetry(ctx.companyId, 'premium.car-mover.intake-dedup', dto.provider, Date.now() - started, existingRequest.id, 100),
        this.telemetry(ctx.companyId, 'premium.car-mover.opportunity-normalizer', 'deterministic-normalizer', Date.now() - started, existingRequest.normalizedOpportunityId ?? undefined, 100),
      ]);
      return { intakeId: existingRequest.id, normalizedOpportunityId: existingRequest.normalizedOpportunityId, deduplicated: true, correlatedAcrossChannels: false, freshnessStatus: existingRequest.freshnessStatus };
    }
    const correlated = await this.prisma.normalizedOpportunity.findFirst({ where: { companyId: ctx.companyId, canonicalKey: normalized.correlationKey, status: { in: ['AVAILABLE','REVIEWED'] } }, orderBy: { version: 'desc' } });
    const result = await this.prisma.$transaction(async (tx) => {
      let opportunity = correlated;
      const reference = { channel: dto.channel, provider: dto.provider, platformReference: dto.platformReference ?? null, idempotencyKey: dto.idempotencyKey, sourceTimestamp: dto.sourceTimestamp, inputHash: normalized.inputHash };
      if (!opportunity) {
        opportunity = await tx.normalizedOpportunity.create({ data: {
          companyId: ctx.companyId, canonicalKey: normalized.correlationKey, platform: normalized.platform,
          sourceOpportunityId: normalized.sourceOpportunityId, pickupLocation: json(normalized.pickupLocation), deliveryLocation: json(normalized.deliveryLocation),
          pickupWindowStart: normalized.pickupWindowStart, pickupWindowEnd: normalized.pickupWindowEnd, deliveryWindowStart: normalized.deliveryWindowStart, deliveryWindowEnd: normalized.deliveryWindowEnd,
          priceAmount: normalized.priceAmount === undefined ? undefined : new Prisma.Decimal(normalized.priceAmount), currencyCode: normalized.currencyCode,
          declaredKm: normalized.declaredKm === undefined ? undefined : Math.round(normalized.declaredKm), vehicle: json(normalized.vehicle), conditions: json(normalized.conditions), notes: normalized.notes,
          sourceTimestamp: normalized.sourceTimestamp, freshnessStatus: normalized.freshnessStatus, fieldConfidence: json(normalized.fieldConfidence), sourceReferences: json([reference]), inputHash: normalized.inputHash,
        } });
      } else {
        const refs = Array.isArray(opportunity.sourceReferences) ? opportunity.sourceReferences : [];
        opportunity = await tx.normalizedOpportunity.update({ where: { id: opportunity.id }, data: { sourceReferences: json([...refs, reference]), updatedAt: new Date() } });
      }
      const intake = await tx.opportunityIntakeRecord.create({ data: {
        companyId: ctx.companyId, idempotencyKey: dto.idempotencyKey, channel: dto.channel, provider: dto.provider,
        platformReference: dto.platformReference, sourceOpportunityId: dto.sourceOpportunityId, sourceTimestamp: normalized.sourceTimestamp,
        inputHash: normalized.inputHash, correlationKey: normalized.correlationKey, freshnessStatus: normalized.freshnessStatus,
        rawPayload: dto.retainRawPayload && dto.rawPayload ? json(dto.rawPayload) : undefined,
        rawPayloadRetentionUntil: dto.retainRawPayload ? new Date(Date.now() + 7 * 86_400_000) : undefined,
        normalizedOpportunityId: opportunity.id, status: correlated ? 'CORRELATED' : 'INGESTED',
      } });
      return { intakeId: intake.id, normalizedOpportunityId: opportunity.id, deduplicated: Boolean(correlated), correlatedAcrossChannels: Boolean(correlated && dto.channel !== firstReferenceChannel(correlated.sourceReferences)), freshnessStatus: normalized.freshnessStatus };
    });
    await this.audit.create({ actionCode: 'OPPORTUNITY_INTAKE_RECORDED', entityType: 'OpportunityIntakeRecord', entityId: result.intakeId, metadata: { normalizedOpportunityId: result.normalizedOpportunityId, deduplicated: result.deduplicated, freshnessStatus: result.freshnessStatus }, productId: 'agm-car-mover', moduleId: 'opportunity-intelligence' }, ctx);
    await Promise.all([
      this.telemetry(ctx.companyId, 'premium.car-mover.intake-dedup', dto.provider, Date.now() - started, result.intakeId, 100),
      this.telemetry(ctx.companyId, 'premium.car-mover.opportunity-normalizer', 'deterministic-normalizer', Date.now() - started, result.normalizedOpportunityId, 100),
    ]);
    return result;
  }

  async importExistingOffers(ctx: RequestContext) {
    this.authorize(ctx);
    const offers = await this.prisma.carMoverPlatformOffer.findMany({ where: { companyId: ctx.companyId, status: { in: ['NEW','REVIEWED'] } }, orderBy: { createdAt: 'asc' }, take: 200 });
    let ingested = 0; let duplicates = 0;
    for (const offer of offers) {
      const result = await this.intake({
        idempotencyKey: `car-mover-platform-offer:${offer.id}:v${offer.version}`, channel: offer.channel as 'email'|'whatsapp', provider: offer.platformName,
        platformReference: offer.externalReference ?? offer.id, sourceOpportunityId: offer.externalReference ?? offer.id, platform: offer.platformName,
        pickupLocation: offer.pickupLabel ?? undefined, deliveryLocation: offer.destinationLabel ?? undefined,
        pickupWindowStart: offer.pickupAt?.toISOString(), priceAmount: offer.offeredAmount ? Number(offer.offeredAmount) : undefined,
        currencyCode: offer.currencyCode ?? undefined, declaredKm: offer.estimatedKm ?? undefined, vehicleType: offer.vehicleDescription ?? undefined,
        sourceTimestamp: offer.createdAt.toISOString(), retainRawPayload: false,
      }, ctx);
      if (result.deduplicated) duplicates += 1; else ingested += 1;
    }
    return { scanned: offers.length, ingested, duplicates, sources: ['CarMoverPlatformOffer','Gmail','WhatsApp'], automaticAcceptance: false };
  }

  async list(ctx: RequestContext) {
    this.authorize(ctx);
    return this.prisma.normalizedOpportunity.findMany({ where: { companyId: ctx.companyId }, orderBy: { updatedAt: 'desc' } });
  }

  async analyze(dto: AnalyzeOpportunityDto, ctx: RequestContext) {
    this.authorize(ctx);
    const inputHash = hash(dto);
    const existing = await this.prisma.opportunityAnalysisRun.findUnique({ where: { companyId_idempotencyKey: { companyId: ctx.companyId, idempotencyKey: dto.idempotencyKey } } });
    if (existing) {
      if (existing.inputHash !== inputHash) throw new ConflictException('OPPORTUNITY_ANALYSIS_IDEMPOTENCY_REUSE_MISMATCH');
      return this.readRun(existing.chainIds, existing.verdictIds, ctx.companyId, true);
    }
    const routeAuthority = await this.validateAgent(dto.routeAuthority, 'opportunity.route.assess', 'premium.car-mover.route', 'premium.car-mover.route-mobility', ctx);
    const costAuthority = await this.validateAgent(dto.costAuthority, 'opportunity.cost.assess', 'premium.car-mover.cost-risk', 'premium.car-mover.cost-risk', ctx);
    const plannerAuthority = await this.validateAgent(dto.plannerAuthority, 'opportunity.chain.plan', 'premium.car-mover.opportunity.planning', 'premium.car-mover.opportunity-planner', ctx);
    const judgeAuthority = await this.validateAgent(dto.judgeAuthority, 'opportunity.verdict.issue', 'premium.car-mover.opportunity.judgement', 'premium.car-mover.opportunity-judge', ctx);
    const started = Date.now();
    const chainIds: string[] = []; const verdictIds: string[] = [];
    for (const variant of dto.variants) {
      const ids = variant.segments.map((segment) => segment.opportunityId);
      if (new Set(ids).size !== ids.length) throw new BadRequestException('OPPORTUNITY_CHAIN_DUPLICATE_MEMBER');
      const opportunities = await this.prisma.normalizedOpportunity.findMany({ where: { companyId: ctx.companyId, id: { in: ids }, status: { in: ['AVAILABLE','REVIEWED'] } } });
      if (opportunities.length !== ids.length) throw new NotFoundException('OPPORTUNITY_CHAIN_MEMBER_NOT_FOUND');
      const byId = new Map(opportunities.map((item) => [item.id, item]));
      const analyzed: Array<{ opportunityId: string; route: ReturnType<typeof assessRoute>; cost: ReturnType<typeof assessCost>; routeId: string; costId: string }> = [];
      for (let index = 0; index < variant.segments.length; index += 1) {
        const segment = variant.segments[index]; const opportunity = byId.get(segment.opportunityId)!;
        const normalized = normalizedFromRecord(opportunity);
        const route = assessRoute(segment.route);
        const routeKey = `${variant.variantKey}:${index}:${segment.opportunityId}`;
        const routeVersion = await this.nextRouteVersion(ctx.companyId, routeKey);
        const calculatedAt = new Date(); const routeAssessmentId = randomUUID();
        const routeRecord = await this.prisma.opportunityRouteAssessment.create({ data: {
          companyId: ctx.companyId, routeAssessmentId, assessmentKey: routeKey, version: routeVersion, opportunityId: opportunity.id,
          previousOpportunityId: index ? variant.segments[index - 1].opportunityId : undefined, providerId: routeAuthority.providerId,
          authorityLeaseId: routeAuthority.leaseId, epoch: routeAuthority.epoch, fencingToken: routeAuthority.fencingToken,
          distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, distanceToPickupKm: route.distanceToPickupKm,
          repositionKm: route.repositionKm, repositionMinutes: route.repositionMinutes, mobilityModes: json(route.mobilityModes), tolls: json(route.tolls),
          restrictions: json(route.restrictions), finalHomeDistanceKm: route.finalHomeDistanceKm, feasible: route.feasible, sources: json(route.sources),
          assumptions: json(route.assumptions), confidence: route.confidence, calculation: json(route.calculation), warnings: json(route.warnings), inputHash: route.inputHash,
          calculatedAt, validUntil: new Date(calculatedAt.getTime() + route.validForMinutes * 60_000),
        } });
        const cost = assessCost(normalized, route, segment.cost);
        const costKey = `${variant.variantKey}:${index}:${segment.opportunityId}`; const costVersion = await this.nextCostVersion(ctx.companyId, costKey);
        const costAt = new Date(); const costAssessmentId = randomUUID();
        const costRecord = await this.prisma.opportunityCostAssessment.create({ data: {
          companyId: ctx.companyId, costAssessmentId, assessmentKey: costKey, version: costVersion, opportunityId: opportunity.id,
          routeAssessmentId: routeRecord.routeAssessmentId, providerId: costAuthority.providerId, authorityLeaseId: costAuthority.leaseId,
          epoch: costAuthority.epoch, fencingToken: costAuthority.fencingToken, currencyCode: cost.currencyCode,
          estimatedRevenue: cost.estimatedRevenue, estimatedFuel: cost.estimatedFuel, estimatedTrain: cost.estimatedTrain,
          estimatedBus: cost.estimatedBus, estimatedTaxi: cost.estimatedTaxi, estimatedTolls: cost.estimatedTolls,
          estimatedAccommodation: cost.estimatedAccommodation, estimatedOtherReposition: cost.estimatedOtherReposition,
          estimatedTotalCost: cost.estimatedTotalCost, estimatedGrossProfit: cost.estimatedGrossProfit,
          estimatedProfitPerKm: cost.estimatedProfitPerKm, estimatedProfitPerHour: cost.estimatedProfitPerHour,
          totalMinutes: cost.totalMinutes, emptyKm: cost.emptyKm, financialRisk: cost.financialRisk,
          sensitivity: json(cost.sensitivity), assumptions: json(cost.assumptions), inputHash: cost.inputHash,
          calculatedAt: costAt, validUntil: new Date(costAt.getTime() + cost.validForMinutes * 60_000),
        } });
        analyzed.push({ opportunityId: opportunity.id, route, cost, routeId: routeRecord.routeAssessmentId, costId: costRecord.costAssessmentId });
      }
      const planned = aggregateChain(analyzed); const chainVersion = await this.nextChainVersion(ctx.companyId, variant.variantKey);
      const chain = await this.prisma.opportunityChain.create({ data: {
        companyId: ctx.companyId, chainKey: variant.variantKey, version: chainVersion, opportunityIds: json(planned.opportunityIds),
        routeAssessmentIds: json(analyzed.map((item) => item.routeId)), costAssessmentIds: json(analyzed.map((item) => item.costId)),
        providerId: plannerAuthority.providerId, authorityLeaseId: plannerAuthority.leaseId, epoch: plannerAuthority.epoch,
        fencingToken: plannerAuthority.fencingToken, objective: variant.objective ?? 'BALANCED', metrics: json(planned.metrics), feasible: planned.feasible, inputHash: planned.inputHash,
      } });
      const freshness = opportunities.every((item) => isFreshNow(item.sourceTimestamp)) ? 'FRESH' : 'STALE';
      const judged = judgeChain(planned, freshness); const verdictVersion = await this.nextVerdictVersion(ctx.companyId, variant.variantKey);
      const verdict = await this.prisma.opportunityVerdict.create({ data: {
        companyId: ctx.companyId, chainId: chain.id, version: verdictVersion, classification: judged.classification,
        reasons: json(judged.reasons), advantages: json(judged.advantages), risks: json(judged.risks), confidence: judged.confidence,
        freshnessStatus: judged.freshnessStatus, assumptions: json(judged.assumptions), routeAssessmentRefs: json(analyzed.map((item) => item.routeId)),
        costAssessmentRefs: json(analyzed.map((item) => item.costId)), contractVersion: OPPORTUNITY_CONTRACT_VERSION, inputHash: judged.inputHash,
        providerId: judgeAuthority.providerId, authorityLeaseId: judgeAuthority.leaseId, epoch: judgeAuthority.epoch, fencingToken: judgeAuthority.fencingToken,
      } });
      chainIds.push(chain.id); verdictIds.push(verdict.id);
    }
    await this.prisma.opportunityAnalysisRun.create({ data: { companyId: ctx.companyId, idempotencyKey: dto.idempotencyKey, inputHash, chainIds: json(chainIds), verdictIds: json(verdictIds) } });
    const duration = Date.now() - started;
    await Promise.all([
      this.telemetry(ctx.companyId, 'premium.car-mover.route-mobility', routeAuthority.providerId, duration, chainIds[0], 85),
      this.telemetry(ctx.companyId, 'premium.car-mover.cost-risk', costAuthority.providerId, duration, chainIds[0], 85),
      this.telemetry(ctx.companyId, 'premium.car-mover.opportunity-planner', plannerAuthority.providerId, duration, chainIds[0], 85),
      this.telemetry(ctx.companyId, 'premium.car-mover.opportunity-judge', judgeAuthority.providerId, duration, verdictIds[0], 85),
    ]);
    await this.audit.create({ actionCode: 'OPPORTUNITY_ANALYSIS_COMPLETED', entityType: 'OpportunityAnalysisRun', entityId: chainIds[0] ?? randomUUID(), metadata: { chainIds, verdictIds, automaticAcceptance: false, contractVersion: OPPORTUNITY_CONTRACT_VERSION }, productId: 'agm-car-mover', moduleId: 'opportunity-intelligence' }, ctx);
    return this.readRun(json(chainIds), json(verdictIds), ctx.companyId, false);
  }

  async planning(ctx: RequestContext) {
    this.authorize(ctx);
    const verdicts = await this.prisma.opportunityVerdict.findMany({ where: { companyId: ctx.companyId }, orderBy: { createdAt: 'desc' }, take: 50 });
    const [chains, decisions] = await Promise.all([
      this.prisma.opportunityChain.findMany({ where: { companyId: ctx.companyId, id: { in: verdicts.map((item) => item.chainId) } } }),
      this.prisma.opportunityHumanDecision.findMany({ where: { companyId: ctx.companyId, verdictId: { in: verdicts.map((item) => item.id) } }, orderBy: { decidedAt: 'desc' } }),
    ]);
    const byId = new Map(chains.map((item) => [item.id, item]));
    const decisionByVerdict = new Map(decisions.map((item) => [item.verdictId, item]));
    const routeIds = chains.flatMap((item) => stringArray(item.routeAssessmentIds));
    const routeAssessments = await this.prisma.opportunityRouteAssessment.findMany({ where: { companyId: ctx.companyId, routeAssessmentId: { in: routeIds } } });
    const routesById = new Map(routeAssessments.map((item) => [item.routeAssessmentId, item]));
    return verdicts.map((verdict) => {
      const chain = byId.get(verdict.chainId); const routes = chain ? stringArray(chain.routeAssessmentIds).map((id) => routesById.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item)) : [];
      return { verdict, chain, humanDecision: decisionByVerdict.get(verdict.id) ?? null, mobilitySummary: { sources: [...new Set(routes.flatMap((item) => stringArray(item.sources)))], distanceKm: routes.reduce((sum, item) => sum + item.distanceKm, 0), durationMinutes: routes.reduce((sum, item) => sum + item.durationMinutes, 0), repositionKm: routes.reduce((sum, item) => sum + item.repositionKm, 0), estimatedTolls: routes.flatMap((item) => Array.isArray(item.tolls) ? item.tolls : []), freshnessStatus: routes.every((item) => item.validUntil > new Date()) ? 'FRESH' : 'STALE', validUntil: routes.length ? new Date(Math.min(...routes.map((item) => item.validUntil.getTime()))).toISOString() : null, warnings: routes.flatMap((item) => stringArray(item.warnings)) } };
    }).filter((item) => item.chain);
  }

  async copilot(ctx: RequestContext) {
    const planning = await this.planning(ctx);
    const latest = new Map<string, (typeof planning)[number]>();
    for (const item of planning) if (item.chain && !latest.has(item.chain.chainKey)) latest.set(item.chain.chainKey, item);
    const projected = [...latest.values()].map((item) => ({ classification: item.verdict.classification, freshnessStatus: isFreshNow(item.verdict.createdAt) && item.verdict.freshnessStatus === 'FRESH' ? 'FRESH' : 'STALE', chain: { metrics: item.chain!.metrics as Record<string, unknown>, opportunityIds: stringArray(item.chain!.opportunityIds) } }));
    await this.telemetry(ctx.companyId, 'premium.copilot-gateway', 'agm-runtime', 0, projected[0]?.chain.opportunityIds[0], undefined);
    return opportunityCopilotProjection(projected);
  }

  async decide(verdictId: string, dto: DecideOpportunityDto, ctx: RequestContext) {
    this.authorize(ctx);
    const existing = await this.prisma.opportunityHumanDecision.findUnique({ where: { companyId_decisionKey: { companyId: ctx.companyId, decisionKey: dto.decisionKey } } });
    if (existing) return { decision: existing, jobLinks: await this.prisma.opportunityJobLink.findMany({ where: { companyId: ctx.companyId, humanDecisionId: existing.id } }), idempotent: true };
    const verdict = await this.prisma.opportunityVerdict.findFirst({ where: { id: verdictId, companyId: ctx.companyId } });
    if (!verdict) throw new NotFoundException('OPPORTUNITY_VERDICT_NOT_FOUND');
    const chain = await this.prisma.opportunityChain.findFirst({ where: { id: verdict.chainId, companyId: ctx.companyId } });
    if (!chain) throw new NotFoundException('OPPORTUNITY_CHAIN_NOT_FOUND');
    const routeIds = stringArray(chain.routeAssessmentIds);
    if (dto.decision === 'ACCEPT') {
      if (verdict.freshnessStatus !== 'FRESH' || verdict.classification === 'REJECT') throw new ConflictException('OPPORTUNITY_RECALCULATION_REQUIRED');
      const validRoutes = await this.prisma.opportunityRouteAssessment.count({ where: { companyId: ctx.companyId, routeAssessmentId: { in: routeIds }, validUntil: { gt: new Date() } } });
      if (validRoutes !== routeIds.length) throw new ConflictException('OPPORTUNITY_RECALCULATION_REQUIRED');
    }
    const decision = await this.prisma.opportunityHumanDecision.create({ data: { companyId: ctx.companyId, decisionKey: dto.decisionKey, verdictId, decision: dto.decision, decidedByUserId: ctx.userId, reason: dto.reason } });
    await this.audit.create({ actionCode: `OPPORTUNITY_${dto.decision}`, entityType: 'OpportunityHumanDecision', entityId: decision.id, reason: dto.reason, metadata: { verdictId, chainId: chain.id, automaticAcceptance: false }, productId: 'agm-car-mover', moduleId: 'opportunity-intelligence' }, ctx);
    if (dto.decision === 'REJECT') return { decision, jobLinks: [], automaticAcceptance: false };
    const opportunities = await this.prisma.normalizedOpportunity.findMany({ where: { companyId: ctx.companyId, id: { in: stringArray(chain.opportunityIds) } } });
    const byId = new Map(opportunities.map((item) => [item.id, item])); const links = [];
    for (const opportunityId of stringArray(chain.opportunityIds)) {
      const opportunity = byId.get(opportunityId); if (!opportunity) throw new NotFoundException('OPPORTUNITY_NOT_FOUND');
      const vehicle = opportunity.vehicle as Record<string, unknown>; const pickup = opportunity.pickupLocation as Record<string, unknown>; const delivery = opportunity.deliveryLocation as Record<string, unknown>;
      const sourceReference = `opportunity:${opportunity.id}:verdict:${verdict.id}`;
      let job = await this.prisma.carMoverJob.findFirst({ where: { companyId: ctx.companyId, productId: 'agm-car-mover', sourceType: 'manual', sourceReference } });
      if (!job) {
        const created = await this.carMover.create({ vehicle: { vehicleClass: 'OTHER_DRIVABLE_VEHICLE', vehicleType: String(vehicle.vehicleType ?? 'UNKNOWN'), vin: vehicle.vin === 'UNKNOWN' ? undefined : String(vehicle.vin), registration: vehicle.registration === 'UNKNOWN' ? undefined : String(vehicle.registration) }, pickup: { label: String(pickup.label ?? 'UNKNOWN') }, destination: { label: String(delivery.label ?? 'UNKNOWN') }, sourceReference }, ctx);
        job = await this.prisma.carMoverJob.findUniqueOrThrow({ where: { id: created.jobId } });
      }
      links.push(await this.prisma.opportunityJobLink.create({ data: { companyId: ctx.companyId, humanDecisionId: decision.id, verdictId: verdict.id, normalizedOpportunityId: opportunity.id, jobId: job.id } }));
      await this.prisma.normalizedOpportunity.update({ where: { id: opportunity.id }, data: { status: 'ACCEPTED' } });
    }
    return { decision, jobLinks: links, automaticAcceptance: false, createdOnlyAfterHumanDecision: true };
  }

  async telemetrySnapshot(ctx: RequestContext) { this.authorize(ctx); return this.prisma.opportunityAgentTelemetry.findMany({ where: { companyId: ctx.companyId }, orderBy: { agentId: 'asc' } }); }

  private authorize(ctx: RequestContext) { if (!ctx.roles.includes(REQUIRED_ROLE)) throw new ForbiddenException('Car Mover entitlement required.'); }
  private raw(dto: IntakeOpportunityDto) { return { platform: dto.platform, sourceOpportunityId: dto.sourceOpportunityId, platformReference: dto.platformReference, pickupLocation: dto.pickupLocation, deliveryLocation: dto.deliveryLocation, pickupWindowStart: dto.pickupWindowStart, pickupWindowEnd: dto.pickupWindowEnd, deliveryWindowStart: dto.deliveryWindowStart, deliveryWindowEnd: dto.deliveryWindowEnd, priceAmount: dto.priceAmount, currencyCode: dto.currencyCode, declaredKm: dto.declaredKm, vehicleType: dto.vehicleType, vin: dto.vin, registration: dto.registration, conditions: dto.conditions, notes: dto.notes, sourceTimestamp: dto.sourceTimestamp }; }
  private async validateAgent(proof: AuthorityProofDto, command: string, scopeId: string, agentId: string, ctx: RequestContext) { const result = await this.authority.validateWrite({ ...proof, command, scopeId }, ctx); if (result.agentId !== agentId) throw new ForbiddenException('OPPORTUNITY_AGENT_IDENTITY_MISMATCH'); return result; }
  private async nextRouteVersion(companyId: string, key: string) { return ((await this.prisma.opportunityRouteAssessment.findFirst({ where: { companyId, assessmentKey: key }, orderBy: { version: 'desc' } }))?.version ?? 0) + 1; }
  private async nextCostVersion(companyId: string, key: string) { return ((await this.prisma.opportunityCostAssessment.findFirst({ where: { companyId, assessmentKey: key }, orderBy: { version: 'desc' } }))?.version ?? 0) + 1; }
  private async nextChainVersion(companyId: string, key: string) { return ((await this.prisma.opportunityChain.findFirst({ where: { companyId, chainKey: key }, orderBy: { version: 'desc' } }))?.version ?? 0) + 1; }
  private async nextVerdictVersion(companyId: string, chainKey: string) { const chains = await this.prisma.opportunityChain.findMany({ where: { companyId, chainKey }, select: { id: true } }); return ((await this.prisma.opportunityVerdict.findFirst({ where: { companyId, chainId: { in: chains.map((item) => item.id) } }, orderBy: { version: 'desc' } }))?.version ?? 0) + 1; }
  private async readRun(chainValue: unknown, verdictValue: unknown, companyId: string, idempotent: boolean) { const chainIds = stringArray(chainValue); const verdictIds = stringArray(verdictValue); const [chains, verdicts] = await Promise.all([this.prisma.opportunityChain.findMany({ where: { companyId, id: { in: chainIds } } }), this.prisma.opportunityVerdict.findMany({ where: { companyId, id: { in: verdictIds } } })]); return { chains, verdicts, copilot: opportunityCopilotProjection(verdicts.map((verdict) => { const chain = chains.find((item) => item.id === verdict.chainId)!; return { classification: verdict.classification, freshnessStatus: verdict.freshnessStatus, chain: { metrics: chain.metrics as Record<string, unknown>, opportunityIds: stringArray(chain.opportunityIds) } }; })), idempotent, automaticAcceptance: false }; }
  private telemetry(companyId: string, agentId: string, providerId: string, durationMs: number, outputReference?: string, confidence?: number) { return this.prisma.opportunityAgentTelemetry.upsert({ where: { companyId_agentId: { companyId, agentId } }, create: { companyId, agentId, health: 'PASS', lastRunAt: new Date(), durationMs, freshnessStatus: 'FRESH', backlog: 0, dependencyHealth: 'PASS', confidence, outputReference, providerId, contractVersion: OPPORTUNITY_CONTRACT_VERSION }, update: { health: 'PASS', lastRunAt: new Date(), durationMs, freshnessStatus: 'FRESH', backlog: 0, dependencyHealth: 'PASS', confidence, outputReference, providerId, contractVersion: OPPORTUNITY_CONTRACT_VERSION } }); }
}

function normalizedFromRecord(value: { priceAmount: Prisma.Decimal|null; currencyCode: string|null }): Pick<NormalizedOpportunityValue, 'priceAmount'|'currencyCode'> { return { priceAmount: value.priceAmount ? Number(value.priceAmount) : undefined, currencyCode: value.currencyCode ?? undefined }; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function firstReferenceChannel(value: Prisma.JsonValue) { const first = Array.isArray(value) ? value[0] : undefined; return first && typeof first === 'object' && !Array.isArray(first) && typeof first.channel === 'string' ? first.channel : undefined; }
function isFreshNow(timestamp: Date) { return Date.now() - timestamp.getTime() <= 60 * 60_000; }
