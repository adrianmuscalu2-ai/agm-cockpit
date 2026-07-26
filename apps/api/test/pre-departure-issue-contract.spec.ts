import {
  PRE_DEPARTURE_ISSUE_CONTRACT_VERSION,
  validatePreDepartureIssue,
} from '../src/pre-departure-contract/pre-departure-issue-contract';

const issue = {
  contractVersion: PRE_DEPARTURE_ISSUE_CONTRACT_VERSION,
  clientIssueId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  checkId: 'vehicle',
  severity: 'critical',
  description: 'Tyre damage.',
  status: 'open',
  createdAt: '2026-07-26T04:00:00.000Z',
};

describe('Pre-departure issue contract v1', () => {
  it('accepts an open critical issue', () => {
    expect(validatePreDepartureIssue(issue).valid).toBe(true);
  });

  it('requires complete resolution evidence', () => {
    expect(validatePreDepartureIssue({ ...issue, status: 'resolved' }).valid).toBe(false);
    expect(validatePreDepartureIssue({
      ...issue,
      status: 'resolved',
      resolvedAt: '2026-07-26T04:30:00.000Z',
      resolutionNote: 'Tyre replaced and rechecked.',
    }).valid).toBe(true);
  });

  it('rejects resolution data on an open issue', () => {
    expect(validatePreDepartureIssue({ ...issue, resolutionNote: 'Premature.' }).valid).toBe(false);
  });
});
