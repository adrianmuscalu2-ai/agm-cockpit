export const mandateStates = ['OPEN', 'EXECUTING', 'HANDOFF', 'RELEASE', 'RUNTIME_VERIFY', 'TURN_RECONCILE', 'FINAL_VERDICT', 'CLOSED'] as const;
export type MandateState = typeof mandateStates[number];
export type MandateGate = 'STATIC_PASS' | 'BUILD_PASS' | 'TEST_PASS' | 'LOCAL_PASS' | 'DEPLOY_PASS' | 'HEALTH_PASS' | 'RELEASE_COMPLETE' | 'PRODUCTION_VERIFIED' | 'RUNTIME_VERIFIED' | 'INCIDENTS_RECONCILED' | 'TURN_RECONCILED' | 'FINAL_GOAL_REACHED';
export type MandateGateRecord = { gate: MandateGate; passed: boolean; evidence: string; recordedAt: string };
export type MandateCriteria = { finalGoal: string; environment: string; requiredGates: MandateGate[]; acceptanceCriteria: string[]; ownerEscalationConditions: string[]; runtimeImpact: boolean };
export type MandateRecord = { id: string; state: MandateState; criteria: MandateCriteria; currentExecutor: string; gates: MandateGateRecord[]; handoffs: Array<{ from: string; to: string; reason: string; at: string }>; history: Array<{ from?: MandateState; to: MandateState; actor: string; at: string; note: string }>; ownerDecisionPending: boolean };

const transitions: Record<MandateState, MandateState[]> = {
  OPEN: ['EXECUTING'], EXECUTING: ['HANDOFF', 'RELEASE', 'RUNTIME_VERIFY'], HANDOFF: ['EXECUTING'], RELEASE: ['RUNTIME_VERIFY'],
  RUNTIME_VERIFY: ['TURN_RECONCILE'], TURN_RECONCILE: ['FINAL_VERDICT'], FINAL_VERDICT: ['CLOSED'], CLOSED: [],
};

function now() { return new Date().toISOString(); }
function move(record: MandateRecord, state: MandateState, actor: string, note: string): MandateRecord {
  if (!transitions[record.state].includes(state)) throw new Error(`MANDATE_INVALID_TRANSITION:${record.state}->${state}`);
  return { ...record, state, history: [...record.history, { from: record.state, to: state, actor, at: now(), note }] };
}

export function openMandate(id: string, criteria: MandateCriteria, executor: string, at = now()): MandateRecord {
  return { id, state: 'OPEN', criteria, currentExecutor: executor, gates: [], handoffs: [], ownerDecisionPending: false, history: [{ to: 'OPEN', actor: executor, at, note: 'Mandat deschis cu criterii finale și gate-uri obligatorii.' }] };
}

export function transitionMandate(record: MandateRecord, state: MandateState, actor: string, note: string) { return move(record, state, actor, note); }

export function recordMandateGate(record: MandateRecord, gate: MandateGate, passed: boolean, evidence: string, at = now()): MandateRecord {
  if (!evidence.trim()) throw new Error('MANDATE_GATE_EVIDENCE_REQUIRED');
  const gates = [...record.gates.filter((item) => item.gate !== gate), { gate, passed, evidence, recordedAt: at }];
  return { ...record, gates };
}

export function handoffMandate(record: MandateRecord, from: string, to: string, reason: string): MandateRecord {
  if (record.state !== 'EXECUTING') throw new Error('MANDATE_HANDOFF_REQUIRES_EXECUTING');
  const handed = move(record, 'HANDOFF', from, reason);
  return { ...handed, currentExecutor: to, handoffs: [...handed.handoffs, { from, to, reason, at: now() }] };
}

export function releaseRequired(record: MandateRecord) { return record.criteria.runtimeImpact; }

export function mandateClosureGuard(record: MandateRecord): { allowed: boolean; missing: string[] } {
  const passed = new Set(record.gates.filter((item) => item.passed).map((item) => item.gate));
  const required = new Set(record.criteria.requiredGates);
  if (record.criteria.runtimeImpact) ['RELEASE_COMPLETE', 'PRODUCTION_VERIFIED', 'RUNTIME_VERIFIED'].forEach((gate) => required.add(gate as MandateGate));
  ['INCIDENTS_RECONCILED', 'TURN_RECONCILED', 'FINAL_GOAL_REACHED'].forEach((gate) => required.add(gate as MandateGate));
  const missing = [...required].filter((gate) => !passed.has(gate)) as string[];
  if (record.ownerDecisionPending) missing.push('OWNER_DECISION_PENDING');
  return { allowed: record.state === 'FINAL_VERDICT' && missing.length === 0, missing };
}

export function closeMandate(record: MandateRecord, actor: string, note: string): MandateRecord {
  const guard = mandateClosureGuard(record);
  if (!guard.allowed) throw new Error(`MANDATE_CLOSED_GUARD_FAILED:${guard.missing.join(',')}`);
  return move(record, 'CLOSED', actor, note);
}
