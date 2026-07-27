import type { PreDepartureSession } from '../pre-departure/pre-departure.types';
import { createLocalOperationalContextPorts } from './local-adapters';
import { createActiveTripContext, executeTripContextCommand, type OperationalRuntime } from './trip-context.service';
import type { OpenOperationalItem } from './trip-context.types';

const DEVICE_KEY = 'agm.premium.device-id.v1';
let operationalWriteQueue: Promise<unknown> = Promise.resolve();

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
  const ports = createLocalOperationalContextPorts(storage);
  const runtime = browserRuntime(storage);
  let context = await createActiveTripContext(ports, runtime);
  if (context.lifecycleState === 'DRAFT' && session.state !== 'NOT_STARTED') {
    const result = await executeTripContextCommand(ports, runtime, { type: 'START_PRE_DEPARTURE' }, {
      moduleId: 'pre-departure',
      payload: { sourceState: session.state },
    });
    context = result.context;
  }

  const items: OpenOperationalItem[] = Object.values(session.issues ?? {})
    .filter((issue) => issue.status === 'open')
    .map((issue) => ({
      id: issue.id,
      kind: issue.severity === 'critical' ? 'blocker' : 'warning',
      severity: issue.severity,
      sourceModuleId: 'pre-departure',
      targetStage: 'TRIP_ACTIVE',
      status: 'open',
    }));
  context = (await executeTripContextCommand(ports, runtime, { type: 'REPLACE_OPEN_ITEMS', items }, {
    moduleId: 'pre-departure',
    payload: { sourceState: session.state, openItemIds: items.map((item) => item.id) },
  })).context;
  context = await setFlag(ports, runtime, context.flags.includes('BLOCKED'), 'BLOCKED', session.state === 'BLOCKED');
  context = await setFlag(ports, runtime, context.flags.includes('OFFLINE'), 'OFFLINE', !online);
  context = await setFlag(ports, runtime, context.flags.includes('SYNC_PENDING'), 'SYNC_PENDING', true);

  if (
    session.state === 'CONFIRMED' &&
    context.lifecycleState === 'PRE_DEPARTURE_IN_PROGRESS' &&
    session.confirmation
  ) {
    context = (await executeTripContextCommand(ports, runtime, {
      type: 'MARK_READY',
      withWarnings: items.some((item) => item.severity === 'warning'),
      confirmationId: `pre-departure:${session.confirmation.confirmedAt}`,
    }, {
      moduleId: 'pre-departure',
      actor: { type: 'user', label: session.confirmation.actorLabel },
      payload: { statementVersion: session.confirmation.statementVersion },
    })).context;
  }
  return context;
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
