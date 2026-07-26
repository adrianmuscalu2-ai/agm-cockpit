export const PRE_DEPARTURE_ISSUE_CONTRACT_VERSION = '1.0.0' as const;
export const PRE_DEPARTURE_ISSUE_SEVERITIES = ['warning', 'critical'] as const;
export const PRE_DEPARTURE_ISSUE_STATUSES = ['open', 'resolved'] as const;

export type PreDepartureIssuePayload = {
  contractVersion: typeof PRE_DEPARTURE_ISSUE_CONTRACT_VERSION;
  clientIssueId: string;
  sessionId: string;
  checkId: string;
  severity: (typeof PRE_DEPARTURE_ISSUE_SEVERITIES)[number];
  description: string;
  status: (typeof PRE_DEPARTURE_ISSUE_STATUSES)[number];
  createdAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validatePreDepartureIssue(value: unknown) {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false as const, errors: ['Issue must be an object.'] };
  }
  const issue = value as Record<string, unknown>;
  if (issue.contractVersion !== PRE_DEPARTURE_ISSUE_CONTRACT_VERSION) errors.push('Unsupported contractVersion.');
  if (typeof issue.clientIssueId !== 'string' || !UUID_PATTERN.test(issue.clientIssueId)) errors.push('Invalid clientIssueId.');
  if (typeof issue.sessionId !== 'string' || !UUID_PATTERN.test(issue.sessionId)) errors.push('Invalid sessionId.');
  if (typeof issue.checkId !== 'string' || !issue.checkId.trim()) errors.push('checkId is required.');
  if (!PRE_DEPARTURE_ISSUE_SEVERITIES.includes(issue.severity as never)) errors.push('Invalid severity.');
  if (typeof issue.description !== 'string' || !issue.description.trim() || issue.description.length > 500) {
    errors.push('description is required and limited to 500 characters.');
  }
  if (!PRE_DEPARTURE_ISSUE_STATUSES.includes(issue.status as never)) errors.push('Invalid status.');
  if (typeof issue.createdAt !== 'string' || !Number.isFinite(Date.parse(issue.createdAt))) errors.push('Invalid createdAt.');
  if (issue.status === 'resolved') {
    if (typeof issue.resolvedAt !== 'string' || !Number.isFinite(Date.parse(issue.resolvedAt))) errors.push('resolvedAt is required.');
    if (typeof issue.resolutionNote !== 'string' || !issue.resolutionNote.trim()) errors.push('resolutionNote is required.');
  } else if (issue.resolvedAt !== undefined || issue.resolutionNote !== undefined) {
    errors.push('Open issues cannot contain resolution data.');
  }
  return errors.length
    ? { valid: false as const, errors }
    : { valid: true as const, value: issue as PreDepartureIssuePayload };
}
