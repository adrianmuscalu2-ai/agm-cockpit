import type {
  PreDepartureAnswerStatus,
  PreDepartureCheckId,
  PreDepartureContext,
  PreDepartureLanguage,
  PreDepartureSessionState,
} from './pre-departure-contract.types';

/**
 * Stage 2 persistence proposal only.
 *
 * These records document the future database shape without modifying the
 * active Prisma schema or creating a migration.
 */
export type PreDepartureSessionRecord = {
  id: string;
  companyId: string;
  driverUserId: string;
  transportJobId: string | null;
  clientSessionId: string;
  idempotencyKey: string;
  deviceId: string | null;
  vehicleReference: string | null;
  trailerReference: string | null;
  contractVersion: string;
  checklistVersion: string;
  language: PreDepartureLanguage;
  contexts: PreDepartureContext[];
  state: PreDepartureSessionState;
  clientRevision: number;
  serverRevision: number;
  startedAt: Date;
  confirmedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PreDepartureAnswerRecord = {
  id: string;
  companyId: string;
  sessionId: string;
  checkId: PreDepartureCheckId;
  status: PreDepartureAnswerStatus;
  note: string | null;
  notApplicableReason: string | null;
  answeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export const PRE_DEPARTURE_PERSISTENCE_CONSTRAINTS = {
  sessionUnique: [
    ['companyId', 'clientSessionId'],
    ['companyId', 'idempotencyKey'],
  ],
  answerUnique: [['sessionId', 'checkId']],
  sessionIndexes: [
    ['companyId', 'state', 'updatedAt'],
    ['transportJobId', 'updatedAt'],
    ['driverUserId', 'updatedAt'],
  ],
  ownershipFieldsFromAuthentication: ['companyId', 'driverUserId'],
} as const;

