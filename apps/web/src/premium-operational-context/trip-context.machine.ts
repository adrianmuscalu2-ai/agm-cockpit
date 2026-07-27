import type {
  OpenOperationalItem,
  OperationalFlag,
  PremiumLifecycleState,
  TripContext,
  TransferredResult,
} from './trip-context.types';

export type TripContextCommand =
  | { type: 'START_PRE_DEPARTURE' }
  | { type: 'MARK_READY'; withWarnings: boolean; confirmationId: string }
  | { type: 'START_TRIP'; confirmationId: string }
  | { type: 'RECORD_ARRIVAL'; confirmationId: string }
  | { type: 'START_POST_TRIP' }
  | { type: 'COMPLETE_TRIP'; confirmationId: string }
  | { type: 'ARCHIVE_TRIP' }
  | { type: 'SET_FLAG'; flag: OperationalFlag; active: boolean }
  | { type: 'REPLACE_OPEN_ITEMS'; items: OpenOperationalItem[] }
  | { type: 'TRANSFER_RESULT'; result: TransferredResult };

export type TripContextTransition = {
  applied: boolean;
  context: TripContext;
  eventType?: string;
  reason?: string;
};

const transitions: Partial<Record<PremiumLifecycleState, Partial<Record<TripContextCommand['type'], PremiumLifecycleState>>>> = {
  DRAFT: { START_PRE_DEPARTURE: 'PRE_DEPARTURE_IN_PROGRESS' },
  PRE_DEPARTURE_IN_PROGRESS: { MARK_READY: 'READY_CONFIRMED' },
  READY_WITH_WARNINGS: { START_TRIP: 'TRIP_ACTIVE' },
  READY_CONFIRMED: { START_TRIP: 'TRIP_ACTIVE' },
  TRIP_ACTIVE: { RECORD_ARRIVAL: 'ARRIVAL_RECORDED' },
  ARRIVAL_RECORDED: { START_POST_TRIP: 'POST_TRIP_IN_PROGRESS' },
  POST_TRIP_IN_PROGRESS: { COMPLETE_TRIP: 'COMPLETED' },
  COMPLETED: { ARCHIVE_TRIP: 'ARCHIVED' },
};

export function transitionTripContext(context: TripContext, command: TripContextCommand): TripContextTransition {
  if (command.type === 'SET_FLAG') {
    const flags = new Set(context.flags);
    command.active ? flags.add(command.flag) : flags.delete(command.flag);
    if (flags.size === context.flags.length && context.flags.every((flag) => flags.has(flag))) {
      return { applied: false, context, reason: 'FLAG_UNCHANGED' };
    }
    return changed(context, { flags: [...flags] }, `trip.flag.${command.active ? 'activated' : 'cleared'}.v1`);
  }

  if (command.type === 'REPLACE_OPEN_ITEMS') {
    return changed(context, { openItems: command.items.map((item) => ({ ...item })) }, 'trip.open-items.reconciled.v1');
  }

  if (command.type === 'TRANSFER_RESULT') {
    return changed(context, { transferredResults: [...context.transferredResults, { ...command.result }] }, 'trip.handoff.created.v1');
  }

  if (context.flags.includes('RECOVERY_REQUIRED')) {
    return { applied: false, context, reason: 'RECOVERY_REQUIRED' };
  }
  if (context.flags.includes('BLOCKED') && ['START_TRIP', 'COMPLETE_TRIP', 'ARCHIVE_TRIP'].includes(command.type)) {
    return { applied: false, context, reason: 'TRIP_BLOCKED' };
  }
  if (command.type === 'ARCHIVE_TRIP' && context.flags.includes('SYNC_PENDING')) {
    return { applied: false, context, reason: 'SYNC_PENDING' };
  }

  const target = transitions[context.lifecycleState]?.[command.type];
  if (!target) return { applied: false, context, reason: 'INVALID_LIFECYCLE_TRANSITION' };
  const lifecycleState =
    command.type === 'MARK_READY' && command.withWarnings ? 'READY_WITH_WARNINGS' : target;
  const confirmationId = 'confirmationId' in command ? command.confirmationId.trim() : '';
  if ('confirmationId' in command && !confirmationId) {
    return { applied: false, context, reason: 'CONFIRMATION_REQUIRED' };
  }
  return changed(
    context,
    {
      lifecycleState,
      confirmations: confirmationId ? [...context.confirmations, confirmationId] : context.confirmations,
    },
    `trip.lifecycle.${lifecycleState.toLocaleLowerCase().replaceAll('_', '-')}.v1`,
  );
}

function changed(context: TripContext, patch: Partial<TripContext>, eventType: string): TripContextTransition {
  return {
    applied: true,
    context: { ...context, ...patch, contextVersion: context.contextVersion + 1 },
    eventType,
  };
}
