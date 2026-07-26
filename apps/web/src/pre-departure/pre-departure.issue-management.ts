import type {
  PreDepartureIssue,
  PreDepartureSession,
  PreDepartureTransitionResult,
} from './pre-departure.types';
import { transitionPreDeparture } from './pre-departure.machine';

export function openPreDepartureIssue(
  session: PreDepartureSession,
  input: {
    checkId: string;
    description: string;
    severity: PreDepartureIssue['severity'];
    now?: string;
    issueId?: string;
  },
): PreDepartureTransitionResult {
  const description = input.description.trim();
  if (!description) return { session, applied: false, reason: 'A problem description is required.' };
  if (!session.applicableCheckIds.includes(input.checkId)) {
    return { session, applied: false, reason: 'The check is not applicable to this session.' };
  }

  const answer = transitionPreDeparture(session, {
    type: session.state === 'BLOCKED' || session.state === 'READY_TO_CONFIRM'
      ? 'EDIT_ANSWER'
      : 'ANSWER_PROBLEM',
    checkId: input.checkId,
    ...(session.state === 'BLOCKED' || session.state === 'READY_TO_CONFIRM'
      ? { answer: { status: 'problem' as const, note: description } }
      : { note: description }),
  } as Parameters<typeof transitionPreDeparture>[1]);
  if (!answer.applied) return answer;

  const now = input.now ?? new Date().toISOString();
  const existing = Object.values(session.issues ?? {}).find(
    (issue) => issue.checkId === input.checkId && issue.status === 'open',
  );
  const issue: PreDepartureIssue = {
    id: existing?.id ?? input.issueId ?? crypto.randomUUID(),
    checkId: input.checkId,
    description,
    severity: input.severity,
    status: 'open',
    createdAt: existing?.createdAt ?? now,
  };
  return {
    ...answer,
    session: {
      ...answer.session,
      issues: { ...(answer.session.issues ?? {}), [issue.id]: issue },
    },
  };
}

export function resolvePreDepartureIssue(
  session: PreDepartureSession,
  issueId: string,
  resolutionNote: string,
  now = new Date().toISOString(),
): PreDepartureTransitionResult {
  const issue = session.issues?.[issueId];
  const note = resolutionNote.trim();
  if (!issue || issue.status !== 'open') {
    return { session, applied: false, reason: 'The open problem was not found.' };
  }
  if (!note) return { session, applied: false, reason: 'A resolution note is required.' };

  const edited = transitionPreDeparture(session, {
    type: 'EDIT_ANSWER',
    checkId: issue.checkId,
    answer: undefined,
  });
  if (!edited.applied) return edited;

  return {
    ...edited,
    session: {
      ...edited.session,
      issues: {
        ...(edited.session.issues ?? {}),
        [issueId]: {
          ...issue,
          status: 'resolved',
          resolvedAt: now,
          resolutionNote: note,
        },
      },
    },
  };
}

export function openPreDepartureIssues(session: PreDepartureSession) {
  return Object.values(session.issues ?? {}).filter((issue) => issue.status === 'open');
}

export function hasCriticalPreDepartureBlocker(session: PreDepartureSession) {
  return openPreDepartureIssues(session).some((issue) => issue.severity === 'critical');
}
