export const premiumLifecycleStates = [
  'DRAFT',
  'PRE_DEPARTURE_IN_PROGRESS',
  'READY_WITH_WARNINGS',
  'READY_CONFIRMED',
  'TRIP_ACTIVE',
  'ARRIVAL_RECORDED',
  'POST_TRIP_IN_PROGRESS',
  'COMPLETED',
  'ARCHIVED',
] as const;

export type PremiumLifecycleState = (typeof premiumLifecycleStates)[number];

export const operationalFlags = [
  'BLOCKED',
  'INCIDENT_OPEN',
  'SYNC_PENDING',
  'OFFLINE',
  'RECOVERY_REQUIRED',
] as const;

export type OperationalFlag = (typeof operationalFlags)[number];
export type EntityReadiness = 'UNKNOWN' | 'IDENTIFIED' | 'VERIFIED' | 'WARNING' | 'BLOCKED';

export type OperationalEntityRef = {
  id?: string;
  readiness: EntityReadiness;
  version?: number;
  displayReference?: string;
};

export type OpenOperationalItem = {
  id: string;
  kind: 'warning' | 'blocker' | 'incident';
  severity: 'warning' | 'critical';
  sourceModuleId: string;
  targetStage: PremiumLifecycleState;
  status: 'open' | 'accepted' | 'resolved' | 'transferred';
};

export type TransferredResult = {
  id: string;
  type: string;
  sourceModuleId: string;
  targetModuleId: string;
  eventId: string;
  status: 'offered' | 'received';
};

export type TripContext = {
  schemaVersion: 'trip-context.v1';
  tripId: string;
  contextVersion: number;
  lifecycleState: PremiumLifecycleState;
  flags: OperationalFlag[];
  transportJob: {
    id?: string;
    mappingVersion: 'premium-transportjob-map.v1';
    lastKnownState?: string;
  };
  driver: OperationalEntityRef;
  vehicle: OperationalEntityRef;
  trailer: OperationalEntityRef;
  cargo: OperationalEntityRef;
  openItems: OpenOperationalItem[];
  transferredResults: TransferredResult[];
  confirmations: string[];
  lastEventId?: string;
  lastServerVersion?: number;
  createdAt: string;
  updatedAt: string;
};

export type TripContextSnapshot = Readonly<TripContext>;
