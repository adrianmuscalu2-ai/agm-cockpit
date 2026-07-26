import {
  PRE_DEPARTURE_ANSWER_STATUSES,
  PRE_DEPARTURE_CHECK_IDS,
  PRE_DEPARTURE_CONTEXTS,
  PRE_DEPARTURE_CONTRACT_VERSION,
  PRE_DEPARTURE_LANGUAGES,
  PRE_DEPARTURE_SESSION_STATES,
  type PreDepartureCheckId,
  type PreDepartureContext,
  type PreDepartureSessionPayload,
  type PreDepartureValidationIssue,
  type PreDepartureValidationResult,
} from './pre-departure-contract.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const checksByContext: Record<PreDepartureContext, readonly PreDepartureCheckId[]> = {
  local: ['vehicle', 'driver', 'documents', 'tachograph', 'cargo', 'route'],
  'long-distance': ['vehicle', 'driver', 'documents', 'tachograph', 'cargo', 'route'],
  adr: ['documents', 'cargo', 'adr'],
  night: ['vehicle', 'driver', 'route', 'weather'],
  'adverse-weather': ['vehicle', 'driver', 'route', 'weather'],
};

export function applicableChecksForPreDepartureContexts(
  contexts: readonly PreDepartureContext[],
): PreDepartureCheckId[] {
  const result = new Set<PreDepartureCheckId>();
  contexts.forEach((context) => checksByContext[context].forEach((checkId) => result.add(checkId)));
  return [...result];
}

export function validatePreDepartureSessionPayload(value: unknown): PreDepartureValidationResult {
  const issues: PreDepartureValidationIssue[] = [];
  if (!isObject(value)) {
    return invalid([{ path: 'session', code: 'invalid-type', message: 'Session must be an object.' }]);
  }

  exact(value.contractVersion, PRE_DEPARTURE_CONTRACT_VERSION, 'contractVersion', issues);
  uuid(value.clientSessionId, 'clientSessionId', issues);
  uuid(value.idempotencyKey, 'idempotencyKey', issues);
  optionalUuid(value.transportJobId, 'transportJobId', issues);
  optionalUuid(value.deviceId, 'deviceId', issues);
  optionalText(value.vehicleReference, 'vehicleReference', 64, issues);
  optionalText(value.trailerReference, 'trailerReference', 64, issues);
  text(value.checklistVersion, 'checklistVersion', 40, issues);
  member(value.language, PRE_DEPARTURE_LANGUAGES, 'language', issues);
  member(value.state, PRE_DEPARTURE_SESSION_STATES, 'state', issues);
  integer(value.clientRevision, 'clientRevision', 0, issues);
  timestamp(value.startedAt, 'startedAt', issues);
  timestamp(value.updatedAt, 'updatedAt', issues);
  optionalTimestamp(value.confirmedAt, 'confirmedAt', issues);
  optionalTimestamp(value.closedAt, 'closedAt', issues);

  const contexts = enumArray(value.contexts, PRE_DEPARTURE_CONTEXTS, 'contexts', issues);
  if (contexts.length === 0 && value.state !== 'DRAFT') {
    issue(issues, 'contexts', 'inconsistent', 'At least one context is required outside DRAFT.');
  }

  const answers = Array.isArray(value.answers) ? value.answers : [];
  if (!Array.isArray(value.answers)) {
    issue(issues, 'answers', 'invalid-type', 'Answers must be an array.');
  }

  const answerIds: string[] = [];
  answers.forEach((answer, index) => {
    const path = `answers[${index}]`;
    if (!isObject(answer)) {
      issue(issues, path, 'invalid-type', 'Answer must be an object.');
      return;
    }
    member(answer.checkId, PRE_DEPARTURE_CHECK_IDS, `${path}.checkId`, issues);
    member(answer.status, PRE_DEPARTURE_ANSWER_STATUSES, `${path}.status`, issues);
    timestamp(answer.answeredAt, `${path}.answeredAt`, issues);
    optionalText(answer.note, `${path}.note`, 500, issues);
    optionalText(answer.notApplicableReason, `${path}.notApplicableReason`, 240, issues);

    if (typeof answer.checkId === 'string') answerIds.push(answer.checkId);
    if (answer.status === 'problem' && !nonEmptyText(answer.note)) {
      issue(issues, `${path}.note`, 'required', 'A problem answer requires a note.');
    }
    if (answer.status === 'not-applicable' && !nonEmptyText(answer.notApplicableReason)) {
      issue(
        issues,
        `${path}.notApplicableReason`,
        'required',
        'A not-applicable answer requires a reason.',
      );
    }
  });

  duplicates(answerIds).forEach((checkId) =>
    issue(issues, 'answers', 'duplicate', `Check ${checkId} has more than one answer.`),
  );

  const applicableChecks = applicableChecksForPreDepartureContexts(contexts);
  answerIds
    .filter((checkId) => !applicableChecks.includes(checkId as PreDepartureCheckId))
    .forEach((checkId) =>
      issue(issues, 'answers', 'inconsistent', `Check ${checkId} is not applicable to selected contexts.`),
    );

  validateStateConsistency(value, applicableChecks, answers, issues);
  return issues.length ? invalid(issues) : { valid: true, value: value as PreDepartureSessionPayload };
}

function validateStateConsistency(
  value: Record<string, unknown>,
  applicableChecks: readonly PreDepartureCheckId[],
  answers: unknown[],
  issues: PreDepartureValidationIssue[],
) {
  const validAnswers = answers.filter(isObject);
  const answered = new Set(validAnswers.map((answer) => answer.checkId).filter((id): id is string => typeof id === 'string'));
  const incomplete = applicableChecks.some((checkId) => !answered.has(checkId));
  const problems = validAnswers.some((answer) => answer.status === 'problem');
  const state = value.state;

  if ((state === 'READY_TO_CONFIRM' || state === 'CONFIRMED' || state === 'CLOSED') && (incomplete || problems)) {
    issue(issues, 'state', 'invalid-state', `${state} requires complete checks with no open problems.`);
  }
  if (state === 'BLOCKED' && (!problems || incomplete)) {
    issue(issues, 'state', 'invalid-state', 'BLOCKED requires complete checks and at least one problem.');
  }
  if (state === 'NEEDS_ATTENTION' && !problems) {
    issue(issues, 'state', 'invalid-state', 'NEEDS_ATTENTION requires at least one problem.');
  }
  if ((state === 'CONFIRMED' || state === 'CLOSED') && value.confirmedAt === undefined) {
    issue(issues, 'confirmedAt', 'required', `${state} requires confirmedAt.`);
  }
  if (state === 'CLOSED' && value.closedAt === undefined) {
    issue(issues, 'closedAt', 'required', 'CLOSED requires closedAt.');
  }
  if (state !== 'CLOSED' && value.closedAt !== undefined) {
    issue(issues, 'closedAt', 'inconsistent', 'closedAt is allowed only for CLOSED sessions.');
  }
}

function invalid(issues: PreDepartureValidationIssue[]): PreDepartureValidationResult {
  return { valid: false, issues };
}

function issue(
  issues: PreDepartureValidationIssue[],
  path: string,
  code: PreDepartureValidationIssue['code'],
  message: string,
) {
  issues.push({ path, code, message });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function text(
  value: unknown,
  path: string,
  maximum: number,
  issues: PreDepartureValidationIssue[],
) {
  if (!nonEmptyText(value)) {
    issue(issues, path, 'required', `${path} is required.`);
  } else if (value.length > maximum) {
    issue(issues, path, 'invalid-value', `${path} exceeds ${maximum} characters.`);
  }
}

function optionalText(
  value: unknown,
  path: string,
  maximum: number,
  issues: PreDepartureValidationIssue[],
) {
  if (value === undefined) return;
  text(value, path, maximum, issues);
}

function uuid(value: unknown, path: string, issues: PreDepartureValidationIssue[]) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    issue(issues, path, 'invalid-format', `${path} must be a UUID.`);
  }
}

function optionalUuid(value: unknown, path: string, issues: PreDepartureValidationIssue[]) {
  if (value !== undefined) uuid(value, path, issues);
}

function timestamp(value: unknown, path: string, issues: PreDepartureValidationIssue[]) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    issue(issues, path, 'invalid-format', `${path} must be an ISO-8601 timestamp.`);
  }
}

function optionalTimestamp(value: unknown, path: string, issues: PreDepartureValidationIssue[]) {
  if (value !== undefined) timestamp(value, path, issues);
}

function integer(
  value: unknown,
  path: string,
  minimum: number,
  issues: PreDepartureValidationIssue[],
) {
  if (!Number.isInteger(value) || Number(value) < minimum) {
    issue(issues, path, 'invalid-value', `${path} must be an integer greater than or equal to ${minimum}.`);
  }
}

function exact(
  value: unknown,
  expected: string,
  path: string,
  issues: PreDepartureValidationIssue[],
) {
  if (value !== expected) {
    issue(issues, path, 'invalid-value', `${path} must be ${expected}.`);
  }
}

function member<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
  issues: PreDepartureValidationIssue[],
): value is T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    issue(issues, path, 'invalid-value', `${path} contains an unsupported value.`);
    return false;
  }
  return true;
}

function enumArray<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
  issues: PreDepartureValidationIssue[],
): T[] {
  if (!Array.isArray(value)) {
    issue(issues, path, 'invalid-type', `${path} must be an array.`);
    return [];
  }
  const result = value.filter((item): item is T => member(item, values, path, issues));
  duplicates(result).forEach((item) =>
    issue(issues, path, 'duplicate', `${path} contains duplicate value ${item}.`),
  );
  return result;
}

function duplicates(values: readonly string[]) {
  const seen = new Set<string>();
  const result = new Set<string>();
  values.forEach((value) => (seen.has(value) ? result.add(value) : seen.add(value)));
  return [...result];
}

