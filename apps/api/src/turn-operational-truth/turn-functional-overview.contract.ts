export const TURN_FUNCTIONAL_OVERVIEW_CONTRACT = {
  version: 'turn-functional-overview.v2',
  scope: 'PRODUCT_OWNER',
  dataPolicy: 'LIVE_OR_EXPLICITLY_LIMITED',
} as const;

export type TurnFunctionalZoneStatus =
  | 'OPERATIONAL'
  | 'OBSERVED'
  | 'ATTENTION'
  | 'NO_ACTIVITY'
  | 'STATIC_REFERENCE'
  | 'CAPABILITY_MISSING'
  | 'UNKNOWN_LEGITIMATE';

export type TurnFunctionalZone = {
  id: string;
  tier: 'BASIC' | 'PREMIUM';
  title: string;
  status: TurnFunctionalZoneStatus;
  information: string;
  source: { kind: 'RUNTIME' | 'EVENT_STORE' | 'CONFIGURATION' | 'LOCAL_DEVICE' | 'STATIC_CONTRACT'; label: string; observedAt: string | null };
  evidence: Record<string, string | number | boolean | null>;
  action: { label: string; href: string };
  missing: string | null;
  implementation: string | null;
  legitimateUnknown: boolean;
  unknownReason: string | null;
};

export type TurnFunctionalOverview = {
  contractVersion: string;
  generatedAt: string;
  scope: string;
  companyScope: string;
  verdict: {
    releasePipeline: 'PASS';
    operationalTruthInfrastructure: 'PASS';
    falseGreenPrevention: 'PASS';
    turnFunctionalCompleteness: 'FAIL' | 'READY_FOR_PRODUCT_OWNER_REVIEW';
    productOwnerAcceptance: 'NOT_GRANTED';
    finalProductionPass: 'RETRACTED';
  };
  summary: {
    totalZones: number;
    operational: number;
    observed: number;
    attention: number;
    noActivity: number;
    staticReference: number;
    capabilityMissing: number;
    legitimateUnknown: number;
    unresolvedUnknown: number;
  };
  zones: TurnFunctionalZone[];
};
