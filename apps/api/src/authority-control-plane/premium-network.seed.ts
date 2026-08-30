export type PremiumNetworkSeed = {
  canonicalId: string;
  kind: string;
  module: string;
  ownerId: string;
  supervisorId: string | null;
  scope: string;
  readPermissions: string[];
  writePermissions: string[];
  prohibitedActions: string[];
  capabilities: string[];
  humanApprovalBoundary: string;
  telemetryRequirement: string;
  allowedProviders: string[];
  fallbackProviders: string[];
  recoveryPolicy: string;
};

const noProvider: string[] = [];
const modelProviders = ['openai-primary'];

function entry(input: Partial<PremiumNetworkSeed> & Pick<PremiumNetworkSeed, 'canonicalId' | 'kind' | 'module' | 'ownerId' | 'scope'>): PremiumNetworkSeed {
  return {
    supervisorId: 'premium.orchestrator', readPermissions: ['telemetry.read'], writePermissions: [],
    prohibitedActions: ['self.grant-authority', 'scope.expand', 'guardian.takeover'], capabilities: [],
    humanApprovalBoundary: 'Human approval required for irreversible, financial, contractual, or authority-changing actions.',
    telemetryRequirement: 'Lifecycle, last run, dependency state, authority state, and technical incident telemetry.',
    allowedProviders: noProvider, fallbackProviders: noProvider, recoveryPolicy: 'RUNBOOK-ONLY', ...input,
  };
}

export const PREMIUM_NETWORK_CONTRACT_VERSION = 'AGM-PREMIUM-NETWORK-V1';

export const premiumNetworkSeed: readonly PremiumNetworkSeed[] = [
  entry({ canonicalId: 'agm.human.product-owner', kind: 'HUMAN_AUTHORITY', module: 'governance', ownerId: 'agm.human.product-owner', supervisorId: null, scope: 'premium', readPermissions: ['*'], writePermissions: ['authority.mandate.issue', 'authority.decision.issue', 'authority.lease.revoke', 'authority.handoff'], capabilities: ['human-approval'] }),
  entry({ canonicalId: 'agm.guardian.secrets', kind: 'GUARDIAN', module: 'security', ownerId: 'agm.human.product-owner', supervisorId: 'agm.human.product-owner', scope: 'premium.security.secrets', readPermissions: ['secret.metadata.read'], writePermissions: ['secret.rotate', 'secret.revoke'], prohibitedActions: ['executive.failover', 'scope.expand'], capabilities: ['secret-custody'], recoveryPolicy: 'HUMAN-APPROVED-RUNBOOK' }),
  entry({ canonicalId: 'agm.authority.control-plane', kind: 'CONTROL_PLANE', module: 'governance', ownerId: 'agm.human.product-owner', supervisorId: 'agm.human.product-owner', scope: 'premium.authority', readPermissions: ['mandate.read', 'decision.read', 'lease.read'], writePermissions: ['authority.lease.issue', 'authority.lease.revoke', 'authority.fence.validate'], capabilities: ['scope-conflict-detection', 'fencing', 'failover'] }),
  entry({ canonicalId: 'premium.architecture-inspector', kind: 'INSPECTOR', module: 'architecture', ownerId: 'agm.human.product-owner', scope: 'premium.architecture', readPermissions: ['architecture.read', 'telemetry.read'], capabilities: ['architecture-inspection'], allowedProviders: modelProviders, fallbackProviders: ['deterministic-inspector'] }),
  entry({ canonicalId: 'premium.release-inspector', kind: 'INSPECTOR', module: 'release', ownerId: 'agm.human.product-owner', scope: 'premium.release', readPermissions: ['release.read', 'evidence.read'], capabilities: ['baseline-inspection'], allowedProviders: modelProviders, fallbackProviders: ['deterministic-inspector'] }),
  entry({ canonicalId: 'premium.orchestrator', kind: 'ORCHESTRATOR', module: 'operations', ownerId: 'agm.human.product-owner', supervisorId: 'agm.authority.control-plane', scope: 'premium.operations', readPermissions: ['registry.read', 'telemetry.read', 'decision.read'], writePermissions: ['work.dispatch'], capabilities: ['bounded-dispatch'], allowedProviders: modelProviders, fallbackProviders: ['deterministic-router'] }),
  entry({ canonicalId: 'premium.recovery-executor', kind: 'RECOVERY_EXECUTOR', module: 'recovery', ownerId: 'agm.human.product-owner', scope: 'premium.recovery', readPermissions: ['runbook.read', 'incident.read', 'telemetry.read'], writePermissions: ['recovery.runbook.execute'], capabilities: ['runbook-execution'], prohibitedActions: ['architecture.redesign', 'scope.expand', 'contract.change', 'guardian.takeover', 'critical-recovery.improvise'], allowedProviders: ['agm-runtime-primary', 'agm-runtime-secondary'], fallbackProviders: ['agm-runtime-secondary'] }),
  entry({ canonicalId: 'premium.car-mover.intake-dedup', kind: 'AGENT', module: 'car-mover', ownerId: 'premium.orchestrator', scope: 'premium.car-mover.intake', capabilities: ['deduplication'], allowedProviders: modelProviders, fallbackProviders: ['deterministic-dedup'] }),
  entry({ canonicalId: 'premium.car-mover.opportunity-normalizer', kind: 'AGENT', module: 'car-mover', ownerId: 'premium.orchestrator', scope: 'premium.car-mover.opportunity.normalization', capabilities: ['normalization'], allowedProviders: modelProviders, fallbackProviders: ['deterministic-normalizer'] }),
  entry({ canonicalId: 'premium.car-mover.route-mobility', kind: 'AGENT', module: 'car-mover', ownerId: 'premium.orchestrator', scope: 'premium.car-mover.route', writePermissions: ['opportunity.route.assess'], capabilities: ['route-analysis','passenger-car-default','conditional-extended-profile'], allowedProviders: ['tomtom','agm-route-cache'], fallbackProviders: ['valhalla-osm','manual-confirmation'] }),
  entry({ canonicalId: 'premium.car-mover.cost-risk', kind: 'AGENT', module: 'car-mover', ownerId: 'premium.orchestrator', scope: 'premium.car-mover.cost-risk', writePermissions: ['opportunity.cost.assess'], capabilities: ['optional-offer-evaluation','driver-confirmed-consumption','unknown-safety-gate'], allowedProviders: ['agm-economic-engine','agm-toll-library'], fallbackProviders: ['official-authority','manual-confirmation'] }),
  entry({ canonicalId: 'premium.car-mover.opportunity-planner', kind: 'AGENT', module: 'car-mover', ownerId: 'premium.orchestrator', scope: 'premium.car-mover.opportunity.planning', writePermissions: ['opportunity.chain.plan'], capabilities: ['proposal-planning'], allowedProviders: modelProviders, fallbackProviders: ['deterministic-planner'] }),
  entry({ canonicalId: 'premium.car-mover.opportunity-judge', kind: 'INSPECTOR', module: 'car-mover', ownerId: 'agm.human.product-owner', scope: 'premium.car-mover.opportunity.judgement', writePermissions: ['opportunity.verdict.issue'], capabilities: ['proposal-inspection'], allowedProviders: modelProviders, fallbackProviders: ['deterministic-inspector'] }),
  entry({ canonicalId: 'premium.copilot-gateway', kind: 'GATEWAY', module: 'copilot', ownerId: 'premium.orchestrator', scope: 'premium.copilot', readPermissions: ['conversation.context.read'], writePermissions: ['proposal.create'], capabilities: ['provider-gateway'], allowedProviders: modelProviders, fallbackProviders: ['local-safe-response'] }),
  entry({ canonicalId: 'premium-linguist-it', kind: 'AGENT', module: 'linguistic-agents', ownerId: 'premium.orchestrator', scope: 'premium.linguistic.it', readPermissions: ['i18n.catalog.read'], capabilities: ['validate-source-text', 'suggest-contextual-correction', 'protect-operational-terms', 'adapt-professional-tone', 'explain-proposed-change'], telemetryRequirement: 'Component heartbeat from deterministic IT catalog audit; APP, Premium, Car Mover, Browser, and Android coverage.' }),
  entry({ canonicalId: 'premium-linguist-es', kind: 'AGENT', module: 'linguistic-agents', ownerId: 'premium.orchestrator', scope: 'premium.linguistic.es', readPermissions: ['i18n.catalog.read'], capabilities: ['validate-source-text', 'suggest-contextual-correction', 'protect-operational-terms', 'adapt-professional-tone', 'explain-proposed-change'], telemetryRequirement: 'Component heartbeat from deterministic ES catalog audit; APP, Premium, Car Mover, Browser, and Android coverage.' }),
  entry({ canonicalId: 'premium-linguist-sv', kind: 'AGENT', module: 'linguistic-agents', ownerId: 'premium.orchestrator', scope: 'premium.linguistic.sv', readPermissions: ['i18n.catalog.read'], capabilities: ['validate-source-text', 'suggest-contextual-correction', 'protect-operational-terms', 'adapt-professional-tone', 'explain-proposed-change'], telemetryRequirement: 'Component heartbeat from deterministic SV catalog audit; APP, Premium, Car Mover, Browser, and Android coverage.' }),
  entry({ canonicalId: 'premium.adapters.geocoding', kind: 'SERVICE', module: 'live-mobility', ownerId: 'premium.car-mover.route-mobility', scope: 'premium.car-mover.adapters.geocoding', readPermissions: ['external.location.read'], capabilities: ['geocoding-normalization'], allowedProviders: ['tomtom'], fallbackProviders: ['valhalla-osm','cache','manual-confirmation'] }),
  entry({ canonicalId: 'premium.adapters.routing', kind: 'SERVICE', module: 'live-mobility', ownerId: 'premium.car-mover.route-mobility', scope: 'premium.car-mover.adapters.routing', readPermissions: ['external.route.read'], capabilities: ['route-normalization','passenger-car-default','conditional-extended-profile'], allowedProviders: ['tomtom'], fallbackProviders: ['cache','valhalla-osm','manual-confirmation'] }),
  entry({ canonicalId: 'premium.adapters.traffic', kind: 'SERVICE', module: 'live-mobility', ownerId: 'premium.car-mover.route-mobility', scope: 'premium.car-mover.adapters.traffic', readPermissions: ['external.traffic.read'], capabilities: ['traffic-normalization'], allowedProviders: ['tomtom'], fallbackProviders: ['cache','manual'] }),
  entry({ canonicalId: 'premium.adapters.toll', kind: 'SERVICE', module: 'live-mobility', ownerId: 'premium.car-mover.cost-risk', scope: 'premium.car-mover.adapters.toll', readPermissions: ['official.toll.read'], capabilities: ['toll-normalization','confidence-gate','unknown-safety-gate'], allowedProviders: ['agm-toll-library'], fallbackProviders: ['official-authority','cache','manual-confirmation'] }),
  entry({ canonicalId: 'premium.adapters.transit', kind: 'SERVICE', module: 'live-mobility', ownerId: 'premium.car-mover.route-mobility', scope: 'premium.car-mover.adapters.transit', readPermissions: ['transit.read'], capabilities: ['transit-normalization','intermodal-normalization'], allowedProviders: ['db-timetables'], fallbackProviders: ['cache','manual-confirmation'] }),
  entry({ canonicalId: 'premium.adapters.platform-feed', kind: 'SERVICE', module: 'car-mover', ownerId: 'premium.car-mover.intake-dedup', scope: 'premium.car-mover.adapters.platform-feed', readPermissions: ['external.platform-feed.read'], capabilities: ['official-api-feed','webhook-feed','export-feed'], allowedProviders: ['official-platform-api'], fallbackProviders: ['gmail','whatsapp','manual'] }),
  entry({ canonicalId: 'premium.car-mover.job-service', kind: 'SERVICE', module: 'car-mover', ownerId: 'agm.human.product-owner', scope: 'premium.car-mover.jobs', writePermissions: ['car-mover.job.create', 'car-mover.job.transition'], capabilities: ['job-lifecycle'] }),
  entry({ canonicalId: 'premium.car-mover.incident-service', kind: 'SERVICE', module: 'incidents', ownerId: 'agm.human.product-owner', scope: 'premium.incidents', writePermissions: ['incident.record'], capabilities: ['incident-journal'] }),
  entry({ canonicalId: 'premium.car-mover.evidence-service', kind: 'SERVICE', module: 'evidence', ownerId: 'agm.human.product-owner', scope: 'premium.evidence', writePermissions: ['evidence.record'], capabilities: ['evidence-retention'] }),
  entry({ canonicalId: 'premium.car-mover.primary-accounting', kind: 'SERVICE', module: 'accounting', ownerId: 'agm.human.product-owner', scope: 'premium.car-mover.accounting', writePermissions: ['accounting.entry.record'], capabilities: ['primary-accounting'] }),
  entry({ canonicalId: 'premium.car-mover.archive-retention', kind: 'SERVICE', module: 'retention', ownerId: 'agm.human.product-owner', scope: 'premium.retention', writePermissions: ['retention.apply'], capabilities: ['retention-policy'] }),
];

export const authorityScopeSeed = [
  { scopeId: 'premium', parentScopeId: null, ownerId: 'agm.human.product-owner' },
  ...premiumNetworkSeed.filter((item) => item.scope !== 'premium').map((item) => ({ scopeId: item.scope, parentScopeId: 'premium', ownerId: item.ownerId })),
  { scopeId: 'premium.recovery.telemetry', parentScopeId: 'premium.recovery', ownerId: 'agm.human.product-owner' },
];
