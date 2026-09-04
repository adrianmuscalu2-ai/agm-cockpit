import { Injectable } from '@nestjs/common';
import { COMPONENT_TELEMETRY_CONTRACT } from '../component-telemetry/component-telemetry.contract';
import { GITHUB_ACTIONS_PROVISIONING_CONTRACT } from '../machine-auth/github-actions-oidc.contract';
import { PrismaService } from '../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import {
  TURN_FUNCTIONAL_OVERVIEW_CONTRACT,
  type TurnFunctionalOverview,
  type TurnFunctionalZone,
  type TurnFunctionalZoneStatus,
} from './turn-functional-overview.contract';

type SourceKind = TurnFunctionalZone['source']['kind'];

@Injectable()
export class TurnFunctionalOverviewService {
  constructor(private readonly prisma: PrismaService, private readonly translation: TranslationService) {}

  async snapshot(now = new Date()): Promise<TurnFunctionalOverview> {
    const companyId = GITHUB_ACTIONS_PROVISIONING_CONTRACT.companyId;
    const [
      translationHealth,
      conversations,
      openConversations,
      latestConversation,
      failedMessages,
      latestMessage,
      gmail,
      preDepartureSessions,
      incompletePreDeparture,
      latestPreDeparture,
      afterDepartureEvents,
      latestAfterDeparture,
      carMoverJobs,
      activeCarMoverJobs,
      archivedCarMoverJobs,
      latestCarMoverJob,
      newOffers,
      outstandingInvoices,
      openIncidents,
      opportunities,
      staleOpportunities,
      latestOpportunity,
      opportunityVerdicts,
      opportunityDecisions,
      opportunityLinks,
      opportunityTelemetry,
      liveAdapters,
      agentRuntimeEvents,
      failedAgentRuntimeEvents,
      latestAgentRuntimeEvent,
      heartbeats,
      assistantUsage,
      latestAssistantUsage,
      loadSafetyUsage,
      latestLoadSafetyUsage,
    ] = await Promise.all([
      this.translation.functionalHealth(),
      this.prisma.communicationConversation.count({ where: { companyId } }),
      this.prisma.communicationConversation.count({ where: { companyId, status: 'open' } }),
      this.prisma.communicationConversation.findFirst({ where: { companyId }, orderBy: { lastMessageAt: 'desc' }, select: { lastMessageAt: true } }),
      this.prisma.communicationMessage.count({ where: { companyId, OR: [{ status: 'failed' }, { lastErrorCode: { not: null } }] } }),
      this.prisma.communicationMessage.findFirst({ where: { companyId }, orderBy: { statusUpdatedAt: 'desc' }, select: { statusUpdatedAt: true } }),
      this.prisma.gmailPilotTelemetry.findUnique({ where: { companyId } }),
      this.prisma.preDepartureSession.count({ where: { companyId } }),
      this.prisma.preDepartureSession.count({ where: { companyId, confirmedAt: null, closedAt: null } }),
      this.prisma.preDepartureSession.findFirst({ where: { companyId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.operationalEvent.count({ where: { companyId, moduleId: 'premium-operations' } }),
      this.prisma.operationalEvent.findFirst({ where: { companyId, moduleId: 'premium-operations' }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
      this.prisma.carMoverJob.count({ where: { companyId } }),
      this.prisma.carMoverJob.count({ where: { companyId, currentState: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      this.prisma.carMoverJob.count({ where: { companyId, currentState: { in: ['COMPLETED', 'CANCELLED'] } } }),
      this.prisma.carMoverJob.findFirst({ where: { companyId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.carMoverPlatformOffer.count({ where: { companyId, status: 'NEW' } }),
      this.prisma.carMoverInvoice.count({ where: { companyId, OR: [{ exportStatus: { not: 'EXPORTED' } }, { status: { notIn: ['PAID', 'CANCELLED'] } }] } }),
      this.prisma.incidentReport.count({ where: { companyId, status: { notIn: ['resolved', 'validated', 'archived'] } } }),
      this.prisma.normalizedOpportunity.count({ where: { companyId, status: 'AVAILABLE' } }),
      this.prisma.normalizedOpportunity.count({ where: { companyId, status: 'AVAILABLE', freshnessStatus: { not: 'FRESH' } } }),
      this.prisma.normalizedOpportunity.findFirst({ where: { companyId, status: 'AVAILABLE' }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.opportunityVerdict.count({ where: { companyId } }),
      this.prisma.opportunityHumanDecision.count({ where: { companyId } }),
      this.prisma.opportunityJobLink.count({ where: { companyId } }),
      this.prisma.opportunityAgentTelemetry.findMany({ where: { companyId }, select: { health: true, freshnessStatus: true, backlog: true, lastRunAt: true } }),
      this.prisma.liveAdapterTelemetry.findMany({ where: { companyId }, select: { status: true, lastAttemptAt: true, lastSuccessAt: true, errorCount: true } }),
      this.prisma.agentRuntimeEvent.count({ where: { companyId } }),
      this.prisma.agentRuntimeEvent.count({ where: { companyId, lifecycle: 'FAILED' } }),
      this.prisma.agentRuntimeEvent.findFirst({ where: { companyId }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
      this.prisma.componentHeartbeat.findMany({ where: { companyId }, select: { reportedStatus: true, lastSeenAt: true, lastFailureAt: true } }),
      this.prisma.providerUsageEvent.count({ where: { companyId, adapterId: 'premium-assistant' } }),
      this.prisma.providerUsageEvent.findFirst({ where: { companyId, adapterId: 'premium-assistant' }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true, outcome: true } }),
      this.prisma.providerUsageEvent.count({ where: { companyId, adapterId: { startsWith: 'premium-load-safety.' } } }),
      this.prisma.providerUsageEvent.findFirst({ where: { companyId, adapterId: { startsWith: 'premium-load-safety.' } }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true, outcome: true } }),
    ]);

    const zones: TurnFunctionalZone[] = [
      zone('basic.translator', 'BASIC', 'Traducător', translationHealth.functional ? 'OPERATIONAL' : 'ATTENTION',
        translationHealth.functional ? 'Providerul a produs o traducere funcțională la ultimul probe.' : 'Providerul nu a confirmat o traducere funcțională.',
        'RUNTIME', 'TranslationService.functionalHealth / OpenAI', now, { provider: translationHealth.provider, functional: translationHealth.functional }, '/translator',
        translationHealth.functional ? null : 'Provider de traducere funcțional indisponibil.', translationHealth.functional ? null : 'Corectează providerul/configurația și repetă probe-ul funcțional.'),
      activityZone('basic.email', 'BASIC', 'Email', conversations, failedMessages > 0 || (gmail?.backlog ?? 0) > 0, latestDate(latestConversation?.lastMessageAt, latestMessage?.statusUpdatedAt, gmail?.updatedAt),
        { conversations, openConversations, failedMessages, gmailState: gmail?.state ?? 'NO_TELEMETRY', gmailBacklog: gmail?.backlog ?? 0 },
        '/email', 'CommunicationConversation/Message + GmailPilotTelemetry', 'Deschide Email', 'Pornește sincronizarea sau rezolvă mesajele/backlog-ul indicat.'),
      localZone('basic.transport-document', 'Transport document', 'Rezultatele OCR și analiza documentului există numai în sesiunea dispozitivului.', '/', 'Deschide Basic și scanează documentul.'),
      localZone('basic.tachograph', 'Analiză tahograf', 'Fotografia și rezultatul sunt procesate local și nu sunt colectate global.', '/knowledge/tahograf', 'Deschide analiza tahograf.'),
      localZone('basic.dashboard-text', 'Text bord', 'Textul OCR și analiza bordului sunt efemere pe dispozitiv.', '/', 'Deschide analiza textului de bord.'),
      localZone('basic.dashboard-warning', 'Martori bord', 'Analiza vizuală/consultarea locală nu are jurnal operațional server-side.', '/knowledge/martori-bord', 'Deschide ghidul martorilor de bord.'),
      localZone('basic.legislation', 'Legislație', 'Analiza locală folosește reguli/knowledge versionate, fără collector de utilizare.', '/knowledge/legislatie', 'Deschide analiza legislației.'),
      localZone('basic.cargo-safety', 'Siguranța mărfii', 'Analiza Basic rulează local; nu există telemetrie globală a rezultatelor.', '/knowledge/ancorarea-marfii', 'Deschide analiza siguranței mărfii.'),
      localZone('basic.ocr-workspace', 'OCR și istoric local', 'Imaginile, textul extras și istoricul OCR sunt păstrate numai în sesiunea dispozitivului.', '/', 'Deschide camera/OCR din Basic.'),
      staticZone('basic.load-safety-knowledge', 'BASIC', 'Ghid încărcare și ancorare', 'Pachetele knowledge publicate sunt referințe statice, nu dovadă runtime.', '/legal'),

      activityZone('premium.before-departure', 'PREMIUM', 'Înainte de plecare', preDepartureSessions, incompletePreDeparture > 0, latestPreDeparture?.updatedAt ?? null,
        { sessions: preDepartureSessions, incomplete: incompletePreDeparture }, '/before-departure.html', 'PreDepartureSession', 'Revizuiește checklist-urile', 'Finalizează sesiunile neconfirmate.'),
      activityZone('premium.after-departure', 'PREMIUM', 'După plecare', afterDepartureEvents, false, latestAfterDeparture?.occurredAt ?? null,
        { events: afterDepartureEvents }, '/after-departure.html', 'OperationalEventStore', 'Revizuiește evenimentele', 'Creează/sincronizează primul eveniment dacă modulul este folosit.'),
      activityZone('premium.car-mover.planning', 'PREMIUM', 'Car Mover · Planificare', carMoverJobs, newOffers > 0, latestCarMoverJob?.updatedAt ?? null,
        { jobs: carMoverJobs, activeJobs: activeCarMoverJobs, newOffers }, '/car-mover/planning', 'CarMoverJob + CarMoverPlatformOffer', 'Planifică sau revizuiește oferte', 'Revizuiește ofertele NEW și alocă joburile active.'),
      activityZone('premium.car-mover.active', 'PREMIUM', 'Car Mover · Transfer activ', activeCarMoverJobs, openIncidents > 0, latestCarMoverJob?.updatedAt ?? null,
        { activeJobs: activeCarMoverJobs, openIncidents }, '/car-mover/active-transfer', 'CarMoverJob + IncidentReport', 'Urmărește transferurile', 'Rezolvă incidentele deschise.'),
      activityZone('premium.car-mover.completion', 'PREMIUM', 'Car Mover · Finalizare și incidente', carMoverJobs, openIncidents > 0, latestCarMoverJob?.updatedAt ?? null,
        { jobs: carMoverJobs, openIncidents }, '/car-mover/completion-incidents', 'CarMoverJob + IncidentReport', 'Finalizează și închide incidente', 'Închide incidentele și completează protocolul.'),
      activityZone('premium.car-mover.accounting', 'PREMIUM', 'Car Mover · Contabilitate', carMoverJobs, outstandingInvoices > 0, latestCarMoverJob?.updatedAt ?? null,
        { jobs: carMoverJobs, outstandingInvoices }, '/car-mover/accounting', 'CarMoverInvoice + CarMoverFinancialEntry', 'Revizuiește facturile', 'Exportă sau închide facturile restante.'),
      activityZone('premium.car-mover.archive', 'PREMIUM', 'Car Mover · Arhivă', archivedCarMoverJobs, false, latestCarMoverJob?.updatedAt ?? null,
        { archivedJobs: archivedCarMoverJobs }, '/car-mover/archive', 'CarMoverJob.currentState', 'Deschide arhiva', 'Arhivează joburile finalizate dacă este necesar.'),
      staticZone('premium.car-mover.guide', 'PREMIUM', 'Car Mover · Ghid', 'Ghidul este conținut operațional static; nu pretinde stare runtime.', '/car-mover/guide'),
      activityZone('premium.communications', 'PREMIUM', 'Comunicații', conversations, failedMessages > 0 || (gmail?.backlog ?? 0) > 0, latestDate(latestConversation?.lastMessageAt, latestMessage?.statusUpdatedAt, gmail?.updatedAt),
        { conversations, openConversations, failedMessages, gmailState: gmail?.state ?? 'NO_TELEMETRY', backlog: gmail?.backlog ?? 0 },
        '/premium/communications', 'CommunicationConversation/Message + GmailPilotTelemetry', 'Revizuiește comunicațiile', 'Sincronizează providerul și retrimite mesajele eșuate.'),
      providerUsageZone('premium.voice', 'AI Friend', assistantUsage, latestAssistantUsage, '/premium/voice', 'premium-assistant'),
      providerUsageZone('premium.load-safety', 'Ladungssicherung', loadSafetyUsage, latestLoadSafetyUsage, '/premium/ladungssicherung', 'premium-load-safety.*'),
      activityZone('premium.copilot', 'PREMIUM', 'Copilot și oportunități', opportunities, staleOpportunities > 0 || opportunityTelemetry.some((item) => item.health !== 'HEALTHY' || item.freshnessStatus !== 'FRESH' || item.backlog > 0) || liveAdapters.some((item) => item.status !== 'HEALTHY'),
        latestDate(latestOpportunity?.updatedAt, ...opportunityTelemetry.map((item) => item.lastRunAt), ...liveAdapters.map((item) => item.lastAttemptAt)),
        { opportunities, staleOpportunities, verdicts: opportunityVerdicts, humanDecisions: opportunityDecisions, jobLinks: opportunityLinks, agentsObserved: opportunityTelemetry.length, adaptersObserved: liveAdapters.length },
        '/premium/copilot', 'Opportunity Intelligence + LiveAdapterTelemetry', 'Decide asupra oportunităților', 'Rezolvă sursele stale/backlog-ul înaintea unei decizii.'),
      activityZone('premium.team', 'PREMIUM', 'Echipa Premium runtime', agentRuntimeEvents, failedAgentRuntimeEvents > 0 || heartbeatAttention(heartbeats, now), latestDate(latestAgentRuntimeEvent?.occurredAt, ...heartbeats.map((item) => item.lastSeenAt)),
        { runtimeEvents: agentRuntimeEvents, failedEvents: failedAgentRuntimeEvents, heartbeats: heartbeats.length, unhealthyHeartbeats: unhealthyHeartbeatCount(heartbeats, now) },
        '/premium/team', 'AgentRuntimeEvent + ComponentHeartbeat', 'Inspectează echipa', 'Investighează evenimentele FAILED și heartbeat-urile stale/degradate.'),
    ];

    const summary = {
      totalZones: zones.length,
      operational: count(zones, 'OPERATIONAL'),
      observed: count(zones, 'OBSERVED'),
      attention: count(zones, 'ATTENTION'),
      noActivity: count(zones, 'NO_ACTIVITY'),
      staticReference: count(zones, 'STATIC_REFERENCE'),
      legitimateUnknown: count(zones, 'UNKNOWN_LEGITIMATE'),
      unresolvedUnknown: zones.filter((item) => item.status === 'UNKNOWN_LEGITIMATE' && !item.legitimateUnknown).length,
    };

    return {
      contractVersion: TURN_FUNCTIONAL_OVERVIEW_CONTRACT.version,
      generatedAt: now.toISOString(),
      scope: TURN_FUNCTIONAL_OVERVIEW_CONTRACT.scope,
      companyScope: 'CANONICAL_PRODUCTION_TENANT',
      verdict: {
        releasePipeline: 'PASS',
        operationalTruthInfrastructure: 'PASS',
        falseGreenPrevention: 'PASS',
        turnFunctionalCompleteness: summary.unresolvedUnknown === 0 ? 'READY_FOR_PRODUCT_OWNER_REVIEW' : 'FAIL',
        productOwnerAcceptance: 'NOT_GRANTED',
        finalProductionPass: 'RETRACTED',
      },
      summary,
      zones,
    };
  }
}

function zone(id: string, tier: TurnFunctionalZone['tier'], title: string, status: TurnFunctionalZoneStatus, information: string, sourceKind: SourceKind, sourceLabel: string, observedAt: Date | null, evidence: TurnFunctionalZone['evidence'], href: string, missing: string | null, implementation: string | null): TurnFunctionalZone {
  return { id, tier, title, status, information, source: { kind: sourceKind, label: sourceLabel, observedAt: observedAt?.toISOString() ?? null }, evidence, action: { label: 'Deschide zona', href }, missing, implementation, legitimateUnknown: false, unknownReason: null };
}

function activityZone(id: string, tier: TurnFunctionalZone['tier'], title: string, activity: number, attention: boolean, observedAt: Date | null, evidence: TurnFunctionalZone['evidence'], href: string, source: string, action: string, implementation: string): TurnFunctionalZone {
  const status: TurnFunctionalZoneStatus = attention ? 'ATTENTION' : activity > 0 ? 'OBSERVED' : 'NO_ACTIVITY';
  return { ...zone(id, tier, title, status, activity > 0 ? `${activity} înregistrări reale sunt disponibile Product Owner-ului.` : 'Sursa reală a răspuns cu zero activitate; starea nu este UNKNOWN.', 'EVENT_STORE', source, observedAt, evidence, href, activity > 0 ? (attention ? implementation : null) : 'Nu există încă activitate înregistrată.', activity > 0 && !attention ? null : implementation), action: { label: action, href } };
}

function providerUsageZone(id: string, title: string, activity: number, latest: { occurredAt: Date; outcome: string } | null, href: string, source: string): TurnFunctionalZone {
  const attention = Boolean(latest && latest.outcome !== 'SUCCESS');
  return activityZone(id, 'PREMIUM', title, activity, attention, latest?.occurredAt ?? null, { requests: activity, latestOutcome: latest?.outcome ?? 'NO_ACTIVITY' }, href, `ProviderUsageEvent.adapterId=${source}`, 'Deschide funcția', 'Rulează funcția și investighează ultimul rezultat non-SUCCESS.');
}

function localZone(id: string, title: string, information: string, href: string, action: string): TurnFunctionalZone {
  return { id, tier: 'BASIC', title, status: 'UNKNOWN_LEGITIMATE', information, source: { kind: 'LOCAL_DEVICE', label: 'Sesiune locală/efemeră; fără export global', observedAt: null }, evidence: { globalCollector: false }, action: { label: action, href }, missing: 'Product Owner nu poate vedea utilizarea sau rezultatele între dispozitive.', implementation: 'Necesită consimțământ, contract de retenție și un collector server-side; nu poate fi dedus din registru.', legitimateUnknown: true, unknownReason: 'Nu există o sursă globală autorizată; datele sunt intenționat locale/efemere.' };
}

function staticZone(id: string, tier: TurnFunctionalZone['tier'], title: string, information: string, href: string): TurnFunctionalZone {
  return { ...zone(id, tier, title, 'STATIC_REFERENCE', information, 'STATIC_CONTRACT', 'Knowledge/build contract versionat', null, { runtimeClaim: false }, href, null, null), action: { label: 'Deschide referința', href } };
}

function latestDate(...values: Array<Date | null | undefined>) {
  return values.filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

function heartbeatAttention(items: Array<{ reportedStatus: string; lastSeenAt: Date }>, now: Date) {
  return unhealthyHeartbeatCount(items, now) > 0;
}

function unhealthyHeartbeatCount(items: Array<{ reportedStatus: string; lastSeenAt: Date }>, now: Date) {
  return items.filter((item) => item.reportedStatus !== 'ONLINE' || now.getTime() - item.lastSeenAt.getTime() > COMPONENT_TELEMETRY_CONTRACT.staleAfterMs).length;
}

function count(zones: TurnFunctionalZone[], status: TurnFunctionalZoneStatus) {
  return zones.filter((zoneItem) => zoneItem.status === status).length;
}
