import { COMMON_OUTBOX_CONTRACT_VERSION } from '../outbox';
import {
  createLocalOperationalContextPorts,
  createActiveTripContext,
  executeTripContextCommand,
  type OperationalRuntime,
} from '../premium-operational-context';
import type { AfterDepartureAssessment } from './after-departure.types';

const DEVICE_KEY = 'agm.premium.device-id.v1';
let journeyWriteQueue: Promise<unknown> = Promise.resolve();

export type AfterDepartureJourneyHandoffV1 = {
  readonly contractVersion: 'after-departure-journey-handoff.v1';
  readonly outboxContractVersion: typeof COMMON_OUTBOX_CONTRACT_VERSION;
  readonly handoffId: string;
  readonly sourceModuleId: 'after-departure';
  readonly assessment: AfterDepartureAssessment;
  readonly offline: boolean;
};

export type AfterDepartureJourneyAdapter = {
  record(
    storage: Storage,
    assessment: AfterDepartureAssessment,
    online: boolean,
  ): Promise<Awaited<ReturnType<typeof recordAfterDepartureInJourney>>>;
};

export function createAfterDepartureJourneyAdapter(): AfterDepartureJourneyAdapter {
  return { record: recordAfterDepartureInJourney };
}

export function recordAfterDepartureInJourney(
  storage: Storage,
  assessment: AfterDepartureAssessment,
  online: boolean,
) {
  return queueJourneyWrite(() => applyAfterDepartureHandoff(
    storage,
    createAfterDepartureJourneyHandoff(assessment, online),
  ));
}

export function createAfterDepartureJourneyHandoff(
  assessment: AfterDepartureAssessment,
  online: boolean,
): AfterDepartureJourneyHandoffV1 {
  return {
    contractVersion: 'after-departure-journey-handoff.v1',
    outboxContractVersion: COMMON_OUTBOX_CONTRACT_VERSION,
    handoffId: `after-departure:${stableHash(JSON.stringify(assessment))}`,
    sourceModuleId: 'after-departure',
    assessment,
    offline: !online,
  };
}

async function applyAfterDepartureHandoff(
  storage: Storage,
  handoff: AfterDepartureJourneyHandoffV1,
) {
  const ports = createLocalOperationalContextPorts(storage);
  const runtime = browserRuntime(storage);
  let context = await createActiveTripContext(ports, runtime);
  const alreadyTransferred = context.transferredResults.some((result) => result.id === handoff.handoffId);

  if (!alreadyTransferred) {
    const transferred = await executeTripContextCommand(ports, runtime, {
      type: 'TRANSFER_RESULT',
      result: {
        id: handoff.handoffId,
        type: 'after-departure-assessment.v1',
        sourceModuleId: 'after-departure',
        targetModuleId: 'journey',
        eventId: handoff.handoffId,
        status: 'received',
      },
    }, {
      moduleId: 'after-departure',
      payload: {
        handoffContractVersion: handoff.contractVersion,
        outboxContractVersion: handoff.outboxContractVersion,
        handoffId: handoff.handoffId,
        assessment: handoff.assessment,
      },
    });
    context = transferred.context;
  }

  context = await setFlag(ports, runtime, context.flags.includes('OFFLINE'), 'OFFLINE', handoff.offline);
  context = await setFlag(ports, runtime, context.flags.includes('SYNC_PENDING'), 'SYNC_PENDING', true);
  return context;
}

function queueJourneyWrite<T>(operation: () => Promise<T>) {
  const queued = journeyWriteQueue.then(operation, operation);
  journeyWriteQueue = queued.then(() => undefined, () => undefined);
  return queued;
}

async function setFlag(
  ports: ReturnType<typeof createLocalOperationalContextPorts>,
  runtime: OperationalRuntime,
  current: boolean,
  flag: 'OFFLINE' | 'SYNC_PENDING',
  active: boolean,
) {
  if (current === active) return (await ports.repository.readActive())!;
  return (await executeTripContextCommand(ports, runtime, { type: 'SET_FLAG', flag, active }, {
    moduleId: 'after-departure',
  })).context;
}

function browserRuntime(storage: Storage): OperationalRuntime {
  let deviceId = storage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    storage.setItem(DEVICE_KEY, deviceId);
  }
  return {
    now: () => new Date().toISOString(),
    createId: () => crypto.randomUUID(),
    deviceId,
  };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
