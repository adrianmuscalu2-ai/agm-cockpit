import { ExecutedCheck } from '../validation-reports/validation-reports.service';
import { TransportTransitionPolicy } from './transport-transition.policy';

interface TransitionCheckTransport {
  id: string;
  isArchived: boolean;
  currentLifecycleState: {
    code: string;
    displayName: string;
  };
}

function createCheck(
  code: string,
  status: ExecutedCheck['status'],
  message: string,
  options: Partial<
    Pick<ExecutedCheck, 'severity' | 'relatedEntityType' | 'relatedEntityId' | 'details'>
  > = {},
): ExecutedCheck {
  return {
    code,
    severity: options.severity ?? 'mandatory',
    status,
    executedAt: new Date().toISOString(),
    durationMs: 1,
    message,
    relatedEntityType: options.relatedEntityType,
    relatedEntityId: options.relatedEntityId,
    details: options.details,
  };
}

export function buildTransportTransitionChecks(
  transport: TransitionCheckTransport,
  policy: TransportTransitionPolicy,
): ExecutedCheck[] {
  const isCurrentStateAllowed = policy.fromStateCodes.includes(
    transport.currentLifecycleState.code,
  );

  const checks: ExecutedCheck[] = [
    createCheck(
      'TRANSPORT_NOT_ARCHIVED',
      transport.isArchived ? 'failed' : 'passed',
      transport.isArchived
        ? 'Archived transports cannot be changed.'
        : 'Transport is not archived.',
    ),
    createCheck(
      'CURRENT_STATE_ALLOWED',
      isCurrentStateAllowed ? 'passed' : 'failed',
      isCurrentStateAllowed
        ? `Current state ${transport.currentLifecycleState.displayName} is valid for ${policy.businessAction}.`
        : `Current state ${transport.currentLifecycleState.displayName} is not valid for ${policy.businessAction}.`,
      {
        details: {
          expectedStates: policy.fromStateCodes,
          actualState: transport.currentLifecycleState.code,
        },
      },
    ),
  ];

  if (!transport.isArchived && isCurrentStateAllowed) {
    checks.push(
      createCheck(policy.successCheckCode, 'passed', policy.successMessage, {
        relatedEntityType: 'TransportJob',
        relatedEntityId: transport.id,
      }),
    );
  }

  return checks;
}
