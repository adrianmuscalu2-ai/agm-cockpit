import type { PreDepartureSession } from '../pre-departure/pre-departure.types';
import { createLocalOperationalContextPorts } from './local-adapters';
import { createActiveTripContext, executeTripContextCommand, type OperationalRuntime } from './trip-context.service';
import type { OpenOperationalItem } from './trip-context.types';

const DEVICE_KEY = 'agm.premium.device-id.v1';
let operationalWriteQueue: Promise<unknown> = Promise.resolve();

export type PreDepartureJourneyHandoffV1 = {
  readonly contractVersion: 'pre-departure-journey-handoff.v1';
  readonly handoffId: string;
  readonly sourceModuleId: 'pre-departure';
  readonly sourceState: PreDepartureSession['state'];
  readonly openItems: readonly OpenOperationalItem[];
  readonly flags: {
    readonly blocked: boolean;
    readonly offline: boolean;
    readonly syncPending: true;
  };
  readonly confirmation?: {
    readonly id: string;
    readonly actorLabel: string;
    readonly statementVersion: 'pre-departure-confirmation-v1';
  };
};

export function recordPreDepartureInOperationalContext(
  storage: Storage,
  session: PreDepartureSession,
  online: boolean,
) {
  return queueOperationalWrite(() => recordPreDepartureSnapshot(storage, session, online));
}

async function recordPreDepartureSnapshot(
  storage: Storage,
  session: PreDepartureSession,
  online: boolean,
) {
  const handoff = createPreDepartureJourneyHandoff(session, online);
  const ports = createLocalOperationalContextPorts(storage);
  const runtime = browserRuntime(storage);
  let context = await createActiveTripContext(ports, runtime);
  if (context.lifecycleState === 'DRAFT' && session.state !== 'NOT_STARTED') {
    const result = await executeTripContextCommand(ports, runtime, { type: 'START_PRE_DEPARTURE' }, {
      moduleId: 'pre-departure',
      payload: handoffPayload(handoff),
    });
    context = result.context;
  }

  const items = [...handoff.openItems];
  if (!sameOpenItems(context.openItems, items)) {
    context = (await executeTripContextCommand(ports, runtime, { type: 'REPLACE_OPEN_ITEMS', items }, {
      moduleId: 'pre-departure',
      payload: { ...handoffPayload(handoff), openItemIds: items.map((item) => item.id) },
    })).context;
  }
  context = await setFlag(ports, runtime, context.flags.includes('BLOCKED'), 'BLOCKED', handoff.flags.blocked);
  context = await setFlag(ports, runtime, context.flags.includes('OFFLINE'), 'OFFLINE', handoff.flags.offline);
  context = await setFlag(ports, runtime, context.flags.includes('SYNC_PENDING'), 'SYNC_PENDING', true);

  if (
    session.state === 'CONFIRMED' &&
    context.lifecycleState === 'PRE_DEPARTURE_IN_PROGRESS' &&
    handoff.confirmation
  ) {
    context = (await executeTripContextCommand(ports, runtime, {
      type: 'MARK_READY',
      withWarnings: items.some((item) => item.severity === 'warning'),
      confirmationId: handoff.confirmation.id,
    }, {
      moduleId: 'pre-departure',
      actor: { type: 'user', label: handoff.confirmation.actorLabel },
      payload: handoffPayload(handoff),
    })).context;
  }
  return context;
}

export function createPreDepartureJourneyHandoff(
  session: PreDepartureSession,
  online: boolean,
): PreDepartureJourneyHandoffV1 {
  const openItems: OpenOperationalItem[] = Object.values(session.issues ?? {})
    .filter((issue) => issue.status === 'open')
    .map<OpenOperationalItem>((issue) => ({
      id: issue.id,
      kind: issue.severity === 'critical' ? 'blocker' : 'warning',
      severity: issue.severity,
      sourceModuleId: 'pre-departure',
      targetStage: 'TRIP_ACTIVE',
      status: 'open',
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const snapshot = {
    sourceState: session.state,
    openItems,
    flags: {
      blocked: session.state === 'BLOCKED',
      offline: !online,
      syncPending: true as const,
    },
    confirmation: session.confirmation
      ? {
          id: `pre-departure:${session.confirmation.confirmedAt}`,
          actorLabel: session.confirmation.actorLabel,
          statementVersion: session.confirmation.statementVersion,
        }
      : undefined,
  };
  return {
    contractVersion: 'pre-departure-journey-handoff.v1',
    handoffId: `pre-departure:${stableHash(JSON.stringify(snapshot))}`,
    sourceModuleId: 'pre-departure',
    ...snapshot,
  };
}

export function recordPreDepartureReset(storage: Storage) {
  return queueOperationalWrite(() => recordReset(storage));
}

async function recordReset(storage: Storage) {
  const ports = createLocalOperationalContextPorts(storage);
  const runtime = browserRuntime(storage);
  const context = await ports.repository.readActive();
  if (!context) return;
  await executeTripContextCommand(ports, runtime, { type: 'SET_FLAG', flag: 'SYNC_PENDING', active: true }, {
    moduleId: 'pre-departure',
    actor: { type: 'user' },
    payload: { action: 'ui-reset', tripPreserved: true },
  });
}

function queueOperationalWrite<T>(operation: () => Promise<T>) {
  const queued = operationalWriteQueue.then(operation, operation);
  operationalWriteQueue = queued.then(() => undefined, () => undefined);
  return queued;
}

async function setFlag(
  ports: ReturnType<typeof createLocalOperationalContextPorts>,
  runtime: OperationalRuntime,
  current: boolean,
  flag: 'BLOCKED' | 'OFFLINE' | 'SYNC_PENDING',
  active: boolean,
) {
  if (current === active) return (await ports.repository.readActive())!;
  return (await executeTripContextCommand(ports, runtime, { type: 'SET_FLAG', flag, active }, {
    moduleId: 'pre-departure',
  })).context;
}

function sameOpenItems(left: readonly OpenOperationalItem[], right: readonly OpenOperationalItem[]) {
  const normalize = (items: readonly OpenOperationalItem[]) =>
    [...items].sort((first, second) => first.id.localeCompare(second.id));
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function handoffPayload(handoff: PreDepartureJourneyHandoffV1) {
  return {
    handoffContractVersion: handoff.contractVersion,
    handoffId: handoff.handoffId,
    sourceState: handoff.sourceState,
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
