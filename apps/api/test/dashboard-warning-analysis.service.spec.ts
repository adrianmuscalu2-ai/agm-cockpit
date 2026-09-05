import { parseDashboardWarningCandidate } from '../src/dashboard-warning-analysis/dashboard-warning-analysis.service';

describe('dashboard warning Camera/OCR provider response', () => {
  it('accepts bounded symbol evidence and verbatim visible dashboard text', () => {
    expect(parseDashboardWarningCandidate(JSON.stringify({
      observations: ['red oil-can symbol'],
      visibleText: ['STOP', 'OIL PRESSURE'],
      candidateId: 'WL-004',
      confidence: 0.91,
      limitations: ['vehicle manual required'],
    }))).toEqual({
      observations: ['red oil-can symbol'],
      visibleText: ['STOP', 'OIL PRESSURE'],
      candidateId: 'WL-004',
      confidence: 0.91,
      limitations: ['vehicle manual required'],
    });
  });

  it('accepts fenced JSON but rejects incomplete output', () => {
    expect(parseDashboardWarningCandidate('```json\n{"observations":[],"visibleText":[],"candidateId":null,"confidence":0.2,"limitations":["blurred"]}\n```')?.candidateId).toBeNull();
    expect(parseDashboardWarningCandidate('{"observations":[],"confidence":0.9,"limitations":[]}')).toBeUndefined();
  });

  it('bounds untrusted arrays and confidence', () => {
    const parsed = parseDashboardWarningCandidate(JSON.stringify({
      observations: Array.from({ length: 10 }, (_, index) => `observation-${index}`),
      visibleText: Array.from({ length: 12 }, (_, index) => `text-${index}`),
      candidateId: 'WL-001',
      confidence: 3,
      limitations: Array.from({ length: 10 }, (_, index) => `limit-${index}`),
    }));
    expect(parsed?.observations).toHaveLength(6);
    expect(parsed?.visibleText).toHaveLength(8);
    expect(parsed?.limitations).toHaveLength(6);
    expect(parsed?.confidence).toBe(1);
  });
});
