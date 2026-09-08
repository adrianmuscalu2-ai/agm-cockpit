import {
  evaluateAgentAccountability,
  evaluateAgentRuntimeVerdict,
  evaluateInspectorFailover,
  falseActiveCount,
  type AccountabilitySignal,
} from '../src/authority-control-plane/agent-runtime-accountability.engine';

const now = new Date('2026-09-08T12:00:00.000Z');
const execution = (overrides: Partial<AccountabilitySignal> = {}): AccountabilitySignal => ({
  id: 'execution-1',
  status: 'COMPLETED',
  occurredAt: new Date('2026-09-08T11:55:00.000Z'),
  evidenceRef: 'EventStore:execution-1',
  outputRef: 'urn:agm:output:execution-1',
  ...overrides,
});
const validation = (overrides: Partial<AccountabilitySignal> = {}): AccountabilitySignal => ({
  id: 'validation-1',
  status: 'PASS',
  occurredAt: new Date('2026-09-08T11:56:00.000Z'),
  evidenceRef: 'AuthorityAuditJournal:validation-1',
  outputRef: 'urn:agm:validation:validation-1',
  ...overrides,
});

const evaluate = (overrides: Partial<Parameters<typeof evaluateAgentAccountability>[0]> = {}) => evaluateAgentAccountability({
  capabilityDeclared: true,
  runtimeAbsent: false,
  mandateId: 'mandate-1',
  execution: execution(),
  validation: validation(),
  freshnessWindowMs: 60 * 60 * 1000,
  now,
  ...overrides,
});

describe('agent runtime accountability engine', () => {
  it('declares ACTIVE only for the full evidence chain', () => {
    expect(evaluate()).toEqual(expect.objectContaining({ executable: 'YES', mandate: 'PROVEN', validation: 'PROVEN', freshness: 'CURRENT', status: 'ACTIVE' }));
  });

  it.each([
    [{ capabilityDeclared: false }, 'NOT EXECUTABLE'],
    [{ runtimeAbsent: true }, 'NOT EXECUTABLE'],
    [{ mandateId: null }, 'MANDATE NOT ASSIGNED'],
    [{ execution: null }, 'UNKNOWN / NO TELEMETRY'],
    [{ execution: execution({ evidenceRef: null }) }, 'UNKNOWN / NO TELEMETRY'],
    [{ execution: execution({ outputRef: null }) }, 'UNKNOWN / NO TELEMETRY'],
    [{ execution: execution({ status: 'FAILED' }) }, 'FAIL'],
    [{ execution: execution({ occurredAt: new Date('2026-09-08T09:00:00.000Z') }) }, 'STALE'],
    [{ validation: null }, 'DEGRADED'],
    [{ validation: validation({ status: 'FAIL' }) }, 'DEGRADED'],
    [{ validation: validation({ occurredAt: new Date('2026-09-08T11:54:00.000Z') }) }, 'DEGRADED'],
    [{ controlCoverageLost: true }, 'CONTROL COVERAGE LOST'],
  ] as const)('never converts missing or negative proof into ACTIVE: %s', (input, status) => {
    expect(evaluate(input)).toEqual(expect.objectContaining({ status }));
  });

  it('proves transfer only when the secondary completed current validation with evidence', () => {
    expect(evaluateInspectorFailover({
      primary: execution({ status: 'FAILED' }),
      secondary: execution({ id: 'secondary-1' }),
      transferObservedAt: new Date('2026-09-08T11:55:30.000Z'),
      activeValidatorId: 'secondary',
      secondaryId: 'secondary',
      freshnessWindowMs: 60 * 60 * 1000,
      now,
    })).toEqual(expect.objectContaining({ status: 'PASS', controlCoverage: 'COMPLETE', transferProven: true, secondaryValidationProven: true }));
  });

  it('declares CONTROL COVERAGE LOST without a proven secondary validator', () => {
    expect(evaluateInspectorFailover({
      primary: execution({ status: 'FAILED' }),
      secondary: null,
      transferObservedAt: null,
      activeValidatorId: null,
      secondaryId: 'secondary',
      freshnessWindowMs: 60 * 60 * 1000,
      now,
    })).toEqual(expect.objectContaining({ status: 'FAIL', controlCoverage: 'INCOMPLETE', controlStatus: 'CONTROL COVERAGE LOST' }));
  });

  it('keeps control-system PASS separate from a non-accountable fleet', () => {
    expect(evaluateAgentRuntimeVerdict({
      controlSystemComplete: true,
      agents: [{ status: 'MANDATE NOT ASSIGNED', executable: 'YES', mandate: 'NOT PROVEN', validation: 'PROVEN', executionEvidenceRef: 'event:1' }],
      inspectorFailover: 'PASS',
      controlCoverage: 'COMPLETE',
      overallOperationalState: 'FAIL',
      falseActive: 0,
      unexplainedDegraded: 0,
    })).toEqual(expect.objectContaining({ controlSystem: 'PASS', agentAccountability: 'FAIL', overallOperationalState: 'FAIL', finalAgentRuntimePass: 'FAIL' }));
  });

  it('grants the final runtime PASS only when every agent and the fleet are operational', () => {
    expect(evaluateAgentRuntimeVerdict({
      controlSystemComplete: true,
      agents: [{ status: 'ACTIVE', executable: 'YES', mandate: 'PROVEN', validation: 'PROVEN', executionEvidenceRef: 'event:1' }],
      inspectorFailover: 'PASS',
      controlCoverage: 'COMPLETE',
      overallOperationalState: 'PASS',
      falseActive: 0,
      unexplainedDegraded: 0,
    })).toEqual(expect.objectContaining({
      controlSystem: 'PASS',
      agentAccountability: 'PASS',
      overallOperationalState: 'PASS',
      finalAgentRuntimePass: 'PASS',
    }));
  });

  it('detects every false ACTIVE projection', () => {
    expect(falseActiveCount([
      { status: 'ACTIVE', executable: 'NO', mandate: 'PROVEN', validation: 'PROVEN', executionEvidenceRef: 'event:1' },
      { status: 'ACTIVE', executable: 'YES', mandate: 'NOT PROVEN', validation: 'PROVEN', executionEvidenceRef: 'event:2' },
      { status: 'ACTIVE', executable: 'YES', mandate: 'PROVEN', validation: 'NOT PROVEN', executionEvidenceRef: 'event:3' },
      { status: 'ACTIVE', executable: 'YES', mandate: 'PROVEN', validation: 'PROVEN', executionEvidenceRef: null },
      { status: 'ACTIVE', executable: 'YES', mandate: 'PROVEN', validation: 'PROVEN', executionEvidenceRef: 'event:5' },
    ])).toBe(4);
  });
});
