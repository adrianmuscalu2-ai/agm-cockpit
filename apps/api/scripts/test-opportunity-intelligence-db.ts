import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AuditService } from '../src/audit/audit.service';
import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';
import { CarMoverService } from '../src/car-mover/car-mover.service';
import type { RequestContext } from '../src/common/request-context';
import { OpportunityIntelligenceService } from '../src/opportunity-intelligence/opportunity-intelligence.service';

type LeaseProof = { id: string; epoch: number; fencingToken: number; agentId: string; providerId: string };

async function main() {
  const prisma = new PrismaClient();
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) throw new Error('No local Company exists for Opportunity Intelligence runtime tests.');
  const user = await prisma.user.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: 'asc' } });
  if (!user) throw new Error('No local User exists for Opportunity Intelligence runtime tests.');
  const runId = `oi-runtime-${Date.now()}`;
  const ctx: RequestContext = { companyId: company.id, userId: user.id, roles: ['OWNER', 'PREMIUM_ACCESS'], requestId: randomUUID(), correlationId: randomUUID() };
  const audit = new AuditService(prisma as never);
  const authority = new AuthorityControlPlaneService(prisma as never);
  const carMover = new CarMoverService(prisma as never, audit);
  const intelligence = new OpportunityIntelligenceService(prisma as never, authority, carMover, audit);
  const leases: LeaseProof[] = [];
  try {
    await authority.dashboard(ctx);
    const routePrimary = await provision(authority, ctx, runId, 'route', 'premium.car-mover.route', 'premium.car-mover.route-mobility', 'opportunity.route.assess', 'openai-primary');
    leases.push(routePrimary);
    const routeSecondary = await authority.handoff({ previousLeaseId: routePrimary.id, reason: 'Opportunity runtime failover proof', leaseKey: `${runId}-route-secondary`, requestId: `${runId}-route-secondary-request`, mandateId: (await prisma.authorityLease.findUniqueOrThrow({ where: { id: routePrimary.id } })).mandateId, providerId: 'rules-engine', ttlSeconds: 900 }, ctx);
    leases.push(routeSecondary);

    let staleFencingRejected = false;
    try {
      await authority.validateWrite({ leaseId: routePrimary.id, epoch: routePrimary.epoch, fencingToken: routePrimary.fencingToken, command: 'opportunity.route.assess', scopeId: 'premium.car-mover.route' }, ctx);
    } catch { staleFencingRejected = true; }
    assert(staleFencingRejected, 'OI-21 stale provider response is rejected through fencing');
    assert(routeSecondary.agentId === routePrimary.agentId, 'OI-20 failover retains canonical AGM agent identity');

    const cost = await provision(authority, ctx, runId, 'cost', 'premium.car-mover.cost-risk', 'premium.car-mover.cost-risk', 'opportunity.cost.assess', 'openai-primary');
    const planner = await provision(authority, ctx, runId, 'planner', 'premium.car-mover.opportunity.planning', 'premium.car-mover.opportunity-planner', 'opportunity.chain.plan', 'openai-primary');
    const judge = await provision(authority, ctx, runId, 'judge', 'premium.car-mover.opportunity.judgement', 'premium.car-mover.opportunity-judge', 'opportunity.verdict.issue', 'openai-primary');
    leases.push(cost, planner, judge);

    const timestamp = new Date().toISOString();
    const intakeA = await intelligence.intake({ idempotencyKey: `${runId}-a-email`, channel: 'email', provider: 'gmail', platform: 'TIMOCOM', sourceOpportunityId: 'EMAIL-A', platformReference: 'REF-A', pickupLocation: 'Berlin', deliveryLocation: 'Hamburg', pickupWindowStart: timestamp, priceAmount: 500, currencyCode: 'EUR', vehicleType: 'Passenger car', sourceTimestamp: timestamp }, ctx);
    const intakeASameChannel = await intelligence.intake({ idempotencyKey: `${runId}-a-email-duplicate`, channel: 'email', provider: 'gmail', platform: 'TIMOCOM', sourceOpportunityId: 'EMAIL-A', platformReference: 'REF-A', pickupLocation: 'Berlin', deliveryLocation: 'Hamburg', pickupWindowStart: timestamp, priceAmount: 500, currencyCode: 'EUR', vehicleType: 'Passenger car', sourceTimestamp: timestamp }, ctx);
    assert(intakeA.normalizedOpportunityId === intakeASameChannel.normalizedOpportunityId && intakeASameChannel.deduplicated, 'OI-02 same-channel duplicate persists as one normalized opportunity');
    const intakeADuplicate = await intelligence.intake({ idempotencyKey: `${runId}-a-whatsapp`, channel: 'whatsapp', provider: 'whatsapp', platform: 'TIMOCOM', sourceOpportunityId: 'WA-A', platformReference: 'WA-REF-A', pickupLocation: 'Berlin', deliveryLocation: 'Hamburg', pickupWindowStart: timestamp, priceAmount: 500, currencyCode: 'EUR', vehicleType: 'Passenger car', sourceTimestamp: timestamp }, ctx);
    assert(intakeA.normalizedOpportunityId === intakeADuplicate.normalizedOpportunityId && intakeADuplicate.correlatedAcrossChannels, 'OI-03 cross-channel duplicate persists as one normalized opportunity');
    const intakeB = await intelligence.intake({ idempotencyKey: `${runId}-b`, channel: 'webhook', provider: 'platform-api', platform: 'TRANS.EU', sourceOpportunityId: 'B', pickupLocation: 'Hamburg', deliveryLocation: 'Bremen', pickupWindowStart: timestamp, priceAmount: 420, currencyCode: 'EUR', vehicleType: 'Passenger car', sourceTimestamp: timestamp }, ctx);
    const intakeC = await intelligence.intake({ idempotencyKey: `${runId}-c`, channel: 'email', provider: 'gmail', platform: 'TIMOCOM', sourceOpportunityId: 'C', pickupLocation: 'Bremen', deliveryLocation: 'Hannover', pickupWindowStart: timestamp, priceAmount: 390, currencyCode: 'EUR', vehicleType: 'Passenger car', sourceTimestamp: timestamp }, ctx);

    const financialBefore = await prisma.carMoverFinancialEntry.count({ where: { companyId: company.id } });
    const invoicesBefore = await prisma.carMoverInvoice.count({ where: { companyId: company.id } });
    const authorityProofs = {
      routeAuthority: proof(routeSecondary), costAuthority: proof(cost), plannerAuthority: proof(planner), judgeAuthority: proof(judge),
    };
    const variants = [
      variant(`${runId}-single`, [intakeA.normalizedOpportunityId!], [{ distanceKm: 290, durationMinutes: 210, distanceToPickupKm: 22, repositionKm: 22, repositionMinutes: 25, availableGapMinutes: 90, finalHomeDistanceKm: 170 }]),
      variant(`${runId}-pair`, [intakeA.normalizedOpportunityId!, intakeB.normalizedOpportunityId!], [{ distanceKm: 290, durationMinutes: 210, distanceToPickupKm: 22, repositionKm: 22, repositionMinutes: 25, availableGapMinutes: 90 }, { distanceKm: 120, durationMinutes: 95, distanceToPickupKm: 9, repositionKm: 9, repositionMinutes: 12, availableGapMinutes: 60, finalHomeDistanceKm: 135 }]),
      variant(`${runId}-triple`, [intakeA.normalizedOpportunityId!, intakeB.normalizedOpportunityId!, intakeC.normalizedOpportunityId!], [{ distanceKm: 290, durationMinutes: 210, distanceToPickupKm: 22, repositionKm: 22, repositionMinutes: 25, availableGapMinutes: 90 }, { distanceKm: 120, durationMinutes: 95, distanceToPickupKm: 9, repositionKm: 9, repositionMinutes: 12, availableGapMinutes: 60 }, { distanceKm: 130, durationMinutes: 100, distanceToPickupKm: 12, repositionKm: 12, repositionMinutes: 15, availableGapMinutes: 75, finalHomeDistanceKm: 58 }]),
      variant(`${runId}-impossible`, [intakeA.normalizedOpportunityId!, intakeB.normalizedOpportunityId!], [{ distanceKm: 290, durationMinutes: 210, distanceToPickupKm: 22, repositionKm: 22, repositionMinutes: 25, availableGapMinutes: 90 }, { distanceKm: 120, durationMinutes: 95, distanceToPickupKm: 120, repositionKm: 120, repositionMinutes: 150, availableGapMinutes: 20 }]),
    ];
    const firstRun = await intelligence.analyze({ idempotencyKey: `${runId}-analysis-v1`, variants, ...authorityProofs }, ctx);
    const secondRun = await intelligence.analyze({ idempotencyKey: `${runId}-analysis-v2`, variants: [variants[0]], ...authorityProofs }, ctx);
    const firstSingle = firstRun.chains.find((item) => item.chainKey === `${runId}-single`);
    const secondSingle = secondRun.chains.find((item) => item.chainKey === `${runId}-single`);
    assert(Boolean(firstSingle && secondSingle && secondSingle.id !== firstSingle.id && secondSingle.version === firstSingle.version + 1), 'OI-16 a new verdict/analysis creates a new immutable version');
    const impossibleVerdict = firstRun.verdicts.find((item) => firstRun.chains.find((chain) => chain.id === item.chainId)?.chainKey === `${runId}-impossible`);
    assert(impossibleVerdict?.classification === 'REJECT', 'temporally impossible runtime chain is rejected');
    assert(await prisma.carMoverFinancialEntry.count({ where: { companyId: company.id } }) === financialBefore, 'Cost & Risk does not write real financial entries');
    assert(await prisma.carMoverInvoice.count({ where: { companyId: company.id } }) === invoicesBefore, 'Cost & Risk does not write invoices');

    const acceptableVerdict = firstRun.verdicts.find((item) => item.classification !== 'REJECT');
    assert(acceptableVerdict, 'at least one actionable verdict exists');
    const accepted = await intelligence.decide(acceptableVerdict.id, { decisionKey: `${runId}-human-accept`, decision: 'ACCEPT', reason: 'Explicit runtime test acceptance' }, ctx);
    assert(accepted.createdOnlyAfterHumanDecision && accepted.jobLinks.length > 0, 'OI-19 explicit human acceptance creates and links Job File');
    const jobFile = await carMover.getJobFile(accepted.jobLinks[0].jobId, ctx);
    assert(jobFile.job.id === accepted.jobLinks[0].jobId, 'accepted Opportunity is linked to an operational Job File');

    const manual = await carMover.create({ vehicle: { vehicleClass: 'OTHER_DRIVABLE_VEHICLE', vehicleType: 'Manual fallback test vehicle' }, pickup: { label: 'Manual pickup' }, destination: { label: 'Manual destination' }, sourceReference: `${runId}-manual-fallback` }, ctx);
    const manualFile = await carMover.getJobFile(manual.jobId, ctx);
    assert(manualFile.job.id === manual.jobId, 'OI-22 Car Mover manual flow remains operational independently');

    const telemetry = await intelligence.telemetrySnapshot(ctx);
    assert(['premium.car-mover.route-mobility', 'premium.car-mover.cost-risk', 'premium.car-mover.opportunity-planner', 'premium.car-mover.opportunity-judge'].every((agentId) => telemetry.some((item) => item.agentId === agentId && item.health === 'PASS')), 'mandatory Opportunity agent telemetry is persisted');
    const dashboard = await authority.dashboard(ctx);
    assert(dashboard.nodes.some((node) => node.canonicalId === 'premium.car-mover.route-mobility' && node.telemetry), 'technical telemetry is visible in Premium Agent Network');

    const report = {
      verdict: 'PASS', runId,
      scenarios: {
        '2': 'PASS — same-channel duplicate persisted as one normalized opportunity',
        '3': 'PASS — cross-channel duplicate correlated to the same normalized opportunity',
        '16': 'PASS — new immutable chain/verdict version persisted',
        '19': `PASS — ${accepted.jobLinks.length} Job File link(s) created only after human ACCEPT`,
        '20': `PASS — ${routePrimary.agentId} identity retained across ${routePrimary.providerId} → ${routeSecondary.providerId}`,
        '21': 'PASS — stale provider response rejected by epoch/fencing boundary',
        '22': `PASS — manual Car Mover Job File ${manual.jobId} operational independently`,
      },
      evidence: { firstChainId: firstSingle?.id, versionedChainId: secondSingle?.id, acceptedDecisionId: accepted.decision.id, authorityEpoch: routeSecondary.epoch, authorityFencingToken: routeSecondary.fencingToken, telemetryAgents: telemetry.map((item) => item.agentId) },
    };
    const reportDirectory = path.resolve(__dirname, '../../../evidence/opportunity-intelligence/runtime', runId);
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(path.join(reportDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ ...report, reportPath: path.join(reportDirectory, 'report.json') }, null, 2));
  } finally {
    for (const lease of leases.reverse()) {
      try { await authority.revokeLease(lease.id, 'Opportunity runtime test complete', ctx); } catch { /* already revoked or never activated */ }
    }
    await prisma.$disconnect();
  }
}

async function provision(authority: AuthorityControlPlaneService, ctx: RequestContext, runId: string, key: string, scopeId: string, agentId: string, command: string, providerId: string): Promise<LeaseProof> {
  const mandate = await authority.createMandate({ mandateKey: `${runId}-${key}-mandate`, scopeId, agentId, mode: 'EXECUTIVE', readSet: ['opportunity.read'], writeSet: [command], resourceSelectors: [], prohibitedActions: ['car-mover.job.create', 'accounting.write', 'commercial.auto-accept'] }, ctx);
  const decision = await authority.createDecision({ decisionKey: `${runId}-${key}-decision`, mandateId: mandate.id, actionType: 'OPPORTUNITY_ANALYSIS', decision: { approved: true, humanApprovedAuthority: true } }, ctx);
  return authority.issueLease({ leaseKey: `${runId}-${key}-lease`, requestId: `${runId}-${key}-request`, mandateId: mandate.id, decisionId: decision.id, providerId, ttlSeconds: 900 }, ctx);
}

function proof(lease: LeaseProof) { return { leaseId: lease.id, epoch: lease.epoch, fencingToken: lease.fencingToken }; }

function variant(variantKey: string, ids: string[], routes: Array<{ distanceKm: number; durationMinutes: number; distanceToPickupKm: number; repositionKm: number; repositionMinutes: number; availableGapMinutes: number; finalHomeDistanceKm?: number }>) {
  return { variantKey, objective: 'BALANCED', segments: ids.map((opportunityId, index) => ({ opportunityId, route: { ...routes[index], mobilityModes: index === 1 ? ['TRAIN', 'ROAD'] : ['ROAD'], tolls: [{ label: 'estimated toll', amount: 12, currencyCode: 'EUR' }], sources: ['controlled-runtime-map:v1'], assumptions: ['CONTROLLED_TEST_ROUTE'], confidence: 90, validForMinutes: 30 }, cost: { fuel: 48, train: index === 1 ? 24 : 0, tolls: 12, otherReposition: 8, assumptions: ['ESTIMATE_ONLY'], validForMinutes: 30 } })) };
}

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Opportunity Intelligence runtime test failed: ${message}`); }

void main();
